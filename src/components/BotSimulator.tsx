import React, { useState } from 'react';
import { Send, Bot, User, CheckCircle, Clock, Zap, ArrowRight, Shield, RefreshCw, Copy, Trash2, FileText, Image, Mic } from 'lucide-react';

export const BotSimulator: React.FC = () => {
  const [userName, setUserName] = useState('Владимир');
  const [userId, setUserId] = useState('849201948');
  const [messageType, setMessageType] = useState<'text' | 'photo' | 'document' | 'voice'>('text');
  const [messageText, setMessageText] = useState('Купить билеты в командировку на вторник, номер рейса SU-1420 в 11:30.');

  const [chatHistory, setChatHistory] = useState<Array<{
    id: number;
    sender: 'user' | 'bot_copy';
    type: 'text' | 'photo' | 'document' | 'voice';
    content: string;
    caption?: string;
    timestamp: string;
  }>>([
    {
      id: 1,
      sender: 'user',
      type: 'text',
      content: 'Презентация для клиента и список тезисов',
      timestamp: '14:20',
    },
    {
      id: 2,
      sender: 'bot_copy',
      type: 'text',
      content: 'Презентация для клиента и список тезисов',
      timestamp: '14:20',
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

    // Add user original message to chat
    const userMsg = {
      id: newMsgId,
      sender: 'user' as const,
      type: messageType,
      content: messageText,
      caption: messageType === 'photo' ? messageText : undefined,
      timestamp: timeStr,
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setLogs([]);

    // Step 1: Webhook received
    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [TELEGRAM_POST] Входящий POST запрос на /api/bot (chat.type = "private", user_id = ${userId})`,
      ]);
    }, 120);

    // Step 2: copyMessage execution
    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [SECRETARY_EXEC] Вызов copyMessage(${userId}, ${userId}, ${newMsgId}) -> Точное дублирование контента`,
      ]);
    }, 280);

    // Step 3: Mirror in chat + purge memory
    setTimeout(() => {
      const copyMsg = {
        id: newMsgId + 1,
        sender: 'bot_copy' as const,
        type: messageType,
        content: messageText,
        caption: messageType === 'photo' ? messageText : undefined,
        timestamp: timeStr,
      };

      setChatHistory((prev) => [...prev, copyMsg]);

      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [MESSAGE_COPIED] Сообщение продублировано в чат. Сохранено в истории Telegram.`,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [STATELESS_PURGE] 0 байт сохранено в базе данных. Память освобождена (Бот моментально забыл сообщение).`,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [HTTP_FINISH] res.status(200).end() выполнен за 19ms. Контекст Serverless закрыт.`,
      ]);
      setIsSimulating(false);
    }, 500);
  };

  const clearChat = () => {
    setChatHistory([]);
    setLogs([]);
  };

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-400" />
          Интерактивный симулятор Персонального Секретаря
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Отправьте любое сообщение в симулируемый личный диалог. Бот-секретарь создаст точную копию в чате и сразу освободит память (Stateless).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Parameters (Left Column) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              1. Отправка личного сообщения
            </h3>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Private Chat (ЛС)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Имя пользователя</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Telegram User ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
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
              {messageType === 'text' && 'Текст заметки или мысли'}
              {messageType === 'photo' && 'Подпись к фотографии'}
              {messageType === 'document' && 'Название прикрепляемого документа'}
              {messageType === 'voice' && 'Транскрипция голосового сообщения'}
            </label>
            <textarea
              rows={3}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Введите текст сообщения для секретаря..."
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
                  <span>Копирование сообщения...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Отправить в ЛС боту-секретарю</span>
                </>
              )}
            </button>

            <button
              onClick={clearChat}
              className="w-full py-1.5 text-slate-500 hover:text-slate-300 text-[11px] flex items-center justify-center gap-1 transition"
            >
              <Trash2 className="w-3 h-3" />
              <span>Очистить историю диалога</span>
            </button>
          </div>
        </div>

        {/* Output & Simulation Result (Right Column) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Telegram Personal Chat Mockup */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                  💼
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Персональный Секретарь</div>
                  <div className="text-[10px] text-emerald-400">bot • всегда онлайн (Stateless)</div>
                </div>
              </div>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
                Диалог с @{userName.toLowerCase()}_bot
              </span>
            </div>

            {/* Telegram Chat Feed */}
            <div className="bg-[#0f172a] rounded-2xl p-4 border border-slate-800 text-white text-xs space-y-3 min-h-[260px] max-h-[340px] overflow-y-auto shadow-inner">
              {chatHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Bot className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                  <p className="text-xs">Диалог пуст. Отправьте сообщение, чтобы проверить работу секретаря.</p>
                </div>
              ) : (
                chatHistory.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col ${
                      item.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-md ${
                        item.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-bl-none'
                      }`}
                    >
                      {item.sender === 'bot_copy' && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 mb-1">
                          <Copy className="w-3 h-3" />
                          <span>Копия секретаря (copyMessage)</span>
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
                          item.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
                        }`}
                      >
                        {item.timestamp}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Execution & Telemetry Log */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Serverless Secretary Telemetry (Stateless)
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
                <div className="text-slate-600 italic">Ожидание входящего сообщения в ЛС...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
