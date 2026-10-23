import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X, RotateCcw } from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useWorkspaceStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full sm:w-auto">
      {toasts.map(toast => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium shadow-2xl border backdrop-blur-md transition-all animate-in slide-in-from-bottom-2 duration-200 ${
              isSuccess
                ? 'bg-emerald-950/90 text-emerald-100 border-emerald-800/60 dark:bg-emerald-900/90'
                : isError
                ? 'bg-rose-950/90 text-rose-100 border-rose-800/60 dark:bg-rose-900/90'
                : 'bg-zinc-900/95 text-zinc-100 border-zinc-700/60 dark:bg-[#18181c]/95'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : isError ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
            )}

            <span className="flex-1 leading-tight">{toast.message}</span>

            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  removeToast(toast.id);
                }}
                className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold flex items-center gap-1.5 transition text-[11px] shadow-sm ml-1 flex-shrink-0 active:scale-95"
              >
                <RotateCcw className="w-3 h-3 text-amber-300" />
                <span>{toast.action.label}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition flex-shrink-0 ml-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
