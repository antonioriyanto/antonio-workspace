import { Task, Store } from '../types';

export function exportTasksCsv(tasks: Task[], stores: Store[]): string {
  const headers = ['ID', 'Tanggal', 'Task', 'Kategori', 'Prioritas', 'Deadline', 'PIC', 'Toko', 'Stage', 'SubStatus', 'Catatan'];
  const escape = (v: unknown) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

  const rows = tasks.map(t => {
    const storeNames = (t.storeIds || []).includes('ALL_STORES')
      ? 'Semua Toko (HQ)'
      : (t.storeIds || [])
          .map(id => {
            const s = stores.find(x => x.id === id);
            return s ? s.name : id;
          })
          .join('; ');

    return [
      t.id,
      t.dateCreated,
      t.title,
      t.category,
      t.priority,
      t.deadline,
      t.picHq,
      storeNames,
      t.stageId,
      t.subStatus,
      t.notes || ''
    ];
  });

  return [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
}

export function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
