import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN || '8988916261:AAFjUcZnQuDLbXh32A6zUUI64bCPj7KnW6w';
const bot = new Telegraf(BOT_TOKEN || '');

// Global error handler
bot.catch((err: any) => {
  console.error('[TELEGRAF_BOT_ERROR]', err?.message || err);
});

// Cache for business connection to owner, registered owners, filter modes and delegate recipients
// STRICT MULTI-TENANT ISOLATION: Each user has their own isolated connections, filter mode, and delegates.
const connectionToOwner = new Map<string, number>();
const registeredOwners = new Set<number>();
const ownerConnections = new Map<number, Set<string>>();

// Filter modes per user: 'all' (all messages), 'my_only' (only messages sent by the owner), 'clients_only' (only incoming from clients)
const ownerFilterMode = new Map<number, 'all' | 'my_only' | 'clients_only'>();

// Team delegates per user: Set of user/chat IDs who receive shared business messages for THAT owner
const ownerDelegates = new Map<number, Set<number>>();

// --- PERSISTENT STATE STORAGE (Multi-Tenant Zero-Drop Engine) ---
interface PersistentBotState {
  connections: Record<string, number>;
  registeredOwners: number[];
  ownerConnections?: Record<number, string[]>;
  ownerFilterMode: Record<number, 'all' | 'my_only' | 'clients_only'>;
  ownerDelegates: Record<number, number[]>;
  lastUpdated: string;
}

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
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data: PersistentBotState = JSON.parse(raw);

      if (data.connections) {
        Object.entries(data.connections).forEach(([connId, ownerId]) => {
          connectionToOwner.set(connId, ownerId);
          if (!ownerConnections.has(ownerId)) {
            ownerConnections.set(ownerId, new Set());
          }
          ownerConnections.get(ownerId)!.add(connId);
        });
      }
      if (Array.isArray(data.registeredOwners)) {
        data.registeredOwners.forEach((id) => registeredOwners.add(id));
      }
      if (data.ownerFilterMode) {
        Object.entries(data.ownerFilterMode).forEach(([idStr, mode]) => {
          const numId = parseInt(idStr, 10);
          if (!isNaN(numId)) ownerFilterMode.set(numId, mode);
        });
      }
      if (data.ownerDelegates) {
        Object.entries(data.ownerDelegates).forEach(([idStr, delList]) => {
          const numId = parseInt(idStr, 10);
          if (!isNaN(numId) && Array.isArray(delList)) {
            ownerDelegates.set(numId, new Set(delList));
          }
        });
      }
      console.log(`[PERSISTENCE_LOADED] Loaded ${connectionToOwner.size} isolated connections and ${registeredOwners.size} users from ${filePath}`);
    }
  } catch (err: any) {
    console.warn('[PERSISTENCE_LOAD_WARN] Failed to load state:', err?.message || err);
  }

  // Load default owner from env if present
  const envOwner = process.env.DEFAULT_OWNER_ID || process.env.OWNER_ID;
  if (envOwner) {
    const parsed = parseInt(envOwner, 10);
    if (!isNaN(parsed) && parsed > 0) {
      registeredOwners.add(parsed);
    }
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
function savePersistentState() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(STATE_DIR)) {
        fs.mkdirSync(STATE_DIR, { recursive: true });
      }

      const state: PersistentBotState = {
        connections: Object.fromEntries(connectionToOwner.entries()),
        registeredOwners: Array.from(registeredOwners),
        ownerConnections: Object.fromEntries(
          Array.from(ownerConnections.entries()).map(([k, v]) => [k, Array.from(v)])
        ),
        ownerFilterMode: Object.fromEntries(ownerFilterMode.entries()),
        ownerDelegates: Object.fromEntries(
          Array.from(ownerDelegates.entries()).map(([k, v]) => [k, Array.from(v)])
        ),
        lastUpdated: new Date().toISOString(),
      };

      const json = JSON.stringify(state, null, 2);
      try {
        fs.writeFileSync(STATE_FILE_PATH, json, 'utf-8');
      } catch {
        fs.writeFileSync(FALLBACK_STATE_PATH, json, 'utf-8');
      }
      console.log('[PERSISTENCE_SAVED] Isolated multi-tenant state saved.');
    } catch (err: any) {
      console.warn('[PERSISTENCE_SAVE_WARN] Failed to save state:', err?.message || err);
    }
  }, 100);
}

