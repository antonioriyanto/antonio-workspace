/**
 * Antonio Riyanto — Workspace Backend (Google Apps Script)
 * ------------------------------------------------------------------
 * Backward-compatible upgrade:
 *  - Primary storage: sheet `_APP_STATE` cell A1 (JSON).
 *  - Mirror storage: PropertiesService `WTC_STATE_JSON` (legacy fallback).
 *  - Human-readable mirror: sheet `Tasks_Readable`.
 *  - API contract unchanged: POST { action:'SAVE_ALL', payload } and GET ?action=LOAD_ALL.
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
  } catch (e) {
    // Quota fallback — sheet remains source of truth
  }

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
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* fall through */ }
    }
  }

  // Backward-compatible fallback
  var legacy = PropertiesService.getScriptProperties().getProperty(STATE_PROPERTY_KEY);
  if (legacy) {
    try { return JSON.parse(legacy); } catch (e) { /* ignore */ }
  }

  return null;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Optional: run manually once to smoke-test */
function testSaveAndLoad() {
  var sample = {
    tasks: [{ id: 'TEST', title: 'Sample Task', storeIds: ['ALL_STORES'] }],
    stores: [], pics: [], categories: []
  };
  saveState_(sample);
  Logger.log(JSON.stringify(loadState_()));
}