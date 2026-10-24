(function(root){
 function selectModel(models,preferred,loaded=[]){return models.find(m=>m.name===preferred)||models.find(m=>loaded.some(l=>l.name===m.name))||models[0]||null;}
 const api={selectModel};
 if(typeof module==='object')module.exports=api;else root.modelConfig=api;
})(typeof window==='object'?window:globalThis);