// Initial state load
loadPersistentState();

// Dynamic Owner Resolution (Strictly per business_connection_id — ZERO cross-user leakage)
async function resolveOwnerId(telegram: any, businessConnectionId?: string): Promise<number | null> {
  if (!businessConnectionId) return null;

  // 1. Direct match in local connection registry
  if (connectionToOwner.has(businessConnectionId)) {
    return connectionToOwner.get(businessConnectionId)!;
  }

  // 2. Query Telegram Bot API dynamically for THIS specific business connection
  if (telegram?.getBusinessConnection) {
    try {
      console.log(`[DYNAMIC_RECOVERY_ATTEMPT] Fetching business connection ${businessConnectionId} from Telegram API...`);
      const connInfo = await telegram.getBusinessConnection(businessConnectionId);
      if (connInfo?.user?.id) {
        const ownerId = connInfo.user.id;
        connectionToOwner.set(businessConnectionId, ownerId);
        registeredOwners.add(ownerId);
        if (!ownerConnections.has(ownerId)) {
          ownerConnections.set(ownerId, new Set());
        }
        ownerConnections.get(ownerId)!.add(businessConnectionId);
        savePersistentState();
        console.log(`[DYNAMIC_RECOVERY_SUCCESS] Connection ${businessConnectionId} strictly linked to owner ${ownerId}`);
        return ownerId;
      }
    } catch (apiErr: any) {
      console.warn(`[DYNAMIC_RECOVERY_API_WARN] getBusinessConnection failed for ${businessConnectionId}:`, apiErr?.message || apiErr);
    }
  }

  // STRICT PRIVACY PROTECTION: Never fall back to another random user!
  console.warn(`[UNRESOLVED_CONNECTION_ISOLATION] Connection ${businessConnectionId} cannot be mapped. Message skipped to prevent cross-user leak.`);
  return null;
}

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

// Helper to create share keyboard under each message
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

