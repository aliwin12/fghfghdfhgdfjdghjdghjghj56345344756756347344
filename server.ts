import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN || '8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w';
const bot = new Telegraf(BOT_TOKEN || '');

// Global error handler
bot.catch((err: any) => {
  console.error('[TELEGRAF_BOT_ERROR]', err?.message || err);
});

// Cache for business connection to owner and registered owners
const connectionToOwner = new Map<string, number>();
const registeredOwners = new Set<number>();
let lastKnownOwnerId: number | null = null;

// Helper to escape HTML characters
function escapeHtml(text?: string) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Helper to format metadata header
function formatMetadataHeader(from: any, dateUnix?: number, chatInfo?: any, isEdited = false) {
  const date = dateUnix ? new Date(dateUnix * 1000) : new Date();
  const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Moscow' });
  const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Moscow' });

  const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(' ') || 'Аноним';
  const username = from?.username ? `@${from.username}` : 'нет никнейма';
  const userId = from?.id || '—';

  const chatTitle = chatInfo ? (chatInfo.title || [chatInfo.first_name, chatInfo.last_name].filter(Boolean).join(' ') || chatInfo.username || `Чат ${chatInfo.id}`) : null;

  return (
    `${isEdited ? '✏️' : '📋'} <b>[СЕКРЕТАРЬ • ${isEdited ? 'ИЗМЕНЕНО СООБЩЕНИЕ' : 'ПРОТОКОЛ ПЕРЕХВАТА'}]</b>\n` +
    (chatTitle ? `💬 <b>Диалог:</b> ${chatTitle}\n` : '') +
    `👤 <b>Кто написал:</b> ${fullName} (${username})\n` +
    `🆔 <b>ID автора:</b> <code>${userId}</code>\n` +
    `📅 <b>Когда:</b> ${dateStr} в ${timeStr} (МСК)`
  );
}

