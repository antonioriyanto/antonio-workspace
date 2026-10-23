import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  ArrowRight,
  Loader2,
  Key,
  HelpCircle,
  Check,
  AlertCircle,
  History,
  ExternalLink,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { parseConversationalTask, findMatchingTasks } from '../services/aiTaskService';
import { getTodayIso } from '../utils/dateUtils';
import { Task, TaskFormData, StageId, AICommandResult } from '../types';

const EXAMPLE_PROMPTS = [
  'Ada berapa task telat hari ini dan siapa saja PIC-nya?',
  'bikin task baru kartu ucapan pic bu evy deadline besok jam 3 sore toko wtc grand mall',
  'desain request pop promo urgent hari ini selesai untuk desain pic itho',
  'tandai selesai task kartu ucapan lalu bikin task baru poster promo ramadhan',
  'buat new task deadline awal oktober posm karakter jam buat season natal pic bu evy keterangan bikin mock up dlu taruh di backlog',
  'hapus task flyer opening wtc',
  'filter task bu evy yang urgent'
];

interface CandidateSelectionState {
  candidates: Task[];
  intent: 'UPDATE_TASK' | 'DELETE_TASK';
  targetStageId?: StageId;
  targetSubStatus?: string;
  chainedAction?: AICommandResult | null;
  query: string;
}

interface ZeroMatchState {
  query: string;
  actionType: 'UPDATE' | 'DELETE';
}

interface AIAnswerState {
  answer: string;
  taskIds?: string[] | null;
}