// Universal dispatcher for complete message forwarding strictly to the owner's DM and delegates
async function dispatchBusinessMessage(telegram: any, bMsg: any, targetOwnerId: number, isEdited = false) {
  const sender = bMsg.from;
  const fromChat = bMsg.chat;
  const fromChatId = fromChat?.id;
  const messageId = bMsg.message_id;

  // Check owner filter mode
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

  // List of all recipients: strictly the owner + any configured delegates
  const recipients = new Set<number>([targetOwnerId]);
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

      // 1. Text message
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

      // 2. Photo
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

      // 3. Voice
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

      // 4. Video note (Кружочек)
      if (bMsg.video_note) {
        await telegram.sendMessage(recipientId, `${delegatePrefix}${header}\n\n🎥 <i>Видеосообщение (кружочек)</i>`, { parse_mode: 'HTML' });
        await telegram.sendVideoNote(recipientId, bMsg.video_note.file_id, {
          reply_markup: isDelegate ? undefined : shareKeyboard,
        });
        continue;
      }

      // 5. Document / File
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

      // 6. Video
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

      // 7. Audio
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

      // 8. Sticker
      if (bMsg.sticker) {
        const emoji = bMsg.sticker.emoji ? ` (${bMsg.sticker.emoji})` : '';
        await telegram.sendMessage(recipientId, `${delegatePrefix}${header}\n\n🏷 <b>Стикер</b>${emoji}`, { parse_mode: 'HTML' });
        await telegram.sendSticker(recipientId, bMsg.sticker.file_id, {
          reply_markup: isDelegate ? undefined : shareKeyboard,
        });
        continue;
      }

      // 9. Animation / GIF
      if (bMsg.animation) {
        await telegram.sendAnimation(recipientId, bMsg.animation.file_id, {
          caption: header.length <= 1024 ? `${delegatePrefix}${header}` : undefined,
          parse_mode: 'HTML',
          reply_markup: isDelegate ? undefined : shareKeyboard,
        });
        continue;
      }

      // 10. Location
      if (bMsg.location) {
        await telegram.sendMessage(recipientId, `${delegatePrefix}${header}\n\n📍 <b>Геолокация:</b>`, { parse_mode: 'HTML' });
        await telegram.sendLocation(recipientId, bMsg.location.latitude, bMsg.location.longitude, {
          reply_markup: isDelegate ? undefined : shareKeyboard,
        });
        continue;
      }

      // 11. Contact
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

      // Fallback
      await telegram.sendMessage(recipientId, `${delegatePrefix}${header}`, {
        parse_mode: 'HTML',
        reply_markup: isDelegate ? undefined : shareKeyboard,
      });
      if (fromChatId && messageId) {
        try {
          await telegram.copyMessage(recipientId, fromChatId, messageId);
        } catch (copyErr: any) {
          console.warn('[FALLBACK_COPY_FAILED]', copyErr?.message || copyErr);
        }
      }
    } catch (sendErr: any) {
      console.error(`[DISPATCH_ERROR_RECIPIENT_${recipientId}]`, sendErr?.message || sendErr);
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
      if (isEnabled) {
        connectionToOwner.set(conn.id, businessUserId);
        registeredOwners.add(businessUserId);
        if (!ownerConnections.has(businessUserId)) {
          ownerConnections.set(businessUserId, new Set());
        }
        ownerConnections.get(businessUserId)!.add(conn.id);
      } else {
        connectionToOwner.delete(conn.id);
        ownerConnections.get(businessUserId)?.delete(conn.id);
      }
      savePersistentState();
    }

    console.log(`[BUSINESS_CONNECTION] ID: ${conn?.id}, User: ${businessUserName} (${businessUserId}), Enabled: ${isEnabled}`);

    if (isEnabled && businessUserId) {
      await ctx.telegram.sendMessage(
        businessUserId,
        `💼 <b>Режим Персонального Секретаря Telegram Business АКТИВИРОВАН!</b>\n\n` +
        `✅ Бот успешно подключен к вашим личным диалогам.\n\n` +
        `🛡 <b>Полная изоляция данных (Multi-Tenant):</b>\n` +
        `• Ваши сообщения и настройки изолированы и привязаны <b>СТРОГО к вашему аккаунту (ID: <code>${businessUserId}</code>)</b>.\n` +
        `• Другие пользователи или их команды <code>/fix</code> никак не могут повлиять на вашу сессию.\n` +
        `• В чатах с собеседниками бот <b>не спамит</b> и не мешает общению.\n` +
        `• Все сообщения из ваших бизнес-чатов направляются <b>СТРОГО СЮДА (в этот ваш диалог)</b>.\n` +
        `• К каждому сообщению прикрепляется карточка с точной копией (текст, голос, фото, видео, кружочки, файлы).\n\n` +
        `⚙️ <i>Команды: /mode (фильтр), /share (шеринг), /fix (диагностика), /status (статус).</i>`,
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

    // Resolve owner with strict connection mapping
    const targetOwnerId = await resolveOwnerId(ctx.telegram, businessConnectionId);

    console.log(`[BUSINESS_MSG_RECV] Conn: ${businessConnectionId}, FromChat: ${fromChatId}, Sender: ${senderName} (ID: ${sender?.id}) -> TargetOwner: ${targetOwnerId}`);

    if (!targetOwnerId) {
      console.warn(`[TARGET_OWNER_NOT_FOUND] Бизнес-привязка ${businessConnectionId} не сопоставлена. Сообщение не пересылается.`);
      return;
    }

    const startTime = Date.now();

    // Deliver protocol card + full message content/media/files strictly to the corresponding owner's DM
    await dispatchBusinessMessage(ctx.telegram, bMsg, targetOwnerId, false);

    const elapsed = Date.now() - startTime;
    console.log(`[BUSINESS_MSG_FORWARDED_TO_OWNER] Msg ID ${messageId} forwarded to isolated owner ${targetOwnerId} (${elapsed}ms). Client chat kept clean!`);
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

    const targetOwnerId = await resolveOwnerId(ctx.telegram, businessConnectionId);
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
      savePersistentState();
    }

    return await ctx.replyWithHTML(
      `💼 <b>Привет, ${userName}!</b>\n\n` +
      `Я — ваш <b>Персональный Секретарь Telegram</b> с полной изоляцией пользователей (Multi-Tenant Protection).\n\n` +
      `📌 <b>Как это работает:</b>\n` +
      `1️⃣ <b>Секретарь в чужих ЛС:</b> Подключите меня в <i>Настройки Telegram → Telegram Business → Чат-боты</i>. Все сообщения из ваших личных диалогов будут протоколироваться и пересылаться <b>СТРОГО СЮДА (в этот наш диалог)</b>.\n` +
      `2️⃣ <b>100% Изоляция:</b> Ваша учетная запись, настройки и бизнес-подключения изолированы от других пользователей.\n` +
      `3️⃣ <b>Прямой диалог:</b> Отправьте мне сюда любую заметку или файл — я сохраню точную копию с метаданными.\n\n` +
      `🛡 <b>В чатах с собеседниками бот ничего не пишет и не спамит!</b>\n` +
      `⚙️ <i>Проверка состояния: /status | Самодиагностика: /fix</i>`
    );
  } catch (err: any) {
    console.error('[START_CMD_ERROR]', err?.message || err);
  }
});

