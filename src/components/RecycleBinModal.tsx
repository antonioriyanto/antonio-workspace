import React from 'react';
import { Trash2, RotateCcw, X, AlertCircle, AlertTriangle } from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { WTC_CONFIG } from '../config';
import { formatDateShort } from '../utils/dateUtils';
import { resolveStoresAndAmSpv } from '../utils/storeUtils';

export const RecycleBinModal: React.FC = () => {
  const {
    isRecycleBinOpen,
    closeRecycleBin,
    deletedTasks,
    restoreTask,
    permanentlyDeleteTask,
    emptyRecycleBin,
    stores
  } = useWorkspaceStore();

  if (!isRecycleBinOpen) return null;

  const handleEmptyAll = () => {
    if (window.confirm('Yakin ingin mengosongkan semua task di keranjang sampah? Tindakan ini tidak dapat dibatalkan.')) {
      emptyRecycleBin();
    }
  };

  const handlePermanentDelete = (taskId: string, title: string) => {
    if (window.confirm(`Hapus permanen task "${title}"?`)) {
      permanentlyDeleteTask(taskId);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeRecycleBin();
      }}
    >
      <div className="glass-panel bg-white/95 dark:bg-[#121215]/95 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Keranjang Sampah</span>
                <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                  {deletedTasks.length}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Task yang dihapus dapat dipulihkan kembali ke Kanban Board kapan saja
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {deletedTasks.length > 0 && (
              <button
                type="button"
                onClick={handleEmptyAll}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition flex items-center gap-1 border border-rose-500/20"
                title="Hapus semua task di keranjang sampah permanen"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Kosongkan</span>
              </button>
            )}
            <button
              type="button"
              onClick={closeRecycleBin}
              className="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-2.5">
          {deletedTasks.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-400 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400 dark:text-zinc-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Keranjang sampah kosong
              </p>
              <p className="text-[11px] text-zinc-400 max-w-xs">
                Tidak ada task yang sedang dihapus. Semua task Anda aman di board.
              </p>
            </div>
          ) : (
            deletedTasks.map((task) => {
              const priorityStyle = WTC_CONFIG.PRIORITY_STYLES[task.priority] || WTC_CONFIG.PRIORITY_STYLES.LOW;
              const resolvedStores = resolveStoresAndAmSpv(task.storeIds, stores);

              return (
                <div
                  key={task.id}
                  className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/90 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priorityStyle.pill}`}>
                        {priorityStyle.label}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {task.category}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        #{task.id}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {task.title}
                    </h4>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>PIC: <strong className="text-zinc-700 dark:text-zinc-300">{task.picHq}</strong></span>
                      <span>·</span>
                      <span>Toko: {resolvedStores.isAllStores ? 'Semua Toko' : resolvedStores.storeNames.slice(0, 2).join(', ')}</span>
                      <span>·</span>
                      <span>Deadline: {formatDateShort(task.deadline)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => restoreTask(task.id)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium text-xs flex items-center gap-1.5 shadow-sm hover:opacity-90 active:scale-95 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                      <span>Pulihkan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePermanentDelete(task.id, task.title)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                      title="Hapus Permanen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between text-[11px] text-zinc-500">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-zinc-400" />
            <span>Memulihkan task akan langsung mengembalikannya ke kolom Kanban aslinya.</span>
          </div>
          <button
            type="button"
            onClick={closeRecycleBin}
            className="px-3 py-1 rounded-lg glass-control text-xs font-medium"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
