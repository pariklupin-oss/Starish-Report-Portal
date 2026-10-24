// Coalesce identical reads and keep the latest selected view/date when a read is in flight.
export function workspaceGroup(view) {
 if (['Reports','Analysis','Machine Breakdown'].includes(view)) return 'reports';
 if (['Quality','Quality Issues'].includes(view)) return 'quality';
 if (view === 'Tasks') return 'tasks';
 if (view === 'Maintenance Complaints') return 'complaints';
 return '';
}
export function workspaceNeedsReload(state, request) {
 const group=workspaceGroup(request.view);
 if(!state || !group) return false;
 if(state._workspaceFrom!==undefined && (state._workspaceFrom!==request.from || state._workspaceTo!==request.to)) return true;
 return !!state.workspaceView && workspaceGroup(state.workspaceView)!==group;
}
export function createWorkspaceLoader({getRequest,requestKey,fetchWorkspace}) {
 let active=null;
 function load(){
  const request=getRequest(),key=requestKey(request);
  if(active) return active.key===key ? active.promise : active.promise.then(load,load);
  const current={key,promise:null};active=current;
  current.promise=Promise.resolve().then(()=>fetchWorkspace(request)).finally(()=>{if(active===current)active=null;});
  return current.promise;
 }
 return load;
}
