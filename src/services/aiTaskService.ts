import { PIC, Store, Task, TaskFormData, Priority, StageId, AICommandResult } from '../types';
import { WTC_CONFIG } from '../config';
import { getTodayIso, addWorkingDays } from '../utils/dateUtils';

export interface AIParsingContext {
  tasks?: Task[];
  pics: PIC[];
  categories: string[];
  stores: Store[];
  todayIso: string;
  activeWorkspace?: string;
  currentTimeIso?: string;
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
 * Common generic words that should NOT cause auto-matching to a single task
 * without user confirmation chips.
 */
export const GENERIC_STOP_WORDS = new Set([
  'pop', 'poster', 'cetak', 'revisi', 'desain', 'design', 'print',
  'banner', 'brosur', 'flyer', 'task', 'tugas', 'urgent', 'acc',
  'promo', 'opening', 'project', 'projek', 'baru'
]);

export interface FuzzyMatchResult {
  exactMatch: Task | null;
  candidates: Task[];
  isGenericStopWord: boolean;
}

/**
 * Deep fuzzy task matching across title, notes, category, and picHq with guardrails
 * against single generic words ("pop", "poster", "cetak", "revisi").
 */
export function findMatchingTasks(query: string, tasks: Task[]): FuzzyMatchResult {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return { exactMatch: null, candidates: [], isGenericStopWord: false };
  }

  const cleanQuery = trimmed.replace(/^#/, '').toLowerCase();
  const tokens = cleanQuery.split(/\s+/).filter(t => t.length > 0);
  const isGenericStopWord = tokens.length === 1 && GENERIC_STOP_WORDS.has(tokens[0]);

  // Priority 1: Exact task ID match
  const idMatch = tasks.find(t => t.id.toLowerCase() === cleanQuery);
  if (idMatch) {
    return { exactMatch: idMatch, candidates: [idMatch], isGenericStopWord: false };
  }

  // Priority 2: Exact title match
  const titleExactMatches = tasks.filter(t => t.title.toLowerCase() === cleanQuery);
  if (titleExactMatches.length === 1 && !isGenericStopWord) {
    return { exactMatch: titleExactMatches[0], candidates: titleExactMatches, isGenericStopWord: false };
  }

  // Deep scoring across title, notes, category, picHq
  const scored = tasks.map(t => {
    const titleLower = t.title.toLowerCase();
    const notesLower = (t.notes || '').toLowerCase();
    const catLower = (t.category || '').toLowerCase();
    const picLower = (t.picHq || '').toLowerCase();

    let score = 0;
    if (titleLower === cleanQuery) score += 100;
    if (titleLower.startsWith(cleanQuery)) score += 50;
    if (titleLower.includes(cleanQuery)) score += 30;
    if (notesLower.includes(cleanQuery)) score += 15;
    if (catLower.includes(cleanQuery)) score += 10;
    if (picLower.includes(cleanQuery)) score += 10;

    tokens.forEach(tok => {
      if (tok.length > 1) {
        if (titleLower.includes(tok)) score += 8;
        if (notesLower.includes(tok)) score += 4;
        if (catLower.includes(tok)) score += 3;
        if (picLower.includes(tok)) score += 3;
      }
    });

    return { task: t, score };
  });

  const candidates = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.task);

  // If query is a single generic stop word (e.g. "pop", "poster", "cetak", "revisi"),
  // guardrail prevents auto-picking an arbitrary exact match: require user selection chips!
  if (isGenericStopWord) {
    return { exactMatch: null, candidates, isGenericStopWord: true };
  }

  // If single candidate
  if (candidates.length === 1) {
    return { exactMatch: candidates[0], candidates, isGenericStopWord: false };
  }

  // If top candidate has a clear decisive margin
  if (candidates.length > 1) {
    const topScore = scored.find(s => s.task.id === candidates[0].id)?.score || 0;
    const secondScore = scored.find(s => s.task.id === candidates[1].id)?.score || 0;
    if (topScore >= 30 && topScore >= secondScore * 1.8) {
      return { exactMatch: candidates[0], candidates, isGenericStopWord: false };
    }
  }

