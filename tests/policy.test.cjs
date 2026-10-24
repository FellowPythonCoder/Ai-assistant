const {test}=require('node:test');const assert=require('node:assert/strict');const {workload}=require('../electron/policy.cjs');
const sample=(extra={})=>({timestamp:Date.now(),total:16*1024**3,available:0,pressure:'normal',...extra});
test('no memory estimate or minimum available capacity is required',()=>assert.equal(workload(sample(),[]).allowed,true));
test('missing and stale telemetry warn without blocking inference',()=>{for(const s of [null,sample({timestamp:0})]){const result=workload(s,[]);assert.equal(result.allowed,true);assert.match(result.warning,/unavailable/)}});
test('real pressure warns without imposing an AETHER cap',()=>{for(const pressure of ['elevated','critical']){const result=workload(sample({pressure}),[]);assert.equal(result.allowed,true);assert.match(result.warning,new RegExp(pressure))}});
test('loading different models still requires explicit concurrency consent',()=>{assert.equal(workload(sample(),['other']).allowed,false);assert.equal(workload(sample(),['other'],true).allowed,true)});
