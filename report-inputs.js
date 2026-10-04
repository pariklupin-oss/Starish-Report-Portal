const numeric=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
// Exclude only an incomplete zero-meter shadow with matching shift, source, weight and times.
export function reportInputs(type,entries){
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