export const AIPromptBar: React.FC = () => {
  const {
    isAiPromptOpen,
    closeAiPrompt,
    tasks,
    pics,
    categories,
    stores,
    activeWorkspace,
    openTaskModal,
    addToast,
    geminiApiKey,
    setGeminiApiKey,
    addStore,
    setFilter,
    toggleQuickUrgent,
    quickUrgentOnly,
    moveTaskStage,
    deleteTask,
    aiActionLogs,
    addAIActionLog,
    revertAIAction,
    clearAIActionLogs
  } = useWorkspaceStore();

  const [promptText, setPromptText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // AI Q&A Answer state with optional taskIds for interactive mini cards
  const [aiAnswer, setAiAnswer] = useState<AIAnswerState | null>(null);

  // Interactive Action Chips states
  const [candidateSelection, setCandidateSelection] = useState<CandidateSelectionState | null>(null);
  const [zeroMatchPrompt, setZeroMatchPrompt] = useState<ZeroMatchState | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isAiPromptOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setTempKey(geminiApiKey);
      setShowKeyInput(!geminiApiKey);
      setErrorMessage(null);
      setAiAnswer(null);
      setCandidateSelection(null);
      setZeroMatchPrompt(null);
    }
  }, [isAiPromptOpen, geminiApiKey]);

  if (!isAiPromptOpen) return null;

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempKey.trim()) return;
    setGeminiApiKey(tempKey.trim());
    setSavedKeySuccess(true);
    setTimeout(() => {
      setSavedKeySuccess(false);
      setShowKeyInput(false);
    }, 1200);
  };

  /**
   * Helper to execute chained CREATE_TASK intent
   */
  const handleChainedCreateTask = (chainedAction: AICommandResult) => {
    if (!chainedAction.task) return;
    let storeIds = [...(chainedAction.task.storeIds || ['ALL_STORES'])];

    if (chainedAction.newStore?.name) {
      const rawStoreName = chainedAction.newStore.name.trim();
      const existing = stores.find(s => s.name.toLowerCase() === rawStoreName.toLowerCase());
      if (existing) {
        if (!storeIds.includes(existing.id)) {
          storeIds = storeIds.filter(id => id !== 'ALL_STORES').concat(existing.id);
        }
      } else {
        const created = addStore({ name: rawStoreName, am: chainedAction.newStore.am || '', spv: '' });
        storeIds = storeIds.filter(id => id !== 'ALL_STORES').concat(created.id);
        addToast(`Toko baru "${rawStoreName}" otomatis didaftarkan`, 'info');
      }
    }

    const taskDataToPrefill: TaskFormData = {
      ...chainedAction.task,
      storeIds: storeIds.length > 0 ? storeIds : ['ALL_STORES']
    };

    addAIActionLog({
      type: 'CREATE_TASK',
      description: `Buka form task baru lanjutan: "${taskDataToPrefill.title}" (PIC: ${taskDataToPrefill.picHq})`,
      taskTitle: taskDataToPrefill.title
    });

    closeAiPrompt();
    setPromptText('');
    setCandidateSelection(null);
    setZeroMatchPrompt(null);
    openTaskModal(null, taskDataToPrefill);
  };

  /**
   * Action when user selects one candidate task from interactive chips
   */
  const handleSelectCandidate = (task: Task) => {
    if (!candidateSelection) return;

    const { intent, targetStageId, targetSubStatus, chainedAction } = candidateSelection;

    if (intent === 'DELETE_TASK') {
      deleteTask(task.id);
      const logId = addAIActionLog({
        type: 'DELETE_TASK',
        description: `Hapus task "${task.title}" (#${task.id}) ke Recycle Bin`,
        taskId: task.id,
        taskTitle: task.title
      });

      if (chainedAction && chainedAction.intent === 'CREATE_TASK' && chainedAction.task) {
        handleChainedCreateTask(chainedAction);
        addToast(`Task "${task.title}" dipindahkan ke Recycle Bin & Form task baru dibuka!`, 'success');
      } else {
        closeAiPrompt();
        setPromptText('');
        setCandidateSelection(null);
        addToast(
          `Task "${task.title}" dipindahkan ke Recycle Bin`,
          'info',
          {
            label: 'Undo',
            onClick: () => revertAIAction(logId)
          },
          7000
        );
      }
    } else if (intent === 'UPDATE_TASK') {
      const newStage = targetStageId || 'COMPLETED';
      moveTaskStage(task.id, newStage, targetSubStatus);

      const logId = addAIActionLog({
        type: 'UPDATE_STAGE',
        description: `Pindahkan "${task.title}" ke stage ${newStage}`,
        taskId: task.id,
        taskTitle: task.title,
        prevStageId: task.stageId,
        prevSubStatus: task.subStatus,
        newStageId: newStage,
        newSubStatus: targetSubStatus
      });

      if (chainedAction && chainedAction.intent === 'CREATE_TASK' && chainedAction.task) {
        handleChainedCreateTask(chainedAction);
        addToast(`Task "${task.title}" dipindahkan ke ${newStage} & Form task baru dibuka!`, 'success');
      } else {
        closeAiPrompt();
        setPromptText('');
        setCandidateSelection(null);
        addToast(
          `Task "${task.title}" dipindahkan ke ${newStage}`,
          'success',
          {
            label: 'Undo',
            onClick: () => revertAIAction(logId)
          },
          7000
        );
      }
    }
  };

  /**
   * Action when user clicks 0% match chip to create task
   */
  const handleCreateFromZeroMatch = (titleText: string) => {
    const isPersonal = activeWorkspace === 'Personal Project';
    const defaultPic = isPersonal
      ? (pics.find(p => p.name.toUpperCase() === 'ANTONIO')?.name || 'ANTONIO')
      : (pics[0]?.name || 'BU EVY');

    const defaultCategory = isPersonal
      ? (categories.find(c => c.toLowerCase() === 'digital') || 'Digital')
      : (categories[0] || 'Poster');

    const draft: TaskFormData = {
      title: titleText.toUpperCase(),
      category: defaultCategory,
      priority: 'MEDIUM',
      dateCreated: getTodayIso(),
      deadline: getTodayIso(),
      picHq: defaultPic,
      storeIds: ['ALL_STORES'],
      stageId: 'CREATIVE',
      subStatus: 'IN_DESIGN',
      notes: 'Dibuat cepat dari saran AI Command Bar',
      reminderAt: null,
      reminderNotified: false
    };

    addAIActionLog({
      type: 'CREATE_TASK',
      description: `Buat task baru dari saran AI: "${draft.title}"`,
      taskTitle: draft.title
    });

    closeAiPrompt();
    setPromptText('');
    setZeroMatchPrompt(null);
    setCandidateSelection(null);
    openTaskModal(null, draft);
    addToast(`Membuka form task baru: "${draft.title}"`, 'info');
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptText.trim()) return;

    if (!geminiApiKey && !tempKey.trim()) {
      setShowKeyInput(true);
      addToast('Masukkan API Key Gemini terlebih dahulu', 'error');
      return;
    }

    setErrorMessage(null);
    setAiAnswer(null);
    setCandidateSelection(null);
    setZeroMatchPrompt(null);
    setIsLoading(true);

    try {
      const todayIso = getTodayIso();
      const parsed = await parseConversationalTask(
        promptText,
        {
          tasks,
          pics,
          categories,
          stores,
          todayIso,
          activeWorkspace
        },
        geminiApiKey || tempKey.trim()
      );

      // 0. ANSWER_QUERY intent
      if (parsed.intent === 'ANSWER_QUERY') {
        setAiAnswer({
          answer: parsed.answer || parsed.explanation || 'Informasi berhasil didapatkan.',
          taskIds: parsed.taskIds || null
        });
        addToast('🤖 Pertanyaan berhasil dijawab AI', 'info');
        return;
      }

      // 1. FILTER_BOARD intent
      if (parsed.intent === 'FILTER_BOARD' && parsed.filter) {
        if (parsed.filter.quickUrgentOnly && !quickUrgentOnly) {
          toggleQuickUrgent();
        }
        if (parsed.filter.search !== undefined) setFilter('search', parsed.filter.search);
        if (parsed.filter.priority) setFilter('priority', parsed.filter.priority);
        if (parsed.filter.picHq) setFilter('picHq', parsed.filter.picHq);
        if (parsed.filter.am) setFilter('am', parsed.filter.am);
        if (parsed.filter.store) setFilter('store', parsed.filter.store);
        if (parsed.filter.category) setFilter('category', parsed.filter.category);

        addAIActionLog({
          type: 'FILTER_BOARD',
          description: `Filter board: ${parsed.explanation || 'Kriteria filter diterapkan'}`
        });

        closeAiPrompt();
        setPromptText('');
        setErrorMessage(null);
        addToast(`🔍 Filter diterapkan: ${parsed.explanation || 'Tampilan board diperbarui'}`, 'info');
        return;
      }

      // 2. DELETE_TASK intent (Soft-delete via AI)
      if (parsed.intent === 'DELETE_TASK') {
        const query = parsed.delete?.targetQuery || promptText;
        const matchResult = findMatchingTasks(query, tasks);

        if (matchResult.exactMatch) {
          const target = matchResult.exactMatch;
          deleteTask(target.id);

          const logId = addAIActionLog({
            type: 'DELETE_TASK',
            description: `Hapus task "${target.title}" (#${target.id}) ke Recycle Bin`,
            taskId: target.id,
            taskTitle: target.title
          });

          // Check for chained action
          if (parsed.chainedAction && parsed.chainedAction.intent === 'CREATE_TASK' && parsed.chainedAction.task) {
            handleChainedCreateTask(parsed.chainedAction);
            addToast(`Task "${target.title}" dipindahkan ke Recycle Bin & Form task baru dibuka!`, 'success');
            return;
          }

          closeAiPrompt();
          setPromptText('');
          setErrorMessage(null);

          addToast(
            `Task "${target.title}" dipindahkan ke Recycle Bin`,
            'info',
            {
              label: 'Undo',
              onClick: () => {
                revertAIAction(logId);
              }
            },
            7000
          );
          return;
        } else if (matchResult.candidates.length > 0) {
          // Multiple matches or generic stop word guardrail triggered -> show interactive selection chips
          setCandidateSelection({
            candidates: matchResult.candidates,
            intent: 'DELETE_TASK',
            chainedAction: parsed.chainedAction,
            query
          });
          addToast(`Pilih task yang ingin dihapus dari ${matchResult.candidates.length} opsi di bawah`, 'info');
          return;
        } else {
          // 0% match
          setZeroMatchPrompt({
            query,
            actionType: 'DELETE'
          });
          addToast(`Task "${query}" tidak ditemukan`, 'error');
          return;
        }
      }

      // 3. UPDATE_TASK intent
      if (parsed.intent === 'UPDATE_TASK' && parsed.update) {
        const query = parsed.update.targetQuery || promptText;
        const matchResult = findMatchingTasks(query, tasks);
        const newStage = parsed.update.targetStageId || 'COMPLETED';
        const newSubStatus = parsed.update.targetSubStatus;

        if (matchResult.exactMatch) {
          const targetTask = matchResult.exactMatch;
          const prevStage = targetTask.stageId;
          const prevSubStatus = targetTask.subStatus;

          moveTaskStage(targetTask.id, newStage, newSubStatus);

          const logId = addAIActionLog({
            type: 'UPDATE_STAGE',
            description: `Pindahkan "${targetTask.title}" ke stage ${newStage}`,
            taskId: targetTask.id,
            taskTitle: targetTask.title,
            prevStageId: prevStage,
            prevSubStatus: prevSubStatus,
            newStageId: newStage,
            newSubStatus: newSubStatus
          });

          // Multi-Intent Chaining: execute secondary action if present
          if (parsed.chainedAction && parsed.chainedAction.intent === 'CREATE_TASK' && parsed.chainedAction.task) {
            handleChainedCreateTask(parsed.chainedAction);
            addToast(`Task "${targetTask.title}" dipindahkan ke ${newStage} & Form task baru dibuka!`, 'success');
            return;
          }

          closeAiPrompt();
          setPromptText('');
          setErrorMessage(null);

          // Interactive toast with 7-second undo button synchronized with log
          addToast(
            `Task "${targetTask.title}" dipindahkan ke ${newStage}`,
            'success',
            {
              label: 'Undo',
              onClick: () => {
                revertAIAction(logId);
              }
            },
            7000
          );
          return;
        } else if (matchResult.candidates.length > 0) {
          // Multiple matches or generic stop word guardrail -> show candidate selection chips
          setCandidateSelection({
            candidates: matchResult.candidates,
            intent: 'UPDATE_TASK',
            targetStageId: newStage,
            targetSubStatus: newSubStatus,
            chainedAction: parsed.chainedAction,
            query
          });
          addToast(`Pilih task yang ingin dipindahkan dari ${matchResult.candidates.length} opsi di bawah`, 'info');
          return;
        } else {
          // 0% match: offer quick task creation chip
          setZeroMatchPrompt({
            query,
            actionType: 'UPDATE'
          });
          addToast(`Task "${query}" tidak ditemukan`, 'error');
          return;
        }
      }

      // 4. CREATE_TASK intent (default)
      if (parsed.task) {
        let storeIds = [...(parsed.task.storeIds || ['ALL_STORES'])];

        // Auto-register new store if detected
        if (parsed.newStore?.name) {
          const rawStoreName = parsed.newStore.name.trim();
          const existing = stores.find(s => s.name.toLowerCase() === rawStoreName.toLowerCase());
          if (existing) {
            if (!storeIds.includes(existing.id)) {
              storeIds = storeIds.filter(id => id !== 'ALL_STORES').concat(existing.id);
            }
          } else {
            const created = addStore({ name: rawStoreName, am: parsed.newStore.am || '', spv: '' });
            storeIds = storeIds.filter(id => id !== 'ALL_STORES').concat(created.id);
            addToast(`Toko baru "${rawStoreName}" otomatis didaftarkan`, 'info');
          }
        }

        const taskDataToPrefill: TaskFormData = {
          ...parsed.task,
          storeIds: storeIds.length > 0 ? storeIds : ['ALL_STORES']
        };

        addAIActionLog({
          type: 'CREATE_TASK',
          description: `Buka form task baru: "${taskDataToPrefill.title}" (PIC: ${taskDataToPrefill.picHq})`,
          taskTitle: taskDataToPrefill.title
        });

        closeAiPrompt();
        setPromptText('');
        setErrorMessage(null);
        openTaskModal(null, taskDataToPrefill);
        addToast(
          parsed.newStore
            ? '✨ Task dianalisis AI (Toko baru otomatis didaftarkan)! Silakan tinjau sebelum disimpan.'
            : '✨ Task berhasil dianalisis AI! Silakan tinjau sebelum disimpan.',
          'success'
        );
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses prompt dengan AI';
      setErrorMessage(msg);
      addToast(msg.length > 80 ? msg.slice(0, 80) + '...' : msg, 'error');
      if (msg.includes('API Key')) {
        setShowKeyInput(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) closeAiPrompt();
      }}
    >
      <div className="glass-panel bg-white/95 dark:bg-[#0e0e12]/95 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500/20 via-purple-500/20 to-blue-500/20 text-blue-500 dark:text-blue-400 flex items-center justify-center border border-blue-500/30 shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  Conversational AI Assistant & Command Bar
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
                  Gemini Flash
                </span>
                {activeWorkspace === 'Personal Project' && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                    Personal
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Tanya status board, cari/filter task, atau buat task baru secara langsung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setShowHistory(prev => !prev);
                setShowKeyInput(false);
              }}
              className={`p-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                showHistory
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                  : 'glass-control text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
              title="Riwayat Aksi AI"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Riwayat</span>
              {aiActionLogs.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] flex items-center justify-center font-bold">
                  {aiActionLogs.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowKeyInput(prev => !prev);
                setShowHistory(false);
              }}
              className={`p-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                showKeyInput || !geminiApiKey
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'glass-control text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
              title="Atur API Key Gemini"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">API Key</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={closeAiPrompt}
              className="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* AI Action History Panel (Collapsible) */}
        {showHistory && (
          <div className="px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/70 space-y-3 animate-in slide-in-from-top-1 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                <History className="w-3.5 h-3.5 text-blue-500" />
                <span>Riwayat Aksi AI ({aiActionLogs.length})</span>
              </div>
              {aiActionLogs.length > 0 && (
                <button
                  type="button"
                  onClick={clearAIActionLogs}
                  className="text-[11px] text-zinc-400 hover:text-rose-500 flex items-center gap-1 transition"
                  title="Bersihkan semua log aksi"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Hapus Riwayat</span>
                </button>
              )}
            </div>

            {aiActionLogs.length === 0 ? (
              <p className="text-[11px] text-zinc-400 italic py-3 text-center">
                Belum ada riwayat mutasi / aksi AI yang tercatat.
              </p>
            ) : (
              <div className="space-y-2">
                {aiActionLogs.map((log) => {
                  const timeFormatted = new Date(log.timestamp).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-white dark:bg-zinc-950/70 border border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
                              log.type === 'UPDATE_STAGE'
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                : log.type === 'CREATE_TASK'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : log.type === 'DELETE_TASK'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            }`}
                          >
                            {log.type === 'UPDATE_STAGE'
                              ? 'UPDATE'
                              : log.type === 'CREATE_TASK'
                              ? 'CREATE'
                              : log.type === 'DELETE_TASK'
                              ? 'DELETE'
                              : 'FILTER'}
                          </span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                            {log.description}
                          </span>
                          {log.isReverted && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-medium">
                              Dibatalkan
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          {timeFormatted}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {log.taskId && log.type !== 'DELETE_TASK' && (
                          <button
                            type="button"
                            onClick={() => {
                              closeAiPrompt();
                              openTaskModal(log.taskId);
                            }}
                            className="px-2 py-1 rounded text-[11px] glass-control text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 hover:bg-blue-500/10 transition"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Lihat Task</span>
                          </button>
                        )}

                        {(log.type === 'UPDATE_STAGE' || log.type === 'DELETE_TASK') && (
                          <button
                            type="button"
                            disabled={log.isReverted}
                            onClick={() => revertAIAction(log.id)}
                            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                              log.isReverted
                                ? 'opacity-40 cursor-not-allowed text-zinc-400'
                                : 'glass-control text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                            }`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{log.isReverted ? 'Dibatalkan' : 'Batalkan'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* API Key Panel (Collapsible) */}
        {showKeyInput && (
          <div className="px-5 py-3 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/60 animate-in slide-in-from-top-1">
            <form onSubmit={handleSaveApiKey} className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>Google Gemini API Key</span>
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-500 hover:underline flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Dapatkan Key Gratis di Google AI Studio</span>
                </a>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium text-xs flex items-center gap-1 shadow-sm"
                >
                  {savedKeySuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tersimpan</span>
                    </>
                  ) : (
                    <span>Simpan Key</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Prompt Input Form */}
        <div className="p-5 space-y-4">
          <div className="relative">
            <textarea
              ref={inputRef}
              rows={4}
              value={promptText}
              disabled={isLoading}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Contoh: buat new task deadline awal oktober posm karakter jam buat season natal pic bu evy keterangan bikin mock up dlu taruh di backlog..."
              className="w-full p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 resize-none transition shadow-inner leading-relaxed"
            />

            {isLoading && (
              <div className="absolute inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-xs rounded-xl flex items-center justify-center gap-2.5 text-xs font-medium text-blue-600 dark:text-blue-400 animate-in fade-in duration-150">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span>Sedang menganalisis prompt dengan Gemini AI...</span>
              </div>
            )}
          </div>

          {/* Error Details Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
              <div className="flex-1 space-y-1">
                <div className="font-semibold text-rose-700 dark:text-rose-300">
                  Kendala Menghubungi Gemini AI:
                </div>
                <div className="font-mono text-[11px] whitespace-pre-wrap leading-relaxed opacity-95">
                  {errorMessage}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="p-1 rounded-md hover:bg-rose-500/10 text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 transition"
                title="Tutup pesan error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Interactive Action Chips: Candidate Selection */}
          {candidateSelection && candidateSelection.candidates.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {candidateSelection.candidates.length} Task Ditemukan untuk "{candidateSelection.query}":
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCandidateSelection(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Klik salah satu task di bawah untuk {candidateSelection.intent === 'DELETE_TASK' ? 'dihapus' : 'dipindahkan'}:
              </p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pt-1">
                {candidateSelection.candidates.slice(0, 8).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleSelectCandidate(task)}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-400 text-xs text-left transition flex items-center gap-2 group shadow-xs active:scale-95"
                  >
                    <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-semibold group-hover:underline">
                      #{task.id}
                    </span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]">
                      {task.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-500 font-mono">
                      {task.stageId}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Action Chips: 0% Match Found */}
          {zeroMatchPrompt && (
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-2 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Task "{zeroMatchPrompt.query}" Tidak Ditemukan
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setZeroMatchPrompt(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Tidak ada task yang cocok untuk di{zeroMatchPrompt.actionType === 'DELETE' ? 'hapus' : 'perbarui'}. Apakah Anda ingin langsung membuat task baru dengan judul ini?
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleCreateFromZeroMatch(zeroMatchPrompt.query)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>+ Buat Task Baru: "{zeroMatchPrompt.query.toUpperCase()}"</span>
                </button>
              </div>
            </div>
          )}

          {/* AI Q&A Answer Box & Interactive Glassmorphic Cards Grid */}
          {aiAnswer && (
            <div className="p-4 rounded-xl bg-blue-500/10 dark:bg-blue-500/10 border border-blue-500/25 space-y-3 animate-in fade-in slide-in-from-top-1 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center border border-blue-500/30">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Jawaban AI Assistant:
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-medium">
                    Gemini Flash
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAiAnswer(null)}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
                  title="Tutup jawaban"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Anti-Slop: Direct, concise text */}
              <div className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 font-medium pl-8">
                {aiAnswer.answer}
              </div>

              {/* Interactive Glassmorphic Cards Grid */}
              {aiAnswer.taskIds && aiAnswer.taskIds.length > 0 && (
                <div className="pl-8 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {tasks
                      .filter(t => aiAnswer.taskIds?.includes(t.id))
                      .map(t => (
                        <div
                          key={t.id}
                          onClick={() => {
                            closeAiPrompt();
                            openTaskModal(t.id);
                          }}
                          className="p-2.5 rounded-xl bg-white dark:bg-zinc-950/80 hover:bg-zinc-50 dark:hover:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 hover:border-blue-500/50 dark:hover:border-blue-400/50 transition cursor-pointer group shadow-xs flex flex-col justify-between gap-1.5"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-semibold group-hover:underline">
                              #{t.id}
                            </span>
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-medium ${
                                  t.priority === 'CRITICAL'
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                    : t.priority === 'HIGH'
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                                }`}
                              >
                                {t.priority}
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                                {t.stageId}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-500 dark:group-hover:text-blue-400 transition">
                            {t.title}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-900">
                            <span>PIC: {t.picHq}</span>
                            <span className="font-mono">{t.deadline || '-'}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Examples */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <span>💡 Contoh prompt siap pakai (klik untuk mengisi):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setPromptText(ex);
                    setCandidateSelection(null);
                    setZeroMatchPrompt(null);
                  }}
                  className="text-left text-[11px] px-2.5 py-1 rounded-lg glass-control text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 dark:hover:border-zinc-600 transition truncate max-w-full"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
            <span className="text-[11px] text-zinc-400 hidden sm:inline">
              Tekan <kbd className="font-mono px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">Enter</kbd> untuk generate
            </span>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                disabled={isLoading}
                onClick={closeAiPrompt}
                className="px-3.5 py-1.5 rounded-lg glass-control text-xs font-medium"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isLoading || !promptText.trim()}
                onClick={() => handleGenerate()}
                className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-medium text-xs shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
                    <span>Proses Perintah</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
