import {derived,glueDays,hours,fieldNames} from './report-model.js';
const numeric=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const fmt=(v,d=2)=>v===null?'Unavailable':Number(v).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
// Exclude only an incomplete zero-meter shadow with matching shift, source, weight and times.
function reportInputs(type,entries){
 const input=entries.filter(r=>r.type===type);if(type!=='Boardline Production')return input;
 const empty=v=>v===undefined||v===null||String(v).trim()==='';
 const zero=v=>empty(v)||numeric(v)===0;
 return input.filter(r=>!input.some(other=>{
 if(other===r||!zero(r.fields['Metres'])||!(numeric(other.fields['Metres'])>0)||!zero(r.fields['Breakdown Minutes']))return false;
 const source=r.sourceId||r.source;if(!source||source!==(other.sourceId||other.source)||r.date!==other.date||r.shift!==other.shift)return false;
 if(!['Tonnage (kg)','Start Time','End Time'].every(k=>!empty(r.fields[k])&&String(r.fields[k])===String(other.fields[k])))return false;
 if(!(numeric(r.fields['Tonnage (kg)'])>0))return false;
 // Retain any row with conflicting job identifiers, remarks or other supplied data.
 return Object.entries(r.fields).every(([k,v])=>['Metres','Breakdown Minutes'].includes(k)||empty(v)||String(v)===String(other.fields[k]??''));
 }));
}
function overlappingBoardline(records){
 const groups=new Map();for(const r of records){const key=r.date+'|'+r.shift;const span=hours(r.fields['Start Time'],r.fields['End Time']);if(span===null)continue;const parts=String(r.fields['Start Time']).split(':').map(Number),start=parts[0]*60+parts[1]+(parts[2]||0)/60;const interval=[start,start+span*60];if(!groups.has(key))groups.set(key,[]);groups.get(key).push(interval);}
 for(const intervals of groups.values()){intervals.sort((a,b)=>a[0]-b[0]);let end=-Infinity;for(const [a,b] of intervals){if(a<end)return true;end=Math.max(end,b);}}return false;
}
const duration=v=>{if(v===null)return 'Unavailable';const minutes=Math.round(v);return Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0');};
export function buildReportTable(type,entries,options={}){
 const input=reportInputs(type,entries),rows=[];let columns=[],totals=null;
 if(type==='Glue Consumption'){
 columns=['Date','Starch (kg)','Batches','Boardline tonnes','Glue (kg/ton)','Data checks'];
 for(const g of glueDays(entries,options.changeover))rows.push({id:'',values:{Date:g.date,'Starch (kg)':fmt(g.starch),'Batches':fmt(g.batches),'Boardline tonnes':fmt(g.tonnes,3),'Glue (kg/ton)':fmt(g.consumption),'Data checks':g.missingShifts.length?'Missing '+g.missingShifts.join(', '):'Both shifts available'}});
 }else if(type.includes('Production')){
 const board=type==='Boardline Production';columns=['Date','Machine','Shift',...(board?['Tonnage (kg)','Meter']:['Number of Jobs','Actual Quantity']),'Speed/Min','Breakdown','Running Hrs',...(board?['Eff %']:[])];
 const groups=new Map();for(const r of input){const machine=board?'BOARDLINE':r.fields['Machine / Process']||type,date=options.mode==='cumulative'?'Selected period':r.date,key=JSON.stringify([date,machine,r.shift]);if(!groups.has(key))groups.set(key,{date,machine,shift:r.shift,records:[]});groups.get(key).records.push(r);}
 function productionLine(records,date,machine,shift){const sum=k=>{const ns=records.map(r=>numeric(r.fields[k]));return ns.every(v=>v!==null)?ns.reduce((a,b)=>a+b,0):null;};const elapsed=records.map(r=>hours(r.fields['Start Time'],r.fields['End Time'])),breakdowns=records.map(r=>numeric(r.fields['Breakdown Minutes']));const bd=breakdowns.every(v=>v!==null)?breakdowns.reduce((a,b)=>a+b,0):null,run=elapsed.every(v=>v!==null)&&bd!==null?elapsed.reduce((a,b)=>a+b,0)-bd/60:null,qty=sum(board?'Metres':'Actual Quantity');const values={Date:date,Machine:machine,Shift:shift,'Speed/Min':run>0&&qty!==null?fmt(qty/(run*60),1):'Unavailable',Breakdown:duration(bd),'Running Hrs':run!==null&&run>=0?fmt(run):'Unavailable',};if(board){values['Tonnage (kg)']=fmt(sum('Tonnage (kg)'),0);values.Meter=fmt(qty,0);values['Eff %']=run>0&&qty!==null?fmt(qty/(run*4000)*100,1):'Unavailable';}else{values['Number of Jobs']=fmt(sum('Number of Jobs'),0);values['Actual Quantity']=fmt(qty,0);}if(board&&overlappingBoardline(records)){values['Running Hrs']='Verify overlapping records';values['Speed/Min']='Unavailable';values['Eff %']='Unavailable';}return {id:records.length===1?records[0].id:'',recordIds:records.map(r=>r.id),values};}
 for(const group of groups.values())rows.push(productionLine(group.records,group.date,group.machine,group.shift));if(input.length){totals=productionLine(input,'TOTAL','TOTAL','').values;}
 }else{
 const fields=new Set(type==='Diesel Consumption'?['Opening Litres','Received Litres','Issued Litres','Receiver Name','Used For']:fieldNames(type));for(const r of input)for(const k of Object.keys({...r.fields,...derived(r)}))fields.add(k);if(type==='Water Meter')fields.add('Area Consumption (litres)');columns=['Date','Shift',...[...fields].filter(k=>!['Review','Review status','Pending approval'].includes(k)&&(type!=='Diesel Consumption'||!/(Cans|Barrels|Container Type|Container Quantity)$/.test(k)))];
 for(const r of input){const values={Date:r.date,Shift:r.shift,...r.fields,...derived(r)};if(type==='Water Meter'){const meter=String(r.fields['Meter Name']).toUpperCase(),down=meter==='BOARDLINE'?'PRINTING':meter==='GLUE'?'BOARDLINE':null;const raw=numeric(values['Consumption (litres)']);const downstream=down?input.filter(x=>x.date===r.date&&x.shift===r.shift&&String(x.fields['Meter Name']).toUpperCase()===down).map(x=>numeric(derived(x)['Consumption (litres)'])):[0];const subtraction=downstream.length&&downstream.every(v=>v!==null&&v>=0)?downstream.reduce((a,b)=>a+b,0):null;values['Area Consumption (litres)']=raw!==null&&subtraction!==null&&raw>=subtraction?fmt(raw-subtraction):'Unavailable - verify readings';}rows.push({id:r.id,values});}
 }
 rows.sort((a,b)=>String(a.values.Date).localeCompare(String(b.values.Date))||String(a.values.Machine||'').localeCompare(String(b.values.Machine||''))||String(a.values.Shift).localeCompare(String(b.values.Shift)));
 const selected=options.visibleColumns;const visible=Array.isArray(selected)&&selected.length?columns.filter(k=>selected.includes(k)):columns;
 return {columns:visible.length?visible:columns,allColumns:columns,rows,totals,caption:type==='Boardline Production'?'BOARDLINE MACHINE (Standard 4000 m/hr)':type};
}
