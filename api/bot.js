// api/bot.js
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

// Режимы фильтрации: 'all' (все сообщения), 'my_only' (только исходящие владельца), 'clients_only' (только входящие от клиентов)
const ownerFilterMode = new Map();

// Список доверенных получателей (делегатов) владельца: Map<ownerId, Set<delegateId>>
const ownerDelegates = new Map();

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
    console.log(`[FILTER_SKIP] Message from ${sender?.id} ignored (mode: my_only, owner: ${targetOwnerId})`);
    return;
  }

  if (currentFilter === 'clients_only' && isSentByOwner) {
    console.log(`[FILTER_SKIP] Outgoing message from owner ${targetOwnerId} ignored (mode: clients_only)`);
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
      const delegatePrefix = isDelegate ? `<i>[ПЕРЕСЛАНО ИЗ БИЗНЕС-АККАУНТА @${sender?.username || targetOwnerId}]</i>\n\n` : '';

      // 1. ТЕКСТОВОЕ СООБЩЕНИЕ
      if (bMsg.text) {
        const fullText = `${delegatePrefix}${header}\n\n✉️ <b>Текст сообщения:</b>\n<blockquote>${escapeHtml(bMsg.text)}</blockquote>`;
        if (fullText.length <= 4000) {
          await telegram.sendMessage(recipientId, fullText, {
            parse_mode: 'HTML',
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        } else {
          await telegram.sendMessage(recipientId, `${delegatePrefix}${header}`, { parse_mode: 'HTML' });
          await telegram.sendMessage(recipientId, bMsg.text, {
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        }
        continue;
      }

      // 2. ФОТОГРАФИЯ
      if (bMsg.photo && bMsg.photo.length > 0) {
        const highestPhoto = bMsg.photo[bMsg.photo.length - 1];
        const captionText = bMsg.caption ? `\n\n💬 <b>Подпись к фото:</b>\n<blockquote>${escapeHtml(bMsg.caption)}</blockquote>` : '';
        const fullCaption = `${delegatePrefix}${header}${captionText}`;
        
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
        const fullCaption = `${delegatePrefix}${header}\n\n🎤 <i>Голосовое сообщение (${duration} сек.)</i>`;
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
        await telegram.sendMessage(recipientId, `${delegatePrefix}${header}\n\n🎥 <i>Видеосообщение (кружочек)</i>`, { parse_mode: 'HTML' });
        await telegram.sendVideoNote(recipientId, bMsg.video_note.file_id, {
          reply_markup: isDelegate ? undefined : shareKeyboard,
        });
        continue;
      }

      // 5. ДОКУМЕНТ / ФАЙЛ
      if (bMsg.document) {
        const docName = bMsg.document.file_name ? ` (<code>${escapeHtml(bMsg.document.file_name)}</code>)` : '';
        const captionText = bMsg.caption ? `\n\n💬 <b>Подпись:</b>\n<blockquote>${escapeHtml(bMsg.caption)}</blockquote>` : '';
        const fullCaption = `${delegatePrefix}${header}\n📁 <b>Файл:</b>${docName}${captionText}`;
        
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
        const captionText = bMsg.caption ? `\n\n💬 <b>Подпись:</b>\n<blockquote>${escapeHtml(bMsg.caption)}</blockquote>` : '';
        const fullCaption = `${delegatePrefix}${header}${captionText}`;
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

      // 7. АУДИОЗАПИСЬ
      if (bMsg.audio) {
        const fullCaption = `${delegatePrefix}${header}\n\n🎵 <b>Аудио:</b> ${escapeHtml(bMsg.audio.performer || '')} — ${escapeHtml(bMsg.audio.title || '')}`;
        if (fullCaption.length <= 1024) {
          await telegram.sendAudio(recipientId, bMsg.audio.file_id, {
            caption: fullCaption,
            parse_mode: 'HTML',
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        } else {
          await telegram.sendMessage(recipientId, fullCaption, { parse_mode: 'HTML' });
          await telegram.sendAudio(recipientId, bMsg.audio.file_id, {
            reply_markup: isDelegate ? undefined : shareKeyboard,
          });
        }
        continue;
      }

      // 8. СТИКЕР
      if (bMsg.sticker) {
        const emoji = bMsg.sticker.emoji ? ` (${bMsg.sticker.emoji})` : '';
        await telegram.sendMessage(recipientId, `${delegatePrefix}${header}\n\n🏷 <b>Стикер</b>${emoji}`, { parse_mode: 'HTML' });
        await telegram.sendSticker(recipientId, bMsg.sticker.file_id, {
          reply_markup: isDelegate ? undefined : shareKeyboard,
        });
        continue;
      }

      // 9. АНИМАЦИЯ / GIF
      if (bMsg.animation) {
        await telegram.sendAnimation(recipientId, bMsg.animation.file_id, {
          caption: header.length <= 1024 ? `${delegatePrefix}${header}` : undefined,
          parse_mode: 'HTML',
          reply_markup: isDelegate ? undefined : shareKeyboard,
        });
        continue;
      }

      // 10. ЛОКАЦИЯ
      if (bMsg.location) {
        await telegram.sendMessage(recipientId, `${delegatePrefix}${header}\n\n📍 <b>Геолокация:</b>`, { parse_mode: 'HTML' });
        await telegram.sendLocation(recipientId, bMsg.location.latitude, bMsg.location.longitude, {
          reply_markup: isDelegate ? undefined : shareKeyboard,
        });
        continue;
      }

      // 11. КОНТАКТ
      if (bMsg.contact) {
        await telegram.sendMessage(
          recipientId,
          `${delegatePrefix}${header}\n\n👤 <b>Контакт:</b> ${escapeHtml(bMsg.contact.first_name)} ${escapeHtml(bMsg.contact.last_name || '')} (${escapeHtml(bMsg.contact.phone_number)})`,
          { parse_mode: 'HTML' }
        );
        await telegram.sendContact(recipientId, bMsg.contact.phone_number, bMsg.contact.first_name, {
          last_name: bMsg.contact.last_name,
          reply_markup: isDelegate ? undefined : shareKeyboard,
        });
        continue;
      }

      // Резервный вариант
      await telegram.sendMessage(recipientId, `${delegatePrefix}${header}`, {
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
      console.error(`[DISPATCH_ERROR_RECIPIENT_${recipientId}]`, sendErr?.message || sendErr);
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

    console.log(`[BUSINESS_MSG_RECV] Conn: ${businessConnectionId}, FromChat: ${fromChatId}, Sender: ${senderName} (ID: ${sender?.id}) -> TargetOwner: ${targetOwnerId}`);

    if (!targetOwnerId) {
      console.warn('[TARGET_OWNER_NOT_FOUND] Владелец не определен. Напишите /start боту в ЛС.');
      return;
    }

    const startTime = Date.now();

    // Отправляем протокол вместе с полным текстом / медиа / файлами в ЛС владельца
    await dispatchBusinessMessage(ctx.telegram, bMsg, targetOwnerId, false);

    const elapsed = Date.now() - startTime;
    console.log(`[BUSINESS_MSG_FORWARDED_TO_OWNER] Msg ID ${messageId} fully delivered to owner ${targetOwnerId} (${elapsed}ms). Chat with client kept clean!`);
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

    console.log(`[BUSINESS_MSG_EDITED] Chat: ${fromChatId}, Msg ID: ${messageId} -> TargetOwner: ${targetOwnerId}`);

    await dispatchBusinessMessage(ctx.telegram, bMsg, targetOwnerId, true);
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
        console.log(`[FILTER_DROP] Отклонено сообщение из не-DM чата (Тип: ${ctx.chat.type}, ID: ${ctx.chat.id})`);
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
      `💼 <b>Привет, ${userName}!</b>\n\n` +
      `Я — ваш <b>Персональный Секретарь Telegram</b>.\n\n` +
      `📌 <b>Как это работает:</b>\n` +
      `1️⃣ <b>Секретарь в чужих ЛС:</b> Подключите меня в <i>Настройки Telegram → Telegram Business → Чат-боты</i>. Все входящие и исходящие сообщения из ваших диалогов с клиентами/друзьями будут протоколироваться и пересылаться <b>СЮДА (в этот наш диалог)</b>.\n` +
      `2️⃣ <b>Прямой диалог:</b> Отправьте мне сюда любую заметку или файл — я сохраню точную копию с метаданными.\n\n` +
      `🛡 <b>В чатах с собеседниками бот ничего не пишет и не спамит!</b> Все протоколы и копии приходят только вам сюда.\n` +
      `🔒 <i>Stateless / Zero Data Retention: данные не сохраняются на сторонних серверах.</i>`
    );
  } catch (err) {
    console.error('[START_CMD_ERROR]', err?.message || err);
  }
});

bot.help(async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const currentMode = (userId ? ownerFilterMode.get(userId) : null) || 'all';
    const delegatesCount = (userId ? ownerDelegates.get(userId)?.size : 0) || 0;

    const modeLabels = {
      all: '💬 Все сообщения (Входящие + Исходящие)',
      my_only: '👤 Только МОИ сообщения',
      clients_only: '👥 Только сообщения клиентов/собеседников',
    };

    return await ctx.replyWithHTML(
      `ℹ️ <b>Справка Персонального Секретаря Telegram:</b>\n\n` +
      `🛡 <b>Кому приходят сообщения:</b>\n` +
      `Бот пересылает сообщения <b>СТРОГО ВАМ</b> (в этот личный чат). В чатах с собеседниками бот ничего не пишет и не спамит!\n\n` +
      `⚙️ <b>Текущие настройки:</b>\n` +
      `• Фильтр: <b>${modeLabels[currentMode] || modeLabels.all}</b>\n` +
      `• Доверенные коллеги (Sharing): <b>${delegatesCount} чел.</b>\n\n` +
      `📋 <b>Доступные команды:</b>\n` +
      `• <code>/mode</code> или <code>/filter</code> — изменить фильтр (все / только мои / только клиентов)\n` +
      `• <code>/share &lt;ID&gt;</code> — добавить коллегу/ассистента для отправки копий\n` +
      `• <code>/unshare &lt;ID&gt;</code> — удалить коллегу из списка\n` +
      `• <code>/team</code> — список подключенных коллег\n` +
      `• <code>/status</code> — статус подключения и память (0 KB Stateless)\n\n` +
      `📤 <b>Как делиться сообщениями:</b>\n` +
      `Под каждым протоколом есть кнопки:\n` +
      `• <b>«📤 Поделиться в Telegram»</b> — отправка в любой чат через инлайн-меню.\n` +
      `• <b>«👥 Переслать коллегам»</b> — мгновенная отправка всей команде из <code>/team</code>.`
    );
  } catch (err) {
    console.error('[HELP_CMD_ERROR]', err?.message || err);
  }
});

// Команда /filter или /mode для выбора типа пересылаемых реплик
bot.command(['mode', 'filter'], async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    const currentMode = ownerFilterMode.get(userId) || 'all';

    return await ctx.replyWithHTML(
      `⚙️ <b>Настройка фильтрации бизнес-сообщений:</b>\n\n` +
      `Выберите, какие сообщения пересылать вам в этот чат:\n\n` +
      `• <b>Все сообщения:</b> входящие от клиентов и ваши ответы.\n` +
      `• <b>Только мои:</b> бот сохраняет только ваши реплики, обещания и отправленные файлы.\n` +
      `• <b>Только клиентов:</b> входящие обращения от клиентов/партнеров.\n\n` +
      `Текущий режим: <b>${currentMode === 'all' ? '💬 Все сообщения' : currentMode === 'my_only' ? '👤 Только мои' : '👥 Только клиентов'}</b>`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: (currentMode === 'all' ? '✅ ' : '') + '💬 Все сообщения', callback_data: 'set_filter_all' },
            ],
            [
              { text: (currentMode === 'my_only' ? '✅ ' : '') + '👤 Только мои сообщения', callback_data: 'set_filter_my_only' },
            ],
            [
              { text: (currentMode === 'clients_only' ? '✅ ' : '') + '👥 Только от клиентов', callback_data: 'set_filter_clients_only' },
            ],
          ],
        },
      }
    );
  } catch (err) {
    console.error('[MODE_CMD_ERROR]', err?.message || err);
  }
});

