import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Check,
  Kanban,
  Table as TableIcon,
  Store,
  RefreshCw,
  Sun,
  Moon,
  Laptop,
  Plus
} from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { formatDateHuman, getTodayIso } from '../utils/dateUtils';

export const Header: React.FC = () => {
  const {
    activeWorkspace,
    workspaceList,
    switchWorkspace,
    viewMode,
    setViewMode,
    theme,
    setTheme,
    syncStatus,
    openTaskModal,
    openDirectoryModal,
    openCloudModal
  } = useWorkspaceStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const todayIso = getTodayIso();
  const humanDate = formatDateHuman(todayIso);

  return (
    <header className="sticky top-0 z-30 glass-panel border-t-0 border-x-0 px-4 lg:px-6 py-2.5">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Brand & Workspace Switcher */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-xs tracking-tighter shadow-sm">
            AR
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
              Antonio Riyanto
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>

            {/* Workspace Dropdown */}
            <div className="relative inline-block text-left" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(prev => !prev)}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium px-2 py-1 rounded-md glass-control"
              >
                <span>{activeWorkspace} Workspace</span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {isDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-52 rounded-xl glass-panel bg-white/95 dark:bg-[#141417]/95 shadow-2xl border border-zinc-200 dark:border-zinc-800 p-1.5 z-50">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Pilih Workspace
                  </div>
                  {workspaceList.map(ws => (
                    <button
                      key={ws}
                      type="button"
                      onClick={() => {
                        switchWorkspace(ws);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                        activeWorkspace === ws
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <span>{ws} Workspace</span>
                      {activeWorkspace === ws && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Date & Sync Indicator */}
          <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>{humanDate}</span>
            <span>·</span>
            <div
              className={`inline-flex items-center gap-1.5 ${
                syncStatus.type === 'error'
                  ? 'text-rose-500 dark:text-rose-400'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  syncStatus.type === 'syncing'
                    ? 'bg-amber-500 animate-pulse'
                    : syncStatus.type === 'error'
                    ? 'bg-rose-500'
                    : 'bg-emerald-500/80'
                }`}
              />
              <span className="truncate max-w-[200px]">{syncStatus.message}</span>
            </div>
          </div>
        </div>

        {/* Right Side Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg p-0.5 glass-control">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                viewMode === 'kanban'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <Kanban className="w-3 h-3" />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sheet')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                viewMode === 'sheet'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <TableIcon className="w-3 h-3" />
              <span>Tabel</span>
            </button>
          </div>

          {/* Directory Button */}
          <button
            type="button"
            onClick={() => openDirectoryModal('stores')}
            className="px-3 py-1.5 rounded-lg glass-control text-xs font-medium flex items-center gap-1.5"
            title="Kelola daftar Toko, Area Manager, SPV, PIC & Kategori"
          >
            <Store className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden md:inline">Toko & PIC</span>
          </button>

          {/* Cloud Sync Button */}
          <button
            type="button"
            onClick={openCloudModal}
            className="px-3 py-1.5 rounded-lg glass-control text-xs font-medium flex items-center gap-1.5"
            title="Backup data & sinkronisasi Google Sheets"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden md:inline">Sinkronisasi</span>
          </button>

          {/* Theme Switcher */}
          <div className="inline-flex rounded-lg p-0.5 glass-control" role="group">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded-md text-[11px] transition ${
                theme === 'light'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
              title="Mode Terang"
            >
              <Sun className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded-md text-[11px] transition ${
                theme === 'dark'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
              title="Mode Gelap"
            >
              <Moon className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('system')}
              className={`p-1.5 rounded-md text-[11px] transition ${
                theme === 'system'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
              title="Ikuti Sistem"
            >
              <Laptop className="w-3 h-3" />
            </button>
          </div>

          {/* New Task CTA */}
          <button
            type="button"
            onClick={() => openTaskModal(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-medium text-xs shadow-sm transition active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Task Baru</span>
          </button>
        </div>
      </div>
    </header>
  );
};
