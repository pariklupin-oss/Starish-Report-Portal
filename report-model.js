import {reportInputs} from './report-inputs.js';
import { stageMetrics } from './stage-report.js';
export const REPORT_NAMES = ['Boardline Production', 'Printing Production', 'Folder Gluer Production', 'Auto Stitching Production', 'Manual Production', 'Water Meter', 'Maintenance Timesheet', 'Loading Timesheet', 'Daily Dispatch', 'DG Operation', 'Diesel Consumption', 'Boiler', 'Glue Consumption', 'Glue Kitchen Stock', 'Waste Bundle', 'Boiler Hourly Log', 'Boiler Water Tests', 'Stage Report', 'Employee Task'];
export const fieldNames = (n) => n === 'Boardline Production' ? ['Tonnage (kg)', 'Metres', 'Start Time', 'End Time', 'Breakdown Minutes', 'Breakdown Reason'] : n.includes('Production') ? ['Machine / Process', 'Number of Jobs', 'Actual Quantity', 'Colour Changes', 'Start Time', 'End Time', 'Breakdown Minutes', 'Breakdown Reason'] : n === 'Water Meter' ? ['Meter Name', 'Opening Reading', 'Closing Reading', 'Reading Multiplier'] : n === 'Maintenance Timesheet' ? ['Employee Name', 'Machine', 'Work Description', 'Start Time', 'End Time', 'Status', 'Reason'] : n === 'Loading Timesheet' ? ['Employee Name', 'Vehicle Number', 'Job Card', 'Quantity', 'Start Time', 'End Time'] : n === 'Daily Dispatch' ? ['Vehicle Number', 'Customer', 'Invoice Number', 'Products', 'Quantity', 'Amount (Rs)', 'Weighbridge Net Kg'] : n === 'DG Operation' ? ['Duration (HH:MM)', 'Diesel Consumption (litres)'] : n === 'Diesel Consumption' ? ['Opening Cans', 'Opening Barrels', 'Received Cans', 'Received Barrels', 'Issued Cans', 'Issued Barrels', 'Receiver Name', 'Used For'] : n === 'Waste Bundle' ? ['Opening Bundles', 'In Bundles', 'Out Bundles'] : n === 'Glue Kitchen Stock' ? ['Material Name', 'Stock Unit', 'Opening Stock', 'Received Quantity', 'Issued Quantity', 'Starch per Bag (kg)', 'Starch per Batch (kg)'] : n === 'Boiler Hourly Log' ? ['Operator', 'Log Time', 'Steam Pressure (bar)', 'Feed Water Temperature (C)', 'Flue Gas T1 (C)', 'Flue Gas T2 (C)', 'Water Meter Reading', 'Fuel Meter Reading', 'Steam Meter Reading', 'Water Meter Unit', 'Fuel Meter Unit', 'Steam Meter Unit'] : n === 'Boiler Water Tests' ? ['Operator', 'Test Time', 'Water Sample', 'TDS (ppm)', 'pH'] : ['Operator', 'Time Slot', 'Water Consumption (litres)', 'Fuel Consumption (kg)', 'Steam Consumption (kg)'];
export function inputType(k) { return /^(Start Time|End Time|Log Time)$/.test(k) ? 'time' : k === 'Duration (HH:MM)' ? 'text' : /TDS|^pH$|Cans|Barrels|Quantity|Minutes|Reading|Litres|Litres|litres|Bundles|Stock$|Issued Quantity|Received Quantity|Tonnage|Metres|Number of Jobs|Colour Changes|Amount|Kg|\(kg\)|\(m3\)|\(tonnes\)|\(bar\)|\(C\)/.test(k) ? 'number' : 'text'; }
export function number(f, k) { const raw = f[k]; return raw === undefined || raw.trim() === '' ? null : Number.isFinite(Number(raw)) ? Number(raw) : null; }
export function hours(start, end) { if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(start || '') || end !== undefined && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(end || ''))
    return null; const val = (v) => { const a = v.split(':').map(Number); return a[0] + a[1] / 60 + (a[2] || 0) / 3600; }; if (end === undefined)
    return val(start); const a = val(start), b = val(end); return b >= a ? b - a : b - a + 24; }
