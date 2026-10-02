'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalize,split,load,save,applyChange,LOCAL_ONLY}=require('../../core/settings.js');

// Minimal stand-in for the chrome.storage API used by load/save.
function fakeChrome({sync={},local={},syncError=null}={}) {
  const area=(store,error)=>({
    get(keys,done){
      api.runtime.lastError=error;
      const wanted=Array.isArray(keys)?keys:[keys];
      const out={};
      for(const key of wanted)if(key in store)out[key]=JSON.parse(JSON.stringify(store[key]));
      done(out);
      api.runtime.lastError=null;
    },
    set(values,done){
      api.runtime.lastError=error;
      if(!error)Object.assign(store,JSON.parse(JSON.stringify(values)));
      if(done)done();
      api.runtime.lastError=null;
    },
    remove(key,done){delete store[key];if(done)done();}
  });
  const api={storage:{sync:area(sync,syncError),local:area(local,null)},runtime:{lastError:null},
    _sync:sync,_local:local};
  return api;
}

// v0.7.0: manual names are real people's names and stay local as well.
test('the disabled-site list never enters the synced half',()=>{
  assert.deepEqual(LOCAL_ONLY,['disabledHosts','manualNames']);
  const parts=split(normalize({disabledHosts:['intranet.example'],replacement:'XX'}));
  assert.deepEqual(Object.keys(parts.local).sort(),['disabledHosts','manualNames']);
  assert.equal('manualNames' in parts.sync,false);
  assert.equal('disabledHosts' in parts.sync,false);
  assert.equal(parts.sync.replacement,'XX');
  // No host name may appear anywhere in the synced payload.
  assert.equal(JSON.stringify(parts.sync).includes('intranet.example'),false);
});

test('v0.5 local settings migrate once and are then removed',()=>{
  const api=fakeChrome({local:{settings:{replacement:'ZZ',disabledHosts:['old.example'],maskScreen:false}}});
  let result=null,info=null;
  load(api,(loaded,meta)=>{result=loaded;info=meta;});
  assert.equal(info.migrated,true);
  assert.equal(result.replacement,'ZZ');
  assert.equal(result.maskScreen,false);
  assert.deepEqual(result.disabledHosts,['old.example']);
  assert.equal('settings' in api._local,false,'legacy key is cleared');
  assert.deepEqual(api._local.localSettings.disabledHosts,['old.example']);
  assert.equal(api._sync.settings.replacement,'ZZ');
  assert.equal('disabledHosts' in api._sync.settings,false);
});

test('local values win over synced ones and survive a save round trip',()=>{
  const api=fakeChrome();
  save(api,normalize({replacement:'AA',disabledHosts:['a.test']}));
  let result=null;
  load(api,loaded=>{result=loaded;});
  assert.equal(result.replacement,'AA');
  assert.deepEqual(result.disabledHosts,['a.test']);
});

test('a failing sync area degrades to local-only instead of throwing',()=>{
  const api=fakeChrome({syncError:{message:'sync unavailable'}});
  save(api,normalize({replacement:'BB',disabledHosts:['b.test']}));
  let result=null,info=null;
  load(api,(loaded,meta)=>{result=loaded;info=meta;});
  assert.equal(info.syncUnavailable,true);
  assert.deepEqual(result.disabledHosts,['b.test']);
  assert.equal(result.replacement,'OOO','the synced half was never written');
});

test('change events merge from either area',()=>{
  const current=normalize({replacement:'AA'});
  assert.equal(applyChange(current,'sync',{settings:{newValue:{replacement:'CC'}}}).replacement,'CC');
  assert.deepEqual(applyChange(current,'local',{localSettings:{newValue:{disabledHosts:['x.test']}}}).disabledHosts,['x.test']);
  assert.equal(applyChange(current,'local',{somethingElse:{newValue:1}}),null);
  assert.equal(applyChange(current,'sync',{localSettings:{newValue:{}}}),null);
});
