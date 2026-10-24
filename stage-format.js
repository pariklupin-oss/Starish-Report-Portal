const BASE = Date.UTC(1899, 11, 30);
const MONTHS = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
const blank = v => v === undefined || v === null || String(v).trim() === '';
const pad = v => String(v).padStart(2,'0');

// Ignore historical GMT+0521 offsets when recovering spreadsheet civil durations.
function civilDate(value) {
 const text=String(value).trim();
 let m=text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d\d:?\d\d)?$/),parts;
 if(m)parts=[+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0)];
 if(!parts){m=text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);if(m)parts=[+m[3],+m[2]-1,+m[1],+m[4],+m[5],+(m[6]||0)];}
 if(!parts){m=text.match(/^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat) ([A-Z][a-z]{2}) (\d{1,2}) (-?\d{4}) (\d{1,2}):(\d{2}):(\d{2}) GMT[+-]\d{4}(?:\s+\(.*\))?$/);if(m&&MONTHS[m[1]]!==undefined)parts=[+m[3],MONTHS[m[1]],+m[2],+m[4],+m[5],+m[6]];}
 if(!parts)return null;
 const [y,mo,d,h,mi,s]=parts,stamp=Date.UTC(y,mo,d,h,mi,s),check=new Date(stamp);
 if(check.getUTCFullYear()!==y||check.getUTCMonth()!==mo||check.getUTCDate()!==d||h>23||mi>59||s>59)return null;
 return {parts,stamp};
}
export function stageGapSeconds(value,hoursValue) {
 if(!blank(hoursValue)&&Number.isFinite(Number(hoursValue)))return Math.round(Number(hoursValue)*3600);
 if(blank(value))return null;
 const text=String(value).trim();
 if(/^[+-]?\d+(?:\.\d+)?$/.test(text))return Math.round(Number(text)*86400);
 const m=text.match(/^([+-]?)(\d+):(\d{2})(?::(\d{2}))?$/);
 if(m&&+m[3]<60&&+(m[4]||0)<60)return (m[1]==='-'?-1:1)*(+m[2]*3600 + +m[3]*60 + +(m[4]||0));
 const d=civilDate(text);
 return d&&d.parts[0]>=1898&&d.parts[0]<=1901?Math.round((d.stamp-BASE)/1000):null;
}
export function formatStageDuration(seconds) {
 if(seconds===null||!Number.isFinite(seconds))return '';
 const total=Math.abs(Math.round(seconds));
 return (seconds<0?'-':'')+Math.floor(total/3600)+':'+pad(Math.floor(total/60)%60)+':'+pad(total%60);
}
export function formatStageTimestamp(value) {
 if(blank(value))return '';
 let date=civilDate(value);
 if(/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:?\d\d)$/.test(String(value)) && date && date.parts[0]>=1902){
  const instant=new Date(value);
  if(Number.isFinite(instant.getTime())){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant).map(p=>[p.type,p.value]));date={parts:[+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second]};}
 }
 if(!date&&/^[+-]?\d+(?:\.\d+)?$/.test(String(value).trim())&&Number(value)>=1){const d=new Date(BASE+Math.round(Number(value)*86400)*1000);date={parts:[d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()]};}
 if(!date)return String(value).trim(); // Never invent a missing date from a time-only source.
 const [y,mo,d,h,mi,s]=date.parts;
 return y<1902?pad(h)+':'+pad(mi)+':'+pad(s):pad(d)+'-'+pad(mo+1)+'-'+y+' '+pad(h)+':'+pad(mi)+':'+pad(s);
}
export function stageDisplayFields(fields={}) {
 const out={};
 for(const key of ['OQC End','Loading End','Invoice Time','Gate Out Time'])if(key in fields)out[key]=formatStageTimestamp(fields[key]);
 for(const [n,label] of [[1,'Production and Loading'],[2,'Loading and Billing'],[3,'Billing and Gate Out']]){
  const key='GAP-'+n+' ('+label+')',hoursKey='GAP-'+n+' (hrs)';
  if(!(key in fields)&&!(hoursKey in fields))continue;
  // Preserve exact seconds. Decimal hours may already be rounded to two places.
  const exact=stageGapSeconds(fields[key]),seconds=exact===null?stageGapSeconds(null,fields[hoursKey]):exact;
  out[key]=formatStageDuration(seconds);
  if(hoursKey in fields)out[hoursKey]=seconds===null?'':(seconds/3600).toFixed(2);
 }
 return out;
}
