const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('aether',{
 onMetrics: fn=>{const handler=(_,v)=>fn(v);ipcRenderer.on('metrics',handler);return()=>ipcRenderer.removeListener('metrics',handler)},
 call:(name,args)=>ipcRenderer.invoke('action',name,args),
 onCommand:fn=>ipcRenderer.on('command',()=>fn())
});
