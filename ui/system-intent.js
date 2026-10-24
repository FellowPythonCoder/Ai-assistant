(function(root){
 // Route only explicit system questions. Substrings (e.g. RAM in "program")
 // and instructions asking the model to write code must never trigger telemetry.
 function systemIntent(prompt){
  const q=prompt.trim().toLowerCase().replace(/[’']/g,'').replace(/[?.!]+$/,'').replace(/\s+/g,' ');
  if(/^(?:please )?(?:show|open)(?: me)?(?: my| the)?(?: macs| mac| system)? (?:ram|memory)(?: usage)? history$/.test(q))return 'history';
  if(/^(?:which|what) (?:process|application|app)(?: is)? (?:using|uses|consuming|consumes|has) (?:the )?(?:most|highest|largest) (?:ram|memory)(?: usage)?$/.test(q))return 'largest';
  if(/^(?:how much (?:ram|memory) (?:is|does) ollama (?:using|use|consuming|consume)|(?:show|what is|whats)(?: me)? ollamas? (?:ram|memory)(?: usage)?)$/.test(q))return 'ollama';
  if(/^can i (?:safely )?(?:load|run) (?:the |an? )?[\w.:-]+(?: \w+){0,3} model(?: (?:right )?now)?$/.test(q))return 'model';
  if(/^(?:how much (?:ram|memory) (?:is (?:left|available|free|used)|do i have(?: left| available| free)?)|(?:show|check)(?: me)?(?: my| the)?(?: macs| mac| system)? (?:ram|memory)(?: usage| status)?|(?:what is|whats)(?: my| the)? (?:available|free|used) (?:ram|memory))$/.test(q))return 'memory';
  return null;
 }
 const api={systemIntent};if(typeof module==='object')module.exports=api;else root.systemIntents=api;
})(typeof window==='object'?window:globalThis);
