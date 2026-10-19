import React, { useState, useMemo } from 'react';
import { Clock, X, Check, Calendar } from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { getTodayIso, addWorkingDays, formatDateHuman } from '../utils/dateUtils';

export const SnoozeModal: React.FC = () => {
  const {
    isSnoozeModalOpen,
    snoozeTaskId,
    closeSnoozeModal,
    tasks,
    applySnooze,
    clearSnooze,
    markTaskCompleted
  } = useWorkspaceStore();

  const task = useMemo(() => {
    if (!snoozeTaskId) return null;
    return tasks.find(t => t.id === snoozeTaskId) || null;
  }, [snoozeTaskId, tasks]);

  const [customDate, setCustomDate] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');

  // Update initial follow-up reason if task has one
  React.useEffect(() => {
    if (task) {
      setFollowUpReason(task.followUpReason || '');
      setCustomDate(task.snoozedUntil || '');
    }
  }, [task]);

  if (!isSnoozeModalOpen || !task) return null;

  const today = getTodayIso();

  // Calculate working days preview
  const datePreview1 = addWorkingDays(today, 1);
  const datePreview2 = addWorkingDays(today, 2);
  const datePreview3 = addWorkingDays(today, 3);
  const datePreview5 = addWorkingDays(today, 5);
  const datePreview7 = addWorkingDays(today, 7);

  const handleApplyPreset = (workingDays: number) => {
    const targetDate = addWorkingDays(today, workingDays);
    applySnooze(task.id, targetDate, followUpReason);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDate) return;
    applySnooze(task.id, customDate, followUpReason);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSnoozeModal();
      }}
    >
      <div className="glass-panel bg-white/95 dark:bg-[#141417]/95 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                Jadwal Follow-Up
              </h3>
              <p className="text-[11px] text-zinc-500">
                Sabtu & Minggu otomatis dilewati
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSnoozeModal}
            className="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Task Summary */}
          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-zinc-800 text-xs space-y-1">
            <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {task.title}
            </div>
            <div className="text-[11px] text-zinc-400 flex items-center justify-between">
              <span>#{task.id} · {task.category}</span>
              <span>PIC: {task.picHq}</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              Ingatkan lagi dalam:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset(1)}
                className="p-2.5 rounded-lg glass-control text-left group hover:border-zinc-400 dark:hover:border-zinc-600 transition"
              >
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  Besok (+1 Hari Kerja)
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  {formatDateHuman(datePreview1)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset(2)}
                className="p-2.5 rounded-lg glass-control text-left group hover:border-zinc-400 dark:hover:border-zinc-600 transition"
              >
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  Lusa (+2 Hari Kerja)
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  {formatDateHuman(datePreview2)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset(3)}
                className="p-2.5 rounded-lg glass-control text-left group hover:border-zinc-400 dark:hover:border-zinc-600 transition"
              >
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  +3 Hari Kerja
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  {formatDateHuman(datePreview3)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset(5)}
                className="p-2.5 rounded-lg glass-control text-left group hover:border-zinc-400 dark:hover:border-zinc-600 transition"
              >
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  +5 Hari Kerja
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  {formatDateHuman(datePreview5)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset(7)}
                className="col-span-2 p-2.5 rounded-lg glass-control flex items-center justify-between group hover:border-zinc-400 dark:hover:border-zinc-600 transition"
              >
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  Seminggu (+7 Hari Kerja)
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {formatDateHuman(datePreview7)}
                </span>
              </button>
            </div>
          </div>

          {/* Custom Date & Reason */}
          <div className="pt-3 border-t border-zinc-200/70 dark:border-zinc-800 space-y-2.5">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Catatan Follow-Up
              </label>
              <input
                type="text"
                value={followUpReason}
                onChange={(e) => setFollowUpReason(e.target.value)}
                placeholder="Mis. Menunggu ACC ukuran dari Ica..."
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Tanggal Manual
              </label>
              <form onSubmit={handleApplyCustom} className="flex gap-2">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium text-xs flex items-center gap-1"
                >
                  <Calendar className="w-3 h-3" />
                  <span>Set Tanggal</span>
                </button>
              </form>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => clearSnooze(task.id)}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
            >
              Matikan Snooze
            </button>

            <button
              type="button"
              onClick={() => markTaskCompleted(task.id)}
              className="px-3 py-1.5 rounded-lg glass-control text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 hover:bg-emerald-500/10"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Tandai Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
