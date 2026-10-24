const {app,BrowserWindow,ipcMain,globalShortcut,dialog,shell}=require('electron');
const {spawn}=require('node:child_process'),fs=require('node:fs/promises'),path=require('node:path');
const {budget}=require('./policy.cjs');
let win,helper,last=null,root=null,active=null;
async function ollama(endpoint,body,signal){const r=await fetch('http://127.0.0.1:11434/api/'+endpoint,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:signal||AbortSignal.timeout(5000)});if(!r.ok)throw Error('Ollama: '+r.status);return r.json()}
function native(){if(process.platform!=='darwin')return;helper=spawn(app.isPackaged?path.join(process.resourcesPath,'aether-metrics'):path.join(__dirname,'../native/bin/aether-metrics'));let buffer='';helper.stdout.on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\n'))>=0){try{const data=JSON.parse(buffer.slice(0,i));if(!data.error){last={...data,aetherPid:process.pid};win?.webContents.send('metrics',last)}}catch{}buffer=buffer.slice(i+1)}});helper.on('error',e=>win?.webContents.send('metrics',{error:e.message}));helper.on('exit',()=>{last=null;win?.webContents.send('metrics',{error:'Native metrics helper stopped.'})})}
async function safePath(relative=''){if(!root)throw Error('Choose an authorized folder first.');if(typeof relative!=='string')throw Error('Invalid path');const p=await fs.realpath(path.resolve(root,relative));if(p!==root&&!p.startsWith(root+path.sep))throw Error('Outside authorized folder');return p}
ipcMain.handle('action',async(event,name,args={})=>{try{
 if(event.sender!==win.webContents||!(event.senderFrame===win.webContents.mainFrame&&event.senderFrame.url===require('node:url').pathToFileURL(path.join(__dirname,'../ui/index.html')).href))throw Error('Untrusted sender');
 switch(name){
 case 'appInfo':return {version:app.getVersion(),packaged:app.isPackaged,appPath:app.getAppPath(),executable:process.execPath};
 case 'metrics':return last;
 case 'fullscreen':win.setFullScreen(!win.isFullScreen());return true;
 case 'chooseFolder':{const d=await dialog.showOpenDialog(win,{properties:['openDirectory']});if(d.canceled)return null;root=await fs.realpath(d.filePaths[0]);return path.basename(root)}
 case 'files':{const p=await safePath(args.path);const entries=await fs.readdir(p,{withFileTypes:true});return Promise.all(entries.slice(0,500).map(async e=>{const s=await fs.lstat(path.join(p,e.name));return {name:e.name,directory:e.isDirectory(),size:s.size,symlink:e.isSymbolicLink()}}))}
 case 'createFile':{
  if(typeof args.name!=='string'||!args.name.trim()||args.name.length>255||/[\\/\x00]/.test(args.name)||['.','..'].includes(args.name))throw Error('Use a file name without folders or path separators.');
  const result=await dialog.showSaveDialog(win,{title:'Create file — choose its location',defaultPath:path.join(root||app.getPath('documents'),args.name),buttonLabel:'Create file'});
  if(result.canceled||!result.filePath)return {canceled:true};
  // Exclusive creation: never silently overwrite an existing file, even after a dialog.
  try{await fs.writeFile(result.filePath,'',{flag:'wx',mode:0o600})}catch(e){if(e.code==='EEXIST')throw Error('That file already exists. Nothing was overwritten; choose a different name.');throw e}
  return {canceled:false,path:result.filePath};
 }
 case 'openFile':return shell.openPath(await safePath(args.path));
 case 'preview':{const p=await safePath(args.path),s=await fs.stat(p);if(!s.isFile()||s.size>200000)throw Error('Preview supports text files under 200 KB.');return (await fs.readFile(p,'utf8')).replace(/\u0000/g,'')}
 case 'trash':{const p=await safePath(args.path);if(p===root)throw Error('Cannot trash authorized root');const d=await dialog.showMessageBox(win,{type:'warning',message:`Move ${path.basename(p)} to Trash?`,buttons:['Cancel','Move to Trash'],cancelId:0});if(d.response===1)await shell.trashItem(p);return d.response===1}
 case 'rename':{const p=await safePath(args.path);if(p===root||typeof args.name!=='string'||!args.name||/[\/\\]/.test(args.name)||['.','..'].includes(args.name))throw Error('Invalid name');const target=path.join(path.dirname(p),args.name);try{await fs.access(target);throw Error('Destination exists')}catch(e){if(e.code!=='ENOENT')throw e}await fs.rename(p,target);return true}
 case 'apps':{if(process.platform!=='darwin')throw Error('Mac applications are only available on macOS');const results=[];for(const dir of ['/Applications','/System/Applications',path.join(app.getPath('home'),'Applications')]){for(const e of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){if(e.name.endsWith('.app'))results.push({name:e.name.slice(0,-4),path:path.join(dir,e.name)})}}return results}
 case 'openApp':{const apps=await fs.realpath(args.path);if(!apps.endsWith('.app')||!['/Applications/','/System/Applications/',path.join(app.getPath('home'),'Applications/')].some(p=>apps.startsWith(p)))throw Error('Invalid application');return shell.openPath(apps)}
 case 'quitProcess':{if(!last||Date.now()-last.timestamp>10000)throw Error('Fresh process data required');const p=last.processes.find(p=>p.pid===args.pid);if(!p||p.uid!==process.getuid()||(p.pid===process.pid||p.ppid===process.pid||/AETHER|aether-metrics|Electron Helper/.test(p.path))||p.pid<=1||!p.path.includes('.app/')||p.path.startsWith('/System/')||p.path.startsWith('/usr/'))throw Error('Only eligible user application processes may be terminated');const d=await dialog.showMessageBox(win,{type:'warning',message:`${args.force?'Force quit':'Terminate'} ${p.name} (${p.pid})? Unsaved data may be lost.`,buttons:['Cancel','Confirm'],cancelId:0});if(d.response===1)process.kill(p.pid,args.force?'SIGKILL':'SIGTERM');return d.response===1}
 case 'models':return ollama('ps');
 case 'modelCatalog':return ollama('tags');
 case 'unload':{const loaded=await ollama('ps');if(!loaded.models.some(m=>m.name===args.model))throw Error('Model is not loaded');const d=await dialog.showMessageBox(win,{message:`Unload ${args.model}?`,buttons:['Cancel','Unload'],cancelId:0});if(d.response!==1)return false;return ollama('generate',{model:args.model,keep_alive:0})}
 case 'cancel':active?.abort();return true;
 case 'infer':{if(active)throw Error('An AI job is already active');if(typeof args.prompt!=='string'||args.prompt.length>32000||(typeof args.model!=='string'||!args.model.trim()))throw Error('Enter a message and select an installed Ollama model before sending.');const catalog=await ollama('tags');if(!catalog.models.some(m=>m.name===args.model))throw Error('Selected model is not installed. Refresh installed models and select one.');const loaded=await ollama('ps');const check=budget(last,loaded.models.filter(m=>m.name!==args.model),Number(args.estimate)*1024**3,args.concurrent===true);if(!check.allowed)throw Error(check.reason);const controller=new AbortController();active=controller;try{return await ollama('generate',{model:args.model,prompt:args.prompt,stream:false,keep_alive:'5m',options:{num_ctx:2048}},controller.signal)}finally{active=null}}
 default:throw Error('Unsupported action');
 }
 }catch(e){return {error:e.message}}});
app.whenReady().then(()=>{win=new BrowserWindow({width:1440,height:960,minWidth:900,minHeight:650,title:`AETHER ${app.getVersion()} — ${app.isPackaged?'Installed app':'Source development'}`,backgroundColor:'#080c12',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));win.loadFile('ui/index.html');win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());globalShortcut.register('CommandOrControl+Shift+Space',()=>{win.show();win.webContents.send('command')});native()});
app.on('will-quit',()=>{helper?.kill();globalShortcut.unregisterAll()});app.on('window-all-closed',()=>app.quit());