// Команда /share <userId> для добавления доверенного лица
bot.command('share', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    const args = ctx.message.text.split(' ').slice(1).filter(Boolean);
    if (args.length === 0) {
      return await ctx.replyWithHTML(
        `📤 <b>Добавление получателя для шеринга:</b>\n\n` +
        `Использование: <code>/share &lt;Telegram_ID_коллеги&gt;</code>\n\n` +
        `<i>Пример:</i> <code>/share 512940182</code>\n\n` +
        `💡 Чтобы узнать свой ID, ваш коллега может написать боту команду <code>/start</code>.`
      );
    }

    const targetDelegateId = parseInt(args[0], 10);
    if (isNaN(targetDelegateId)) {
      return await ctx.reply('❌ Укажите корректный числовой Telegram ID пользователя (например: /share 123456789)');
    }

    if (!ownerDelegates.has(userId)) {
      ownerDelegates.set(userId, new Set());
    }
    ownerDelegates.get(userId).add(targetDelegateId);

    return await ctx.replyWithHTML(
      `✅ <b>Коллега успешно добавлен в список доверенных лиц!</b>\n\n` +
      `🆔 <b>ID получателя:</b> <code>${targetDelegateId}</code>\n\n` +
      `Теперь вы можете делиться сообщениями в 1 клик с помощью кнопки <b>«👥 Переслать коллегам»</b>.`
    );
  } catch (err) {
    console.error('[SHARE_CMD_ERROR]', err?.message || err);
  }
});

