const {test}=require('node:test'),assert=require('node:assert/strict');
const {selectModel}=require('../ui/model-config.js');
test('model selection respects saved selection then loaded then first installed',()=>{const models=[{name:'qwen3:4b'},{name:'llama3.2:latest'}];assert.equal(selectModel(models,'llama3.2:latest').name,'llama3.2:latest');assert.equal(selectModel(models,'deleted',[{name:'llama3.2:latest'}]).name,'llama3.2:latest');assert.equal(selectModel(models,'deleted').name,'qwen3:4b');assert.equal(selectModel([],null),null)});
