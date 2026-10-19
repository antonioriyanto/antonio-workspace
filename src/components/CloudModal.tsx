import React, { useState } from 'react';
import {
  X,
  Download,
  Upload,
  FileSpreadsheet,
  Copy,
  RotateCcw,
  Check,
  HardDrive
} from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { formatDateHuman } from '../utils/dateUtils';

const GAS_SCRIPT_CODE = `/**
 * Antonio Riyanto — Workspace Backend (Google Apps Script)
 * ------------------------------------------------------------------
 * Primary storage: sheet '_APP_STATE' cell A1 (JSON).
 * Human-readable mirror: sheet 'Tasks_Readable'.
 * API contract: POST { action:'SAVE_ALL', payload } and GET ?action=LOAD_ALL.
 */

var STATE_PROPERTY_KEY = 'WTC_STATE_JSON';
var APP_STATE_SHEET   = '_APP_STATE';
var READABLE_SHEET    = 'Tasks_Readable';

function doGet(e) {
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

  try {
    PropertiesService.getScriptProperties().setProperty(STATE_PROPERTY_KEY, jsonStr);
  } catch (e) {}

  writeReadableSheet_(ss, payload);
}

function writeReadableSheet_(ss, payload) {
  var sheet = getOrCreateSheet_(ss, READABLE_SHEET);
  sheet.clear();

  var headers = ['ID','Tanggal','Task','Kategori','Prioritas','Deadline','PIC','Toko','Stage','SubStatus','Catatan'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6');

  var tasks  = Array.isArray(payload.tasks)  ? payload.tasks  : [];
  var stores = Array.isArray(payload.stores) ? payload.stores : [];

  var rows = tasks.map(function (t) {
    var storeNames = (t.storeIds || []).indexOf('ALL_STORES') >= 0
      ? 'Semua Toko (HQ)'
      : (t.storeIds || []).map(function (id) {
          var s = stores.filter(function (x) { return x.id === id; })[0];
          return s ? s.name : id;
        }).join('; ');

    return [
      t.id || '',
      t.dateCreated || '',
      t.title || '',
      t.category || '',
      t.priority || '',
      t.deadline || '',
      t.picHq || '',
      storeNames,
      t.stageId || '',
      t.subStatus || '',
      t.notes || ''
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function loadState_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stateSheet = ss.getSheetByName(APP_STATE_SHEET);
  if (stateSheet) {
    var raw = stateSheet.getRange('A1').getValue();
    if (raw && typeof raw === 'string' && raw.charAt(0) === '{') {
      return JSON.parse(raw);
    }
  }
  var prop = PropertiesService.getScriptProperties().getProperty(STATE_PROPERTY_KEY);
  if (prop) return JSON.parse(prop);
  return null;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export const CloudModal: React.FC = () => {
  const {
    isCloudModalOpen,
    closeCloudModal,
    gasWebhookUrl,
    setGasWebhookUrl,
    autoSyncEnabled,
    toggleAutoSync,
    pushToGoogleSheets,
    pullFromGoogleSheets,
    exportBackupJson,
    importBackupJson,
    exportCsv,
    rollbackEmergencySnapshot,
    getStorageStats,
    addToast
  } = useWorkspaceStore();

  const [inputUrl, setInputUrl] = useState(gasWebhookUrl);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  React.useEffect(() => {
    setInputUrl(gasWebhookUrl);
  }, [gasWebhookUrl]);

  if (!isCloudModalOpen) return null;

  const stats = getStorageStats();

  const handleSaveUrl = () => {
    setGasWebhookUrl(inputUrl);
  };

  const handlePush = async () => {
    setIsSyncing(true);
    await pushToGoogleSheets(false);
    setIsSyncing(false);
  };

  const handlePull = async () => {
    setIsSyncing(true);
    await pullFromGoogleSheets(true, false);
    setIsSyncing(false);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GAS_SCRIPT_CODE);
      setCopiedCode(true);
      addToast('Kode Google Apps Script disalin ke clipboard!', 'success');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      addToast('Gagal menyalin kode', 'error');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        importBackupJson(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCloudModal();
      }}
    >
      <div className="glass-panel bg-white/95 dark:bg-[#141417]/95 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              Sinkronisasi & Backup
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Cadangkan data lokal, ekspor CSV/JSON, atau hubungkan ke Google Sheets
            </p>
          </div>
          <button
            type="button"
            onClick={closeCloudModal}
            className="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {/* Section 1: Backup Lokal */}
          <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-white/40 dark:bg-zinc-900/40">
            <div>
              <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                Backup Lokal (JSON / CSV)
              </h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Simpan atau pulihkan seluruh data task dan toko dari komputer Anda.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportBackupJson}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="px-3 py-1.5 rounded-lg glass-control font-medium flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                <span>CSV</span>
              </button>
              <label className="px-3 py-1.5 rounded-lg glass-control font-medium cursor-pointer flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100">
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Section 2: Google Sheets Sync */}
          <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-3 bg-white/40 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                  Google Sheets Sync (Apps Script Webhook)
                </h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Hubungkan ke Google Spreadsheet pribadi secara aman tanpa biaya bulanan.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2.5 py-1 rounded-lg glass-control text-[11px] font-medium flex items-center gap-1 text-zinc-700 dark:text-zinc-300"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                <span>{copiedCode ? 'Tersalin' : 'Copy Code.gs'}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              />
              <button
                type="button"
                onClick={handleSaveUrl}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium whitespace-nowrap shadow-sm"
              >
                Simpan URL
              </button>
              <button
                type="button"
                disabled={isSyncing}
                onClick={handlePush}
                className="px-3 py-1.5 rounded-lg glass-control font-medium text-zinc-700 dark:text-zinc-300 disabled:opacity-50"
              >
                Push
              </button>
              <button
                type="button"
                disabled={isSyncing}
                onClick={handlePull}
                className="px-3 py-1.5 rounded-lg glass-control font-medium text-zinc-700 dark:text-zinc-300 disabled:opacity-50"
              >
                Pull
              </button>
            </div>
          </div>

          {/* Section 3: Status Penyimpanan & Emergency Rollback */}
          <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-3 bg-white/40 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-zinc-400" />
                  <span>Status Penyimpanan & Emergency Snapshot</span>
                </h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Snapshot otomatis dibuat di browser sebelum aksi berisiko (PULL, Import, Delete).
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => toggleAutoSync(e.target.checked)}
                  className="rounded accent-emerald-600"
                />
                <span>Auto-Sync</span>
              </label>
            </div>

            {/* Storage Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-lg bg-zinc-100/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 uppercase font-mono">Tasks</div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">{stats.taskCount}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-100/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 uppercase font-mono">Toko</div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">{stats.storeCount}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-100/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 uppercase font-mono">PIC</div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">{stats.picCount}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-100/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800/60">
                <div className="text-[10px] text-zinc-400 uppercase font-mono">Ukuran Data</div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">{stats.sizeKb} KB</div>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-200/70 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-zinc-500">
                Snapshot: {stats.lastBackupTime ? formatDateHuman(stats.lastBackupTime.split('T')[0]) : 'Belum ada snapshot'}
              </span>
              <button
                type="button"
                onClick={rollbackEmergencySnapshot}
                className="px-3 py-1.5 rounded-lg glass-control font-medium flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 hover:text-amber-500"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Pulihkan Data Terakhir</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
