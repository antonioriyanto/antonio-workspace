import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Stage, Task } from '../types';
import { TaskCard } from './TaskCard';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

interface KanbanColumnProps {
  stage: Stage;
  tasks: Task[];
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ stage, tasks }) => {
  const { moveTaskStage, openTaskModal } = useWorkspaceStore();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      moveTaskStage(taskId, stage.id);
    }
  };

  return (
    <div className="flex flex-col min-w-[280px] max-w-full rounded-2xl glass-panel p-2.5 space-y-2.5">
      {/* Column Header */}
      <div className="flex items-center justify-between px-1.5 pt-0.5">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
          <h2 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {stage.title}
          </h2>
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
            {tasks.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => openTaskModal(null)}
          className="w-6 h-6 rounded-lg glass-control flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
          title={`Tambah task baru di ${stage.title}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Column Cards Container / Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`kanban-col-body flex flex-col gap-2.5 min-h-[450px] p-1 transition-all rounded-xl ${
          isDragOver ? 'drag-over' : ''
        }`}
      >
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}

        {tasks.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-xl p-6 text-center text-zinc-400 dark:text-zinc-600 text-xs">
            <span>Tidak ada task</span>
          </div>
        )}
      </div>
    </div>
  );
};
