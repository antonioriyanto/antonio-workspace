import { useState, useEffect, useCallback, useRef } from 'react';
import { TaskFormData, Priority, StageId } from '../types';
import { WTC_CONFIG } from '../config';
import { getTodayIso, addWorkingDays } from '../utils/dateUtils';

export function getDefaultFormData(): TaskFormData {
  const today = getTodayIso();
  return {
    title: '',
    category: WTC_CONFIG.DEFAULT_CATEGORIES[0] || 'Poster',
    priority: 'LOW' as Priority,
    dateCreated: today,
    deadline: addWorkingDays(today, 3),
    picHq: WTC_CONFIG.DEFAULT_PICS[0]?.name || 'BU EVY',
    storeIds: ['ALL_STORES'],
    stageId: 'BACKLOG' as StageId,
    subStatus: 'AWAITING_ASSETS',
    notes: '',
    reminderAt: null,
    reminderNotified: false
  };
}

export function useTaskDraft(
  activeWorkspace: string,
  isModalOpen: boolean,
  isEditing: boolean,
  initialEditData?: TaskFormData | null,
  prefillData?: TaskFormData | null
) {
  const storageKey = `${WTC_CONFIG.DRAFT_TASK_KEY}_${activeWorkspace.replace(/\s+/g, '_')}`;

  const [formData, setFormData] = useState<TaskFormData>(() => getDefaultFormData());
  const [isDraftRestored, setIsDraftRestored] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const isInitialMount = useRef(true);

  // Initialize form when modal opens or edit data changes
  useEffect(() => {
    if (!isModalOpen) {
      isInitialMount.current = true;
      return;
    }

    if (isEditing && initialEditData) {
      setFormData(initialEditData);
      setIsDraftRestored(false);
      setLastSavedTime(null);
      isInitialMount.current = false;
      return;
    }

    if (prefillData) {
      setFormData(prefillData);
      setIsDraftRestored(false);
      setLastSavedTime(null);
      isInitialMount.current = false;
      return;
    }

    // New task mode: check if draft exists in localStorage
    try {
      const savedRaw = localStorage.getItem(storageKey) || localStorage.getItem(WTC_CONFIG.DRAFT_TASK_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed && typeof parsed === 'object') {
          // If there's meaningful content
          const hasContent = Boolean(
            (parsed.title && parsed.title.trim().length > 0) ||
            (parsed.notes && parsed.notes.trim().length > 0) ||
            (parsed.storeIds && parsed.storeIds.length > 0 && !parsed.storeIds.includes('ALL_STORES'))
          );

          setFormData({
            title: parsed.title || '',
            category: parsed.category || WTC_CONFIG.DEFAULT_CATEGORIES[0],
            priority: parsed.priority || 'LOW',
            dateCreated: parsed.dateCreated || getTodayIso(),
            deadline: parsed.deadline || addWorkingDays(getTodayIso(), 3),
            picHq: parsed.picHq || WTC_CONFIG.DEFAULT_PICS[0]?.name || 'BU EVY',
            storeIds: Array.isArray(parsed.storeIds) && parsed.storeIds.length > 0 ? parsed.storeIds : ['ALL_STORES'],
            stageId: parsed.stageId || 'BACKLOG',
            subStatus: parsed.subStatus || 'AWAITING_ASSETS',
            notes: parsed.notes || ''
          });

          if (hasContent) {
            setIsDraftRestored(true);
            setLastSavedTime(parsed.savedAt ? new Date(parsed.savedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null);
          } else {
            setIsDraftRestored(false);
          }
        }
      } else {
        setFormData(getDefaultFormData());
        setIsDraftRestored(false);
        setLastSavedTime(null);
      }
    } catch (e) {
      console.warn('Failed to parse draft from localStorage:', e);
      setFormData(getDefaultFormData());
      setIsDraftRestored(false);
    }

    isInitialMount.current = false;
  }, [isModalOpen, isEditing, initialEditData, prefillData, storageKey]);

  // Auto-save to localStorage on every change when in "New Task" mode
  useEffect(() => {
    if (!isModalOpen || isEditing || isInitialMount.current) {
      return;
    }

    try {
      const now = new Date();
      const draftPayload = {
        ...formData,
        savedAt: now.toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(draftPayload));
      localStorage.setItem(WTC_CONFIG.DRAFT_TASK_KEY, JSON.stringify(draftPayload));
      setLastSavedTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Failed to auto-save task draft:', err);
    }
  }, [formData, isModalOpen, isEditing, storageKey]);

  // Update a single field
  const updateField = useCallback(<K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(WTC_CONFIG.DRAFT_TASK_KEY);
    } catch (e) {}
    setFormData(getDefaultFormData());
    setIsDraftRestored(false);
    setLastSavedTime(null);
  }, [storageKey]);

  // Call on save success to remove draft from localStorage
  const clearDraftOnSubmit = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(WTC_CONFIG.DRAFT_TASK_KEY);
    } catch (e) {}
    setIsDraftRestored(false);
    setLastSavedTime(null);
  }, [storageKey]);

  return {
    formData,
    setFormData,
    updateField,
    isDraftRestored,
    lastSavedTime,
    clearDraft,
    clearDraftOnSubmit
  };
}
