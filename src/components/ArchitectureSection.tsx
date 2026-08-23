import React from 'react';
import { Zap, Cpu, RefreshCw, CheckCircle, ArrowRight, Copy, EyeOff, Lock, UserCheck, ShieldCheck } from 'lucide-react';

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
              Архитектура: Приватное протоколирование в ваш личный чат с Ботом
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Бот перехватывает сообщения из диалогов с собеседниками через Telegram Business. При этом в чатах с клиентами <b>нет спама</b>, а подробный протокол с автором, ID, временем и точной копией реплики моментально пересылается <b>в ваш личный чат с Ботом</b>.
            </p>
          </div>
        </div>
      </div>

      {/* 4 Architectural Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Forwarding to Owner DM */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">1. Пересылка в ЛС владельца с ботом</h3>
                <span className="text-xs text-blue-400 font-mono">Owner DM Target Routing</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Бот не пишет в чат с клиентом или собеседником, чтобы не засорять переписку. Все входящие и исходящие реплики аккуратно направляются в ваш приватный диалог с ботом:
            </p>

            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs text-slate-300 space-y-1 mb-4">
              <div className="text-blue-400 font-semibold">// Отправка протокола и копии владельцу:</div>
              <div className="text-slate-300">await ctx.telegram.sendMessage(ownerId, protocolCard);</div>
              <div className="text-slate-300">await ctx.telegram.copyMessage(ownerId, fromChatId, msgId);</div>
            </div>

            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Чат с собеседником остается на 100% чистым и естественным.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>У вас всегда под рукой единый журнал всех переписок.</span>
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
                <h3 className="text-base font-bold text-white">2. Полные метаданные + Нативная копия</h3>
                <span className="text-xs text-amber-400 font-mono">Metadata Card + copyMessage</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Перед каждым скопированным сообщением бот отправляет карточку с именем, фамилией, никнеймом, Telegram ID, датой и названием диалога:
            </p>

            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs text-slate-300 space-y-1 mb-4">
              <div className="text-amber-400 font-semibold">// Карточка протокола:</div>
              <div className="text-slate-300">👤 Кто написал: Алексей Смирнов (@alex_client)</div>
              <div className="text-slate-300">🆔 ID автора: 512940182 | 📅 Время: 14:20 (МСК)</div>
            </div>

            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>Все форматы:</b> Текст, фото, видео, кружочки, аудио, документы, стикеры.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Сохраняются даже удаленные собеседником реплики.</span>
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
              Бот не использует внешние базы данных и не сохраняет историю переписок на серверах:
            </p>

            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs text-slate-300 mb-4">
              <div className="text-emerald-400 font-semibold">// Мгновенное освобождение ресурсов:</div>
              <div className="text-slate-300">await bot.handleUpdate(req.body);</div>
              <div className="text-emerald-300 font-bold">res.status(200).end(); // Scope очищен</div>
            </div>

            <p className="text-xs text-slate-400">
              Вся переписка хранится исключительно внутри защищенной инфраструктуры Telegram в вашем личном чате.
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
                <h3 className="text-base font-bold text-white">4. Мгновенная скорость пересылки</h3>
                <span className="text-xs text-indigo-400 font-mono">15–40 мс время выполнения</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Благодаря Serverless-обработке сообщение пересылается в диалог с ботом буквально в ту же секунду:
            </p>

            <div className="space-y-1.5 font-mono text-[11px] mb-4">
              <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-blue-300">
                [BUSINESS_MSG_RECV] Сообщение в чате с клиентом
              </div>
              <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-emerald-300">
                [FORWARDED_TO_OWNER] Протокол + копия в ЛС с ботом за 16ms
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Полный контроль над всеми диалогами в одном приватном чате.
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
            <div className="font-semibold text-white text-xs mb-1">Сообщение в чужом ЛС</div>
            <div className="text-[11px] text-slate-400">Клиент пишет вам или вы клиенту</div>
          </div>

          <div className="flex justify-center text-slate-600 md:rotate-0 rotate-90">
            <ArrowRight className="w-5 h-5 text-blue-400" />
          </div>

          {/* Step 2 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/30 text-center shadow-lg shadow-blue-500/5">
            <div className="text-[10px] font-bold uppercase text-blue-400 mb-1">Шаг 2</div>
            <div className="font-semibold text-white text-xs mb-1">Serverless Перехват</div>
            <div className="text-[11px] text-slate-400">Чат клиента не трогаем</div>
          </div>

          <div className="flex justify-center text-slate-600 md:rotate-0 rotate-90">
            <ArrowRight className="w-5 h-5 text-blue-400" />
          </div>

          {/* Step 3 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 text-center shadow-lg shadow-emerald-500/5">
            <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1">Шаг 3</div>
            <div className="font-semibold text-white text-xs mb-1">Доставка в ЛС с Ботом</div>
            <div className="text-[11px] text-slate-400">Протокол + копия у вас в ЛС</div>
          </div>
        </div>
      </div>
    </div>
  );
};
