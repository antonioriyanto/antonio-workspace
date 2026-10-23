import { PIC, Store, TaskFormData, Priority, StageId } from '../types';
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
 * Parses natural conversational prompt into structured TaskFormData using Google Gemini.
 * Features automatic model and API version fallback with clean JSON extraction.
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
Keluarkan HANYA JSON murni (tanpa markdown, tanpa teks pengantar atau penutup) dengan struktur:
{
  "title": "Judul singkat dan jelas dalam huruf kapital atau Title Case (misal: 'KARTU UCAPAN NATAL')",
  "picHq": "Nama PIC yang cocok dari daftar PIC (misal: 'BU EVY')",
  "category": "Kategori yang paling cocok dari daftar kategori (misal: 'Print/POSM')",
  "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "dateCreated": "${todayIso}",
  "deadline": "YYYY-MM-DD",
  "storeIds": ["ALL_STORES"] atau ["S01", dll jika menyebut toko spesifik],
  "stageId": "BACKLOG" | "CREATIVE" | "PRODUCTION" | "LOGISTICS" | "COMPLETED",
  "subStatus": "ID subStatus yang cocok dengan stage di atas",
  "notes": "Catatan penting, detail kendala, atau arahan tambahan dari prompt"
}
`.trim();

  const attemptErrors: string[] = [];
  let parsedJson: Record<string, unknown> | null = null;

  // Try candidate endpoints in fallback sequence
  for (const candidate of CANDIDATE_ENDPOINTS) {
    const endpointUrl = `https://generativelanguage.googleapis.com/${candidate.version}/models/${candidate.model}:generateContent?key=${apiKey}`;

    const requestBody = candidate.version === 'v1'
      ? {
          contents: [
            {
              parts: [
                {
                  text: `${systemInstructionText}\n\nTolong parse percakapan berikut menjadi objek Task JSON (output HANYA JSON murni tanpa pembungkus markdown):\n"${prompt.trim()}"`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1
          }
        }
      : {
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

        // Non-503 error (e.g. 404 model not found) or 503 failed after retry -> break to fallback
        break;
      } catch (err: unknown) {
        // Re-throw critical authentication / quota errors directly
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

  // Normalize and validate parsed JSON into TaskFormData
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
