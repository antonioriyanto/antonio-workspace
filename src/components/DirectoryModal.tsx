import React, { useState, useMemo } from 'react';
import { X, Store as StoreIcon, User, Tag, Search, Trash2, Plus } from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

export const DirectoryModal: React.FC = () => {
  const {
    isDirectoryModalOpen,
    directoryTab,
    setDirectoryTab,
    closeDirectoryModal,
    stores,
    pics,
    categories,
    addStore,
    deleteStore,
    addPic,
    deletePic,
    addCategory,
    deleteCategory
  } = useWorkspaceStore();

  // Store tab form state
  const [storeName, setStoreName] = useState('');
  const [storeAm, setStoreAm] = useState('');
  const [storeSpv, setStoreSpv] = useState('');
  const [storeSearch, setStoreSearch] = useState('');

  // PIC tab form state
  const [picName, setPicName] = useState('');
  const [picRole, setPicRole] = useState<'HQ' | 'AM'>('HQ');
  const [picColor, setPicColor] = useState('#6366f1');

  // Category tab form state
  const [categoryName, setCategoryName] = useState('');

  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return stores;
    const query = storeSearch.toLowerCase().trim();
    return stores.filter(s =>
      s.name.toLowerCase().includes(query) || (s.am && s.am.toLowerCase().includes(query))
    );
  }, [stores, storeSearch]);

  if (!isDirectoryModalOpen) return null;

  const handleAddStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;
    addStore({
      name: storeName.trim(),
      am: storeAm.trim(),
      spv: storeSpv.trim()
    });
    setStoreName('');
    setStoreAm('');
    setStoreSpv('');
  };

  const handleAddPic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!picName.trim()) return;
    addPic({
      name: picName.trim().toUpperCase(),
      role: picRole,
      color: picColor
    });
    setPicName('');
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    addCategory(categoryName.trim());
    setCategoryName('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDirectoryModal();
      }}
    >
      <div className="glass-panel bg-white/95 dark:bg-[#141417]/95 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-auto border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              Data Toko, Area Manager & PIC
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Kelola cabang Watch Club, kontak SPV, PIC HQ, dan kategori
            </p>
          </div>
          <button
            type="button"
            onClick={closeDirectoryModal}
            className="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-zinc-200/80 dark:border-zinc-800 flex gap-4">
          <button
            type="button"
            onClick={() => setDirectoryTab('stores')}
            className={`py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition ${
              directoryTab === 'stores'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <StoreIcon className="w-3.5 h-3.5" />
            <span>Toko & SPV ({stores.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDirectoryTab('pics')}
            className={`py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition ${
              directoryTab === 'pics'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Daftar PIC ({pics.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDirectoryTab('categories')}
            className={`py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition ${
              directoryTab === 'categories'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Kategori ({categories.length})</span>
          </button>
        </div>

        {/* Content Section */}
        <div className="p-5 max-h-[75vh] overflow-y-auto">
          {/* TAB 1: STORES */}
          {directoryTab === 'stores' && (
            <div className="space-y-4">
              {/* Add Store Form */}
              <form onSubmit={handleAddStore} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Nama Toko (mis. WTC Sorong)"
                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
                <input
                  type="text"
                  value={storeAm}
                  onChange={(e) => setStoreAm(e.target.value)}
                  placeholder="Area Manager (mis. ITHO)"
                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
                <input
                  type="text"
                  value={storeSpv}
                  onChange={(e) => setStoreSpv(e.target.value)}
                  placeholder="Nama SPV / Kontak Cabang"
                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium text-xs flex items-center justify-center gap-1 shadow-sm"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Toko</span>
                </button>
              </form>

              {/* Search Filter */}
              <div className="relative">
                <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  placeholder="Cari toko atau Area Manager..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
              </div>

              {/* Stores Table */}
              <div className="overflow-x-auto border border-zinc-200/80 dark:border-zinc-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 border-b border-zinc-200/80 dark:border-zinc-800">
                    <tr>
                      <th className="py-2 px-3 w-10 font-medium">#</th>
                      <th className="py-2 px-3 font-medium">Toko</th>
                      <th className="py-2 px-3 font-medium">Area Manager</th>
                      <th className="py-2 px-3 font-medium">SPV / Kontak</th>
                      <th className="py-2 px-3 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                    {filteredStores.map((st, idx) => (
                      <tr key={st.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-mono text-zinc-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium text-zinc-900 dark:text-zinc-100">{st.name}</td>
                        <td className="py-2 px-3 text-zinc-600 dark:text-zinc-300">{st.am || '-'}</td>
                        <td className="py-2 px-3 text-zinc-500">{st.spv || '-'}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => deleteStore(st.id)}
                            className="p-1 rounded text-zinc-400 hover:text-rose-500 transition"
                            title="Hapus toko"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PICS */}
          {directoryTab === 'pics' && (
            <div className="space-y-4">
              {/* Add PIC Form */}
              <form onSubmit={handleAddPic} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  required
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  placeholder="Nama PIC (mis. ICA)"
                  className="px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
                <select
                  value={picRole}
                  onChange={(e) => setPicRole(e.target.value as 'HQ' | 'AM')}
                  className="clean-select px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs"
                >
                  <option value="HQ">PIC HQ</option>
                  <option value="AM">Area Manager</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={picColor}
                    onChange={(e) => setPicColor(e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[11px] font-mono text-zinc-400">{picColor}</span>
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium text-xs flex items-center justify-center gap-1 shadow-sm"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah PIC</span>
                </button>
              </form>

              {/* PIC Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {pics.map(p => (
                  <div
                    key={p.id || p.name}
                    className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-2 bg-white/50 dark:bg-zinc-900/40"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.color || '#94a3b8' }}
                      />
                      <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {p.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {p.role}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => deletePic(p.id)}
                      className="p-1 rounded text-zinc-400 hover:text-rose-500 transition"
                      title="Hapus PIC"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CATEGORIES */}
          {directoryTab === 'categories' && (
            <div className="space-y-4">
              {/* Add Category Form */}
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Nama Kategori Baru (mis. Packaging)..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium text-xs flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah</span>
                </button>
              </form>

              {/* Categories Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {categories.map(cat => (
                  <div
                    key={cat}
                    className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-2 bg-white/50 dark:bg-zinc-900/40"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Tag className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                      <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {cat}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteCategory(cat)}
                      className="p-1 rounded text-zinc-400 hover:text-rose-500 transition"
                      title="Hapus kategori"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