// Команда /unshare <userId>
bot.command('unshare', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    const args = ctx.message.text.split(' ').slice(1).filter(Boolean);
    if (args.length === 0) {
      return await ctx.reply('Использование: /unshare <Telegram_ID_коллеги>');
    }

    const targetDelegateId = parseInt(args[0], 10);
    const delegates = ownerDelegates.get(userId);
    if (delegates && delegates.has(targetDelegateId)) {
      delegates.delete(targetDelegateId);
      return await ctx.replyWithHTML(`✅ Пользователь <code>${targetDelegateId}</code> удален из списка шеринга.`);
    } else {
      return await ctx.replyWithHTML(`ℹ️ Пользователь <code>${targetDelegateId}</code> не найден в вашем списке доверенных лиц.`);
    }
  } catch (err) {
    console.error('[UNSHARE_CMD_ERROR]', err?.message || err);
  }
});

// Команда /team — просмотр списка коллег
bot.command('team', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    const delegates = ownerDelegates.get(userId);
    if (!delegates || delegates.size === 0) {
      return await ctx.replyWithHTML(
        `👥 <b>Список коллег для шеринга пуст.</b>\n\n` +
        `Вы можете добавить ассистентов, менеджеров или каналы командой:\n` +
        `<code>/share &lt;Telegram_ID&gt;</code>\n\n` +
        `После добавления вы сможете пересылать им любые перехваченные реплики в 1 клик!`
      );
    }

    const listStr = Array.from(delegates)
      .map((id, idx) => `${idx + 1}. 🆔 <code>${id}</code>`)
      .join('\n');

    return await ctx.replyWithHTML(
      `👥 <b>Доверенные получатели сообщений (${delegates.size} чел.):</b>\n\n` +
      `${listStr}\n\n` +
      `➕ Добавить: <code>/share &lt;ID&gt;</code>\n` +
      `➖ Удалить: <code>/unshare &lt;ID&gt;</code>`
    );
  } catch (err) {
    console.error('[TEAM_CMD_ERROR]', err?.message || err);
  }
});

