import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w';

// Initialize Telegraf Bot instance
const bot = new Telegraf(BOT_TOKEN);

// 1. Strict Global Filter: Process strictly private messages (DM) only
bot.use(async (ctx, next) => {
  if (!ctx.chat || ctx.chat.type !== 'private') {
    if (ctx.chat) {
      console.log(`[FILTER_DROP] Ignored message from non-DM chat (Type: ${ctx.chat.type}, ID: ${ctx.chat.id})`);
    }
    return;
  }
  return next();
});

// 2. Command handlers in private DMs
bot.start(async (ctx) => {
  return ctx.replyWithHTML(
    `💼 <b>Привет, ${ctx.from?.first_name || 'пользователь'}!</b>\n\n` +
    `Я — ваш <b>Персональный Секретарь</b> для личных сообщений.\n\n` +
    `📌 <b>Принцип работы:</b>\n` +
    `• Отправьте мне любой текст, фото, документ, голосовое сообщение или медиафайл.\n` +
    `• Я <b>моментально создам точную копию</b> сообщения в этом диалоге.\n` +
    `• Копия навсегда останется в вашей истории чата Telegram.\n` +
    `• Сам сервер <b>моментально освобождает память</b> (Stateless / 0 байт данных в БД).\n\n` +
    `🔒 <i>100% Конфиденциальность: данные не сохраняются.</i>`
  );
});

bot.help(async (ctx) => {
  return ctx.replyWithHTML(
    `ℹ️ <b>Справка Персонального Секретаря:</b>\n\n` +
    `1. Отправьте любое входящее сообщение: текст, фото, видео, кружок, аудио, файл или стикер.\n` +
    `2. Бот выполнит нативное дублирование (<code>copyMessage</code>).\n` +
    `3. Созданная копия останется в диалоге Telegram навсегда.\n` +
    `4. Сервер не сохраняет базу данных и сразу освобождает память.\n\n` +
    `⚙️ Доступные команды: /start, /help, /status`
  );
});

bot.command('status', async (ctx) => {
  return ctx.replyWithHTML(
    `⚡ <b>Статус:</b> Секретарь активен (Онлайн)\n` +
    `🛡 <b>Режим фильтрации:</b> Строго Private DM (Личные сообщения)\n` +
    `🧠 <b>Хранилище (State):</b> 0 KB (Stateless / Zero Data Retention)\n` +
    `⏱ <b>Uptime:</b> ${process.uptime().toFixed(1)} сек.\n` +
    `📦 <b>Node.js:</b> ${process.version}`
  );
});

// 3. Main Message Handler: copy message and discard state immediately
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
      res.status(200).end();
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
