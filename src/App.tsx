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
import { ToastContainer } from './components/ToastContainer';
import { useWorkspaceStore } from './store/useWorkspaceStore';

export const App: React.FC = () => {
  const {
    viewMode,
    init,
    closeTaskModal,
    closeSnoozeModal,
    closeDirectoryModal,
    closeCloudModal
  } = useWorkspaceStore();

  useEffect(() => {
    init();

    // Global escape key handler to close modals
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeTaskModal();
        closeSnoozeModal();
        closeDirectoryModal();
        closeCloudModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [init, closeTaskModal, closeSnoozeModal, closeDirectoryModal, closeCloudModal]);

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

      {/* Modals */}
      <TaskModal />
      <SnoozeModal />
      <DirectoryModal />
      <CloudModal />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
};

export default App;
