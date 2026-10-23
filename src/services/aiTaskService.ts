import { PIC, Store, TaskFormData, Priority, StageId } from '../types';
import { WTC_CONFIG } from '../config';
import { getTodayIso, addWorkingDays } from '../utils/dateUtils';

export interface AIParsingContext {
  pics: PIC[];
  categories: string[];
  stores: Store[];
  todayIso: string;
}

/**
 * Parses natural conversational prompt into structured TaskFormData using Google Gemini 1.5 Flash.
 */
export async function parseConversationalTask(
  prompt: string,
  context: AIParsingContext,
  customApiKey?: string
): Promise<TaskFormData> {
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
Anda adalah AI Intent Parser untuk aplikasi Workspace Kanban 'Antonio Riyanto Workspace'.
Tugas Anda adalah membaca instruksi percakapan sehari-hari dalam Bahasa Indonesia atau Inggris, lalu mengonversinya menjadi objek JSON task yang valid.

INFORMASI WAKTU SAAT INI:
- Tanggal hari ini: ${todayIso} (${dayName})

DAFTAR PIC HQ / AM YANG TERSEDIA:
${picNames.join(', ')}

DAFTAR KATEGORI YANG TERSEDIA:
${categoriesList.join(', ')}

DAFTAR TOKO / CABANG:
- "ALL_STORES" (Semua Toko / HQ)
- Toko spesifik: ${storeListFormatted}

DAFTAR STAGE DAN SUB-STATUS YANG VALID:
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

ATURAN PERHITUNGAN DEADLINE DARI PERCAKAPAN:
- "hari ini" / "today" -> ${todayIso}
- "besok" / "tomorrow" -> tanggal hari ini + 1 hari
- "lusa" -> tanggal hari ini + 2 hari
- "minggu depan" / "senin depan" -> hari Senin terdekat berikutnya
- Jika ada tanggal spesifik (misal "28 okt", "15 november"), hitung tahun saat ini (${todayDate.getFullYear()}) dan format ke YYYY-MM-DD.
- Jika tidak disebutkan tanggal deadline, default adalah 3 hari kerja ke depan.

ATURAN PRIORITAS:
- Jika mendesak ("urgent", "asap", "kritis", "segera", "penting banget") -> "CRITICAL" atau "HIGH"
- Jika normal -> "MEDIUM"
- Jika santai / minor -> "LOW"

ATURAN FORMAT OUTPUT:
Keluarkan HANYA JSON murni (tanpa teks penjelasan lain) dengan struktur:
{
  "title": "Judul singkat dan jelas dalam huruf kapital atau Title Case (misal: 'KARTU UCAPAN NATAL')",
  "picHq": "Nama PIC yang cocok dari daftar PIC (misal: 'BU EVY')",
  "category": "Kategori yang paling cocok dari daftar kategori (misal: 'Print/POSM')",
  "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "dateCreated": "${todayIso}",
  "deadline": "YYYY-MM-DD",
  "picHq": "Nama PIC persis sesuai daftar",
  "storeIds": ["ALL_STORES"] atau ["S01", dll jika menyebut toko spesifik],
  "stageId": "BACKLOG" | "CREATIVE" | "PRODUCTION" | "LOGISTICS" | "COMPLETED",
  "subStatus": "ID subStatus yang cocok dengan stage di atas",
  "notes": "Catatan penting, detail kendala, atau arahan tambahan dari prompt"
}
`.trim();

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `Tolong parse percakapan berikut menjadi objek Task JSON:\n"${prompt.trim()}"`
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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`Gagal menghubungi Gemini API: ${message}`);
  }

  const result = await response.json();
  const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Gemini tidak memberikan respon teks yang valid.');
  }

  // Parse JSON from returned text
  let parsedJson: Record<string, unknown>;
  try {
    const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    parsedJson = JSON.parse(cleanedText);
  } catch (err) {
    console.error('Failed to parse Gemini output as JSON:', rawText);
    throw new Error('Respon Gemini tidak dapat diubah ke format JSON yang valid.');
  }

  // Normalize and validate parsed JSON
  const title = (typeof parsedJson.title === 'string' && parsedJson.title.trim())
    ? parsedJson.title.trim()
    : prompt.slice(0, 40).toUpperCase();

  // Match PIC
  let picHq = picNames[0] || 'BU EVY';
  if (typeof parsedJson.picHq === 'string') {
    const matchedPic = picNames.find(p => p.toLowerCase() === (parsedJson.picHq as string).toLowerCase());
    if (matchedPic) picHq = matchedPic;
  }

  // Match Category
  let category = categoriesList[0] || 'Poster';
  if (typeof parsedJson.category === 'string') {
    const matchedCat = categoriesList.find(c => c.toLowerCase() === (parsedJson.category as string).toLowerCase());
    if (matchedCat) category = matchedCat;
  }

  // Match Priority
  let priority: Priority = 'MEDIUM';
  if (typeof parsedJson.priority === 'string') {
    const pUpper = (parsedJson.priority as string).toUpperCase();
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(pUpper)) {
      priority = pUpper as Priority;
    }
  }

  // Match Deadline
  let deadline = addWorkingDays(todayIso, 3);
  if (typeof parsedJson.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsedJson.deadline)) {
    deadline = parsedJson.deadline;
  }

  // Match Stage & SubStatus
  let stageId: StageId = 'CREATIVE';
  if (typeof parsedJson.stageId === 'string' && WTC_CONFIG.STAGES.some(s => s.id === parsedJson.stageId)) {
    stageId = parsedJson.stageId as StageId;
  }

  let subStatus = WTC_CONFIG.SUB_STATUSES.find(s => s.stageId === stageId)?.id || 'IN_DESIGN';
  if (typeof parsedJson.subStatus === 'string') {
    const matchedSub = WTC_CONFIG.SUB_STATUSES.find(s => s.id === parsedJson.subStatus);
    if (matchedSub) {
      subStatus = matchedSub.id;
      stageId = matchedSub.stageId;
    }
  }

  // Match StoreIds
  let storeIds: string[] = ['ALL_STORES'];
  if (Array.isArray(parsedJson.storeIds) && parsedJson.storeIds.length > 0) {
    storeIds = parsedJson.storeIds.map(String);
  }

  const notes = typeof parsedJson.notes === 'string' ? parsedJson.notes.trim() : '';

  return {
    title,
    category,
    priority,
    dateCreated: todayIso,
    deadline,
    picHq,
    storeIds,
    stageId,
    subStatus,
    notes
  };
}