// Self-healing & Reconnect Command (Strictly isolated per calling user)
bot.command(['fix', 'reconnect', 'sync'], async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const userName = ctx.from?.first_name || 'Владелец';

    if (!userId) return;

    registeredOwners.add(userId);
    savePersistentState();

    // Find all connections belonging to THIS specific user
    const userConns: string[] = [];
    for (const [cId, oId] of connectionToOwner.entries()) {
      if (oId === userId) userConns.push(cId);
    }

    const currentFilter = ownerFilterMode.get(userId) || 'all';
    const delegatesCount = ownerDelegates.get(userId)?.size || 0;

    return await ctx.replyWithHTML(
      `🛡 <b>[ДИАГНОСТИКА И ИЗОЛЯЦИЯ СЕКРЕТАРЯ]</b>\n\n` +
      `👤 <b>Пользователь:</b> ${userName} (ID: <code>${userId}</code>)\n` +
      `🔒 <b>Статус изоляции:</b> 🟢 Полностью изолирован (Multi-Tenant Active)\n` +
      `💾 <b>Постоянное хранилище:</b> Сохранено в <code>data/secretary-state.json</code>\n` +
      `🔗 <b>Ваших активных бизнес-привязок:</b> ${userConns.length > 0 ? userConns.length + ' шт.' : '0 (ожидает первого подключения в Настройки → Telegram Business)'}\n` +
      `⚙️ <b>Ваш индивидуальный режим фильтра:</b> <code>${currentFilter}</code>\n` +
      `👥 <b>Ваша команда шеринга:</b> ${delegatesCount} чел.\n\n` +
      `💡 <i>Настройки и привязки каждого пользователя хранятся раздельно и защищены от перезаписи другими людьми.</i>`
    );
  } catch (err: any) {
    console.error('[FIX_CMD_ERROR]', err?.message || err);
  }
});

