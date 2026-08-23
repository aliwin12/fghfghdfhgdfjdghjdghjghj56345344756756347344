import { CodeFile } from '../types';

export const BOT_TOKEN = '8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w';
export const DEFAULT_APP_DOMAIN = 'universal-logger-bot.app';

export const BOT_FILES: CodeFile[] = [
  {
    name: 'api/bot.js',
    path: 'api/bot.js',
    language: 'javascript',
    description: 'Главная Serverless-функция. Обрабатывает Webhook, определяет админов групп "на лету" и рассылает логи.',
    content: `// api/bot.js
// Универсальный Serverless Telegram-бот для платформы Vercel
// Работает без внешней базы данных (Stateless) на библиотеке Telegraf

const { Telegraf } = require('telegraf');

// 1. Инициализация вне хендлера (Global Scope) для устранения оверхеда при повторных вызовах (Warm Invocations)
const BOT_TOKEN = process.env.BOT_TOKEN || '${BOT_TOKEN}';

if (!BOT_TOKEN) {
  console.error('[CRITICAL] BOT_TOKEN не задан в переменных окружения!');
}

const bot = new Telegraf(BOT_TOKEN);

// Кэш администраторов в оперативной памяти лямбды (снижает нагрузку на Telegram API внутри одной «прогретой» инстанции)
const adminCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут

/**
 * Получение списка ID администраторов-людей для конкретного чата
 */
async function getHumanAdmins(chatId) {
  const cached = adminCache.get(chatId);
  const now = Date.now();

  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.adminIds;
  }

  try {
    const admins = await bot.telegram.getChatAdministrators(chatId);
    // Фильтруем только реальных пользователей (исключаем ботов)
    const humanAdminIds = admins
      .filter((admin) => !admin.user.is_bot)
      .map((admin) => admin.user.id);

    adminCache.set(chatId, {
      adminIds: humanAdminIds,
      timestamp: now,
    });

    return humanAdminIds;
  } catch (error) {
    console.error(\`[ADMIN_RESOLVER_ERROR] Чат \${chatId}: \${error.message}\`);
    return [];
  }
}

/**
 * Форматирование читаемого лога события группы
 */
function formatGroupLog(ctx) {
  const chat = ctx.chat;
  const from = ctx.from || {};
  const msg = ctx.message || ctx.channelPost || ctx.editedMessage || {};

  const chatTitle = chat.title || 'Безымянная группа';
  const chatUsername = chat.username ? \`@\${chat.username}\` : \`ID: \${chat.id}\`;
  const senderName = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Аноним';
  const senderUsername = from.username ? \`@\${from.username}\` : \`ID: \${from.id || 'N/A'}\`;

  let eventType = '💬 Сообщение';
  let content = msg.text || '';

  if (msg.photo) {
    eventType = '📸 Фотография';
    content = msg.caption ? \`[Подпись]: \${msg.caption}\` : '[Без подписи]';
  } else if (msg.document) {
    eventType = '📁 Документ/Файл';
    content = \`\${msg.document.file_name || 'файл'} (\${(msg.document.file_size / 1024).toFixed(1)} KB)\`;
  } else if (msg.voice) {
    eventType = '🎤 Голосовое сообщение';
    content = \`Длительность: \${msg.voice.duration} сек.\`;
  } else if (msg.video) {
    eventType = '🎥 Видеозапись';
    content = msg.caption || '[Видео]';
  } else if (msg.sticker) {
    eventType = '🎭 Стикер';
    content = \`Эмодзи: \${msg.sticker.emoji || '—'}\`;
  } else if (msg.new_chat_members) {
    eventType = '👋 Новый участник';
    content = msg.new_chat_members.map(m => m.first_name).join(', ');
  } else if (msg.left_chat_member) {
    eventType = '🚪 Вышел из группы';
    content = msg.left_chat_member.first_name;
  }

  const timeStr = new Date().toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow' });

  return (
    \`🔔 <b>[ЛОГ ГРУППЫ]</b> <i>(\${timeStr} МСК)</i>\\n\\n\` +
    \`👥 <b>Группа:</b> \${chatTitle} (\${chatUsername})\\n\` +
    \`👤 <b>Отправитель:</b> \${senderName} (\${senderUsername})\\n\` +
    \`📌 <b>Тип:</b> \${eventType}\\n\` +
    \`📝 <b>Содержимое:</b>\\n<code>\${content.slice(0, 1500)}</code>\`
  );
}

// 2. Обработка команд в личных сообщениях
bot.start(async (ctx) => {
  if (ctx.chat.type === 'private') {
    return ctx.replyWithHTML(
      \`👋 <b>Привет, \${ctx.from.first_name || 'пользователь'}!</b>\\n\\n\` +
      \`Я — <b>Универсальный бот-логгер</b>, работающий на бессерверной архитектуре Vercel Serverless.\\n\\n\` +
      \`🔹 <b>Как мной пользоваться:</b>\\n\` +
      \`1. Добавь меня в свою группу или супергруппу.\\n\` +
      \`2. Назначь меня <b>Администратором</b> (достаточно прав на чтение сообщений).\\n\` +
      \`3. Как только в группе кто-то напишет, я <b>автоматически определю тебя как администратора</b> и пришлю лог сюда в ЛС!\\n\\n\` +
      \`⚡ <i>Работаю мгновенно, без задержек и без базы данных!</i>\`
    );
  }
});

bot.command('status', (ctx) => {
  ctx.replyWithHTML(
    \`🚀 <b>Статус:</b> Бот онлайн на Vercel Serverless!\\n\` +
    \`⏱ <b>Uptime:</b> \${process.uptime().toFixed(1)} сек.\\n\` +
    \`📦 <b>Node.js:</b> \${process.version}\`
  );
});

// 3. Главный перехватчик сообщений из групп и каналов
bot.on(['message', 'edited_message', 'channel_post'], async (ctx) => {
  const chat = ctx.chat;

  // Игнорируем обычные ЛС (чтобы не зацикливать логи)
  if (chat.type === 'private') {
    return;
  }

  console.log(\`[GROUP_EVENT] Получено событие из группы "\${chat.title}" (ID: \${chat.id})\`);

  try {
    // Получаем всех админов группы через Telegram API "на лету"
    const adminIds = await getHumanAdmins(chat.id);

    if (!adminIds || adminIds.length === 0) {
      console.warn(\`[NO_ADMINS] Не удалось найти администраторов для чата \${chat.id}\`);
      return;
    }

    const logMessage = formatGroupLog(ctx);

    // Параллельная рассылка лога всем администраторам чата
    const sendPromises = adminIds.map(async (adminId) => {
      try {
        await bot.telegram.sendMessage(adminId, logMessage, { parse_mode: 'HTML' });
        console.log(\`[LOG_SENT] Лог успешно отправлен админу ID: \${adminId}\`);
      } catch (sendErr) {
        // Ошибка 403 возникает, если админ не запустил бота в ЛС (/start)
        if (sendErr.response && sendErr.response.error_code === 403) {
          console.warn(\`[FORBIDDEN] Админ \${adminId} не запустил бота в ЛС (/start)\`);
        } else {
          console.error(\`[SEND_ERROR] Сбой отправки админу \${adminId}: \${sendErr.message}\`);
        }
      }
    });

    await Promise.allSettled(sendPromises);
  } catch (err) {
    console.error(\`[PROCESS_ERROR] Ошибка обработки сообщения: \${err.message}\`);
  }
});

// 4. Экспорт Vercel Serverless Function Handler
module.exports = async (req, res) => {
  // Проверка метода (Telegram Webhook всегда отправляет POST)
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Webhook Bot is Running on Vercel!');
  }

  try {
    // Передаем тело вебхука в Telegraf для обработки
    if (req.body && typeof req.body === 'object') {
      await bot.handleUpdate(req.body);
    }
  } catch (err) {
    console.error('[WEBHOOK_HANDLE_ERROR]', err);
  } finally {
    // КРИТИЧЕСКИ ВАЖНО: Всегда возвращаем HTTP 200 OK Telegram серверу
    // Это предотвращает повторные отправки (Retry Storm) и сразу завершает функцию в Vercel
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
    description: 'Зависимости проекта. Содержит библиотеку Telegraf для бессерверного режима.',
    content: `{
  "name": "universal-telegram-logger-bot",
  "version": "1.0.0",
  "description": "Multi-user Serverless Telegram Logger Bot for Vercel",
  "main": "api/bot.js",
  "scripts": {
    "start": "node api/bot.js",
    "dev": "vercel dev"
  },
  "keywords": [
    "telegram",
    "bot",
    "telegraf",
    "vercel",
    "serverless",
    "multi-user",
    "logger"
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

# Локальные переменные окружения (НЕ КОММИТИТЬ В ПУБЛИЧНЫЕ РЕПО!)
.env
.env.local
.env.*.local

# Системные папки Vercel
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
    description: 'Документация и инструкция по запуску бота.',
    content: `# 🤖 Universal Multi-User Telegram Logger Bot on Vercel

Универсальный многопользовательский бот-логгер сообщений для Telegram-групп, развернутый на **Vercel Serverless Functions**.

## 🚀 Быстрый старт:

1. **GitHub:** Склонируйте или создайте репозиторий со структурой:
   - \`api/bot.js\`
   - \`vercel.json\`
   - \`package.json\`
2. **Vercel:** Импортируйте репозиторий в [Vercel Dashboard](https://vercel.com/new).
3. **Env Variables:** Добавьте \`BOT_TOKEN\` = \`8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w\`.
4. **Webhook:** Откройте в браузере:
   \`https://api.telegram.org/bot8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w/setWebhook?url=https://YOUR_DOMAIN.vercel.app/api/bot\`
5. **BotFather:** Отключите Group Privacy в @BotFather: \`/setprivacy\` -> \`Disable\`.
`,
  },
];
