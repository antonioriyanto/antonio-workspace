import { create } from 'zustand';
import {
  Task,
  Store,
  PIC,
  StageId,
  WorkspaceData,
  FilterState,
  ViewMode,
  ThemeMode,
  SyncStatus,
  ToastMessage,
  ToastAction,
  EmergencyBackup,
  TaskFormData,
  AIActionLog
} from '../types';
import { WTC_CONFIG } from '../config';
import { getTodayIso } from '../utils/dateUtils';
import { exportTasksCsv, downloadFile } from '../utils/csvUtils';

interface WorkspaceStoreState {
  // Workspaces
  activeWorkspace: string;
  workspaceList: string[];

  // Workspace Data
  tasks: Task[];
  deletedTasks: Task[];
  lastDeletedTask: { task: Task; index: number } | null;
  stores: Store[];
  pics: PIC[];
  categories: string[];
  gasWebhookUrl: string;
  geminiApiKey: string;
  aiActionLogs: AIActionLog[];
  lastModified: string | null;
  lastSyncedAt: string | null;

  // View & UI state
  viewMode: ViewMode;
  theme: ThemeMode;
  priorityStripCollapsed: boolean;
  quickUrgentOnly: boolean;

  // Filters
  filters: FilterState;

  // Sync state
  autoSyncEnabled: boolean;
  syncStatus: SyncStatus;

  // Modals
  isTaskModalOpen: boolean;
  editingTaskId: string | null;
  prefilledTaskData: TaskFormData | null;

  isSnoozeModalOpen: boolean;
  snoozeTaskId: string | null;

  isDirectoryModalOpen: boolean;
  directoryTab: 'stores' | 'pics' | 'categories';

  isCloudModalOpen: boolean;
  isRecycleBinOpen: boolean;
  isAiPromptOpen: boolean;

  // Drag and drop
  draggedTaskId: string | null;

  // Toasts
  toasts: ToastMessage[];

  // Actions
  init: () => void;
  switchWorkspace: (workspaceName: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (mode: ThemeMode) => void;
  togglePriorityStrip: () => void;
  toggleQuickUrgent: () => void;

  // Filter actions
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;

  // AI actions
  openAiPrompt: () => void;
  closeAiPrompt: () => void;
  setGeminiApiKey: (key: string) => void;
  addAIActionLog: (log: Omit<AIActionLog, 'id' | 'timestamp' | 'isReverted'>) => string;
  addAiActionLog: (log: Omit<AIActionLog, 'id' | 'timestamp' | 'isReverted'>) => string;
  revertAIAction: (logId: string) => void;
  undoAiAction: (logId: string) => void;
  clearAIActionLogs: () => void;
  clearAiActionLogs: () => void;

  // Task actions
  openTaskModal: (taskId?: string | null, prefillData?: TaskFormData | null) => void;
  closeTaskModal: () => void;
  saveTask: (formData: TaskFormData) => void;
  deleteTask: (taskId: string) => void;
  undoDeleteTask: () => void;
  restoreTask: (taskId: string) => void;
  permanentlyDeleteTask: (taskId: string) => void;
  emptyRecycleBin: () => void;
  openRecycleBin: () => void;
  closeRecycleBin: () => void;
  moveTaskStage: (taskId: string, newStageId: StageId, newSubStatus?: string) => void;
  markReminderNotified: (taskId: string) => void;

  // Snooze actions
  openSnoozeModal: (taskId: string) => void;
  closeSnoozeModal: () => void;
  applySnooze: (taskId: string, snoozeUntilIso: string, followUpReason?: string) => void;
  clearSnooze: (taskId: string) => void;
  wakeAllSnoozed: () => void;
  markTaskCompleted: (taskId: string) => void;

  // Directory actions
  openDirectoryModal: (tab?: 'stores' | 'pics' | 'categories') => void;
  closeDirectoryModal: () => void;
  setDirectoryTab: (tab: 'stores' | 'pics' | 'categories') => void;
  addStore: (store: Omit<Store, 'id' | 'no'>) => Store;
  deleteStore: (storeId: string) => void;
  addPic: (pic: Omit<PIC, 'id'>) => void;
  deletePic: (picId: string) => void;
  addCategory: (categoryName: string) => void;
  deleteCategory: (categoryName: string) => void;

  // Cloud & Sync actions
  openCloudModal: () => void;
  closeCloudModal: () => void;
  setGasWebhookUrl: (url: string) => void;
  toggleAutoSync: (enabled: boolean) => void;
  pushToGoogleSheets: (silent?: boolean) => Promise<boolean>;
  pullFromGoogleSheets: (force?: boolean, silent?: boolean) => Promise<boolean>;
  exportBackupJson: () => void;
  importBackupJson: (fileContent: string) => boolean;
  exportCsv: () => void;
  createEmergencySnapshot: () => void;
  rollbackEmergencySnapshot: () => boolean;
  getStorageStats: () => { taskCount: number; storeCount: number; picCount: number; categoryCount: number; sizeKb: string; lastBackupTime: string | null };

  // Drag actions
  setDraggedTaskId: (taskId: string | null) => void;

  // Toast actions
  addToast: (message: string, type?: 'info' | 'success' | 'error', action?: ToastAction, duration?: number) => void;
  removeToast: (id: string) => void;
}

function getInitialWorkspaceData(activeWs: string): WorkspaceData {
  try {
    const storageKey = `${WTC_CONFIG.STORAGE_KEY}_${activeWs.replace(/\s+/g, '_')}`;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        workspaceName: parsed.workspaceName || activeWs,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        deletedTasks: Array.isArray(parsed.deletedTasks) ? parsed.deletedTasks : [],
        aiActionLogs: Array.isArray(parsed.aiActionLogs) ? parsed.aiActionLogs : [],
        stores: Array.isArray(parsed.stores) && parsed.stores.length > 0 ? parsed.stores : WTC_CONFIG.DEFAULT_STORES,
        pics: Array.isArray(parsed.pics) && parsed.pics.length > 0 ? parsed.pics : WTC_CONFIG.DEFAULT_PICS,
        categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : WTC_CONFIG.DEFAULT_CATEGORIES,
        gasWebhookUrl: parsed.gasWebhookUrl || '',
        lastModified: parsed.lastModified || null,
        lastSyncedAt: parsed.lastSyncedAt || null
      };
    }
  } catch (e) {
    console.error('Error loading workspace state from localStorage:', e);
  }

  // Fallback defaults
  const initialTasks = activeWs === 'Watch Club'
    ? WTC_CONFIG.INITIAL_TASKS_WATCH_CLUB
    : WTC_CONFIG.INITIAL_TASKS_PERSONAL;

  return {
    workspaceName: activeWs,
    tasks: initialTasks,
    deletedTasks: [],
    aiActionLogs: [],
    stores: WTC_CONFIG.DEFAULT_STORES,
    pics: WTC_CONFIG.DEFAULT_PICS,
    categories: WTC_CONFIG.DEFAULT_CATEGORIES,
    gasWebhookUrl: '',
    lastModified: null,
    lastSyncedAt: null
  };
}

