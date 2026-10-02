(function () {
  'use strict';
  if(globalThis.__oooStarted)return;
  globalThis.__oooStarted=true;
  let settings=OOOSettings.normalize(),knownNames=new Set(),givenNames=[];
  const manual=()=>settings.manualNames,keep=()=>settings.keepWords;
  const originals=new Map(),overlays=new Map(),inputValues=new WeakMap();
  let pending=0,frame=0,scans=0,lastMaskCount=0;
  const skip='script,style,noscript,template,svg,canvas,[data-ooo-extension-ui]';
  const block='td,th,dd,dt,p,li,h1,h2,h3,h4,h5,h6,div,section,article,header,footer,main,pre,button,label';
  const active=()=>settings.enabled&&!settings.disabledHosts.includes(location.hostname||'');
  // Screen masking and clipboard masking are independent; either can run alone.
  const screenActive=()=>active()&&settings.maskScreen;
  // The overlay only hides the field visually; the clipboard rules are separate.
  const inputsActive=()=>screenActive()&&settings.maskInputs;
  const clipboardActive=()=>active()&&settings.maskClipboard;
  const isInput=e=>e instanceof HTMLInputElement||e instanceof HTMLTextAreaElement;
  const nameContext=()=>({knownNames,manualNames:manual(),givenNames,keepWords:keep()});
  function source(node) {
    const old=originals.get(node);
    return old&&node.nodeValue===old.masked?old.original:node.nodeValue||'';
  }
  function sourceText(element) {
    if(!element)return '';
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let text='';
    while(walker.nextNode())text+=source(walker.currentNode);
    return text;
  }
  function labelledField(e,matches) {
    if(!e)return false;
    if(e.closest('th'))return false;
    if([e.getAttribute('aria-label'),e.getAttribute('data-label'),e.getAttribute('data-field'),e.getAttribute('name'),e.id].some(matches))return true;
    const cell=e.closest('td,dd');
    if(cell) {
      if(matches(sourceText(cell.previousElementSibling)))return true;
      const row=cell.closest('tr'),table=cell.closest('table');
      if(row&&table) {
        const cells=[...row.cells];
        // Complex spanning tables require site-specific mapping; don't guess a column.
        if(cells.every(c=>c.colSpan===1&&c.rowSpan===1)) {
          const index=cells.indexOf(cell);
          for(const headerRow of table.rows) {
            if(headerRow===row)break;
            if([...headerRow.cells].every(c=>c.colSpan===1&&c.rowSpan===1)) {
              const header=headerRow.cells[index];
              if(header&&header.tagName==='TH'&&matches(sourceText(header)))return true;
            }
          }
        }
      }
    }
    if(matches(sourceText(e.previousElementSibling)))return true;
    return false;
  }
  const nameField=e=>labelledField(e,MaskOOO.isSensitiveNameLabel);
  const birthField=e=>labelledField(e,MaskOOO.isBirthLabel);
  const clinicalField=e=>labelledField(e,MaskOOO.isClinicalDateLabel);
  const fieldFlags=e=>({nameField:nameField(e),birthField:birthField(e),clinicalField:clinicalField(e)});
  function inputContext(e) {
    const labels=[...(e.labels||[])].map(sourceText);
    const own=[e.name,e.id,e.placeholder,e.getAttribute('aria-label'),...labels];
    return {nameField:nameField(e)||own.some(MaskOOO.isSensitiveNameLabel),
      birthField:birthField(e)||own.some(MaskOOO.isBirthLabel),
      clinicalField:clinicalField(e)||own.some(MaskOOO.isClinicalDateLabel),
      ...nameContext()};
  }
  function roots() {
    const list=[document];
    for(let i=0;i<list.length;i++)for(const e of list[i].querySelectorAll('*')) {
      if(e.shadowRoot&&!e.closest('[data-ooo-extension-ui]'))list.push(e.shadowRoot);
    }
    return list;
  }
  function groupsIn(root) {
    const groups=[],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let previousKey=null,currentGroup=null;
    while(walker.nextNode()) {
      const node=walker.currentNode,e=node.parentElement;
      if(!e||e.closest(skip)||e.closest('input,textarea,select')||e.isContentEditable)continue;
      const key=e.closest(block)||root;
      let group=currentGroup;
      if(key!==previousKey){group={element:key,nodes:[],text:''};groups.push(group);currentGroup=group;previousKey=key;}
      const value=source(node);
      group.nodes.push({node,start:group.text.length,value});
      group.text+=value;
    }
    return groups;
  }
  function unmask() {
    for(const [node,old]of originals)if(node.isConnected&&node.nodeValue===old.masked)node.nodeValue=old.original;
    originals.clear();
    for(const item of overlays.values())item.remove();
    overlays.clear();lastMaskCount=0;
  }
  function restore() {unmask();knownNames.clear();givenNames=[];}
  function applyGroup(group,spans) {
    for(const item of group.nodes) {
      const start=item.start,end=start+item.value.length;let cursor=0,masked='';
      for(const span of spans) {
        if(span.end<=start||span.start>=end)continue;
        const a=Math.max(start,span.start)-start,b=Math.min(end,span.end)-start;
        masked+=item.value.slice(cursor,a);
        if(span.start>=start)masked+=settings.replacement;
        cursor=b;
      }
      masked+=item.value.slice(cursor);
      if(masked!==item.value)originals.set(item.node,{original:item.value,masked});
      else originals.delete(item.node);
      if(item.node.nodeValue!==masked)item.node.nodeValue=masked;
    }
  }
  function scan() {
    pending=0;observer.disconnect();
    try {
      if(!active()){restore();return;}
      scans++;
      for(const node of originals.keys())if(!node.isConnected)originals.delete(node);
      const allRoots=roots(),groups=allRoots.flatMap(groupsIn);
      const documents=groups.map(group=>({text:group.text,
        ...fieldFlags(group.element instanceof Element?group.element:null)}));
      for(const root of allRoots)for(const e of root.querySelectorAll('input,textarea')) {
        if(e.type!=='password'&&e.type!=='hidden') {
          const c=inputContext(e);
          documents.push({text:e.value,nameField:c.nameField,birthField:c.birthField,clinicalField:c.clinicalField});
        }
      }
      // Rebuild from original full names, never from aliases or previous masked output.
      const index=MaskOOO.buildNameIndex(documents,settings,manual(),keep());
      knownNames=new Set(index.knownNames);givenNames=index.givenNames;
      // The index is built even with screen masking off, because the clipboard
      // handlers still need to know which names this page contains.
      if(!settings.maskScreen){unmask();return;}
      lastMaskCount=0;
      for(const group of groups) {
        const result=MaskOOO.analyze(group.text,settings,
          {...fieldFlags(group.element instanceof Element?group.element:null),...nameContext()});
        lastMaskCount+=result.spans.length;applyGroup(group,result.spans);
      }
      for(const root of allRoots)for(const e of root.querySelectorAll('input,textarea'))updateInput(e);
      layout();
    } finally {
      for(const root of roots())observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,
        attributeFilter:['value','name','id','placeholder','aria-label','data-label','class','style']});
    }
  }
  function schedule() {if(!pending)pending=window.setTimeout(scan,50);}
  function updateInput(e) {
    inputValues.set(e,e.value);
    const spans=inputsActive()?MaskOOO.analyze(e.value,settings,inputContext(e)).spans:[];
    if(!spans.length||e.type==='hidden'||e.type==='password') {
      overlays.get(e)?.remove();overlays.delete(e);return;
    }
    if(!overlays.has(e)) {
      const overlay=document.createElement('div');
      overlay.dataset.oooExtensionUi='input-overlay';
      Object.assign(overlay.style,{position:'fixed',pointerEvents:'none',zIndex:'2147483646',
        boxSizing:'border-box',overflow:'hidden'});
      // The text sits in an inner layer so it can be shifted to follow the field's own
      // scrolling without disturbing the frame that matches the field's box.
      const inner=document.createElement('div');
      inner.dataset.oooExtensionUi='input-overlay-text';
      overlay.append(inner);
      document.documentElement.append(overlay);overlays.set(e,overlay);
    }
  }
  function setStyle(e,k,v){if(e.style[k]!==v)e.style[k]=v;}
  function layout() {
    frame=0;
    for(const [e,overlay]of overlays) {
      if(!e.isConnected||!inputsActive()){overlay.remove();overlays.delete(e);continue;}
      const rect=e.getBoundingClientRect(),style=getComputedStyle(e);
      const visible=rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&style.display!=='none';
      const multiline=e instanceof HTMLTextAreaElement;
      const props={display:visible?'block':'none',left:rect.left+'px',top:rect.top+'px',
        width:rect.width+'px',height:rect.height+'px',
        padding:style.padding,border:style.border,borderRadius:style.borderRadius,
        backgroundColor:style.backgroundColor==='rgba(0, 0, 0, 0)'?'white':style.backgroundColor,
        color:style.color,font:style.font};
      for(const [k,v]of Object.entries(props))setStyle(overlay,k,v);
      const inner=overlay.firstElementChild;
      // A textarea keeps its newlines and wrapping; a single-line input never wraps.
      // Copying the field's own text metrics keeps the masked copy on the same lines.
      const innerProps={
        whiteSpace:multiline?(style.whiteSpace==='pre'?'pre':'pre-wrap'):'nowrap',
        overflowWrap:multiline?(style.overflowWrap||'break-word'):'normal',
        wordBreak:style.wordBreak,lineHeight:style.lineHeight,letterSpacing:style.letterSpacing,
        textAlign:style.textAlign,textIndent:style.textIndent,direction:style.direction,
        tabSize:style.tabSize,
        // Single-line inputs centre their text in the box; textareas start at the top.
        display:multiline?'block':'flex',alignItems:multiline?'':'center',
        minHeight:multiline?'':'100%',
        transform:'translate('+(-e.scrollLeft)+'px,'+(-e.scrollTop)+'px)'};
      for(const [k,v]of Object.entries(innerProps))setStyle(inner,k,v);
      const display=MaskOOO.maskText(e.value,settings,inputContext(e));
      if(inner.textContent!==display)inner.textContent=display;
    }
  }
  function scheduleLayout(){if(!frame)frame=requestAnimationFrame(layout);}
  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>{
      const e=m.target.nodeType===Node.ELEMENT_NODE?m.target:m.target.parentElement;
      if(e?.closest('[data-ooo-extension-ui]'))return false;
      if(m.type==='childList')return [...m.addedNodes,...m.removedNodes].some(n=>!(n.nodeType===1&&n.matches('[data-ooo-extension-ui]')));
      return true;
    }))schedule();
  });
  function toast(message='已套用遮罩規則並複製純文字；仍請檢查') {
    if(!settings.showCopyToast||window.top!==window)return;
    document.querySelector('[data-ooo-extension-ui="toast"]')?.remove();
    const e=document.createElement('div');e.dataset.oooExtensionUi='toast';
    e.textContent=message;
    Object.assign(e.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:'2147483647',padding:'10px',
      background:'#173f37',color:'white',font:'13px system-ui',borderRadius:'8px',pointerEvents:'none'});
    document.documentElement.append(e);setTimeout(()=>e.remove(),1800);
  }
  function focused() {
    let e=document.activeElement;
    while(e?.shadowRoot?.activeElement)e=e.shadowRoot.activeElement;
    return e;
  }
  window.addEventListener('copy',event=>{
    if(!clipboardActive()||!settings.maskCopy||!event.clipboardData)return;
    const e=focused();let selected='',sanitized='';
    if(isInput(e)&&Number.isInteger(e.selectionStart)&&e.selectionEnd>e.selectionStart) {
      selected=e.value.slice(e.selectionStart,e.selectionEnd);
      // Detect on the full original value, then mask the intersecting selection only.
      // An incomplete selected name/ID is still masked; surrounding status marks survive.
      sanitized=MaskOOO.maskSelection(e.value,e.selectionStart,e.selectionEnd,settings,inputContext(e));
    } else {
      const selection=window.getSelection();
      selected=String(selection||'');
      sanitized=MaskOOO.maskText(selected,settings,nameContext());
      const editable=e?.isContentEditable?e:null;
      if(editable&&selection?.rangeCount) {
        const range=selection.getRangeAt(0),before=document.createRange();
        before.selectNodeContents(editable);
        try {
          before.setEnd(range.startContainer,range.startOffset);
          const start=before.toString().length,end=start+selected.length;
          const hits=MaskOOO.analyze(editable.textContent,settings,{...fieldFlags(editable),...nameContext()}).spans;
          if(hits.some(s=>s.start<end&&s.end>start))sanitized=settings.replacement;
        } catch {/* A selection extending outside this editor uses the plain-text pass. */}
      }
    }
    if(!selected)return;
    event.preventDefault();event.stopImmediatePropagation();event.clipboardData.clearData();
    event.clipboardData.setData('text/plain',sanitized);toast();
  },true);
  // Clipboard text can arrive from Chrome's built-in PDF viewer or another application,
  // where no content script ever ran and no copy event is dispatched to us. Masking on
  // paste is the point where that text first becomes reachable, so it is handled here.
  function insertText(target,text) {
    try {if(document.execCommand('insertText',false,text))return true;} catch {/* fall through */}
    if(isInput(target)&&Number.isInteger(target.selectionStart)) {
      const start=target.selectionStart,end=target.selectionEnd;
      try {target.setRangeText(text,start,end,'end');}
      catch {target.value=target.value.slice(0,start)+text+target.value.slice(end);}
      target.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste',data:text}));
      return true;
    }
    const selection=window.getSelection();
    if(target?.isContentEditable&&selection?.rangeCount) {
      const range=selection.getRangeAt(0),node=document.createTextNode(text);
      range.deleteContents();range.insertNode(node);range.setStartAfter(node);range.collapse(true);
      selection.removeAllRanges();selection.addRange(range);
      target.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste',data:text}));
      return true;
    }
    return false;
  }
  window.addEventListener('paste',event=>{
    if(!clipboardActive()||!settings.maskPaste||!event.clipboardData)return;
    const target=focused();
    if(isInput(target)&&(target.type==='password'||target.readOnly||target.disabled))return;
    const text=event.clipboardData.getData('text/plain');
    if(!text)return;
    // The pasted text is its own document: full names inside it also unlock their aliases.
    const local=MaskOOO.buildNameIndex([{text}],settings,manual(),keep());
    const masked=MaskOOO.maskText(text,settings,
      {knownNames:[...knownNames,...local.knownNames],givenNames:[...givenNames,...local.givenNames],
       manualNames:manual(),keepWords:keep()});
    // Nothing matched: let the browser paste natively so rich text and formatting survive.
    if(masked===text)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!insertText(target,masked))return;
    schedule();toast('貼上內容已套用遮罩規則；仍請檢查');
  },true);
  document.addEventListener('input',schedule,true);
  window.addEventListener('scroll',scheduleLayout,true);
  window.addEventListener('resize',scheduleLayout);
  // Programmatic input.value assignments do not emit DOM mutations.
  setInterval(()=>{
    if(!active()||document.hidden)return;
    for(const root of roots())for(const e of root.querySelectorAll('input,textarea'))if(inputValues.get(e)!==e.value){schedule();return;}
    scheduleLayout();
  },1000);
  chrome.storage.onChanged.addListener((changes,area)=>{
    const updated=OOOSettings.applyChange(settings,area,changes);
    if(updated){settings=updated;schedule();}
  });
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(sender.id&&sender.id!==chrome.runtime.id)return;
    if(message?.type==='OOO_RESCAN'){clearTimeout(pending);scan();reply({ok:true});}
    // The popup writes both lists to storage; these remain for an immediate rescan.
    if(message?.type==='OOO_SET_MANUAL_NAMES'||message?.type==='OOO_SET_KEEP_WORDS') {
      clearTimeout(pending);scan();
      reply({ok:true,count:message.type==='OOO_SET_MANUAL_NAMES'?manual().length:keep().length});
    }
    if(message?.type==='OOO_GET_STATUS')reply({active:active(),screen:screenActive(),clipboard:clipboardActive(),
      host:location.hostname,maskedTextNodes:lastMaskCount,
      maskedInputs:overlays.size,confirmedNames:knownNames.size,givenCount:givenNames.length,keepCount:keep().length,manualCount:manual().length,scans});
  });
  OOOSettings.load(chrome,loaded=>{settings=loaded;scan();});
})();
