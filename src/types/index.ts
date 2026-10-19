export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type StageId = 'BACKLOG' | 'CREATIVE' | 'PRODUCTION' | 'LOGISTICS' | 'COMPLETED';

export interface Stage {
  id: StageId;
  title: string;
  dot: string;
}

export interface SubStatus {
  id: string;
  label: string;
  legacy?: string;
  stageId: StageId;
  dotColor: string;
  textAccent: string;
}

export interface Store {
  id: string;
  no: number;
  name: string;
  am: string;
  spv: string;
}

export interface PIC {
  id: string;
  name: string;
  role: 'HQ' | 'AM';
  color: string;
}

export interface Task {
  id: string;
  dateCreated: string;
  title: string;
  category: string;
  priority: Priority;
  deadline: string;
  picHq: string;
  storeIds: string[];
  stageId: StageId;
  subStatus: string;
  notes: string;
  snoozedUntil: string | null;
  followUpReason: string;
  lastActionDate: string | null;
}

export interface TaskFormData {
  id?: string;
  title: string;
  category: string;
  priority: Priority;
  dateCreated: string;
  deadline: string;
  picHq: string;
  storeIds: string[];
  stageId: StageId;
  subStatus: string;
  notes: string;
}

export interface TaskDraft extends TaskFormData {
  savedAt: string;
}

export interface WorkspaceData {
  workspaceName: string;
  tasks: Task[];
  stores: Store[];
  pics: PIC[];
  categories: string[];
  gasWebhookUrl: string;
  lastModified: string | null;
  lastSyncedAt: string | null;
}

export interface EmergencyBackup {
  timestamp: string;
  workspaceName: string;
  state: WorkspaceData;
}

export type ViewMode = 'kanban' | 'sheet';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface FilterState {
  search: string;
  priority: string;
  picHq: string;
  am: string;
  store: string;
  category: string;
}

export interface SyncStatus {
  message: string;
  type: 'ok' | 'syncing' | 'error';
}

export interface ToastMessage {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'error';
}
