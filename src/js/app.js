const App = {
    state: null,
    viewMode: 'kanban',
    priorityStripCollapsed: false,
    quickUrgentOnly: false,
    activeSnoozeTaskId: null,
    draggedTaskId: null,
    debouncedRender: null,
    debouncedFilterStores: null,

    init() {
        this.state = StorageService.loadState();
        this.debouncedRender = this.debounce(() => this.renderAll(), 150);
        this.debouncedFilterStores = this.debounce(() => this.filterModalStores(), 150);
        this.initTheme();
        this.updateHeaderDate();
        this.updateWorkspaceUI();
        this.populateFilterDropdowns();
        this.renderAll();
        this.setSyncStatus('Tersimpan Lokal');
        this.setupModalDismiss();

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

    persistState(msg = 'Tersimpan Lokal') {
        StorageService.saveState(this.state);
        this.setSyncStatus(msg);
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
        localStorage.setItem(WTC_CONFIG.ACTIVE_WORKSPACE_KEY, wsName);
        this.state = StorageService.loadState();
        this.updateWorkspaceUI();
        this.populateFilterDropdowns();
        this.renderAll();
        this.toggleWorkspaceDropdown();
        this.setSyncStatus('Tersimpan Lokal');
        this.showToast(`Beralih ke Workspace: ${wsName}`, 'success');
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
        return { isAllStores: false, storeNames: matched.map(s => s.name), amList: Array.from(amSet), spvList, storesDetailed: matched };
    },

    getPicBadgeStyle(picName) {
        const found = this.state.pics.find(p => p.name.toUpperCase() === String(picName || '').toUpperCase());
        return found ? { dotColor: found.color, role: found.role } : { dotColor: '#a1a1aa', role: 'HQ' };
    },

    getSubStatusObj(subStatusId) {
        return WTC_CONFIG.SUB_STATUSES.find(s => s.id === subStatusId) || WTC_CONFIG.SUB_STATUSES[0];
    },

    updateHeaderDate() {
        const el = document.getElementById('currentDateDisplay');
        if (el) el.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    },

    populateFilterDropdowns() {
        const picSelect = document.getElementById('filterPicHq');
        const currentPic = picSelect.value || 'ALL';
        picSelect.innerHTML = `<option value="ALL">PIC</option>` + this.state.pics.map(p => `<option value="${this.escapeHtml(p.name)}">${this.escapeHtml(p.name)}</option>`).join('');
        picSelect.value = currentPic;

        const amSelect = document.getElementById('filterAm');
        const currentAm = amSelect.value || 'ALL';
        const uniqueAms = Array.from(new Set(this.state.stores.map(s => s.am))).filter(Boolean);
        amSelect.innerHTML = `<option value="ALL">Area Manager</option>` + uniqueAms.map(am => `<option value="${this.escapeHtml(am)}">${this.escapeHtml(am)}</option>`).join('');
        amSelect.value = currentAm;

        const storeSelect = document.getElementById('filterStore');
        const currentStore = storeSelect.value || 'ALL';
        storeSelect.innerHTML = `<option value="ALL">Toko (${this.state.stores.length})</option>` + `<option value="ALL_STORES">Semua Toko (HQ)</option>` + this.state.stores.map(s => `<option value="${this.escapeHtml(s.id)}">${this.escapeHtml(s.name)}</option>`).join('');
        storeSelect.value = currentStore;

        const catSelect = document.getElementById('filterCategory');
        const currentCat = catSelect.value || 'ALL';
        catSelect.innerHTML = `<option value="ALL">Kategori</option>` + this.state.categories.map(c => `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`).join('');
        catSelect.value = currentCat;
    },

    getFilteredTasks() {
        const q = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
        const prio = document.getElementById('filterPriority')?.value || 'ALL';
        const picHq = document.getElementById('filterPicHq')?.value || 'ALL';
        const am = document.getElementById('filterAm')?.value || 'ALL';
        const storeId = document.getElementById('filterStore')?.value || 'ALL';
        const cat = document.getElementById('filterCategory')?.value || 'ALL';

        return this.state.tasks.filter(task => {
            const storeInfo = this.resolveStoresAndAmSpv(task.storeIds);
            const snoozeInfo = this.getSnoozeState(task);
            const dlInfo = this.getDeadlineInfo(task.deadline, task.stageId);

            if (this.quickUrgentOnly) {
                const isUrgent = task.priority === 'CRITICAL' || task.priority === 'HIGH' || snoozeInfo.isFollowUpDue || dlInfo.status === 'OVERDUE' || dlInfo.status === 'DUE_TODAY';
                if (!isUrgent || task.stageId === 'COMPLETED') return false;
            }
            if (prio !== 'ALL' && task.priority !== prio) return false;
            if (picHq !== 'ALL' && task.picHq !== picHq) return false;
            if (cat !== 'ALL' && task.category !== cat) return false;
            if (storeId !== 'ALL' && (!task.storeIds || !task.storeIds.includes(storeId))) return false;
            if (am !== 'ALL' && (!storeInfo.amList.includes(am) && task.picHq !== am)) return false;

            if (q) {
                const haystack = [task.title, task.notes, task.picHq, task.category, ...storeInfo.storeNames, ...storeInfo.amList].join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    },

    sortTasksForColumn(tasks) {
        return [...tasks].sort((a, b) => {
            const snA = this.getSnoozeState(a);
            const snB = this.getSnoozeState(b);
            if (snA.isSnoozed !== snB.isSnoozed) return snA.isSnoozed ? 1 : -1;
            if (snA.isFollowUpDue !== snB.isFollowUpDue) return snA.isFollowUpDue ? -1 : 1;
            const wA = WTC_CONFIG.PRIORITY_WEIGHT[a.priority] || 1;
            const wB = WTC_CONFIG.PRIORITY_WEIGHT[b.priority] || 1;
            if (wA !== wB) return wB - wA;
            return (a.deadline || '9999-12-31').localeCompare(b.deadline || '9999-12-31');
        });
    },

    handleFilterChange() { this.renderAll(); },
    handleSearchInput() { this.debouncedRender(); },

    resetFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('filterPriority').value = 'ALL';
        document.getElementById('filterPicHq').value = 'ALL';
        document.getElementById('filterAm').value = 'ALL';
        document.getElementById('filterStore').value = 'ALL';
        document.getElementById('filterCategory').value = 'ALL';
        this.quickUrgentOnly = false;
        this.updateQuickUrgentBtnStyle();
        this.renderAll();
    },

    QuickFilterUrgent() {
        this.quickUrgentOnly = !this.quickUrgentOnly;
        this.updateQuickUrgentBtnStyle();
        this.renderAll();
    },

    updateQuickUrgentBtnStyle() {
        const btn = document.getElementById('btnQuickUrgent');
        if (!btn) return;
        btn.className = this.quickUrgentOnly
            ? 'px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 transition flex items-center gap-1.5'
            : 'px-2.5 py-1 rounded-md text-[11px] font-medium glass-control flex items-center gap-1.5';
    },

    renderAll() {
        this.renderFocusStrip();
        if (this.viewMode === 'kanban') this.renderKanbanBoard();
        else this.renderSheetView();
    },

    renderFocusStrip() {
        const active = this.state.tasks.filter(t => t.stageId !== 'COMPLETED');
        let criticalCount = 0, overdueCount = 0, followUpDueCount = 0, snoozedCount = 0;
        active.forEach(t => {
            if (t.priority === 'CRITICAL' || t.priority === 'HIGH') criticalCount++;
            const dl = this.getDeadlineInfo(t.deadline, t.stageId);
            if (dl.status === 'OVERDUE' || dl.status === 'DUE_TODAY') overdueCount++;
            const sn = this.getSnoozeState(t);
            if (sn.isFollowUpDue) followUpDueCount++;
            if (sn.isSnoozed) snoozedCount++;
        });
        const parts = [];
        if (criticalCount > 0) parts.push(`${criticalCount} Critical/High`);
        if (overdueCount > 0) parts.push(`${overdueCount} Lewat Deadline`);
        if (followUpDueCount > 0) parts.push(`${followUpDueCount} Follow-Up Hari Ini`);
        if (snoozedCount > 0) parts.push(`${snoozedCount} Snoozed`);
        document.getElementById('briefingSummaryText').textContent = parts.length > 0 ? parts.join(' · ') : 'Semua jadwal terkendali';

        const wakeBtn = document.getElementById('btnWakeSnoozed');
        if (wakeBtn) {
            wakeBtn.classList.toggle('hidden', snoozedCount === 0);
            wakeBtn.classList.toggle('inline-flex', snoozedCount > 0);
        }

        const urgent = active.filter(t => {
            const sn = this.getSnoozeState(t);
            if (sn.isSnoozed) return false;
            const dl = this.getDeadlineInfo(t.deadline, t.stageId);
            return t.priority === 'CRITICAL' || t.priority === 'HIGH' || sn.isFollowUpDue || dl.status === 'OVERDUE';
        });
        const sorted = this.sortTasksForColumn(urgent);
        document.getElementById('priorityStripCount').textContent = sorted.length;
        const stripEl = document.getElementById('priorityStripCards');
        if (sorted.length === 0) {
            stripEl.innerHTML = `<div class="text-xs text-zinc-500 py-1 flex items-center gap-2"><i class="fa-solid fa-check text-emerald-500 text-[11px]"></i><span>Tidak ada task mendesak saat ini.</span></div>`;
            return;
        }
        stripEl.innerHTML = sorted.map(task => {
            const p = WTC_CONFIG.PRIORITY_STYLES[task.priority] || WTC_CONFIG.PRIORITY_STYLES.LOW;
            const subObj = this.getSubStatusObj(task.subStatus);
            const storeInfo = this.resolveStoresAndAmSpv(task.storeIds);
            const dlInfo = this.getDeadlineInfo(task.deadline, task.stageId);
            const sn = this.getSnoozeState(task);
            return `
                <div onclick="App.openTaskModal('${task.id}')" class="glass-card rounded-lg px-3 py-2 min-w-[245px] max-w-[270px] shrink-0 cursor-pointer flex flex-col justify-between gap-1.5">
                    <div class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full shrink-0 ${p.dot}"></span>
                        <h4 class="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">${this.escapeHtml(task.title)}</h4>
                    </div>
                    <div class="text-[11px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
                        <span class="truncate">${this.escapeHtml(storeInfo.storeNames[0])}${storeInfo.storeNames.length > 1 ? ` +${storeInfo.storeNames.length - 1}` : ''}</span>
                        <span>·</span>
                        <span class="shrink-0 font-medium text-zinc-600 dark:text-zinc-300">${this.escapeHtml(task.picHq)}</span>
                    </div>
                    <div class="pt-1 border-t border-zinc-200/50 dark:border-zinc-800/70 flex items-center justify-between gap-2 text-[10px]">
                        <span class="inline-flex items-center gap-1 truncate text-zinc-500 dark:text-zinc-400">
                            <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${subObj.dotColor}"></span>
                            <span class="truncate">${sn.isFollowUpDue ? 'Follow-up hari ini' : subObj.label}</span>
                        </span>
                        <span class="font-mono shrink-0 ${dlInfo.textClass}">${dlInfo.label}</span>
                    </div>
                </div>`;
        }).join('');
    },

    togglePriorityStrip() {
        this.priorityStripCollapsed = !this.priorityStripCollapsed;
        const cards = document.getElementById('priorityStripCards');
        const txt = document.getElementById('priorityStripToggleText');
        const icon = document.getElementById('priorityStripToggleIcon');
        cards.classList.toggle('hidden', this.priorityStripCollapsed);
        txt.textContent = this.priorityStripCollapsed ? 'Tampilkan' : 'Sembunyikan';
        icon.className = this.priorityStripCollapsed ? 'fa-solid fa-chevron-down text-[10px]' : 'fa-solid fa-chevron-up text-[10px]';
    },

    renderKanbanBoard() {
        const board = document.getElementById('kanbanBoardContainer');
        const filtered = this.getFilteredTasks();
        board.innerHTML = WTC_CONFIG.STAGES.map(stage => {
            const stageTasks = this.sortTasksForColumn(filtered.filter(t => t.stageId === stage.id));
            return `
                <div class="rounded-xl glass-panel flex flex-col max-h-[82vh]">
                    <div class="px-3.5 py-2.5 border-b border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full ${stage.dot}"></span>
                            <h3 class="text-xs font-semibold text-zinc-900 dark:text-zinc-100">${stage.title}</h3>
                        </div>
                        <span class="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">${stageTasks.length}</span>
                    </div>
                    <div class="kanban-col-body p-2.5 space-y-2.5 overflow-y-auto flex-1 min-h-[200px]" data-stage-id="${stage.id}" ondragover="App.handleDragOver(event)" ondragleave="App.handleDragLeave(event)" ondrop="App.handleDrop(event, '${stage.id}')">
                        ${stageTasks.length === 0 ? `<div class="h-32 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800/70 flex items-center justify-center text-zinc-400 dark:text-zinc-600 text-[11px]">Kosong</div>` : stageTasks.map(task => this.renderTaskCardHtml(task)).join('')}
                    </div>
                </div>`;
        }).join('');
    },

    renderTaskCardHtml(task) {
        const p = WTC_CONFIG.PRIORITY_STYLES[task.priority] || WTC_CONFIG.PRIORITY_STYLES.LOW;
        const subObj = this.getSubStatusObj(task.subStatus);
        const storeInfo = this.resolveStoresAndAmSpv(task.storeIds);
        const picStyle = this.getPicBadgeStyle(task.picHq);
        const dlInfo = this.getDeadlineInfo(task.deadline, task.stageId);
        const sn = this.getSnoozeState(task);
        const subOptionsHtml = WTC_CONFIG.SUB_STATUSES.map(s => `<option value="${s.id}" ${s.id === task.subStatus ? 'selected' : ''} class="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">${s.label} (${s.legacy})</option>`).join('');

        return `
            <article draggable="true" ondragstart="App.handleDragStart(event, '${task.id}')" ondragend="App.handleDragEnd(event)" class="glass-card rounded-xl p-3.5 cursor-grab active:cursor-grabbing space-y-2.5 ${sn.isSnoozed ? 'task-snoozed' : ''}">
                <div class="flex items-center justify-between gap-1.5">
                    <div class="flex items-center gap-1.5 min-w-0">
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${p.pill} ${p.text}"><span class="w-1.5 h-1.5 rounded-full ${p.dot}"></span><span>${p.label}</span></span>
                        <span class="px-2 py-0.5 rounded-md text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-500/5 border border-zinc-500/10 truncate">${this.escapeHtml(task.category || 'Umum')}</span>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <button type="button" onclick="App.openSnoozeModal('${task.id}', event)" class="px-2 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 ${sn.isSnoozed ? 'glass-control text-zinc-400' : sn.isFollowUpDue ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' : 'glass-control'}">
                            <i class="fa-solid ${sn.isSnoozed ? 'fa-clock' : 'fa-check'} text-[10px]"></i>
                            <span>${sn.isSnoozed ? sn.untilFormatted : 'Follow-up'}</span>
                        </button>
                        <button type="button" onclick="App.openTaskModal('${task.id}')" class="w-6 h-6 rounded-md glass-control text-[11px] flex items-center justify-center"><i class="fa-solid fa-pen text-[10px]"></i></button>
                    </div>
                </div>
                <div onclick="App.openTaskModal('${task.id}')" class="cursor-pointer">
                    <h4 class="text-[13px] font-semibold text-zinc-900 dark:text-[#F4F4F5] leading-snug hover:opacity-90 transition">${this.escapeHtml(task.title)}</h4>
                </div>
                <div class="space-y-1 text-[11px]">
                    <div class="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                        <i class="fa-solid fa-store text-zinc-400 text-[10px] shrink-0"></i>
                        <span class="truncate">${storeInfo.storeNames.map(n => this.escapeHtml(n)).join(', ')}</span>
                    </div>
                    ${(!storeInfo.isAllStores && (storeInfo.amList.length > 0 || storeInfo.spvList.length > 0)) ? `
                        <div class="flex flex-wrap items-center gap-1 pl-4">
                            ${storeInfo.amList.map(am => `<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border border-zinc-500/15">AM: ${this.escapeHtml(am)}</span>`).join('')}
                            ${storeInfo.spvList.map(s => `<span class="px-1.5 py-0.5 rounded text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-500/5 border border-zinc-500/10">SPV: ${this.escapeHtml(s.spv)}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                ${task.notes ? `<div onclick="App.openTaskModal('${task.id}')" class="cursor-pointer pl-2.5 border-l-2 border-zinc-300 dark:border-zinc-700 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2"><i class="fa-solid fa-align-left text-[9px] text-zinc-400 mr-1"></i>${this.escapeHtml(task.notes)}</div>` : ''}
                <div class="pt-1 space-y-2">
                    <div class="relative flex items-center">
                        <span class="w-1.5 h-1.5 rounded-full absolute left-2.5 pointer-events-none" style="background-color: ${subObj.dotColor}"></span>
                        <select onchange="App.changeTaskSubStatus('${task.id}', this.value)" class="clean-select w-full pl-6 py-1 rounded-lg glass-control text-[11px] font-medium ${subObj.textAccent} cursor-pointer focus:outline-none">${subOptionsHtml}</select>
                    </div>
                    <div class="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/70 flex items-center justify-between gap-2 text-[11px]">
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md glass-control text-[11px] font-medium text-zinc-700 dark:text-zinc-200"><span class="w-1.5 h-1.5 rounded-full" style="background-color: ${picStyle.dotColor}"></span><span>${this.escapeHtml(task.picHq)}</span></span>
                        <span class="inline-flex items-center gap-1 font-mono text-[11px] ${dlInfo.textClass}"><i class="fa-regular fa-calendar text-[10px] opacity-75"></i><span>${dlInfo.label}</span></span>
                    </div>
                </div>
            </article>`;
    },

    renderSheetView() {
        const tbody = document.getElementById('sheetTableBody');
        if (!tbody) return;
        const tasks = this.sortTasksForColumn(this.getFilteredTasks());
        tbody.innerHTML = tasks.map(task => {
            const p = WTC_CONFIG.PRIORITY_STYLES[task.priority] || WTC_CONFIG.PRIORITY_STYLES.LOW;
            const subObj = this.getSubStatusObj(task.subStatus);
            const storeInfo = this.resolveStoresAndAmSpv(task.storeIds);
            const picStyle = this.getPicBadgeStyle(task.picHq);
            const dlInfo = this.getDeadlineInfo(task.deadline, task.stageId);
            const sn = this.getSnoozeState(task);
            return `
                <tr class="hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 transition ${sn.isSnoozed ? 'opacity-50' : ''}">
                    <td class="py-2.5 px-3.5 font-mono text-[11px] whitespace-nowrap text-zinc-500">${this.formatDateShort(task.dateCreated)}</td>
                    <td onclick="App.openTaskModal('${task.id}')" class="py-2.5 px-3.5 cursor-pointer">
                        <div class="font-medium text-zinc-900 dark:text-zinc-100">${this.escapeHtml(task.title)}</div>
                        <span class="text-[11px] text-zinc-500">${this.escapeHtml(task.category)}</span>
                    </td>
                    <td class="py-2.5 px-3.5"><div class="text-zinc-700 dark:text-zinc-300">${storeInfo.storeNames.map(n => this.escapeHtml(n)).join(', ')}</div></td>
                    <td class="py-2.5 px-3.5 whitespace-nowrap"><span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${p.pill} ${p.text}"><span class="w-1.5 h-1.5 rounded-full ${p.dot}"></span><span>${p.label}</span></span></td>
                    <td class="py-2.5 px-3.5 whitespace-nowrap font-mono text-[11px] ${dlInfo.textClass}">${dlInfo.label}</td>
                    <td class="py-2.5 px-3.5 whitespace-nowrap"><span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md glass-control text-[11px] font-medium"><span class="w-1.5 h-1.5 rounded-full" style="background:${picStyle.dotColor}"></span><span>${this.escapeHtml(task.picHq)}</span></span></td>
                    <td class="py-2.5 px-3.5 whitespace-nowrap"><span class="inline-flex items-center gap-1.5 text-[11px] ${subObj.textAccent}"><span class="w-1.5 h-1.5 rounded-full" style="background:${subObj.dotColor}"></span><span>${subObj.label}</span></span></td>
                    <td class="py-2.5 px-3.5 text-center whitespace-nowrap"><button onclick="App.openSnoozeModal('${task.id}', event)" class="px-2.5 py-1 rounded-md text-[11px] font-medium glass-control"><i class="fa-solid ${sn.isSnoozed ? 'fa-clock' : 'fa-check'} mr-1 text-[10px]"></i>${sn.isSnoozed ? sn.untilFormatted : 'Follow-up'}</button></td>
                    <td onclick="App.openTaskModal('${task.id}')" class="py-2.5 px-3.5 text-zinc-500 dark:text-zinc-400 max-w-xs truncate cursor-pointer">${this.escapeHtml(task.notes || '-')}</td>
                </tr>`;
        }).join('');
    },

    setViewMode(mode) {
        this.viewMode = mode;
        document.getElementById('kanbanBoardContainer').classList.toggle('hidden', mode !== 'kanban');
        document.getElementById('sheetViewContainer').classList.toggle('hidden', mode !== 'sheet');
        const btnKanban = document.getElementById('btnViewKanban');
        const btnSheet = document.getElementById('btnViewSheet');
        btnKanban.className = mode === 'kanban' ? 'px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm' : 'px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100';
        btnSheet.className = mode === 'sheet' ? 'px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm' : 'px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100';
        this.renderAll();
    },

    handleDragStart(event, taskId) {
        this.draggedTaskId = taskId;
        event.currentTarget.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', taskId);
    },
    handleDragEnd(event) {
        event.currentTarget.classList.remove('dragging');
        document.querySelectorAll('.kanban-col-body').forEach(col => col.classList.remove('drag-over'));
    },
    handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drag-over');
    },
    handleDragLeave(event) {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            event.currentTarget.classList.remove('drag-over');
        }
    },
    handleDrop(event, targetStageId) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        const taskId = event.dataTransfer.getData('text/plain') || this.draggedTaskId;
        if (!taskId) return;
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) return;
        if (task.stageId !== targetStageId) {
            task.stageId = targetStageId;
            const matching = WTC_CONFIG.SUB_STATUSES.find(s => s.stageId === targetStageId);
            if (matching) task.subStatus = matching.id;
            if (targetStageId === 'COMPLETED') task.snoozedUntil = null;
            this.persistState();
            this.renderAll();
            this.showToast('Status task diperbarui');
        }
    },

    changeTaskSubStatus(taskId, newSubStatusId) {
        const task = this.state.tasks.find(t => t.id === taskId);
        const subObj = this.getSubStatusObj(newSubStatusId);
        if (!task || !subObj) return;
        task.subStatus = subObj.id;
        task.stageId = subObj.stageId;
        if (task.stageId === 'COMPLETED') task.snoozedUntil = null;
        this.persistState();
        this.renderAll();
        this.showToast(`Status: ${subObj.label}`);
    },

    openSnoozeModal(taskId, event) {
        if (event) event.stopPropagation();
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) return;
        this.activeSnoozeTaskId = taskId;
        document.getElementById('snoozeTaskSummary').innerHTML = `<div class="font-medium text-zinc-900 dark:text-zinc-100">${this.escapeHtml(task.title)}</div><div class="text-[11px] text-zinc-500">PIC: ${this.escapeHtml(task.picHq)}</div>`;
        const now = new Date();
        [1, 2, 3, 5, 7].forEach(days => {
            const iso = this.addWorkingDays(now, days);
            const el = document.getElementById(`snoozePreview${days}`);
            if (el) el.textContent = this.formatDateHuman(iso);
        });
        document.getElementById('customSnoozeDate').value = task.snoozedUntil || this.addWorkingDays(now, 3);
        document.getElementById('snoozeFollowUpReason').value = task.followUpReason || `Follow-up ke ${task.picHq}`;
        document.getElementById('snoozeModal').classList.remove('hidden');
    },

    closeSnoozeModal() {
        document.getElementById('snoozeModal').classList.add('hidden');
        this.activeSnoozeTaskId = null;
    },
    applySnoozeWorkingDays(days) {
        if (!this.activeSnoozeTaskId) return;
        this.saveTaskSnoozeDate(this.addWorkingDays(new Date(), days));
    },
    applyCustomSnoozeDate() {
        const iso = document.getElementById('customSnoozeDate').value;
        if (iso) this.saveTaskSnoozeDate(iso);
    },
    saveTaskSnoozeDate(targetIso) {
        const task = this.state.tasks.find(t => t.id === this.activeSnoozeTaskId);
        if (!task) return;
        task.snoozedUntil = targetIso;
        task.followUpReason = document.getElementById('snoozeFollowUpReason').value.trim();
        this.persistState();
        this.closeSnoozeModal();
        this.renderAll();
        this.showToast(`Follow-up diset: ${this.formatDateHuman(targetIso)}`);
    },
    clearTaskSnooze() {
        const task = this.state.tasks.find(t => t.id === this.activeSnoozeTaskId);
        if (!task) return;
        task.snoozedUntil = null;
        this.persistState();
        this.closeSnoozeModal();
        this.renderAll();
        this.showToast('Snooze dimatikan');
    },
    markTaskCompletedFromSnooze() {
        const task = this.state.tasks.find(t => t.id === this.activeSnoozeTaskId);
        if (!task) return;
        task.stageId = 'COMPLETED';
        task.subStatus = 'COMPLETED_INSTALLED';
        task.snoozedUntil = null;
        this.persistState();
        this.closeSnoozeModal();
        this.renderAll();
        this.showToast('Task dipindahkan ke Done');
    },
    wakeAllSnoozed() {
        let count = 0;
        this.state.tasks.forEach(t => { if (t.snoozedUntil) { t.snoozedUntil = null; count++; } });
        this.persistState();
        this.renderAll();
        this.showToast(`${count} task diaktifkan kembali`);
    },

    openTaskModal(taskId = null) {
        const modal = document.getElementById('taskModal');
        document.getElementById('taskFormCategory').innerHTML = this.state.categories.map(c => `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`).join('');
        document.getElementById('taskFormSubStatus').innerHTML = WTC_CONFIG.SUB_STATUSES.map(s => `<option value="${s.id}">${this.escapeHtml(s.label)} (${this.escapeHtml(s.legacy)})</option>`).join('');

        const picSel = document.getElementById('taskFormPicHq');
        let picOpts = this.state.pics.map(p => `<option value="${this.escapeHtml(p.name)}">${this.escapeHtml(p.name)} (${p.role})</option>`).join('');
        let editingTask = null;
        if (taskId) {
            editingTask = this.state.tasks.find(t => t.id === taskId);
            if (editingTask && editingTask.picHq && !this.state.pics.some(p => p.name === editingTask.picHq)) {
                picOpts += `<option value="${this.escapeHtml(editingTask.picHq)}">${this.escapeHtml(editingTask.picHq)} (Legacy)</option>`;
            }
        }
        picSel.innerHTML = picOpts;

        document.getElementById('modalStoreSearch').value = '';

        if (taskId && editingTask) {
            document.getElementById('taskModalTitle').textContent = 'Edit Task';
            document.getElementById('btnDeleteTask').classList.remove('hidden');
            document.getElementById('taskFormId').value = editingTask.id;
            document.getElementById('taskFormTitle').value = editingTask.title;
            document.getElementById('taskFormCategory').value = editingTask.category || this.state.categories[0];
            document.getElementById('taskFormPriority').value = editingTask.priority || 'MEDIUM';
            document.getElementById('taskFormDateCreated').value = editingTask.dateCreated || this.getTodayIso();
            document.getElementById('taskFormDeadline').value = editingTask.deadline || this.getTodayIso();
            document.getElementById('taskFormSubStatus').value = editingTask.subStatus || 'IN_DESIGN';
            document.getElementById('taskFormPicHq').value = editingTask.picHq || 'ICA';
            document.getElementById('taskFormNotes').value = editingTask.notes || '';
            this.renderModalStoreCheckboxes(editingTask.storeIds || []);
        } else {
            document.getElementById('taskModalTitle').textContent = 'Task Baru';
            document.getElementById('btnDeleteTask').classList.add('hidden');
            document.getElementById('taskFormId').value = '';
            document.getElementById('taskFormTitle').value = '';
            document.getElementById('taskFormCategory').value = this.state.categories[0];
            document.getElementById('taskFormPriority').value = 'MEDIUM';
            document.getElementById('taskFormDateCreated').value = this.getTodayIso();
            document.getElementById('taskFormDeadline').value = this.addWorkingDays(new Date(), 5);
            document.getElementById('taskFormSubStatus').value = 'IN_DESIGN';
            document.getElementById('taskFormPicHq').value = 'ICA';
            document.getElementById('taskFormNotes').value = '';
            this.renderModalStoreCheckboxes(['ALL_STORES']);
        }
        modal.classList.remove('hidden');
    },

    closeTaskModal() { document.getElementById('taskModal').classList.add('hidden'); },

    renderModalStoreCheckboxes(selectedIds = []) {
        const container = document.getElementById('modalStoreCheckboxList');
        const isAllChecked = selectedIds.includes('ALL_STORES');
        const allOptionHtml = `<label class="store-checkbox-item flex items-center gap-2 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer text-xs font-medium" data-search="all stores general hq semua toko"><input type="checkbox" name="taskStoreCheckbox" value="ALL_STORES" ${isAllChecked ? 'checked' : ''} onchange="App.onModalStoreCheckboxChange(this)" class="rounded accent-zinc-900 dark:accent-zinc-100"><span>Semua Toko (HQ)</span></label>`;
        const storesHtml = this.state.stores.map(store => {
            const checked = selectedIds.includes(store.id);
            return `<label class="store-checkbox-item flex items-center justify-between gap-2 p-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer text-xs" data-search="${this.escapeHtml((store.name + ' ' + store.am).toLowerCase())}"><div class="flex items-center gap-2 truncate"><input type="checkbox" name="taskStoreCheckbox" value="${store.id}" ${checked ? 'checked' : ''} onchange="App.onModalStoreCheckboxChange(this)" class="rounded accent-zinc-900 dark:accent-zinc-100"><span class="truncate">${this.escapeHtml(store.name)}</span></div><span class="px-1.5 py-0.5 rounded text-[10px] text-zinc-500 bg-zinc-500/10 shrink-0">${this.escapeHtml(store.am)}</span></label>`;
        }).join('');
        container.innerHTML = allOptionHtml + storesHtml;
        this.updateModalAutoAmSpvPreview();
    },

    onModalStoreCheckboxChange(changed) {
        const all = Array.from(document.querySelectorAll('input[name="taskStoreCheckbox"]'));
        if (changed.value === 'ALL_STORES' && changed.checked) {
            all.forEach(cb => { if (cb.value !== 'ALL_STORES') cb.checked = false; });
        } else if (changed.value !== 'ALL_STORES' && changed.checked) {
            const allCb = all.find(cb => cb.value === 'ALL_STORES');
            if (allCb) allCb.checked = false;
        }
        this.updateModalAutoAmSpvPreview();
    },

    selectAllGeneralStore() { this.renderModalStoreCheckboxes(['ALL_STORES']); },
    clearSelectedStoresInModal() { this.renderModalStoreCheckboxes([]); },
    handleModalStoreSearch() { this.debouncedFilterStores(); },
    filterModalStores() {
        const q = (document.getElementById('modalStoreSearch').value || '').trim().toLowerCase();
        document.querySelectorAll('.store-checkbox-item').forEach(item => {
            const s = item.getAttribute('data-search') || '';
            item.classList.toggle('hidden', q !== '' && !s.includes(q));
        });
    },

    getSelectedStoreIdsFromModal() {
        const checked = Array.from(document.querySelectorAll('input[name="taskStoreCheckbox"]:checked')).map(cb => cb.value);
        return checked.length > 0 ? checked : ['ALL_STORES'];
    },

    updateModalAutoAmSpvPreview() {
        const ids = this.getSelectedStoreIdsFromModal();
        const info = this.resolveStoresAndAmSpv(ids);
        const el = document.getElementById('modalAutoAmSpvPreview');
        if (info.isAllStores) {
            el.innerHTML = `<span class="text-zinc-500">Berlaku untuk Semua Toko (HQ)</span>`;
            return;
        }
        el.innerHTML = `<span class="text-zinc-500">${info.storeNames.length} Toko dipilih:</span>` +
            info.amList.map(am => `<span class="px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 font-medium border border-zinc-500/15">AM: ${this.escapeHtml(am)}</span>`).join('');
    },

    saveTaskFromModal(event) {
        event.preventDefault();
        const id = document.getElementById('taskFormId').value;
        const title = document.getElementById('taskFormTitle').value.trim();
        const category = document.getElementById('taskFormCategory').value;
        const priority = document.getElementById('taskFormPriority').value;
        const dateCreated = document.getElementById('taskFormDateCreated').value || this.getTodayIso();
        const deadline = document.getElementById('taskFormDeadline').value;
        const subStatus = document.getElementById('taskFormSubStatus').value;
        const picHq = document.getElementById('taskFormPicHq').value;
        const notes = document.getElementById('taskFormNotes').value.trim();
        const storeIds = this.getSelectedStoreIdsFromModal();
        const subObj = this.getSubStatusObj(subStatus);

        if (id) {
            const existing = this.state.tasks.find(t => t.id === id);
            if (existing) {
                existing.title = title; existing.category = category; existing.priority = priority;
                existing.dateCreated = dateCreated; existing.deadline = deadline;
                existing.subStatus = subObj.id; existing.stageId = subObj.stageId;
                existing.picHq = picHq; existing.storeIds = storeIds; existing.notes = notes;
            }
            this.showToast('Task diperbarui');
        } else {
            this.state.tasks.unshift({
                id: 'T' + Date.now(),
                dateCreated, title, category, priority, deadline, picHq, storeIds,
                stageId: subObj.stageId, subStatus: subObj.id, notes,
                snoozedUntil: null, followUpReason: '', lastActionDate: null
            });
            this.showToast('Task ditambahkan');
        }
        this.persistState();
        this.closeTaskModal();
        this.renderAll();
    },

    deleteCurrentTask() {
        const id = document.getElementById('taskFormId').value;
        if (!id) return;
        if (!confirm('Hapus task ini? Snapshot akan disimpan untuk rollback.')) return;
        StorageService.emergencySnapshot(this.state);
        this.state.tasks = this.state.tasks.filter(t => t.id !== id);
        this.persistState();
        this.closeTaskModal();
        this.renderAll();
        this.showToast('Task dihapus');
    },

    openDirectoryModal(defaultTab = 'stores') {
        document.getElementById('directoryModal').classList.remove('hidden');
        this.switchDirectoryTab(defaultTab);
    },
    closeDirectoryModal() {
        document.getElementById('directoryModal').classList.add('hidden');
        this.populateFilterDropdowns();
        this.renderAll();
    },

    switchDirectoryTab(tab) {
        ['stores', 'pics', 'categories'].forEach(t => {
            const btn = document.getElementById(`dirTab-${t}`);
            const content = document.getElementById(`dirContent-${t}`);
            if (t === tab) {
                btn.className = 'py-2.5 text-xs font-medium border-b-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100';
                content.classList.remove('hidden');
            } else {
                btn.className = 'py-2.5 text-xs font-medium border-b-2 border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300';
                content.classList.add('hidden');
            }
        });
        if (tab === 'stores') this.renderDirectoryStores();
        if (tab === 'pics') this.renderDirectoryPics();
        if (tab === 'categories') this.renderDirectoryCategories();
    },

    renderDirectoryStores() {
        const q = (document.getElementById('dirStoreFilter')?.value || '').trim().toLowerCase();
        const tbody = document.getElementById('directoryStoresTableBody');
        const filtered = this.state.stores.filter(s => !q || `${s.name} ${s.am} ${s.spv || ''}`.toLowerCase().includes(q));
        tbody.innerHTML = filtered.map((store, idx) => `
            <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                <td class="py-2 px-3 font-mono text-zinc-400">${idx + 1}</td>
                <td class="py-2 px-3 font-medium text-zinc-900 dark:text-zinc-100">${this.escapeHtml(store.name)}</td>
                <td class="py-2 px-3"><span class="px-2 py-0.5 rounded text-[11px] bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border border-zinc-500/15">${this.escapeHtml(store.am)}</span></td>
                <td class="py-2 px-3"><input type="text" value="${this.escapeHtml(store.spv || '')}" onchange="App.updateStoreSpv('${store.id}', this.value)" placeholder="Ketik SPV..." class="w-full px-2.5 py-1 rounded bg-transparent border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-600 text-xs focus:outline-none"></td>
                <td class="py-2 px-3 text-right"><button onclick="App.deleteStore('${store.id}')" class="text-zinc-400 hover:text-rose-500 px-2 py-1"><i class="fa-regular fa-trash-can"></i></button></td>
            </tr>
        `).join('');
    },

    updateStoreSpv(storeId, val) {
        const st = this.state.stores.find(s => s.id === storeId);
        if (st) { st.spv = val.trim(); this.persistState(); this.showToast('SPV disimpan'); }
    },

    addNewStore() {
        const name = document.getElementById('newStoreName').value.trim();
        const am = document.getElementById('newStoreAm').value.trim().toUpperCase();
        const spv = document.getElementById('newStoreSpv').value.trim();
        if (!name || !am) return;
        this.state.stores.push({ id: 'S_' + Date.now(), no: this.state.stores.length + 1, name, am, spv });
        this.persistState();
        document.getElementById('newStoreName').value = '';
        document.getElementById('newStoreAm').value = '';
        document.getElementById('newStoreSpv').value = '';
        this.renderDirectoryStores();
        this.showToast('Toko ditambahkan');
    },
    deleteStore(storeId) {
        const st = this.state.stores.find(s => s.id === storeId);
        if (!st) return;
        if (!confirm(`Hapus toko "${st.name}"? Snapshot akan disimpan.`)) return;
        StorageService.emergencySnapshot(this.state);
        this.state.stores = this.state.stores.filter(s => s.id !== storeId);
        this.persistState();
        this.renderDirectoryStores();
        this.showToast('Toko dihapus');
    },

    renderDirectoryPics() {
        document.getElementById('directoryPicsGrid').innerHTML = this.state.pics.map(pic => `
            <div class="p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
                <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full" style="background:${pic.color}"></span><span class="text-xs font-medium text-zinc-900 dark:text-zinc-100">${this.escapeHtml(pic.name)}</span><span class="text-[10px] text-zinc-400">${pic.role}</span></div>
                <button onclick="App.deletePic('${pic.id}')" class="text-zinc-400 hover:text-rose-500 text-xs"><i class="fa-regular fa-trash-can"></i></button>
            </div>
        `).join('');
    },
    addNewPic() {
        const name = document.getElementById('newPicName').value.trim().toUpperCase();
        const role = document.getElementById('newPicRole').value;
        const color = document.getElementById('newPicColor').value;
        if (!name) return;
        this.state.pics.push({ id: 'PIC_' + Date.now(), name, role, color });
        this.persistState();
        document.getElementById('newPicName').value = '';
        this.renderDirectoryPics();
        this.showToast('PIC ditambahkan');
    },
    deletePic(id) {
        const p = this.state.pics.find(x => x.id === id);
        if (!p) return;
        if (!confirm(`Hapus PIC "${p.name}"? Snapshot akan disimpan.`)) return;
        StorageService.emergencySnapshot(this.state);
        this.state.pics = this.state.pics.filter(x => x.id !== id);
        this.persistState();
        this.renderDirectoryPics();
        this.showToast('PIC dihapus');
    },

    renderDirectoryCategories() {
        document.getElementById('directoryCategoriesGrid').innerHTML = this.state.categories.map((cat, idx) => `
            <div class="p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
                <span class="text-xs font-medium text-zinc-800 dark:text-zinc-200">${this.escapeHtml(cat)}</span>
                <button data-category-index="${idx}" onclick="App.deleteCategoryByIndex(this)" class="text-zinc-400 hover:text-rose-500 text-xs"><i class="fa-regular fa-trash-can"></i></button>
            </div>
        `).join('');
    },
    addNewCategory() {
        const name = document.getElementById('newCategoryName').value.trim();
        if (!name || this.state.categories.includes(name)) return;
        this.state.categories.push(name);
        this.persistState();
        document.getElementById('newCategoryName').value = '';
        this.renderDirectoryCategories();
        this.showToast('Kategori ditambahkan');
    },
    deleteCategoryByIndex(btn) {
        const idx = parseInt(btn.getAttribute('data-category-index'), 10);
        if (isNaN(idx)) return;
        const cat = this.state.categories[idx];
        if (!cat) return;
        if (!confirm(`Hapus kategori "${cat}"? Snapshot akan disimpan.`)) return;
        StorageService.emergencySnapshot(this.state);
        this.state.categories.splice(idx, 1);
        this.persistState();
        this.renderDirectoryCategories();
        this.showToast('Kategori dihapus');
    },

    openCloudModal() {
        document.getElementById('gasWebhookUrlInput').value = this.state.gasWebhookUrl || '';
        this.renderStorageStatus();
        document.getElementById('cloudModal').classList.remove('hidden');
    },
    closeCloudModal() { document.getElementById('cloudModal').classList.add('hidden'); },

    renderStorageStatus() {
        const info = StorageService.getStorageInfo(this.state);
        const panel = document.getElementById('storageStatusPanel');
        if (panel) {
            panel.innerHTML = `
                <div class="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800">
                    <div class="text-[10px] text-zinc-500 uppercase">Tasks</div>
                    <div class="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">${info.taskCount}</div>
                </div>
                <div class="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800">
                    <div class="text-[10px] text-zinc-500 uppercase">Toko</div>
                    <div class="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">${info.storeCount}</div>
                </div>
                <div class="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800">
                    <div class="text-[10px] text-zinc-500 uppercase">PIC</div>
                    <div class="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">${info.picCount}</div>
                </div>
                <div class="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800">
                    <div class="text-[10px] text-zinc-500 uppercase">Storage</div>
                    <div class="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">${info.sizeKb} KB</div>
                </div>`;
        }
        const backupText = document.getElementById('lastBackupText');
        if (backupText) {
            if (info.lastBackupTime) {
                const d = new Date(info.lastBackupTime);
                backupText.textContent = `Snapshot terakhir: ${d.toLocaleString('id-ID')}`;
            } else {
                backupText.textContent = 'Belum ada snapshot';
            }
        }
    },

    rollbackFromEmergencyBackup() {
        const backup = StorageService.getEmergencyBackup();
        if (!backup || !backup.state) {
            this.showToast('Tidak ada snapshot untuk dipulihkan');
            return;
        }
        if (!StorageService.validatePayload(backup.state)) {
            this.showToast('Snapshot rusak, tidak dapat dipulihkan');
            return;
        }
        const when = new Date(backup.timestamp).toLocaleString('id-ID');
        if (!confirm(`Pulihkan data ke snapshot ${when}?\nWorkspace: ${backup.workspaceName}`)) return;
        this.state = backup.state;
        StorageService.saveState(this.state);
        this.updateWorkspaceUI();
        this.populateFilterDropdowns();
        this.renderAll();
        this.renderStorageStatus();
        this.setSyncStatus('Tersimpan Lokal');
        this.showToast('Data dipulihkan dari snapshot');
    },

    saveGasWebhookUrl() {
        const url = document.getElementById('gasWebhookUrlInput').value.trim();
        if (url && !url.startsWith('https://script.google.com/macros/s/')) {
            this.showToast('URL tidak valid — harus diawali https://script.google.com/macros/s/');
            return;
        }
        this.state.gasWebhookUrl = url;
        this.persistState();
        this.showToast('URL disimpan');
    },

    async syncWithGoogleSheets(mode) {
        try {
            this.setSyncStatus(mode === 'PUSH' ? 'Menyimpan ke Cloud...' : 'Mengambil dari Cloud...', 'syncing');
            this.showToast(`Sinkronisasi (${mode})...`);
            if (mode === 'PULL') {
                StorageService.emergencySnapshot(this.state);
            }
            const res = await StorageService.syncWithGoogleAppsScript(mode, this.state);
            if (mode === 'PULL') {
                if (!res || !StorageService.validatePayload(res.payload)) {
                    this.setSyncStatus('Gagal Sinkron - Data Lokal Aman', 'error');
                    this.showToast('Payload cloud kosong/rusak. Penimpaan ditolak.');
                    return;
                }
                this.state = res.payload;
                StorageService.saveState(this.state);
                this.updateWorkspaceUI();
                this.populateFilterDropdowns();
                this.renderAll();
            }
            this.setSyncStatus(`Tersinkronisasi ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`);
            this.showToast(`Sinkronisasi ${mode} selesai`);
        } catch (err) {
            this.setSyncStatus('Gagal Sinkron - Data Lokal Aman', 'error');
            this.showToast(err.message || 'Gagal sinkronisasi');
        }
    },

    exportBackupJson() {
        const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `antonio-workspace-${this.state.workspaceName.toLowerCase().replace(/\s+/g, '-')}-${this.getTodayIso()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Backup JSON diunduh');
    },

    exportCsv() {
        const csv = StorageService.exportTasksCsv(this.state);
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `antonio-workspace-${this.state.workspaceName.toLowerCase().replace(/\s+/g, '-')}-${this.getTodayIso()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Backup CSV diunduh');
    },

    importBackupJson(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) { event.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!StorageService.validatePayload(imported)) {
                    this.showToast('File backup tidak valid atau rusak. Data lama aman.');
                    return;
                }
                if (!confirm('Timpa data lokal dengan file backup ini? Snapshot akan disimpan.')) return;
                StorageService.emergencySnapshot(this.state);
                this.state = imported;
                StorageService.saveState(this.state);
                this.updateWorkspaceUI();
                this.populateFilterDropdowns();
                this.renderAll();
                this.closeCloudModal();
                this.setSyncStatus('Tersimpan Lokal');
                this.showToast('Data dipulihkan');
            } catch (err) {
                this.showToast('Format file tidak valid');
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    },

    getGasBackendCode() {
        return `function doGet(e) {
  try {
    var payload = loadState_();
    return jsonResponse_({ status: 'OK', payload: payload });
  } catch (err) {
    return jsonResponse_({ status: 'ERROR', message: err.message });
  }
}
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === 'SAVE_ALL' && body.payload) {
      saveState_(body.payload);
      return jsonResponse_({ status: 'SAVED' });
    }
    return jsonResponse_({ status: 'ERROR', message: 'Unknown action' });
  } catch (err) {
    return jsonResponse_({ status: 'ERROR', message: err.message });
  }
}
var STATE_PROPERTY_KEY = 'WTC_STATE_JSON';
var APP_STATE_SHEET = '_APP_STATE';
var READABLE_SHEET = 'Tasks_Readable';
function getOrCreateSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}
function saveState_(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var jsonStr = JSON.stringify(payload);
  var stateSheet = getOrCreateSheet_(ss, APP_STATE_SHEET);
  stateSheet.getRange('A1').setValue(jsonStr);
  try { stateSheet.hideSheet(); } catch (e) {}
  try { PropertiesService.getScriptProperties().setProperty(STATE_PROPERTY_KEY, jsonStr); } catch (e) {}
  writeReadableSheet_(ss, payload);
}
function writeReadableSheet_(ss, payload) {
  var sheet = getOrCreateSheet_(ss, READABLE_SHEET);
  sheet.clear();
  var headers = ['ID','Tanggal','Task','Kategori','Prioritas','Deadline','PIC','Toko','Stage','SubStatus','Catatan'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6');
  var tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  var stores = Array.isArray(payload.stores) ? payload.stores : [];
  var rows = tasks.map(function(t) {
    var storeNames = (t.storeIds || []).indexOf('ALL_STORES') >= 0
      ? 'Semua Toko (HQ)'
      : (t.storeIds || []).map(function(id) {
          var s = stores.filter(function(x) { return x.id === id; })[0];
          return s ? s.name : id;
        }).join('; ');
    return [t.id || '', t.dateCreated || '', t.title || '', t.category || '', t.priority || '', t.deadline || '', t.picHq || '', storeNames, t.stageId || '', t.subStatus || '', t.notes || ''];
  });
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}
function loadState_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stateSheet = ss.getSheetByName(APP_STATE_SHEET);
  if (stateSheet) {
    var raw = stateSheet.getRange('A1').getValue();
    if (raw) {
      try { return JSON.parse(raw); } catch (e) {}
    }
  }
  var legacy = PropertiesService.getScriptProperties().getProperty(STATE_PROPERTY_KEY);
  if (legacy) { try { return JSON.parse(legacy); } catch (e) {} }
  return null;
}
function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}`;
    },

    async copyGasCode() {
        const code = this.getGasBackendCode();
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(code);
            } else {
                const temp = document.createElement('textarea');
                temp.value = code;
                temp.style.position = 'fixed';
                temp.style.left = '-9999px';
                document.body.appendChild(temp);
                temp.select();
                document.execCommand('copy');
                document.body.removeChild(temp);
            }
            this.showToast('Kode Code.gs disalin');
        } catch (err) {
            this.showToast('Gagal menyalin, coba lagi');
        }
    },

    escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },

    showToast(message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'pointer-events-auto px-3.5 py-2 rounded-lg glass-panel bg-zinc-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 shadow-lg text-xs font-medium flex items-center gap-2 transition-all duration-200';
        toast.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span><span>${this.escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 200);
        }, 2600);
    }
};

window.App = App;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}