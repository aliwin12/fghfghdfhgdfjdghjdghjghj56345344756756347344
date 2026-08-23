import React, { useState } from 'react';
import { Send, Bot, User, Zap, RefreshCw, Trash2, FileText, Image, Mic, Briefcase, UserCheck, Tag, ExternalLink, ShieldCheck, Check, MessageSquare, ArrowRight, Share2, Users, Sliders, Filter, CheckCircle2 } from 'lucide-react';

export const BotSimulator: React.FC = () => {
  const [userName, setUserName] = useState('Владимир (Владелец)');
  const [userHandle, setUserHandle] = useState('vladimir_ceo');
  const [userId, setUserId] = useState('849201948');

  const [interlocutorName, setInterlocutorName] = useState('Алексей Смирнов');
  const [interlocutorHandle, setInterlocutorHandle] = useState('alex_client');
  const [interlocutorId, setInterlocutorId] = useState('512940182');

  const [currentSender, setCurrentSender] = useState<'interlocutor' | 'user'>('interlocutor');
  const [messageType, setMessageType] = useState<'text' | 'photo' | 'document' | 'voice'>('text');
  const [messageText, setMessageText] = useState('Здравствуйте! Отправляю коммерческое предложение по проекту.');

  // Настройки фильтрации (all / my_only / clients_only)
  const [filterMode, setFilterMode] = useState<'all' | 'my_only' | 'clients_only'>('all');

  // Доверенные коллеги (Sharing delegates)
  const [delegates, setDelegates] = useState<Array<{ id: string; name: string; role: string }>>([
    { id: '394820195', name: 'Елена (Ассистент)', role: 'Ассистент' },
  ]);
  const [newDelegateId, setNewDelegateId] = useState('');
  const [newDelegateName, setNewDelegateName] = useState('');
  const [shareSuccessToast, setShareSuccessToast] = useState<string | null>(null);

  // Chat 1: Conversation with Interlocutor (Clean, no bot spam)
  const [clientChatHistory, setClientChatHistory] = useState<Array<{
    id: number;
    sender: 'interlocutor' | 'user';
    type: 'text' | 'photo' | 'document' | 'voice';
    content: string;
    caption?: string;
    senderName: string;
    timestamp: string;
  }>>([
    {
      id: 1,
      sender: 'interlocutor',
      type: 'text',
      content: 'Владимир, добрый день! Согласовали договор с юристами.',
      senderName: 'Алексей Смирнов',
      timestamp: '14:20',
    },
    {
      id: 2,
      sender: 'user',
      type: 'text',
      content: 'Отлично, высылаю подписанную копию с печатями!',
      senderName: 'Владимир',
      timestamp: '14:21',
    },
  ]);

  // Chat 2: Secretary Bot Private DM (Where logs & message copies arrive!)
  const [botChatHistory, setBotChatHistory] = useState<Array<{
    id: number;
    type: 'welcome' | 'message';
    authorName?: string;
    authorHandle?: string;
    authorId?: string;
    chatTitle?: string;
    msgType?: 'text' | 'photo' | 'document' | 'voice';
    content?: string;
    caption?: string;
    timestamp: string;
    isOwnerMessage?: boolean;
    sharedWithCount?: number;
  }>>([
    {
      id: 101,
      type: 'welcome',
      content: '💼 Режим Персонального Секретаря Telegram Business АКТИВИРОВАН! Сообщения пересылаются СТРОГО ВАМ в этот диалог. В чатах с собеседниками бот ничего не пишет.',
      timestamp: '14:00',
    },
    {
      id: 102,
      type: 'message',
      authorName: 'Алексей Смирнов',
      authorHandle: 'alex_client',
      authorId: '512940182',
      chatTitle: 'Алексей Смирнов',
      msgType: 'text',
      content: 'Владимир, добрый день! Согласовали договор с юристами.',
      timestamp: '14:20:12',
      isOwnerMessage: false,
    },
    {
      id: 103,
      type: 'message',
      authorName: 'Владимир',
      authorHandle: 'vladimir_ceo',
      authorId: '849201948',
      chatTitle: 'Алексей Смирнов',
      msgType: 'text',
      content: 'Отлично, высылаю подписанную копию с печатями!',
      timestamp: '14:21:05',
      isOwnerMessage: true,
    },
  ]);

  const [logs, setLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleAddDelegate = () => {
    if (!newDelegateId) return;
    const name = newDelegateName || `Коллега ${newDelegateId.slice(-4)}`;
    setDelegates((prev) => [...prev.filter((d) => d.id !== newDelegateId), { id: newDelegateId, name, role: 'Коллега' }]);
    setNewDelegateId('');
    setNewDelegateName('');
    showToast(`✅ Пользователь ${name} (ID: ${newDelegateId}) добавлен в команду шеринга`);
  };

  const handleRemoveDelegate = (id: string) => {
    setDelegates((prev) => prev.filter((d) => d.id !== id));
    showToast(`ℹ️ Коллега ID ${id} удален из списка`);
  };

  const showToast = (msg: string) => {
    setShareSuccessToast(msg);
    setTimeout(() => {
      setShareSuccessToast(null);
    }, 3500);
  };

  const handleShareToDelegates = (msgId: number) => {
    if (delegates.length === 0) {
      showToast('⚠️ Список коллег пуст! Добавьте коллегу через /share <ID>');
      return;
    }

    setBotChatHistory((prev) =>
      prev.map((item) => (item.id === msgId ? { ...item, sharedWithCount: delegates.length } : item))
    );

    const names = delegates.map((d) => d.name).join(', ');
    showToast(`🚀 Реплика успешно переслана ${delegates.length} коллегам: ${names}`);

    setLogs((prev) => [
      ...prev,
      `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [SHARE_DISPATCH] Сообщение переслано ${delegates.length} делегатам: [${delegates.map((d) => d.id).join(', ')}]`,
    ]);
  };

  const runSimulation = () => {
    if (!messageText && messageType === 'text') return;
    setIsSimulating(true);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const fullTimeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newMsgId = Date.now();

    const isInterlocutor = currentSender === 'interlocutor';
    const activeSenderName = isInterlocutor ? interlocutorName : userName;
    const activeSenderHandle = isInterlocutor ? interlocutorHandle : userHandle;
    const activeSenderId = isInterlocutor ? interlocutorId : userId;

    // 1. Add message to client chat (clean conversation)
    const clientMsg = {
      id: newMsgId,
      sender: currentSender,
      type: messageType,
      content: messageText,
      caption: messageType === 'photo' ? messageText : undefined,
      senderName: isInterlocutor ? interlocutorName : userName,
      timestamp: timeStr,
    };

    setClientChatHistory((prev) => [...prev, clientMsg]);
    setLogs([]);

    // Проверка фильтрации
    const willSkip =
      (filterMode === 'my_only' && isInterlocutor) ||
      (filterMode === 'clients_only' && !isInterlocutor);

    // Telemetry Step 1: Intercept update
    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [TELEGRAM_BUSINESS] Update: business_message (chat: 749102, sender: "${activeSenderName}", @${activeSenderHandle})`,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [FILTER_CHECK] Режим фильтра: "${filterMode}". Сообщение ${willSkip ? 'ПРОПУЩЕНО (не соответствует фильтру)' : 'ОДОБРЕНО к пересылке'}.`,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [TARGET_ROUTING] Адресат: СТРОГО подключивший владелец (ID: ${userId})${delegates.length > 0 ? ` + ${delegates.length} делегатов` : ''}. Чат собеседника чист.`,
      ]);
    }, 120);

    // Telemetry Step 2: Combined Message + Author Card sent to BOT DM
    setTimeout(() => {
      if (!willSkip) {
        const deliveredMsg = {
          id: newMsgId + 1,
          type: 'message' as const,
          authorName: activeSenderName,
          authorHandle: activeSenderHandle,
          authorId: activeSenderId,
          chatTitle: `${interlocutorName}`,
          msgType: messageType,
          content: messageText,
          caption: messageType === 'photo' ? messageText : undefined,
          timestamp: fullTimeStr,
          isOwnerMessage: !isInterlocutor,
        };

        setBotChatHistory((prev) => [...prev, deliveredMsg]);
        setLogs((prev) => [
          ...prev,
          `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [DELIVER_TO_BOT_DM] Доставлено в ЛС Владельца (${userId}): Автор="${activeSenderName}" (@${activeSenderHandle})`,
          `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [STATELESS_PURGE] Память сервера очищена (0 байт в БД).`,
          `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [HTTP_200_OK] Webhook ACK отправлен Telegram за 12ms.`,
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [FILTER_DROP] Реплика не пересылалась согласно фильтру "${filterMode}".`,
        ]);
      }
      setIsSimulating(false);
    }, 350);
  };

  const clearChat = () => {
    setClientChatHistory([]);
    setBotChatHistory([
      {
        id: Date.now(),
        type: 'welcome',
        content: '💼 Режим Персонального Секретаря Telegram Business АКТИВИРОВАН! Сообщения пересылаются СТРОГО ВАМ в этот диалог.',
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setLogs([]);
  };

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {shareSuccessToast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 border border-blue-500 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{shareSuccessToast}</span>
        </div>
      )}

      {/* Banner explaining the architecture */}
      <div className="bg-gradient-to-r from-blue-950/70 via-indigo-950/50 to-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-blue-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Обновленная логика
              </span>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Секретарь пишет СТРОГО подключившему владельцу (+ Шеринг и Фильтры)
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Бот <b>не пишет другим людям без вашего разрешения</b>. Вы можете настроить фильтр (только ваши сообщения / все / только клиентов) и делиться выбранными репликами с коллегами в 1 клик.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs text-emerald-400 font-semibold shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Индивидуальная маршрутизация • 0 спама</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Control Panel + Dual Chat Screens */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Message Dispatcher & Author Controls (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* 1. Dispatch Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                1. Симуляция реплики
              </h3>
              <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                Telegram Business
              </span>
            </div>

            {/* Sender Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Кто отправляет сообщение?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentSender('interlocutor')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    currentSender === 'interlocutor'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Собеседник</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentSender('user')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    currentSender === 'user'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Вы (Владелец)</span>
                </button>
              </div>
            </div>

            {/* Sender Details Form */}
            {currentSender === 'interlocutor' ? (
              <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/30 space-y-2">
                <div className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Данные Собеседника (Клиента):</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Имя</label>
                    <input
                      type="text"
                      value={interlocutorName}
                      onChange={(e) => setInterlocutorName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Никнейм</label>
                    <input
                      type="text"
                      value={interlocutorHandle}
                      onChange={(e) => setInterlocutorHandle(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-0.5">Telegram ID</label>
                    <input
                      type="text"
                      value={interlocutorId}
                      onChange={(e) => setInterlocutorId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono text-slate-300 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 p-3 rounded-xl border border-blue-500/30 space-y-2">
                <div className="text-[11px] font-semibold text-blue-400 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Ваши данные (Владельца):</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Имя</label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Никнейм</label>
                    <input
                      type="text"
                      value={userHandle}
                      onChange={(e) => setUserHandle(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-0.5">Telegram ID</label>
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono text-slate-300 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Message Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Формат сообщения</label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setMessageType('text')}
                  className={`p-2 rounded-lg border text-center text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                    messageType === 'text'
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-[10px]">Текст</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMessageType('photo')}
                  className={`p-2 rounded-lg border text-center text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                    messageType === 'photo'
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Image className="w-4 h-4" />
                  <span className="text-[10px]">Фото</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMessageType('document')}
                  className={`p-2 rounded-lg border text-center text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                    messageType === 'document'
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span className="text-[10px]">Файл</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMessageType('voice')}
                  className={`p-2 rounded-lg border text-center text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                    messageType === 'voice'
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span className="text-[10px]">Голос</span>
                </button>
              </div>
            </div>

            {/* Content input */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {messageType === 'text' ? 'Текст сообщения' : 'Подпись к файлу'}
              </label>
              <textarea
                rows={2}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Напишите реплику..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Action button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={runSimulation}
                disabled={isSimulating || (!messageText && messageType === 'text')}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Перехват и пересылка владельцу...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Отправить от: {currentSender === 'interlocutor' ? interlocutorName : 'Вас'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. Filter & Team Controls (New Requested Features) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                2. Фильтр реплик (/mode)
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono">
                {filterMode === 'all' ? 'Все' : filterMode === 'my_only' ? 'Только мои' : 'Клиенты'}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-slate-400 font-medium">Какие сообщения пересылать владельцу:</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`p-2 rounded-xl border text-[11px] font-semibold text-center transition-all ${
                    filterMode === 'all'
                      ? 'bg-blue-600 border-blue-500 text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  💬 Все
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('my_only')}
                  className={`p-2 rounded-xl border text-[11px] font-semibold text-center transition-all ${
                    filterMode === 'my_only'
                      ? 'bg-blue-600 border-blue-500 text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  👤 Только мои
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('clients_only')}
                  className={`p-2 rounded-xl border text-[11px] font-semibold text-center transition-all ${
                    filterMode === 'clients_only'
                      ? 'bg-blue-600 border-blue-500 text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  👥 Клиенты
                </button>
              </div>
            </div>

            {/* Team Sharing */}
            <div className="pt-2 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>Команда для шеринга (/team)</span>
                </label>
                <span className="text-[10px] text-slate-500">{delegates.length} чел.</span>
              </div>

              {/* Add delegate input */}
              <div className="grid grid-cols-12 gap-1.5">
                <input
                  type="text"
                  placeholder="ID коллеги"
                  value={newDelegateId}
                  onChange={(e) => setNewDelegateId(e.target.value)}
                  className="col-span-6 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Имя / Роль"
                  value={newDelegateName}
                  onChange={(e) => setNewDelegateName(e.target.value)}
                  className="col-span-4 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddDelegate}
                  disabled={!newDelegateId}
                  className="col-span-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center justify-center transition-all"
                >
                  +
                </button>
              </div>

              {/* Delegate list */}
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {delegates.length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic text-center py-1">Коллеги не добавлены</div>
                ) : (
                  delegates.map((del) => (
                    <div key={del.id} className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800/80 text-xs">
                      <div>
                        <div className="font-semibold text-white text-[11px]">{del.name}</div>
                        <div className="text-[9px] text-slate-400 font-mono">ID: {del.id}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDelegate(del.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 3. Real-time server telemetry */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">Телеметрия Serverless Webhook:</span>
              <button
                type="button"
                onClick={clearChat}
                className="text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Очистить</span>
              </button>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 font-mono text-[10px] text-slate-400 max-h-36 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic">Нажмите кнопку «Отправить», чтобы увидеть работу Telegram Webhook...</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={log.includes('ERROR') ? 'text-rose-400' : log.includes('COPIED') || log.includes('FORWARD') || log.includes('DELIVER') ? 'text-emerald-400 font-bold' : log.includes('DROP') ? 'text-amber-400' : 'text-slate-300'}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Dual Telegram Screens (8 cols) */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* SCREEN 1: CLIENT DM (CLEAN DIALOGUE) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[580px] shadow-xl">
            {/* Header */}
            <div className="pb-3 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">
                  АС
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{interlocutorName}</span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-normal">
                      @{interlocutorHandle}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Чат с клиентом (В чужих ЛС)</div>
                </div>
              </div>
              <span className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                Чистый диалог
              </span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 bg-[#0f172a] rounded-xl p-3 my-3 border border-slate-800/80 overflow-y-auto space-y-2.5">
              <div className="text-center my-1">
                <span className="bg-slate-900/90 text-slate-400 text-[10px] px-2.5 py-1 rounded-full border border-slate-800">
                  🔒 Telegram Business подключен • Собеседник видит только вашу беседу
                </span>
              </div>

              {clientChatHistory.map((item) => {
                const isUser = item.sender === 'user';
                return (
                  <div key={item.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-md ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-none'
                      }`}
                    >
                      <div className="text-[10px] font-semibold opacity-75 mb-0.5">
                        {isUser ? 'Вы' : item.senderName}
                      </div>

                      {item.type === 'photo' && (
                        <div className="mb-1.5 rounded-lg overflow-hidden border border-white/10 bg-black/20 p-2 text-center text-[10px] text-slate-300 flex items-center justify-center gap-1.5">
                          <Image className="w-3.5 h-3.5" />
                          <span>[Изображение / Документ]</span>
                        </div>
                      )}
                      {item.type === 'document' && (
                        <div className="mb-1.5 rounded-lg border border-white/10 bg-black/20 p-1.5 text-[10px] flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>document_presentation.pdf</span>
                        </div>
                      )}
                      {item.type === 'voice' && (
                        <div className="mb-1.5 rounded-lg border border-white/10 bg-black/20 p-1.5 text-[10px] flex items-center gap-1.5">
                          <Mic className="w-3.5 h-3.5" />
                          <span>Голосовое сообщение (0:18)</span>
                        </div>
                      )}

                      <div className="text-xs break-words">{item.content}</div>
                      <div className="text-[9px] text-right opacity-60 mt-1">{item.timestamp}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input placeholder */}
            <div className="text-[11px] text-slate-500 text-center shrink-0">
              В чате клиента бот ничего не пишет и не мешает беседе
            </div>
          </div>

          {/* SCREEN 2: SECRETARY BOT DM (WHERE LOGS & COPIES ARRIVE) */}
          <div className="bg-slate-900 border border-blue-500/40 rounded-2xl p-4 flex flex-col h-[580px] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="pb-3 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Персональный Секретарь</span>
                    <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-normal">
                      bot
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-400">Ваш личный чат с Ботом (ЛС)</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-semibold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                  {filterMode === 'all' ? 'Все сообщения' : filterMode === 'my_only' ? 'Только мои' : 'Клиенты'}
                </span>
              </div>
            </div>

            {/* Bot Chat Messages */}
            <div className="flex-1 bg-[#0b1324] rounded-xl p-3 my-3 border border-blue-950/80 overflow-y-auto space-y-2.5">
              {botChatHistory.map((item) => {
                if (item.type === 'welcome') {
                  return (
                    <div key={item.id} className="flex justify-center my-1">
                      <div className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-2.5 text-[11px] text-blue-200 text-center leading-relaxed max-w-[95%]">
                        {item.content}
                      </div>
                    </div>
                  );
                }

                // UNIFIED MESSAGE WITH AUTHOR INFO, COPIED CONTENT, AND SHARING BUTTONS
                if (item.type === 'message') {
                  return (
                    <div key={item.id} className="flex justify-start my-1.5">
                      <div className="bg-slate-900 border border-blue-500/40 rounded-xl p-3 text-xs shadow-lg max-w-[98%] text-slate-200 font-sans space-y-2 w-full">
                        {/* Header with Author Details */}
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                          <div className="flex items-center gap-1.5 text-blue-400 font-bold text-[11px]">
                            <Tag className="w-3.5 h-3.5" />
                            <span>📋 [ПРОТОКОЛ ПЕРЕХВАТА]</span>
                          </div>
                          <span className="text-[9px] text-slate-500">{item.timestamp}</span>
                        </div>

                        {/* Author Info */}
                        <div className="grid grid-cols-1 gap-1 text-[11px] bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                          {item.chatTitle && (
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">💬 Диалог:</span>
                              <span className="font-semibold text-blue-300">{item.chatTitle}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">👤 Кто написал:</span>
                            <span className="font-semibold text-white">{item.authorName}</span>
                            <span className="text-amber-300 text-[10px]">(@{item.authorHandle})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">🆔 ID автора:</span>
                            <code className="bg-slate-900 px-1 py-0.2 rounded text-[10px] text-slate-300 font-mono">
                              {item.authorId}
                            </code>
                          </div>
                        </div>

                        {/* Copied Message Content */}
                        <div className="pt-1">
                          {item.msgType === 'photo' && (
                            <div className="mb-2 rounded-lg bg-black/30 p-2 text-[10px] flex items-center gap-1.5 text-slate-300 border border-slate-800">
                              <Image className="w-4 h-4 text-blue-400" />
                              <span>[Оригинальное фото]</span>
                            </div>
                          )}
                          {item.msgType === 'document' && (
                            <div className="mb-2 rounded-lg bg-black/30 p-2 text-[10px] flex items-center gap-1.5 text-slate-300 border border-slate-800">
                              <Briefcase className="w-4 h-4 text-blue-400" />
                              <span>document_presentation.pdf</span>
                            </div>
                          )}
                          {item.msgType === 'voice' && (
                            <div className="mb-2 rounded-lg bg-black/30 p-2 text-[10px] flex items-center gap-1.5 text-slate-300 border border-slate-800">
                              <Mic className="w-4 h-4 text-blue-400" />
                              <span>🎤 Голосовое сообщение (0:18)</span>
                            </div>
                          )}

                          {item.content && (
                            <div className="bg-blue-950/30 border-l-2 border-blue-500 pl-2.5 py-1.5 rounded-r text-slate-100 text-xs break-words">
                              <div className="text-[10px] text-blue-400 font-medium mb-0.5">✉️ Текст сообщения:</div>
                              {item.content}
                            </div>
                          )}
                        </div>

                        {/* Inline Sharing Buttons */}
                        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => showToast(`📤 Инлайн-шеринг: реплика скопирована для пересылки в Telegram`)}
                            className="bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-blue-300 rounded-lg py-1.5 px-2 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Поделиться</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareToDelegates(item.id)}
                            className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-200 rounded-lg py-1.5 px-2 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Users className="w-3 h-3" />
                            <span>Переслать коллегам</span>
                          </button>
                        </div>

                        {item.sharedWithCount && (
                          <div className="text-[9px] text-emerald-400 flex items-center gap-1 pt-0.5">
                            <Check className="w-3 h-3" />
                            <span>Переслано в команду ({item.sharedWithCount} чел.)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>

            {/* Status footer */}
            <div className="text-[11px] text-emerald-400 font-medium text-center shrink-0 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Секретарь доставляет реплики строго в ваш личный чат</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