// Universal dispatcher for complete message forwarding to owner's DM with bot
async function dispatchBusinessMessage(telegram: any, bMsg: any, targetOwnerId: number, isEdited = false) {
  const sender = bMsg.from;
  const fromChat = bMsg.chat;
  const fromChatId = fromChat?.id;
  const messageId = bMsg.message_id;

  const header = formatMetadataHeader(sender, isEdited ? (bMsg.edit_date || bMsg.date) : bMsg.date, fromChat, isEdited);

  // 1. Text message
  if (bMsg.text) {
    const fullText = `${header}\n\n✉️ <b>Текст сообщения:</b>\n<blockquote>${escapeHtml(bMsg.text)}</blockquote>`;
    if (fullText.length <= 4000) {
      await telegram.sendMessage(targetOwnerId, fullText, { parse_mode: 'HTML' });
    } else {
      await telegram.sendMessage(targetOwnerId, header, { parse_mode: 'HTML' });
      await telegram.sendMessage(targetOwnerId, bMsg.text);
    }
    return;
  }

  // 2. Photo
  if (bMsg.photo && bMsg.photo.length > 0) {
    const highestPhoto = bMsg.photo[bMsg.photo.length - 1];
    const captionText = bMsg.caption ? `\n\n💬 <b>Подпись к фото:</b>\n<blockquote>${escapeHtml(bMsg.caption)}</blockquote>` : '';
    const fullCaption = `${header}${captionText}`;
    if (fullCaption.length <= 1024) {
      await telegram.sendPhoto(targetOwnerId, highestPhoto.file_id, {
        caption: fullCaption,
        parse_mode: 'HTML',
      });
    } else {
      await telegram.sendMessage(targetOwnerId, fullCaption, { parse_mode: 'HTML' });
      await telegram.sendPhoto(targetOwnerId, highestPhoto.file_id);
    }
    return;
  }

  // 3. Voice
  if (bMsg.voice) {
    const duration = bMsg.voice.duration || 0;
    const fullCaption = `${header}\n\n🎤 <i>Голосовое сообщение (${duration} сек.)</i>`;
    if (fullCaption.length <= 1024) {
      await telegram.sendVoice(targetOwnerId, bMsg.voice.file_id, {
        caption: fullCaption,
        parse_mode: 'HTML',
      });
    } else {
      await telegram.sendMessage(targetOwnerId, fullCaption, { parse_mode: 'HTML' });
      await telegram.sendVoice(targetOwnerId, bMsg.voice.file_id);
    }
    return;
  }

  // 4. Video note (Кружочек)
  if (bMsg.video_note) {
    await telegram.sendMessage(targetOwnerId, `${header}\n\n🎥 <i>Видеосообщение (кружочек)</i>`, { parse_mode: 'HTML' });
    await telegram.sendVideoNote(targetOwnerId, bMsg.video_note.file_id);
    return;
  }

  // 5. Document / File
  if (bMsg.document) {
    const docName = bMsg.document.file_name ? ` (<code>${escapeHtml(bMsg.document.file_name)}</code>)` : '';
    const captionText = bMsg.caption ? `\n\n💬 <b>Подпись:</b>\n<blockquote>${escapeHtml(bMsg.caption)}</blockquote>` : '';
    const fullCaption = `${header}\n📁 <b>Файл:</b>${docName}${captionText}`;
    if (fullCaption.length <= 1024) {
      await telegram.sendDocument(targetOwnerId, bMsg.document.file_id, {
        caption: fullCaption,
        parse_mode: 'HTML',
      });
    } else {
      await telegram.sendMessage(targetOwnerId, fullCaption, { parse_mode: 'HTML' });
      await telegram.sendDocument(targetOwnerId, bMsg.document.file_id);
    }
    return;
  }

  // 6. Video
  if (bMsg.video) {
    const captionText = bMsg.caption ? `\n\n💬 <b>Подпись:</b>\n<blockquote>${escapeHtml(bMsg.caption)}</blockquote>` : '';
    const fullCaption = `${header}${captionText}`;
    if (fullCaption.length <= 1024) {
      await telegram.sendVideo(targetOwnerId, bMsg.video.file_id, {
        caption: fullCaption,
        parse_mode: 'HTML',
      });
    } else {
      await telegram.sendMessage(targetOwnerId, fullCaption, { parse_mode: 'HTML' });
      await telegram.sendVideo(targetOwnerId, bMsg.video.file_id);
    }
    return;
  }

  // 7. Audio
  if (bMsg.audio) {
    const fullCaption = `${header}\n\n🎵 <b>Аудио:</b> ${escapeHtml(bMsg.audio.performer || '')} — ${escapeHtml(bMsg.audio.title || '')}`;
    if (fullCaption.length <= 1024) {
      await telegram.sendAudio(targetOwnerId, bMsg.audio.file_id, {
        caption: fullCaption,
        parse_mode: 'HTML',
      });
    } else {
      await telegram.sendMessage(targetOwnerId, fullCaption, { parse_mode: 'HTML' });
      await telegram.sendAudio(targetOwnerId, bMsg.audio.file_id);
    }
    return;
  }

  // 8. Sticker
  if (bMsg.sticker) {
    const emoji = bMsg.sticker.emoji ? ` (${bMsg.sticker.emoji})` : '';
    await telegram.sendMessage(targetOwnerId, `${header}\n\n🏷 <b>Стикер</b>${emoji}`, { parse_mode: 'HTML' });
    await telegram.sendSticker(targetOwnerId, bMsg.sticker.file_id);
    return;
  }

  // 9. Animation / GIF
  if (bMsg.animation) {
    await telegram.sendAnimation(targetOwnerId, bMsg.animation.file_id, {
      caption: header.length <= 1024 ? header : undefined,
      parse_mode: 'HTML',
    });
    return;
  }

  // 10. Location
  if (bMsg.location) {
    await telegram.sendMessage(targetOwnerId, `${header}\n\n📍 <b>Геолокация:</b>`, { parse_mode: 'HTML' });
    await telegram.sendLocation(targetOwnerId, bMsg.location.latitude, bMsg.location.longitude);
    return;
  }

  // 11. Contact
  if (bMsg.contact) {
    await telegram.sendMessage(
      targetOwnerId,
      `${header}\n\n👤 <b>Контакт:</b> ${escapeHtml(bMsg.contact.first_name)} ${escapeHtml(bMsg.contact.last_name || '')} (${escapeHtml(bMsg.contact.phone_number)})`,
      { parse_mode: 'HTML' }
    );
    await telegram.sendContact(targetOwnerId, bMsg.contact.phone_number, bMsg.contact.first_name, {
      last_name: bMsg.contact.last_name,
    });
    return;
  }

  // Fallback
  await telegram.sendMessage(targetOwnerId, header, { parse_mode: 'HTML' });
  if (fromChatId && messageId) {
    try {
      await telegram.copyMessage(targetOwnerId, fromChatId, messageId);
    } catch (copyErr: any) {
      console.warn('[FALLBACK_COPY_FAILED]', copyErr?.message || copyErr);
    }
  }
}

