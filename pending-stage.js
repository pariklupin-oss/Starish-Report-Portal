// Stage-wise pending jobs (Corrugation / Printing / Folder Gluer / Auto Stitching / Manual).
// Data: Supabase pv3_report_data (same as Production-Data-Entry-System reports.html). Read-only.
// Pending at a stage = job open, this process not done, and every earlier process in the route is done.
export const STAGES = ['CORRUGATION', 'PRINTING', 'FOLDER GLUER', 'AUTO STITCHING', 'MANUAL'];
export const STAGE_LABEL = {'CORRUGATION': 'Corrugation', 'PRINTING': 'Printing', 'FOLDER GLUER': 'Folder Gluer', 'AUTO STITCHING': 'Auto Stitching', 'MANUAL': 'Manual'};

const num = v => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? 0 : n; };
export function parseDate(s) {
 s = String(s || '').trim(); let m;
 if ((m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
 if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
 if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; // AppSheet = MM/DD
 return '';
}
const st = r => String(r['ERP Status'] || '').trim().toLowerCase();
const isExt = r => /\[EXTEND of|\[SRC:/i.test(r.Remarks || '');
const hasQty = r => num(r['Production Qty']) > 0;
const isDone = r => ['submitted', 'partial', 'override', 'skipped'].includes(st(r)) || hasQty(r);
const effDate = r => parseDate(r['Production Date']) || parseDate(r.Date);
const days = (a, b) => a ? Math.max(0, Math.round((new Date(b) - new Date(a)) / 864e5)) : '';

export function stageOf(r) {
 const p = String(r['Process Name'] || '').toUpperCase(), m = String(r['Machine Name'] || '').toUpperCase(), x = p + ' ' + m;
 if (/STRAP|QUALITY|OQC|OUTWARD/.test(p)) return null;          // automatic stages
 if (/CORRUGAT|BOARD/.test(x)) return 'CORRUGATION';
 if (/MANUAL|SEMI/.test(m)) return 'MANUAL';
 if (/PRINT/.test(p) || /PRINTER|JF MACHINE|SMARTECH|NEW MACHINE/.test(m)) return 'PRINTING';
 if (/FOLD|GLU/.test(x)) return 'FOLDER GLUER';
 if (/AUTO STITCH/.test(x) || (/STITCH/.test(p) && /AUTO/.test(m))) return 'AUTO STITCHING';
 return 'MANUAL';
}

// data = pv3_report_data result ({jobs:[{id,closed,d}], holds:[{wo}]}); today = 'YYYY-MM-DD'
export function pendingByStage(data, today) {
 const rows = (data?.jobs || []).map(x => Object.assign({}, x.d, {_closed: x.closed}));
 const hold = new Set((data?.holds || []).map(h => h.wo));
 const wo = {};
 for (const r of rows) { const k = r['WO No'] || '?'; (wo[k] = wo[k] || []).push(r); }
 for (const k in wo) wo[k].sort((a, b) => num(a['Route Sequence']) - num(b['Route Sequence']));
 const ppAll = r => (wo[r['WO No']] || []).filter(x => x['PP Code'] === r['PP Code']);
 const ppQty = r => ppAll(r).reduce((s, x) => s + num(x['Production Qty']), 0);
 const ppLastDate = r => ppAll(r).reduce((d, x) => { const e = hasQty(x) || isDone(x) ? effDate(x) : ''; return e > d ? e : d; }, '');
 const out = [];
 for (const k in wo) {
  if (hold.has(k)) continue;
  const all = wo[k];
  if (!all.some(r => !r._closed) || !all.some(r => !isExt(r) && !isDone(r))) continue;   // job closed / complete
  const l = all.filter(r => !isExt(r));
  for (const r of l) {
   const stage = stageOf(r);
   if (!stage || r._closed || isDone(r)) continue;
   const prev = l.filter(x => num(x['Route Sequence']) < num(r['Route Sequence']));
   if (!prev.every(isDone)) continue;
   const lp = prev[prev.length - 1], pdt = lp ? ppLastDate(lp) : '';
   out.push({stage, planDate: parseDate(r.Date), wo: r['WO No'], jc: r['JC No'] || '', customer: r.Customer || '', item: r['Model Name'] || r['Item Code'] || '',
    pp: r['PP Code'] || '', process: r['Process Name'] || '', machine: r['Machine Name'] || '', planQty: num(r['Plan Qty']),
    prevProcess: lp ? lp['Process Name'] : '', prevDate: pdt, prevQty: lp ? ppQty(lp) : null,
    today: !!lp && pdt === today, days: days(pdt || parseDate(r.Date), today)});
  }
 }
 out.sort((a, b) => (b.today - a.today) || (num(b.days) - num(a.days)) || String(a.wo).localeCompare(String(b.wo)));
 return out;
}
