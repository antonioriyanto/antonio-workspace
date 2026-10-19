const StorageService = {
    loadState() {
        try {
            const activeWs = localStorage.getItem(WTC_CONFIG.ACTIVE_WORKSPACE_KEY) || 'Watch Club';
            const storageKey = WTC_CONFIG.STORAGE_KEY + '_' + activeWs.replace(/\s+/g, '_');
            const raw = localStorage.getItem(storageKey);

            if (!raw) {
                const initialState = {
                    workspaceName: activeWs,
                    tasks: activeWs === 'Watch Club' ? WTC_CONFIG.INITIAL_TASKS : [
                        {
                            id: 'P101',
                            dateCreated: this.getTodayIsoStatic(),
                            title: 'Contoh Task Personal Project Pertama',
                            category: 'Digital',
                            priority: 'HIGH',
                            deadline: '2026-11-01',
                            picHq: 'ANTONIO',
                            storeIds: ['ALL_STORES'],
                            stageId: 'CREATIVE',
                            subStatus: 'IN_DESIGN',
                            notes: 'Persiapan portofolio dan riset tool baru.',
                            snoozedUntil: null,
                            followUpReason: '',
                            lastActionDate: null
                        }
                    ],
                    stores: WTC_CONFIG.DEFAULT_STORES,
                    pics: WTC_CONFIG.DEFAULT_PICS,
                    categories: WTC_CONFIG.DEFAULT_CATEGORIES,
                    gasWebhookUrl: '',
                    lastModified: null,
                    lastSyncedAt: null
                };
                this.saveState(initialState);
                return initialState;
            }
            const parsed = JSON.parse(raw);
            return {
                workspaceName: parsed.workspaceName || activeWs,
                tasks: parsed.tasks || [],
                stores: parsed.stores || WTC_CONFIG.DEFAULT_STORES,
                pics: parsed.pics || WTC_CONFIG.DEFAULT_PICS,
                categories: parsed.categories || WTC_CONFIG.DEFAULT_CATEGORIES,
                gasWebhookUrl: parsed.gasWebhookUrl || '',
                lastModified: parsed.lastModified || null,
                lastSyncedAt: parsed.lastSyncedAt || null
            };
        } catch (err) {
            console.error('Gagal memuat LocalStorage:', err);
            return {
                workspaceName: 'Watch Club',
                tasks: WTC_CONFIG.INITIAL_TASKS,
                stores: WTC_CONFIG.DEFAULT_STORES,
                pics: WTC_CONFIG.DEFAULT_PICS,
                categories: WTC_CONFIG.DEFAULT_CATEGORIES,
                gasWebhookUrl: '',
                lastModified: null,
                lastSyncedAt: null
            };
        }
    },

    getTodayIsoStatic() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },

    saveState(state) {
        try {
            const activeWs = state.workspaceName || 'Watch Club';
            const storageKey = WTC_CONFIG.STORAGE_KEY + '_' + activeWs.replace(/\s+/g, '_');
            localStorage.setItem(storageKey, JSON.stringify(state));
            localStorage.setItem(WTC_CONFIG.ACTIVE_WORKSPACE_KEY, activeWs);
        } catch (err) {
            console.error('Gagal menyimpan ke LocalStorage:', err);
        }
    },

    emergencySnapshot(state) {
        try {
            if (!state) return false;
            const backup = {
                timestamp: new Date().toISOString(),
                workspaceName: state.workspaceName || 'Watch Club',
                state: state
            };
            localStorage.setItem(WTC_CONFIG.EMERGENCY_BACKUP_KEY, JSON.stringify(backup));
            return true;
        } catch (err) {
            console.error('Emergency snapshot gagal:', err);
            return false;
        }
    },

    getEmergencyBackup() {
        try {
            const raw = localStorage.getItem(WTC_CONFIG.EMERGENCY_BACKUP_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            return null;
        }
    },

    clearEmergencyBackup() {
        try { localStorage.removeItem(WTC_CONFIG.EMERGENCY_BACKUP_KEY); } catch (err) {}
    },

    validatePayload(payload) {
        return !!(payload && typeof payload === 'object'
            && Array.isArray(payload.tasks)
            && payload.tasks.length > 0);
    },

    getStorageInfo(state) {
        const info = {
            taskCount: state.tasks?.length || 0,
            storeCount: state.stores?.length || 0,
            picCount: state.pics?.length || 0,
            categoryCount: state.categories?.length || 0,
            sizeKb: '0.00',
            lastBackupTime: null
        };
        try {
            const storageKey = WTC_CONFIG.STORAGE_KEY + '_' + (state.workspaceName || 'Watch Club').replace(/\s+/g, '_');
            const raw = localStorage.getItem(storageKey) || '';
            info.sizeKb = (new Blob([raw]).size / 1024).toFixed(2);
        } catch (err) {}
        const backup = this.getEmergencyBackup();
        if (backup && backup.timestamp) info.lastBackupTime = backup.timestamp;
        return info;
    },

    exportTasksCsv(state) {
        const headers = ['ID', 'Tanggal', 'Task', 'Kategori', 'Prioritas', 'Deadline', 'PIC', 'Toko', 'Stage', 'SubStatus', 'Catatan'];
        const escape = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
        const rows = (state.tasks || []).map(t => {
            const storeNames = (t.storeIds || []).includes('ALL_STORES')
                ? 'Semua Toko (HQ)'
                : (t.storeIds || []).map(id => {
                    const s = (state.stores || []).find(x => x.id === id);
                    return s ? s.name : id;
                }).join('; ');
            return [t.id, t.dateCreated, t.title, t.category, t.priority, t.deadline, t.picHq, storeNames, t.stageId, t.subStatus, t.notes || ''];
        });
        return [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    },

    async syncWithGoogleAppsScript(mode, state) {
        if (!state.gasWebhookUrl) {
            throw new Error('URL Google Apps Script belum diisi.');
        }
        if (mode === 'PUSH') {
            const response = await fetch(state.gasWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'SAVE_ALL', payload: state })
            });
            return await response.json();
        } else {
            const response = await fetch(state.gasWebhookUrl + '?action=LOAD_ALL');
            return await response.json();
        }
    }
};

window.StorageService = StorageService;