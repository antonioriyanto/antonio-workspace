import React, { useMemo } from 'react';
import { Search, Flag, User, Compass, Store as StoreIcon, Tag, RotateCcw } from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

export const FilterBar: React.FC = () => {
  const {
    filters,
    setFilter,
    resetFilters,
    pics,
    stores,
    categories
  } = useWorkspaceStore();

  // Extract unique Area Managers from stores and PICs
  const areaManagers = useMemo(() => {
    const amSet = new Set<string>();
    stores.forEach(s => {
      if (s.am && s.am.trim() !== '') amSet.add(s.am.trim());
    });
    pics.forEach(p => {
      if (p.role === 'AM' && p.name) amSet.add(p.name.trim());
    });
    return Array.from(amSet).sort();
  }, [stores, pics]);

  return (
    <section className="max-w-[1920px] w-full mx-auto px-4 lg:px-6 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            placeholder="Cari task, toko, kendala, atau PIC..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg glass-panel text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition shadow-inner"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Priority Filter */}
          <div className="relative inline-flex items-center">
            <Flag className="w-3 h-3 absolute left-2.5 text-zinc-400 pointer-events-none" />
            <select
              value={filters.priority}
              onChange={(e) => setFilter('priority', e.target.value)}
              className="clean-select pl-7 py-1.5 rounded-lg glass-control text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Prioritas</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* PIC HQ Filter */}
          <div className="relative inline-flex items-center">
            <User className="w-3 h-3 absolute left-2.5 text-zinc-400 pointer-events-none" />
            <select
              value={filters.picHq}
              onChange={(e) => setFilter('picHq', e.target.value)}
              className="clean-select pl-7 py-1.5 rounded-lg glass-control text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua PIC</option>
              {pics.map(p => (
                <option key={p.id || p.name} value={p.name}>
                  {p.name} ({p.role})
                </option>
              ))}
            </select>
          </div>

          {/* Area Manager Filter */}
          <div className="relative inline-flex items-center">
            <Compass className="w-3 h-3 absolute left-2.5 text-zinc-400 pointer-events-none" />
            <select
              value={filters.am}
              onChange={(e) => setFilter('am', e.target.value)}
              className="clean-select pl-7 py-1.5 rounded-lg glass-control text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua AM</option>
              {areaManagers.map(am => (
                <option key={am} value={am}>
                  {am}
                </option>
              ))}
            </select>
          </div>

          {/* Store Filter */}
          <div className="relative inline-flex items-center">
            <StoreIcon className="w-3 h-3 absolute left-2.5 text-zinc-400 pointer-events-none" />
            <select
              value={filters.store}
              onChange={(e) => setFilter('store', e.target.value)}
              className="clean-select pl-7 py-1.5 rounded-lg glass-control text-xs font-medium max-w-[170px] truncate focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Toko</option>
              <option value="ALL_STORES">Semua Toko (HQ)</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative inline-flex items-center">
            <Tag className="w-3 h-3 absolute left-2.5 text-zinc-400 pointer-events-none" />
            <select
              value={filters.category}
              onChange={(e) => setFilter('category', e.target.value)}
              className="clean-select pl-7 py-1.5 rounded-lg glass-control text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <button
            type="button"
            onClick={resetFilters}
            className="p-1.5 rounded-lg glass-control text-xs hover:text-rose-500 transition"
            title="Reset semua filter"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
