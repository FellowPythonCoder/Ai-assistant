const fs=require('node:fs/promises'),{constants}=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MAX=200000;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function validateText(text){if(typeof text!=='string'||Buffer.byteLength(text)>MAX||text.includes('\0'))throw Error('Only UTF-8 text files up to 200 KB are supported.');return text}
function makeTextFiles({dialog,window,getPath,getRoot}){
 const sessions=new Map();
 function destination(args){
  const locations={documents:'documents',desktop:'desktop',downloads:'downloads'};
  const folder=args.location?args.location==='authorized folder'?getRoot():locations[args.location]?getPath(locations[args.location]):null:getRoot()||getPath('documents');
  if(!folder)throw Error('Choose an authorized folder or use Documents, Desktop or Downloads.');
  const name=args.name||'';
  if(typeof name!=='string'||name.length>255||/[\\/\x00]/.test(name)||['.','..'].includes(name))throw Error('Use a file name without path separators. Choose other locations in the native dialog.');
  return name?path.join(folder,name):folder;
 }
 async function create(args){
  if(!args.name?.trim())throw Error('Provide a file name, such as hello.txt.');
  const content=validateText(args.content??'');
  const d=await dialog.showSaveDialog(window(),{title:'Create text file — authorize destination',defaultPath:destination(args),buttonLabel:'Create file'});
  if(d.canceled||!d.filePath)return {canceled:true};
  try{await fs.writeFile(d.filePath,content,{flag:'wx',mode:0o600})}catch(e){if(e.code==='EEXIST')throw Error('File already exists. Nothing was overwritten; ask to edit it instead.');throw e}
  return {canceled:false,path:d.filePath};
 }
 async function pick(args={}){
  const d=await dialog.showOpenDialog(window(),{title:'Choose text file to edit — review changes before saving',defaultPath:destination(args),properties:['openFile']});
  if(d.canceled||!d.filePaths?.length)return {canceled:true};
  const selected=d.filePaths[0];const link=await fs.lstat(selected);
  if(link.isSymbolicLink())throw Error('Select the original file, not a symbolic link.');
  const file=await fs.realpath(selected);const h=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
  let buffer,stat;try{stat=await h.stat();if(!stat.isFile()||stat.nlink!==1||stat.size>MAX)throw Error('Select a regular, unlinked text file up to 200 KB.');buffer=await h.readFile()}finally{await h.close()}
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer)}catch{throw Error('This file is not valid UTF-8 text.')}
  validateText(text);const token=crypto.randomUUID();if(sessions.size>=10)sessions.delete(sessions.keys().next().value);
  sessions.set(token,{file,hash:hash(buffer),busy:false,mode:stat.mode});return {token,path:file,text};
 }
 async function save(args){
  const session=sessions.get(args.token);if(!session)throw Error('File authorization expired. Choose the file again.');
  if(session.busy)throw Error('A save is already in progress.');const text=validateText(args.text);session.busy=true;
  try{
   const d=await dialog.showMessageBox(window(),{type:'warning',message:`Save reviewed changes to ${path.basename(session.file)}?`,detail:`${session.file}\nA backup of the original will be saved beside it.`,buttons:['Cancel','Save changes'],cancelId:0,defaultId:0});
   if(d.response!==1)return {canceled:true};
   const h=await fs.open(session.file,constants.O_RDWR|constants.O_NOFOLLOW);let backup;
   try{
    const stat=await h.stat();if(!stat.isFile()||stat.nlink!==1||stat.size>MAX)throw Error('File type or size changed. Choose the file again.');
    const original=await h.readFile();if(hash(original)!==session.hash)throw Error('The file changed outside AETHER. Nothing was saved. Reopen it before editing.');
    const current=await fs.lstat(session.file);if(current.ino!==stat.ino||current.dev!==stat.dev)throw Error('File location changed. Reopen it before editing.');
    backup=session.file+'.aether-backup-'+crypto.randomUUID();await fs.writeFile(backup,original,{flag:'wx',mode:0o600});
    const bytes=Buffer.from(text);try{let offset=0;while(offset<bytes.length){const result=await h.write(bytes,offset,bytes.length-offset,offset);if(!result.bytesWritten)throw Error('Incomplete file write');offset+=result.bytesWritten}await h.truncate(bytes.length);await h.sync()}catch(e){throw Error(`Save failed. Original backup: ${backup}. ${e.message}`)}
    session.hash=hash(bytes);
   }finally{await h.close()}
   return {path:session.file,backup,canceled:false};
  }finally{session.busy=false}
 }
 function release(args){sessions.delete(args.token);return true}
 return {create,pick,save,release};
}
module.exports={makeTextFiles,validateText};
