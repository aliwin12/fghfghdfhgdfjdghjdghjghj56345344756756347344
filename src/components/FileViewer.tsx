import React, { useState } from 'react';
import { Copy, Check, FileCode, Download, ExternalLink, ShieldAlert, Sparkles } from 'lucide-react';
import { BOT_FILES } from '../data/botFiles';

export const FileViewer: React.FC = () => {
  const [selectedFileName, setSelectedFileName] = useState<string>('api/bot.js');
  const [copiedMap, setCopiedMap] = useState<{ [key: string]: boolean }>({});

  const currentFile = BOT_FILES.find((f) => f.path === selectedFileName) || BOT_FILES[0];

  const handleCopy = (path: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMap((prev) => ({ ...prev, [path]: true }));
    setTimeout(() => {
      setCopiedMap((prev) => ({ ...prev, [path]: false }));
    }, 2000);
  };

  const handleDownload = (filename: string, content: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename.split('/').pop() || 'file.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Top bar with file tabs */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {BOT_FILES.map((file) => {
            const isSelected = file.path === selectedFileName;
            return (
              <button
                key={file.path}
                onClick={() => setSelectedFileName(file.path)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  isSelected
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{file.name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownload(currentFile.name, currentFile.content)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Скачать файл</span>
          </button>
          <button
            onClick={() => handleCopy(currentFile.path, currentFile.content)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-300 hover:text-white bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 rounded-lg font-medium transition"
          >
            {copiedMap[currentFile.path] ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Скопировано!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-blue-400" />
                <span>Скопировать код</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Description Header */}
      <div className="px-6 py-3.5 bg-slate-900/90 border-b border-slate-800/80 flex items-start gap-3 text-xs text-slate-300">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">{currentFile.path}</span> — {currentFile.description}
        </div>
      </div>

      {/* Code Editor Body */}
      <div className="relative bg-slate-950/90 p-4 sm:p-6 overflow-x-auto max-h-[580px] font-mono text-xs sm:text-sm leading-relaxed text-slate-300">
        <pre className="text-slate-200">
          <code>{currentFile.content}</code>
        </pre>
      </div>

      {/* Footer Info */}
      <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Оптимизировано под Serverless Functions (Node.js 18+)</span>
        </div>
        <div className="text-slate-500 font-mono">
          Строк: {currentFile.content.split('\n').length} | Размер: {(currentFile.content.length / 1024).toFixed(1)} KB
        </div>
      </div>
    </div>
  );
};
