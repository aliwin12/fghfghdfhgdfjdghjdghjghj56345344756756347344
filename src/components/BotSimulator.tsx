import React, { useState } from 'react';
import { Send, Bot, User, CheckCircle, Clock, Zap, ArrowRight, Shield, RefreshCw, Copy, Trash2, FileText, Image, Mic, Briefcase, UserCheck } from 'lucide-react';

export const BotSimulator: React.FC = () => {
  const [mode, setMode] = useState<'business' | 'direct'>('business');
  const [userName, setUserName] = useState('Владимир');
  const [interlocutorName, setInterlocutorName] = useState('Алексей (Клиент)');
  const [currentSender, setCurrentSender] = useState<'interlocutor' | 'user'>('interlocutor');
  const [messageType, setMessageType] = useState<'text' | 'photo' | 'document' | 'voice'>('text');
  const [messageText, setMessageText] = useState('Здравствуйте! Отправляю коммерческое предложение по проекту.');

  const [chatHistory, setChatHistory] = useState<Array<{
    id: number;
    sender: 'interlocutor' | 'user' | 'bot_notice' | 'bot_copy_interlocutor' | 'bot_copy_user';
    type: 'text' | 'photo' | 'document' | 'voice' | 'system';
    content: string;
    caption?: string;
    senderName?: string;
    timestamp: string;
  }>>([
    {
      id: 1,
      sender: 'bot_notice',
      type: 'system',
      content: '🤖 Этим чатом управляет Персональный Секретарь Telegram. Все входящие и исходящие сообщения протоколируются и копируются.',
      timestamp: '14:19',
    },
    {
      id: 2,
      sender: 'interlocutor',
      type: 'text',
      content: 'Владимир, добрый день! Согласовали договор с юристами.',
      senderName: 'Алексей (Клиент)',
      timestamp: '14:20',
    },
    {
      id: 3,
      sender: 'bot_copy_interlocutor',
      type: 'text',
      content: 'Владимир, добрый день! Согласовали договор с юристами.',
      senderName: 'Алексей (Клиент)',
      timestamp: '14:20',
    },
    {
      id: 4,
      sender: 'user',
      type: 'text',
      content: 'Отлично, высылаю подписанную копию!',
      senderName: 'Вы (Владимир)',
      timestamp: '14:21',
    },
    {
      id: 5,
      sender: 'bot_copy_user',
      type: 'text',
      content: 'Отлично, высылаю подписанную копию!',
      senderName: 'Вы (Владимир)',
      timestamp: '14:21',
    },
  ]);

  const [logs, setLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = () => {
    if (!messageText && messageType === 'text') return;
    setIsSimulating(true);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const newMsgId = Date.now();
    const activeSenderName = currentSender === 'interlocutor' ? interlocutorName : `Вы (${userName})`;

    // Step 1: Add original message
    const origMsg = {
      id: newMsgId,
      sender: currentSender,
      type: messageType,
      content: messageText,
      caption: messageType === 'photo' ? messageText : undefined,
      senderName: activeSenderName,
      timestamp: timeStr,
    };

    setChatHistory((prev) => [...prev, origMsg]);
    setLogs([]);

    // Telemetry Step 1
    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [TELEGRAM_BUSINESS_UPDATE] Update: business_message (chat: 749102, sender: "${activeSenderName}")`,
      ]);
    }, 120);

    // Telemetry Step 2
    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [SECRETARY_COPY] copyMessage(chat_id, chat_id, ${newMsgId}, { business_connection_id: "bc_9410" })`,
      ]);
    }, 280);

    // Telemetry Step 3
    setTimeout(() => {
      const copyMsg = {
        id: newMsgId + 1,
        sender: currentSender === 'interlocutor' ? ('bot_copy_interlocutor' as const) : ('bot_copy_user' as const),
        type: messageType,
        content: messageText,
        caption: messageType === 'photo' ? messageText : undefined,
        senderName: activeSenderName,
        timestamp: timeStr,
      };

      setChatHistory((prev) => [...prev, copyMsg]);

      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [MESSAGE_COPIED] Сообщение ${currentSender === 'interlocutor' ? 'собеседника' : 'пользователя'} успешно скопировано в чат.`,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [STATELESS_PURGE] Память сервера очищена (0 байт в БД). Сообщение зафиксировано в Telegram.`,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [HTTP_200_OK] Webhook ACK отправлен за 16ms.`,
      ]);
      setIsSimulating(false);
    }, 500);
  };

  const clearChat = () => {
    setChatHistory([
      {
        id: Date.now(),
        sender: 'bot_notice',
        type: 'system',
        content: '🤖 Этим чатом управляет Персональный Секретарь Telegram. Все входящие и исходящие сообщения протоколируются и копируются.',
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
    setLogs([]);
  };

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-400" />
              Интерактивный симулятор: Режим Секретаря в чужих ЛС
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Бот в режиме Telegram Business перехватывает сообщения собеседника и самого пользователя, протоколирует их с пометкой управления чатом и моментально копирует.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setMode('business')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                mode === 'business'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Telegram Business (Чужие ЛС)
            </button>
            <button
              onClick={() => setMode('direct')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                mode === 'direct'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Прямой чат с ботом (DM)
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Parameters (Left Column) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              1. Выбор отправителя и текста
            </h3>
            <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              {mode === 'business' ? 'Telegram Business Режим' : 'Прямой DM'}
            </span>
          </div>

          {/* Sender Switcher */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Кто отправляет сообщение?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCurrentSender('interlocutor')}
                className={`py-2 px-3 text-xs rounded-xl font-medium transition flex items-center justify-center gap-2 border ${
                  currentSender === 'interlocutor'
                    ? 'bg-amber-600/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Собеседник (Клиент)</span>
              </button>
              <button
                onClick={() => setCurrentSender('user')}
                className={`py-2 px-3 text-xs rounded-xl font-medium transition flex items-center justify-center gap-2 border ${
                  currentSender === 'user'
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Вы (Владелец)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Имя собеседника</label>
              <input
                type="text"
                value={interlocutorName}
                onChange={(e) => setInterlocutorName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ваше имя</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Тип вложения / сообщения</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'text', label: 'Текст', icon: FileText },
                { id: 'photo', label: 'Фото', icon: Image },
                { id: 'document', label: 'Файл', icon: FileText },
                { id: 'voice', label: 'Голос', icon: Mic },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setMessageType(t.id as any)}
                    className={`py-1.5 px-2 text-xs rounded-lg font-medium transition flex items-center justify-center gap-1 ${
                      messageType === t.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Текст или реплика в диалоге
            </label>
            <textarea
              rows={3}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Введите текст сообщения..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-2">
            <button
              onClick={runSimulation}
              disabled={isSimulating}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition"
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Протоколирование и копирование...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Отправить от имени: {currentSender === 'interlocutor' ? interlocutorName : 'Вас'}</span>
                </>
              )}
            </button>

            <button
              onClick={clearChat}
              className="w-full py-1.5 text-slate-500 hover:text-slate-300 text-[11px] flex items-center justify-center gap-1 transition"
            >
              <Trash2 className="w-3 h-3" />
              <span>Очистить диалог</span>
            </button>
          </div>
        </div>

        {/* Output & Simulation Result (Right Column) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Telegram Personal Chat Mockup */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                  {interlocutorName.slice(0, 1)}
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{interlocutorName}</span>
                    <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-normal">
                      Чужое ЛС
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-400">Секретарь подключен • Stateless Mirror</div>
                </div>
              </div>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
                Telegram Business
              </span>
            </div>

            {/* Telegram Chat Feed */}
            <div className="bg-[#0f172a] rounded-2xl p-4 border border-slate-800 text-white text-xs space-y-3 min-h-[290px] max-h-[360px] overflow-y-auto shadow-inner">
              {chatHistory.map((item) => {
                if (item.type === 'system') {
                  return (
                    <div key={item.id} className="flex justify-center my-2">
                      <div className="bg-blue-950/80 border border-blue-500/30 text-blue-200 text-[11px] rounded-xl px-3 py-2 text-center max-w-[90%] shadow-md">
                        {item.content}
                      </div>
                    </div>
                  );
                }

                const isCopy = item.sender === 'bot_copy_interlocutor' || item.sender === 'bot_copy_user';
                const isUserSide = item.sender === 'user' || item.sender === 'bot_copy_user';

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col ${isUserSide ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-md ${
                        isUserSide
                          ? isCopy
                            ? 'bg-slate-800/90 text-blue-100 border border-blue-500/40 rounded-br-none'
                            : 'bg-blue-600 text-white rounded-br-none'
                          : isCopy
                          ? 'bg-slate-800 text-slate-100 border border-amber-500/40 rounded-bl-none'
                          : 'bg-slate-700/80 text-slate-100 rounded-bl-none'
                      }`}
                    >
                      {/* Sub-header for mirrored message */}
                      {isCopy && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold mb-1 text-emerald-400">
                          <Copy className="w-3 h-3" />
                          <span>
                            Копия секретаря (
                            {item.sender === 'bot_copy_interlocutor' ? 'Собеседник' : 'Пользователь'}
                            )
                          </span>
                        </div>
                      )}

                      {!isCopy && (
                        <div className="text-[10px] font-semibold text-slate-300/80 mb-0.5">
                          {item.senderName}
                        </div>
                      )}

                      {item.type === 'text' && (
                        <p className="whitespace-pre-wrap leading-relaxed">{item.content}</p>
                      )}

                      {item.type === 'photo' && (
                        <div className="space-y-1.5">
                          <div className="h-28 bg-slate-900/80 rounded-lg flex items-center justify-center border border-slate-700 text-slate-400 text-[11px] gap-2">
                            <Image className="w-5 h-5 text-blue-400" />
                            <span>[Фотография]</span>
                          </div>
                          {item.caption && <p className="text-[11px] leading-tight">{item.caption}</p>}
                        </div>
                      )}

                      {item.type === 'document' && (
                        <div className="flex items-center gap-2.5 bg-slate-900/60 p-2 rounded-lg border border-slate-700/50">
                          <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                          <div className="overflow-hidden">
                            <div className="font-semibold truncate text-[11px]">{item.content || 'Документ.pdf'}</div>
                            <div className="text-[9px] text-slate-400">1.4 MB • Документ</div>
                          </div>
                        </div>
                      )}

                      {item.type === 'voice' && (
                        <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-700/50 min-w-[180px]">
                          <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="flex-1">
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div className="w-2/3 h-full bg-emerald-400 rounded-full"></div>
                            </div>
                            <div className="text-[9px] text-slate-400 mt-1">Голосовое сообщение (0:14)</div>
                          </div>
                        </div>
                      )}

                      <div
                        className={`text-[9px] mt-1.5 text-right ${
                          isUserSide ? 'text-blue-200' : 'text-slate-400'
                        }`}
                      >
                        {item.timestamp}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Execution & Telemetry Log */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Telegram Business Secretary Telemetry (Stateless)
              </span>
              <span>Node.js v20.x</span>
            </div>

            <div className="bg-black rounded-xl p-3 font-mono text-[11px] text-slate-300 space-y-1.5 max-h-36 overflow-y-auto">
              {logs.length > 0 ? (
                logs.map((l, i) => (
                  <div key={i} className="leading-tight">
                    {l}
                  </div>
                ))
              ) : (
                <div className="text-slate-600 italic">Ожидание сообщений в чужих ЛС или прямом чате...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