  return { exactMatch: null, candidates, isGenericStopWord: false };
}

/**
 * Helper to build TaskFormData with workspace-aware defaults,
 * smart alarm rollover, and new store detection.
 */
export function buildTaskFormData(
  taskObj: Record<string, unknown> | undefined,
  prompt: string,
  context: AIParsingContext,
  todayIso: string
): { task: TaskFormData; newStore: { name: string; am?: string } | null } {
  const isPersonal = context.activeWorkspace === 'Personal Project';
  const picNames = context.pics.map(p => p.name);
  const categoriesList = context.categories;

  const rawObj = taskObj || {};

  // Title
  let title = (typeof rawObj.title === 'string' && rawObj.title.trim())
    ? rawObj.title.trim().toUpperCase()
    : prompt.slice(0, 40).toUpperCase();

  title = title.replace(/^(?:LALU|KEMUDIAN|SETELAH ITU)\s+(?:BIKIN|BUAT|TAMBAH)\s+(?:TASK\s+)?/i, '').trim();
  if (!title) title = 'UNTITLED TASK';

  // Workspace-Aware Default PIC
  let defaultPic = isPersonal
    ? (picNames.find(p => p.toUpperCase() === 'ANTONIO') || 'ANTONIO')
    : (picNames[0] || 'BU EVY');

  let picHq = defaultPic;
  if (typeof rawObj.picHq === 'string' && rawObj.picHq.trim()) {
    const matchedPic = picNames.find(p => p.toLowerCase() === (rawObj.picHq as string).toLowerCase().trim());
    if (matchedPic) {
      picHq = matchedPic;
    } else {
      picHq = rawObj.picHq.trim().toUpperCase();
    }
  }

  // Workspace-Aware Default Category
  let defaultCategory = isPersonal
    ? (categoriesList.find(c => c.toLowerCase() === 'digital') || 'Digital')
    : (categoriesList[0] || 'Poster');

  let category = defaultCategory;
  if (typeof rawObj.category === 'string' && rawObj.category.trim()) {
    const matchedCat = categoriesList.find(c => c.toLowerCase() === (rawObj.category as string).toLowerCase().trim());
    if (matchedCat) category = matchedCat;
  }

  // Priority
  let priority: Priority = 'MEDIUM';
  const promptLower = prompt.toLowerCase();
  if (promptLower.includes('urgent') || promptLower.includes('kritis') || promptLower.includes('asap') || promptLower.includes('segera')) {
    priority = 'CRITICAL';
  } else if (typeof rawObj.priority === 'string') {
    const pUpper = (rawObj.priority as string).toUpperCase();
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(pUpper)) {
      priority = pUpper as Priority;
    }
  }

  // Deadline
  let deadline = addWorkingDays(todayIso, 3);
  if (typeof rawObj.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawObj.deadline)) {
    deadline = rawObj.deadline;
  }

  // ReminderAt with Smart Alarm Rollover
  let reminderAt: string | null = null;
  if (typeof rawObj.reminderAt === 'string' && rawObj.reminderAt.trim()) {
    const remRaw = rawObj.reminderAt.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(remRaw)) {
      reminderAt = remRaw.length === 16 ? `${remRaw}:00` : remRaw;
    }
  } else if (promptLower.includes('makan siang')) {
    reminderAt = `${todayIso}T11:30:00`;
  } else if (promptLower.includes('sebelum pulang') || promptLower.includes('pulang kerja')) {
    reminderAt = `${todayIso}T16:30:00`;
  }

  // Smart Alarm Rollover: if reminder time has already passed today, rollover to 09:00 AM on next working day
  if (reminderAt) {
    const reminderDate = new Date(reminderAt);
    const now = new Date();
    if (!isNaN(reminderDate.getTime()) && reminderDate.getTime() <= now.getTime()) {
      const nextWorkDay = addWorkingDays(todayIso, 1);
      reminderAt = `${nextWorkDay}T09:00:00`;
    }
  }

  // Stage & SubStatus
  let stageId: StageId = 'CREATIVE';
  if (promptLower.includes('desain request') || promptLower.includes('untuk desain') || promptLower.includes('desain')) {
    stageId = 'CREATIVE';
  } else if (typeof rawObj.stageId === 'string' && WTC_CONFIG.STAGES.some(s => s.id === rawObj.stageId)) {
    stageId = rawObj.stageId as StageId;
  }

  let subStatus = WTC_CONFIG.SUB_STATUSES.find(s => s.stageId === stageId)?.id || 'IN_DESIGN';
  if (typeof rawObj.subStatus === 'string') {
    const matchedSub = WTC_CONFIG.SUB_STATUSES.find(s => s.id === rawObj.subStatus);
    if (matchedSub) {
      subStatus = matchedSub.id;
      stageId = matchedSub.stageId;
    }
  }

  // StoreIds: Workspace-Aware Default
  let storeIds: string[] = ['ALL_STORES'];
  if (Array.isArray(rawObj.storeIds) && rawObj.storeIds.length > 0) {
    storeIds = rawObj.storeIds.map(String);
  }

  // newStore
  let newStore: { name: string; am?: string } | null = null;
  const newStoreRaw = rawObj.newStore as { name?: string; am?: string } | undefined;
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

  const notes = typeof rawObj.notes === 'string' ? rawObj.notes.trim() : '';

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

  return { task: taskData, newStore };
}

