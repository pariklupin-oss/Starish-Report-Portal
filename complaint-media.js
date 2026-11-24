/* complaint-media.js — photo / video helpers for the QR complaint page (no login).
   Photos are shrunk on the phone; videos are max 1 minute and made smaller. */
const CM_MAX_VIDEO_S=60,CM_TARGET_VIDEO_BYTES=20*1024*1024,CM_MAX_BYTES=50*1024*1024;
(function(){if(document.getElementById('cmStyle'))return;const st=document.createElement('style');st.id='cmStyle';st.textContent=`.cm-box{border:1px dashed #b9c6cf;border-radius:12px;padding:12px;margin:14px 0}.cm-box h4{margin:0 0 8px;font-size:15px}.cm-btns{display:flex;flex-wrap:wrap;gap:8px}.cm-btns button,.cm-btns label.cm-file{font-size:14px}.cm-file{display:inline-flex;align-items:center;cursor:pointer;border:1px solid #c9d3da;border-radius:10px;padding:8px 12px;background:#fff}.cm-file input{display:none}.cm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-top:10px}.cm-item{position:relative;border-radius:10px;overflow:hidden;background:#eef2f5}.cm-item img,.cm-item video{width:100%;height:120px;object-fit:cover;display:block;background:#000}.cm-item small{display:block;padding:4px 6px;font-size:11px;color:#53616a}.cm-item button{position:absolute;top:4px;right:4px;padding:2px 8px;font-size:12px;border-radius:8px}.cm-status{font-size:13px;margin-top:8px;color:#53616a}#cmRec{max-width:520px}#cmRec video{width:100%;border-radius:10px;background:#000;max-height:60vh}#cmRec .cm-timer{font-size:22px;font-weight:700;text-align:center;margin:8px 0}#cmRec{border:0;border-radius:14px;padding:16px;width:calc(100% - 24px)}#cmRec .form-actions{display:flex;gap:8px;justify-content:flex-end}.cm-btns button,#cmRec button{width:auto;margin:0;padding:9px 12px;font-size:14px;border-radius:10px}.cm-btns button{background:#fff;color:#102d4c;border:1px solid #c9d3da}.cm-item button{width:auto;margin:0;padding:2px 8px;font-size:12px;background:#fff;color:#b42318;border:1px solid #e4b4b0}`;document.head.append(st);})();
function cmBaseMime(t){return String(t||'').split(';')[0].trim().toLowerCase();}
function cmVideoMime(){const list=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp8,opus','video/webm;codecs=vp8','video/webm'];return (window.MediaRecorder&&list.find(m=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(m)))||'';}
async function cmPhoto(file){
 const url=URL.createObjectURL(file);
 try{const img=await new Promise((ok,bad)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>bad(Error('Could not read the photo'));i.src=url;});
  const s=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  const blob=await new Promise(ok=>c.toBlob(ok,'image/jpeg',0.72));if(!blob)throw Error('Could not compress the photo');return {blob,mime:'image/jpeg',kind:'photo'};}
 finally{URL.revokeObjectURL(url);}
}
function cmDuration(file){return new Promise(ok=>{const v=document.createElement('video'),u=URL.createObjectURL(file);v.preload='metadata';v.onloadedmetadata=()=>{const d=v.duration;URL.revokeObjectURL(u);ok(Number.isFinite(d)?d:0);};v.onerror=()=>{URL.revokeObjectURL(u);ok(0);};v.src=u;});}
async function cmShrinkVideo(file,status){
 const mime=cmVideoMime(),c0=document.createElement('canvas');if(!mime||!c0.captureStream)return null;
 const v=document.createElement('video'),u=URL.createObjectURL(file);v.src=u;v.muted=true;v.playsInline=true;
 await new Promise((ok,bad)=>{v.onloadedmetadata=ok;v.onerror=()=>bad(Error('Could not read the video'));});
 const s=Math.min(1,640/Math.max(v.videoWidth||640,v.videoHeight||480));c0.width=Math.round((v.videoWidth||640)*s/2)*2;c0.height=Math.round((v.videoHeight||480)*s/2)*2;
 const ctx=c0.getContext('2d'),stream=c0.captureStream(24);
 try{const a=(v.captureStream||v.mozCaptureStream)?.call(v);a&&a.getAudioTracks().forEach(t=>stream.addTrack(t));}catch(_){}
 const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:900000,audioBitsPerSecond:64000}),parts=[];rec.ondataavailable=e=>e.data&&e.data.size&&parts.push(e.data);
 const done=new Promise(ok=>rec.onstop=ok);let raf=0;const draw=()=>{ctx.drawImage(v,0,0,c0.width,c0.height);status&&status('Making the video smaller… '+Math.round(v.currentTime)+' / '+Math.round(v.duration||0)+' s');if(!v.ended&&!v.paused)raf=requestAnimationFrame(draw);};
 rec.start(1000);await v.play();draw();
 await new Promise(ok=>{v.onended=ok;setTimeout(ok,(CM_MAX_VIDEO_S+3)*1000);});cancelAnimationFrame(raf);rec.stop();await done;URL.revokeObjectURL(u);
 return {blob:new Blob(parts,{type:cmBaseMime(mime)}),mime:cmBaseMime(mime),kind:'video',duration:Math.min(CM_MAX_VIDEO_S,Math.round(v.duration||0))};
}
async function cmVideoFromFile(file,status){
 const d=await cmDuration(file);if(d>CM_MAX_VIDEO_S+2)throw Error('Video is longer than 1 minute. Please choose or record a video of up to 1 minute.');
 const mime=cmBaseMime(file.type)||'video/mp4';
 if(file.size<=CM_TARGET_VIDEO_BYTES&&['video/mp4','video/webm','video/quicktime'].includes(mime))return {blob:file,mime,kind:'video',duration:Math.round(d)};
 const small=await cmShrinkVideo(file,status).catch(()=>null);if(small&&small.blob.size)return small;
 if(file.size<=CM_MAX_BYTES&&['video/mp4','video/webm','video/quicktime'].includes(mime))return {blob:file,mime,kind:'video',duration:Math.round(d)};
 throw Error('Video is too large for this phone to shrink. Please use "Record video" instead.');
}
function cmRecordVideo(){return new Promise(async(resolve,reject)=>{
 const mime=cmVideoMime();if(!mime||!navigator.mediaDevices?.getUserMedia)return reject(Error('This browser cannot record video. Use "Choose video" instead.'));
 let stream;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480}},audio:true});}catch(e){return reject(Error('Camera permission is needed to record video.'));}
 let dlg=document.getElementById('cmRec');if(!dlg){dlg=document.createElement('dialog');dlg.id='cmRec';document.body.append(dlg);}
 dlg.innerHTML='<h3 style="margin-top:0">Record video (max 1 minute)</h3><video autoplay muted playsinline></video><div class="cm-timer">0:00</div><div class="form-actions"><button type="button" class="secondary" data-cm-cancel>Cancel</button><button type="button" data-cm-go>Start recording</button></div>';
 const v=dlg.querySelector('video'),t=dlg.querySelector('.cm-timer'),go=dlg.querySelector('[data-cm-go]');v.srcObject=stream;dlg.showModal();
 let rec=null,parts=[],tick=0,sec=0,cancelled=false;const stopAll=()=>{clearInterval(tick);stream.getTracks().forEach(x=>x.stop());};
 const finish=()=>{if(rec&&rec.state!=='inactive')rec.stop();};
 dlg.querySelector('[data-cm-cancel]').onclick=()=>{cancelled=true;finish();stopAll();dlg.close();reject(Error('cancelled'));};
 dlg.oncancel=e=>{e.preventDefault();};
 go.onclick=()=>{if(rec){finish();return;}
  rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:900000,audioBitsPerSecond:64000});rec.ondataavailable=e=>e.data&&e.data.size&&parts.push(e.data);
  rec.onstop=()=>{stopAll();dlg.close();if(cancelled)return;resolve({blob:new Blob(parts,{type:cmBaseMime(mime)}),mime:cmBaseMime(mime),kind:'video',duration:sec});};
  rec.start(1000);go.textContent='Stop';tick=setInterval(()=>{sec++;t.textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');if(sec>=CM_MAX_VIDEO_S)finish();},1000);};
});}
function cmPickerHtml(){return `<div class="cm-btns"><label class="cm-file">📷 Photo<input type="file" accept="image/*" multiple data-cm-photo></label><label class="cm-file">🎞 Choose video<input type="file" accept="video/*" data-cm-video></label><button type="button" data-cm-rec>⏺ Record video</button></div><div class="cm-status" data-cm-status></div>`;}
/* Wires the three buttons; onItem(item) gets each ready (compressed) photo/video. */
function cmBindPicker(root,onItem){if(!root.querySelector('[data-cm-photo]'))return;/*27-10-2026 media off*/
 const st=root.querySelector('[data-cm-status]'),status=s=>{if(st)st.textContent=s||'';};
 const run=async fn=>{try{const items=await fn();for(const it of [].concat(items||[]))await onItem(it,status);}catch(e){if(e.message!=='cancelled')status(e.message);}};
 root.querySelector('[data-cm-photo]').onchange=e=>{const files=[...e.target.files];e.target.value='';run(async()=>{const out=[];for(const f of files){status('Preparing photo…');out.push(await cmPhoto(f));}return out;});};
 root.querySelector('[data-cm-video]').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)run(()=>cmVideoFromFile(f,status));};
 root.querySelector('[data-cm-rec]').onclick=()=>run(()=>cmRecordVideo());
 return status;
}

