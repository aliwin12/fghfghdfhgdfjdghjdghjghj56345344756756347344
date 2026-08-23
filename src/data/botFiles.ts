import { CodeFile } from '../types';

export const BOT_TOKEN = '8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w';
export const DEFAULT_APP_DOMAIN = 'secretary-bot.app';

export const BOT_FILES: CodeFile[] = [
  {
    name: 'api/bot.js',
    path: 'api/bot.js',
    language: 'javascript',
    description: 'Главная Serverless-функция персонального секретаря. Строго фильтрует только личные сообщения (DM), мгновенно подтверждает вебхук Telegram и сразу освобождает память без сохранения данных.',
    content: `// api/bot.js
// Персональный секретарь для личных сообщений (Stateless DM Mirror)
// Архитектура: Zero-Retention / Без сохранения состояния (Stateless)

const { Telegraf } = require('telegraf');

// 1. Инициализация экземпляра бота
const BOT_TOKEN = process.env.BOT_TOKEN || '${BOT_TOKEN}';

if (!BOT_TOKEN) {
  console.error('[CONFIG_ERROR] BOT_TOKEN is not defined in environment variables');
}

const bot = new Telegraf(BOT_TOKEN || '');

// Глобальный перехватчик ошибок Telegraf (защита от 500 ошибок в Serverless)
bot.catch((err, ctx) => {
  console.error('[TELEGRAF_BOT_ERROR]', err?.message || err);
});

// 2. Строгий глобальный фильтр: Обрабатываем ИСКЛЮЧИТЕЛЬНО личные сообщения (DM)
bot.use(async (ctx, next) => {
  try {
    if (!ctx.chat || ctx.chat.type !== 'private') {
      if (ctx.chat) {
        console.log(\`[FILTER_DROP] Отклонено сообщение из не-DM чата (Тип: \${ctx.chat.type}, ID: \${ctx.chat.id})\`);
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
      \`💼 <b>Привет, \${ctx.from?.first_name || 'пользователь'}!</b>\\n\\n\` +
      \`Я — ваш <b>Персональный Секретарь</b> для личных сообщений.\\n\\n\` +
      \`📌 <b>Принцип работы:</b>\\n\` +
      \`• Отправьте любой текст, фото, документ, голосовое сообщение или медиафайл.\\n\` +
      \`• Я <b>моментально создам точную копию</b> сообщения в этом диалоге.\\n\` +
      \`• Копия навсегда останется в вашей истории чата Telegram.\\n\` +
      \`• Сам сервер <b>моментально освобождает память</b> (Stateless / 0 байт данных на сервере).\\n\\n\` +
      \`🔒 <i>100% Конфиденциальность: данные не сохраняются.</i>\`
    );
  } catch (err) {
    console.error('[START_CMD_ERROR]', err?.message || err);
  }
});

bot.help(async (ctx) => {
  try {
    return await ctx.replyWithHTML(
      \`ℹ️ <b>Справка Персонального Секретаря:</b>\\n\\n\` +
      \`1. Отправьте любое входящее сообщение: текст, фото, видео, кружок, аудио, файл или стикер.\\n\` +
      \`2. Бот выполнит нативное дублирование (<code>copyMessage</code>).\\n\` +
      \`3. Созданная копия останется в диалоге Telegram навсегда.\\n\` +
      \`4. Сервер не сохраняет базу данных и сразу освобождает память.\\n\\n\` +
      \`⚙️ Доступные команды: /start, /help, /status\`
    );
  } catch (err) {
    console.error('[HELP_CMD_ERROR]', err?.message || err);
  }
});

bot.command('status', async (ctx) => {
  try {
    return await ctx.replyWithHTML(
      \`⚡ <b>Статус:</b> Секретарь активен (Онлайн)\\n\` +
      \`🛡 <b>Режим фильтрации:</b> Строго Private DM (Личные сообщения)\\n\` +
      \`🧠 <b>Хранилище (State):</b> 0 KB (Stateless / Zero Data Retention)\\n\` +
      \`⏱ <b>Uptime:</b> \${process.uptime().toFixed(1)} сек.\\n\` +
      \`📦 <b>Node.js:</b> \${process.version}\`
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
    console.log(\`[DM_COPIED] Сообщение ID \${messageId} продублировано в чат за \${elapsed}ms. Память очищена.\`);
  } catch (err) {
    console.error(\`[DM_COPY_ERROR] Сбой копирования сообщения:\`, err?.message || err);
  }
});

// 5. Экспорт бессерверного обработчика Webhook (Serverless Function Handler)
const handler = async (req, res) => {
  // 1. Обработка GET-запросов (проверка статуса в браузере)
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

      // Безопасный парсинг body (если пришла строка)
      if (typeof update === 'string') {
        try {
          update = JSON.parse(update);
        } catch (parseErr) {
          console.warn('[JSON_PARSE_WARNING] Failed to parse body as JSON');
          update = null;
        }
      }

      if (update && typeof update === 'object') {
        await bot.handleUpdate(update);
      }
    } catch (err) {
      console.error('[WEBHOOK_ERROR]', err?.message || err);
    } finally {
      // МГНОВЕННЫЙ ACK: Всегда возвращаем HTTP 200 OK Telegram серверу
      if (!res.headersSent) {
        res.status(200).end();
      }
    }
    return;
  }

  if (!res.headersSent) {
    res.status(200).end();
  }
};

module.exports = handler;
module.exports.default = handler;
`,
  },
  {
    name: 'vercel.json',
    path: 'vercel.json',
    language: 'json',
    description: 'Конфигурация Vercel Serverless: автоматический маппинг /api/bot без конфликта маршрутов.',
    content: `{
  "version": 2,
  "rewrites": [
    {
      "source": "/webhook",
      "destination": "/api/bot"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
`,
  },
  {
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    description: 'Зависимости проекта: библиотека Telegraf для бессерверной обработки входящих запросов.',
    content: `{
  "name": "telegram-personal-secretary-bot",
  "version": "1.0.0",
  "description": "Stateless Personal Secretary Telegram Bot (DM Mirror & Zero Memory)",
  "main": "api/bot.js",
  "scripts": {
    "start": "node api/bot.js"
  },
  "keywords": [
    "telegram",
    "bot",
    "secretary",
    "telegraf",
    "serverless",
    "stateless",
    "copy-message"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "telegraf": "^4.16.3"
  },
  "engines": {
    "node": ">=18.x"
  }
}
`,
  },
  {
    name: '.env.example',
    path: '.env.example',
    language: 'bash',
    description: 'Шаблон переменных окружения для локальной разработки и облачного деплоя.',
    content: `# Токен вашего Telegram бота (получен у @BotFather)
BOT_TOKEN=8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w

# (Опционально) Секретный токен вебхука для валидации входящих запросов
# WEBHOOK_SECRET=my_ultra_secure_secret_hash_123
`,
  },
  {
    name: '.gitignore',
    path: '.gitignore',
    language: 'bash',
    description: 'Исключает системные папки, зависимости и локальные секреты из репозитория GitHub.',
    content: `# Зависимости
node_modules/

# Локальные переменные окружения
.env
.env.local
.env.*.local

# Системные папки
.vercel

# Логи и временные файлы
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
`,
  },
  {
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    description: 'Документация и описание работы персонального секретаря.',
    content: `# 💼 Telegram Personal Secretary Bot (Stateless DM Mirror)

Персональный Telegram-бот секретарь для личных сообщений:
- ✉️ **Только личные сообщения (Private DM)** — игнорирует группы и каналы.
- 📋 **Мгновенное копирование** — дублирует любое сообщение (текст, фото, видео, кружочки, аудио, файлы, стикеры) через \`copyMessage\`.
- 🧠 **Stateless (Zero Retention)** — моментально забывает данные сразу после отправки, не сохраняя их в базе данных.
- 💾 **Сохранение в чате** — все копии навсегда остаются в ленте диалога пользователя.
`,
  },
];
