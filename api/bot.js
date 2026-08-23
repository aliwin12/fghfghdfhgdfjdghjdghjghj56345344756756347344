// api/bot.js
// Персональный секретарь для личных сообщений (Stateless DM Mirror)
// Архитектура: Zero-Retention / Без сохранения состояния (Stateless)

const { Telegraf } = require('telegraf');

// 1. Инициализация экземпляра бота
const BOT_TOKEN = process.env.BOT_TOKEN || '8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w';

if (!BOT_TOKEN) {
  console.error('[CONFIG_ERROR] BOT_TOKEN is not defined');
}

const bot = new Telegraf(BOT_TOKEN || '');

// Глобальный перехватчик ошибок Telegraf (предотвращает падение Serverless Function с 500 ошибкой)
bot.catch((err, ctx) => {
  console.error('[TELEGRAF_BOT_ERROR]', err?.message || err);
});

// 2. Строгий глобальный фильтр: Обрабатываем ИСКЛЮЧИТЕЛЬНО личные сообщения (DM)
bot.use(async (ctx, next) => {
  try {
    if (!ctx.chat || ctx.chat.type !== 'private') {
      if (ctx.chat) {
        console.log(`[FILTER_DROP] Отклонено сообщение из не-DM чата (Тип: ${ctx.chat.type}, ID: ${ctx.chat.id})`);
      }
      return; // Завершаем выполнение без каких-либо действий
    }
    return await next();
  } catch (err) {
    console.error('[MIDDLEWARE_ERROR]', err?.message || err);
  }
});

// 3. Команды управления в личных сообщениях
bot.start(async (ctx) => {
  try {
    return await ctx.replyWithHTML(
      `💼 <b>Привет, ${ctx.from?.first_name || 'пользователь'}!</b>\n\n` +
      `Я — ваш <b>Персональный Секретарь</b> для личных сообщений.\n\n` +
      `📌 <b>Принцип работы:</b>\n` +
      `• Отправьте любой текст, фото, документ, голосовое сообщение или медиафайл.\n` +
      `• Я <b>моментально создам точную копию</b> сообщения в этом диалоге.\n` +
      `• Копия навсегда останется в вашей истории чата Telegram.\n` +
      `• Сам сервер <b>моментально освобождает память</b> (Stateless / 0 байт данных на сервере).\n\n` +
      `🔒 <i>100% Конфиденциальность: данные не сохраняются.</i>`
    );
  } catch (err) {
    console.error('[START_CMD_ERROR]', err?.message || err);
  }
});

bot.help(async (ctx) => {
  try {
    return await ctx.replyWithHTML(
      `ℹ️ <b>Справка Персонального Секретаря:</b>\n\n` +
      `1. Отправьте любое входящее сообщение: текст, фото, видео, кружок, аудио, файл или стикер.\n` +
      `2. Бот выполнит нативное дублирование (<code>copyMessage</code>).\n` +
      `3. Созданная копия останется в диалоге Telegram навсегда.\n` +
      `4. Сервер не сохраняет базу данных и сразу освобождает память.\n\n` +
      `⚙️ Доступные команды: /start, /help, /status`
    );
  } catch (err) {
    console.error('[HELP_CMD_ERROR]', err?.message || err);
  }
});

bot.command('status', async (ctx) => {
  try {
    return await ctx.replyWithHTML(
      `⚡ <b>Статус:</b> Секретарь активен (Онлайн)\n` +
      `🛡 <b>Режим фильтрации:</b> Строго Private DM (Личные сообщения)\n` +
      `🧠 <b>Хранилище (State):</b> 0 KB (Stateless / Zero Data Retention)\n` +
      `⏱ <b>Uptime:</b> ${process.uptime().toFixed(1)} сек.\n` +
      `📦 <b>Node.js:</b> ${process.version}`
    );
  } catch (err) {
    console.error('[STATUS_CMD_ERROR]', err?.message || err);
  }
});

// 4. Основной обработчик: Моментальное копирование любого личного сообщения
bot.on('message', async (ctx) => {
  try {
    const message = ctx.message;
    if (!message) return;

    // Игнорируем системные слэш-команды (/start, /help, /status), чтобы не дублировать их
    if (message.text && message.text.startsWith('/')) {
      return;
    }

    const chatId = ctx.chat.id;
    const messageId = message.message_id;
    const startTime = Date.now();

    // Нативное копирование сообщения в тот же чат (сохраняет форматирование, медиа, подписи, стикеры)
    await ctx.telegram.copyMessage(chatId, chatId, messageId);

    const elapsed = Date.now() - startTime;
    console.log(`[DM_COPIED] Сообщение ID ${messageId} продублировано в чат за ${elapsed}ms. Память очищена.`);
  } catch (err) {
    console.error(`[DM_COPY_ERROR] Сбой копирования сообщения:`, err?.message || err);
  }
});

// 5. Экспорт бессерверного обработчика Webhook (Serverless Function Handler)
const handler = async (req, res) => {
  // 1. Обработка GET-запросов (проверка работоспособности в браузере)
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      service: 'Personal Secretary Telegram Bot (Stateless DM Mirror)',
      stateless: true,
      ready: true,
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      message: 'Telegram Webhook endpoint is active and listening for POST updates.'
    });
  }

  // 2. Обработка POST-запросов от Telegram Webhook
  if (req.method === 'POST') {
    try {
      let update = req.body;

      // Безопасный парсинг body, если он пришел в виде строки или буфера
      if (typeof update === 'string') {
        try {
          update = JSON.parse(update);
        } catch (parseErr) {
          console.warn('[JSON_PARSE_WARNING] Failed to parse request body as JSON:', parseErr.message);
          update = null;
        }
      }

      if (update && typeof update === 'object') {
        await bot.handleUpdate(update);
      }
    } catch (err) {
      console.error('[WEBHOOK_ERROR]', err?.message || err);
    } finally {
      // МГНОВЕННЫЙ ACK: Всегда возвращаем HTTP 200 OK Telegram серверу для подтверждения доставки
      if (!res.headersSent) {
        res.status(200).end();
      }
    }
    return;
  }

  // Для остальных методов (OPTIONS, PUT, DELETE)
  if (!res.headersSent) {
    res.status(200).end();
  }
};

module.exports = handler;
module.exports.default = handler;

