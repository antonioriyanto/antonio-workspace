import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, ArrowRight, Loader2, Key, HelpCircle, Check, AlertCircle } from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { parseConversationalTask } from '../services/aiTaskService';
import { getTodayIso } from '../utils/dateUtils';

const EXAMPLE_PROMPTS = [
  'tolong bikin task baru pic bu evy kartu ucapan deadline cetak lusa hari ini preview dlu',
  'desain pop promo opening wtc sorong deadline jumat depan pic itho urgent',
  'shopping bag lipat packaging pic ica acc vendor deadline lusa',
  'videotron update materi wtc bogor pic ica deadline besok'
];

export const AIPromptBar: React.FC = () => {
  const {
    isAiPromptOpen,
    closeAiPrompt,
    pics,
    categories,
    stores,
    openTaskModal,
    addToast,
    geminiApiKey,
    setGeminiApiKey
  } = useWorkspaceStore();

  const [promptText, setPromptText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isAiPromptOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setTempKey(geminiApiKey);
      setShowKeyInput(!geminiApiKey);
      setErrorMessage(null);
    }
  }, [isAiPromptOpen, geminiApiKey]);

  if (!isAiPromptOpen) return null;

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempKey.trim()) return;
    setGeminiApiKey(tempKey.trim());
    setSavedKeySuccess(true);
    setTimeout(() => {
      setSavedKeySuccess(false);
      setShowKeyInput(false);
    }, 1200);
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptText.trim()) return;

    if (!geminiApiKey && !tempKey.trim()) {
      setShowKeyInput(true);
      addToast('Masukkan API Key Gemini terlebih dahulu', 'error');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      const todayIso = getTodayIso();
      const parsed = await parseConversationalTask(
        promptText,
        {
          pics,
          categories,
          stores,
          todayIso
        },
        geminiApiKey || tempKey.trim()
      );

      // Successfully parsed: close AI bar and open TaskModal with parsed data
      closeAiPrompt();
      setPromptText('');
      setErrorMessage(null);
      openTaskModal(null, parsed);
      addToast('✨ Task berhasil dianalisis AI! Silakan tinjau sebelum disimpan.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses prompt dengan AI';
      setErrorMessage(msg);
      addToast(msg.length > 80 ? msg.slice(0, 80) + '...' : msg, 'error');
      if (msg.includes('API Key')) {
        setShowKeyInput(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) closeAiPrompt();
      }}
    >
      <div className="glass-panel bg-white/95 dark:bg-[#0e0e12]/95 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500/20 via-purple-500/20 to-blue-500/20 text-blue-500 dark:text-blue-400 flex items-center justify-center border border-blue-500/30 shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  Conversational AI Task Creator
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
                  Gemini Flash
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Ketik instruksi tugas harian dalam bahasa percakapan sehari-hari
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowKeyInput(prev => !prev)}
              className={`p-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                showKeyInput || !geminiApiKey
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'glass-control text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
              title="Atur API Key Gemini"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">API Key</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={closeAiPrompt}
              className="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* API Key Panel (Collapsible) */}
        {showKeyInput && (
          <div className="px-5 py-3 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/60 animate-in slide-in-from-top-1">
            <form onSubmit={handleSaveApiKey} className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>Google Gemini API Key</span>
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-500 hover:underline flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Dapatkan Key Gratis di Google AI Studio</span>
                </a>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium text-xs flex items-center gap-1 shadow-sm"
                >
                  {savedKeySuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tersimpan</span>
                    </>
                  ) : (
                    <span>Simpan Key</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Prompt Input Form */}
        <div className="p-5 space-y-4">
          <div className="relative">
            <textarea
              ref={inputRef}
              rows={4}
              value={promptText}
              disabled={isLoading}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Contoh: tolong bikin task baru pic bu evy kartu ucapan deadline cetak lusa hari ini preview dlu..."
              className="w-full p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 resize-none transition shadow-inner leading-relaxed"
            />

            {isLoading && (
              <div className="absolute inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-xs rounded-xl flex items-center justify-center gap-2.5 text-xs font-medium text-blue-600 dark:text-blue-400 animate-in fade-in duration-150">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span>Sedang menganalisis prompt dengan Gemini AI...</span>
              </div>
            )}
          </div>

          {/* Error Details Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
              <div className="flex-1 space-y-1">
                <div className="font-semibold text-rose-700 dark:text-rose-300">
                  Kendala Menghubungi Gemini AI:
                </div>
                <div className="font-mono text-[11px] whitespace-pre-wrap leading-relaxed opacity-95">
                  {errorMessage}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="p-1 rounded-md hover:bg-rose-500/10 text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 transition"
                title="Tutup pesan error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Examples */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <span>💡 Contoh prompt siap pakai (klik untuk mengisi):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setPromptText(ex)}
                  className="text-left text-[11px] px-2.5 py-1 rounded-lg glass-control text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 dark:hover:border-zinc-600 transition truncate max-w-full"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
            <span className="text-[11px] text-zinc-400 hidden sm:inline">
              Tekan <kbd className="font-mono px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">Enter</kbd> untuk generate
            </span>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                disabled={isLoading}
                onClick={closeAiPrompt}
                className="px-3.5 py-1.5 rounded-lg glass-control text-xs font-medium"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isLoading || !promptText.trim()}
                onClick={() => handleGenerate()}
                className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-medium text-xs shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
                    <span>Generate Task</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