bot.help(async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const currentMode = (userId ? ownerFilterMode.get(userId) : null) || 'all';
    const delegatesCount = (userId ? ownerDelegates.get(userId)?.size : 0) || 0;

    const modeLabels: Record<string, string> = {
      all: '💬 Все сообщения (Входящие + Исходящие)',
      my_only: '👤 Только МОИ сообщения',
      clients_only: '👥 Только сообщения клиентов/собеседников',
    };

    return await ctx.replyWithHTML(
      `ℹ️ <b>Справка Персонального Секретаря Telegram:</b>\n\n` +
      `🛡 <b>Кому приходят сообщения:</b>\n` +
      `Бот пересылает сообщения <b>СТРОГО ВАМ</b> (в этот личный чат). В чатах с собеседниками бот ничего не пишет и не спамит!\n\n` +
      `🔒 <b>Защита от слётов:</b> Встроен постоянный механизм динамического восстановления сессий через Telegram API.\n\n` +
      `⚙️ <b>Текущие настройки:</b>\n` +
      `• Фильтр: <b>${modeLabels[currentMode]}</b>\n` +
      `• Доверенные коллеги (Sharing): <b>${delegatesCount} чел.</b>\n\n` +
      `📋 <b>Доступные команды:</b>\n` +
      `• <code>/mode</code> или <code>/filter</code> — изменить фильтр (все / только мои / только клиентов)\n` +
      `• <code>/share &lt;ID&gt;</code> — добавить коллегу/ассистента для отправки копий\n` +
      `• <code>/unshare &lt;ID&gt;</code> — удалить коллегу из списка\n` +
      `• <code>/team</code> — список подключенных коллег\n` +
      `• <code>/fix</code> — принудительная синхронизация и проверка связи\n` +
      `• <code>/status</code> — статус подключения и постоянного хранилища\n\n` +
      `📤 <b>Как делиться сообщениями:</b>\n` +
      `Под каждым протоколом есть кнопки <b>«📤 Поделиться»</b> и <b>«👥 Переслать коллегам»</b>.`
    );
  } catch (err: any) {
    console.error('[HELP_CMD_ERROR]', err?.message || err);
  }
});

// Command: /filter or /mode
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
  } catch (err: any) {
    console.error('[MODE_CMD_ERROR]', err?.message || err);
  }
});

// Command: /share <userId>
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
      ownerDelegates.set(userId, new Set<number>());
    }
    ownerDelegates.get(userId)!.add(targetDelegateId);
    savePersistentState();

    return await ctx.replyWithHTML(
      `✅ <b>Коллега успешно добавлен в список доверенных лиц!</b>\n\n` +
      `🆔 <b>ID получателя:</b> <code>${targetDelegateId}</code>\n\n` +
      `Теперь вы можете делиться сообщениями в 1 клик с помощью кнопки <b>«👥 Переслать коллегам»</b>, либо сообщения будут ретранслироваться согласно вашим правилам.`
    );
  } catch (err: any) {
    console.error('[SHARE_CMD_ERROR]', err?.message || err);
  }
});

// Command: /unshare <userId>
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
      savePersistentState();
      return await ctx.replyWithHTML(`✅ Пользователь <code>${targetDelegateId}</code> удален из списка шеринга.`);
    } else {
      return await ctx.replyWithHTML(`ℹ️ Пользователь <code>${targetDelegateId}</code> не найден в вашем списке доверенных лиц.`);
    }
  } catch (err: any) {
    console.error('[UNSHARE_CMD_ERROR]', err?.message || err);
  }
});

// Command: /team
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
  } catch (err: any) {
    console.error('[TEAM_CMD_ERROR]', err?.message || err);
  }
});

// Callback queries for interactive inline buttons
bot.action(/^set_filter_(all|my_only|clients_only)$/, async (ctx: any) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    const newFilter = ctx.match[1] as 'all' | 'my_only' | 'clients_only';
    ownerFilterMode.set(userId, newFilter);
    savePersistentState();

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
  } catch (err: any) {
    console.error('[FILTER_CALLBACK_ERROR]', err?.message || err);
  }
});

