import React, { useState } from 'react';
import { Header } from './components/Header';
import { FileViewer } from './components/FileViewer';
import { WebhookManager } from './components/WebhookManager';
import { ArchitectureSection } from './components/ArchitectureSection';
import { BotSimulator } from './components/BotSimulator';
import { Terminal, ArrowRight } from 'lucide-react';
import { BOT_TOKEN } from './data/botFiles';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('code');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Active Tab View */}
        {activeTab === 'code' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-blue-400" />
                  Готовый исходный код проекта
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Все файлы содержат ваш актуальный токен бота <code className="text-blue-300 font-mono">{BOT_TOKEN}</code>.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('webhook')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-blue-500/20"
              >
                <span>Перейти к Webhook</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <FileViewer />
          </div>
        )}

        {activeTab === 'webhook' && <WebhookManager />}

        {activeTab === 'architecture' && <ArchitectureSection />}

        {activeTab === 'simulator' && <BotSimulator />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <span>Serverless Architecture • Telegraf Node.js Engine</span>
          </div>
          <div className="text-slate-400 font-mono">
            Токен бота: {BOT_TOKEN.slice(0, 10)}...{BOT_TOKEN.slice(-6)}
          </div>
        </div>
      </footer>
    </div>
  );
}
