const WTC_CONFIG = {
    STORAGE_KEY: 'ANTONIO_WORKSPACE_APP_STATE_V1',
    THEME_KEY: 'WTC_KANBAN_THEME_PREF',
    ACTIVE_WORKSPACE_KEY: 'ANTONIO_ACTIVE_WS',
    EMERGENCY_BACKUP_KEY: 'ANTONIO_WORKSPACE_EMERGENCY_BACKUP',

    STAGES: [
        { id: 'BACKLOG', title: 'Backlog', dot: 'bg-zinc-400' },
        { id: 'CREATIVE', title: 'Design & Review', dot: 'bg-amber-400' },
        { id: 'PRODUCTION', title: 'Production', dot: 'bg-sky-400' },
        { id: 'LOGISTICS', title: 'Delivery', dot: 'bg-indigo-400' },
        { id: 'COMPLETED', title: 'Done', dot: 'bg-emerald-400' }
    ],

    SUB_STATUSES: [
        { id: 'AWAITING_ASSETS', label: 'Awaiting Brief', legacy: 'Wait Soft File', stageId: 'BACKLOG', dotColor: '#f472b6', textAccent: 'text-pink-500 dark:text-pink-400' },
        { id: 'IN_DESIGN', label: 'In Design', legacy: 'Work In Progress', stageId: 'CREATIVE', dotColor: '#facc15', textAccent: 'text-amber-600 dark:text-amber-300' },
        { id: 'PENDING_APPROVAL', label: 'Pending Approval', legacy: 'Waiting ACC', stageId: 'CREATIVE', dotColor: '#fb923c', textAccent: 'text-orange-600 dark:text-orange-300' },
        { id: 'REVISION_REQUIRED', label: 'Revision Required', legacy: 'ACC Revisi', stageId: 'CREATIVE', dotColor: '#f59e0b', textAccent: 'text-amber-600 dark:text-amber-400' },
        { id: 'PRINT_PROOF_APPROVAL', label: 'Print Proof Approval', legacy: 'Wait ACC Cetak', stageId: 'PRODUCTION', dotColor: '#a78bfa', textAccent: 'text-violet-600 dark:text-violet-300' },
        { id: 'IN_PRODUCTION', label: 'In Production', legacy: 'Ordering Progress', stageId: 'PRODUCTION', dotColor: '#60a5fa', textAccent: 'text-sky-600 dark:text-sky-300' },
        { id: 'READY_PRINTED', label: 'Ready / Printed', legacy: 'Done Cetak', stageId: 'PRODUCTION', dotColor: '#22d3ee', textAccent: 'text-cyan-600 dark:text-cyan-300' },
        { id: 'DISPATCHED_TRANSIT', label: 'Store Transit', legacy: 'Warehouse Delivery', stageId: 'LOGISTICS', dotColor: '#fbbf24', textAccent: 'text-amber-600 dark:text-amber-200' },
        { id: 'COMPLETED_INSTALLED', label: 'Installed / Done', legacy: 'Done', stageId: 'COMPLETED', dotColor: '#34d399', textAccent: 'text-emerald-600 dark:text-emerald-400' }
    ],

    PRIORITY_WEIGHT: { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 },

    PRIORITY_STYLES: {
        CRITICAL: { label: 'Critical', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-300', pill: 'bg-rose-500/10 border-rose-500/20' },
        HIGH: { label: 'High', dot: 'bg-orange-400', text: 'text-orange-600 dark:text-orange-300', pill: 'bg-orange-500/10 border-orange-500/20' },
        MEDIUM: { label: 'Medium', dot: 'bg-emerald-400', text: 'text-zinc-600 dark:text-zinc-300', pill: 'bg-zinc-500/10 border-zinc-500/15' },
        LOW: { label: 'Low', dot: 'bg-zinc-400', text: 'text-zinc-500 dark:text-zinc-400', pill: 'bg-zinc-500/10 border-zinc-500/15' }
    },

    DEFAULT_CATEGORIES: ['Poster', 'Print/POSM', 'Store Branding', 'Packaging', 'Digital', 'Promo', 'Social Media'],

    DEFAULT_PICS: [
        { id: 'BU_EVY', name: 'BU EVY', role: 'HQ', color: '#eab308' },
        { id: 'ICA', name: 'ICA', role: 'HQ', color: '#a855f7' },
        { id: 'ITA', name: 'ITA', role: 'HQ', color: '#f97316' },
        { id: 'AMIN', name: 'AMIN', role: 'HQ', color: '#ef4444' },
        { id: 'RIANA', name: 'RIANA', role: 'HQ', color: '#84cc16' },
        { id: 'JONA', name: 'JONA', role: 'HQ', color: '#3b82f6' },
        { id: 'LENY', name: 'LENY', role: 'HQ', color: '#60a5fa' },
        { id: 'YOLINDA', name: 'YOLINDA', role: 'HQ', color: '#06b6d4' },
        { id: 'BRILA', name: 'BRILA', role: 'HQ', color: '#f43f5e' },
        { id: 'ANDREAS', name: 'ANDREAS', role: 'HQ', color: '#d97706' },
        { id: 'ANTONIO', name: 'ANTONIO', role: 'HQ', color: '#10b981' },
        { id: 'PAK_WAHYU', name: 'PAK WAHYU', role: 'AM', color: '#94a3b8' },
        { id: 'ABADI', name: 'ABADI', role: 'AM', color: '#c084fc' },
        { id: 'ITHO', name: 'ITHO', role: 'AM', color: '#818cf8' },
        { id: 'IRFAN', name: 'IRFAN', role: 'AM', color: '#2dd4bf' },
        { id: 'SHELLA', name: 'SHELLA', role: 'AM', color: '#38bdf8' },
        { id: 'RENDY', name: 'RENDY', role: 'AM', color: '#60a5fa' },
        { id: 'AYU', name: 'AYU', role: 'AM', color: '#fb7185' },
        { id: 'WINAKA', name: 'WINAKA', role: 'AM', color: '#a1a1aa' }
    ],

    DEFAULT_STORES: [
        { id: 'S01', no: 1, name: 'WTC MOG Malang 1', am: 'ABADI', spv: '' },
        { id: 'S02', no: 2, name: 'WTC MOG Malang 2', am: 'ABADI', spv: '' },
        { id: 'S03', no: 3, name: 'WTC Kota Kasablanka', am: 'PAK WAHYU', spv: '' },
        { id: 'S04', no: 4, name: 'WTC Sawangan', am: 'PAK WAHYU', spv: '' },
        { id: 'S05', no: 5, name: 'WTC Bogor (Botani)', am: 'PAK WAHYU', spv: 'Tim Botani Bogor' },
        { id: 'S06', no: 6, name: 'WTC Cibinong', am: 'PAK WAHYU', spv: '' },
        { id: 'S07', no: 7, name: 'WTC TSM Cibubur', am: 'PAK WAHYU', spv: '' },
        { id: 'S08', no: 8, name: 'WTC Aeon Sentul', am: 'PAK WAHYU', spv: '' },
        { id: 'S09', no: 9, name: 'WTC Jayapura', am: 'ITHO', spv: '' },
        { id: 'S10', no: 10, name: 'WTC Bali Level 21', am: 'ITHO', spv: '' },
        { id: 'S11', no: 11, name: 'WTC Bali TSM', am: 'ITHO', spv: '' },
        { id: 'S12', no: 12, name: 'WTC Mantos', am: 'ITHO', spv: '' },
        { id: 'S13', no: 13, name: 'WTC Megamall Manado', am: 'ITHO', spv: '' },
        { id: 'S14', no: 14, name: 'WTC Palu Grand Mall', am: 'ITHO', spv: '' },
        { id: 'S15', no: 15, name: 'WTC Panakukang', am: 'ITHO', spv: '' },
        { id: 'S16', no: 16, name: 'WTC TSM Makassar', am: 'ITHO', spv: '' },
        { id: 'S17', no: 17, name: 'WTC Ratu Indah Mall', am: 'ITHO', spv: '' },
        { id: 'S18', no: 18, name: 'WTC Gorontalo', am: 'IRFAN', spv: '' },
        { id: 'S19', no: 19, name: 'WTC Kendari', am: 'IRFAN', spv: '' },
        { id: 'S20', no: 20, name: 'WTC 23 Semarang', am: 'SHELLA', spv: '' },
        { id: 'S21', no: 21, name: 'WTC Ayani Pontianak', am: 'SHELLA', spv: '' },
        { id: 'S22', no: 22, name: 'WTC Ciputra Smg', am: 'SHELLA', spv: '' },
        { id: 'S23', no: 23, name: 'WTC GAIA', am: 'SHELLA', spv: '' },
        { id: 'S24', no: 24, name: 'WTC Paragon Smg', am: 'SHELLA', spv: '' },
        { id: 'S25', no: 25, name: 'WTC Alianyang Singkawang', am: 'SHELLA', spv: '' },
        { id: 'S26', no: 26, name: 'WTC Singkawang Grand Mall', am: 'SHELLA', spv: '' },
        { id: 'S27', no: 27, name: 'WTC DP Mall', am: 'SHELLA', spv: '' },
        { id: 'S28', no: 28, name: 'WTC Big Mall', am: 'RENDY', spv: '' },
        { id: 'S29', no: 29, name: 'WTC Ewalk', am: 'RENDY', spv: '' },
        { id: 'S30', no: 30, name: 'WTC Pentacity', am: 'RENDY', spv: '' },
        { id: 'S31', no: 31, name: 'WTC JCM Jogja', am: 'AYU', spv: '' },
        { id: 'S32', no: 32, name: 'WTC Jogja Ambarrukmo Plaza 1', am: 'AYU', spv: '' },
        { id: 'S33', no: 33, name: 'WTC Pakuwon Mall Jogja PMJ', am: 'AYU', spv: '' },
        { id: 'S34', no: 34, name: 'WTC 23 Paskal Bandung', am: 'WINAKA', spv: '' },
        { id: 'S35', no: 35, name: 'WTC Dutamall 1 Banjarmasin', am: 'WINAKA', spv: '' },
        { id: 'S36', no: 36, name: 'WTC Dutamall 2 Banjarmasin', am: 'WINAKA', spv: '' },
        { id: 'S37', no: 37, name: 'WTC Pakuwon Solo Baru', am: 'WINAKA', spv: '' },
        { id: 'S38', no: 38, name: 'WTC Puri Indah Mall', am: 'WINAKA', spv: '' },
        { id: 'S39', no: 39, name: 'WTC Solo Square', am: 'WINAKA', spv: '' },
        { id: 'S40', no: 40, name: 'WTC Summarecon Bandung', am: 'WINAKA', spv: '' },
        { id: 'S41', no: 41, name: 'WTC The Park Solo', am: 'WINAKA', spv: '' },
        { id: 'S42', no: 42, name: 'WTC TSM Bandung', am: 'WINAKA', spv: '' },
        { id: 'S_SORONG', no: 43, name: 'WTC Sorong (Opening)', am: 'ITHO', spv: '' }
    ],

    INITIAL_TASKS: [
        {
            id: 'T101', dateCreated: '2026-10-01', title: 'POSTER WTC BOTANI BOGOR',
            category: 'Poster', priority: 'LOW', deadline: '2026-09-21', picHq: 'PAK WAHYU',
            storeIds: ['S05'], stageId: 'LOGISTICS', subStatus: 'DISPATCHED_TRANSIT',
            notes: 'CEK UDAH DIPASANG APA BELUM SAMA LOGO AKRILIK CV',
            snoozedUntil: null, followUpReason: 'Cek konfirmasi pasang dari tim Botani', lastActionDate: '2026-10-01'
        },
        {
            id: 'T102', dateCreated: '2026-10-01', title: 'POSTER GARMIN WTC MOG 1 & 2',
            category: 'Poster', priority: 'LOW', deadline: '2026-10-09', picHq: 'BU EVY',
            storeIds: ['S01', 'S02', 'S28', 'S30'], stageId: 'PRODUCTION', subStatus: 'IN_PRODUCTION',
            notes: 'REMINDER POSTER GARMIN YANG LAIN PENTA DAN BIG',
            snoozedUntil: null, followUpReason: '', lastActionDate: null
        },
        {
            id: 'T103', dateCreated: '2026-10-01', title: 'SHOPPING BAG LIPAT WATCH CLUB',
            category: 'Packaging', priority: 'MEDIUM', deadline: '2026-09-30', picHq: 'ICA',
            storeIds: ['ALL_STORES'], stageId: 'CREATIVE', subStatus: 'PENDING_APPROVAL',
            notes: 'SUDAH CEK BAHAN DI VENDOR',
            snoozedUntil: null, followUpReason: '', lastActionDate: null
        },
        {
            id: 'T104', dateCreated: '2026-10-01', title: 'AKRILIK LOGO BACKWALL CV WTC BOGOR',
            category: 'Store Branding', priority: 'LOW', deadline: '2026-09-30', picHq: 'ITA',
            storeIds: ['S05'], stageId: 'LOGISTICS', subStatus: 'DISPATCHED_TRANSIT',
            notes: 'TINGGAL ANAK BOTANI SURUH MASANG, KALO GA BISA ORDER TUKANG KONTRAKTOR ACC BRAND CV?',
            snoozedUntil: null, followUpReason: '', lastActionDate: null
        },
        {
            id: 'T105', dateCreated: '2026-10-01', title: 'DESAIN POP PROMO OPENING WTC SORONG, VOUCHER, POP ITEM',
            category: 'Promo', priority: 'CRITICAL', deadline: '2026-09-28', picHq: 'ITHO',
            storeIds: ['S_SORONG'], stageId: 'LOGISTICS', subStatus: 'DISPATCHED_TRANSIT',
            notes: 'POP ITEM TINGGAL KIRIM',
            snoozedUntil: null, followUpReason: '', lastActionDate: null
        },
        {
            id: 'T106', dateCreated: '2026-10-01', title: 'VIDEOTRON WTC UPDATE',
            category: 'Digital', priority: 'MEDIUM', deadline: '2026-09-30', picHq: 'ICA',
            storeIds: ['ALL_STORES'], stageId: 'CREATIVE', subStatus: 'IN_DESIGN',
            notes: 'CEK UDAH DIPASANG APA BELUM SAMA POSTER CV',
            snoozedUntil: null, followUpReason: '', lastActionDate: null
        },
        {
            id: 'T107', dateCreated: '2026-10-01', title: 'VOUCHER TSM BALI',
            category: 'Print/POSM', priority: 'MEDIUM', deadline: '2026-09-28', picHq: 'ICA',
            storeIds: ['S11'], stageId: 'PRODUCTION', subStatus: 'READY_PRINTED',
            notes: 'TINGGAL CETAK AJA',
            snoozedUntil: null, followUpReason: '', lastActionDate: null
        },
        {
            id: 'T108', dateCreated: '2026-10-01', title: 'KARTU UCAPAN SEASONAL NATAL DAN DEFAULT',
            category: 'Print/POSM', priority: 'MEDIUM', deadline: '2026-09-28', picHq: 'ICA',
            storeIds: ['ALL_STORES'], stageId: 'CREATIVE', subStatus: 'REVISION_REQUIRED',
            notes: 'BUAT DIJUAL DI TOKO',
            snoozedUntil: null, followUpReason: '', lastActionDate: null
        }
    ]
};

window.WTC_CONFIG = WTC_CONFIG;