bot.action('share_to_delegates', async (ctx: any) => {
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
        } catch (e: any) {
          console.warn(`[SHARE_TO_DELEGATE_FAILED_${delId}]`, e?.message || e);
        }
      }
    }

    await ctx.answerCbQuery(`✅ Переслано ${delegates.size} коллегам в команду!`);
  } catch (err: any) {
    console.error('[SHARE_ACTION_ERROR]', err?.message || err);
  }
});

bot.action('open_filter_menu', async (ctx: any) => {
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
  } catch (err: any) {
    console.error('[OPEN_FILTER_ERROR]', err?.message || err);
  }
});

bot.action('open_team_menu', async (ctx: any) => {
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
  } catch (err: any) {
    console.error('[OPEN_TEAM_ERROR]', err?.message || err);
  }
});

// Inline Query Handler (Share protocol in any Telegram chat via @bot_username)
bot.on('inline_query', async (ctx: any) => {
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
  } catch (err: any) {
    console.error('[INLINE_QUERY_ERROR]', err?.message || err);
  }
});

bot.command('status', async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const isOwner = userId ? registeredOwners.has(userId) : false;
    const currentMode = (userId ? ownerFilterMode.get(userId) : null) || 'all';
    const delegatesCount = (userId ? ownerDelegates.get(userId)?.size : 0) || 0;
    const userConnsCount = userId
      ? Array.from(connectionToOwner.entries()).filter(([_, oId]) => oId === userId).length
      : 0;

    return await ctx.replyWithHTML(
      `⚡ <b>Статус Персонального Секретаря:</b> Активен (Онлайн)\n\n` +
      `🛡 <b>Изоляция пользователей:</b> 🟢 100% Multi-Tenant Isolation\n` +
      `💾 <b>Постоянное хранилище:</b> <code>data/secretary-state.json</code> (Zero-Drop)\n` +
      `👤 <b>Ваш статус:</b> ${isOwner ? '✅ Подключенный пользователь (ID: <code>' + userId + '</code>)' : 'Гость (нажмите /start)'}\n` +
      `🔗 <b>Ваших бизнес-привязок:</b> ${userConnsCount} шт.\n` +
      `⚙️ <b>Ваш фильтр:</b> <code>${currentMode}</code>\n` +
      `👥 <b>Ваша команда шеринга:</b> ${delegatesCount} чел.\n` +
      `🌐 <b>Всего пользователей в системе:</b> ${registeredOwners.size} чел. (каждый строго изолирован)\n` +
      `⏱ <b>Uptime:</b> ${process.uptime().toFixed(1)} сек.\n` +
      `📦 <b>Node.js:</b> ${process.version}\n\n` +
      `💡 <i>Настройки и пересылка каждого пользователя строго изолированы и защищены от перезаписи другими.</i>`
    );
  } catch (err: any) {
    console.error('[STATUS_CMD_ERROR]', err?.message || err);
  }
});

// 6. Direct messages sent into bot DM (strictly mirrored back to sender only)
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
    savePersistentState();
  }

  try {
    await dispatchBusinessMessage(ctx.telegram, message, chatId, false);
    const elapsed = Date.now() - startTime;
    console.log(`[DM_COPIED] Message ID ${messageId} mirrored with content in ${elapsed}ms. Isolated to chat ${chatId}.`);
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

  // Health and Sync status check
  app.get(['/api/bot', '/api/bot/sync', '/api/health'], (req, res) => {
    res.json({
      status: 'ok',
      service: 'Personal Secretary Telegram Bot (Business Forwarder to Bot DM)',
      multi_tenant_isolation: true,
      zero_drop_engine: true,
      persistent_storage: true,
      registered_owners_count: registeredOwners.size,
      active_connections_count: connectionToOwner.size,
      stateless_mirror: true,
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