function persistWorkspaceData(data: WorkspaceData) {
  try {
    const activeWs = data.workspaceName || 'Watch Club';
    const storageKey = `${WTC_CONFIG.STORAGE_KEY}_${activeWs.replace(/\s+/g, '_')}`;
    localStorage.setItem(storageKey, JSON.stringify(data));
    localStorage.setItem(WTC_CONFIG.ACTIVE_WORKSPACE_KEY, activeWs);
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

function applyThemeToDom(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else if (mode === 'light') {
    root.classList.remove('dark');
  } else {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', isDark);
  }
}

// Auto-push timer debounce reference
let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => {
  const savedWs = typeof window !== 'undefined'
    ? localStorage.getItem(WTC_CONFIG.ACTIVE_WORKSPACE_KEY) || 'Watch Club'
    : 'Watch Club';

  const savedTheme = (typeof window !== 'undefined'
    ? (localStorage.getItem(WTC_CONFIG.THEME_KEY) as ThemeMode) || 'dark'
    : 'dark') as ThemeMode;

  const savedAutoSync = typeof window !== 'undefined'
    ? localStorage.getItem(WTC_CONFIG.AUTOSYNC_KEY) !== '0'
    : true;

  const initialData = typeof window !== 'undefined'
    ? getInitialWorkspaceData(savedWs)
    : {
        workspaceName: savedWs,
        tasks: WTC_CONFIG.INITIAL_TASKS_WATCH_CLUB,
        stores: WTC_CONFIG.DEFAULT_STORES,
        pics: WTC_CONFIG.DEFAULT_PICS,
        categories: WTC_CONFIG.DEFAULT_CATEGORIES,
        gasWebhookUrl: '',
        lastModified: null,
        lastSyncedAt: null
      };

  const scheduleAutoPush = () => {
    const state = get();
    if (!state.gasWebhookUrl || !state.autoSyncEnabled) return;

    if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
    set({ syncStatus: { message: 'Menunggu sinkronisasi...', type: 'syncing' } });

    pushDebounceTimer = setTimeout(() => {
      get().pushToGoogleSheets(true);
    }, 2500);
  };

  return {
    activeWorkspace: savedWs,
    workspaceList: ['Watch Club', 'Personal Project'],

    tasks: initialData.tasks,
    deletedTasks: initialData.deletedTasks || [],
    aiActionLogs: initialData.aiActionLogs || [],
    lastDeletedTask: null,
    stores: initialData.stores,
    pics: initialData.pics,
    categories: initialData.categories,
    gasWebhookUrl: initialData.gasWebhookUrl,
    geminiApiKey: typeof window !== 'undefined'
      ? (localStorage.getItem('WTC_GEMINI_API_KEY') || (import.meta.env.VITE_GEMINI_API_KEY as string) || '')
      : '',
    lastModified: initialData.lastModified,
    lastSyncedAt: initialData.lastSyncedAt,

    viewMode: 'kanban',
    theme: savedTheme,
    priorityStripCollapsed: false,
    quickUrgentOnly: false,

    filters: {
      search: '',
      priority: 'ALL',
      picHq: 'ALL',
      am: 'ALL',
      store: 'ALL',
      category: 'ALL'
    },

    autoSyncEnabled: savedAutoSync,
    syncStatus: { message: 'Tersimpan Lokal', type: 'ok' },

    isTaskModalOpen: false,
    editingTaskId: null,
    prefilledTaskData: null,

    isSnoozeModalOpen: false,
    snoozeTaskId: null,

    isDirectoryModalOpen: false,
    directoryTab: 'stores',

    isCloudModalOpen: false,
    isRecycleBinOpen: false,
    isAiPromptOpen: false,

    draggedTaskId: null,
    toasts: [],

    init: () => {
      applyThemeToDom(savedTheme);

      // Listen to system theme changes
      if (typeof window !== 'undefined') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          if (get().theme === 'system') {
            applyThemeToDom('system');
          }
        });

        // Auto pull on mount if webhook is configured
        if (initialData.gasWebhookUrl && savedAutoSync) {
          setTimeout(() => {
            get().pullFromGoogleSheets(false, true);
          }, 1500);
        }
      }
    },

    switchWorkspace: (workspaceName: string) => {
      if (pushDebounceTimer) clearTimeout(pushDebounceTimer);

      const newData = getInitialWorkspaceData(workspaceName);
      localStorage.setItem(WTC_CONFIG.ACTIVE_WORKSPACE_KEY, workspaceName);

      set({
        activeWorkspace: workspaceName,
        tasks: newData.tasks,
        deletedTasks: newData.deletedTasks || [],
        aiActionLogs: newData.aiActionLogs || [],
        stores: newData.stores,
        pics: newData.pics,
        categories: newData.categories,
        gasWebhookUrl: newData.gasWebhookUrl,
        lastModified: newData.lastModified,
        lastSyncedAt: newData.lastSyncedAt,
        syncStatus: { message: 'Tersimpan Lokal', type: 'ok' },
        filters: {
          search: '',
          priority: 'ALL',
          picHq: 'ALL',
          am: 'ALL',
          store: 'ALL',
          category: 'ALL'
        },
        quickUrgentOnly: false
      });

      get().addToast(`Beralih ke Workspace: ${workspaceName}`, 'success');

      if (newData.gasWebhookUrl && get().autoSyncEnabled) {
        setTimeout(() => get().pullFromGoogleSheets(false, true), 800);
      }
    },

    setViewMode: (mode: ViewMode) => set({ viewMode: mode }),

    setTheme: (mode: ThemeMode) => {
      localStorage.setItem(WTC_CONFIG.THEME_KEY, mode);
      applyThemeToDom(mode);
      set({ theme: mode });
      get().addToast(`Tema: ${mode}`, 'info');
    },

    togglePriorityStrip: () => set(state => ({ priorityStripCollapsed: !state.priorityStripCollapsed })),

    toggleQuickUrgent: () => set(state => ({ quickUrgentOnly: !state.quickUrgentOnly })),

    setFilter: (key, value) => {
      set(state => ({
        filters: { ...state.filters, [key]: value }
      }));
    },

    resetFilters: () => {
      set({
        filters: {
          search: '',
          priority: 'ALL',
          picHq: 'ALL',
          am: 'ALL',
          store: 'ALL',
          category: 'ALL'
        },
        quickUrgentOnly: false
      });
      get().addToast('Filter direset', 'info');
    },

    // AI actions
    openAiPrompt: () => set({ isAiPromptOpen: true }),
    closeAiPrompt: () => set({ isAiPromptOpen: false }),
    setGeminiApiKey: (key: string) => {
      const cleanKey = key.trim();
      if (typeof window !== 'undefined') {
        localStorage.setItem('WTC_GEMINI_API_KEY', cleanKey);
      }
      set({ geminiApiKey: cleanKey });
      get().addToast('API Key Gemini berhasil disimpan', 'success');
    },

    addAIActionLog: (logData) => {
      const state = get();
      const newLogId = `LOG_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newLog: AIActionLog = {
        ...logData,
        id: newLogId,
        timestamp: new Date().toISOString(),
        isReverted: false
      };
      const updatedLogs = [newLog, ...(state.aiActionLogs || [])].slice(0, 50);
      const nowIso = new Date().toISOString();

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        deletedTasks: state.deletedTasks || [],
        aiActionLogs: updatedLogs,
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({ aiActionLogs: updatedLogs });
      return newLogId;
    },

    revertAIAction: (logId: string) => {
      const state = get();
      const targetLog = (state.aiActionLogs || []).find(l => l.id === logId);
      if (!targetLog) return;
      if (targetLog.isReverted) {
        get().addToast('Aksi ini sudah dibatalkan sebelumnya', 'info');
        return;
      }

      let updatedTasks = state.tasks;
      let updatedDeletedTasks = state.deletedTasks || [];
      const nowIso = new Date().toISOString();

      if (targetLog.type === 'UPDATE_STAGE' && targetLog.taskId && targetLog.prevStageId) {
        updatedTasks = state.tasks.map(t => {
          if (t.id === targetLog.taskId) {
            return {
              ...t,
              stageId: targetLog.prevStageId!,
              subStatus: targetLog.prevSubStatus || t.subStatus,
              lastActionDate: getTodayIso()
            };
          }
          return t;
        });
      } else if (targetLog.type === 'DELETE_TASK' && targetLog.taskId) {
        // Restore soft-deleted task from deletedTasks back to tasks
        const taskToRestore = updatedDeletedTasks.find(t => t.id === targetLog.taskId);
        if (taskToRestore) {
          updatedDeletedTasks = updatedDeletedTasks.filter(t => t.id !== targetLog.taskId);
          updatedTasks = [taskToRestore, ...updatedTasks];
        }
      }

      // Mark log as reverted
      const updatedLogs = (state.aiActionLogs || []).map(l => {
        if (l.id === logId) {
          return { ...l, isReverted: true };
        }
        return l;
      });

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: updatedTasks,
        deletedTasks: updatedDeletedTasks,
        aiActionLogs: updatedLogs,
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({
        tasks: updatedTasks,
        deletedTasks: updatedDeletedTasks,
        aiActionLogs: updatedLogs,
        lastModified: nowIso
      });
      get().addToast(`Aksi "${targetLog.description}" berhasil dibatalkan`, 'info');
      scheduleAutoPush();
    },

    clearAIActionLogs: () => {
      const state = get();
      const updatedLogs: AIActionLog[] = [];
      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        deletedTasks: state.deletedTasks || [],
        aiActionLogs: updatedLogs,
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: state.lastModified,
        lastSyncedAt: state.lastSyncedAt
      };
      persistWorkspaceData(updatedData);
      set({ aiActionLogs: updatedLogs });
      get().addToast('Riwayat aksi AI berhasil dibersihkan', 'info');
    },

    addAiActionLog: (logData) => get().addAIActionLog(logData),
    undoAiAction: (logId) => get().revertAIAction(logId),
    clearAiActionLogs: () => get().clearAIActionLogs(),

    // Recycle bin actions
    openRecycleBin: () => set({ isRecycleBinOpen: true }),
    closeRecycleBin: () => set({ isRecycleBinOpen: false }),

    openTaskModal: (taskId = null, prefillData = null) => {
      set({
        isTaskModalOpen: true,
        editingTaskId: taskId || null,
        prefilledTaskData: prefillData || null
      });
    },

    closeTaskModal: () => {
      set({
        isTaskModalOpen: false,
        editingTaskId: null,
        prefilledTaskData: null
      });
    },

    saveTask: (formData: TaskFormData) => {
      const state = get();
      const nowIso = new Date().toISOString();
      let updatedTasks: Task[];

      if (formData.id) {
        // Edit existing task
        updatedTasks = state.tasks.map(t => {
          if (t.id === formData.id) {
            const reminderChanged = (t.reminderAt || null) !== (formData.reminderAt || null);
            return {
              ...t,
              title: formData.title.trim(),
              category: formData.category,
              priority: formData.priority,
              dateCreated: formData.dateCreated,
              deadline: formData.deadline,
              picHq: formData.picHq,
              storeIds: formData.storeIds,
              stageId: formData.stageId,
              subStatus: formData.subStatus,
              notes: formData.notes.trim(),
              reminderAt: formData.reminderAt || null,
              reminderNotified: reminderChanged ? false : (t.reminderNotified ?? false),
              lastActionDate: getTodayIso()
            };
          }
          return t;
        });
        get().addToast('Task berhasil diperbarui', 'success');
      } else {
        // Add new task
        const newId = `T${Math.floor(100 + Math.random() * 900)}`;
        const newTask: Task = {
          id: newId,
          title: formData.title.trim(),
          category: formData.category,
          priority: formData.priority,
          dateCreated: formData.dateCreated || getTodayIso(),
          deadline: formData.deadline,
          picHq: formData.picHq,
          storeIds: formData.storeIds,
          stageId: formData.stageId || 'BACKLOG',
          subStatus: formData.subStatus || 'AWAITING_ASSETS',
          notes: formData.notes.trim(),
          reminderAt: formData.reminderAt || null,
          reminderNotified: false,
          snoozedUntil: null,
          followUpReason: '',
          lastActionDate: getTodayIso()
        };
        updatedTasks = [newTask, ...state.tasks];
        get().addToast('Task baru berhasil ditambahkan', 'success');
      }

      const updatedWorkspaceData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: updatedTasks,
        deletedTasks: state.deletedTasks || [],
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedWorkspaceData);
      set({
        tasks: updatedTasks,
        lastModified: nowIso,
        isTaskModalOpen: false,
        editingTaskId: null,
        prefilledTaskData: null
      });

      scheduleAutoPush();
    },

    deleteTask: (taskId: string) => {
      get().createEmergencySnapshot();

      const state = get();
      const taskIndex = state.tasks.findIndex(t => t.id === taskId);
      const taskToDelete = state.tasks[taskIndex];
      if (!taskToDelete) return;

      const updatedTasks = state.tasks.filter(t => t.id !== taskId);
      const taskWithDeletedAt: Task = {
        ...taskToDelete,
        lastActionDate: getTodayIso()
      };
      const updatedDeletedTasks = [taskWithDeletedAt, ...(state.deletedTasks || [])];
      const nowIso = new Date().toISOString();

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: updatedTasks,
        deletedTasks: updatedDeletedTasks,
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({
        tasks: updatedTasks,
        deletedTasks: updatedDeletedTasks,
        lastDeletedTask: { task: taskToDelete, index: taskIndex },
        lastModified: nowIso,
        isTaskModalOpen: false,
        editingTaskId: null,
        prefilledTaskData: null
      });

      get().addToast(
        `Task "${taskToDelete.title}" dipindahkan ke sampah`,
        'info',
        {
          label: 'Undo',
          onClick: () => get().undoDeleteTask()
        },
        7000
      );
      scheduleAutoPush();
    },

    undoDeleteTask: () => {
      const state = get();
      const last = state.lastDeletedTask;
      if (!last) return;

      const restoredTask = last.task;
      const updatedDeletedTasks = (state.deletedTasks || []).filter(t => t.id !== restoredTask.id);

      const newTasks = [...state.tasks];
      const insertIndex = Math.min(Math.max(0, last.index), newTasks.length);
      newTasks.splice(insertIndex, 0, restoredTask);
      const nowIso = new Date().toISOString();

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: newTasks,
        deletedTasks: updatedDeletedTasks,
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({
        tasks: newTasks,
        deletedTasks: updatedDeletedTasks,
        lastDeletedTask: null,
        lastModified: nowIso
      });

      get().addToast(`Task "${restoredTask.title}" berhasil dipulihkan`, 'success');
      scheduleAutoPush();
    },

    restoreTask: (taskId: string) => {
      const state = get();
      const taskToRestore = (state.deletedTasks || []).find(t => t.id === taskId);
      if (!taskToRestore) return;

      const updatedDeletedTasks = (state.deletedTasks || []).filter(t => t.id !== taskId);
      const newTasks = [taskToRestore, ...state.tasks];
      const nowIso = new Date().toISOString();

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: newTasks,
        deletedTasks: updatedDeletedTasks,
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({
        tasks: newTasks,
        deletedTasks: updatedDeletedTasks,
        lastModified: nowIso
      });

      get().addToast(`Task "${taskToRestore.title}" berhasil dipulihkan`, 'success');
      scheduleAutoPush();
    },

    permanentlyDeleteTask: (taskId: string) => {
      get().createEmergencySnapshot();
      const state = get();
      const updatedDeletedTasks = (state.deletedTasks || []).filter(t => t.id !== taskId);
      const nowIso = new Date().toISOString();

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        deletedTasks: updatedDeletedTasks,
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({
        deletedTasks: updatedDeletedTasks,
        lastModified: nowIso
      });

      get().addToast('Task dihapus permanen', 'info');
      scheduleAutoPush();
    },

    emptyRecycleBin: () => {
      get().createEmergencySnapshot();
      const state = get();
      const count = (state.deletedTasks || []).length;
      if (count === 0) return;

      const nowIso = new Date().toISOString();
      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        deletedTasks: [],
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({
        deletedTasks: [],
        lastDeletedTask: null,
        lastModified: nowIso
      });

      get().addToast(`${count} task dihapus permanen dari keranjang sampah`, 'info');
      scheduleAutoPush();
    },

    moveTaskStage: (taskId: string, newStageId: StageId, newSubStatus?: string) => {
      const state = get();
      const nowIso = new Date().toISOString();

      const defaultSubStatusForStage = newSubStatus ||
        WTC_CONFIG.SUB_STATUSES.find(s => s.stageId === newStageId)?.id ||
        (newStageId === 'COMPLETED' ? 'COMPLETED_INSTALLED' : 'AWAITING_ASSETS');

      const updatedTasks = state.tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            stageId: newStageId,
            subStatus: defaultSubStatusForStage,
            lastActionDate: getTodayIso()
          };
        }
        return t;
      });

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: updatedTasks,
        deletedTasks: state.deletedTasks || [],
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({ tasks: updatedTasks, lastModified: nowIso });
      scheduleAutoPush();
    },

    markReminderNotified: (taskId: string) => {
      const state = get();
      const updatedTasks = state.tasks.map(t => {
        if (t.id === taskId) {
          return { ...t, reminderNotified: true };
        }
        return t;
      });

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: updatedTasks,
        deletedTasks: state.deletedTasks || [],
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: state.lastModified,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({ tasks: updatedTasks });
    },

    openSnoozeModal: (taskId: string) => {
      set({ isSnoozeModalOpen: true, snoozeTaskId: taskId });
    },

    closeSnoozeModal: () => {
      set({ isSnoozeModalOpen: false, snoozeTaskId: null });
    },

    applySnooze: (taskId: string, snoozeUntilIso: string, followUpReason = '') => {
      const state = get();
      const nowIso = new Date().toISOString();

      const updatedTasks = state.tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            snoozedUntil: snoozeUntilIso,
            followUpReason: followUpReason.trim(),
            lastActionDate: getTodayIso()
          };
        }
        return t;
      });

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: updatedTasks,
        deletedTasks: state.deletedTasks || [],
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({
        tasks: updatedTasks,
        lastModified: nowIso,
        isSnoozeModalOpen: false,
        snoozeTaskId: null
      });

      get().addToast(`Follow-up dijadwalkan hingga ${snoozeUntilIso}`, 'success');
      scheduleAutoPush();
    },

    clearSnooze: (taskId: string) => {
      const state = get();
      const nowIso = new Date().toISOString();

      const updatedTasks = state.tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            snoozedUntil: null,
            followUpReason: '',
            lastActionDate: getTodayIso()
          };
        }
        return t;
      });

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: updatedTasks,
        deletedTasks: state.deletedTasks || [],
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({
        tasks: updatedTasks,
        lastModified: nowIso,
        isSnoozeModalOpen: false,
        snoozeTaskId: null
      });

      get().addToast('Snooze dinonaktifkan', 'info');
      scheduleAutoPush();
    },

    wakeAllSnoozed: () => {
      const state = get();
      const nowIso = new Date().toISOString();

      const updatedTasks = state.tasks.map(t => ({
        ...t,
        snoozedUntil: null
      }));

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: updatedTasks,
        deletedTasks: state.deletedTasks || [],
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({ tasks: updatedTasks, lastModified: nowIso });
      get().addToast('Semua kartu snooze berhasil diaktifkan kembali', 'success');
      scheduleAutoPush();
    },

    markTaskCompleted: (taskId: string) => {
      get().moveTaskStage(taskId, 'COMPLETED', 'COMPLETED_INSTALLED');
      set({ isSnoozeModalOpen: false, snoozeTaskId: null });
      get().addToast('Task ditandai selesai', 'success');
    },

    openDirectoryModal: (tab = 'stores') => {
      set({ isDirectoryModalOpen: true, directoryTab: tab });
    },

    closeDirectoryModal: () => {
      set({ isDirectoryModalOpen: false });
    },

    setDirectoryTab: (tab: 'stores' | 'pics' | 'categories') => {
      set({ directoryTab: tab });
    },

    addStore: (newStoreData) => {
      const state = get();
      const newId = `S${String(state.stores.length + 1).padStart(2, '0')}_${Date.now().toString().slice(-4)}`;
      const newStore: Store = {
        id: newId,
        no: state.stores.length + 1,
        ...newStoreData
      };
      const updatedStores = [...state.stores, newStore];
      const nowIso = new Date().toISOString();

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        deletedTasks: state.deletedTasks || [],
        stores: updatedStores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({ stores: updatedStores, lastModified: nowIso });
      get().addToast(`Toko "${newStore.name}" berhasil ditambahkan`, 'success');
      scheduleAutoPush();
      return newStore;
    },

    deleteStore: (storeId: string) => {
      const state = get();
      const updatedStores = state.stores.filter(s => s.id !== storeId);
      const nowIso = new Date().toISOString();

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        deletedTasks: state.deletedTasks || [],
        stores: updatedStores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({ stores: updatedStores, lastModified: nowIso });
      get().addToast('Toko berhasil dihapus', 'info');
      scheduleAutoPush();
    },

    addPic: (newPicData) => {
      const state = get();
      const newId = newPicData.name.toUpperCase().replace(/\s+/g, '_');
      const newPic: PIC = {
        id: newId,
        ...newPicData
      };
      const updatedPics = [...state.pics, newPic];
      const nowIso = new Date().toISOString();

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        deletedTasks: state.deletedTasks || [],
        stores: state.stores,
        pics: updatedPics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({ pics: updatedPics, lastModified: nowIso });
      get().addToast(`PIC "${newPic.name}" berhasil ditambahkan`, 'success');
      scheduleAutoPush();
    },

    deletePic: (picId: string) => {
      const state = get();
      const updatedPics = state.pics.filter(p => p.id !== picId);
      const nowIso = new Date().toISOString();

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        deletedTasks: state.deletedTasks || [],
        stores: state.stores,
        pics: updatedPics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({ pics: updatedPics, lastModified: nowIso });
      get().addToast('PIC berhasil dihapus', 'info');
      scheduleAutoPush();
    },

    addCategory: (categoryName: string) => {
      const trimmed = categoryName.trim();
      if (!trimmed) return;
      const state = get();
      if (state.categories.includes(trimmed)) {
        get().addToast('Kategori sudah ada', 'info');
        return;
      }
      const updatedCategories = [...state.categories, trimmed];
      const nowIso = new Date().toISOString();

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        deletedTasks: state.deletedTasks || [],
        stores: state.stores,
        pics: state.pics,
        categories: updatedCategories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({ categories: updatedCategories, lastModified: nowIso });
      get().addToast(`Kategori "${trimmed}" ditambahkan`, 'success');
      scheduleAutoPush();
    },

    deleteCategory: (categoryName: string) => {
      const state = get();
      const updatedCategories = state.categories.filter(c => c !== categoryName);
      const nowIso = new Date().toISOString();

      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        deletedTasks: state.deletedTasks || [],
        stores: state.stores,
        pics: state.pics,
        categories: updatedCategories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: nowIso,
        lastSyncedAt: state.lastSyncedAt
      };

      persistWorkspaceData(updatedData);
      set({ categories: updatedCategories, lastModified: nowIso });
      get().addToast('Kategori dihapus', 'info');
      scheduleAutoPush();
    },

    openCloudModal: () => set({ isCloudModalOpen: true }),
    closeCloudModal: () => set({ isCloudModalOpen: false }),

    setGasWebhookUrl: (url: string) => {
      const state = get();
      const updatedData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        deletedTasks: state.deletedTasks || [],
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: url.trim(),
        lastModified: state.lastModified,
        lastSyncedAt: state.lastSyncedAt
      };
      persistWorkspaceData(updatedData);
      set({ gasWebhookUrl: url.trim() });
      get().addToast('URL Webhook disimpan', 'success');
    },

    toggleAutoSync: (enabled: boolean) => {
      localStorage.setItem(WTC_CONFIG.AUTOSYNC_KEY, enabled ? '1' : '0');
      set({ autoSyncEnabled: enabled });
      if (enabled) {
        get().addToast('Auto-Sync AKTIF', 'success');
        if (get().gasWebhookUrl) get().pullFromGoogleSheets(false, true);
      } else {
        if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
        get().addToast('Auto-Sync DIMATIKAN — data lokal tetap aman', 'info');
      }
    },

    pushToGoogleSheets: async (silent = false) => {
      const state = get();
      if (!state.gasWebhookUrl) {
        if (!silent) get().addToast('URL Google Apps Script belum diisi', 'error');
        return false;
      }

      set({ syncStatus: { message: 'Menyimpan ke Cloud...', type: 'syncing' } });

      const currentWorkspaceData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: state.lastModified || new Date().toISOString(),
        lastSyncedAt: state.lastSyncedAt
      };

      try {
        const response = await fetch(state.gasWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'SAVE_ALL', payload: currentWorkspaceData })
        });
        const res = await response.json();

        if (res && (res.status === 'SAVED' || res.status === 'OK')) {
          const nowIso = new Date().toISOString();
          const updatedData = { ...currentWorkspaceData, lastSyncedAt: nowIso };
          persistWorkspaceData(updatedData);
          set({
            lastSyncedAt: nowIso,
            syncStatus: {
              message: `Tersinkronisasi ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
              type: 'ok'
            }
          });
          if (!silent) get().addToast('Berhasil disimpan ke Google Sheets', 'success');
          return true;
        } else {
          throw new Error(res.message || 'Respon server tidak valid');
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal sinkronisasi';
        set({ syncStatus: { message: 'Gagal Sinkron - Data Lokal Aman', type: 'error' } });
        if (!silent) get().addToast(`Gagal Push: ${message}`, 'error');
        return false;
      }
    },

    pullFromGoogleSheets: async (force = false, silent = false) => {
      const state = get();
      if (!state.gasWebhookUrl) {
        if (!silent) get().addToast('URL Google Apps Script belum diisi', 'error');
        return false;
      }

      set({ syncStatus: { message: 'Mengambil dari Cloud...', type: 'syncing' } });

      try {
        const sep = state.gasWebhookUrl.includes('?') ? '&' : '?';
        const response = await fetch(`${state.gasWebhookUrl}${sep}action=LOAD_ALL`);
        const res = await response.json();

        if (!res || !res.payload || !Array.isArray(res.payload.tasks)) {
          throw new Error('Payload cloud tidak valid atau kosong');
        }

        const remote = res.payload as WorkspaceData;

        // Verify workspace name
        if (remote.workspaceName && remote.workspaceName !== state.activeWorkspace) {
          if (!silent) get().addToast(`Cloud berisi "${remote.workspaceName}" — bukan workspace aktif`, 'info');
          set({ syncStatus: { message: 'Cloud workspace lain — local aman', type: 'ok' } });
          return false;
        }

        // Check timestamps if not forced
        if (!force && remote.lastModified && state.lastModified) {
          const remoteTime = new Date(remote.lastModified).getTime();
          const localTime = new Date(state.lastModified).getTime();
          if (remoteTime <= localTime) {
            set({
              syncStatus: {
                message: `Tersinkronisasi ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
                type: 'ok'
              }
            });
            if (!silent) get().addToast('Data lokal sudah paling mutakhir', 'info');
            return true;
          }
        }

        get().createEmergencySnapshot();

        const merged: WorkspaceData = {
          workspaceName: state.activeWorkspace,
          tasks: remote.tasks,
          deletedTasks: remote.deletedTasks || state.deletedTasks || [],
          stores: remote.stores && remote.stores.length > 0 ? remote.stores : state.stores,
          pics: remote.pics && remote.pics.length > 0 ? remote.pics : state.pics,
          categories: remote.categories && remote.categories.length > 0 ? remote.categories : state.categories,
          gasWebhookUrl: state.gasWebhookUrl,
          lastModified: remote.lastModified || new Date().toISOString(),
          lastSyncedAt: new Date().toISOString()
        };

        persistWorkspaceData(merged);
        set({
          tasks: merged.tasks,
          deletedTasks: merged.deletedTasks,
          stores: merged.stores,
          pics: merged.pics,
          categories: merged.categories,
          lastModified: merged.lastModified,
          lastSyncedAt: merged.lastSyncedAt,
          syncStatus: {
            message: `Tersinkronisasi ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
            type: 'ok'
          }
        });

        if (!silent) get().addToast('Data cloud berhasil diterapkan', 'success');
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal sinkronisasi';
        set({ syncStatus: { message: 'Gagal Sinkron - Data Lokal Aman', type: 'error' } });
        if (!silent) get().addToast(`Gagal Pull: ${message}`, 'error');
        return false;
      }
    },

    exportBackupJson: () => {
      const state = get();
      const currentWorkspaceData: WorkspaceData = {
        workspaceName: state.activeWorkspace,
        tasks: state.tasks,
        deletedTasks: state.deletedTasks || [],
        stores: state.stores,
        pics: state.pics,
        categories: state.categories,
        gasWebhookUrl: state.gasWebhookUrl,
        lastModified: state.lastModified,
        lastSyncedAt: state.lastSyncedAt
      };
      const jsonStr = JSON.stringify(currentWorkspaceData, null, 2);
      const fileName = `antonio_workspace_${state.activeWorkspace.replace(/\s+/g, '_').toLowerCase()}_${getTodayIso()}.json`;
      downloadFile(jsonStr, fileName, 'application/json');
      get().addToast('File JSON backup berhasil diunduh', 'success');
    },

    importBackupJson: (fileContent: string) => {
      try {
        const parsed = JSON.parse(fileContent);
        if (!parsed || !Array.isArray(parsed.tasks)) {
          get().addToast('Format file JSON tidak valid', 'error');
          return false;
        }

        get().createEmergencySnapshot();

        const state = get();
        const nowIso = new Date().toISOString();
        const merged: WorkspaceData = {
          workspaceName: parsed.workspaceName || state.activeWorkspace,
          tasks: parsed.tasks,
          deletedTasks: Array.isArray(parsed.deletedTasks) ? parsed.deletedTasks : state.deletedTasks || [],
          stores: Array.isArray(parsed.stores) && parsed.stores.length > 0 ? parsed.stores : state.stores,
          pics: Array.isArray(parsed.pics) && parsed.pics.length > 0 ? parsed.pics : state.pics,
          categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : state.categories,
          gasWebhookUrl: state.gasWebhookUrl,
          lastModified: nowIso,
          lastSyncedAt: state.lastSyncedAt
        };

        persistWorkspaceData(merged);
        set({
          tasks: merged.tasks,
          deletedTasks: merged.deletedTasks,
          stores: merged.stores,
          pics: merged.pics,
          categories: merged.categories,
          lastModified: nowIso
        });

        get().addToast(`Berhasil restore ${parsed.tasks.length} task dari file JSON`, 'success');
        scheduleAutoPush();
        return true;
      } catch (e) {
        console.error('Import error:', e);
        get().addToast('Gagal memproses file JSON', 'error');
        return false;
      }
    },

    exportCsv: () => {
      const state = get();
      const csvStr = exportTasksCsv(state.tasks, state.stores);
      const fileName = `tasks_${state.activeWorkspace.replace(/\s+/g, '_').toLowerCase()}_${getTodayIso()}.csv`;
      downloadFile(csvStr, fileName, 'text/csv;charset=utf-8;');
      get().addToast('File CSV berhasil diekspor', 'success');
    },

    createEmergencySnapshot: () => {
      const state = get();
      try {
        const backup: EmergencyBackup = {
          timestamp: new Date().toISOString(),
          workspaceName: state.activeWorkspace,
          state: {
            workspaceName: state.activeWorkspace,
            tasks: state.tasks,
            deletedTasks: state.deletedTasks || [],
            stores: state.stores,
            pics: state.pics,
            categories: state.categories,
            gasWebhookUrl: state.gasWebhookUrl,
            lastModified: state.lastModified,
            lastSyncedAt: state.lastSyncedAt
          }
        };
        localStorage.setItem(WTC_CONFIG.EMERGENCY_BACKUP_KEY, JSON.stringify(backup));
      } catch (e) {
        console.error('Failed to create emergency snapshot:', e);
      }
    },

    rollbackEmergencySnapshot: () => {
      try {
        const raw = localStorage.getItem(WTC_CONFIG.EMERGENCY_BACKUP_KEY);
        if (!raw) {
          get().addToast('Tidak ada snapshot darurat yang tersimpan', 'info');
          return false;
        }

        const backup = JSON.parse(raw) as EmergencyBackup;
        if (!backup || !backup.state || !Array.isArray(backup.state.tasks)) {
          get().addToast('Data snapshot darurat rusak', 'error');
          return false;
        }

        persistWorkspaceData(backup.state);
        set({
          activeWorkspace: backup.state.workspaceName,
          tasks: backup.state.tasks,
          deletedTasks: backup.state.deletedTasks || [],
          stores: backup.state.stores,
          pics: backup.state.pics,
          categories: backup.state.categories,
          gasWebhookUrl: backup.state.gasWebhookUrl,
          lastModified: backup.state.lastModified
        });

        get().addToast('Data berhasil dipulihkan dari snapshot darurat', 'success');
        return true;
      } catch (e) {
        console.error('Rollback error:', e);
        get().addToast('Gagal memulihkan snapshot darurat', 'error');
        return false;
      }
    },

    getStorageStats: () => {
      const state = get();
      let sizeKb = '0.00';
      try {
        const storageKey = `${WTC_CONFIG.STORAGE_KEY}_${state.activeWorkspace.replace(/\s+/g, '_')}`;
        const raw = localStorage.getItem(storageKey) || '';
        sizeKb = (new Blob([raw]).size / 1024).toFixed(2);
      } catch (e) {}

      let lastBackupTime: string | null = null;
      try {
        const rawBackup = localStorage.getItem(WTC_CONFIG.EMERGENCY_BACKUP_KEY);
        if (rawBackup) {
          const parsed = JSON.parse(rawBackup);
          lastBackupTime = parsed.timestamp || null;
        }
      } catch (e) {}

      return {
        taskCount: state.tasks.length,
        storeCount: state.stores.length,
        picCount: state.pics.length,
        categoryCount: state.categories.length,
        sizeKb,
        lastBackupTime
      };
    },

    setDraggedTaskId: (taskId: string | null) => set({ draggedTaskId: taskId }),

    addToast: (message: string, type = 'info', action?: ToastAction, duration = 3500) => {
      const id = `${Date.now()}_${Math.random()}`;
      set(state => ({
        toasts: [...state.toasts, { id, message, type, action, duration }]
      }));
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    },

    removeToast: (id: string) => {
      set(state => ({
        toasts: state.toasts.filter(t => t.id !== id)
      }));
    }
  };
});
