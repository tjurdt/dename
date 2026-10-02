(function(){
  "use strict";
  const PDFJS = window['pdfjsLib'];
  const _wcode = document.getElementById('pdfjsWorker').textContent;
  const _wblob = new Blob([_wcode], {type:'application/javascript'});
  PDFJS.GlobalWorkerOptions.workerSrc = URL.createObjectURL(_wblob);

  /* ---------- Name detection data ---------- */
  const COMMON_SUR = new Set("陳林黃張李王吳劉蔡楊許鄭謝洪郭邱曾廖賴徐周葉蘇莊呂江何蕭羅高潘簡朱鍾游詹胡施沈余趙盧梁顏柯孫魏翁戴范方宋鄧杜傅侯曹薛丁卓阮馬董溫唐藍石陸金童紀歐巫韓白涂尤龔嚴文黎孔".split(""));
  const SURNAME = new Set(("趙錢孫李周吳鄭王馮陳褚衛蔣沈韓楊朱秦尤許何呂施張孔曹嚴華金魏陶姜戚謝鄒喻柏竇章雲蘇潘葛奚范彭郎魯韋昌馬苗鳳花俞任袁柳酆鮑史唐費廉岑薛雷賀倪湯滕殷羅畢郝安樂于時傅皮卞齊康伍余元卜顧孟平黃穆蕭尹姚邵湛汪祁毛狄米貝明臧伏成戴談宋茅龐熊紀舒屈項祝董梁杜阮藍閔席季麻強賈婁江童顏郭梅盛林刁鍾徐邱駱高夏蔡田樊胡凌霍虞萬柯管盧莫房裘繆解應宗丁宣鄧郁單杭洪包左石崔吉鈕龔程嵇邢裴陸榮翁荀羊惠甄封芮儲靳邴松井段富焦巴弓侯山谷車宮寧仇甘厲戎祖武符劉景詹束龍葉幸司郜黎薄印白懷蒲邰鄂賴屠池喬陰胥蒼聞莘黨翟譚勞姬申扶堵冉宰雍桑桂濮牛壽邊扈燕冀浦尚溫莊晏柴瞿閻慕連茹宦艾容向古易慎戈廖庾暨居衡步都耿滿弘匡國寇廣祿闕東歐殳沃利蔚越隆鞏聶晁敖冷辛那簡饒空曾毋沙養鞠豐巢關蒯查荊游竺權蓋桓涂").split(""));
  const COMPOUND = new Set(["歐陽","司馬","上官","諸葛","東方","夏侯","皇甫","尉遲","公孫","慕容","令狐","宇文","長孫","司徒","司空","端木","呼延","東郭","西門","南宮","鍾離","閭丘","司寇","百里","澹臺"]);
  const GIVEN = new Set(("家明華志偉建文玉秀英惠美麗芳淑雅婷婉玲芬珍君佳宜欣庭涵昕宇軒翔傑豪誠賢銘宏弘峰峯全安定泰光亮輝煌俊彥哲睿智慧敏靜怡潔貞芸筠筑妍嫣蓉蓮荷菁萱蕙蘭若芊芃苡茜荃莉菲萍葳蓁薇曉晨晴昱昭昀春秋冬雪霜霞虹星辰恩慈愛仁義禮信忠孝廉勤儉謙和康健樂喜福祿壽貴富榮昌隆盛興旺發順利吉祥瑞麟龍鳳鵬鴻鶴燕鶯駿麒珊琳琪瑤瑩璇璐瑋瑄珮玥琛瑀璟瓊碧翠青藍紫紅丹皓皎素純清淨澄淵濤瀚泓洋波沛沂沁汪治洲浩淞淮淇添湘漢潤澤濟火炎煒熙熹燁燦岳峻崇嵐磊磐鑫鈺銓鋒鋼鎧鎮鐘楨榕楓樺松柏桐梧桂樟樑棟權亨庭于萱婕妤芯昀祐佑宸睿翊翎翰穎馨蕓寧慶維綺綾緣澐潼霈霏靈鵑駒騰麗黛黎鴻麒麟娜妮婭玫蕾芯茵苓菱棻嵐妃嬅妤婕娟娥媛嬌姍姵妘姿倩儀億凱勛勳卉卿吟呈哲堯培士媗嫻宛容尉屏峮崴嵩廷弈彤彬得心怡恆愷憲懿承政敦斌昇昶晉暐曜杰枝柔栩桓梓棠楷樂欽毅浤淳為玨琇琚琦琴瑛瑀璞皆盈眉睿祺禎穆綸緯繁翌翔耀肇臻致舜芃苹茗荏莘菀萬葦蓉蔚蕎薰藝蘋衡裕豫貫赫軒逸邦郁鈞銳鋐鏵鐿闓陶雋雯霖靖韶頌顥飛駿騏鵬麒").split(""));
  const FUNC = new Set("的是在有和與了也就都而及或但因所為之於其此該這那們你我他她它又再已未不沒很太最更並且若則即乃呢嗎吧啊呀喔得地個把被將對從向往到由關至能會可要想說看見來去做用需應讓使每各某些多少幾何如任本次上下前後左右內外中間時".split(""));
  const NONNAME = new Set("病症科院部室房床藥針血尿便痛熱燒腫炎癌瘤手術診療檢查治護士生員者人民國歲天日月年時分秒號樓段巷弄路街區里鄉鎮縣市省".split(""));
  const WHITELIST = new Set(["高血壓","高血糖","高燒","高度","高危","高階","高峰","高效","高溫","高齡","高頻","高中","高興","高於","白血球","白蛋白","白內障","白天","白色","白斑","白帶","白袍","白喉","黃疸","黃斑","黃色","黃體","黃金","方面","方向","方式","方法","方案","方便","方形","方能","方可","成人","成功","成分","成長","成熟","成年","成效","成因","成像","成為","成果","康復","健康","常見","常規","平常","正常","異常","通常","經常","日常","非常","常常","樂觀","樂於","平均","平穩","平時","平衡","平面","平臺","平滑","平板","平和","平靜","毛髮","毛囊","毛細","毛巾","石膏","石化","結石","膽石","腎石","石灰","費用","免費","收費","自費","顏色","顏面","包括","包含","包紮","包覆","包膜","麵包","文獻","文件","文字","論文","文化","文章","文明","國家","國際","國內","國小","國中","國立","利用","利尿","有利","銳利","便利","順利","權利","沙門","泥沙","董事","於是","由於","關於","對於","至於","終於","基於","鑑於","處於","位於","時間","時候","時期","時常","小時","隨時","應該","反應","適應","供應","效應","答應","應用","相應","華人","中華","華麗","水腫","水分","水泡","積水","脫水","水平","水準","洪水","雲端","車禍","車輛","汽車","機車","停車","車程","山區","山谷","火山","谷底","何時","何處","任何","幾何","如何","為何","金屬","金額","資金","現金","黃金","金黃","獎金","租金","佣金","明顯","明確","說明","證明","光明","透明","聲明","發明","表明","明白","明天","明年","周邊","旁邊","兩邊","邊界","邊緣","特別","分別","個別","區別","差別","性別","級別","類別","識別","別的","充分","充血","補充","充足","擴充","充滿","空氣","空間","空腹","太空","真空","空腔","空白","冷卻","冷凍","寒冷","冰冷","冷氣","冷汗","相關","相同","相對","相互","相似","互相","真相","照相","相片","相當","相比","公司","公斤","公分","公克","公升","辦公","公共","公園","公里","公開","公式","老公","公務","溫度","氣溫","體溫","保溫","低溫","高溫","溫和","溫水","唐氏","歐美","歐洲","藍色","藍圖","元素","元件","單元","元旦","公元","施行","實施","措施","設施","江河","呂宋","武器","武力","謝謝","感謝","答謝","許多","許可","也許","少許","准許","賴以","曾經","未曾","不曾","顧慮","照顧","顧客","回顧","兼顧","孟加","嚴重","嚴格","尊嚴","嚴謹","孔洞","毛孔","鼻孔","面孔","黎明","潘朵","史丹","歷史","史上"]);
  const ANCHOR_RE = /(姓名|病患|病人|患者|家屬|主訴|訴稱|表示|自述|陳述|受檢者|受試者|個案|案主|聯絡人|通報人|報告人|醫師|護理師|主治|經辦|承辦)/;
  const TITLE_RE = /^(先生|小姐|女士|太太|醫師|醫生|護理師|老師|主任|教授|同學|經理|主管|總經理|董事長|君)/;
  const FIELD_RE = /(姓名|病患姓名|病人姓名|患者姓名|受檢者)[\s:：]*([\u4e00-\u9fa5]{2,4})/g;

  function detectNames(text, threshold){
    const res=[]; const isHan=ch=>ch&&/[\u4e00-\u9fa5]/.test(ch); const N=text.length; let i=0;
    while(i<N){
      const c=text[i]; let sname=null, slen=0;
      const two=text.substr(i,2);
      if(COMPOUND.has(two)){ sname=two; slen=2; } else if(SURNAME.has(c)){ sname=c; slen=1; }
      if(sname){
        const before=text.substring(Math.max(0,i-6),i);
        const g1=text[i+slen], g2=text[i+slen+1];
        const cands=[];
        if(isHan(g1)&&isHan(g2)) cands.push(slen+2);
        if(isHan(g1)) cands.push(slen+1);
        let best=null;
        for(const L of cands){
          const span=text.substr(i,L); const givens=span.slice(slen).split("");
          if(WHITELIST.has(span)) continue;
          if(WHITELIST.has(text.substr(i,L+1))) continue;
          if(givens.some(ch=>FUNC.has(ch)||NONNAME.has(ch))) continue;
          const isCompound=slen===2;
          let score=isCompound?4:(COMMON_SUR.has(sname)?2:1), givenHit=0;
          for(const ch of givens){ if(GIVEN.has(ch)){ score+=2; givenHit++; } }
          const after=text.substr(i+L,2);
          const hasTitle=TITLE_RE.test(after), hasAnchor=ANCHOR_RE.test(before);
          if(hasAnchor) score+=3; if(hasTitle) score+=3;
          if(givenHit===0 && !hasAnchor && !hasTitle && !isCompound) continue;
          if(score>=threshold){
            // confidence: strong if field/anchor/title/compound/two given-char hits; else low (疑義)
            const conf=(hasAnchor||hasTitle||isCompound||givenHit>=2)?'high':'low';
            best={start:i,end:i+L,value:span,conf}; break;
          }
        }
        if(!best){
          const after=text.substr(i+slen,2);
          if(TITLE_RE.test(after) && (COMMON_SUR.has(sname)||ANCHOR_RE.test(before)))
            best={start:i,end:i+slen,value:sname,conf:'high'};
        }
        if(best){ res.push(best); i=best.end; continue; }
      }
      i++;
    }
    let m; while((m=FIELD_RE.exec(text))){
      const gv=m[2]; const st=m.index+m[0].lastIndexOf(gv);
      if(!res.some(r=>r.start<st+gv.length && st<r.end)) res.push({start:st,end:st+gv.length,value:gv,conf:'high'});
    }
    return res;
  }

  /* ---------- ID + chart ---------- */
  function twIdChecksum(id){
    id=id.toUpperCase(); if(!/^[A-Z][12]\d{8}$/.test(id)) return false;
    const map={A:10,B:11,C:12,D:13,E:14,F:15,G:16,H:17,I:34,J:18,K:19,L:20,M:21,N:22,O:35,P:23,Q:24,R:25,S:26,T:27,U:28,V:29,W:32,X:30,Y:31,Z:33};
    const n=map[id[0]]; const d=[Math.floor(n/10),n%10,...id.slice(1).split("").map(Number)]; const w=[1,9,8,7,6,5,4,3,2,1,1];
    let s=0; for(let i=0;i<11;i++) s+=d[i]*w[i]; return s%10===0;
  }
  function detectTwid(text,opts){
    const out=[]; const re=/[A-Za-z][12]\d{8}/g; let m;
    while((m=re.exec(text))){ const v=m[0]; if(opts.checksum&&!twIdChecksum(v)) continue; out.push({start:m.index,end:m.index+v.length,value:v}); }
    return out;
  }
  function detectChart(text){
    const out=[]; const re=/(病歷號碼|病歷號|門診號|住院號|病人代號|chart\s?no\.?|HN)[\s:：#＃]*([A-Za-z]?\d{4,10})/gi; let m;
    while((m=re.exec(text))){ const idx=m.index+m[0].lastIndexOf(m[2]); out.push({start:idx,end:idx+m[2].length,value:m[2]}); }
    return out;
  }
  function detectDate(text, keepRecent){
    const out=[]; let m;
    const cutoff=new Date(); cutoff.setFullYear(cutoff.getFullYear()-1); // 一年前
    const recent=(y,mo,d)=>{ // true 表示「距今一年內」→ 保留、不遮
      const dt=new Date(y,mo-1,d);
      return !isNaN(dt) && dt>=cutoff;
    };
    const push=(idx,val,y,mo,d)=>{ if(keepRecent && recent(y,mo,d)) return; out.push({start:idx,end:idx+val.length,value:val}); };
    let r;
    const re1=/(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/g;      // YYYYMMDD
    while((r=re1.exec(text))){ const v=r[0]; push(r.index,v,+v.slice(0,4),+v.slice(4,6),+v.slice(6,8)); }
    const re2=/((?:19|20)\d{2})([\/\-.])(\d{1,2})\2(\d{1,2})/g;               // Y/M/D
    while((r=re2.exec(text))){ const mo=+r[3],d=+r[4]; if(mo>=1&&mo<=12&&d>=1&&d<=31) push(r.index,r[0],+r[1],mo,d); }
    const re3=/(?:民國|西元)?\s?(\d{2,4})\s?年\s?(\d{1,2})\s?月\s?(\d{1,2})\s?日/g; // 中文年月日
    while((r=re3.exec(text))){ let y=+r[1]; if(y<200) y+=1911; push(r.index,r[0],y,+r[2],+r[3]); }
    return out;
  }
  function detectLongNum(text,min,excludeDates){
    const out=[]; const re=new RegExp(`\\d{${min},}`,'g'); let m;
    const isDate=s=>/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(s);
    while((m=re.exec(text))){
      if(excludeDates && isDate(m[0])) continue; // 讓日期規則處理，不重複當數字ID
      out.push({start:m.index,end:m.index+m[0].length,value:m[0],conf:'low'});
    }
    return out;
  }

  const CATS = {
    name:{label:'姓名', color:'#d6336c'},
    twid:{label:'身分證', color:'#c92a2a'},
    chart:{label:'病歷號', color:'#0e8a8a'},
    date:{label:'日期', color:'#546274'},
    longnum:{label:'數字ID', color:'#0a7cbf'},
    custom:{label:'自訂', color:'#7d3ac1'},
  };

  /* ---------- State ---------- */
  const state={files:[],results:[],activeIdx:0,view:'redacted',mode:'label',threshold:3,minDigits:6,markDoubt:false,wrap:true};

  /* ---------- File handling ---------- */
  const drop=document.getElementById('drop'), fileInput=document.getElementById('fileInput');
  drop.onclick=()=>fileInput.click();
  ['dragover','dragenter'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('hot');}));
  ['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('hot');}));
  drop.addEventListener('drop',ev=>addFiles(ev.dataTransfer.files));
  fileInput.addEventListener('change',ev=>addFiles(ev.target.files));
  function fileType(f){ return (f.type==='application/pdf'||/\.pdf$/i.test(f.name))?'pdf':((f.type==='text/plain'||/\.txt$/i.test(f.name))?'txt':null); }
  function addFiles(list){
    for(const f of list){ const t=fileType(f); if(t && !state.files.some(x=>x.name===f.name&&x.size===f.size)) state.files.push(f); }
    renderFileList(); updateRunBtn();
  }
  function renderFileList(){
    const ul=document.getElementById('fileList');
    ul.innerHTML=state.files.map((f,i)=>`<li><span class="tag">${fileType(f).toUpperCase()}</span><span class="fn" title="${escapeAttr(f.name)}">${escapeHtml(f.name)}</span><span class="st">${(f.size/1024).toFixed(0)} KB</span><button class="rm" data-i="${i}" title="移除">×</button></li>`).join('');
    ul.querySelectorAll('.rm').forEach(b=>b.onclick=()=>{state.files.splice(+b.dataset.i,1);renderFileList();updateRunBtn();});
  }
  function pasteText(){ return document.getElementById('pasteBox').value; }
  function updateRunBtn(){
    const btn=document.getElementById('runBtn'),lbl=document.getElementById('runLabel');
    const nf=state.files.length, hasPaste=pasteText().trim().length>0;
    const total=nf+(hasPaste?1:0);
    if(total){btn.disabled=false;lbl.textContent=`開始去識別化（${total} 個項目）`;}
    else{btn.disabled=true;lbl.textContent='請先選擇檔案或貼上文字';}
  }
  document.getElementById('pasteBox').addEventListener('input',updateRunBtn);

  /* ---------- Controls ---------- */
  document.querySelectorAll('.modes .opt').forEach(o=>o.onclick=()=>{
    document.querySelectorAll('.modes .opt').forEach(x=>x.classList.remove('on'));
    o.classList.add('on'); state.mode=o.dataset.mode;
    if(state.results.length){ recompute(); renderActive(); }
  });
  document.querySelectorAll('#sens button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#sens button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); state.threshold=+b.dataset.th;
  });
  document.querySelectorAll('#minDigits button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#minDigits button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); state.minDigits=+b.dataset.n;
  });

  /* ---------- Read files ---------- */
  async function extractPdf(file){
    const buf=await file.arrayBuffer(); const pdf=await PDFJS.getDocument({data:buf}).promise; let full='';
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p); const content=await page.getTextContent();
      let lastY=null,line='',parts=[];
      for(const it of content.items){
        const y=it.transform[5];
        if(lastY!==null && Math.abs(y-lastY)>2){ parts.push(line); line=''; }
        line+=it.str;
        if(it.hasEOL){ parts.push(line); line=''; lastY=null; } else lastY=y;
      }
      if(line) parts.push(line);
      full+=parts.join('\n'); if(p<pdf.numPages) full+='\n\n';
    }
    return full;
  }
  function readTxt(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsText(file,'utf-8'); }); }

  /* ---------- Run ---------- */
  document.getElementById('runBtn').onclick=run;
  async function run(){
    const btn=document.getElementById('runBtn'),lbl=document.getElementById('runLabel');
    btn.disabled=true; lbl.innerHTML='<span class="spinner"></span> 處理中…';
    state.results=[];
    const opts={
      name:document.getElementById('rule_name').checked,
      twid:document.getElementById('rule_twid').checked,
      chart:document.getElementById('rule_chart').checked,
      date:document.getElementById('rule_date').checked,
      longnum:document.getElementById('rule_longnum').checked,
      checksum:document.getElementById('optChecksum').checked,
      keepRecent:document.getElementById('optKeepRecent').checked,
      markDoubt:document.getElementById('optMarkDoubt').checked,
      threshold:state.threshold,
      minDigits:state.minDigits,
    };
    state.markDoubt=opts.markDoubt;
    const customs=document.getElementById('customTerms').value.split(/[\n,，]/).map(s=>s.trim()).filter(Boolean);
    for(const f of state.files){
      const t=fileType(f); let raw='';
      try{ raw = t==='pdf' ? await extractPdf(f) : await readTxt(f); }
      catch(e){ state.results.push({name:f.name,error:'讀取失敗（檔案可能損毀）'}); continue; }
      if(t==='pdf' && !raw.trim()){ state.results.push({name:f.name,error:'此 PDF 無可擷取文字層（可能為掃描影像，需 OCR）。'}); continue; }
      state.results.push({name:f.name, raw, matches:findMatches(raw,opts,customs)});
    }
    const pasted=pasteText();
    if(pasted.trim()){ state.results.push({name:'貼上文字', raw:pasted, matches:findMatches(pasted,opts,customs)}); }
    state.activeIdx=0; recompute(); renderResults();
    btn.disabled=false; updateRunBtn();
  }

  function findMatches(text,opts,customs){
    let all=[];
    if(opts.name)    detectNames(text,opts.threshold).forEach(r=>all.push({...r,key:'name'}));
    if(opts.twid)    detectTwid(text,opts).forEach(r=>all.push({...r,key:'twid'}));
    if(opts.date)    detectDate(text,opts.keepRecent).forEach(r=>all.push({...r,key:'date'}));
    if(opts.chart)   detectChart(text).forEach(r=>all.push({...r,key:'chart'}));
    if(opts.longnum) detectLongNum(text,opts.minDigits,opts.date).forEach(r=>all.push({...r,key:'longnum'}));
    customs.forEach(term=>{
      const re=new RegExp(escapeRegex(term),'g'); let m;
      while((m=re.exec(text))){ if(m.index===re.lastIndex) re.lastIndex++; all.push({start:m.index,end:m.index+term.length,value:term,key:'custom'}); }
    });
    // priority when spans overlap: custom > twid > date > chart > longnum > name
    const pr={custom:0,twid:1,date:2,chart:3,longnum:4,name:5};
    all.sort((a,b)=> a.start-b.start || pr[a.key]-pr[b.key] || (b.end-b.start)-(a.end-a.start));
    const kept=[]; let lastEnd=-1;
    for(const m of all){ if(m.start>=lastEnd){ kept.push(m); lastEnd=m.end; } }
    return kept;
  }

  /* ---------- Replacement ---------- */
  function recompute(){
    const md=state.markDoubt!==false;
    state.results.forEach(res=>{
      if(res.error) return;
      const counters={},mapping={};
      res.replaced=build(res.raw,res.matches,state.mode,counters,mapping,md);
      const c={}; res.matches.forEach(m=>{const lab=CATS[m.key].label; c[lab]=c[lab]||{n:0,color:CATS[m.key].color}; c[lab].n++;}); res.counts=c;
      res.doubt=res.matches.filter(m=>m.conf==='low').length;
    });
  }
  function tok(m,mode,counters,mapping,md){
    const lab=CATS[m.key].label; const q=(md && m.conf==='low')?'?':'';
    if(mode==='label') return `[${lab}${q}]`;
    const mk=lab+'||'+m.value; if(mapping[mk]) return mapping[mk];
    counters[lab]=(counters[lab]||0)+1; const t=`[${lab}_${String(counters[lab]).padStart(2,'0')}${q}]`; mapping[mk]=t; return t;
  }
  function build(text,matches,mode,counters,mapping,md){
    let out='',cur=0; for(const m of matches){ out+=text.slice(cur,m.start)+tok(m,mode,counters,mapping,md); cur=m.end; } return out+text.slice(cur);
  }

  /* ---------- Render ---------- */
  function renderResults(){
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultBody').classList.remove('hidden');
    const tabs=document.getElementById('fileTabs');
    if(state.results.length>1){
      tabs.classList.remove('hidden');
      tabs.innerHTML=state.results.map((r,i)=>`<button data-i="${i}" class="${i===state.activeIdx?'on':''}" title="${escapeAttr(r.name)}">${escapeHtml(r.name)}</button>`).join('');
      tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{state.activeIdx=+b.dataset.i;renderActive();tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));});
    } else tabs.classList.add('hidden');
    renderActive();
  }
  function renderActive(){
    const res=state.results[state.activeIdx];
    const tally=document.getElementById('tally'),view=document.getElementById('docView'),trunc=document.getElementById('truncNote');
    trunc.classList.add('hidden');
    if(res.error){ tally.innerHTML=`<span class="chip" style="color:var(--warn)">⚠ ${escapeHtml(res.error)}</span>`; view.innerHTML='<span style="color:var(--muted)">（無內容）</span>'; return; }
    const entries=Object.entries(res.counts), total=entries.reduce((s,[,v])=>s+v.n,0);
    tally.innerHTML=`<span class="chip total">共遮蔽 <span class="n">${total}</span> 項</span>`+
      (entries.length?entries.map(([lab,v])=>`<span class="chip"><span class="dot" style="background:${v.color}"></span>${escapeHtml(lab)}<span class="n">${v.n}</span></span>`).join(''):`<span class="chip" style="color:var(--muted)">未偵測到符合規則的個資</span>`)+
      ((state.markDoubt!==false && res.doubt)?`<span class="chip" style="background:var(--warn-soft);color:var(--warn);border-color:#f0e2c2"><span class="dot" style="background:#c99a00"></span>疑義 <span class="n" style="color:var(--warn)">${res.doubt}</span></span>`:'');
    const LIMIT=60000;
    if(state.view==='redacted'){
      let t=res.replaced;
      if(t.length>LIMIT){ view.innerHTML=hlTokens(t.slice(0,LIMIT)); showTrunc(trunc,t.length,LIMIT); } else view.innerHTML=hlTokens(t);
    } else {
      const h=hlOriginal(res.raw,res.matches,LIMIT); view.innerHTML=h.html; if(h.truncated) showTrunc(trunc,res.raw.length,LIMIT);
    }
    view.scrollTop=0;
  }
  function showTrunc(el,total,limit){ el.classList.remove('hidden'); el.textContent=`預覽已截斷（顯示前 ${limit.toLocaleString()} 字，全文共 ${total.toLocaleString()} 字）。下載的 TXT 為完整內容。`; }
  function hlTokens(text){ return escapeHtml(text).replace(/\[[^\]\[\n]{1,14}?\]/g,m=>{
    const doubt=/\?\]$/.test(m);
    return `<span class="redtoken"${doubt?' style="background:#fbf1dc;color:#9a6b00"':''}>${m}</span>`;
  }); }
  function hlOriginal(text,matches,limit){
    let html='',cur=0,truncated=false;
    for(const m of matches){
      if(m.start>=limit){truncated=true;break;}
      html+=escapeHtml(text.slice(cur,m.start));
      const col=CATS[m.key].color, end=Math.min(m.end,limit);
      const doubt=(state.markDoubt!==false && m.conf==='low');
      const style=doubt
        ? `background:${hexA('#c99a00',.18)};border-bottom:2px dashed #c99a00`
        : `background:${hexA(col,.22)};box-shadow:inset 0 -2px 0 ${col}`;
      const tip=doubt?`${CATS[m.key].label}（疑義，請人工確認）`:CATS[m.key].label;
      html+=`<mark title="${tip}" style="${style}">${escapeHtml(text.slice(m.start,end))}</mark>`;
      cur=m.end; if(m.end>limit){truncated=true;break;}
    }
    if(!truncated){ html+=escapeHtml(text.slice(cur,Math.min(text.length,limit))); if(text.length>limit) truncated=true; }
    return {html,truncated};
  }

  document.getElementById('viewRedacted').onclick=()=>setView('redacted');
  document.getElementById('viewHighlight').onclick=()=>setView('highlight');
  document.getElementById('wrapOn').onclick=()=>setWrap(true);
  document.getElementById('wrapOff').onclick=()=>setWrap(false);
  function setWrap(on){
    state.wrap=on;
    document.getElementById('wrapOn').classList.toggle('on',on);
    document.getElementById('wrapOff').classList.toggle('on',!on);
    document.getElementById('docView').classList.toggle('nowrap',!on);
  }
  function setView(v){ state.view=v; document.getElementById('viewRedacted').classList.toggle('on',v==='redacted'); document.getElementById('viewHighlight').classList.toggle('on',v==='highlight'); renderActive(); }

  document.getElementById('selAll').onclick=()=>{
    if(state.view!=='redacted') setView('redacted');
    const el=document.getElementById('docView');
    const sel=window.getSelection(); sel.removeAllRanges();
    const range=document.createRange(); range.selectNodeContents(el); sel.addRange(range);
  };
  document.getElementById('copyBtn').onclick=async()=>{
    const res=state.results[state.activeIdx]; if(!res||res.error) return;
    const btn=document.getElementById('copyBtn'), old=btn.textContent;
    const done=()=>{ btn.textContent='已複製 ✓'; setTimeout(()=>btn.textContent=old,1400); };
    try{ await navigator.clipboard.writeText(res.replaced); done(); }
    catch(e){
      const ta=document.createElement('textarea'); ta.value=res.replaced;
      ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta);
      ta.select(); try{ document.execCommand('copy'); done(); }catch(_){ btn.textContent='請手動複製'; setTimeout(()=>btn.textContent=old,1400); }
      document.body.removeChild(ta);
    }
  };
  document.getElementById('dlOne').onclick=()=>{ const res=state.results[state.activeIdx]; if(res.error) return; download(res.name.replace(/\.(pdf|txt)$/i,'')+'_deid.txt',res.replaced); };
  document.getElementById('dlAll').onclick=()=>{ const parts=state.results.map(r=>r.error?`===== ${r.name} =====\n[${r.error}]\n`:`===== ${r.name} =====\n${r.replaced}`); download('deidentified_all.txt',parts.join('\n\n\n')); };
  function download(name,content){ const blob=new Blob([content],{type:'text/plain;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }

  function escapeHtml(s){return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
  function escapeAttr(s){return s.replace(/"/g,'&quot;');}
  function escapeRegex(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function hexA(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;}
})();