// Callback queries для инлайн кнопок
bot.action(/^set_filter_(all|my_only|clients_only)$/, async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    const newFilter = ctx.match[1];
    ownerFilterMode.set(userId, newFilter);

    const filterName = newFilter === 'all' ? '💬 Все сообщения' : newFilter === 'my_only' ? '👤 Только МОИ сообщения' : '👥 Только сообщения клиентов';

    await ctx.answerCbQuery(`Режим изменен: ${filterName}`);
    await ctx.editMessageText(
      `✅ <b>Фильтр сообщений обновлен!</b>\n\n` +
      `Текущий режим: <b>${filterName}</b>\n\n` +
      `• <i>all:</i> пересылаются все диалоги.\n` +
      `• <i>my_only:</i> пересылаются только ваши реплики.\n` +
      `• <i>clients_only:</i> пересылаются только входящие от клиентов.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: (newFilter === 'all' ? '✅ ' : '') + '💬 Все сообщения', callback_data: 'set_filter_all' },
            ],
            [
              { text: (newFilter === 'my_only' ? '✅ ' : '') + '👤 Только мои сообщения', callback_data: 'set_filter_my_only' },
            ],
            [
              { text: (newFilter === 'clients_only' ? '✅ ' : '') + '👥 Только от клиентов', callback_data: 'set_filter_clients_only' },
            ],
          ],
        },
      }
    );
  } catch (err) {
    console.error('[FILTER_CALLBACK_ERROR]', err?.message || err);
  }
});

bot.action('share_to_delegates', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    const delegates = ownerDelegates.get(userId);
    if (!delegates || delegates.size === 0) {
      await ctx.answerCbQuery('⚠️ Список коллег пуст! Добавьте ID командой /share <ID>', { show_alert: true });
      return;
    }

    const originalMsg = ctx.callbackQuery.message;
    if (originalMsg) {
      for (const delId of delegates) {
        try {
          if (originalMsg.text) {
            await ctx.telegram.sendMessage(delId, `📤 <b>[ПЕРЕСЛАНО ВЛАДЕЛЬЦЕМ]</b>\n\n${originalMsg.text}`, { parse_mode: 'HTML' });
          } else if (originalMsg.caption) {
            await ctx.telegram.copyMessage(delId, originalMsg.chat.id, originalMsg.message_id, {
              caption: `📤 <b>[ПЕРЕСЛАНО ВЛАДЕЛЬЦЕМ]</b>\n\n${originalMsg.caption}`,
              parse_mode: 'HTML',
            });
          } else {
            await ctx.telegram.copyMessage(delId, originalMsg.chat.id, originalMsg.message_id);
          }
        } catch (e) {
          console.warn(`[SHARE_TO_DELEGATE_FAILED_${delId}]`, e?.message || e);
        }
      }
    }

    await ctx.answerCbQuery(`✅ Переслано ${delegates.size} коллегам в команду!`);
  } catch (err) {
    console.error('[SHARE_ACTION_ERROR]', err?.message || err);
  }
});

bot.action('open_filter_menu', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const currentMode = (userId ? ownerFilterMode.get(userId) : null) || 'all';
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `⚙️ <b>Выберите режим фильтрации сообщений:</b>`,
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
  } catch (err) {
    console.error('[OPEN_FILTER_ERROR]', err?.message || err);
  }
});

bot.action('open_team_menu', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const delegates = userId ? ownerDelegates.get(userId) : null;
    const count = delegates?.size || 0;
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `👥 <b>Управление командой и получателями (${count} чел.):</b>\n\n` +
      `Используйте <code>/share &lt;ID&gt;</code> для добавления коллеги.\n` +
      `Используйте <code>/team</code> для просмотра списка.`
    );
  } catch (err) {
    console.error('[OPEN_TEAM_ERROR]', err?.message || err);
  }
});

// Inline Query Handler
bot.on('inline_query', async (ctx) => {
  try {
    const query = ctx.inlineQuery.query || 'Протокол перехвата Секретаря';
    const results = [
      {
        type: 'article',
        id: '1',
        title: '📤 Поделиться репликой / протоколом',
        description: query.slice(0, 50),
        input_message_content: {
          message_text: `📋 <b>[СЕКРЕТАРЬ • ЭКСПОРТ СООБЩЕНИЯ]</b>\n\n<blockquote>${escapeHtml(query)}</blockquote>\n\n🔒 <i>Отправлено через Персонального Секретаря</i>`,
          parse_mode: 'HTML',
        },
      },
    ];
    await ctx.answerInlineQuery(results, { cache_time: 5 });
  } catch (err) {
    console.error('[INLINE_QUERY_ERROR]', err?.message || err);
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
    console.log(`[DM_COPIED] Сообщение ID ${messageId} продублировано в чат с метаданными за ${elapsed}ms. Память очищена.`);
  } catch (err) {
    console.error(`[DM_COPY_ERROR] Сбой копирования сообщения:`, err?.message || err);
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
}
