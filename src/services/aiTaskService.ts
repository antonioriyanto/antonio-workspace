import { PIC, Store, TaskFormData, Priority, StageId, AICommandResult } from '../types';
import { WTC_CONFIG } from '../config';
import { getTodayIso, addWorkingDays } from '../utils/dateUtils';

export interface AIParsingContext {
  pics: PIC[];
  categories: string[];
  stores: Store[];
  todayIso: string;
}

interface CandidateEndpoint {
  version: 'v1beta' | 'v1';
  model: string;
}

/**
 * Candidate models and API versions ordered by priority.
 * Uses active current-gen models (gemini-3.5-flash-lite, gemini-3.8-flash, gemini-flash-latest)
 * with 1s retry on transient 503 and automatic fallback on 404.
 */
const CANDIDATE_ENDPOINTS: CandidateEndpoint[] = [
  { version: 'v1beta', model: 'gemini-3.5-flash-lite' },
  { version: 'v1beta', model: 'gemini-3.8-flash' },
  { version: 'v1beta', model: 'gemini-flash-latest' }
];

/**
 * Universal Intent Parser for Antonio Riyanto Workspace.
 * Parses conversational inputs into 3 distinct intents:
 * 1. CREATE_TASK: with exact time/reminder calculation and new store detection
 * 2. FILTER_BOARD: filters kanban board or sheet view
 * 3. UPDATE_TASK: moves or updates existing task status
 */
