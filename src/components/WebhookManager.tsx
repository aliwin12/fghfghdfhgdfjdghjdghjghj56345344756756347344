import React, { useState } from 'react';
import { Globe, Link2, Copy, Check, ExternalLink, RefreshCw, Send, CheckCircle2, AlertTriangle, Terminal, ShieldCheck } from 'lucide-react';
import { BOT_TOKEN, DEFAULT_APP_DOMAIN } from '../data/botFiles';

export const WebhookManager: React.FC = () => {
  const [domain, setDomain] = useState<string>(DEFAULT_APP_DOMAIN);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string; raw?: any }>({
    status: 'idle',
    message: '',
  });

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const webhookUrl = `https://${cleanDomain}/api/bot`;
  const setWebhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
  const getWebhookInfoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
  const deleteWebhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`;
  const getMeUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestPing = async (apiUrl: string, label: string) => {
    setTestResult({ status: 'loading', message: `Отправка запроса в Telegram API (${label})...` });
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      if (data.ok) {
        setTestResult({
          status: 'success',
          message: `Telegram API ответил успехом (HTTP 200 OK)`,
          raw: data,
        });
      } else {
        setTestResult({
          status: 'error',
          message: `Ошибка Telegram API: ${data.description || 'Неизвестная ошибка'}`,
          raw: data,
        });
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: `Браузер заблокировал прямой CORS-запрос к api.telegram.org. Вы можете открыть ссылку напрямую в новой вкладке браузера: ${apiUrl}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Domain configurator */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              Генератор Webhook ссылок для Telegram
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Укажите домен вашего развернутого сервера для генерации рабочих команд и ссылок активации.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              Bot Token: {BOT_TOKEN.slice(0, 10)}...
            </span>
          </div>
        </div>

        {/* Input form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Ваш рабочий домен сервера
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-xs font-mono">
                https://
              </div>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="universal-logger-bot.app"
                className="w-full pl-20 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Пример: <code className="text-slate-400">universal-logger-bot.app</code> или ваш кастомный домен.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Целевой эндпоинт Webhook
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-emerald-400 text-sm font-mono select-all focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(webhookUrl, 'webhookUrl')}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition"
                title="Скопировать Webhook URL"
              >
                {copiedKey === 'webhookUrl' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Этот адрес обрабатывается функцией <code className="text-slate-400">api/bot.js</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Generated Webhook Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* setWebhook Card */}
        <div className="bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 shadow-lg transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                  POST
                </div>
                <h3 className="text-sm font-bold text-white">1. setWebhook (Активация)</h3>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                Главная команда
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Регистрирует ваш домен в Telegram. Все события групп начнут поступать на ваш сервер.
            </p>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 break-all mb-4 select-all">
              {setWebhookUrl}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <a
              href={setWebhookUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-blue-500/20"
            >
              <span>Открыть в браузере</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => copyToClipboard(setWebhookUrl, 'setWebhook')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition"
            >
              {copiedKey === 'setWebhook' ? 'Скопировано!' : 'Копировать'}
            </button>
          </div>
        </div>

        {/* getWebhookInfo Card */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                  GET
                </div>
                <h3 className="text-sm font-bold text-white">2. getWebhookInfo (Диагностика)</h3>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                Проверка статуса
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Показывает текущий URL вебхука, ошибки доставки (если сервер возвращал 500) и количество ожидающих сообщений.
            </p>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 break-all mb-4 select-all">
              {getWebhookInfoUrl}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <a
              href={getWebhookInfoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition"
            >
              <span>Проверить статус</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => copyToClipboard(getWebhookInfoUrl, 'getWebhookInfo')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition"
            >
              {copiedKey === 'getWebhookInfo' ? 'Скопировано!' : 'Копировать'}
            </button>
          </div>
        </div>

        {/* getMe Card */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                  GET
                </div>
                <h3 className="text-sm font-bold text-white">3. getMe (Валидация токена)</h3>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                Инфо о боте
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Проверяет валидность токена бота, имя и username бота в Telegram.
            </p>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 break-all mb-4 select-all">
              {getMeUrl}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <a
              href={getMeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition"
            >
              <span>Проверить getMe</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => copyToClipboard(getMeUrl, 'getMe')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition"
            >
              {copiedKey === 'getMe' ? 'Скопировано!' : 'Копировать'}
            </button>
          </div>
        </div>

        {/* deleteWebhook Card */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold text-xs">
                  DEL
                </div>
                <h3 className="text-sm font-bold text-white">4. deleteWebhook (Сброс)</h3>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400">
                Сброс вебхука
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Удаляет зарегистрированный вебхук (полезно, если вы захотите временно запустить бота локально через Polling).
            </p>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 break-all mb-4 select-all">
              {deleteWebhookUrl}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <a
              href={deleteWebhookUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-950/40 text-rose-300 text-xs font-semibold rounded-xl border border-rose-900/50 transition"
            >
              <span>Сбросить Webhook</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => copyToClipboard(deleteWebhookUrl, 'deleteWebhook')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition"
            >
              {copiedKey === 'deleteWebhook' ? 'Скопировано!' : 'Копировать'}
            </button>
          </div>
        </div>
      </div>

      {/* Terminal / cURL Reference */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-emerald-400" />
          Вызов через Терминал (cURL)
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Если вы предпочитаете активировать вебхук через терминал Linux/macOS/PowerShell:
        </p>

        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 font-mono text-xs text-slate-200 relative group">
          <code>
            curl -F &quot;url={webhookUrl}&quot; -F &quot;drop_pending_updates=true&quot; https://api.telegram.org/bot{BOT_TOKEN}/setWebhook
          </code>
          <button
            onClick={() =>
              copyToClipboard(
                `curl -F "url=${webhookUrl}" -F "drop_pending_updates=true" https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
                'curlCmd'
              )
            }
            className="absolute top-3 right-3 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition"
          >
            {copiedKey === 'curlCmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
