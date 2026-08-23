import React, { useState } from 'react';
import { Send, Bot, User, CheckCircle, Clock, Zap, ArrowRight, Shield, RefreshCw } from 'lucide-react';

export const BotSimulator: React.FC = () => {
  const [groupName, setGroupName] = useState('Frontend & DevOps Chat');
  const [senderName, setSenderName] = useState('Алексей Смирнов');
  const [senderUsername, setSenderUsername] = useState('alex_dev');
  const [adminName, setAdminName] = useState('Дмитрий (Владелец группы)');
  const [adminId, setAdminId] = useState('512948192');
  const [messageType, setMessageType] = useState<'text' | 'photo' | 'document' | 'voice'>('text');
  const [messageText, setMessageText] = useState('Коллеги, задеплоил новую версию бота на Serverless архитектуре! Все работает мгновенно.');

  const [logs, setLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedAdminNotification, setSimulatedAdminNotification] = useState<string | null>(null);

  const runSimulation = () => {
    setIsSimulating(true);
    setLogs([]);
    setSimulatedAdminNotification(null);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow' });

    // Step 1: Webhook received
    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [TELEGRAM_POST] Входящий POST запрос на /api/bot (UpdateID: 849201948)`,
      ]);
    }, 150);

    // Step 2: Resolve Admins
    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [ADMIN_RESOLVE] Вызов bot.telegram.getChatAdministrators(-1001928374) -> Найден админ ID: ${adminId} (${adminName})`,
      ]);
    }, 350);

    // Step 3: Format & Dispatch
    setTimeout(() => {
      let content = messageText;
      let typeLabel = '💬 Сообщение';
      if (messageType === 'photo') {
        typeLabel = '📸 Фотография';
        content = `[Фото]: ${messageText}`;
      } else if (messageType === 'document') {
        typeLabel = '📁 Документ/Файл';
        content = `archive_build_v2.zip (4.8 MB)`;
      } else if (messageType === 'voice') {
        typeLabel = '🎤 Голосовое сообщение';
        content = `Длительность: 14 сек.`;
      }

      const formattedHtml =
        `🔔 <b>[ЛОГ ГРУППЫ]</b> <i>(${timeStr} МСК)</i>\n\n` +
        `👥 <b>Группа:</b> ${groupName} (@devops_chat)\n` +
        `👤 <b>Отправитель:</b> ${senderName} (@${senderUsername})\n` +
        `📌 <b>Тип:</b> ${typeLabel}\n` +
        `📝 <b>Содержимое:</b>\n<code>${content}</code>`;

      setSimulatedAdminNotification(formattedHtml);

      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [LOG_SENT] Успешно отправлен HTML-лог в ЛС администратору ${adminId}`,
        `[${new Date().toISOString().split('T')[1].slice(0, 8)}] [HTTP_FINISH] res.status(200).end() выполнен за 24ms. Контекст Serverless закрыт.`,
      ]);
      setIsSimulating(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-400" />
          Интерактивный симулятор обработки событий
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Проверьте, как работает алгоритм перехвата сообщений из группы и мгновенной пересылки логов администратору в ЛС.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Parameters (Left Column) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            1. Параметры события группы
          </h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Название группы</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Имя автора</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Username автора</label>
              <input
                type="text"
                value={senderUsername}
                onChange={(e) => setSenderUsername(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Тип сообщения</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'text', label: 'Текст' },
                { id: 'photo', label: 'Фото' },
                { id: 'document', label: 'Файл' },
                { id: 'voice', label: 'Голос' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMessageType(t.id as any)}
                  className={`py-1.5 text-xs rounded-lg font-medium transition ${
                    messageType === t.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Текст сообщения в чате</label>
            <textarea
              rows={2}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={runSimulation}
              disabled={isSimulating}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition"
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Обработка вебхука...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Отправить событие в Webhook</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output & Simulation Result (Right Column) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Telegram Admin Chat Mockup */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  🤖
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Universal Logger Bot</div>
                  <div className="text-[10px] text-emerald-400">Личные сообщения админа ({adminName})</div>
                </div>
              </div>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
                Chat ID: {adminId}
              </span>
            </div>

            {/* Telegram Message Bubble */}
            <div className="bg-[#182533] rounded-2xl p-4 border border-[#243447] text-white text-xs space-y-2 shadow-inner">
              {simulatedAdminNotification ? (
                <div
                  className="space-y-1 leading-relaxed font-sans"
                  dangerouslySetInnerHTML={{ __html: simulatedAdminNotification.replace(/\n/g, '<br/>') }}
                />
              ) : (
                <div className="text-center py-6 text-slate-400">
                  <Bot className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p className="text-xs">Нажмите «Отправить событие в Webhook», чтобы увидеть сгенерированное уведомление.</p>
                </div>
              )}
            </div>
          </div>

          {/* Execution & Telemetry Log */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Serverless Execution Telemetry
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
                <div className="text-slate-600 italic">Ожидание входящего события Webhook...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
