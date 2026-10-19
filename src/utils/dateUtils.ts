import { Task } from '../types';

export function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatDateHuman(isoDate?: string | null): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return isoDate;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function formatDateShort(isoDate?: string | null): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return isoDate;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short'
  });
}

export function addWorkingDays(startDateStr: string, workingDaysToAdd: number): string {
  const parts = startDateStr.split('-').map(Number);
  const result = new Date(parts[0], parts[1] - 1, parts[2]);
  let added = 0;
  while (added < workingDaysToAdd) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
}

export interface DeadlineInfo {
  status: 'COMPLETED' | 'NONE' | 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'NORMAL';
  diffDays?: number;
  label: string;
  textClass: string;
  badgeClass?: string;
}

export function getDeadlineInfo(deadlineIso?: string | null, stageId?: string): DeadlineInfo {
  if (stageId === 'COMPLETED') {
    return {
      status: 'COMPLETED',
      label: 'Selesai',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    };
  }

  if (!deadlineIso) {
    return {
      status: 'NONE',
      label: '-',
      textClass: 'text-zinc-400 dark:text-zinc-500',
      badgeClass: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
    };
  }

  const todayStr = getTodayIso();
  const today = new Date(todayStr + 'T00:00:00');
  const target = new Date(deadlineIso + 'T00:00:00');
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'OVERDUE',
      diffDays,
      label: `Lewat ${Math.abs(diffDays)}h · ${formatDateShort(deadlineIso)}`,
      textClass: 'text-rose-500 dark:text-rose-400 font-semibold',
      badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse'
    };
  }

  if (diffDays === 0) {
    return {
      status: 'DUE_TODAY',
      diffDays: 0,
      label: `Hari ini · ${formatDateShort(deadlineIso)}`,
      textClass: 'text-amber-600 dark:text-amber-400 font-semibold',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
    };
  }

  if (diffDays <= 2) {
    return {
      status: 'DUE_SOON',
      diffDays,
      label: `H-${diffDays} · ${formatDateShort(deadlineIso)}`,
      textClass: 'text-orange-500 dark:text-orange-400 font-medium',
      badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
    };
  }

  return {
    status: 'NORMAL',
    diffDays,
    label: formatDateShort(deadlineIso),
    textClass: 'text-zinc-500 dark:text-zinc-400',
    badgeClass: 'bg-zinc-500/5 text-zinc-500 dark:text-zinc-400 border-zinc-500/15'
  };
}

export function getSnoozeState(task: Task) {
  if (task.stageId === 'COMPLETED' || !task.snoozedUntil) {
    return { isSnoozed: false, isFollowUpDue: false, untilFormatted: '' };
  }
  const todayIso = getTodayIso();
  if (todayIso < task.snoozedUntil) {
    return {
      isSnoozed: true,
      isFollowUpDue: false,
      untilFormatted: formatDateShort(task.snoozedUntil)
    };
  }
  return {
    isSnoozed: false,
    isFollowUpDue: true,
    untilFormatted: formatDateShort(task.snoozedUntil)
  };
}