/* ---- 24-11-2026: photos/videos are stored in Google Drive (Starish Media server), not Supabase ---- */
function cmB64(blob){return new Promise((ok,bad)=>{const fr=new FileReader();fr.onload=()=>ok(String(fr.result).split(',')[1]||'');fr.onerror=()=>bad(Error('Could not read the file'));fr.readAsDataURL(blob);});}
async function cmDrivePost(r,item){const data=await cmB64(item.blob);const res=await fetch(r.uploadUrl,{method:'POST',body:JSON.stringify({action:'upload',ticket:r.ticket,mime:item.mime,data})});
 let j=null;try{j=await res.json();}catch(e){throw Error('Upload failed. Check internet and try again.');}if(!j||!j.ok)throw Error((j&&j.error)||'Upload failed');return j;}
function cmEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function cmThumbs(list,delAttr){list=list||[];if(!list.length)return '';return '<div class="cm-grid">'+list.map(m=>`<div class="cm-item"><a href="${cmEsc(m.url)}" target="_blank" rel="noopener"><img src="${cmEsc(m.thumb||m.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.opacity=.25">${m.kind==='video'?'<span class="cm-play">▶</span>':''}</a>${delAttr?`<button type="button" ${delAttr}="${cmEsc(m.id)}">✕</button>`:''}</div>`).join('')+'</div>';}
(function(){const st=document.createElement('style');st.textContent='.cm-item a{position:relative;display:block}.cm-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.6);color:#fff;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:18px}#cmAdd{border:0;border-radius:14px;padding:16px;width:calc(100% - 24px);max-width:520px}#cmAdd .cm-close{float:right;width:auto;margin:0;padding:6px 12px;background:#fff;color:#102d4c;border:1px solid #c9d3da;border-radius:10px}';document.head.append(st);})();
/* Small sheet to add photos/videos to an entry (Work Log / Quality). api = the app's api(action,data) */
function cmAddSheet(title,o){let dlg=document.getElementById('cmAdd');if(!dlg){dlg=document.createElement('dialog');dlg.id='cmAdd';document.body.append(dlg);}
 dlg.innerHTML=`<button type="button" class="cm-close">Close</button><h3 style="margin:4px 0 10px">${cmEsc(title)}</h3><div class="cm-box">${cmPickerHtml()}<div data-cm-done class="cm-status"></div></div><p class="cm-status">Photos are made smaller on the phone. Video up to 1 minute. Keep this screen open until it says Uploaded.</p>`;
 let added=0;const close=()=>{dlg.close();if(added&&o.onDone)o.onDone();};dlg.querySelector('.cm-close').onclick=close;dlg.oncancel=e=>{e.preventDefault();close();};
 cmBindPicker(dlg,async(item,status)=>{status('Uploading '+item.kind+'… ('+(item.blob.size/1048576).toFixed(1)+' MB)');
  const r=await o.api('mediaUpload',{kind:o.kind,ref:o.ref,mime:item.mime,size:item.blob.size,duration:item.duration||0});const j=await cmDrivePost(r,item);
  await o.api('mediaDone',{id:r.id,fileId:j.id,sig:j.sig,size:j.size});added++;status('Uploaded ✓ ('+added+')');});
 dlg.showModal();}
