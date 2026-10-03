const { PDFDocument, rgb } = globalThis.PDFLib;
const fontkit = globalThis.fontkit;
import { derived, glueDays, summary } from './report-model.js';
export async function createReportPdf(data, regularBytes, boldBytes) {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const regular = await doc.embedFont(regularBytes, { subset: true }), bold = await doc.embedFont(boldBytes, { subset: true });
    const W = 595.28, H = 841.89, margin = 42, width = W - 2 * margin;
    const navy = rgb(.06, .18, .30), muted = rgb(.36, .43, .51), green = rgb(.07, .41, .33);
    let page, y = 0;
    const pages = [];
    const safe = (s) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
    function newPage() { page = doc.addPage([W, H]); pages.push(page); page.drawRectangle({ x: 0, y: H - 93, width: W, height: 93, color: navy }); page.drawText('STARISH AUTOPAC PVT. LTD.', { x: margin, y: H - 34, size: 16, font: bold, color: rgb(1, 1, 1) }); page.drawText(safe(data.type), { x: margin, y: H - 58, size: 13, font: regular, color: rgb(.75, .91, .86) }); page.drawText(`${data.from} to ${data.to}  |  ${data.approved ? 'Approved records only' : 'All records - approval status shown'}`, { x: margin, y: H - 78, size: 10, font: regular, color: rgb(.85, .90, .95) }); y = H - 119; }
    function ensure(h) { if (y - h < 54)
        newPage(); }
    function wrap(text, max, font = regular, size = 10.5) { const tokens = safe(text).split(' '); const result = []; let line = ''; for (const token of tokens) {
        let word = token;
        if (font.widthOfTextAtSize(word, size) > max) {
            if (line) {
                result.push(line);
                line = '';
            }
            let fragment = '';
            for (const c of word) {
                if (font.widthOfTextAtSize(fragment + c, size) > max && fragment) {
                    result.push(fragment);
                    fragment = c;
                }
                else
                    fragment += c;
            }
            line = fragment;
            continue;
        }
        const next = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(next, size) > max && line) {
            result.push(line);
            line = word;
        }
        else
            line = next;
    } if (line)
        result.push(line); return result.length ? result : ['-']; }
    function line(text, font = regular, size = 10.5, color = navy) { for (const s of wrap(text, width, font, size)) {
        ensure(16);
        page.drawText(s, { x: margin, y, size, font, color });
        y -= 16;
    } }
    function heading(text) { ensure(32); y -= 8; line(text, bold, 12, green); y -= 4; }
    newPage();
    line(`Generated: ${new Date(data.generated).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`, regular, 9, muted);
    line(`Shift: ${data.shift}${data.machine ? ' | Machine / Meter / Material: ' + data.machine : ''}`, regular, 10, muted);
    heading('PERIOD SUMMARY');
    for (const metric of summary(data.type, data.reports, data.batchChangeover))
        line(`${metric.label}: ${metric.value}`, bold, 11);
    line('Summary and details use the same selected saved records.', regular, 9, muted);
    if (data.type === 'Glue Consumption') {
        heading('DAY-WISE GLUE CONSUMPTION');
        for (const g of glueDays(data.reports, data.batchChangeover)) {
            ensure(74);
            line(`${g.date} | Starch: ${g.starch.toFixed(2)} kg | Batches: ${g.batches === null ? 'Pending' : g.batches.toFixed(2)}`, bold, 11);
            line(`Boardline: ${g.tonnes.toFixed(3)} tonnes | Glue: ${g.consumption === null ? 'Unavailable' : g.consumption.toFixed(2) + ' kg/ton'}`);
            line(g.missingShifts.length ? 'Missing shifts: ' + g.missingShifts.join(', ') : 'Day and Night production received', regular, 9, muted);
            y -= 8;
        }
        line(`Batch rule: before ${data.batchChangeover}: 200 kg; from ${data.batchChangeover}: 150 kg. Entry-specific batch sizes take precedence.`, regular, 9, muted);
    }
    heading('SAVED REPORT DETAILS');
    let index = 0;
    for (const r of [...data.reports].sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift))) {
        index++;
        ensure(60);
        page.drawLine({ start: { x: margin, y: y + 3 }, end: { x: W - margin, y: y + 3 }, thickness: .5, color: rgb(.82, .86, .9) });
        y -= 12;
        line(`${index}. ${r.date} | ${r.shift} | ${r.status || 'Not reviewed'}`, bold, 11);
        if (data.type === 'Glue Consumption')
            line(r.type, bold, 10);
        for (const [key, value] of Object.entries({ ...r.fields, ...derived(r) })) {
            if (value !== '' && value !== undefined)
                line(`${key}: ${value}`);
        }
        line(`Record ID: ${r.id}`, regular, 8, muted);
        if (r.source)
            line(`Source: ${r.source}`, regular, 8, muted);
        if (r.approvedAt)
            line(`Approved: ${r.approvedBy} | ${r.approvedAt}`, regular, 8, muted);
        if (data.history) {
            for (const event of data.activity.filter((e) => e.reportId === r.id)) {
                line(`${event.action.toUpperCase()} | ${event.by} | ${event.at}`, bold, 9);
                if (event.reason)
                    line(`Reason: ${event.reason}`, regular, 9);
                if (event.before && event.after) {
                    for (const [key, value] of Object.entries(event.after)) {
                        if (event.before[key] !== value)
                            line(`${key}: ${event.before[key] || '-'} -> ${value || '-'}`, regular, 9);
                    }
                }
            }
        }
        y -= 14;
    }
    pages.forEach((p, i) => { p.drawLine({ start: { x: margin, y: 42 }, end: { x: W - margin, y: 42 }, thickness: .5, color: rgb(.82, .86, .9) }); p.drawText(`Starish | ${data.from} to ${data.to}`, { x: margin, y: 27, size: 8, font: regular, color: muted }); const text = `Page ${i + 1} of ${pages.length}`; p.drawText(text, { x: W - margin - regular.widthOfTextAtSize(text, 8), y: 27, size: 8, font: regular, color: muted }); });
    doc.setTitle(`${data.type} ${data.from} to ${data.to}`);
    doc.setAuthor('Starish Autopac Pvt. Ltd.');
    return doc.save();
}
