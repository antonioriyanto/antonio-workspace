import React, { useMemo } from 'react';
import { Table as TableIcon, Clock, AlertTriangle } from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { WTC_CONFIG } from '../config';
import { formatDateShort, getDeadlineInfo, getSnoozeState } from '../utils/dateUtils';
import { resolveStoresAndAmSpv } from '../utils/storeUtils';

export const SheetView: React.FC = () => {
  const { tasks, stores, filters, quickUrgentOnly, openTaskModal, openSnoozeModal } = useWorkspaceStore();

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Text Search
      if (filters.search && filters.search.trim() !== '') {
        const query = filters.search.toLowerCase().trim();
        const resolved = resolveStoresAndAmSpv(task.storeIds, stores);
        const matchTitle = (task.title || '').toLowerCase().includes(query);
        const matchNotes = (task.notes || '').toLowerCase().includes(query);
        const matchPic = (task.picHq || '').toLowerCase().includes(query);
        const matchStore = resolved.storeNames.some(s => s.toLowerCase().includes(query));
        const matchAm = resolved.amList.some(a => a.toLowerCase().includes(query));

        if (!matchTitle && !matchNotes && !matchPic && !matchStore && !matchAm) {
          return false;
        }
      }

      // 2. Priority Filter
      if (filters.priority !== 'ALL' && task.priority !== filters.priority) {
        return false;
      }

      // 3. PIC Filter
      if (filters.picHq !== 'ALL' && task.picHq !== filters.picHq) {
        return false;
      }

      // 4. Area Manager Filter
      if (filters.am !== 'ALL') {
        const resolved = resolveStoresAndAmSpv(task.storeIds, stores);
        if (resolved.isAllStores) {
          // All stores match
        } else if (!resolved.amList.includes(filters.am)) {
          return false;
        }
      }

      // 5. Store Filter
      if (filters.store !== 'ALL') {
        if (filters.store === 'ALL_STORES') {
          if (!task.storeIds.includes('ALL_STORES')) return false;
        } else {
          const matchDirect = task.storeIds.includes(filters.store);
          const isAllStores = task.storeIds.includes('ALL_STORES');
          if (!matchDirect && !isAllStores) return false;
        }
      }

      // 6. Category Filter
      if (filters.category !== 'ALL' && task.category !== filters.category) {
        return false;
      }

      // 7. Quick Urgent Filter
      if (quickUrgentOnly) {
        if (task.stageId === 'COMPLETED') return false;
        const dl = getDeadlineInfo(task.deadline, task.stageId);
        const snooze = getSnoozeState(task);
        const isUrgent =
          task.priority === 'CRITICAL' ||
          dl.status === 'OVERDUE' ||
          dl.status === 'DUE_TODAY' ||
          snooze.isFollowUpDue;
        if (!isUrgent) return false;
      }

      return true;
    });
  }, [tasks, stores, filters, quickUrgentOnly]);

  return (
    <div className="rounded-xl glass-panel overflow-hidden">
      {/* Table Header Description */}
      <div className="px-4 py-3 border-b border-zinc-200/70 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TableIcon className="w-3.5 h-3.5 text-zinc-400" />
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Daftar Task ({filteredTasks.length})
          </h3>
        </div>
        <span className="text-[11px] text-zinc-500">
          Klik baris untuk mengedit detail task
        </span>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100/50 dark:bg-zinc-900/40">
              <th className="py-2.5 px-3.5 font-medium">Tanggal</th>
              <th className="py-2.5 px-3.5 font-medium">Task</th>
              <th className="py-2.5 px-3.5 font-medium">Toko & Area</th>
              <th className="py-2.5 px-3.5 font-medium">Prioritas</th>
              <th className="py-2.5 px-3.5 font-medium">Deadline</th>
              <th className="py-2.5 px-3.5 font-medium">PIC</th>
              <th className="py-2.5 px-3.5 font-medium">Status</th>
              <th className="py-2.5 px-3.5 font-medium text-center">Follow-Up</th>
              <th className="py-2.5 px-3.5 font-medium">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
            {filteredTasks.map(task => {
              const priorityStyle = WTC_CONFIG.PRIORITY_STYLES[task.priority] || WTC_CONFIG.PRIORITY_STYLES.LOW;
              const deadlineInfo = getDeadlineInfo(task.deadline, task.stageId);
              const snoozeState = getSnoozeState(task);
              const subStatusDef = WTC_CONFIG.SUB_STATUSES.find(s => s.id === task.subStatus);
              const stageDef = WTC_CONFIG.STAGES.find(s => s.id === task.stageId);
              const resolvedStores = resolveStoresAndAmSpv(task.storeIds, stores);

              return (
                <tr
                  key={task.id}
                  onClick={() => openTaskModal(task.id)}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 cursor-pointer transition"
                >
                  {/* Tanggal */}
                  <td className="py-2.5 px-3.5 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                    {formatDateShort(task.dateCreated)}
                  </td>

                  {/* Task */}
                  <td className="py-2.5 px-3.5 min-w-[200px]">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{task.title}</div>
                    <span className="text-[10px] text-zinc-400 font-mono">#{task.id} · {task.category}</span>
                  </td>

                  {/* Toko & Area */}
                  <td className="py-2.5 px-3.5 max-w-[220px]">
                    <div className="truncate text-zinc-700 dark:text-zinc-300">
                      {resolvedStores.isAllStores ? 'Semua Toko (HQ)' : resolvedStores.storeNames.join(', ')}
                    </div>
                    {resolvedStores.amList.length > 0 && (
                      <div className="text-[10px] text-zinc-400">AM: {resolvedStores.amList.join(', ')}</div>
                    )}
                  </td>

                  {/* Prioritas */}
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priorityStyle.pill}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                      {priorityStyle.label}
                    </span>
                  </td>

                  {/* Deadline */}
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${deadlineInfo.badgeClass}`}>
                      {deadlineInfo.status === 'OVERDUE' && <AlertTriangle className="w-2.5 h-2.5" />}
                      {deadlineInfo.label}
                    </span>
                  </td>

                  {/* PIC */}
                  <td className="py-2.5 px-3.5 whitespace-nowrap text-zinc-700 dark:text-zinc-300 font-medium">
                    {task.picHq}
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    <div className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
                      {stageDef?.title}
                    </div>
                    <div className="inline-flex items-center gap-1 text-[10px]">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: subStatusDef?.dotColor || '#94a3b8' }}
                      />
                      <span className={subStatusDef?.textAccent || 'text-zinc-500'}>
                        {subStatusDef?.label || task.subStatus}
                      </span>
                    </div>
                  </td>

                  {/* Follow-Up */}
                  <td className="py-2.5 px-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {snoozeState.isSnoozed ? (
                      <button
                        type="button"
                        onClick={() => openSnoozeModal(task.id)}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-amber-500 transition"
                      >
                        <Clock className="w-2.5 h-2.5" />
                        <span>{snoozeState.untilFormatted}</span>
                      </button>
                    ) : snoozeState.isFollowUpDue ? (
                      <button
                        type="button"
                        onClick={() => openSnoozeModal(task.id)}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse font-semibold"
                      >
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>Hari Ini</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openSnoozeModal(task.id)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
                        title="Atur Jadwal Follow-Up"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>

                  {/* Catatan */}
                  <td className="py-2.5 px-3.5 max-w-[240px]">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 italic">
                      {task.notes || '-'}
                    </span>
                  </td>
                </tr>
              );
            })}

            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-zinc-400 italic">
                  Tidak ada task yang cocok dengan kriteria pencarian atau filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