// 1. Handle Telegram Business Connection updates
bot.on('business_connection' as any, async (ctx: any) => {
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

    console.log(`[BUSINESS_CONNECTION] ID: ${conn?.id}, User: ${businessUserName} (${businessUserId}), Enabled: ${isEnabled}`);

    if (isEnabled && businessUserId) {
      await ctx.telegram.sendMessage(
        businessUserId,
        `💼 <b>Режим Персонального Секретаря Telegram Business АКТИВИРОВАН!</b>\n\n` +
        `✅ Бот успешно подключен к вашим личным диалогам.\n\n` +
        `🛡 <b>Как теперь работает протоколирование:</b>\n` +
        `• В чатах с вашими собеседниками бот <b>не спамит</b> и не мешает общению.\n` +
        `• Все входящие сообщения от собеседников и ваши ответы перехватываются и пересылаются <b>СЮДА (в этот диалог с ботом)</b>.\n` +
        `• К каждому сообщению прикрепляется карточка: <b>Кто написал, Когда написал, ID, Имя, Никнейм</b> и точная копия самого сообщения (текст, голос, фото, документ и др.).\n` +
        `• 0 байт данных сохраняется на сторонних серверах (Stateless).`,
        { parse_mode: 'HTML' }
      );
    }
  } catch (err: any) {
    console.error('[BUSINESS_CONN_ERROR]', err?.message || err);
  }
});

// 2. Handle business messages in external DMs (sender + user himself)
// The bot forwards the card and native copyMessage to the OWNER'S DIRECT DM with the bot
bot.on('business_message' as any, async (ctx: any) => {
  try {
    const bMsg = ctx.update.business_message;
    if (!bMsg) return;

    const businessConnectionId = bMsg.business_connection_id;
    const fromChat = bMsg.chat;
    const fromChatId = fromChat?.id;
    const messageId = bMsg.message_id;
    const sender = bMsg.from;
    const senderName = sender?.first_name || 'Собеседник';

    const targetOwnerId = connectionToOwner.get(businessConnectionId) || lastKnownOwnerId;

    console.log(`[BUSINESS_MSG_RECV] Conn: ${businessConnectionId}, FromChat: ${fromChatId}, Sender: ${senderName} (ID: ${sender?.id}) -> TargetOwner: ${targetOwnerId}`);

    if (!targetOwnerId) {
      console.warn('[TARGET_OWNER_NOT_FOUND] Владелец не определен. Напишите /start боту в ЛС.');
      return;
    }

    const startTime = Date.now();

    // Deliver protocol card + full message content/media/files to owner's DM
    await dispatchBusinessMessage(ctx.telegram, bMsg, targetOwnerId, false);

    const elapsed = Date.now() - startTime;
    console.log(`[BUSINESS_MSG_FORWARDED_TO_OWNER] Msg ID ${messageId} forwarded to owner ${targetOwnerId} (${elapsed}ms). Client chat kept clean!`);
  } catch (err: any) {
    console.error('[BUSINESS_MSG_ERROR]', err?.message || err);
  }
});

// 3. Handle edited business messages in external DMs
bot.on('edited_business_message' as any, async (ctx: any) => {
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

    console.log(`[BUSINESS_MSG_EDITED] Chat: ${fromChatId}, Msg ID: ${messageId} -> TargetOwner: ${targetOwnerId}`);

    await dispatchBusinessMessage(ctx.telegram, bMsg, targetOwnerId, true);
  } catch (err: any) {
    console.error('[EDITED_BUSINESS_MSG_ERROR]', err?.message || err);
  }
});

// 4. Filter out group chats, only allow private chats
bot.use(async (ctx, next) => {
  try {
    if ((ctx.update as any).business_connection || (ctx.update as any).business_message || (ctx.update as any).edited_business_message) {
      return await next();
    }
    if (!ctx.chat || ctx.chat.type !== 'private') {
      return;
    }
    return await next();
  } catch (err: any) {
    console.error('[MIDDLEWARE_ERROR]', err?.message || err);
  }
});

