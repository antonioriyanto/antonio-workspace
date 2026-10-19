const App = {
    state: null,
    viewMode: 'kanban',
    priorityStripCollapsed: false,
    quickUrgentOnly: false,
    activeSnoozeTaskId: null,
    draggedTaskId: null,
    debouncedRender: null,
    debouncedFilterStores: null,

    // Auto-sync
    autoSyncEnabled: true,
    _pushTimer: null,
    _pullTimer: null,
    _pendingPush: false,
    _isSyncing: false,
    _changeGen: 0,

    init() {
        this.autoSyncEnabled = localStorage.getItem('ANTONIO_AUTOSYNC_PREF') !== '0';
        this.state = StorageService.loadState();
        this.debouncedRender = this.debounce(() => this.renderAll(), 150);
        this.debouncedFilterStores = this.debounce(() => this.filterModalStores(), 150);
        this.initTheme();
        this.updateHeaderDate();
        this.updateWorkspaceUI();
        this.populateFilterDropdowns();
        this.renderAll();
        this.setupModalDismiss();
        this.setupAutoSync();

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            const pref = localStorage.getItem(WTC_CONFIG.THEME_KEY) || 'dark';
            if (pref === 'system') this.applyThemeClass('system');
        });

        window.addEventListener('click', (e) => {
            const menu = document.getElementById('workspaceDropdownMenu');
            if (menu && !e.target.closest('#workspaceDropdownMenu') && !e.target.closest('button[onclick*="toggleWorkspaceDropdown"]')) {
                menu.classList.add('hidden');
            }
        });
    },

    debounce(fn, wait) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), wait);
        };
    },

    setupModalDismiss() {
        const modals = ['taskModal', 'snoozeModal', 'directoryModal', 'cloudModal'];
        modals.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', (e) => {
                if (e.target === el) {
                    el.classList.add('hidden');
                    if (id === 'snoozeModal') this.activeSnoozeTaskId = null;
                }
            });
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modals.forEach(id => {
                    const el = document.getElementById(id);
                    if (el && !el.classList.contains('hidden')) {
                        el.classList.add('hidden');
                        if (id === 'snoozeModal') this.activeSnoozeTaskId = null;
                    }
                });
            }
        });
    },

    // ============================================================
    // AUTO-SYNC ENGINE
    // ============================================================

    setupAutoSync() {
        if (this.state.gasWebhookUrl && this.autoSyncEnabled) {
            setTimeout(() => this.autoPull(true), 1500);
        }

        this._pullTimer = setInterval(() => {
            if (this.state.gasWebhookUrl && this.autoSyncEnabled && document.visibilityState === 'visible') {
                this.autoPull(true);
            }
        }, 5 * 60 * 1000);

        window.addEventListener('beforeunload', () => this.flushPendingPush(true));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.flushPendingPush(true);
        });

        window.addEventListener('online', () => {
            if (this._pendingPush) this.flushPendingPush();
        });
    },

    scheduleAutoPush() {
        if (!this.state.gasWebhookUrl || !this.autoSyncEnabled) return;
        this._pendingPush = true;
        this._changeGen++;
        this.setSyncStatus('Menunggu sinkronisasi...', 'syncing');
        clearTimeout(this._pushTimer);
        this._pushTimer = setTimeout(() => this.flushPendingPush(), 2000);
    },

    async flushPendingPush(useBeacon = false) {
        if (!this._pendingPush || !this.state.gasWebhookUrl) return;

        if (useBeacon && typeof navigator.sendBeacon === 'function') {
            try {
                const blob = new Blob(
                    [JSON.stringify({ action: 'SAVE_ALL', payload: this.state })],
                    { type: 'text/plain;charset=utf-8' }
                );
                navigator.sendBeacon(this.state.gasWebhookUrl, blob);
                this._pendingPush = false;
            } catch (e) { /* allow retry */ }
            return;
        }

        if (this._isSyncing) {
            clearTimeout(this._pushTimer);
            this._pushTimer = setTimeout(() => this.flushPendingPush(), 500);
            return;
        }

        const stateAtStart = this.state;
        this._isSyncing = true;
        this._pendingPush = false;
        clearTimeout(this._pushTimer);

        try {
            this.setSyncStatus('Menyimpan ke Cloud...', 'syncing');
            const res = await StorageService.syncWithGoogleAppsScript('PUSH', stateAtStart);
            if (res && (res.status === 'SAVED' || res.status === 'OK')) {
                if (this.state === stateAtStart) {
                    stateAtStart.lastSyncedAt = new Date().toISOString();
                    StorageService.saveState(stateAtStart);
                }
                this.setSyncStatus(`Tersinkronisasi ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`);
            } else {
                throw new Error('Respon server tidak valid');
            }
        } catch (err) {
            this.setSyncStatus('Gagal Sinkron - Data Lokal Aman', 'error');
            this._pendingPush = true;
        } finally {
            this._isSyncing = false;
            if (this._pendingPush && this.state.gasWebhookUrl) {
                clearTimeout(this._pushTimer);
                this._pushTimer = setTimeout(() => this.flushPendingPush(), 10000);
            }
        }
    },

    async autoPull(silent = true, opts = {}) {
        const force = !!opts.force;
        if (this._isSyncing || !this.state.gasWebhookUrl) return;
        if (this._pendingPush && !force) {
            if (!silent) this.showToast('Perubahan lokal belum tersinkron — pull ditunda');
            return;
        }

        const genAtStart = this._changeGen;
        this._isSyncing = true;
        if (!silent) this.setSyncStatus('Mengambil dari Cloud...', 'syncing');

        try {
            const res = await StorageService.syncWithGoogleAppsScript('PULL', this.state);

            if (!res || !StorageService.validatePayload(res.payload)) {
                if (!silent) {
                    this.setSyncStatus('Gagal Sinkron - Data Lokal Aman', 'error');
                    this.showToast('Payload cloud kosong/rusak. Penimpaan ditolak.');
                }
                return;
            }

            const remote = res.payload;

            // Tolak jika cloud berisi workspace lain
            if (remote.workspaceName && remote.workspaceName !== this.state.workspaceName) {
                if (!silent) this.showToast(`Cloud berisi "${remote.workspaceName}" — bukan workspace aktif`);
                this.setSyncStatus('Cloud workspace lain — local dipertahankan');
                return;
            }

            // Cegah overwrite jika user edit selama fetch
            if (!force && (this._changeGen !== genAtStart || this._pendingPush)) {
                if (!silent) this.showToast('Ada perubahan baru — pull dibatalkan');
                return;
            }

            const remoteTs = remote.lastModified ? new Date(remote.lastModified).getTime() : 0;
            const localTs = this.state.lastModified ? new Date(this.state.lastModified).getTime() : 0;

            if (!force) {
                if (!remote.lastModified) {
                    this.setSyncStatus('Cloud versi lama — local dipertahankan');
                    return;
                }
                if (remoteTs <= localTs) {
                    this.setSyncStatus(`Tersinkronisasi ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`);
                    if (!silent) this.showToast('Cloud tidak lebih baru — data lokal aman');
                    return;
                }
            }

            this.adoptRemoteState(remote, { schedulePush: false, bumpTimestamp: false });
            this.updateWorkspaceUI();
            this.populateFilterDropdowns();
            this.renderAll();
            this.setSyncStatus(`Tersinkronisasi ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`);
            if (!silent) this.showToast('Data cloud diterapkan');
        } catch (err) {
            if (!silent) {
                this.setSyncStatus('Gagal Sinkron - Data Lokal Aman', 'error');
                this.showToast(err.message || 'Gagal sinkronisasi');
            }
        } finally {
            this._isSyncing = false;
        }
    },

    toggleAutoSync(enabled) {
        this.autoSyncEnabled = !!enabled;
        localStorage.setItem('ANTONIO_AUTOSYNC_PREF', this.autoSyncEnabled ? '1' : '0');
        if (this.autoSyncEnabled) {
            this.showToast('Auto-Sync AKTIF');
            if (this.state.gasWebhookUrl) this.autoPull(true);
        } else {
            clearTimeout(this._pushTimer);
            this._pendingPush = false;
            this.showToast('Auto-Sync DIMATIKAN — data lokal tetap tersimpan');
        }
    },

    // ============================================================
    // END AUTO-SYNC
    // ============================================================

    persistState(msg = 'Tersimpan Lokal') {
        this.state.lastModified = new Date().toISOString();
        StorageService.saveState(this.state);
        this.setSyncStatus(msg);
        this.scheduleAutoPush();
    },

    adoptRemoteState(payload, { schedulePush = false, bumpTimestamp = false } = {}) {
        const localUrl = this.state.gasWebhookUrl;
        this.state = payload;
        if (!this.state.gasWebhookUrl && localUrl) this.state.gasWebhookUrl = localUrl;
        if (bumpTimestamp) this.state.lastModified = new Date().toISOString();
        this.state.lastSyncedAt = new Date().toISOString();
        StorageService.saveState(this.state);
        if (schedulePush) this.scheduleAutoPush();
        else this.setSyncStatus('Tersimpan Lokal');
    },

    setSyncStatus(text, type = 'ok') {
        const el = document.getElementById('syncStatusIndicator');
        if (!el) return;
        let dotClass = 'bg-emerald-500/80';
        if (type === 'syncing') dotClass = 'bg-amber-500/80 animate-pulse';
        if (type === 'error') dotClass = 'bg-rose-500/80';
        el.className = `inline-flex items-center gap-1.5 ${type === 'error' ? 'text-rose-500 dark:text-rose-400' : 'text-zinc-500 dark:text-zinc-400'}`;
        el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${dotClass}"></span><span>${this.escapeHtml(text)}</span>`;
    },

    toggleWorkspaceDropdown(e) {
        if (e) e.stopPropagation();
        const menu = document.getElementById('workspaceDropdownMenu');
        if (menu) menu.classList.toggle('hidden');
    },

    switchWorkspace(wsName) {
        clearTimeout(this._pushTimer);
        this._pendingPush = false;
        localStorage.setItem(WTC_CONFIG.ACTIVE_WORKSPACE_KEY, wsName);
        this.state = StorageService.loadState();
        this.updateWorkspaceUI();
        this.populateFilterDropdowns();
        this.renderAll();
        this.toggleWorkspaceDropdown();
        this.setSyncStatus('Tersimpan Lokal');
        this.showToast(`Beralih ke Workspace: ${wsName}`, 'success');
        if (this.state.gasWebhookUrl && this.autoSyncEnabled) {
            setTimeout(() => this.autoPull(true), 800);
        }
    },

    updateWorkspaceUI() {
        const nameEl = document.getElementById('currentWorkspaceName');
        const ws = this.state.workspaceName || 'Watch Club';
        if (nameEl) nameEl.textContent = ws + ' Workspace';
        const checkWc = document.getElementById('wsCheck-WatchClub');
        const checkPers = document.getElementById('wsCheck-Personal');
        if (checkWc && checkPers) {
            checkWc.classList.toggle('hidden', ws !== 'Watch Club');
            checkPers.classList.toggle('hidden', ws !== 'Personal Project');
        }
    },

    initTheme() {
        const savedTheme = localStorage.getItem(WTC_CONFIG.THEME_KEY) || 'dark';
        this.setTheme(savedTheme, false);
    },

    setTheme(mode, notify = true) {
        localStorage.setItem(WTC_CONFIG.THEME_KEY, mode);
        this.applyThemeClass(mode);
        ['light', 'dark', 'system'].forEach(t => {
            const btn = document.getElementById(`themeBtn-${t}`);
            if (!btn) return;
            if (t === mode) {
                btn.className = 'p-1.5 rounded-md text-[11px] bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm transition';
            } else {
                btn.className = 'p-1.5 rounded-md text-[11px] text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition';
            }
        });
        if (notify) this.showToast(`Tema: ${mode}`, 'info');
    },

    applyThemeClass(mode) {
        const root = document.documentElement;
        if (mode === 'dark') root.classList.add('dark');
        else if (mode === 'light') root.classList.remove('dark');
        else {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('dark', isDark);
        }
    },

    getTodayIso() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },

    addWorkingDays(startDateObj, workingDaysToAdd) {
        const result = new Date(startDateObj.getTime());
        let added = 0;
        while (added < workingDaysToAdd) {
            result.setDate(result.getDate() + 1);
            const dow = result.getDay();
            if (dow !== 0 && dow !== 6) added++;
        }
        return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
    },

    formatDateHuman(isoDate) {
        if (!isoDate) return '-';
        const [y, m, d] = isoDate.split('-').map(Number);
        if (!y || !m || !d) return isoDate;
        return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    },

    formatDateShort(isoDate) {
        if (!isoDate) return '-';
        const [y, m, d] = isoDate.split('-').map(Number);
        if (!y || !m || !d) return isoDate;
        return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    },

    getDeadlineInfo(deadlineIso, stageId) {
        if (stageId === 'COMPLETED') return { status: 'COMPLETED', label: 'Selesai', textClass: 'text-emerald-600 dark:text-emerald-400' };
        if (!deadlineIso) return { status: 'NONE', label: '-', textClass: 'text-zinc-400' };
        const today = new Date(this.getTodayIso() + 'T00:00:00');
        const target = new Date(deadlineIso + 'T00:00:00');
        const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { status: 'OVERDUE', diffDays, label: `Lewat ${Math.abs(diffDays)}h · ${this.formatDateShort(deadlineIso)}`, textClass: 'text-rose-500 dark:text-[#FDA4AF] font-medium' };
        if (diffDays === 0) return { status: 'DUE_TODAY', diffDays: 0, label: `Hari ini · ${this.formatDateShort(deadlineIso)}`, textClass: 'text-amber-600 dark:text-amber-300 font-medium' };
        if (diffDays <= 2) return { status: 'DUE_SOON', diffDays, label: `H-${diffDays} · ${this.formatDateShort(deadlineIso)}`, textClass: 'text-orange-500 dark:text-orange-300' };
        return { status: 'NORMAL', diffDays, label: this.formatDateShort(deadlineIso), textClass: 'text-zinc-500 dark:text-zinc-400' };
    },

    getSnoozeState(task) {
        if (task.stageId === 'COMPLETED' || !task.snoozedUntil) return { isSnoozed: false, isFollowUpDue: false };
        const todayIso = this.getTodayIso();
        if (todayIso < task.snoozedUntil) return { isSnoozed: true, isFollowUpDue: false, untilFormatted: this.formatDateShort(task.snoozedUntil) };
        return { isSnoozed: false, isFollowUpDue: true, untilFormatted: this.formatDateShort(task.snoozedUntil) };
    },

    resolveStoresAndAmSpv(storeIds) {
        if (!storeIds || storeIds.length === 0 || storeIds.includes('ALL_STORES')) {
            return { isAllStores: true, storeNames: ['Semua Toko (HQ)'], amList: [], spvList: [], storesDetailed: [] };
        }
        const matched = storeIds.map(id => this.state.stores.find(s => s.id === id)).filter(Boolean);
        const amSet = new Set();
        const spvList = [];
        matched.forEach(st => {
            if (st.am) amSet.add(st.am);
            if (st.spv && st.spv.trim() !== '') spvList.push({ store: st.name, spv: st.spv.trim() });
        });
        return { isAllStores: false, storeNames: matched.map(s => s.name), amList: Array.from(