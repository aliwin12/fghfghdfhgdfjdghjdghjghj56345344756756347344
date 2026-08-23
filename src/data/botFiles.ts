import { CodeFile } from '../types';

export const BOT_TOKEN = '8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w';
export const DEFAULT_APP_DOMAIN = 'secretary-bot.app';

export const BOT_FILES: CodeFile[] = [
  {
    name: 'api/bot.js',
    path: 'api/bot.js',
    language: 'javascript',
    description: 'Главная Serverless-функция персонального секретаря. Работает только в личных сообщениях, моментально копирует любые входящие сообщения и сразу завершает выполнение без сохранения данных.',
    content: `// api/bot.js
// Персональный секретарь для личных сообщений (Stateless Message Mirror)
// Работает на библиотеке Telegraf без сохранения истории (Zero Data Retention)

const { Telegraf } = require('telegraf');

// 1. Инициализация экземпляра бота вне хендлера (Global Scope) для минимизации задержек
const BOT_TOKEN = process.env.BOT_TOKEN || '${BOT_TOKEN}';

if (!BOT_TOKEN) {
  console.error('[CRITICAL] BOT_TOKEN не задан в переменных окружения!');
}

const bot = new Telegraf(BOT_TOKEN);

// 2. Команды управления персональным секретарём в личных сообщениях
bot.start(async (ctx) => {
  // Работаем строго только в личных сообщениях
  if (ctx.chat.type !== 'private') {
    return;
  }

  return ctx.replyWithHTML(
    \`💼 <b>Привет, \${ctx.from.first_name || 'пользователь'}!</b>\\n\\n\` +
    \`Я — ваш <b>Персональный Секретарь</b> для личных сообщений.\\n\\n\` +
    \`📌 <b>Как я работаю:</b>\\n\` +
    \`• Отправьте мне любой текст, заметку, фото, документ, голосовое сообщение или медиафайл.\\n\` +
    \`• Я <b>моментально создам точную копию</b> вашего сообщения в этом чате.\\n\` +
    \`• Копия останется в вашей ленте чата, а сам я <b>моментально забуду</b> о ней (Stateless / 0% сохранения данных на сервере).\\n\\n\` +
    \`🔒 <i>Полная конфиденциальность: сообщения не логируются и не сохраняются в базе данных.</i>\`
  );
});

bot.help(async (ctx) => {
  if (ctx.chat.type !== 'private') return;

  return ctx.replyWithHTML(
    \`ℹ️ <b>Справка Персонального Секретаря:</b>\\n\\n\` +
    \`1. Отправьте любое входящее сообщение: текст, фото, видео, кружочек, аудио, файл или стикер.\\n\` +
    \`2. Бот выполнит нативное дублирование (<code>copyMessage</code>).\\n\` +
    \`3. Созданная копия останется в диалоге Telegram навсегда.\\n\` +
    \`4. Сам бот не хранит базы данных и сразу освобождает память.\\n\\n\` +
    \`⚙️ Команды: /start, /help, /status\`
  );
});

bot.command('status', async (ctx) => {
  if (ctx.chat.type !== 'private') return;

  return ctx.replyWithHTML(
    \`⚡ <b>Статус Секретаря:</b> Активен (Онлайн)\\n\` +
    \`🛡 <b>Режим:</b> Личные сообщения (Private DM Only)\\n\` +
    \`🧠 <b>Память (State):</b> 0 KB (Stateless / Zero-Retention)\\n\` +
    \`⏱ <b>Uptime экземпляра:</b> \${process.uptime().toFixed(1)} сек.\\n\` +
    \`📦 <b>Среда:</b> Node.js \${process.version}\`
  );
});

// 3. Главный обработчик личных сообщений: Моментальное копирование без сохранения
bot.on('message', async (ctx) => {
  const chat = ctx.chat;
  const message = ctx.message;

  // Игнорируем групповые чаты и каналы — бот работает ТОЛЬКО как секретарь в личных сообщениях
  if (chat.type !== 'private') {
    console.log(\`[IGNORED_GROUP] Сообщение из группы ID \${chat.id} проигнорировано (Секретарь работает только в ЛС)\`);
    return;
  }

  // Игнорируем системные команды, чтобы не дублировать /start или /status повторно
  if (message.text && message.text.startsWith('/')) {
    return;
  }

  const userId = ctx.from.id;
  const messageId = message.message_id;
  const startTime = Date.now();

  console.log(\`[SECRETARY_RECV] Получено личное сообщение msg_id: \${messageId} от пользователя \${userId}\`);

  try {
    // Выполняем точное нативное копирование сообщения в тот же чат
    // Метод copyMessage сохраняет все типы медиа, форматирование текста, подписи и стикеры
    await ctx.telegram.copyMessage(chat.id, chat.id, messageId);

    const elapsed = Date.now() - startTime;
    console.log(\`[SECRETARY_COPIED] Сообщение \${messageId} продублировано в чат за \${elapsed}ms. Память очищена (Stateless).\`);
  } catch (err) {
    console.error(\`[SECRETARY_ERROR] Не удалось скопировать сообщение \${messageId}: \${err.message}\`);
  }
  // Переменные message и контекст уничтожаются при завершении функции — бот моментально забывает сообщение
});

// 4. Экспорт бессерверного обработчика Webhook (Serverless Handler)
module.exports = async (req, res) => {
  // Telegram Webhook отправляет обновления строго методом POST
  if (req.method !== 'POST') {
    return res.status(200).send('Personal Secretary Telegram Bot is Running (Stateless)!');
  }

  try {
    if (req.body && typeof req.body === 'object') {
      await bot.handleUpdate(req.body);
    }
  } catch (err) {
    console.error('[WEBHOOK_HANDLE_ERROR]', err);
  } finally {
    // Всегда возвращаем HTTP 200 OK Telegram серверу для подтверждения
    res.status(200).end();
  }
};
`,
  },
  {
    name: 'vercel.json',
    path: 'vercel.json',
    language: 'json',
    description: 'Конфигурация инфраструктуры: маршрутизация Webhook-запросов, лимиты памяти, таймауты и заголовки.',
    content: `{
  "version": 2,
  "functions": {
    "api/bot.js": {
      "memory": 1024,
      "maxDuration": 15
    }
  },
  "routes": [
    {
      "src": "^/api/bot$",
      "dest": "/api/bot.js"
    },
    {
      "src": "^/webhook$",
      "dest": "/api/bot.js"
    },
    {
      "src": "^/(.*)",
      "dest": "/api/bot.js"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
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
