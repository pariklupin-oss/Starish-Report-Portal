import {METRICS} from './boiler-summary.js';
import {buildReportTable} from './report-table.js';
import {glueDays} from './report-model.js';
const number=v=>{if(v===null||v===undefined||v===''||/Unavailable|Verify|missing/i.test(String(v)))return null;const s=String(v).replace(/,/g,'');if(/^\d+:\d{2}$/.test(s)){const [h,m]=s.split(':').map(Number);return h+m/60;}return Number.isFinite(Number(s))?Number(s):null;};
const rates=/speed|eff|average|rate|pressure|temperature|pH|GAP-/i;
const balances=/opening|closing|stock amount/i;
export function analysisMetrics(type,entries,changeover){
 if(type==='Boiler')return METRICS.filter(m=>m[3]!=='text').map(m=>m[0]).concat('Records');
 if(type==='Glue Consumption')return ['Glue (kg/ton)','Starch (kg)','Batches','Boardline tonnes','Valid days'];
 const table=buildReportTable(type,entries,{mode:'daily',changeover});
 const cols=table.allColumns.filter(k=>!['Date','Machine','Shift','Employee Name','Vehicle Number','Customer','Job Card','Invoice Number','Item Code','Meter Name','Material Name','Operator','Log Time','Start Time','End Time','Remarks','Breakdown Reason','Data checks','Opening Reading','Closing Reading','Reading Multiplier','Starch per Bag (kg)','Starch per Batch (kg)'].includes(k)&&table.rows.some(r=>number(r.values[k])!==null));
 return [...new Set([...(type==='Water Meter'&&cols.includes('Area Consumption (litres)')?['Area Consumption (litres)']:[]),...cols,'Records'])];
}
export function monthlyAnalysis(type,entries,{from,to,metric,changeover,categoryField='',category=''}={}){
 const months=[];for(let d=new Date(from.slice(0,7)+'-01T00:00:00Z');d.toISOString().slice(0,7)<=to.slice(0,7);d.setUTCMonth(d.getUTCMonth()+1)){months.push(d.toISOString().slice(0,7));if(months.length>240)break;}
 return months.map(month=>{
 const group=entries.filter(r=>r.date?.startsWith(month));let value=null,count=0,validDays=0;
 if(type==='Boiler'){const daily=group.filter(r=>r.type==='Boiler'&&r.fields?.['Summary Format']==='daily-v1'&&!r.portalDeleted);count=daily.length;validDays=new Set(daily.map(r=>r.date)).size;if(metric==='Records')value=count||null;else{const model=buildReportTable('Boiler',daily,{mode:'cumulative'});value=number(model.rows.find(r=>r.values.Parameter===metric)?.values.Actual);}}else if(type==='Glue Consumption'){
 const days=glueDays(group,changeover),valid=days.filter(g=>g.consumption!==null);count=days.length;validDays=valid.length;
 if(metric==='Glue (kg/ton)'){const ton=valid.reduce((a,g)=>a+g.tonnes,0);value=ton>0?valid.reduce((a,g)=>a+g.starch,0)/ton:null;}
 else if(metric==='Valid days')value=valid.length;
 else if(metric==='Starch (kg)')value=days.length?days.reduce((a,g)=>a+g.starch,0):null;
 else if(metric==='Batches')value=days.length&&days.every(g=>g.batches!==null)?days.reduce((a,g)=>a+g.batches,0):null;
 else if(metric==='Boardline tonnes')value=valid.length?valid.reduce((a,g)=>a+g.tonnes,0):null;
 }else{
 const selected=category&&categoryField&&type!=='Water Meter'?group.filter(r=>String(r.fields[categoryField]||'')===category):group;
 const table=buildReportTable(type,selected,{mode:'daily',changeover});const rows=category&&type==='Water Meter'?table.rows.filter(r=>String(r.values[categoryField]||'')===category):table.rows;
 count=rows.length;validDays=new Set(rows.map(r=>r.values.Date)).size;
 if(metric==='Records')value=count||null;
 else if(table.totals&&metric in table.totals)value=number(table.totals[metric]);
 else{const values=rows.map(r=>number(r.values[metric])),valid=values.filter(v=>v!==null);if(valid.length&&valid.length===values.length){value=balances.test(metric)?valid[valid.length-1]:rates.test(metric)?valid.reduce((a,b)=>a+b,0)/valid.length:valid.reduce((a,b)=>a+b,0);}}
 }
 const monthStart=month+'-01',monthEnd=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10);
 return {month,value,records:count,validDays,partial:from>monthStart||to<monthEnd};
 });
}
export function dateAnalysis(type,entries,{from,to,metric,changeover,categoryField='',category=''}={}){
 if(!from||!to||from>to)return [];
 const grouped=new Map();
 for(const record of entries){const date=record.date;if(!date||date<from||date>to)continue;if(!grouped.has(date))grouped.set(date,[]);grouped.get(date).push(record);}
 const dates=[];for(let d=new Date(from+'T00:00:00Z'),end=new Date(to+'T00:00:00Z');d<=end;d.setUTCDate(d.getUTCDate()+1))dates.push(d.toISOString().slice(0,10));
 return dates.map(date=>{
  const group=grouped.get(date)||[];let value=null,count=0,validDays=0;
  if(type==='Boiler'){
   const daily=group.filter(r=>r.type==='Boiler'&&r.fields?.['Summary Format']==='daily-v1'&&!r.portalDeleted);count=daily.length;validDays=new Set(daily.map(r=>r.date)).size;
   if(metric==='Records')value=count||null;else{const model=buildReportTable('Boiler',daily,{mode:'cumulative'});value=number(model.rows.find(r=>r.values.Parameter===metric)?.values.Actual);}
  }else if(type==='Glue Consumption'){
   const days=glueDays(group,changeover),valid=days.filter(g=>g.consumption!==null);count=days.length;validDays=valid.length;
   if(metric==='Glue (kg/ton)')value=valid.length?valid.reduce((a,g)=>a+g.starch,0)/valid.reduce((a,g)=>a+g.tonnes,0):null;
   else if(metric==='Valid days')value=valid.length;
   else if(metric==='Starch (kg)')value=days.length?days.reduce((a,g)=>a+g.starch,0):null;
   else if(metric==='Batches')value=days.length&&days.every(g=>g.batches!==null)?days.reduce((a,g)=>a+g.batches,0):null;
   else if(metric==='Boardline tonnes')value=valid.length?valid.reduce((a,g)=>a+g.tonnes,0):null;
  }else{
   const selected=category&&categoryField&&type!=='Water Meter'?group.filter(r=>String(r.fields?.[categoryField]||'')===category):group;
   const table=buildReportTable(type,selected,{mode:'daily',changeover});const rows=category&&type==='Water Meter'?table.rows.filter(r=>String(r.values[categoryField]||'')===category):table.rows;
   count=rows.length;validDays=new Set(rows.map(r=>r.values.Date).filter(Boolean)).size;
   if(metric==='Records')value=count||null;
   else if(table.totals&&metric in table.totals)value=number(table.totals[metric]);
   else{const values=rows.map(r=>number(r.values[metric])),valid=values.filter(v=>v!==null);if(valid.length&&valid.length===values.length)value=balances.test(metric)?valid[valid.length-1]:rates.test(metric)?valid.reduce((a,b)=>a+b,0)/valid.length:valid.reduce((a,b)=>a+b,0);}
  }
  return {date,value,records:count,validDays};
 });
}

export function metricMethod(type,metric,period='Month'){if(type==='Boiler'){const m=METRICS.find(m=>m[0]===metric);return m?.[3]==='avg'?'Average of available daily summary values':m?.[3]==='sum'?'Sum of available daily summary values':'Daily summary count';}return type==='Glue Consumption'&&metric==='Glue (kg/ton)'?'Total starch / total Boardline tonnes for matched complete days':/Speed\/Min|Eff %/.test(metric)?`Calculated from ${period==='Date'?'that date’s':'monthly'} total output and running hours`:balances.test(metric)?'Latest recorded balance':rates.test(metric)?'Average of valid records':'Sum of valid report values';}
