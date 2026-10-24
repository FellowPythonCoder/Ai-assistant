(function(root){
 const unquote=s=>{s=s.trim();return /^(["']).*\1$/s.test(s)?s.slice(1,-1):s};
 function parseFileIntent(text){
  const match=text.trim().match(/^(create|make|edit|update|modify|append to)\s*(?:a\s+|the\s+)?(?:text\s+)?(?:file\s+)?(?:(?:called|named)\s+)?(.+)$/is);
  if(!match)return null;
  const action=/create|make/.test(match[1])?'create':'edit';let target=match[2].trim(),instruction='',content='';
  // Quoted text may contain location names and keywords; only split outside quotes.
  const token=/"[^"\n]*"|'[^'\n]*'|\s+(?:with contents?|with text|containing|and write|saying|replace|append|to say|to read|to |by |and |with )\b/gi;
  let m;while((m=token.exec(target))){if(/^\s/.test(m[0])){instruction=target.slice(m.index).trim();target=target.slice(0,m.index).trim();break}}
  const loc=target.match(/\s+(?:in|on|from)\s+(?:my\s+|the\s+)?(documents|desktop|downloads|authorized folder)\s*$/i);
  const location=loc?loc[1].toLowerCase():null;if(loc)target=target.slice(0,loc.index).trim();
  let name=unquote(target).replace(/^(?:file\s+(?:called|named)\s+)/i,'');
  if(action==='edit'&&/^(?:this|this file|a file|file)$/i.test(name))name='';
  // Do not treat ordinary chat such as "make me laugh" as a filesystem action.
  if(!location&&name&&!/\.[a-z\d]{1,12}$/i.test(name)&&!/^\s*["']/.test(target))return null;
  if(action==='create')content=unquote(instruction.replace(/^(?:with contents?|with text|containing|and write|saying)\s*/i,''));
  if(match[1].toLowerCase()==='append to')instruction='append '+instruction.replace(/^append\s*/i,'');
  return {action,name,location,content,instruction};
 }
 function literalEdit(original,instruction){
  let m=instruction.match(/^replace\s+(["'])(.*?)\1\s+with\s+(["'])(.*?)\3\s*$/is);
  if(m){if(!m[2])throw Error('Replacement search cannot be empty.');if(!original.includes(m[2]))throw Error('The text to replace was not found.');return original.split(m[2]).join(m[4])}
  m=instruction.match(/^append\s+(["'])(.*?)\1\s*$/is);if(m)return original+(original&&!original.endsWith('\n')?'\n':'')+m[2];
  m=instruction.match(/^(?:to say|to read|with content)\s+(["'])(.*?)\1\s*$/is);if(m)return m[2];
  return null;
 }
 const api={parseFileIntent,literalEdit};if(typeof module==='object')module.exports=api;else root.fileIntents=api;
})(typeof window==='object'?window:globalThis);
