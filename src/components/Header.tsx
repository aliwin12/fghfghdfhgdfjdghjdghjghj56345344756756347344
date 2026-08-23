import React from 'react';
import { Bot, Zap, ShieldCheck, Terminal } from 'lucide-react';
import { BOT_TOKEN } from '../data/botFiles';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Personal Secretary Telegram Bot
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Zap className="w-3 h-3 mr-1" /> Stateless DM Mirror
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Секретарь для личных сообщений • Копирование сообщений • Zero Data Retention
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs text-slate-300 font-mono">
              <span className="text-slate-400 mr-2">Token:</span>
              <span className="text-blue-300 font-semibold truncate max-w-[170px] sm:max-w-[240px]">
                {BOT_TOKEN.slice(0, 10)}...{BOT_TOKEN.slice(-6)}
              </span>
              <span className="ml-2 flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 border-t border-slate-800/80 pt-2 pb-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'code', label: 'Код файлов (api/bot.js, vercel.json)', icon: Terminal },
            { id: 'webhook', label: 'Webhook Генератор & Активация', icon: Zap },
            { id: 'architecture', label: 'Serverless Архитектура & Stateless', icon: ShieldCheck },
            { id: 'simulator', label: 'Интерактивный симулятор бота', icon: Bot },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
