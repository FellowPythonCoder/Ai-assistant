const {test}=require('node:test');const assert=require('node:assert/strict');const {budget}=require('../electron/policy.cjs');
const GB=1024**3;const sample=(extra={})=>({timestamp:Date.now(),total:16*GB,available:10*GB,pressure:'normal',...extra});
test('missing and stale telemetry cannot authorize model loading',()=>{assert.equal(budget(null,[],GB).allowed,false);assert.equal(budget(sample({timestamp:0}),[],GB).allowed,false)});
test('critical pressure blocks loading',()=>assert.equal(budget(sample({pressure:'critical'}),[],GB).allowed,false));
test('reserves OS and GPU headroom',()=>{assert.equal(budget(sample(),[],8*GB).allowed,false);assert.equal(budget(sample(),[],6*GB).allowed,true)});
test('concurrent models require explicit consent and sufficient memory',()=>{assert.equal(budget(sample(),['model'],GB).allowed,false);assert.equal(budget(sample(),['model'],GB,true).allowed,true);assert.equal(budget(sample(),['model'],12*GB,true).allowed,false)});
test('disk size is never substituted for runtime estimate',()=>{for(const value of [0,-1,NaN,undefined,Infinity])assert.equal(budget(sample(),[],value).allowed,false)});
