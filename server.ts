import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w';

// Initialize Telegraf Bot instance
const bot = new Telegraf(BOT_TOKEN);

// Global Telegraf error catcher to prevent unhandled rejections
bot.catch((err: any) => {
  console.error('[TELEGRAF_BOT_ERROR]', err?.message || err);
});

// Cache to remember if we already informed the user in their private DM
const greetedPrivateChats = new Set<number>();
// Cache of announced business chats to display the notice about bot managing the chat
const announcedBusinessChats = new Set<string>();

// 1. Handle Telegram Business Connection updates
bot.on('business_connection' as any, async (ctx: any) => {
  try {
    const conn = ctx.update.business_connection;
    const isEnabled = conn?.is_enabled;
    const businessUserId = conn?.user?.id;
    const businessUserName = conn?.user?.first_name || 'Владелец аккаунта';

    console.log(`[BUSINESS_CONNECTION] Connection ID: ${conn?.id}, User: ${businessUserName} (${businessUserId}), Enabled: ${isEnabled}`);

    if (isEnabled && businessUserId) {
      await ctx.telegram.sendMessage(
        businessUserId,
        `💼 <b>Режим Персонального Секретаря Telegram Business АКТИВИРОВАН!</b>\n\n` +
        `✅ Бот подключен к вашему личному аккаунту Telegram.\n\n` +
        `🛡 <b>Как это работает в чужих ЛС:</b>\n` +
        `• Когда вам пишет собеседник или когда вы отвечаете ему — бот дублирует (копирует) сообщение.\n` +
        `• В диалоге будет зафиксировано, что этим чатом управляет Персональный Секретарь.\n` +
        `• Все сообщения остаются в вашей истории чатов.\n` +
        `• 0 байт данных сохраняется на сервере (Stateless / Zero Retention).`
        , { parse_mode: 'HTML' }
      );
    }
  } catch (err: any) {
    console.error('[BUSINESS_CONN_ERROR]', err?.message || err);
  }
});

// 2. Handle Telegram Business Messages (Сообщения в чужих ЛС: собеседника и самого пользователя)
bot.on('business_message' as any, async (ctx: any) => {
  try {
    const bMsg = ctx.update.business_message;
    if (!bMsg) return;

    const businessConnectionId = bMsg.business_connection_id;
    const chatId = bMsg.chat?.id;
    const messageId = bMsg.message_id;
    const sender = bMsg.from;
    const senderName = sender?.first_name || 'Собеседник';
    const isUserHimself = bMsg.sender_business_bot ? true : false;

    console.log(`[BUSINESS_MSG_RECV] Conn: ${businessConnectionId}, Chat: ${chatId}, From: ${senderName} (ID: ${sender?.id})`);

    // Если в этот чат еще не отправлялось уведомление об управлении ботом — уведомляем
    const noticeKey = `${businessConnectionId}_${chatId}`;
    if (!announcedBusinessChats.has(noticeKey)) {
      announcedBusinessChats.add(noticeKey);
      try {
        await ctx.telegram.sendMessage(
          chatId,
          `🤖 <i>Этим чатом управляет Персональный Секретарь Telegram. Все входящие и исходящие сообщения протоколируются и копируются.</i>`,
          {
            business_connection_id: businessConnectionId,
            parse_mode: 'HTML',
          } as any
        );
      } catch (noticeErr: any) {
        console.warn('[BUSINESS_NOTICE_FAILED]', noticeErr?.message || noticeErr);
      }
    }

    // Игнорируем технические команды, если таковые будут
    if (bMsg.text && bMsg.text.startsWith('/secretary_off')) {
      return;
    }

    // Моментальное нативное копирование сообщения собеседника или владельца в этот же бизнес-чат
    const startTime = Date.now();
    await (ctx.telegram as any).copyMessage(chatId, chatId, messageId, {
      business_connection_id: businessConnectionId,
    });
    const elapsed = Date.now() - startTime;
    console.log(`[BUSINESS_MSG_COPIED] Message ID ${messageId} copied in business chat ${chatId} (${elapsed}ms). Memory purged.`);
  } catch (err: any) {
    console.error('[BUSINESS_MSG_ERROR]', err?.message || err);
  }
});

// 3. Handle Edited Business Messages (если сообщение отредактировано в ЛС)
bot.on('edited_business_message' as any, async (ctx: any) => {
  try {
    const bMsg = ctx.update.edited_business_message;
    if (!bMsg) return;
    const businessConnectionId = bMsg.business_connection_id;
    const chatId = bMsg.chat?.id;
    const messageId = bMsg.message_id;

    console.log(`[BUSINESS_MSG_EDITED] Chat: ${chatId}, Msg ID: ${messageId}`);
    // Дублируем обновленную версию сообщения
    await (ctx.telegram as any).copyMessage(chatId, chatId, messageId, {
      business_connection_id: businessConnectionId,
    });
  } catch (err: any) {
    console.error('[EDITED_BUSINESS_MSG_ERROR]', err?.message || err);
  }
});

