/* Planning estimate only: parameter count × quantization width + working headroom.
   Never uses the model's disk size as runtime memory. */
(function(root){
 function planningBudget(model){
  const details=model?.details||{};
  const match=String(details.parameter_size||'').match(/^([\d.]+)\s*([BM])$/i);
  const q=String(details.quantization_level||'').toUpperCase();
  const bits=q.match(/^Q(\d+)/)?.[1] || ({F16:16,BF16:16,F32:32}[q]);
  if(!match||!bits)return null;
  const billions=Number(match[1])*(match[2].toUpperCase()==='M'?.001:1);
  return Math.ceil((billions*Number(bits)/8*1.25+2)*2)/2;
 }
 function selectModel(models,preferred,loaded=[]){return models.find(m=>m.name===preferred)||models.find(m=>loaded.some(l=>l.name===m.name))||models[0]||null;}
 const api={planningBudget,selectModel};
 if(typeof module==='object')module.exports=api;else root.modelConfig=api;
})(typeof window==='object'?window:globalThis);
