// Advisory memory monitoring only. There is no AETHER-enforced RAM budget.
// Ollama/macOS still determine what can actually be allocated.
function workload(sample, loaded, concurrent=false){
 if(loaded.length&&!concurrent)return {allowed:false,reason:'Another model is already loaded. Unload it first or enable Allow concurrent.'};
 if(!sample||Date.now()-sample.timestamp>10000)return {allowed:true,warning:'Current native memory measurements are unavailable. No AETHER RAM cap is enforced; available capacity cannot be verified.'};
 if(['critical','elevated'].includes(sample.pressure))return {allowed:true,warning:`macOS reports ${sample.pressure} memory pressure. No AETHER RAM cap is enforced; loading may fail or cause swapping. Consider unloading idle models.`};
 return {allowed:true,warning:null};
}
module.exports={workload};
