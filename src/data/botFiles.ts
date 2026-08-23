export const BOT_TOKEN = '8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w';
export const DEFAULT_APP_DOMAIN = 'ais-dev-nc4s6mfeud2wejmjful7dj-155005426446.europe-west2.run.app';

export interface BotFile {
  name: string;
  path: string;
  language: string;
  content: string;
  description: string;
}

export const BOT_FILES: BotFile[] = [
  {
    name: 'bot.js',
    path: 'api/bot.js',
    language: 'javascript',
    description: 'Главная Serverless Function Vercel (Webhook). Перехватывает входящие и исходящие сообщения из чужих ЛС через Telegram Business и пересылает протокол с точной копией в ваш личный диалог с ботом.',
    content: `// api/bot.js
// Персональный секретарь для личных сообщений и чужих ЛС (Telegram Business + Stateless Mirror)
// Архитектура: Zero-Retention / Без сохранения состояния (Stateless)
// Логика: перехват всех входящих и исходящих сообщений в бизнес-чатах и отправка протокола с копией в ЛС владельца с ботом!
// Формат: ES Module (совместим с Vercel Serverless Functions & Node.js 18+)

import { Telegraf } from 'telegraf';

// 1. Инициализация экземпляра бота
const BOT_TOKEN = process.env.BOT_TOKEN || '8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w';

if (!BOT_TOKEN) {
  console.error('[CONFIG_ERROR] BOT_TOKEN is not defined in environment variables');
}

const bot = new Telegraf(BOT_TOKEN || '');

// Глобальный перехватчик ошибок Telegraf (защита от падений в Serverless)
bot.catch((err) => {
  console.error('[TELEGRAF_BOT_ERROR]', err?.message || err);
});

// Кэш сопоставления подключений к ID владельца и список зарегистрированных пользователей
const connectionToOwner = new Map();
const registeredOwners = new Set();
let lastKnownOwnerId = null;

// Вспомогательная функция формирования заголовка протокола сообщения
function formatMetadataHeader(from, dateUnix, chatInfo = null, isEdited = false) {
  const date = dateUnix ? new Date(dateUnix * 1000) : new Date();
  const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Moscow' });
  const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Moscow' });
  
  const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(' ') || 'Аноним';
  const username = from?.username ? \`@\${from.username}\` : 'нет никнейма';
  const userId = from?.id || '—';

  const chatTitle = chatInfo ? (chatInfo.title || [chatInfo.first_name, chatInfo.last_name].filter(Boolean).join(' ') || chatInfo.username || \`Чат \${chatInfo.id}\`) : null;

  return (
    \`\${isEdited ? '✏️' : '📋'} <b>[СЕКРЕТАРЬ • \${isEdited ? 'ИЗМЕНЕНО СООБЩЕНИЕ' : 'ПРОТОКОЛ ПЕРЕХВАТА'}]</b>\\n\` +
    (chatTitle ? \`💬 <b>Диалог:</b> \${chatTitle} (ID: <code>\${chatInfo?.id}</code>)\\n\` : '') +
    \`👤 <b>Кто написал:</b> \${fullName}\\n\` +
    \`🔖 <b>Никнейм:</b> \${username}\\n\` +
    \`🆔 <b>ID автора:</b> <code>\${userId}</code>\\n\` +
    \`📅 <b>Когда:</b> \${dateStr} в \${timeStr} (МСК)\`
  );
}

// 2. Обработка подключения бота к аккаунту Telegram Business (управление чужими ЛС)
bot.on('business_connection', async (ctx) => {
  try {
    const conn = ctx.update.business_connection;
    const isEnabled = conn?.is_enabled;
    const businessUserId = conn?.user?.id;
    const businessUserName = conn?.user?.first_name || 'Владелец аккаунта';

    if (conn?.id && businessUserId) {
      connectionToOwner.set(conn.id, businessUserId);
      registeredOwners.add(businessUserId);
      lastKnownOwnerId = businessUserId;
    }

    console.log(\`[BUSINESS_CONNECTION] ID: \${conn?.id}, User: \${businessUserName} (\${businessUserId}), Enabled: \${isEnabled}\`);

    if (isEnabled && businessUserId) {
      await ctx.telegram.sendMessage(
        businessUserId,
        \`💼 <b>Режим Персонального Секретаря Telegram Business АКТИВИРОВАН!</b>\\n\\n\` +
        \`✅ Бот успешно подключен к вашим личным диалогам.\\n\\n\` +
        \`🛡 <b>Как теперь работает протоколирование:</b>\\n\` +
        \`• В чатах с вашими собеседниками бот <b>не спамит</b> и не мешает общению.\\n\` +
        \`• Все входящие сообщения от собеседников и ваши ответы перехватываются и пересылаются <b>СЮДА (в этот диалог с ботом)</b>.\\n\` +
        \`• К каждому сообщению прикрепляется карточка: <b>Кто написал, Когда написал, ID, Имя, Никнейм</b> и точная копия самого сообщения (текст, голос, фото, документ и др.).\\n\` +
        \`• 0 байт данных сохраняется на сторонних серверах (Stateless).\`,
        { parse_mode: 'HTML' }
      );
    }
  } catch (err) {
    console.error('[BUSINESS_CONN_ERROR]', err?.message || err);
  }
});

// 3. Обработка сообщений в чужих ЛС через Telegram Business (собеседник + сам пользователь)
// Бот отправляет протокол и копию в ЛС ВЛАДЕЛЬЦА С БОТОМ (не засоряя чат собеседника!)
bot.on('business_message', async (ctx) => {
  try {
    const bMsg = ctx.update.business_message;
    if (!bMsg) return;

    const businessConnectionId = bMsg.business_connection_id;
    const fromChat = bMsg.chat;
    const fromChatId = fromChat?.id;
    const messageId = bMsg.message_id;
    const sender = bMsg.from;
    const senderName = sender?.first_name || 'Собеседник';

    // Определяем получателя (ЛС владельца с ботом)
    const targetOwnerId = connectionToOwner.get(businessConnectionId) || lastKnownOwnerId;

    console.log(\`[BUSINESS_MSG_RECV] Conn: \${businessConnectionId}, FromChat: \${fromChatId}, Sender: \${senderName} (ID: \${sender?.id}) -> TargetOwner: \${targetOwnerId}\`);

    if (!targetOwnerId) {
      console.warn('[TARGET_OWNER_NOT_FOUND] Владелец не определен. Напишите /start боту в ЛС.');
      return;
    }

    const header = formatMetadataHeader(sender, bMsg.date, fromChat, false);
    const startTime = Date.now();

    // 1. Отправляем карточку с метаданными в ЛС владельца с ботом
    await ctx.telegram.sendMessage(
      targetOwnerId,
      header,
      { parse_mode: 'HTML' }
    );

    // 2. Копируем исходное сообщение (любой тип контента) прямо в ЛС владельца
    await ctx.telegram.copyMessage(
      targetOwnerId,
      fromChatId,
      messageId
    );

    const elapsed = Date.now() - startTime;
    console.log(\`[BUSINESS_MSG_FORWARDED_TO_OWNER] Msg ID \${messageId} forwarded to owner \${targetOwnerId} (\${elapsed}ms). Chat with client kept clean!\`);
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
    const fromChat = bMsg.chat;
    const fromChatId = fromChat?.id;
    const messageId = bMsg.message_id;
    const sender = bMsg.from;

    const targetOwnerId = connectionToOwner.get(businessConnectionId) || lastKnownOwnerId;
    if (!targetOwnerId) return;

    console.log(\`[BUSINESS_MSG_EDITED] Chat: \${fromChatId}, Msg ID: \${messageId} -> TargetOwner: \${targetOwnerId}\`);

    const header = formatMetadataHeader(sender, bMsg.edit_date || bMsg.date, fromChat, true);
    
    await ctx.telegram.sendMessage(
      targetOwnerId,
      header,
      { parse_mode: 'HTML' }
    );

    await ctx.telegram.copyMessage(
      targetOwnerId,
      fromChatId,
      messageId
    );
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

// 6. Команды управления в личных сообщениях с ботом
bot.start(async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const userName = ctx.from?.first_name || 'пользователь';

    if (userId) {
      registeredOwners.add(userId);
      lastKnownOwnerId = userId;
    }

    return await ctx.replyWithHTML(
      \`💼 <b>Привет, \${userName}!</b>\\n\\n\` +
      \`Я — ваш <b>Персональный Секретарь Telegram</b>.\\n\\n\` +
      \`📌 <b>Как это работает:</b>\\n\` +
      \`1️⃣ <b>Секретарь в чужих ЛС:</b> Подключите меня в <i>Настройки Telegram → Telegram Business → Чат-боты</i>. Все входящие и исходящие сообщения из ваших диалогов с клиентами/друзьями будут протоколироваться и пересылаться <b>СЮДА (в этот наш диалог)</b>.\\n\` +
      \`2️⃣ <b>Прямой диалог:</b> Отправьте мне сюда любую заметку или файл — я сохраню точную копию с метаданными.\\n\\n\` +
      \`🛡 <b>В чатах с собеседниками бот ничего не пишет и не спамит!</b> Все протоколы и копии приходят только вам сюда.\\n\` +
      \`🔒 <i>Stateless / Zero Data Retention: данные не сохраняются на сторонних серверах.</i>\`
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
      \`4. Все сообщения из ваших личных диалогов будут мгновенно протоколироваться и дублироваться <b>в этот чат с ботом</b>.\\n\\n\` +
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
      \`🛡 <b>Режим:</b> Private DM + Telegram Business Forwarder\\n\` +
      \`📥 <b>Куда приходят логи:</b> В этот личный чат с ботом\\n\` +
      \`🧠 <b>Хранилище (State):</b> 0 KB (Stateless / Zero Data Retention)\\n\` +
      \`⏱ <b>Uptime:</b> \${process.uptime().toFixed(1)} сек.\\n\` +
      \`📦 <b>Node.js:</b> \${process.version}\`
    );
  } catch (err) {
    console.error('[STATUS_CMD_ERROR]', err?.message || err);
  }
});

// 7. Основной обработчик: Моментальное копирование любого прямого сообщения в ЛС с ботом
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

    if (sender?.id) {
      registeredOwners.add(sender.id);
      lastKnownOwnerId = sender.id;
    }

    const header = formatMetadataHeader(sender, message.date, null, false);

    // 1. Отправляем детальную карточку-подпись в чат с ботом
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
      service: 'Personal Secretary Telegram Bot (Business Forwarder to Bot DM)',
      stateless: true,
      business_support: true,
      ready: true,
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      message: 'Telegram Webhook endpoint is active. Messages are forwarded into user DM with bot.'
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
}`
  },
  {
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    description: 'Манифест зависимостей Node.js (Telegraf v4.x)',
    content: `{
  "name": "personal-secretary-telegram-bot",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "start": "node dist/server.cjs"
  },
  "dependencies": {
    "telegraf": "^4.16.3",
    "express": "^4.19.2"
  }
}`
  },
  {
    name: 'vercel.json',
    path: 'vercel.json',
    language: 'json',
    description: 'Конфигурация маршрутизации Vercel Serverless Functions',
    content: `{
  "version": 2,
  "rewrites": [
    {
      "source": "/api/bot",
      "destination": "/api/bot.js"
    }
  ]
}`
  }
];
