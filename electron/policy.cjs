function budget(sample, loaded, estimate, concurrent=false){
 if(!sample || Date.now()-sample.timestamp>10000)return {allowed:false,reason:'Current native memory measurements are unavailable.'};
 if(!Number.isFinite(estimate)||estimate<=0)return {allowed:false,reason:'Provide an estimated runtime memory budget; model disk size is not RAM usage.'};
 if(sample.pressure==='critical')return {allowed:false,reason:'macOS reports critical memory pressure.'};
 if(loaded.length&&!concurrent)return {allowed:false,reason:'A model is already loaded. Unload it first, or explicitly allow concurrent models.'};
 const reserve=Math.max(2*1024**3,sample.total*.15);
 if(estimate>Math.max(0,sample.available-reserve))return {allowed:false,reason:'Estimated runtime memory exceeds available memory after the OS/GPU safety reserve. Try a smaller quantization.'};
 return {allowed:true,reason:'Estimate fits the current budget. Runtime and GPU allocations can still increase; this is not a guarantee.'};
}
module.exports={budget};