// 5. Bot direct DM commands
bot.start(async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const userName = ctx.from?.first_name || 'пользователь';

    if (userId) {
      registeredOwners.add(userId);
      lastKnownOwnerId = userId;
    }

    return await ctx.replyWithHTML(
      `💼 <b>Привет, ${userName}!</b>\n\n` +
      `Я — ваш <b>Персональный Секретарь Telegram</b>.\n\n` +
      `📌 <b>Как это работает:</b>\n` +
      `1️⃣ <b>Секретарь в чужих ЛС:</b> Подключите меня в <i>Настройки Telegram → Telegram Business → Чат-боты</i>. Все входящие и исходящие сообщения из ваших диалогов с клиентами/друзьями будут протоколироваться и пересылаться <b>СЮДА (в этот наш диалог)</b>.\n` +
      `2️⃣ <b>Прямой диалог:</b> Отправьте мне сюда любую заметку или файл — я сохраню точную копию с метаданными.\n\n` +
      `🛡 <b>В чатах с собеседниками бот ничего не пишет и не спамит!</b> Все протоколы и копии приходят только вам сюда.\n` +
      `🔒 <i>Stateless / Zero Data Retention: данные не сохраняются на сторонних серверах.</i>`
    );
  } catch (err: any) {
    console.error('[START_CMD_ERROR]', err?.message || err);
  }
});

bot.help(async (ctx) => {
  try {
    return await ctx.replyWithHTML(
      `ℹ️ <b>Справка Персонального Секретаря:</b>\n\n` +
      `💼 <b>Как подключить к чужим ЛС через Telegram Business:</b>\n` +
      `1. Откройте <b>Настройки Telegram</b> (требуется Telegram Premium / Business).\n` +
      `2. Перейдите в <b>Telegram для бизнеса → Чат-боты</b>.\n` +
      `3. Введите юзернейм этого бота и включите доступ к личным чатам.\n` +
      `4. Все сообщения из ваших личных диалогов будут мгновенно протоколироваться и дублироваться <b>в этот чат с ботом</b>.\n\n` +
      `⚙️ Команды: /start, /help, /status`
    );
  } catch (err: any) {
    console.error('[HELP_CMD_ERROR]', err?.message || err);
  }
});

bot.command('status', async (ctx) => {
  try {
    return await ctx.replyWithHTML(
      `⚡ <b>Статус:</b> Секретарь активен (Онлайн)\n` +
      `🛡 <b>Режим:</b> Private DM + Telegram Business Forwarder\n` +
      `📥 <b>Куда приходят логи:</b> В этот личный чат с ботом\n` +
      `🧠 <b>Хранилище (State):</b> 0 KB (Stateless / Zero Data Retention)\n` +
      `⏱ <b>Uptime:</b> ${process.uptime().toFixed(1)} сек.\n` +
      `📦 <b>Node.js:</b> ${process.version}`
    );
  } catch (err: any) {
    console.error('[STATUS_CMD_ERROR]', err?.message || err);
  }
});

// 6. Direct messages sent into bot DM
bot.on('message', async (ctx) => {
  const message = ctx.message;
  if (!message) return;

  if ('text' in message && message.text?.startsWith('/')) {
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

  try {
    await dispatchBusinessMessage(ctx.telegram, message, chatId, false);
    const elapsed = Date.now() - startTime;
    console.log(`[DM_COPIED] Message ID ${messageId} mirrored with content in ${elapsed}ms. State purged.`);
  } catch (err: any) {
    console.error(`[DM_COPY_ERROR] Failed to mirror message ID ${messageId}:`, err?.message || err);
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Webhook endpoint
  app.post('/api/bot', async (req, res) => {
    try {
      if (req.body && typeof req.body === 'object') {
        await bot.handleUpdate(req.body);
      }
    } catch (err) {
      console.error('[EXPRESS_WEBHOOK_ERROR]', err);
    } finally {
      if (!res.headersSent) {
        res.status(200).end();
      }
    }
  });

  // Health check
  app.get('/api/bot', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Personal Secretary Telegram Bot (Business Forwarder to Bot DM)',
      stateless: true,
      business_support: true,
      ready: true,
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER_RUNNING] Personal Secretary Server started on port ${PORT}`);
  });
}

startServer();