export async function parseConversationalTask(
  prompt: string,
  context: AIParsingContext,
  customApiKey?: string
): Promise<AICommandResult> {
  const apiKey =
    customApiKey?.trim() ||
    (typeof window !== 'undefined' ? localStorage.getItem('WTC_GEMINI_API_KEY')?.trim() : '') ||
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();

  if (!apiKey) {
    throw new Error('API Key Gemini belum disetel. Masukkan API Key Anda di panel AI atau file .env (VITE_GEMINI_API_KEY).');
  }

  const todayIso = context.todayIso || getTodayIso();
  const todayDate = new Date(todayIso + 'T00:00:00');
  const indonesianDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = indonesianDays[todayDate.getDay()];

  const picNames = context.pics.map(p => p.name);
  const categoriesList = context.categories;
  const storeListFormatted = context.stores.map(s => `${s.id}: ${s.name} (AM: ${s.am})`).join(', ');

  const systemInstructionText = `
Anda adalah Universal AI Command Parser untuk aplikasi Kanban 'Antonio Riyanto Workspace'.
Tugas Anda membaca instruksi percakapan bahasa Indonesia / Inggris, lalu mengklasifikasikan dan mengonversinya ke dalam salah satu dari 3 INTENT:
1. "CREATE_TASK" : Membuat task baru
2. "FILTER_BOARD": Memfilter tampilan kanban board / sheet (misal: "tampilkan task bu evy", "filter urgent", "cari pop promo")
3. "UPDATE_TASK" : Memperbarui / memindahkan status task yang ada (misal: "tandai selesai task kartu ucapan", "pindahkan task #T102 ke produksi")

INFORMASI WAKTU SAAT INI:
- Tanggal hari ini: ${todayIso} (${dayName})

DAFTAR PIC HQ / AM YANG TERSEDIA:
${picNames.join(', ')}

DAFTAR KATEGORI YANG TERSEDIA:
${categoriesList.join(', ')}

DAFTAR TOKO TERDAFTAR:
- "ALL_STORES" (Semua Toko / HQ)
- Toko spesifik: ${storeListFormatted}

DAFTAR STAGE DAN SUB-STATUS:
1. Stage "BACKLOG":
   - "AWAITING_ASSETS" (Awaiting Brief / Menunggu materi)
2. Stage "CREATIVE":
   - "IN_DESIGN" (Sedang didesain / Work In Progress)
   - "PENDING_APPROVAL" (Menunggu ACC / Approval)
   - "REVISION_REQUIRED" (Perlu revisi)
3. Stage "PRODUCTION":
   - "PRINT_PROOF_APPROVAL" (Wait ACC Cetak / Proofing)
   - "IN_PRODUCTION" (Sedang proses cetak / produksi)
   - "READY_PRINTED" (Sudah selesai cetak)
4. Stage "LOGISTICS":
   - "DISPATCHED_TRANSIT" (Dalam pengiriman / Store Transit)
5. Stage "COMPLETED":
   - "COMPLETED_INSTALLED" (Terpasang / Selesai)

ATURAN KHUSUS STAGE & PRIORITAS:
- Permintaan seperti "desain request", "urgent hari ini selesai untuk desain", "tolong buat desain" ->
  - stageId: "CREATIVE"
  - subStatus: "IN_DESIGN"
  - priority: "CRITICAL" atau "HIGH"
- Permintaan "revisi desain" -> stageId: "CREATIVE", subStatus: "REVISION_REQUIRED"
- Permintaan "acc cetak" / "proses produksi" -> stageId: "PRODUCTION", subStatus: "IN_PRODUCTION"
- Permintaan "tandai selesai" / "sudah dipasang" -> stageId: "COMPLETED", subStatus: "COMPLETED_INSTALLED"

ATURAN WAKTU & PENGINGAT (REMINDER):
- "hari ini" -> deadline: ${todayIso}
- "besok" -> deadline: hari ini + 1 hari
- "lusa" -> deadline: hari ini + 2 hari
- Jika menyebutkan jam (misal "deadline jam 3 sore", "jam 15:00") -> masukkan ke notes atau format deadline.
- Pengingat (reminderAt format "YYYY-MM-DDTHH:mm:00"):
  - "sebelum makan siang" / "jam makan siang" -> "${todayIso}T11:30:00"
  - "sebelum pulang" / "sore sebelum pulang" -> "${todayIso}T16:30:00"
  - "ingetin jam [HH]" / "alarm jam [HH]" -> "${todayIso}T[HH]:[MM]:00"
  - Jika tidak ada instruksi pengingat, reminderAt bernilai null.

ATURAN TOKO BARU (NEW STORE):
- Jika prompt menyebutkan nama toko tertentu (misal: "wtc sorong", "wtc grand mall") dan toko tersebut BELUM ADA di DAFTAR TOKO TERDAFTAR di atas:
  - Isi objek newStore: { "name": "WTC Sorong", "am": "" }
  - storeIds: []

FORMAT OUTPUT WAJIB:
Keluarkan HANYA JSON murni tanpa markdown, tanpa teks pengantar:
{
  "intent": "CREATE_TASK" | "FILTER_BOARD" | "UPDATE_TASK",
  "explanation": "Penjelasan singkat",

  // Wajib diisi jika intent == "CREATE_TASK"
  "task": {
    "title": "Judul singkat jelas dalam HURUF KAPITAL",
    "picHq": "Nama PIC cocok dari daftar",
    "category": "Kategori yang cocok",
    "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    "dateCreated": "${todayIso}",
    "deadline": "YYYY-MM-DD",
    "reminderAt": "YYYY-MM-DDTHH:mm:ss" | null,
    "storeIds": ["ALL_STORES"] atau ["ID_TOKO"],
    "stageId": "BACKLOG" | "CREATIVE" | "PRODUCTION" | "LOGISTICS" | "COMPLETED",
    "subStatus": "ID_SUBSTATUS",
    "notes": "Catatan tugas"
  },
  "newStore": {
    "name": "Nama Toko Baru",
    "am": ""
  } | null,

  // Wajib diisi jika intent == "FILTER_BOARD"
  "filter": {
    "search": "kata kunci",
    "priority": "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    "picHq": "ALL" | "NAMA PIC",
    "am": "ALL" | "NAMA AM",
    "store": "ALL" | "ID_TOKO",
    "category": "ALL" | "KATEGORI",
    "quickUrgentOnly": false
  } | null,

  // Wajib diisi jika intent == "UPDATE_TASK"
  "update": {
    "targetQuery": "kata kunci judul task atau #ID",
    "targetStageId": "COMPLETED" | "CREATIVE" | "PRODUCTION" | "LOGISTICS" | "BACKLOG",
    "targetSubStatus": "COMPLETED_INSTALLED"
  } | null
}
`.trim();

  const attemptErrors: string[] = [];
  let parsedJson: Record<string, unknown> | null = null;

  // Try candidate endpoints in fallback sequence
  for (const candidate of CANDIDATE_ENDPOINTS) {
    const endpointUrl = `https://generativelanguage.googleapis.com/${candidate.version}/models/${candidate.model}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `Tolong parse instruksi/percakapan berikut:\n"${prompt.trim()}"`
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: systemInstructionText
          }
        ]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    };

    let response: Response | null = null;
    let lastStatus = 0;
    let lastErrorMsg = '';

    // Up to 2 attempts: initial call + 1 retry with 1000ms delay if 503 occurs
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          break; // Succeeded! Break retry loop and proceed to parse JSON
        }

        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        lastStatus = response.status;
        lastErrorMsg = message;

        // Immediate stop for invalid credentials or quota issues
        if (
          response.status === 401 ||
          response.status === 403 ||
          message.toLowerCase().includes('api_key_invalid') ||
          message.toLowerCase().includes('api key not valid')
        ) {
          throw new Error(`API Key Gemini tidak valid atau izin akses ditolak (${message}). Pastikan API Key Anda aktif di Google AI Studio.`);
        }

        if (response.status === 429 || message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate limit')) {
          throw new Error(`Batas kuota Gemini API tercapai (Rate Limit / Quota Exceeded: ${message}). Silakan coba lagi beberapa saat.`);
        }

        // Handle 503 (Transient High Demand): wait 1000ms and retry once
        const is503 =
          response.status === 503 ||
          message.toLowerCase().includes('high demand') ||
          message.toLowerCase().includes('temporarily overloaded') ||
          message.toLowerCase().includes('unavailable');

        if (is503 && attempt === 0) {
          console.warn(`[Gemini 503 Retry] Model ${candidate.model} 503 high demand: ${message}. Menunggu 1000ms untuk mencoba ulang...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue; // Retry once
        }

        // Non-503 error or 503 failed after retry -> break to fallback
        break;
      } catch (err: unknown) {
        if (err instanceof Error && (err.message.includes('API Key Gemini tidak valid') || err.message.includes('Batas kuota Gemini API tercapai'))) {
          throw err;
        }
        lastErrorMsg = err instanceof Error ? err.message : String(err);
        break;
      }
    }

    if (!response || !response.ok) {
      console.warn(`[Gemini Fallback] Model ${candidate.version}/${candidate.model} gagal (${lastStatus}): ${lastErrorMsg}`);
      attemptErrors.push(`${candidate.version}/${candidate.model} [${lastStatus || 'Error'}]: ${lastErrorMsg}`);
      continue;
    }

    try {
      const result = await response.json();
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        attemptErrors.push(`${candidate.version}/${candidate.model}: Respon kosong dari model.`);
        continue;
      }

      // Robust clean JSON extraction (strips markdown ```json ... ``` wrapper or surrounding text)
      let cleanedText = rawText.trim();
      cleanedText = cleanedText.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim();

      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }

      parsedJson = JSON.parse(cleanedText);
      // Successfully parsed JSON, break out of candidate loop
      break;
    } catch (parseErr) {
      console.warn(`[Gemini JSON Parse Error] Candidate ${candidate.version}/${candidate.model}:`, parseErr);
      attemptErrors.push(`${candidate.version}/${candidate.model}: Format output bukan JSON yang valid.`);
      continue;
    }
  }

  if (!parsedJson) {
    const errorDetails = attemptErrors.length > 0
      ? attemptErrors.map(e => `• ${e}`).join('\n')
      : 'Tidak ada endpoint model yang merespon.';
    throw new Error(
      `Gagal menghubungi Gemini API. Semua endpoint model fallback tidak dapat diakses:\n${errorDetails}\n\nPastikan API Key Anda valid dan memiliki izin akses di Google AI Studio (https://aistudio.google.com).`
    );
  }

  // Determine intent
  const intentRaw = typeof parsedJson.intent === 'string' ? parsedJson.intent.toUpperCase() : 'CREATE_TASK';
  const intent: 'CREATE_TASK' | 'FILTER_BOARD' | 'UPDATE_TASK' =
    ['FILTER_BOARD', 'UPDATE_TASK'].includes(intentRaw) ? (intentRaw as 'FILTER_BOARD' | 'UPDATE_TASK') : 'CREATE_TASK';

  const explanation = typeof parsedJson.explanation === 'string' ? parsedJson.explanation.trim() : '';

  // 1. FILTER_BOARD intent handling
  if (intent === 'FILTER_BOARD') {
    const filterObj = (parsedJson.filter && typeof parsedJson.filter === 'object')
      ? (parsedJson.filter as Record<string, unknown>)
      : {};

    return {
      intent: 'FILTER_BOARD',
      explanation: explanation || 'Filter board diterapkan',
      filter: {
        search: typeof filterObj.search === 'string' ? filterObj.search.trim() : '',
        priority: typeof filterObj.priority === 'string' ? filterObj.priority : 'ALL',
        picHq: typeof filterObj.picHq === 'string' ? filterObj.picHq : 'ALL',
        am: typeof filterObj.am === 'string' ? filterObj.am : 'ALL',
        store: typeof filterObj.store === 'string' ? filterObj.store : 'ALL',
        category: typeof filterObj.category === 'string' ? filterObj.category : 'ALL',
        quickUrgentOnly: Boolean(filterObj.quickUrgentOnly)
      }
    };
  }

  // 2. UPDATE_TASK intent handling
  if (intent === 'UPDATE_TASK') {
    const updateObj = (parsedJson.update && typeof parsedJson.update === 'object')
      ? (parsedJson.update as Record<string, unknown>)
      : {};

    const targetQuery = typeof updateObj.targetQuery === 'string' ? updateObj.targetQuery.trim() : prompt.trim();
    let targetStageId: StageId = 'COMPLETED';
    if (typeof updateObj.targetStageId === 'string' && WTC_CONFIG.STAGES.some(s => s.id === updateObj.targetStageId)) {
      targetStageId = updateObj.targetStageId as StageId;
    }

    const targetSubStatus = typeof updateObj.targetSubStatus === 'string' ? updateObj.targetSubStatus : undefined;

    return {
      intent: 'UPDATE_TASK',
      explanation: explanation || `Memperbarui task "${targetQuery}"`,
      update: {
        targetQuery,
        targetStageId,
        targetSubStatus
      }
    };
  }

  // 3. CREATE_TASK intent handling (default)
  const taskObj = (parsedJson.task && typeof parsedJson.task === 'object')
    ? (parsedJson.task as Record<string, unknown>)
    : parsedJson;

  const title = (typeof taskObj.title === 'string' && taskObj.title.trim())
    ? taskObj.title.trim().toUpperCase()
    : prompt.slice(0, 40).toUpperCase();

  // Match PIC
  let picHq = picNames[0] || 'BU EVY';
  if (typeof taskObj.picHq === 'string') {
    const matchedPic = picNames.find(p => p.toLowerCase() === (taskObj.picHq as string).toLowerCase());
    if (matchedPic) picHq = matchedPic;
  }

  // Match Category
  let category = categoriesList[0] || 'Poster';
  if (typeof taskObj.category === 'string') {
    const matchedCat = categoriesList.find(c => c.toLowerCase() === (taskObj.category as string).toLowerCase());
    if (matchedCat) category = matchedCat;
  }

  // Match Priority (Default CRITICAL if prompt has urgent cues)
  let priority: Priority = 'MEDIUM';
  const promptLower = prompt.toLowerCase();
  if (promptLower.includes('urgent') || promptLower.includes('kritis') || promptLower.includes('asap') || promptLower.includes('segera')) {
    priority = 'CRITICAL';
  } else if (typeof taskObj.priority === 'string') {
    const pUpper = (taskObj.priority as string).toUpperCase();
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(pUpper)) {
      priority = pUpper as Priority;
    }
  }

  // Match Deadline
  let deadline = addWorkingDays(todayIso, 3);
  if (typeof taskObj.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(taskObj.deadline)) {
    deadline = taskObj.deadline;
  }

  // Match ReminderAt
  let reminderAt: string | null = null;
  if (typeof taskObj.reminderAt === 'string') {
    const remRaw = taskObj.reminderAt.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(remRaw)) {
      reminderAt = remRaw.length === 16 ? `${remRaw}:00` : remRaw;
    }
  } else if (promptLower.includes('makan siang')) {
    reminderAt = `${todayIso}T11:30:00`;
  } else if (promptLower.includes('sebelum pulang') || promptLower.includes('pulang kerja')) {
    reminderAt = `${todayIso}T16:30:00`;
  }

  // Match Stage & SubStatus
  let stageId: StageId = 'CREATIVE';
  if (promptLower.includes('desain request') || promptLower.includes('untuk desain') || promptLower.includes('desain')) {
    stageId = 'CREATIVE';
  } else if (typeof taskObj.stageId === 'string' && WTC_CONFIG.STAGES.some(s => s.id === taskObj.stageId)) {
    stageId = taskObj.stageId as StageId;
  }

  let subStatus = WTC_CONFIG.SUB_STATUSES.find(s => s.stageId === stageId)?.id || 'IN_DESIGN';
  if (typeof taskObj.subStatus === 'string') {
    const matchedSub = WTC_CONFIG.SUB_STATUSES.find(s => s.id === taskObj.subStatus);
    if (matchedSub) {
      subStatus = matchedSub.id;
      stageId = matchedSub.stageId;
    }
  }

  // Match StoreIds
  let storeIds: string[] = ['ALL_STORES'];
  if (Array.isArray(taskObj.storeIds) && taskObj.storeIds.length > 0) {
    storeIds = taskObj.storeIds.map(String);
  }

  // Match newStore
  let newStore: { name: string; am?: string } | null = null;
  const newStoreRaw = parsedJson.newStore as { name?: string; am?: string } | undefined;
  if (newStoreRaw && typeof newStoreRaw.name === 'string' && newStoreRaw.name.trim() !== '') {
    const cleanStoreName = newStoreRaw.name.trim();
    const existing = context.stores.find(s => s.name.toLowerCase() === cleanStoreName.toLowerCase());
    if (existing) {
      storeIds = [existing.id];
    } else {
      newStore = {
        name: cleanStoreName,
        am: newStoreRaw.am || ''
      };
      storeIds = [];
    }
  }

  const notes = typeof taskObj.notes === 'string' ? taskObj.notes.trim() : '';

  const taskData: TaskFormData = {
    title,
    category,
    priority,
    dateCreated: todayIso,
    deadline,
    picHq,
    storeIds,
    stageId,
    subStatus,
    notes,
    reminderAt,
    reminderNotified: false
  };

  return {
    intent: 'CREATE_TASK',
    explanation: explanation || 'Task baru berhasil dipersiapkan',
    task: taskData,
    newStore
  };
}