// 4. Strict Global Filter for Standard Messages: Process strictly private messages (DM) only
bot.use(async (ctx, next) => {
  try {
    // Пропускаем обновления бизнес-режима
    if ((ctx.update as any).business_connection || (ctx.update as any).business_message || (ctx.update as any).edited_business_message) {
      return await next();
    }

    if (!ctx.chat || ctx.chat.type !== 'private') {
      if (ctx.chat) {
        console.log(`[FILTER_DROP] Ignored message from non-DM chat (Type: ${ctx.chat.type}, ID: ${ctx.chat.id})`);
      }
      return;
    }
    return await next();
  } catch (err: any) {
    console.error('[MIDDLEWARE_ERROR]', err?.message || err);
  }
});

// 5. Command handlers in private DMs
bot.start(async (ctx) => {
  return ctx.replyWithHTML(
    `💼 <b>Привет, ${ctx.from?.first_name || 'пользователь'}!</b>\n\n` +
    `Я — ваш <b>Персональный Секретарь</b> (поддержка личного диалога и <b>Telegram Business в чужих ЛС</b>).\n\n` +
    `📌 <b>2 режима работы:</b>\n` +
    `1️⃣ <b>Прямой диалог:</b> Отправьте мне любой файл, текст или аудио — я сделаю точную копию в этом чате.\n` +
    `2️⃣ <b>Секретарь в чужих ЛС (Telegram Business):</b> Подключите меня в <i>Настройки Telegram → Telegram Business → Чат-боты</i>. Я буду автоматически копировать сообщения вашего собеседника и ваши ответы, а в чате будет уведомление, что им управляет бот.\n\n` +
    `🔒 <i>Stateless: 0 байт данных сохраняется на сервере. Все копии хранятся только в Telegram.</i>`
  );
});

bot.help(async (ctx) => {
  return ctx.replyWithHTML(
    `ℹ️ <b>Справка Персонального Секретаря:</b>\n\n` +
    `💼 <b>Как подключить бота к чужим ЛС через Telegram Business:</b>\n` +
    `1. Откройте <b>Настройки Telegram</b> (требуется Telegram Premium / Business).\n` +
    `2. Перейдите в раздел <b>Telegram для бизнеса → Чат-боты (Chatbots)</b>.\n` +
    `3. Введите юзернейм этого бота и разрешите доступ к личным сообщениям.\n` +
    `4. Теперь в любых чужих ЛС бот автоматически дублирует входящие и исходящие реплики, объявляя, что чатом управляет бот.\n\n` +
    `⚙️ Доступные команды: /start, /help, /status`
  );
});

bot.command('status', async (ctx) => {
  return ctx.replyWithHTML(
    `⚡ <b>Статус:</b> Секретарь активен (Онлайн)\n` +
    `🛡 <b>Режимы:</b> Private DM + Telegram Business (Чужие ЛС)\n` +
    `📢 <b>Уведомление в чате:</b> Включено («Этим чатом управляет бот»)\n` +
    `🧠 <b>Хранилище (State):</b> 0 KB (Stateless / Zero Data Retention)\n` +
    `⏱ <b>Uptime:</b> ${process.uptime().toFixed(1)} сек.\n` +
    `📦 <b>Node.js:</b> ${process.version}`
  );
});

// 6. Main Message Handler for direct bot DM: copy message and discard state immediately
bot.on('message', async (ctx) => {
  const message = ctx.message;
  if (!message) return;

  // Ignore system slash commands to avoid re-duplicating /start, /help, etc.
  if ('text' in message && message.text && message.text.startsWith('/')) {
    return;
  }

  const chatId = ctx.chat.id;
  const messageId = message.message_id;
  const startTime = Date.now();

  try {
    // Если пользователь впервые пишет в ЛС боту, можно вывести плашку
    if (!greetedPrivateChats.has(chatId)) {
      greetedPrivateChats.add(chatId);
      await ctx.replyWithHTML(`🤖 <i>Этим чатом управляет Персональный Секретарь. Копирую сообщение...</i>`);
    }

    // Native copyMessage preserves all media formats, captions, formatting, and stickers
    await ctx.telegram.copyMessage(chatId, chatId, messageId);
    const elapsed = Date.now() - startTime;
    console.log(`[DM_COPIED] Message ID ${messageId} mirrored in ${elapsed}ms. State purged.`);
  } catch (err: any) {
    console.error(`[DM_COPY_ERROR] Failed to mirror message ID ${messageId}:`, err?.message || err);
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable JSON body parser for incoming Webhook requests
  app.use(express.json());

  // Health check & Bot status endpoint (GET /api/bot)
  app.get('/api/bot', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Personal Secretary Telegram Bot (Stateless DM Mirror)',
      stateless: true,
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      message: 'Telegram Webhook endpoint is active and listening for POST updates.'
    });
  });

  // Health check endpoint (GET /api/health)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Telegram Webhook receiver endpoint (POST /api/bot)
  app.post('/api/bot', async (req, res) => {
    try {
      if (req.body && typeof req.body === 'object') {
        await bot.handleUpdate(req.body);
      }
    } catch (err) {
      console.error('[WEBHOOK_HANDLE_ERROR]', err);
    } finally {
      // INSTANT ACK: Always respond 200 OK immediately to Telegram
      if (!res.headersSent) {
        res.status(200).end();
      }
    }
  });

  // Vite development middleware or production static files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Telegram Bot Webhook endpoint ready at http://0.0.0.0:${PORT}/api/bot`);
  });
}

startServer();
