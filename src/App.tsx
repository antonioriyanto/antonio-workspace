import React, { useEffect } from 'react';
import { Header } from './components/Header';
import { PriorityStrip } from './components/PriorityStrip';
import { FilterBar } from './components/FilterBar';
import { KanbanBoard } from './components/KanbanBoard';
import { SheetView } from './components/SheetView';
import { TaskModal } from './components/TaskModal';
import { SnoozeModal } from './components/SnoozeModal';
import { DirectoryModal } from './components/DirectoryModal';
import { CloudModal } from './components/CloudModal';
import { AIPromptBar } from './components/AIPromptBar';
import { RecycleBinModal } from './components/RecycleBinModal';
import { ToastContainer } from './components/ToastContainer';
import { useWorkspaceStore } from './store/useWorkspaceStore';
import { useReminderEngine } from './hooks/useReminderEngine';

export const App: React.FC = () => {
  useReminderEngine();

  const {
    viewMode,
    init,
    isTaskModalOpen,
    closeSnoozeModal,
    closeDirectoryModal,
    closeCloudModal,
    closeRecycleBin,
    closeAiPrompt,
    openAiPrompt
  } = useWorkspaceStore();

  useEffect(() => {
    init();

    // Global keyboard listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcut Ctrl+K / Cmd+K to open Conversational AI Task Creator
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openAiPrompt();
        return;
      }

      // Escape key handler:
      // Note: TaskModal manages its own Escape key internally with dirty-check safeguard,
      // so we skip closing TaskModal here to prevent accidental data loss.
      if (e.key === 'Escape') {
        if (isTaskModalOpen) return;
        closeSnoozeModal();
        closeDirectoryModal();
        closeCloudModal();
        closeRecycleBin();
        closeAiPrompt();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    init,
    isTaskModalOpen,
    closeSnoozeModal,
    closeDirectoryModal,
    closeCloudModal,
    closeRecycleBin,
    closeAiPrompt,
    openAiPrompt
  ]);

  return (
    <div className="min-h-screen flex flex-col selection:bg-zinc-700 selection:text-white">
      {/* Sticky Header */}
      <Header />

      {/* Priority Strip Briefing Banner */}
      <PriorityStrip />

      {/* Search and Filters Bar */}
      <FilterBar />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto px-4 lg:px-6 py-4">
        {viewMode === 'kanban' ? <KanbanBoard /> : <SheetView />}
      </main>

      {/* Modals & Command Palettes */}
      <TaskModal />
      <SnoozeModal />
      <DirectoryModal />
      <CloudModal />
      <AIPromptBar />
      <RecycleBinModal />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
};

export default App;
