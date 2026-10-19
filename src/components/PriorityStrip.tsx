import React, { useMemo } from 'react';
import { Filter, Clock, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { getDeadlineInfo, getSnoozeState } from '../utils/dateUtils';
import { WTC_CONFIG } from '../config';

export const PriorityStrip: React.FC = () => {
  const {
    tasks,
    priorityStripCollapsed,
    togglePriorityStrip,
    quickUrgentOnly,
    toggleQuickUrgent,
    wakeAllSnoozed,
    openTaskModal
  } = useWorkspaceStore();

  // Calculate urgent tasks
  const { urgentTasks, overdueCount, criticalCount, dueTodayCount, hasSnoozedTasks } = useMemo(() => {
    let overdue = 0;
    let critical = 0;
    let dueToday = 0;
    let snoozedCount = 0;

    const list = tasks.filter(t => {
      if (t.stageId === 'COMPLETED') return false;

      const dl = getDeadlineInfo(t.deadline, t.stageId);
      const snooze = getSnoozeState(t);

      if (t.snoozedUntil) snoozedCount++;

      // If actively snoozed (and not yet due), don't show as urgent unless critical
      if (snooze.isSnoozed && t.priority !== 'CRITICAL') {
        return false;
      }

      let isUrgent = false;

      if (dl.status === 'OVERDUE') {
        overdue++;
        isUrgent = true;
      } else if (dl.status === 'DUE_TODAY') {
        dueToday++;
        isUrgent = true;
      }

      if (t.priority === 'CRITICAL') {
        critical++;
        isUrgent = true;
      }

      if (snooze.isFollowUpDue) {
        isUrgent = true;
      }

      return isUrgent;
    });

    // Sort by priority weight and then deadline
    list.sort((a, b) => {
      const wa = WTC_CONFIG.PRIORITY_WEIGHT[a.priority] || 0;
      const wb = WTC_CONFIG.PRIORITY_WEIGHT[b.priority] || 0;
      if (wb !== wa) return wb - wa;
      return (a.deadline || '').localeCompare(b.deadline || '');
    });

    return {
      urgentTasks: list,
      overdueCount: overdue,
      criticalCount: critical,
      dueTodayCount: dueToday,
      hasSnoozedTasks: snoozedCount > 0
    };
  }, [tasks]);

  // Construct briefing text
  const summaryParts: string[] = [];
  if (overdueCount > 0) summaryParts.push(`${overdueCount} lewat deadline`);
  if (criticalCount > 0) summaryParts.push(`${criticalCount} prioritas kritis`);
  if (dueTodayCount > 0) summaryParts.push(`${dueTodayCount} jatuh tempo hari ini`);

  const summaryText = summaryParts.length > 0
    ? summaryParts.join(' · ')
    : 'Semua task dalam kontrol yang baik';

  return (
    <section className="max-w-[1920px] w-full mx-auto px-4 lg:px-6 pt-4">
      <div className="rounded-xl glass-panel px-3.5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left Title & Summary */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <h2 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Perlu Perhatian
              </h2>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                {urgentTasks.length}
              </span>
            </div>

            <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>

            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              {urgentTasks.length > 0 && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
              <span>{summaryText}</span>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleQuickUrgent}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1.5 ${
                quickUrgentOnly
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'glass-control text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <Filter className="w-2.5 h-2.5" />
              <span>{quickUrgentOnly ? 'Filter Aktif' : 'Filter Mendesak'}</span>
            </button>

            {hasSnoozedTasks && (
              <button
                type="button"
                onClick={wakeAllSnoozed}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium glass-control text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 hover:text-amber-500"
                title="Aktifkan kembali semua kartu yang di-snooze"
              >
                <Clock className="w-2.5 h-2.5" />
                <span>Reset Snooze</span>
              </button>
            )}

            <button
              type="button"
              onClick={togglePriorityStrip}
              className="px-2 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition flex items-center gap-1"
            >
              <span>{priorityStripCollapsed ? 'Tampilkan' : 'Sembunyikan'}</span>
              {priorityStripCollapsed ? (
                <ChevronDown className="w-2.5 h-2.5" />
              ) : (
                <ChevronUp className="w-2.5 h-2.5" />
              )}
            </button>
          </div>
        </div>

        {/* Urgent Task Mini Cards List */}
        {!priorityStripCollapsed && (
          <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1.5 pt-1">
            {urgentTasks.length === 0 ? (
              <div className="text-xs text-zinc-400 italic py-1 px-1">
                Tidak ada task yang membutuhkan perhatian mendesak saat ini.
              </div>
            ) : (
              urgentTasks.map(task => {
                const dl = getDeadlineInfo(task.deadline, task.stageId);
                const priorityStyle = WTC_CONFIG.PRIORITY_STYLES[task.priority] || WTC_CONFIG.PRIORITY_STYLES.LOW;

                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openTaskModal(task.id)}
                    className="flex-shrink-0 w-64 text-left p-2.5 rounded-lg glass-card group cursor-pointer hover:border-zinc-400/50 dark:hover:border-zinc-600/50"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${priorityStyle.pill}`}>
                        {priorityStyle.label}
                      </span>
                      <span className={`text-[10px] ${dl.textClass}`}>
                        {dl.label}
                      </span>
                    </div>
                    <h4 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-500 transition">
                      {task.title}
                    </h4>
                    <div className="text-[10px] text-zinc-400 mt-1 flex items-center justify-between">
                      <span className="truncate max-w-[140px]">{task.category}</span>
                      <span className="font-mono text-zinc-500">{task.picHq}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </section>
  );
};
