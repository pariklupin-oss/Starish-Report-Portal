export const METRICS=[["Steam pressure", "Steam Pressure (bar)", "8 to 9.5 bar", "avg"], ["Boiler Feed water temperature", "Feed Water Temperature (C)", ">=80 C", "avg"], ["Flue Gas Temperature-T1", "Flue Gas T1 (C)", "Preferably <275 C", "avg"], ["Flue Gas Temperature-T2", "Flue Gas T2 (C)", "Preferably <200 C", "avg"], ["Soft Water TDS", "Soft Water TDS (ppm)", "", "avg"], ["Soft Water Hardness", "Soft Water Hardness (ppm)", "", "avg"], ["Soft Water pH", "Soft Water pH", "", "avg"], ["Feed Water TDS", "Feed Water TDS (ppm)", "", "avg"], ["Feed Water Hardness", "Feed Water Hardness (ppm)", "", "avg"], ["Feed Water pH", "Feed Water pH", "", "avg"], ["Blowdown Water TDS", "Blowdown Water TDS (ppm)", "", "avg"], ["Blowdown Water Hardness", "Blowdown Water Hardness (ppm)", "", "avg"], ["Blowdown Water pH", "Blowdown Water pH", "", "avg"], ["Blowdown Time recorded", "Blowdown Time", "", "text"], ["Total Water Consumption", "Water Consumption (litres)", "", "sum"], ["Total Fuel Consumption", "Fuel Consumption (kg)", "", "sum"], ["Total Steam Consumption", "Steam Consumption (kg)", "", "sum"], ["Wood Received Qty", "Wood Received (kg)", "", "sum"]];
export const SHIFT_FIELDS=["Day Water (litres)", "Day Fuel (kg)", "Day Steam (kg)", "Night Water (litres)", "Night Fuel (kg)", "Night Steam (kg)"];

const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function parseSummarySheet(sheets,date){
 const name=Object.keys(sheets).find(n=>norm(n)==='boilerreport');if(!name)throw Error('Boiler Report tab missing');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Select actual report date');
 const f={'Summary Format':'daily-v1','Time Slot':'Daily',Operator:''};
 for(const [label,key,std,method] of METRICS){
 const row=sheets[name].find(r=>r&&norm(r[0])===norm(label));
 if(!row){if(key==='Water Consumption (litres)'){f[key]='';continue;}throw Error('Missing parameter: '+label);}
 f['Standard: '+key]=String(row[1]??std);f['Remark: '+key]=String(row[3]??'');
 const raw=String(row[2]??'').trim();
 if(method==='text'){f[key]=raw==='-'?'':raw;continue;}
 if(!raw||/not available|n\/a|^-$|not recorded/i.test(raw)){f[key]='';continue;}
 const match=raw.replace(/,/g,'').match(/^\s*(\d+(?:\.\d+)?)/);if(!match)throw Error('Invalid '+label+': '+raw);f[key]=match[1];
 if(key.includes('pH')&&Number(f[key])>14)throw Error('Invalid pH');
 if(key.includes('Consumption')){const kind=key.split(' ')[0],unit=kind==='Water'?'litres':'kg';for(const shift of ['Day','Night']){const m=String(row[3]??'').replace(/,/g,'').match(new RegExp(shift+':\\s*(\\d+(?:\\.\\d+)?)','i'));f[shift+' '+kind+' ('+unit+')']=m?m[1]:'';}}
 }
 return {type:'Boiler',date,shift:'Daily',fields:f};
}
export function summaryTable(entries,options={}){
 const records=entries.filter(r=>r.type==='Boiler'&&r.fields?.['Summary Format']==='daily-v1'&&!r.portalDeleted),groups=new Map();
 for(const r of records){const key=options.mode==='cumulative'?'Selected period':r.date;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const rows=[];for(const [date,rs] of groups)for(const [label,key,std,method] of METRICS){
 const ns=rs.map(r=>r.fields[key]).filter(v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);
 const actual=method==='text'?(rs.length===1?rs[0].fields[key]||'Not recorded':'See daily records'):!ns.length?'Unavailable':(method==='sum'?ns.reduce((a,b)=>a+b,0):ns.reduce((a,b)=>a+b,0)/ns.length).toLocaleString('en-IN',{maximumFractionDigits:3});
 const standards=[...new Set(rs.map(r=>r.fields['Standard: '+key]||std||'—'))];
 let remark=rs.length===1?rs[0].fields['Remark: '+key]||'':method==='avg'?'Average of available daily results ('+ns.length+'/'+rs.length+' days)':method==='sum'?'Sum of available results ('+ns.length+'/'+rs.length+' days)':'See daily records';
 if(rs.length===1&&key.includes('Consumption')){const kind=key.split(' ')[0],unit=kind==='Water'?'litres':'kg';remark+=' | Day: '+(rs[0].fields['Day '+kind+' ('+unit+')']||'Unavailable')+' | Night: '+(rs[0].fields['Night '+kind+' ('+unit+')']||'Unavailable');}
 rows.push({id:rs.length===1?rs[0].id:'',recordIds:rs.map(r=>r.id),values:{Date:date,Parameter:label,Standard:standards.length===1?standards[0]:'Varies by day',Actual:actual,Remarks:remark}});
 }
 const columns=['Date','Parameter','Standard','Actual','Remarks'];return {columns,allColumns:columns,rows,totals:null,caption:'DAILY BOILER SUMMARY'+(options.mode==='cumulative'?' · CUMULATIVE':'')};
}
