import React from 'react';
import { Zap, Shield, Cpu, RefreshCw, Database, CheckCircle, ArrowRight, Activity, Copy, EyeOff, Lock } from 'lucide-react';

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
              Архитектура Stateless Секретаря: Приватность и Zero Retention
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Бот работает по бессерверной модели: моментально обрабатывает входящие личные сообщения пользователя, выполняет нативное дублирование <code>copyMessage</code> в диалог Telegram и мгновенно завершает выполнение без сохранения данных в памяти или внешней БД.
            </p>
          </div>
        </div>
      </div>

      {/* 4 Architectural Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Direct Private DM Filtering */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">1. Строгий фильтр личных сообщений</h3>
                <span className="text-xs text-blue-400 font-mono">ctx.chat.type === 'private'</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Бот работает исключительно в режиме персонального секретаря. Группы, супергруппы и каналы игнорируются на ранней стадии обработки запроса:
            </p>

            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs text-slate-300 space-y-1.5 mb-4">
              <div className="text-blue-400 font-semibold">// Изоляция личного пространства:</div>
              <div className="text-slate-300">if (ctx.chat.type !== 'private') &#123;</div>
              <div className="pl-4 text-slate-400">return; // Никаких действий вне ЛС</div>
              <div className="text-slate-300">&#125;</div>
            </div>

            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Защита от случайного добавления бота в публичные чаты.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Исключительный фокус на персональном диалоге с пользователем.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Card 2: Native copyMessage Engine */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Copy className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">2. Нативный движок copyMessage</h3>
                <span className="text-xs text-amber-400 font-mono">Telegram Bot API copyMessage</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Вместо отправки текста вручную используется официальный метод <code>copyMessage</code>, который дублирует любые медиа, форматирование, стикеры и документы без ярлыка «Переслано»:
            </p>

            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs text-slate-300 space-y-1.5 mb-4">
              <div className="text-amber-400 font-semibold">// Точная копия в этот же чат:</div>
              <div className="text-slate-300">
                await ctx.telegram.copyMessage(chat.id, chat.id, message.message_id);
              </div>
            </div>

            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>Все форматы:</b> Текст, фото, видео, кружочки, аудио, документы, стикеры.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Копия сохраняется в истории чата Telegram навсегда.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Card 3: Zero Retention / Instant Forget */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <EyeOff className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">3. Zero Data Retention (Stateless)</h3>
                <span className="text-xs text-emerald-400 font-mono">Моментальное забывание</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Бот не использует базы данных (PostgreSQL, MongoDB, Redis) и не сохраняет историю в глобальных массивах:
            </p>

            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs text-slate-300 mb-4">
              <div className="text-emerald-400 font-semibold">// Мгновенное освобождение ресурсов:</div>
              <div className="text-slate-300">await bot.handleUpdate(req.body);</div>
              <div className="text-emerald-300 font-bold">res.status(200).end(); // Scope очищен</div>
            </div>

            <p className="text-xs text-slate-400">
              Как только вызов завершается, локальные переменные уничтожаются сборщиком мусора V8. Бот не оставляет никаких следов контента на сервере.
            </p>
          </div>
        </div>

        {/* Card 4: Lightning Fast Response */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">4. Мгновенная скорость отклика</h3>
                <span className="text-xs text-indigo-400 font-mono">15–40 мс время выполнения</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Благодаря отсутствию дисковых операций и обращений к сторонним СУБД, копирование происходит практически без задержки:
            </p>

            <div className="space-y-1.5 font-mono text-[11px] mb-4">
              <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-blue-300">
                [SECRETARY_RECV] Получено личное сообщение
              </div>
              <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-emerald-300">
                [SECRETARY_COPIED] Сообщение продублировано за 18ms
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Пользователь получает надежный дубликат сообщения в реальном времени с минимальным потреблением трафика.
            </p>
          </div>
        </div>
      </div>

      {/* Visual Workflow Diagram */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-blue-400" />
          Жизненный цикл сообщения личного секретаря
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          {/* Step 1 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Шаг 1</div>
            <div className="font-semibold text-white text-xs mb-1">Пользователь пишет в ЛС</div>
            <div className="text-[11px] text-slate-400">Текст, фото, голос, файл</div>
          </div>

          <div className="flex justify-center text-slate-600 md:rotate-0 rotate-90">
            <ArrowRight className="w-5 h-5 text-blue-400" />
          </div>

          {/* Step 2 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/30 text-center shadow-lg shadow-blue-500/5">
            <div className="text-[10px] font-bold uppercase text-blue-400 mb-1">Шаг 2</div>
            <div className="font-semibold text-white text-xs mb-1">Serverless Function</div>
            <div className="text-[11px] text-slate-400">copyMessage(chat.id, chat.id)</div>
          </div>

          <div className="flex justify-center text-slate-600 md:rotate-0 rotate-90">
            <ArrowRight className="w-5 h-5 text-blue-400" />
          </div>

          {/* Step 3 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 text-center shadow-lg shadow-emerald-500/5">
            <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1">Шаг 3</div>
            <div className="font-semibold text-white text-xs mb-1">Копия создана & Очистка</div>
            <div className="text-[11px] text-slate-400">Сообщение в чате, память: 0 KB</div>
          </div>
        </div>
      </div>
    </div>
  );
};
