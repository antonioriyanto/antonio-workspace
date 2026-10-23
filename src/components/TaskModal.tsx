import React, { useState, useMemo, useEffect } from 'react';
import { X, Trash2, Search, Store as StoreIcon, Sparkles, RotateCcw, AlertTriangle, Bell, Plus } from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useTaskDraft } from '../hooks/useTaskDraft';
import { WTC_CONFIG } from '../config';
import { Priority, TaskFormData } from '../types';
import { resolveStoresAndAmSpv } from '../utils/storeUtils';

export const TaskModal: React.FC = () => {
  const {
    isTaskModalOpen,
    editingTaskId,
    prefilledTaskData,
    closeTaskModal,
    tasks,
    stores,
    pics,
    categories,
    saveTask,
    deleteTask,
    activeWorkspace,
    addStore,
    addToast
  } = useWorkspaceStore();

  const isEditing = Boolean(editingTaskId);
  const editingTask = useMemo(() => {
    if (!editingTaskId) return null;
    return tasks.find(t => t.id === editingTaskId) || null;
  }, [editingTaskId, tasks]);

  const initialEditData: TaskFormData | null = useMemo(() => {
    if (!editingTask) return null;
    return {
      id: editingTask.id,
      title: editingTask.title,
      category: editingTask.category,
      priority: editingTask.priority,
      dateCreated: editingTask.dateCreated,
      deadline: editingTask.deadline,
      picHq: editingTask.picHq,
      storeIds: editingTask.storeIds,
      stageId: editingTask.stageId,
      subStatus: editingTask.subStatus,
      notes: editingTask.notes,
      reminderAt: editingTask.reminderAt || null,
      reminderNotified: editingTask.reminderNotified ?? false
    };
  }, [editingTask]);

  const {
    formData,
    updateField,
    isDraftRestored,
    lastSavedTime,
    clearDraft,
    clearDraftOnSubmit
  } = useTaskDraft(activeWorkspace, isTaskModalOpen, isEditing, initialEditData, prefilledTaskData);

  // Store search filter inside modal
  const [storeFilterText, setStoreFilterText] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Dirty check to prevent accidental loss of in-progress input
  const isDirty = useMemo(() => {
    if (isEditing) {
      if (!initialEditData) return false;
      return (
        formData.title !== initialEditData.title ||
        formData.category !== initialEditData.category ||
        formData.priority !== initialEditData.priority ||
        formData.deadline !== initialEditData.deadline ||
        formData.picHq !== initialEditData.picHq ||
        formData.subStatus !== initialEditData.subStatus ||
        formData.notes !== initialEditData.notes ||
        formData.storeIds.join(',') !== initialEditData.storeIds.join(',')
      );
    }
    // New task mode
    return Boolean(
      formData.title.trim() !== '' ||
      formData.notes.trim() !== '' ||
      formData.priority !== 'LOW' ||
      formData.category !== WTC_CONFIG.DEFAULT_CATEGORIES[0] ||
      !formData.storeIds.includes('ALL_STORES')
    );
  }, [formData, isEditing, initialEditData]);

  const handleRequestClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      closeTaskModal();
    }
  };

  // Intercept Escape key specifically inside TaskModal
  useEffect(() => {
    if (!isTaskModalOpen) {
      setShowDiscardConfirm(false);
      return;
    }

    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else if (isDirty) {
          setShowDiscardConfirm(true);
        } else {
          closeTaskModal();
        }
      }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isTaskModalOpen, isDirty, showDiscardConfirm, closeTaskModal]);

  const filteredStores = useMemo(() => {
    if (!storeFilterText.trim()) return stores;
    const query = storeFilterText.toLowerCase().trim();
    return stores.filter(s =>
      s.name.toLowerCase().includes(query) || (s.am && s.am.toLowerCase().includes(query))
    );
  }, [stores, storeFilterText]);

  const resolvedPreview = useMemo(() => {
    return resolveStoresAndAmSpv(formData.storeIds, stores);
  }, [formData.storeIds, stores]);

  if (!isTaskModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    // Determine stageId from subStatus
    const matchedSubStatus = WTC_CONFIG.SUB_STATUSES.find(s => s.id === formData.subStatus);
    const resolvedStageId = matchedSubStatus?.stageId || formData.stageId || 'BACKLOG';

    saveTask({
      ...formData,
      stageId: resolvedStageId
    });

    if (!isEditing) {
      clearDraftOnSubmit();
    }
  };

  const handleDelete = () => {
    if (!editingTaskId) return;
    if (window.confirm('Yakin ingin memindahkan task ini ke keranjang sampah?')) {
      deleteTask(editingTaskId);
    }
  };

  const handleToggleStore = (storeId: string) => {
    const current = [...formData.storeIds];
    if (storeId === 'ALL_STORES') {
      updateField('storeIds', ['ALL_STORES']);
      return;
    }

    const withoutAll = current.filter(id => id !== 'ALL_STORES');
    if (withoutAll.includes(storeId)) {
      const remaining = withoutAll.filter(id => id !== storeId);
      updateField('storeIds', remaining.length > 0 ? remaining : ['ALL_STORES']);
    } else {
      updateField('storeIds', [...withoutAll, storeId]);
    }
  };

  const handleSelectAllStores = () => {
    updateField('storeIds', ['ALL_STORES']);
  };

  const handleClearStores = () => {
    updateField('storeIds', []);
  };

  const handleQuickAddStore = () => {
    const rawName = storeFilterText.trim();
    if (!rawName) return;

    const newStore = addStore({ name: rawName, am: '', spv: '' });
    const currentStoreIds = formData.storeIds.filter(id => id !== 'ALL_STORES');
    if (!currentStoreIds.includes(newStore.id)) {
      updateField('storeIds', [...currentStoreIds, newStore.id]);
    }
    setStoreFilterText('');
    addToast(`Toko "${rawName}" berhasil ditambahkan & dipilih`, 'success');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleRequestClose();
      }}
    >
      <div className="glass-panel bg-white/95 dark:bg-[#141417]/95 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                {isEditing ? 'Edit Detail Task' : 'Task Baru'}
              </h3>
              {!isEditing && isDraftRestored && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Draft restored</span>
                </span>
              )}
              {!isEditing && prefilledTaskData && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Sparkles className="w-2.5 h-2.5 text-blue-500" />
                  <span>Dari AI Parser</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {isEditing
                ? `ID: #${editingTaskId} · Terakhir diubah: ${editingTask?.lastActionDate || '-'}`
                : 'Pilih toko untuk menampilkan Area Manager & SPV secara otomatis'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && isDraftRestored && (
              <button
                type="button"
                onClick={clearDraft}
                className="text-[11px] text-zinc-400 hover:text-rose-500 flex items-center gap-1 px-2 py-1 rounded glass-control transition"
                title="Hapus draft yang tersimpan dan reset form"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Clear Draft</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleRequestClose}
              className="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Draft auto-save status banner */}
          {!isEditing && (
            <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Auto-save draft aktif (tersimpan di browser)</span>
              </span>
              {lastSavedTime && (
                <span className="font-mono text-[10px]">Tersimpan {lastSavedTime}</span>
              )}
            </div>
          )}

          {/* Row 1: Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Nama Task *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Mis. Poster Garmin WTC MOG 1 & 2"
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Kategori
              </label>
              <select
                value={formData.category}
                onChange={(e) => updateField('category', e.target.value)}
                className="clean-select w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Priority, Date Created, Deadline, Reminder */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Prioritas
              </label>
              <select
                value={formData.priority}
                onChange={(e) => updateField('priority', e.target.value as Priority)}
                className="clean-select w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Tanggal Masuk
              </label>
              <input
                type="date"
                value={formData.dateCreated}
                onChange={(e) => updateField('dateCreated', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Deadline *
              </label>
              <input
                type="date"
                required
                value={formData.deadline}
                onChange={(e) => updateField('deadline', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Bell className="w-3 h-3 text-amber-500" />
                  <span>Alarm</span>
                </span>
                {formData.reminderAt && (
                  <button
                    type="button"
                    onClick={() => updateField('reminderAt', null)}
                    className="text-[10px] text-zinc-400 hover:text-rose-500"
                  >
                    Hapus
                  </button>
                )}
              </label>
              <input
                type="datetime-local"
                value={formData.reminderAt || ''}
                onChange={(e) => updateField('reminderAt', e.target.value || null)}
                className="w-full px-2.5 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              />
            </div>
          </div>

          {/* Row 3: SubStatus, PIC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Status Progres
              </label>
              <select
                value={formData.subStatus}
                onChange={(e) => {
                  const newSubStatus = e.target.value;
                  const matched = WTC_CONFIG.SUB_STATUSES.find(s => s.id === newSubStatus);
                  updateField('subStatus', newSubStatus);
                  if (matched) {
                    updateField('stageId', matched.stageId);
                  }
                }}
                className="clean-select w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              >
                {WTC_CONFIG.SUB_STATUSES.map(sub => {
                  const stageObj = WTC_CONFIG.STAGES.find(s => s.id === sub.stageId);
                  return (
                    <option key={sub.id} value={sub.id}>
                      [{stageObj?.title}] {sub.label}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                PIC Pemberi Tugas
              </label>
              <select
                value={formData.picHq}
                onChange={(e) => updateField('picHq', e.target.value)}
                className="clean-select w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              >
                {pics.map(p => (
                  <option key={p.id || p.name} value={p.name}>
                    {p.name} ({p.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Multi Store Selection */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-medium text-zinc-800 dark:text-zinc-200">
                <StoreIcon className="w-3.5 h-3.5 inline mr-1 text-zinc-400" />
                Toko / Cabang (Bisa pilih lebih dari 1)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllStores}
                  className="px-2 py-1 rounded text-[11px] font-medium glass-control"
                >
                  Semua Toko (HQ)
                </button>
                <button
                  type="button"
                  onClick={handleClearStores}
                  className="px-2 py-1 rounded text-[11px] font-medium glass-control"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Store search input */}
            <div className="relative">
              <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={storeFilterText}
                onChange={(e) => setStoreFilterText(e.target.value)}
                placeholder="Cari nama toko atau Area Manager..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              />
            </div>

            {/* Quick Add Store button when no matching store */}
            {storeFilterText.trim() !== '' && filteredStores.length === 0 && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 flex flex-col sm:flex-row items-center justify-between gap-2.5 animate-in fade-in">
                <span className="text-xs text-zinc-700 dark:text-zinc-300">
                  Toko "<span className="font-semibold text-zinc-900 dark:text-zinc-100">{storeFilterText.trim()}</span>" belum ada di daftar.
                </span>
                <button
                  type="button"
                  onClick={handleQuickAddStore}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition inline-flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah "{storeFilterText.trim()}" sebagai Toko Baru</span>
                </button>
              </div>
            )}

            {/* Checkbox grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
              <label
                className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer border transition ${
                  formData.storeIds.includes('ALL_STORES')
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 border-transparent font-medium'
                    : 'bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.storeIds.includes('ALL_STORES')}
                  onChange={() => handleToggleStore('ALL_STORES')}
                  className="rounded accent-zinc-900 dark:accent-zinc-100"
                />
                <span>Semua Toko (HQ Promosi Nasional)</span>
              </label>

              {filteredStores.map(store => {
                const isSelected = formData.storeIds.includes(store.id);
                return (
                  <label
                    key={store.id}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition ${
                      isSelected
                        ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-400/50 font-medium'
                        : 'bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleStore(store.id)}
                        className="rounded accent-zinc-900 dark:accent-zinc-100"
                      />
                      <span className="truncate">{store.name}</span>
                    </div>
                    {store.am && (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono ml-1 flex-shrink-0">
                        AM: {store.am}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Live preview Area Manager & SPV */}
            <div className="pt-2 border-t border-zinc-200/70 dark:border-zinc-800 text-[11px] flex flex-wrap items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Toko Terpilih:</span>
              {resolvedPreview.isAllStores ? (
                <span className="px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px]">
                  Semua Toko (HQ)
                </span>
              ) : (
                <>
                  <span className="text-zinc-600 dark:text-zinc-300 font-medium">
                    {resolvedPreview.storeNames.length} toko
                  </span>
                  {resolvedPreview.amList.length > 0 && (
                    <span className="text-zinc-400">
                      · AM: {resolvedPreview.amList.join(', ')}
                    </span>
                  )}
                  {resolvedPreview.spvList.length > 0 && (
                    <span className="text-zinc-400">
                      · SPV: {resolvedPreview.spvList.map(s => `${s.store}: ${s.spv}`).join('; ')}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Row 5: Notes */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Catatan / Kendala
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Tulis progres terakhir atau kendala di lapangan..."
              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 text-xs font-medium transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Task</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleRequestClose}
                className="px-3.5 py-1.5 rounded-lg glass-control text-xs font-medium"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-medium text-xs shadow-sm transition"
              >
                Simpan
              </button>
            </div>
          </div>
        </form>

        {/* Safeguard Discard Confirmation Dialog */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-100">
            <div className="glass-panel bg-white/95 dark:bg-[#18181c]/95 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                    Perubahan Belum Disimpan
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    Ada input yang belum Anda simpan. Draf Anda tetap aman tersimpan di browser jika jendela ditutup.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200/70 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-3 py-1.5 rounded-lg glass-control text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Lanjut Mengedit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    closeTaskModal();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shadow-sm transition"
                >
                  Tutup Jendela
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

