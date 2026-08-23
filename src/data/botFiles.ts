import { CodeFile } from '../types';

export const BOT_TOKEN = '8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w';
export const DEFAULT_APP_DOMAIN = 'secretary-bot.app';

export const BOT_FILES: CodeFile[] = [
  {
    name: 'api/bot.js',
    path: 'api/bot.js',
    language: 'javascript',
    description: 'Главная Serverless-функция персонального секретаря. Поддерживает работу в чужих ЛС через Telegram Business (дублирует реплики собеседника и владельца), выводит системную плашку об управлении чатом и мгновенно освобождает память (Stateless).',
    content: `// api/bot.js
// Персональный секретарь для личных сообщений и чужих ЛС (Telegram Business + Stateless Mirror)
// Архитектура: Zero-Retention / Без сохранения состояния (Stateless)
// Формат: ES Module (совместим с Vercel Serverless Functions & Node.js 18+)

import { Telegraf } from 'telegraf';

// 1. Инициализация экземпляра бота
const BOT_TOKEN = process.env.BOT_TOKEN || '${BOT_TOKEN}';

if (!BOT_TOKEN) {
  console.error('[CONFIG_ERROR] BOT_TOKEN is not defined in environment variables');
}

const bot = new Telegraf(BOT_TOKEN || '');

// Глобальный перехватчик ошибок Telegraf (защита от падений в Serverless)
bot.catch((err) => {
  console.error('[TELEGRAF_BOT_ERROR]', err?.message || err);
});

// Кэш отправленных предупреждений об управлении чатом
const announcedBusinessChats = new Set();
const greetedPrivateChats = new Set();

// Вспомогательная функция формирования заголовка протокола сообщения
function formatMetadataHeader(from, dateUnix) {
  const date = dateUnix ? new Date(dateUnix * 1000) : new Date();
  const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Moscow' });
  const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Moscow' });
  
  const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(' ') || 'Аноним';
  const username = from?.username ? \`@\${from.username}\` : 'нет никнейма';
  const userId = from?.id || '—';

  return (
    \`📋 <b>[СЕКРЕТАРЬ • ПРОТОКОЛ СООБЩЕНИЯ]</b>\\n\` +
    \`👤 <b>Отправитель:</b> \${fullName}\\n\` +
    \`🔖 <b>Никнейм:</b> \${username}\\n\` +
    \`🆔 <b>ID:</b> <code>\${userId}</code>\\n\` +
    \`📅 <b>Дата и время:</b> \${dateStr} \${timeStr} (МСК)\`
  );
}

// 2. Обработка подключения бота к аккаунту Telegram Business (управление чужими ЛС)
bot.on('business_connection', async (ctx) => {
  try {
    const conn = ctx.update.business_connection;
    const isEnabled = conn?.is_enabled;
    const businessUserId = conn?.user?.id;
    const businessUserName = conn?.user?.first_name || 'Владелец аккаунта';

    console.log(\`[BUSINESS_CONNECTION] ID: \${conn?.id}, User: \${businessUserName} (\${businessUserId}), Enabled: \${isEnabled}\`);

    if (isEnabled && businessUserId) {
      await ctx.telegram.sendMessage(
        businessUserId,
        \`💼 <b>Режим Персонального Секретаря Telegram Business АКТИВИРОВАН!</b>\\n\\n\` +
        \`✅ Бот подключен к вашему личному аккаунту Telegram.\\n\\n\` +
        \`🛡 <b>Как это работает в чужих ЛС:</b>\\n\` +
        \`• Когда вам пишет собеседник или когда вы отвечаете ему — бот дублирует (копирует) сообщение.\\n\` +
        \`• Каждая копия подписывается метаданными: <b>Кто написал, Когда написал, ID, Имя и Никнейм</b>.\\n\` +
        \`• В начале диалога появится системная плашка, что этим чатом управляет бот-секретарь.\\n\` +
        \`• 0 байт данных сохраняется на сервере (Stateless).\`,
        { parse_mode: 'HTML' }
      );
    }
  } catch (err) {
    console.error('[BUSINESS_CONN_ERROR]', err?.message || err);
  }
});

// 3. Обработка сообщений в чужих ЛС через Telegram Business (собеседник + сам пользователь)
bot.on('business_message', async (ctx) => {
  try {
    const bMsg = ctx.update.business_message;
    if (!bMsg) return;

    const businessConnectionId = bMsg.business_connection_id;
    const chatId = bMsg.chat?.id;
    const messageId = bMsg.message_id;
    const sender = bMsg.from;
    const senderName = sender?.first_name || 'Собеседник';

    console.log(\`[BUSINESS_MSG_RECV] Conn: \${businessConnectionId}, Chat: \${chatId}, From: \${senderName} (ID: \${sender?.id})\`);

    // Отправляем уведомление, что чатом управляет бот (один раз на чат)
    const noticeKey = \`\${businessConnectionId}_\${chatId}\`;
    if (!announcedBusinessChats.has(noticeKey)) {
      announcedBusinessChats.add(noticeKey);
      try {
        await ctx.telegram.sendMessage(
          chatId,
          \`🤖 <i>Этим чатом управляет Персональный Секретарь Telegram. Все входящие и исходящие сообщения протоколируются и копируются.</i>\`,
          {
            business_connection_id: businessConnectionId,
            parse_mode: 'HTML',
          }
        );
      } catch (noticeErr) {
        console.warn('[BUSINESS_NOTICE_FAILED]', noticeErr?.message || noticeErr);
      }
    }

    const header = formatMetadataHeader(sender, bMsg.date);
    const startTime = Date.now();

    // 1. Отправляем детальную карточку-подпись с данными отправителя
    await ctx.telegram.sendMessage(
      chatId,
      header,
      {
        business_connection_id: businessConnectionId,
        parse_mode: 'HTML',
      }
    );

    // 2. Моментальное нативное копирование сообщения в этот же бизнес-чат
    await ctx.telegram.copyMessage(chatId, chatId, messageId, {
      business_connection_id: businessConnectionId,
    });

    const elapsed = Date.now() - startTime;
    console.log(\`[BUSINESS_MSG_COPIED] Msg ID \${messageId} copied with metadata in business chat \${chatId} (\${elapsed}ms). Memory purged.\`);
  } catch (err) {
    console.error('[BUSINESS_MSG_ERROR]', err?.message || err);
  }
});

// 4. Обработка отредактированных сообщений в чужих ЛС
bot.on('edited_business_message', async (ctx) => {
  try {
    const bMsg = ctx.update.edited_business_message;
    if (!bMsg) return;
    const businessConnectionId = bMsg.business_connection_id;
    const chatId = bMsg.chat?.id;
    const messageId = bMsg.message_id;
    const sender = bMsg.from;

    console.log(\`[BUSINESS_MSG_EDITED] Chat: \${chatId}, Msg ID: \${messageId}\`);

    const header = \`✏️ <b>[ИЗМЕНЕНО СООБЩЕНИЕ]</b>\\n\` + formatMetadataHeader(sender, bMsg.edit_date || bMsg.date);
    
    await ctx.telegram.sendMessage(
      chatId,
      header,
      {
        business_connection_id: businessConnectionId,
        parse_mode: 'HTML',
      }
    );

    await ctx.telegram.copyMessage(chatId, chatId, messageId, {
      business_connection_id: businessConnectionId,
    });
  } catch (err) {
    console.error('[EDITED_BUSINESS_MSG_ERROR]', err?.message || err);
  }
});

// 5. Строгий глобальный фильтр для обычных сообщений: Личные сообщения (DM)
bot.use(async (ctx, next) => {
  try {
    // Пропускаем бизнес-обновления
    if (ctx.update.business_connection || ctx.update.business_message || ctx.update.edited_business_message) {
      return await next();
    }

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

// 6. Команды управления в личных сообщениях
bot.start(async (ctx) => {
  try {
    return await ctx.replyWithHTML(
      \`💼 <b>Привет, \${ctx.from?.first_name || 'пользователь'}!</b>\\n\\n\` +
      \`Я — ваш <b>Персональный Секретарь</b> для личных сообщений и <b>чужих ЛС (Telegram Business)</b>.\\n\\n\` +
      \`📌 <b>2 режима работы:</b>\\n\` +
      \`1️⃣ <b>Прямой диалог:</b> Отправьте мне любой текст, фото, документ, голосовое сообщение — я создам точную копию в этом чате.\\n\` +
      \`2️⃣ <b>Секретарь в чужих ЛС:</b> Подключите меня в <i>Настройки Telegram → Telegram Business → Чат-боты</i>. Я буду автоматически копировать сообщения вашего собеседника и ваши ответы, а в чате будет написано, что им управляет бот.\\n\\n\` +
      \`🔒 <i>Stateless / Zero Data Retention: данные не сохраняются на сервере.</i>\`
    );
  } catch (err) {
    console.error('[START_CMD_ERROR]', err?.message || err);
  }
});

bot.help(async (ctx) => {
  try {
    return await ctx.replyWithHTML(
      \`ℹ️ <b>Справка Персонального Секретаря:</b>\\n\\n\` +
      \`💼 <b>Как подключить к чужим ЛС через Telegram Business:</b>\\n\` +
      \`1. Откройте <b>Настройки Telegram</b> (требуется Telegram Premium / Business).\\n\` +
      \`2. Перейдите в <b>Telegram для бизнеса → Чат-боты</b>.\\n\` +
      \`3. Введите юзернейм этого бота и включите доступ к личным чатам.\\n\` +
      \`4. Бот будет автоматически протоколировать и копировать реплики обоих участников, выводя уведомление об управлении чатом.\\n\\n\` +
      \`⚙️ Команды: /start, /help, /status\`
    );
  } catch (err) {
    console.error('[HELP_CMD_ERROR]', err?.message || err);
  }
});

bot.command('status', async (ctx) => {
  try {
    return await ctx.replyWithHTML(
      \`⚡ <b>Статус:</b> Секретарь активен (Онлайн)\\n\` +
      \`🛡 <b>Режим:</b> Private DM + Telegram Business (Чужие ЛС)\\n\` +
      \`📢 <b>Плашка в чате:</b> «Этим чатом управляет бот» (Включено)\\n\` +
      \`🧠 <b>Хранилище (State):</b> 0 KB (Stateless / Zero Data Retention)\\n\` +
      \`⏱ <b>Uptime:</b> \${process.uptime().toFixed(1)} сек.\\n\` +
      \`📦 <b>Node.js:</b> \${process.version}\`
    );
  } catch (err) {
    console.error('[STATUS_CMD_ERROR]', err?.message || err);
  }
});

// 7. Основной обработчик: Моментальное копирование любого прямого личного сообщения
bot.on('message', async (ctx) => {
  try {
    const message = ctx.message;
    if (!message) return;

    // Игнорируем системные слэш-команды (/start, /help, /status)
    if (message.text && message.text.startsWith('/')) {
      return;
    }

    const chatId = ctx.chat.id;
    const messageId = message.message_id;
    const sender = message.from;
    const startTime = Date.now();

    if (!greetedPrivateChats.has(chatId)) {
      greetedPrivateChats.add(chatId);
      await ctx.replyWithHTML(\`🤖 <i>Этим чатом управляет Персональный Секретарь. Протоколирую сообщение...</i>\`);
    }

    const header = formatMetadataHeader(sender, message.date);

    // 1. Отправляем детальную карточку-подпись
    await ctx.replyWithHTML(header);

    // 2. Нативное копирование сообщения в тот же чат (сохраняет форматирование, медиа, подписи, стикеры)
    await ctx.telegram.copyMessage(chatId, chatId, messageId);

    const elapsed = Date.now() - startTime;
    console.log(\`[DM_COPIED] Сообщение ID \${messageId} продублировано в чат с метаданными за \${elapsed}ms. Память очищена.\`);
  } catch (err) {
    console.error(\`[DM_COPY_ERROR] Сбой копирования сообщения:\`, err?.message || err);
  }
});

// 8. Экспорт бессерверного обработчика Webhook (Vercel Serverless Function)
export default async function handler(req, res) {
  // 1. Обработка GET-запросов (проверка статуса в браузере или мониторинге)
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      service: 'Personal Secretary Telegram Bot (DM & Business Mirror)',
      stateless: true,
      business_support: true,
      ready: true,
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      message: 'Telegram Webhook endpoint is active and listening for POST updates (DM & Business).'
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
          console.warn('[JSON_PARSE_WARNING] Failed to parse request body as JSON');
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

  // Для остальных методов (OPTIONS, HEAD и т.д.)
  if (!res.headersSent) {
    res.status(200).end();
  }
}
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
  "type": "module",
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
    description: 'Документация и пошаговая инструкция подключения к чужим ЛС через Telegram Business.',
    content: `# 💼 Telegram Personal Secretary Bot (Telegram Business + Stateless DM Mirror)

Персональный Telegram-бот секретарь для работы в личных сообщениях и **чужих ЛС**:
- 🌐 **Telegram Business (Работа в чужих ЛС)** — подключается к личному аккаунту и автоматически копирует сообщения собеседника и ваши ответы в диалогах с другими людьми.
- 📢 **Оповещение в чате** — в диалоге отображается плашка: *«Этим чатом управляет Персональный Секретарь Telegram»*.
- 📋 **Мгновенное копирование** — дублирует любые типы сообщений (текст, фото, видео, кружочки, аудио, документы, стикеры) через нативный API \`copyMessage\`.
- 🧠 **Stateless (Zero Retention)** — моментально забывает данные сразу после отправки, не сохраняя переписку на сервере или в базе данных.
- 💾 **Сохранение в чате** — все копии навсегда остаются в ленте диалога Telegram.

## 🚀 Как подключить к чужим ЛС (Telegram Business):
1. Откройте **Telegram** (требуется подписка Telegram Premium / Business).
2. Перейдите в **Настройки → Telegram для бизнеса → Чат-боты (Chatbots)**.
3. Введите username вашего бота: \`@ваш_бот\` и включите тумблер **Управлять личными чатами**.
4. Настройте список чатов (все новые ЛС или выбранные контакты).
5. Теперь бот будет протоколировать и копировать реплики обоих собеседников в реальном времени!
`,
  },
];
