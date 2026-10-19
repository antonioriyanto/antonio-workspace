import React from 'react';
import {
  Clock,
  Pencil,
  ChevronRight,
  Store as StoreIcon,
  AlertTriangle,
  User
} from 'lucide-react';
import { Task, StageId } from '../types';
import { WTC_CONFIG } from '../config';
import { getDeadlineInfo, getSnoozeState } from '../utils/dateUtils';
import { resolveStoresAndAmSpv } from '../utils/storeUtils';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

interface TaskCardProps {
  task: Task;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const {
    stores,
    openTaskModal,
    openSnoozeModal,
    moveTaskStage,
    setDraggedTaskId,
    draggedTaskId
  } = useWorkspaceStore();

  const isDragging = draggedTaskId === task.id;
  const deadlineInfo = getDeadlineInfo(task.deadline, task.stageId);
  const snoozeState = getSnoozeState(task);
  const priorityStyle = WTC_CONFIG.PRIORITY_STYLES[task.priority] || WTC_CONFIG.PRIORITY_STYLES.LOW;
  const subStatusDef = WTC_CONFIG.SUB_STATUSES.find(s => s.id === task.subStatus);
  const resolvedStores = resolveStoresAndAmSpv(task.storeIds, stores);

  // Quick next stage handler
  const handleQuickNextStage = (e: React.MouseEvent) => {
    e.stopPropagation();
    const stageOrder: StageId[] = ['BACKLOG', 'CREATIVE', 'PRODUCTION', 'LOGISTICS', 'COMPLETED'];
    const currentIndex = stageOrder.indexOf(task.stageId);
    if (currentIndex >= 0 && currentIndex < stageOrder.length - 1) {
      const nextStage = stageOrder[currentIndex + 1];
      moveTaskStage(task.id, nextStage);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => openTaskModal(task.id)}
      className={`glass-card rounded-xl p-3 cursor-pointer select-none space-y-2.5 transition relative group ${
        snoozeState.isSnoozed ? 'task-snoozed' : ''
      } ${isDragging ? 'dragging' : ''}`}
    >
      {/* Top Row: Priority & Category & Quick Actions */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priorityStyle.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
            <span>{priorityStyle.label}</span>
          </span>

          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
            {task.category}
          </span>
        </div>

        {/* Hover Quick Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openSnoozeModal(task.id);
            }}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-amber-500 transition"
            title="Snooze / Jadwal Follow-up"
          >
            <Clock className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openTaskModal(task.id);
            }}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-blue-500 transition"
            title="Edit Task"
          >
            <Pencil className="w-3 h-3" />
          </button>

          {task.stageId !== 'COMPLETED' && (
            <button
              type="button"
              onClick={handleQuickNextStage}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-emerald-500 transition"
              title="Pindah ke Tahap Berikutnya"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Task Title */}
      <h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-snug group-hover:text-blue-500 dark:group-hover:text-blue-400 transition">
        {task.title}
      </h3>

      {/* Stores & Area Manager info */}
      <div className="flex items-start gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        <StoreIcon className="w-3 h-3 mt-0.5 flex-shrink-0 text-zinc-400" />
        <div className="leading-tight line-clamp-2">
          {resolvedStores.isAllStores ? (
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Semua Toko (HQ)</span>
          ) : (
            <span>
              {resolvedStores.storeNames.join(', ')}
              {resolvedStores.amList.length > 0 && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-1">
                  (AM: {resolvedStores.amList.join(', ')})
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Substatus and Deadline */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/60 text-[10px]">
        {/* Substatus */}
        <div className="inline-flex items-center gap-1.5 font-medium">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: subStatusDef?.dotColor || '#94a3b8' }}
          />
          <span className={subStatusDef?.textAccent || 'text-zinc-500'}>
            {subStatusDef?.label || task.subStatus}
          </span>
        </div>

        {/* Deadline Indicator */}
        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${deadlineInfo.badgeClass}`}>
          {deadlineInfo.status === 'OVERDUE' && <AlertTriangle className="w-2.5 h-2.5" />}
          <span>{deadlineInfo.label}</span>
        </div>
      </div>

      {/* Snooze & Follow Up Indicator */}
      {snoozeState.isSnoozed && (
        <div className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/70 text-zinc-500 border border-zinc-200 dark:border-zinc-700/60 w-full">
          <Clock className="w-2.5 h-2.5 text-zinc-400" />
          <span>Snooze s/d {snoozeState.untilFormatted}</span>
          {task.followUpReason && <span className="truncate italic">- {task.followUpReason}</span>}
        </div>
      )}

      {snoozeState.isFollowUpDue && (
        <div className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 w-full animate-pulse">
          <AlertTriangle className="w-2.5 h-2.5" />
          <span className="font-semibold">Follow-Up Hari Ini!</span>
          {task.followUpReason && <span className="truncate">- {task.followUpReason}</span>}
        </div>
      )}

      {/* Notes Snippet */}
      {task.notes && task.notes.trim() !== '' && (
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2 bg-zinc-50/60 dark:bg-zinc-900/50 p-1.5 rounded border border-zinc-200/40 dark:border-zinc-800/40 italic">
          "{task.notes}"
        </p>
      )}

      {/* Footer: PIC & ID */}
      <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
        <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 font-medium">
          <User className="w-2.5 h-2.5 text-zinc-400" />
          <span>{task.picHq}</span>
        </span>
        <span className="font-mono text-zinc-400">#{task.id}</span>
      </div>
    </div>
  );
};
