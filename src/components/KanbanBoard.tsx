import React, { useMemo } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { WTC_CONFIG } from '../config';
import { Task } from '../types';
import { getDeadlineInfo, getSnoozeState } from '../utils/dateUtils';
import { resolveStoresAndAmSpv } from '../utils/storeUtils';

export const KanbanBoard: React.FC = () => {
  const { tasks, stores, filters, quickUrgentOnly } = useWorkspaceStore();

  // Filter tasks based on search, dropdown filters, and quick urgent toggle
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
          // If all stores, it covers all AMs
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

  // Group tasks by Stage and sort them
  const tasksByStage = useMemo(() => {
    const map = new Map<string, Task[]>();
    WTC_CONFIG.STAGES.forEach(st => map.set(st.id, []));

    filteredTasks.forEach(task => {
      const list = map.get(task.stageId);
      if (list) list.push(task);
    });

    // Sort tasks in each stage
    map.forEach((list) => {
      list.sort((a, b) => {
        const wa = WTC_CONFIG.PRIORITY_WEIGHT[a.priority] || 0;
        const wb = WTC_CONFIG.PRIORITY_WEIGHT[b.priority] || 0;
        if (wb !== wa) return wb - wa;
        return (a.deadline || '').localeCompare(b.deadline || '');
      });
    });

    return map;
  }, [filteredTasks]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 items-start">
      {WTC_CONFIG.STAGES.map(stage => (
        <KanbanColumn
          key={stage.id}
          stage={stage}
          tasks={tasksByStage.get(stage.id) || []}
        />
      ))}
    </div>
  );
};
