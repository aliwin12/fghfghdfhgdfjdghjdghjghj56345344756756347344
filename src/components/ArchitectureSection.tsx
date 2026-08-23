import React from 'react';
import { Zap, Server, Shield, Cpu, RefreshCw, AlertCircle, Database, CheckCircle, ArrowRight, Activity, Terminal } from 'lucide-react';

export const ArchitectureSection: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Intro Banner */}
      <div className="bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-slate-900 border border-blue-500/20 rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Cpu className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Архитектура Serverless & Stateless: Инженерные решения и оптимизации
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Облачная бессерверная платформа запускает Node.js код в виде изолированных контейнеров (Micro-VMs / Cloud Edge).
              Для стабильной и быстрой работы Telegram-бота применен ряд критически важных архитектурных паттернов.
            </p>
          </div>
        </div>
      </div>

      {/* 4 Architectural Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Cold Starts & Execution Limits */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">1. Оптимизация Холодного Старта (Cold Starts)</h3>
                <span className="text-xs text-amber-400 font-mono">Global Scope vs Handler Scope</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              При неактивности облачная платформа усыпляет лямбда-функцию. Первый входящий запрос будит её («Холодный старт» ~150-250 мс).
            </p>

            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs text-slate-300 space-y-2 mb-4">
              <div className="text-emerald-400 font-semibold">// Правильно (Наш код):</div>
              <div className="text-slate-400">
                const bot = new Telegraf(BOT_TOKEN); <span className="text-slate-500">// Выполняется 1 раз</span>
              </div>
              <div className="text-slate-300">
                module.exports = async (req, res) =&gt; &#123;
                <div className="pl-4 text-slate-400">await bot.handleUpdate(req.body);</div>
                &#125;;
              </div>
            </div>

            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Экземпляр бота и кэш админов сохраняются в оперативной памяти между прогретыми вызовами.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Время выполнения повторных вызовов составляет всего <b>15–35 мс</b>.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Card 2: Stateless Group-to-Admin Resolution */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">2. Stateless Связка «Группа ➔ Админ»</h3>
                <span className="text-xs text-blue-400 font-mono">Без внешних БД (Redis/Postgres)</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Вместо хранения базы данных с привязками групп мы используем нативный API Telegram:
            </p>

            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs text-slate-300 space-y-1.5 mb-4">
              <div className="text-blue-400 font-semibold">// Динамический резолвер админов "на лету":</div>
              <div className="text-slate-300">
                const admins = await bot.telegram.getChatAdministrators(chat.id);
              </div>
              <div className="text-slate-400">
                const humanAdmins = admins.filter(a =&gt; !a.user.is_bot);
              </div>
            </div>

            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>100% Универсальность:</b> Любой пользователь добавляет бота в группу, и логи идут сразу ему.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>In-Memory Map Cache (TTL 5 мин):</b> Исключает лишние сетевые запросы при частых сообщениях.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Card 3: Instant 200 OK & Retry Storm Prevention */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">3. Гарантированный HTTP 200 OK</h3>
                <span className="text-xs text-emerald-400 font-mono">Защита от Telegram Retry Storm</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Если сервер не отвечает за 5 секунд или возвращает ошибку 500, Telegram начинает лавинообразно слать повторные запросы (до сотен раз в минуту), что может перегрузить инфраструктуру!
            </p>

            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs text-slate-300 mb-4">
              <div className="text-emerald-400 font-semibold">// Блок finally завершает функцию мгновенно:</div>
              <div className="text-slate-300">try &#123; await bot.handleUpdate(req.body); &#125;</div>
              <div className="text-emerald-300 font-bold">finally &#123; res.status(200).end(); &#125;</div>
            </div>

            <p className="text-xs text-slate-400">
              Это гарантирует, что Telegram моментально получает подтверждение о доставке, а среда не удерживает поток в памяти.
            </p>
          </div>
        </div>

        {/* Card 4: Realtime Logs Debugging */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">4. Мониторинг и Runtime Logs</h3>
                <span className="text-xs text-indigo-400 font-mono">Отладка и аудит в реальном времени</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Для удобной диагностики в коде используются структурированные теги:
            </p>

            <div className="space-y-1.5 font-mono text-[11px] mb-4">
              <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-blue-300">
                [GROUP_EVENT] Получено событие из группы "Dev Team"
              </div>
              <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-emerald-300">
                [LOG_SENT] Лог успешно отправлен админу ID: 987654321
              </div>
              <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-amber-300">
                [FORBIDDEN] Админ не запустил бота в ЛС (/start)
              </div>
            </div>

            <p className="text-xs text-slate-400">
              В панели хостинга перейдите во вкладку <b>Logs</b> и введите <code className="text-slate-300">[GROUP_EVENT]</code> для мгновенного просмотра активности.
            </p>
          </div>
        </div>
      </div>

      {/* Visual Workflow Diagram */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-blue-400" />
          Полный цикл обработки события (Архитектурная схема)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          {/* Step 1 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Шаг 1</div>
            <div className="font-semibold text-white text-xs mb-1">Пользователь пишет в группе</div>
            <div className="text-[11px] text-slate-400">Сообщение / фото / стикер</div>
          </div>

          <div className="flex justify-center text-slate-600 md:rotate-0 rotate-90">
            <ArrowRight className="w-5 h-5 text-blue-400" />
          </div>

          {/* Step 2 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/30 text-center shadow-lg shadow-blue-500/5">
            <div className="text-[10px] font-bold uppercase text-blue-400 mb-1">Шаг 2</div>
            <div className="font-semibold text-white text-xs mb-1">Serverless Function</div>
            <div className="text-[11px] text-slate-400">api/bot.js получает POST Webhook</div>
          </div>

          <div className="flex justify-center text-slate-600 md:rotate-0 rotate-90">
            <ArrowRight className="w-5 h-5 text-blue-400" />
          </div>

          {/* Step 3 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 text-center shadow-lg shadow-emerald-500/5">
            <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1">Шаг 3</div>
            <div className="font-semibold text-white text-xs mb-1">Рассылка админам</div>
            <div className="text-[11px] text-slate-400">Чат-админы получают лог в ЛС</div>
          </div>
        </div>
      </div>
    </div>
  );
};
