(function(g){
  'use strict';
  const defaults={
    enabled:true,disabledHosts:[],replacement:'OOO',
    // Two independent protections. Either can run without the other.
    maskScreen:true,maskInputs:true,
    maskClipboard:true,maskCopy:true,maskPaste:true,
    showCopyToast:true,
    surnameLimit:500,givenNames:true,
    mrnMode:'all',mrnPatterns:[],mrnKeepDefault:true,mrnExcludeDates:true,
    dateMode:'unlabelled',
    // Keep words are ordinary vocabulary and sync freely. Manual names are the opposite:
    // they are the names of real people, so they stay on this machine and never sync.
    keepWords:[],manualNames:[],
    settingsVersion:4,
    rules:{nationalId:true,names:true,medicalRecordNumber:true,birthDate:true,email:false,phone:false}};
  const bool=(value,fallback)=>typeof value==='boolean'?value:fallback;
  const list=(value,min)=>Array.isArray(value)
    ?[...new Set(value.filter(v=>typeof v==='string').map(v=>v.trim())
      .filter(v=>v.length>=min&&v.length<=80))].slice(0,200)
    :[];
  function normalize(value={}) {
    value=value||{};
    const out={...defaults,...value,
      // v0.5 removed the balanced/strict choice; a stored nameMode is ignored.
      mrnMode:['checked','custom'].includes(value.mrnMode)?value.mrnMode:'all',
      mrnPatterns:Array.isArray(value.mrnPatterns)
        ?[...new Set(value.mrnPatterns.filter(p=>typeof p==='string').map(p=>p.trim()).filter(p=>p.length>=4&&p.length<=32))].slice(0,20)
        :[],
      mrnKeepDefault:bool(value.mrnKeepDefault,true),
      dateMode:['all','labelled'].includes(value.dateMode)?value.dateMode:'unlabelled',
      mrnExcludeDates:bool(value.mrnExcludeDates,true),
      maskScreen:bool(value.maskScreen,true),
      maskInputs:bool(value.maskInputs,true),
      keepWords:list(value.keepWords,2),
      manualNames:list(value.manualNames,1),
      // Migrate the v0.4 names for the clipboard switches.
      maskClipboard:bool(value.maskClipboard,bool(value.safeCopy,true)||bool(value.safePaste,true)),
      maskCopy:bool(value.maskCopy,bool(value.safeCopy,true)),
      maskPaste:bool(value.maskPaste,bool(value.safePaste,true)),
      settingsVersion:4,
      disabledHosts:Array.isArray(value.disabledHosts)?value.disabledHosts:[],
      replacement:String(value.replacement||'OOO').slice(0,12),
      rules:{...defaults.rules,...value.rules}};
    delete out.nameMode;delete out.nameRulesVersion;delete out.safeCopy;delete out.safePaste;
    return out;
  }
  // Storage split. Everything syncs with the Google account except two lists that must
  // not leave the machine: the disabled-site list holds host names of the systems the
  // user works in, and the manual name list holds the names of real people.
  const LOCAL_ONLY=['disabledHosts','manualNames'];
  function split(settings) {
    const local={},sync={};
    for(const [key,value] of Object.entries(settings))(LOCAL_ONLY.includes(key)?local:sync)[key]=value;
    return {local,sync};
  }
  function load(api,done) {
    api.storage.sync.get('settings',synced=>{
      const syncError=api.runtime.lastError;
      api.storage.local.get(['settings','localSettings'],stored=>{
        // Before v0.6 everything lived in local.settings; fold it in once.
        const legacy=stored.settings||null;
        const merged=normalize({...(legacy||{}),...(syncError?{}:(synced&&synced.settings)||{}),...(stored.localSettings||{})});
        if(legacy) {
          const parts=split(merged);
          api.storage.sync.set({settings:parts.sync},()=>void api.runtime.lastError);
          api.storage.local.set({localSettings:parts.local},()=>api.storage.local.remove('settings'));
        }
        done(merged,{migrated:!!legacy,syncUnavailable:!!syncError});
      });
    });
  }
  function save(api,settings,done) {
    const parts=split(normalize(settings));
    let pending=2;
    const finish=()=>{if(--pending===0&&done)done();};
    api.storage.sync.set({settings:parts.sync},()=>{void api.runtime.lastError;finish();});
    api.storage.local.set({localSettings:parts.local},finish);
  }
  // Merge a storage.onChanged payload without needing another read.
  function applyChange(current,area,changes) {
    if(area==='sync'&&changes.settings)return normalize({...current,...(changes.settings.newValue||{})});
    if(area==='local'&&changes.localSettings)return normalize({...current,...(changes.localSettings.newValue||{})});
    return null;
  }
  g.OOOSettings={normalize,defaults,split,load,save,applyChange,LOCAL_ONLY};
  if(typeof module!=='undefined'&&module.exports)module.exports=g.OOOSettings;
})(globalThis);