export function derived(r) {
    const f = r.fields, n = (k) => number(f, k), out = {};
    const fmt = (v) => Number.isFinite(v) ? v.toFixed(2) : 'Unavailable';
    if (r.type === 'Diesel Consumption' || r.type === 'Waste Bundle' || r.type === 'Glue Kitchen Stock') {
        const keys = r.type === 'Diesel Consumption' ? ['Opening Litres', 'Received Litres', 'Issued Litres'] : r.type === 'Waste Bundle' ? ['Opening Bundles', 'In Bundles', 'Out Bundles'] : ['Opening Stock', 'Received Quantity', 'Issued Quantity'];
        const a = keys.map(n);
        out[r.type === 'Waste Bundle' ? 'Closing Bundles' : r.type === 'Diesel Consumption' ? 'Closing Litres' : 'Closing Stock'] = a.some(v => v === null) ? 'Missing stock data' : fmt(a[0] + a[1] - a[2]);
    }
    if (r.type === 'DG Operation') {
        const h = hours(f['Duration (HH:MM)']);
        const fuel = n('Diesel Consumption (litres)');
        out['Duration (hours)'] = h === null ? 'Invalid duration' : fmt(h);
        out['Rate (litres/hour)'] = h && fuel !== null ? fmt(fuel / h) : 'Unavailable';
    }
    if (r.type === 'Water Meter') {
        const a = n('Opening Reading'), b = n('Closing Reading'), m = n('Reading Multiplier');
        out['Consumption (litres)'] = a !== null && b !== null && m !== null ? fmt((b - a) * m) : 'Missing readings or multiplier';
    }
    if (r.type.includes('Production') || r.type.includes('Timesheet')) {
        const h = hours(f['Start Time'], f['End Time']);
        const bd = n('Breakdown Minutes') ?? 0;
        const run = h === null ? null : h - bd / 60;
        out['Elapsed Hours'] = h === null ? 'Invalid / missing time' : fmt(h);
        if (r.type.includes('Production')) {
            out['Running Hours'] = run === null || run < 0 ? 'Unavailable' : fmt(run);
            const qty = n(r.type === 'Boardline Production' ? 'Metres' : 'Actual Quantity');
            out[r.type === 'Boardline Production' ? 'Speed (metres/hour)' : 'Speed (units/hour)'] = run && run > 0 && qty !== null ? fmt(qty / run) : 'Unavailable';
        }
    }
    if (r.type === 'Stage Report') {
        const raw = f['GAP-2 (hrs)'];
        if (raw !== undefined && raw !== null && String(raw).trim() !== '' && Number.isFinite(Number(raw))) out['GAP-2 (hrs)'] = Number(raw).toFixed(2);
    }
    return out;
}
export function glueDays(entries, changeover) { const dates = [...new Set(entries.filter(r => r.type === 'Glue Kitchen Stock' && /maize starch/i.test(r.fields['Material Name'] || '')).map(r => r.date))].sort().reverse(); return dates.map(date => { const stocks = entries.filter(r => r.date === date && r.type === 'Glue Kitchen Stock' && /maize starch/i.test(r.fields['Material Name'] || '')); const board = reportInputs('Boardline Production',entries).filter(r => r.date === date); const total = (rows, key) => rows.reduce((a, r) => a + (number(r.fields, key) || 0), 0); let starch = 0, batches = 0, batchKnown = true, starchKnown = true; for (const r of stocks) {
    const issued = number(r.fields, 'Issued Quantity');
    const bag = number(r.fields, 'Starch per Bag (kg)');
    const size = number(r.fields, 'Starch per Batch (kg)') ?? (changeover ? (date < changeover ? 200 : 150) : null);
    const unit = String(r.fields['Stock Unit'] || '').toLowerCase();
    const kg = issued === null ? null : unit === 'kg' ? issued : unit === 'bags' && bag !== null ? issued * bag : null;
    if (kg !== null)
        starch += kg;
    else
        starchKnown = false;
    if (kg === null || !size)
        batchKnown = false;
    else
        batches += kg / size;
} const kg = total(board, 'Tonnage (kg)'); const missingShifts = ['DAY', 'NIGHT'].filter(sh => !board.some(r => r.shift.toUpperCase() === sh)); const complete = missingShifts.length === 0 && board.every(r => number(r.fields, 'Tonnage (kg)') !== null); return { date, starch, batches: batchKnown ? batches : null, tonnes: kg / 1000, consumption: complete && starchKnown && kg > 0 ? starch / (kg / 1000) : null, missingShifts }; }); }
export const MATERIALS = ['Modified - Cold Pasting (PCM300-30)', 'Caustic Soda', 'Maize Starch', 'BORAX', 'CP/88/LV CHEMICAL', 'XLR8(50 KG S)', 'H2R (35 KGS CAN)'];
export const METERS = ['MAIN', 'PRINTING', 'BOARDLINE', 'GLUE', 'CANTEEN', 'LABOUR', 'BOILER'];
export const DEPARTMENTS = { Security: ['Water Meter', 'DG Operation', 'Diesel Consumption'], 'Glue Kitchen': ['Glue Kitchen Stock', 'Glue Consumption'], Boiler: ['Boiler', 'Boiler Hourly Log', 'Boiler Water Tests'], Maintenance: ['Maintenance Timesheet'], 'Loading & Dispatch': ['Loading Timesheet', 'Daily Dispatch', 'Waste Bundle'], Production: ['Boardline Production', 'Printing Production', 'Folder Gluer Production', 'Auto Stitching Production', 'Manual Production'] };
export function summary(type, entries, changeover = '2026-09-10') {
    const rows = reportInputs(type,entries);
    const sum = (key) => rows.reduce((a, r) => a + (number(r.fields, key) || 0), 0);
    const fmt = (n, d = 0) => n.toLocaleString('en-IN', { maximumFractionDigits: d });
    const out = [];
    const add = (label, value) => out.push({ label, value: String(value) });
    if (type === 'Glue Consumption') {
        const gs = glueDays(entries, changeover);
        const complete = gs.filter(g => g.consumption !== null);
        const kg = complete.reduce((a, g) => a + g.starch, 0), ton = complete.reduce((a, g) => a + g.tonnes, 0);
        add('Starch issued (kg)', fmt(gs.reduce((a, g) => a + g.starch, 0)));
        add('Batch equivalents', gs.some(g => g.batches === null) ? 'Pending batch size' : fmt(gs.reduce((a, g) => a + (g.batches || 0), 0), 2));
        add('Glue (kg/ton)', ton ? fmt(kg / ton, 2) : 'Unavailable');
        add('Matched production days', complete.length + ' / ' + gs.length);
        return out;
    }
    if (type === 'Stage Report')
        return stageMetrics(rows);
    if (!rows.length)
        return [{ label: 'Submission', value: 'Report pending' }];
    if (type === 'Boardline Production') {
        add('Production (tonnes)', fmt(sum('Tonnage (kg)') / 1000, 3));
        add('Output (metres)', fmt(sum('Metres')));
        add('Breakdown (hours)', fmt(sum('Breakdown Minutes') / 60, 2));
    }
    else if (type.includes('Production')) {
        add('Quantity', fmt(sum('Actual Quantity')));
        add('Jobs', fmt(sum('Number of Jobs')));
        add('Breakdown (hours)', fmt(sum('Breakdown Minutes') / 60, 2));
    }
    else if (type === 'Boiler') {
        add('Water (litres)', fmt(sum('Water Consumption (litres)')));
        add('Fuel (kg)', fmt(sum('Fuel Consumption (kg)')));
        add('Steam (kg)', fmt(sum('Steam Consumption (kg)')));
    }
    else if (type === 'DG Operation') {
        const hrs = rows.map(r => hours(r.fields['Duration (HH:MM)'])).map(h => h === null ? NaN : h);
        const h = hrs.filter(Number.isFinite).reduce((a, b) => a + b, 0), fuel = sum('Diesel Consumption (litres)');
        add('Running (hours)', fmt(h, 2));
        add('Diesel (litres)', fmt(fuel, 2));
        add('Rate (litres/hour)', h ? fmt(fuel / h, 2) : 'Unavailable');
        if (hrs.some(v => !Number.isFinite(v)))
            add('Invalid durations', hrs.filter(v => !Number.isFinite(v)).length);
    }
    else if (type === 'Water Meter') {
        const days = [...new Set(rows.map(r => r.date))];
        const meters = [...new Set(rows.map(r => (r.fields['Meter Name'] || '').toUpperCase()))];
        for (const meter of meters) {
            let value = 0, missing = 0;
            for (const day of days) {
                const raw = (m) => { const rr = rows.filter(r => r.date === day && (r.fields['Meter Name'] || '').toUpperCase() === m); if (!rr.length)
                    return null; const vals = rr.map(r => Number(derived(r)['Consumption (litres)'])); return vals.every(v => Number.isFinite(v) && v >= 0) ? vals.reduce((a, b) => a + b, 0) : null; };
                const current = raw(meter), downstream = meter === 'BOARDLINE' ? raw('PRINTING') : meter === 'GLUE' ? raw('BOARDLINE') : 0;
                const area = current === null || downstream === null || current < downstream ? null : current - downstream;
                if (area === null)
                    missing++;
                else
                    value += area;
            }
            add(meter + ' area (litres)', missing ? fmt(value) + '; ' + missing + ' days unavailable' : fmt(value));
            const validDays = days.length - missing;
            add(meter + ' average (litres/day)', validDays ? fmt(value / validDays, 2) + ' (' + validDays + ' valid days)' : 'Unavailable');
        }
    }
    else if (type.includes('Timesheet')) {
        const hs = rows.map(r => Number(derived(r)['Elapsed Hours']));
        add('Recorded hours', fmt(hs.filter(Number.isFinite).reduce((a, b) => a + b, 0), 2));
        add('Jobs / entries', rows.length);
        if (hs.some(v => !Number.isFinite(v)))
            add('Invalid times', hs.filter(v => !Number.isFinite(v)).length);
    }
    else if (type === 'Diesel Consumption') {
        add('Received (litres)', fmt(sum('Received Litres'), 2));
        add('Issued (litres)', fmt(sum('Issued Litres'), 2));
        const last = [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))[0];
        add('Latest closing (litres)', derived(last)['Closing Litres']);
    }
    else if (type === 'Waste Bundle') {
        add('Bundles in', fmt(sum('In Bundles')));
        add('Bundles out', fmt(sum('Out Bundles')));
        const last = [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))[0];
        add('Latest closing', derived(last)['Closing Bundles']);
    }
    else if (type === 'Daily Dispatch') {
        add('Quantity', fmt(sum('Quantity')));
        add('Amount (Rs)', fmt(sum('Amount (Rs)'), 2));
        add('Vehicles', new Set(rows.map(r => r.fields['Vehicle Number'] || r.fields['Vehicle'])).size);
    }
    else if (type === 'Glue Kitchen Stock') {
        add('Material entries', rows.length);
        add('Materials', new Set(rows.map(r => r.fields['Material Name'])).size);
    }
    else {
        add('Saved records', rows.length);
        add('Recorded dates', new Set(rows.map(r => r.date)).size);
    }
    add('Awaiting review', rows.filter((r) => r.status !== 'Approved').length);
    return out;
}
