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
    description: 'Главная Serverless Function Vercel (Webhook) с защитой от слётов сессий (Zero-Drop Engine). Авто-восстанавливает связь через Telegram API 7.2+, сохраняет состояние в data/secretary-state.json, фильтрует по /mode и позволяет делиться с коллегами (/share, /team).',
    content: `// api/bot.js
// Персональный секретарь для личных сообщений и чужих ЛС (Telegram Business + Stateless Mirror)
// Архитектура: Zero-Retention / Без сохранения состояния (Stateless) + Persistent Anti-Drop Engine
// Логика: перехват входящих/исходящих сообщений в бизнес-чатах и отправка протокола с копией в ЛС владельца с ботом!
// Поддержка: индивидуальная доставка подключившему владельцу, фильтрация (/mode) и шеринг (/share, /team)
// Формат: ES Module (совместим с Vercel Serverless Functions & Node.js 18+)

import { Telegraf } from 'telegraf';
import fs from 'fs';
import path from 'path';

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

// Режимы фильтрации: 'all' (все сообщения), 'my_only' (только исходящие владельца), 'clients_only' (только входящие от клиентов)
const ownerFilterMode = new Map();

// Список доверенных получателей (делегатов) владельца: Map<ownerId, Set<delegateId>>
const ownerDelegates = new Map();

// --- PERSISTENT STATE STORAGE (Zero-Drop Engine) ---
const STATE_DIR = path.join(process.cwd(), 'data');
const STATE_FILE_PATH = path.join(STATE_DIR, 'secretary-state.json');
const FALLBACK_STATE_PATH = path.join('/tmp', 'secretary-state.json');

function loadPersistentState() {
  try {
    let filePath = STATE_FILE_PATH;
    if (!fs.existsSync(filePath) && fs.existsSync(FALLBACK_STATE_PATH)) {
      filePath = FALLBACK_STATE_PATH;
    }
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (data.connections) {
        Object.entries(data.connections).forEach(([c, o]) => connectionToOwner.set(c, o));
      }
      if (Array.isArray(data.registeredOwners)) {
        data.registeredOwners.forEach((id) => registeredOwners.add(id));
      }
      if (data.lastKnownOwnerId) lastKnownOwnerId = data.lastKnownOwnerId;
      if (data.ownerFilterMode) {
        Object.entries(data.ownerFilterMode).forEach(([id, m]) => ownerFilterMode.set(parseInt(id, 10), m));
      }
      if (data.ownerDelegates) {
        Object.entries(data.ownerDelegates).forEach(([id, list]) => ownerDelegates.set(parseInt(id, 10), new Set(list)));
      }
    }
  } catch (err) {
    console.warn('[PERSISTENCE_LOAD_WARN]', err?.message || err);
  }
}

function savePersistentState() {
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    const state = {
      connections: Object.fromEntries(connectionToOwner.entries()),
      registeredOwners: Array.from(registeredOwners),
      lastKnownOwnerId,
      ownerFilterMode: Object.fromEntries(ownerFilterMode.entries()),
      ownerDelegates: Object.fromEntries(Array.from(ownerDelegates.entries()).map(([k, v]) => [k, Array.from(v)])),
      lastUpdated: new Date().toISOString(),
    };
    try {
      fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    } catch {
      fs.writeFileSync(FALLBACK_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('[PERSISTENCE_SAVE_WARN]', err?.message || err);
  }
}

loadPersistentState();

// Динамическое API-восстановление владельца (защита от потери сессии)
async function resolveOwnerId(telegram, businessConnectionId) {
  if (businessConnectionId && connectionToOwner.has(businessConnectionId)) {
    return connectionToOwner.get(businessConnectionId);
  }
  if (businessConnectionId && telegram?.getBusinessConnection) {
    try {
      const connInfo = await telegram.getBusinessConnection(businessConnectionId);
      if (connInfo?.user?.id) {
        const ownerId = connInfo.user.id;
        connectionToOwner.set(businessConnectionId, ownerId);
        registeredOwners.add(ownerId);
        lastKnownOwnerId = ownerId;
        savePersistentState();
        return ownerId;
      }
    } catch (e) {
      console.warn('[DYNAMIC_RECOVERY_WARN]', e?.message || e);
    }
  }
  return lastKnownOwnerId || (registeredOwners.size > 0 ? Array.from(registeredOwners)[0] : null);
}

// Вспомогательная функция экранирования HTML
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
    (chatTitle ? \`💬 <b>Диалог:</b> \${chatTitle}\\n\` : '') +
    \`👤 <b>Кто написал:</b> \${fullName} (\${username})\\n\` +
    \`🆔 <b>ID автора:</b> <code>\${userId}</code>\\n\` +
    \`📅 <b>Когда:</b> \${dateStr} в \${timeStr} (МСК)\`
  );
}

// Клавиатура шеринга под сообщением
function getShareKeyboard(previewText = 'Секретарь') {
  return {
    inline_keyboard: [
      [
        { text: '📤 Поделиться в Telegram', switch_inline_query: previewText.slice(0, 40) },
        { text: '👥 Переслать коллегам', callback_data: 'share_to_delegates' },
      ],
      [
        { text: '⚙️ Фильтры сообщений', callback_data: 'open_filter_menu' },
        { text: '👥 Список команды', callback_data: 'open_team_menu' },
      ],
    ],
  };
}

// Универсальная доставка сообщения СТРОГО подключившему владельцу и его доверенным получателям
async function dispatchBusinessMessage(telegram, bMsg, targetOwnerId, isEdited = false) {
  const sender = bMsg.from;
  const fromChat = bMsg.chat;
  const fromChatId = fromChat?.id;
  const messageId = bMsg.message_id;

  // Проверяем фильтр владельца
  const currentFilter = ownerFilterMode.get(targetOwnerId) || 'all';
  const isSentByOwner = sender?.id === targetOwnerId;

  if (currentFilter === 'my_only' && !isSentByOwner) {
    console.log(\`[FILTER_SKIP] Message from \${sender?.id} ignored (mode: my_only, owner: \${targetOwnerId})\`);
    return;
  }

  if (currentFilter === 'clients_only' && isSentByOwner) {
    console.log(\`[FILTER_SKIP] Outgoing message from owner \${targetOwnerId} ignored (mode: clients_only)\`);
    return;
  }

  const header = formatMetadataHeader(sender, isEdited ? (bMsg.edit_date || bMsg.date) : bMsg.date, fromChat, isEdited);
  const shareKeyboard = getShareKeyboard(bMsg.text || bMsg.caption || 'Сообщение');

  // Получатели: владелец + доверенные лица
  const recipients = new Set([targetOwnerId]);
  const delegates = ownerDelegates.get(targetOwnerId);
  if (delegates) {
    for (const delegateId of delegates) {
      recipients.add(delegateId);
    }
  }

  for (const recipientId of recipients) {
    try {
      const isDelegate = recipientId !== targetOwnerId;
      const delegatePrefix = isDelegate ? \`<i>[ПЕРЕСЛАНО ИЗ БИЗНЕС-АККАУНТА @\${sender?.username || targetOwnerId}]</i>\\n\\n\` : '';

      // 1. ТЕКСТОВОЕ СООБЩЕНИЕ
      if (bMsg.text) {
        const fullText = \`\${delegatePrefix}\${header}\\n\\n✉️ <b>Текст сообщения:</b>\\n<blockquote>\${escapeHtml(bMsg.text)}</blockquote>\`;
        if (fullText.length <= 4000) {
          await telegram.sendMessage(recipientId, fullText, {
            parse_mode: 'HTML',
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        } else {
          await telegram.sendMessage(recipientId, \`\${delegatePrefix}\${header}\`, { parse_mode: 'HTML' });
          await telegram.sendMessage(recipientId, bMsg.text, {
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        }
        continue;
      }

      // 2. ФОТОГРАФИЯ
      if (bMsg.photo && bMsg.photo.length > 0) {
        const highestPhoto = bMsg.photo[bMsg.photo.length - 1];
        const captionText = bMsg.caption ? \`\\n\\n💬 <b>Подпись к фото:</b>\\n<blockquote>\${escapeHtml(bMsg.caption)}</blockquote>\` : '';
        const fullCaption = \`\${delegatePrefix}\${header}\${captionText}\`;
        
        if (fullCaption.length <= 1024) {
          await telegram.sendPhoto(recipientId, highestPhoto.file_id, {
            caption: fullCaption,
            parse_mode: 'HTML',
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        } else {
          await telegram.sendMessage(recipientId, fullCaption, { parse_mode: 'HTML' });
          await telegram.sendPhoto(recipientId, highestPhoto.file_id, {
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        }
        continue;
      }

      // 3. ГОЛОСОВОЕ СООБЩЕНИЕ
      if (bMsg.voice) {
        const duration = bMsg.voice.duration || 0;
        const fullCaption = \`\${delegatePrefix}\${header}\\n\\n🎤 <i>Голосовое сообщение (\${duration} сек.)</i>\`;
        if (fullCaption.length <= 1024) {
          await telegram.sendVoice(recipientId, bMsg.voice.file_id, {
            caption: fullCaption,
            parse_mode: 'HTML',
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        } else {
          await telegram.sendMessage(recipientId, fullCaption, { parse_mode: 'HTML' });
          await telegram.sendVoice(recipientId, bMsg.voice.file_id, {
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        }
        continue;
      }

      // 4. ВИДЕОСООБЩЕНИЕ (Кружочек)
      if (bMsg.video_note) {
        await telegram.sendMessage(recipientId, \`\${delegatePrefix}\${header}\\n\\n🎥 <i>Видеосообщение (кружочек)</i>\`, { parse_mode: 'HTML' });
        await telegram.sendVideoNote(recipientId, bMsg.video_note.file_id, {
          reply_markup: isDelegate ? undefined : shareKeyboard,
        });
        continue;
      }

      // 5. ДОКУМЕНТ / ФАЙЛ
      if (bMsg.document) {
        const docName = bMsg.document.file_name ? \` (<code>\${escapeHtml(bMsg.document.file_name)}</code>)\` : '';
        const captionText = bMsg.caption ? \`\\n\\n💬 <b>Подпись:</b>\\n<blockquote>\${escapeHtml(bMsg.caption)}</blockquote>\` : '';
        const fullCaption = \`\${delegatePrefix}\${header}\\n📁 <b>Файл:</b>\${docName}\${captionText}\`;
        
        if (fullCaption.length <= 1024) {
          await telegram.sendDocument(recipientId, bMsg.document.file_id, {
            caption: fullCaption,
            parse_mode: 'HTML',
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        } else {
          await telegram.sendMessage(recipientId, fullCaption, { parse_mode: 'HTML' });
          await telegram.sendDocument(recipientId, bMsg.document.file_id, {
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        }
        continue;
      }

      // 6. ВИДЕО
      if (bMsg.video) {
        const captionText = bMsg.caption ? \`\\n\\n💬 <b>Подпись:</b>\\n<blockquote>\${escapeHtml(bMsg.caption)}</blockquote>\` : '';
        const fullCaption = \`\${delegatePrefix}\${header}\${captionText}\`;
        if (fullCaption.length <= 1024) {
          await telegram.sendVideo(recipientId, bMsg.video.file_id, {
            caption: fullCaption,
            parse_mode: 'HTML',
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        } else {
          await telegram.sendMessage(recipientId, fullCaption, { parse_mode: 'HTML' });
          await telegram.sendVideo(recipientId, bMsg.video.file_id, {
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        }
        continue;
      }

      // 7. СТИКЕР
      if (bMsg.sticker) {
        const emoji = bMsg.sticker.emoji ? \` (\${bMsg.sticker.emoji})\` : '';
        await telegram.sendMessage(recipientId, \`\${delegatePrefix}\${header}\\n\\n🏷 <b>Стикер</b>\${emoji}\`, { parse_mode: 'HTML' });
        await telegram.sendSticker(recipientId, bMsg.sticker.file_id, {
          reply_markup: isDelegate ? undefined : shareKeyboard,
        });
        continue;
      }

      // Резервный вариант
      await telegram.sendMessage(recipientId, \`\${delegatePrefix}\${header}\`, {
        parse_mode: 'HTML',
        reply_markup: isDelegate ? undefined : shareKeyboard,
      });
      if (fromChatId && messageId) {
        try {
          await telegram.copyMessage(recipientId, fromChatId, messageId);
        } catch (copyErr) {
          console.warn('[FALLBACK_COPY_FAILED]', copyErr?.message || copyErr);
        }
      }
    } catch (sendErr) {
      console.error(\`[DISPATCH_ERROR_RECIPIENT_\${recipientId}]\`, sendErr?.message || sendErr);
    }
  }
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
        \`• Сообщения пересылаются <b>СТРОГО ВАМ (в этот диалог с ботом)</b>.\\n\` +
        \`• Настроить фильтр (только мои / только клиентов / все): <code>/mode</code>\\n\` +
        \`• Делиться с доверенными коллегами: <code>/share &lt;ID&gt;</code> и <code>/team</code>\\n\` +
        \`• 0 байт данных сохраняется на сторонних серверах (Stateless).\`,
        { parse_mode: 'HTML' }
      );
    }
  } catch (err) {
    console.error('[BUSINESS_CONN_ERROR]', err?.message || err);
  }
});

// 3. Обработка сообщений в чужих ЛС через Telegram Business
bot.on('business_message', async (ctx) => {
  try {
    const bMsg = ctx.update.business_message;
    if (!bMsg) return;

    const businessConnectionId = bMsg.business_connection_id;
    const sender = bMsg.from;
    const targetOwnerId = connectionToOwner.get(businessConnectionId) || lastKnownOwnerId;

    if (!targetOwnerId) {
      console.warn('[TARGET_OWNER_NOT_FOUND] Владелец не определен. Напишите /start боту в ЛС.');
      return;
    }

    await dispatchBusinessMessage(ctx.telegram, bMsg, targetOwnerId, false);
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
    const targetOwnerId = connectionToOwner.get(businessConnectionId) || lastKnownOwnerId;
    if (!targetOwnerId) return;

    await dispatchBusinessMessage(ctx.telegram, bMsg, targetOwnerId, true);
  } catch (err) {
    console.error('[EDITED_BUSINESS_MSG_ERROR]', err?.message || err);
  }
});

// 5. Команды управления в личных сообщениях с ботом (/start, /help, /mode, /share, /unshare, /team, /status)
bot.command(['mode', 'filter'], async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const currentMode = ownerFilterMode.get(userId) || 'all';

  return await ctx.replyWithHTML(
    \`⚙️ <b>Настройка фильтрации бизнес-сообщений:</b>\\n\\n\` +
    \`Текущий режим: <b>\${currentMode === 'all' ? '💬 Все сообщения' : currentMode === 'my_only' ? '👤 Только мои' : '👥 Только клиентов'}</b>\`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: (currentMode === 'all' ? '✅ ' : '') + '💬 Все сообщения', callback_data: 'set_filter_all' }],
          [{ text: (currentMode === 'my_only' ? '✅ ' : '') + '👤 Только мои сообщения', callback_data: 'set_filter_my_only' }],
          [{ text: (currentMode === 'clients_only' ? '✅ ' : '') + '👥 Только от клиентов', callback_data: 'set_filter_clients_only' }],
        ],
      },
    }
  );
});

bot.command('share', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const args = ctx.message.text.split(' ').slice(1).filter(Boolean);
  if (args.length === 0) {
    return await ctx.replyWithHTML('Использование: <code>/share &lt;Telegram_ID_коллеги&gt;</code>');
  }
  const targetId = parseInt(args[0], 10);
  if (isNaN(targetId)) return await ctx.reply('❌ Укажите корректный числовой ID.');
  
  if (!ownerDelegates.has(userId)) ownerDelegates.set(userId, new Set());
  ownerDelegates.get(userId).add(targetId);
  return await ctx.replyWithHTML(\`✅ Коллега <code>\${targetId}</code> добавлен в список доверенных получателей.\`);
});

bot.command('unshare', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const args = ctx.message.text.split(' ').slice(1).filter(Boolean);
  const targetId = parseInt(args[0], 10);
  const delegates = ownerDelegates.get(userId);
  if (delegates && delegates.has(targetId)) {
    delegates.delete(targetId);
    return await ctx.replyWithHTML(\`✅ Пользователь <code>\${targetId}</code> удален из списка.\`);
  }
  return await ctx.replyWithHTML(\`ℹ️ Пользователь <code>\${targetId}</code> не найден в списке.\`);
});

bot.command('team', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const delegates = ownerDelegates.get(userId);
  if (!delegates || delegates.size === 0) {
    return await ctx.replyWithHTML('👥 Список доверенных коллег пуст. Добавьте: <code>/share &lt;ID&gt;</code>');
  }
  const listStr = Array.from(delegates).map((id, idx) => \`\${idx + 1}. 🆔 <code>\${id}</code>\`).join('\\n');
  return await ctx.replyWithHTML(\`👥 <b>Доверенные получатели (\${delegates.size} чел.):</b>\\n\\n\${listStr}\`);
});

// Экспорт бессерверного обработчика Webhook (Vercel Serverless Function)
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'Personal Secretary Bot', stateless: true });
  }
  if (req.method === 'POST') {
    try {
      const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (update) await bot.handleUpdate(update);
    } catch (err) {
      console.error('[WEBHOOK_ERROR]', err?.message || err);
    } finally {
      if (!res.headersSent) res.status(200).end();
    }
    return;
  }
  if (!res.headersSent) res.status(200).end();
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