/**
 * Context-Aware Assistant & Universal Intent Parser for Antonio Riyanto Workspace.
 * Parses conversational inputs into 5 distinct intents:
 * 1. ANSWER_QUERY: answers analytical board queries (e.g. "Ada berapa task telat hari ini?")
 * 2. CREATE_TASK: creates tasks with smart alarm rollover and workspace defaults
 * 3. FILTER_BOARD: filters kanban board or sheet view with semantic guardrails
 * 4. UPDATE_TASK: moves or updates existing task status
 * 5. DELETE_TASK: soft-deletes a task to the recycle bin
 * Also supports Multi-Intent Chaining (e.g. update + create).
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

  const isPersonal = context.activeWorkspace === 'Personal Project';
  const picNames = context.pics.map(p => p.name);
  const categoriesList = context.categories;
  const storeListFormatted = context.stores.map(s => `${s.id}: ${s.name} (AM: ${s.am})`).join(', ');

  // Inject active task summary so AI is context-aware
  const tasksList = context.tasks || [];
  const activeTasks = tasksList.filter(t => t.stageId !== 'COMPLETED');
  const taskSummary = activeTasks.length > 0
    ? activeTasks.map(t => {
        const isOverdue = t.deadline && t.deadline < todayIso;
        const isDueToday = t.deadline === todayIso;
        const tag = isOverdue ? '[OVERDUE/TELAT]' : isDueToday ? '[DEADLINE HARI INI]' : '';
        return `[#${t.id}] "${t.title}" (PIC: ${t.picHq}, Prioritas: ${t.priority}, Stage: ${t.stageId}, Deadline: ${t.deadline} ${tag})`.trim();
      }).join('\n')
    : '(Tidak ada task aktif di workspace saat ini)';

  const systemInstructionText = `
Anda adalah Context-Aware AI Assistant & Universal Command Parser untuk aplikasi Kanban 'Antonio Riyanto Workspace'.
Tugas Anda membaca instruksi atau pertanyaan percakapan bahasa Indonesia / Inggris dari pengguna, lalu mengklasifikasikan dan mengonversinya ke dalam salah satu dari 5 INTENT:

1. "ANSWER_QUERY" : Menjawab pertanyaan analitis, status, jumlah, atau informasi umum mengenai task di board saat ini.
   - Contoh pertanyaan: "Ada berapa task telat hari ini?", "Siapa PIC yang pegang task paling banyak?", "Task apa saja yang deadline hari ini?", "Berapa task di stage creative?", "Ringkas kondisi board saat ini".
   - Gunakan data "RINGKASAN TASK AKTIF SAAT INI" di bawah untuk menjawab secara akurat, ramah, dan ringkas.
   - Wajib mengisi field "answer" dengan teks jawaban lengkap dalam bahasa Indonesia.

2. "CREATE_TASK" : Membuat task baru dari instruksi percakapan.
   - Contoh: "Bikin task baru kartu ucapan pic bu evy deadline besok", "Desain request pop promo urgent hari ini selesai untuk desain".

3. "FILTER_BOARD" : Memfilter tampilan kanban board / sheet.
   - Contoh: "Filter task bu evy", "Tampilkan yang urgent", "Filter toko wtc sorong", "Cari poster promo opening".
   - PENTING (SEMANTIC FILTER GUARDRAIL):
     * JANGAN PERNAH memasukkan kata sifat/konsep filter seperti "overdue", "telat", "urgent", "kritis", "selesai", "backlog", "creative" ke dalam "filter.search"!
     * Kata sifat BUKAN kata pencarian teks judul task!
     * Jika pengguna meminta task urgent -> isi filter.priority: "CRITICAL" atau filter.quickUrgentOnly: true, dan filter.search: "".
     * Jika pengguna meminta task dari PIC tertentu -> isi filter.picHq: "NAMA_PIC", dan filter.search: "".
     * Jika pengguna bertanya (contoh: "ada berapa task telat?") -> INI ADALAH ANSWER_QUERY, BUKAN FILTER_BOARD!
     * "filter.search" HANYA digunakan jika pengguna mencari kata kunci teks produk atau subjek task spesifik (misal: "kartu ucapan", "shopping bag", "banner").

4. "UPDATE_TASK" : Memperbarui / memindahkan status task yang ada.
   - Contoh: "Tandai selesai task kartu ucapan", "Pindahkan task #T102 ke produksi".

5. "DELETE_TASK" : Menghapus / memindahkan task yang ada ke Recycle Bin (soft delete).
   - Contoh: "Hapus task kartu ucapan", "Delete task #T102", "Buang task flyer promo ke recycle bin".

WORKSPACE AKTIF: "${context.activeWorkspace || 'Watch Club'}"
ATURAN WORKSPACE-AWARE DEFAULTS:
${isPersonal ? `
- Saat ini workspace adalah "Personal Project":
  * Default PIC jika tidak disebutkan adalah "ANTONIO".
  * Default Kategori jika tidak disebutkan adalah "Digital".
  * Default Toko adalah "ALL_STORES".
` : `
- Saat ini workspace adalah "Watch Club":
  * Default PIC jika tidak disebutkan adalah "${picNames[0] || 'BU EVY'}".
  * Default Kategori jika tidak disebutkan adalah "${categoriesList[0] || 'Poster'}".
  * Default Toko adalah "ALL_STORES".
`}

MULTI-INTENT CHAINING:
Jika pengguna memberikan dua perintah berantai sekaligus dengan kata hubung "lalu", "kemudian", "dan setelah itu" (contoh: "Tandai selesai task kartu ucapan lalu bikin task baru poster promo ramadhan"):
- Tetapkan intent utama pada aksi pertama ("UPDATE_TASK" atau "DELETE_TASK").
- Isi field "chainedAction" dengan aksi kedua ("CREATE_TASK").

SMART ALARM ROLLOVER:
Jika pengguna meminta waktu pengingat/alarm pada jam tertentu, dan jam tersebut sudah terlewat hari ini, jadwalkan pengingat ke jam 09:00:00 pagi di hari kerja berikutnya ("${addWorkingDays(todayIso, 1)}T09:00:00").

INFORMASI WAKTU SAAT INI:
- Tanggal hari ini: ${todayIso} (${dayName})

RINGKASAN TASK AKTIF SAAT INI DI BOARD:
${taskSummary}

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

FORMAT OUTPUT WAJIB:
Keluarkan HANYA JSON murni tanpa markdown, tanpa teks pengantar:
{
  "intent": "ANSWER_QUERY" | "CREATE_TASK" | "FILTER_BOARD" | "UPDATE_TASK" | "DELETE_TASK",
  "explanation": "Penjelasan singkat",

  // Wajib jika intent == "ANSWER_QUERY"
  "answer": "Jawaban lengkap dan jelas berdasarkan task aktif di board saat ini",

  // Wajib jika intent == "CREATE_TASK"
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

  // Wajib jika intent == "FILTER_BOARD"
  "filter": {
    "search": "kata kunci spesifik produk (BUKAN 'overdue' / 'telat' / 'urgent')",
    "priority": "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    "picHq": "ALL" | "NAMA PIC",
    "am": "ALL" | "NAMA AM",
    "store": "ALL" | "ID_TOKO",
    "category": "ALL" | "KATEGORI",
    "quickUrgentOnly": false
  } | null,

  // Wajib jika intent == "UPDATE_TASK"
  "update": {
    "targetQuery": "kata kunci judul task atau #ID",
    "targetStageId": "COMPLETED" | "CREATIVE" | "PRODUCTION" | "LOGISTICS" | "BACKLOG",
    "targetSubStatus": "COMPLETED_INSTALLED"
  } | null,

  // Wajib jika intent == "DELETE_TASK"
  "delete": {
    "targetQuery": "kata kunci judul task atau #ID",
    "taskId": "ID jika spesifik"
  } | null,

  // Opsional jika ada multi-intent chaining
  "chainedAction": {
    "intent": "CREATE_TASK",
    "explanation": "Penjelasan task kedua",
    "task": { ... }
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
              text: `Tolong proses pesan/percakapan berikut:\n"${prompt.trim()}"`
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

      // Robust clean JSON extraction
      let cleanedText = rawText.trim();
      cleanedText = cleanedText.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim();

      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }

      parsedJson = JSON.parse(cleanedText);
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
  const intent: 'ANSWER_QUERY' | 'CREATE_TASK' | 'FILTER_BOARD' | 'UPDATE_TASK' | 'DELETE_TASK' =
    ['ANSWER_QUERY', 'FILTER_BOARD', 'UPDATE_TASK', 'DELETE_TASK'].includes(intentRaw)
      ? (intentRaw as 'ANSWER_QUERY' | 'FILTER_BOARD' | 'UPDATE_TASK' | 'DELETE_TASK')
      : 'CREATE_TASK';

  const explanation = typeof parsedJson.explanation === 'string' ? parsedJson.explanation.trim() : '';

  // Process potential chainedAction (e.g. update + create)
  let chainedAction: AICommandResult | null = null;
  if (parsedJson.chainedAction && typeof parsedJson.chainedAction === 'object') {
    const chObj = parsedJson.chainedAction as Record<string, unknown>;
    const chIntent = typeof chObj.intent === 'string' ? chObj.intent.toUpperCase() : 'CREATE_TASK';
    if (chIntent === 'CREATE_TASK') {
      const chTaskRaw = (chObj.task && typeof chObj.task === 'object') ? (chObj.task as Record<string, unknown>) : chObj;
      const built = buildTaskFormData(chTaskRaw, prompt, context, todayIso);
      chainedAction = {
        intent: 'CREATE_TASK',
        explanation: typeof chObj.explanation === 'string' ? chObj.explanation : 'Membuat task baru lanjutan',
        task: built.task,
        newStore: built.newStore
      };
    }
  } else {
    // Regex fallback: check if user prompt contains chaining keywords ("lalu bikin task ...")
    const chainMatch = prompt.match(/(?:\blalu\b|\bkemudian\b|\bsetelah itu\b)\s+(?:bikin|buat|tambah)\s+task\s*(.*)$/i);
    if (chainMatch && (intent === 'UPDATE_TASK' || intent === 'DELETE_TASK')) {
      const subPrompt = chainMatch[1] || 'Task Baru';
      const built = buildTaskFormData({ title: subPrompt.toUpperCase() }, subPrompt, context, todayIso);
      chainedAction = {
        intent: 'CREATE_TASK',
        explanation: `Lanjutan: buat task "${built.task.title}"`,
        task: built.task,
        newStore: built.newStore
      };
    }
  }

  // 1. ANSWER_QUERY intent handling
  if (intent === 'ANSWER_QUERY') {
    const answerText = typeof parsedJson.answer === 'string' && parsedJson.answer.trim()
      ? parsedJson.answer.trim()
      : explanation || 'Informasi board berhasil diambil.';

    return {
      intent: 'ANSWER_QUERY',
      explanation: explanation || 'Menjawab pertanyaan board',
      answer: answerText
    };
  }

  // 2. FILTER_BOARD intent handling
  if (intent === 'FILTER_BOARD') {
    const filterObj = (parsedJson.filter && typeof parsedJson.filter === 'object')
      ? (parsedJson.filter as Record<string, unknown>)
      : {};

    let rawSearch = typeof filterObj.search === 'string' ? filterObj.search.trim() : '';
    let quickUrgent = Boolean(filterObj.quickUrgentOnly);
    const priorityFilter = typeof filterObj.priority === 'string' ? filterObj.priority : 'ALL';

    // Strict semantic guardrail: do not let adjectives like "overdue" / "telat" / "urgent" become text queries
    const searchLower = rawSearch.toLowerCase();
    if (searchLower === 'urgent' || searchLower === 'kritis' || searchLower === 'asap') {
      rawSearch = '';
      quickUrgent = true;
    } else if (searchLower === 'overdue' || searchLower === 'telat' || searchLower === 'terlambat') {
      rawSearch = '';
    } else if (searchLower === 'selesai' || searchLower === 'completed') {
      rawSearch = '';
    }

    return {
      intent: 'FILTER_BOARD',
      explanation: explanation || 'Filter board diterapkan',
      filter: {
        search: rawSearch,
        priority: priorityFilter,
        picHq: typeof filterObj.picHq === 'string' ? filterObj.picHq : 'ALL',
        am: typeof filterObj.am === 'string' ? filterObj.am : 'ALL',
        store: typeof filterObj.store === 'string' ? filterObj.store : 'ALL',
        category: typeof filterObj.category === 'string' ? filterObj.category : 'ALL',
        quickUrgentOnly: quickUrgent
      }
    };
  }

  // 3. DELETE_TASK intent handling
  if (intent === 'DELETE_TASK') {
    const deleteObj = (parsedJson.delete && typeof parsedJson.delete === 'object')
      ? (parsedJson.delete as Record<string, unknown>)
      : {};

    const targetQuery = typeof deleteObj.targetQuery === 'string' && deleteObj.targetQuery.trim()
      ? deleteObj.targetQuery.trim()
      : prompt.replace(/^(?:hapus|buang|delete|hilangkan)\s+(?:task\s+)?/i, '').trim();

    const taskId = typeof deleteObj.taskId === 'string' ? deleteObj.taskId.trim() : undefined;

    return {
      intent: 'DELETE_TASK',
      explanation: explanation || `Menghapus task "${targetQuery}"`,
      delete: {
        targetQuery,
        taskId
      },
      chainedAction
    };
  }

  // 4. UPDATE_TASK intent handling
  if (intent === 'UPDATE_TASK') {
    const updateObj = (parsedJson.update && typeof parsedJson.update === 'object')
      ? (parsedJson.update as Record<string, unknown>)
      : {};

    let targetQuery = typeof updateObj.targetQuery === 'string' ? updateObj.targetQuery.trim() : prompt.trim();
    // Clean query if chained ("tandai selesai task X lalu ...")
    targetQuery = targetQuery.replace(/(?:\blalu\b|\bkemudian\b|\bsetelah itu\b).*$/i, '').trim();

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
      },
      chainedAction
    };
  }

  // 5. CREATE_TASK intent handling (default)
  const taskObj = (parsedJson.task && typeof parsedJson.task === 'object')
    ? (parsedJson.task as Record<string, unknown>)
    : parsedJson;

  const built = buildTaskFormData(taskObj, prompt, context, todayIso);

  return {
    intent: 'CREATE_TASK',
    explanation: explanation || 'Task baru berhasil dipersiapkan',
    task: built.task,
    newStore: built.newStore,
    chainedAction
  };
}
