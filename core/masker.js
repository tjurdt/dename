(function (g) {
  'use strict';
  const data = g.OOOSurnames || (typeof require === 'function' ? require('./surnames.js') : null);
  const nameData = g.OOONameData || (typeof require === 'function' ? require('./namedata.js') : null);
  const surnames = [...data.records].sort((a,b)=>b.name.length-a.name.length || a.rank-b.rank);
  const byFirst = new Map();
  for (const row of surnames) {
    const first = Array.from(row.name)[0];
    if (!byFirst.has(first)) byFirst.set(first, []);
    byFirst.get(first).push(row);
  }
  const LABEL = '(?:(?:病人|患者|個案|住民|客戶|員工|申請人|聯絡人)?(?:姓名|名字)|\\b(?:patient[\\s_-]*name|full[\\s_-]*name|name)\\b)';
  const labelExact = new RegExp('^'+LABEL+'[\\s:：*]*$', 'iu');
  // Frequency hints and exclusions come from namedata.js, which records its sources.
  const givenChars = nameData.hintChars;
  const strongGiven = nameData.strongGiven;
  const commonWords = new Set(nameData.commonWords);
  // Roles and honorifics. A person's name very often sits immediately after one of these
  // ("生策會會長楊泮池"), or immediately before one ("楊泮池院長"), so both sides count.
  const ROLE = '董事長|理事長|執行長|秘書長|副院長|院長|校長|會長|所長|處長|署長|局長|廳長|司長|課長|組長|科長|站長|廠長|館長|艦長|隊長|班長|股長|部長|次長|市長|縣長|里長|護理長|督導長|技術長|財務長|營運長|學務長|教務長|總務長|研發長|主委|主席|委員|議員|立委|總統|副總統|行政院長|部主任|主任|經理|總監|執行秘書|發言人|創辦人|負責人|理事|董事|顧問|教練|隊醫|藥師|營養師|治療師|社工師|心理師|檢驗師|放射師|技術員|實習生|住院醫師|主治醫師|總醫師|醫師|醫生|護理師|護士|教授|副教授|助理教授|講師|老師|同學|先生|小姐|女士';
  const title = new RegExp('^(?:'+ROLE+')', 'u');
  const rolePrefix = new RegExp('(?:'+ROLE+')[\\s:：]*$', 'u');
  // UI words and productive non-person terms: these veto guesses, never explicit name fields.
  const organization = /^(?:海宣|宣傳|公關|人事|行政|企劃|行銷|研發|客服|資訊|新聞|總務|財務|業務|教務|學務|招生|招募)(?:部|組|處|科|室|局|中心|小組|部門|單位)/u;
  const humanFollowing = /^(?:先生|小姐|女士|醫師|醫生|護理師|教授|老師|同學|主任|院長|表示|說|提到|回覆|回答|詢問|請|負責|協助|整理|處理|確認|提供|聯絡|聯繫|參加|出席|分享|回報|收到|寄出|完成|同意|不同意|今天|今日|昨天|昨日|明天|主訴|入院|出院|住院|就診|回診|到院|來電|簽名|的|與|和|及)/u;
  const referencePrefix = new RegExp('(?:病人|患者|個案|住民|家屬|聯絡人|同事|朋友|請|找|問|由|向|跟|與|和|給|及|讓|替|幫|對|交給|感謝|通知|聯繫|聯絡|詢問|收到|'+ROLE+')[\\s:：]*$','u');
  const aliasFollowing = /^(?:是|會|要|已|正在|也|則|曾|將|能|可以|希望|安排|參與|討論|負責|需要|有|沒有|不|在|到|去|來|已經|準備|預計|預定|認為|覺得|建議|提醒|交代|帶來|送來)/u;
  const singleFollowing = /^(?:先生|小姐|女士|醫師|醫生|護理師|教授|老師|同學|主任|院長|表示|說|提到|回覆|回答|詢問|負責|協助|參加|出席|回報|寄出|同意|不同意|主訴|入院|出院|住院|就診|回診|來電|簽名)/u;
  const personPrefix = new RegExp('(?:病人|患者|個案|住民|聯絡人|申請人|訪客|家屬|'+ROLE+')[\\s:：]*$','u');
  const following = /^(?:今天|今日|昨天|昨日|表示|主訴|因為|因|於|已|目前|前來|接受|入院|出院|住院|就診|回診|到院|到診|先生|小姐|女士|醫師|醫生|護理師|教授|老師|同學|主任|院長|的|與|和|及|說|來電|簽名)/u;
  const grammar = /[的了在是有和與及或但而也就都很將把被請從到於為者後前]/u;
  const placeholders = new Set(['姓名','名字','病人姓名','患者姓名','未知','不詳','無名氏','未填寫','請輸入姓名','Name','Patient Name','診斷','病歷號','床號','年齡','性別','生日','身分證號','病房病床','科別','入院日','出生日']);
  // Parse hospital annotations without changing string offsets or removing other Latin text.
  // Horizontal whitespace includes normal, non-breaking, narrow and full-width spaces.
  const HS='[^\\S\\r\\n]';
  const markPrefix='(?:D'+HS+'*@?|@'+HS+'*D?)';
  const prefixBoundary=new RegExp('(?:^|[^\\p{Letter}\\p{Number}])'+markPrefix+HS+'*$','u');
  const suffixBoundary=new RegExp('^[HI](?:'+HS+'*[HI])?(?=$|[^\\p{Letter}\\p{Number}])','u');
  const leadingMarker=new RegExp('^'+HS+'*'+markPrefix+HS+'*(?=\\p{Script=Han})','u');
  const markedField=new RegExp('^('+HS+'*(?:'+markPrefix+HS+'*)?)([\\p{Script=Han}·・．]{2,30})((?:'+HS+'*[HI]){0,2}'+HS+'*)$','u');
  function fieldNameSpan(text) {
    const m=text.match(markedField);
    return m?{start:m[1].length,end:m[1].length+m[2].length,name:m[2]}:null;
  }
  function leftNameBoundary(left) {return !left||!/[\p{Letter}\p{Number}]$/u.test(left)||prefixBoundary.test(left);}
  function rightNameBoundary(right) {return !right||!/^[\p{Letter}\p{Number}]/u.test(right)||suffixBoundary.test(right);}
  function opts(o={}) {
    return {...o,surnameLimit:o.surnameLimit===100?100:500,
      mrnMode:['checked','custom'].includes(o.mrnMode)?o.mrnMode:'all',
      mrnPatterns:Array.isArray(o.mrnPatterns)?o.mrnPatterns.slice(0,20):[],mrnKeepDefault:o.mrnKeepDefault!==false,
      mrnExcludeDates:o.mrnExcludeDates!==false,now:typeof o.now==='number'?o.now:Date.now(),
      dateMode:['all','labelled'].includes(o.dateMode)?o.dateMode:'unlabelled',
      replacement:String(o.replacement||'OOO').slice(0,12),
      rules:{nationalId:true,names:true,medicalRecordNumber:true,birthDate:true,...o.rules}};
  }
  // Built-in record-number format: 6 to 8 plain digits. An 8-digit value must satisfy a
  // weighted check digit, which is what separates it from an 8-digit date like 20240115.
  // Sites using another format can supply their own patterns instead (see patternRegex).
  const MRN_WEIGHTS=[7,6,5,4,3,2,1];
  function mrnCheckDigit(digits) {
    let sum=0;
    for(let i=0;i<7;i++)sum+=(digits.charCodeAt(i)-48)*MRN_WEIGHTS[i];
    return sum%10;
  }
  function isMedicalRecordNumber(value,mode='all') {
    const s=String(value||'');
    if(!/^\d{6,8}$/.test(s))return false;
    if(s.length===8)return mrnCheckDigit(s)===s.charCodeAt(7)-48;
    return mode!=='checked';
  }
  function isCustomFormat(value,patterns=[]) {
    return patterns.some(p=>{
      const e=patternRegex(p);
      if(!e)return false;
      e.lastIndex=0;
      const m=e.exec(String(value||''));
      return !!m&&m[0].length===String(value||'').length;
    });
  }
  // Reject digit runs that are part of a decimal or thousand-separated number.
  function plainNumber(text,start,end) {
    return !/\d[.,]$/.test(text.slice(Math.max(0,start-2),start))&&!/^[.,]\d/.test(text.slice(end,end+2));
  }
  // A digit run that reads as a real calendar date close to today is far more likely to be
  // a date than a record number, so it is excluded even when it satisfies the check digit.
  // Handles YYYYMMDD, ROC YYYMMDD and YYMMDD. Window is in whole days around today.
  const DAY=86400000,PAST_DAYS=183,FUTURE_DAYS=31;
  function isRecentDate(digits,now=Date.now(),pastDays=PAST_DAYS,futureDays=FUTURE_DAYS) {
    const s=String(digits||'');
    let year,month,day;
    if(s.length===8){year=+s.slice(0,4);month=+s.slice(4,6);day=+s.slice(6,8);}
    else if(s.length===7){year=+s.slice(0,3)+1911;month=+s.slice(3,5);day=+s.slice(5,7);}
    else if(s.length===6){year=2000+ +s.slice(0,2);month=+s.slice(2,4);day=+s.slice(4,6);}
    else return false;
    const date=new Date(Date.UTC(year,month-1,day));
    // Rejects impossible dates such as 20260230, which stay eligible as record numbers.
    if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return false;
    const today=new Date(now);
    const midnight=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
    const delta=(date.getTime()-midnight)/DAY;
    return delta<=futureDays&&delta>=-pastDays;
  }
  // User-defined formats: # is any digit, A any letter, * either; anything else is literal.
  const patternCache=new Map();
  function patternRegex(pattern) {
    if(patternCache.has(pattern))return patternCache.get(pattern);
    const chars=Array.from(String(pattern||'').trim());
    let compiled=null;
    if(chars.length>=4&&chars.length<=32) {
      const body=chars.map(c=>c==='#'?'\\d':c==='A'?'[A-Za-z]':c==='*'?'[A-Za-z0-9]':c.replace(/[.*+?^${}()|[\]\\-]/g,'\\$&')).join('');
      try {compiled=new RegExp('(?<![A-Za-z0-9])'+body+'(?![A-Za-z0-9])','g');} catch {compiled=null;}
    }
    patternCache.set(pattern,compiled);
    return compiled;
  }
  function isSensitiveNameLabel(v) {return labelExact.test(String(v||'').replace(/([a-z])([A-Z])/g,'$1 $2').trim());}
  // Birth-date labels, for both the field/column test and the nearby-label test.
  const BIRTH = '(?:出生年月日|出生日期|出生年|出生日|出生|生年月日|生日|誕生日|壽星|'
    + '\\bd\\.?o\\.?b\\.?|\\bdate\\s*of\\s*birth\\b|\\bbirth\\s*(?:date|day)\\b|\\bbirthday\\b|\\bborn\\b)';
  const birthExact = new RegExp('^'+BIRTH+'[\\s:：*]*$','iu');
  const birthNearby = new RegExp(BIRTH+'[^\\p{Script=Han}\\d]{0,6}$','iu');
  function isBirthLabel(v) {return birthExact.test(String(v||'').replace(/([a-z])([A-Z])/g,'$1 $2').trim());}

  // Dates. The target is a date of birth, so the accepted window is the last BIRTH_YEARS
  // years up to today: nobody is born in the future, which also spares scheduling dates.
  const BIRTH_YEARS=115;
  const DATE_FORMS=[
    // 民國75年3月2日 / 西元1986年03月02日 / 2025年3月2日
    {re:/(?:(?:民國|民国|西元|公元)[^\S\r\n]{0,2})?(\d{1,4})[^\S\r\n]{0,2}年[^\S\r\n]{0,2}(\d{1,2})[^\S\r\n]{0,2}月[^\S\r\n]{0,2}(\d{1,2})[^\S\r\n]{0,2}日?/gu,kind:'cjk'},
    // 1986/03/02, 75.03.02, 115-03-02 — the separator must be the same on both sides.
    {re:/(?<![\d\p{L}])(?:(?:民國|民国|西元|公元)[^\S\r\n]{0,2})?(\d{1,4})([./-])(\d{1,2})\2(\d{1,4})(?![\d\p{L}])/gu,kind:'sep'},
    // 19860302, 1150302, 750302
    {re:/(?<![\d\p{L}])(?:(?:民國|民国|西元|公元)[^\S\r\n]{0,2})?(\d{6,8})(?![\d\p{L}])/gu,kind:'compact'}
  ];
  function realDate(year,month,day) {
    if(!(month>=1&&month<=12&&day>=1&&day<=31))return null;
    const date=new Date(Date.UTC(year,month-1,day));
    return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date:null;
  }
  function inBirthWindow(date,now) {
    const today=new Date(now);
    const end=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
    const start=Date.UTC(today.getFullYear()-BIRTH_YEARS,today.getMonth(),today.getDate());
    return date.getTime()>=start&&date.getTime()<=end;
  }
  // A 2-digit year is genuinely ambiguous, so every reading that lands in the window counts.
  function yearReadings(raw,era) {
    const n=Number(raw);
    if(raw.length===4)return [n];
    if(era==='roc')return [n+1911];
    if(era==='ce')return [n];
    if(raw.length===3)return [n+1911];
    return [n+1911,n+2000,n+1900];
  }
  // Any ordering may be the local convention (Y/M/D, D/M/Y, M/D/Y). For masking it does
  // not matter which one it is, only that the token reads as a real date in the window.
  function firstValidDate(parts,{era=null,yearFirst=false}={},now=Date.now()) {
    const orders=yearFirst||era?[[0,1,2]]:[[0,1,2],[2,1,0],[2,0,1]];
    for(const [y,m,d] of orders)for(const year of yearReadings(parts[y],era)) {
      const date=realDate(year,Number(parts[m]),Number(parts[d]));
      if(date&&inBirthWindow(date,now))return date;
    }
    return null;
  }
  function dateSpans(text,now=Date.now()) {
    const found=[];
    for(const form of DATE_FORMS) {
      form.re.lastIndex=0;
      for(const m of text.matchAll(form.re)) {
        const era=/民國|民国/.test(m[0])?'roc':(/西元|公元/.test(m[0])?'ce':null);
        let parts,strong;
        if(form.kind==='compact') {
          const digits=m[1];
          if(digits.length===8)parts=[digits.slice(0,4),digits.slice(4,6),digits.slice(6,8)];
          else if(digits.length===7)parts=[digits.slice(0,3),digits.slice(3,5),digits.slice(5,7)];
          else parts=[digits.slice(0,2),digits.slice(2,4),digits.slice(4,6)];
          strong=true;
        } else {
          parts=form.kind==='cjk'?[m[1],m[2],m[3]]:[m[1],m[3],m[4]];
          // Without a 3-4 digit year, an era word or CJK markers, require uniform 2-digit
          // padding; otherwise version strings such as 1.2.3 would read as dates.
          strong=form.kind==='cjk'||!!era||parts.some(part=>part.length>=3);
        }
        const padded=parts.every(part=>part.length===2);
        if(!strong&&!padded)continue;
        // A compact run is always year-first; its era may still be implied by digit count.
        const date=firstValidDate(parts,{era,yearFirst:form.kind==='compact'},now);
        if(date)found.push({start:m.index,end:m.index+m[0].length});
      }
    }
    return found;
  }
  function birthLabelNear(text,start) {return birthNearby.test(text.slice(Math.max(0,start-40),start));}

  // Dates a clinician reads are almost always labelled as what they are, while a date of
  // birth is often bare beside the name and record number. So the default masks a date
  // unless it is labelled as some other kind of date.
  const CLINICAL = '(?:檢驗|檢查|檢體|抽血|採檢|採樣|報告|判讀|入院|出院|住院|轉入|轉出|手術|開刀|麻醉|'
    + '回診|複診|門診|就診|看診|掛號|預約|排程|給藥|用藥|服藥|開立|處方|調劑|領藥|批價|繳費|注射|接種|施打|'
    + '影像|攝影|超音波|切片|培養|收案|追蹤|建檔|建立|登錄|更新|修改|列印|簽章|核准|申請|生效|截止|到期|'
    + '到院|離院|發病|起始|結束|最後|最近|上次|下次|本次|前次|死亡|排定|安排|'
    + '\\bcollect(?:ed|ion)?\\b|\\bresult(?:ed)?\\b|\\breport(?:ed)?\\b|\\badmi(?:t|ssion|tted)\\b|'
    + '\\bdischarge[d]?\\b|\\bsurgery\\b|\\bvisit\\b|\\bappointment\\b|\\bordered?\\b|\\bupdated?\\b|\\bcreated?\\b)';
  const clinicalExact = new RegExp('^'+CLINICAL+'(?:日期|日|時間|時刻|時|年月日|date|time)?[\\s:：*]*$','iu');
  const clinicalNearby = new RegExp(CLINICAL+'(?:日期|日|時間|時刻|時|年月日|[\\s_-]*date|[\\s_-]*time)?[^\\p{Script=Han}\\d]{0,6}$','iu');
  function isClinicalDateLabel(v) {return clinicalExact.test(String(v||'').replace(/([a-z])([A-Z])/g,'$1 $2').trim());}
  function clinicalLabelNear(text,start) {return clinicalNearby.test(text.slice(Math.max(0,start-40),start));}
  function isLikelyStandaloneName(v) {
    const s=String(v||'').trim();
    return /^[\p{Script=Han}·・．]{2,30}$/u.test(s) || /^[A-Za-z][A-Za-z'’.-]*(?:[ \t]+[A-Za-z][A-Za-z'’.-]*){1,5}$/.test(s);
  }
  function surnameOf(s,limit=500) {return (byFirst.get(String.fromCodePoint(s.codePointAt(0)||0))||[]).find(r=>r.rank<=limit&&s.startsWith(r.name));}
  const wordsByFirst=new Map();
  for(const word of commonWords) {
    if(word.length<2)continue;
    if(!wordsByFirst.has(word[0]))wordsByFirst.set(word[0],[]);
    wordsByFirst.get(word[0]).push(word);
  }
  function rejected(s,keepWords=[]) {
    if(organization.test(s)||commonWords.has(s))return true;
    for(const word of wordsByFirst.get(s[0])||[])if(s.startsWith(word))return true;
    for(const word of keepWords)if(typeof word==='string'&&word.length>=2&&s.startsWith(word))return true;
    return false;
  }
  function literalRanges(text,words) {
    const ranges=[];
    for(const word of words) {
      if(typeof word!=='string'||word.length<2)continue;
      for(let at=text.indexOf(word);at>=0;at=text.indexOf(word,at+word.length))ranges.push({start:at,end:at+word.length});
    }
    return ranges;
  }
  function mergeSpans(spans) {
    const sorted=spans.filter(s=>s.end>s.start).sort((a,b)=>a.start-b.start||b.end-a.end),result=[];
    for(const s of sorted) {
      const last=result[result.length-1];
      if(last&&s.start<last.end)last.end=Math.max(last.end,s.end);else result.push({...s});
    }
    return result;
  }
  function analyze(text,options={},context={}) {
    const o=opts(options),spans=[],confirmedNames=new Set(),candidateNames=new Set();
    if(typeof text!=='string'||!text)return {spans,confirmedNames:[],candidateNames:[]};
    const keepWords=context.keepWords||[];
    const keptRanges=literalRanges(text,keepWords);
    const kept=(a,b)=>keptRanges.some(s=>s.start<b&&s.end>a);
    const add=(start,end,reason,learn=false)=>{
      spans.push({start,end,reason});if(learn)confirmedNames.add(text.slice(start,end));
      if(learn||reason==='surname-heuristic'||reason==='common-given-name')candidateNames.add(text.slice(start,end));
    };
    if(o.rules.nationalId)for(const m of text.matchAll(/(?<![A-Z0-9])[A-Z][1289]\d{8}(?![A-Z0-9])/gi))add(m.index,m.index+m[0].length,'id');
    if(o.rules.medicalRecordNumber) {
      const dated=value=>o.mrnExcludeDates&&/^\d+$/.test(value)&&isRecentDate(value,o.now);
      if(o.mrnMode!=='custom'||o.mrnKeepDefault)for(const m of text.matchAll(/(?<!\d)\d{6,8}(?!\d)/g)) {
        const end=m.index+m[0].length;
        if(plainNumber(text,m.index,end)&&isMedicalRecordNumber(m[0],o.mrnMode)&&!dated(m[0]))add(m.index,end,'mrn');
      }
      if(o.mrnMode==='custom')for(const pattern of o.mrnPatterns) {
        const expression=patternRegex(pattern);
        if(!expression)continue;
        expression.lastIndex=0;
        for(const m of text.matchAll(expression)) {
          const end=m.index+m[0].length;
          if(plainNumber(text,m.index,end)&&!dated(m[0]))add(m.index,end,'mrn');
        }
      }
    }
    if(o.rules.birthDate)for(const span of dateSpans(text,o.now)) {
      // A birth label or a birth-date field always masks, whatever the mode.
      const birth=context.birthField||birthLabelNear(text,span.start);
      // 'unlabelled' (the default) also masks bare dates, but spares one that is labelled
      // as a clinical date, because that is information the reader legitimately needs.
      const clinical=context.clinicalField||clinicalLabelNear(text,span.start);
      const masked=o.dateMode==='all'||birth||(o.dateMode==='unlabelled'&&!clinical);
      if(masked)add(span.start,span.end,'date');
    }
    if(o.rules.email)for(const m of text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi))add(m.index,m.index+m[0].length,'email');
    if(o.rules.phone)for(const m of text.matchAll(/(?<!\d)(?:\+?886[-\s]?)?(?:0?9\d{2}|0\d{1,2})[-\s]?\d{3,4}[-\s]?\d{3,4}(?!\d)/g))add(m.index,m.index+m[0].length,'phone');
    if(!o.rules.names)return {spans:mergeSpans(spans),confirmedNames:[],candidateNames:[]};
    // Confirmed fields never require common surnames or given-name characters.
    const field=context.nameField?fieldNameSpan(text):null;
    if(field&&!placeholders.has(field.name)) {
      add(field.start,field.end,'field',true);
    } else if(context.nameField&&isLikelyStandaloneName(text.trim())&&!placeholders.has(text.trim())) {
      const start=text.indexOf(text.trim());add(start,start+text.trim().length,'field',true);
    }
    const labels=new RegExp(LABEL+'(?:'+HS+'*[:：]'+HS+'*|'+HS+'+)','giu');
    for(const m of text.matchAll(labels)) {
      let start=m.index+m[0].length;
      const prefix=text.slice(start).match(leadingMarker);
      if(prefix)start+=prefix[0].length;
      const rest=text.slice(start);
      const candidate=rest.match(/^[\p{Script=Han}·・．]{2,30}|^[A-Za-z][A-Za-z'’.-]*(?:[ \t]+[A-Za-z][A-Za-z'’.-]*){1,5}/u)?.[0];
      if(!candidate||placeholders.has(candidate))continue;
      if(/\p{Script=Han}/u.test(candidate)&&!/[·・．]/u.test(candidate)) {
        const cuts=Array.from(candidate);let end=candidate.length;
        for(let n=2;n<=Math.min(6,cuts.length);n++) {
          const prefix=cuts.slice(0,n).join('');
          if(following.test(candidate.slice(prefix.length))){end=prefix.length;break;}
        }
        if(Array.from(candidate.slice(0,end)).length>6)continue;
        add(start,start+end,'label',true);
      } else add(start,start+candidate.length,'label',true);
    }
    for(const run of text.matchAll(/\p{Script=Han}+/gu)) {
      const chars=Array.from(run[0]);let offset=0;
      for(let i=0;i<chars.length;i++) {
        const tail=run[0].slice(offset),surname=surnameOf(tail,o.surnameLimit);
        if(!surname){offset+=chars[i].length;continue;}
        const start=run.index+offset,left=text.slice(Math.max(0,start-24),start);
        const personLeft=personPrefix.test(left);
        const leftBoundary=leftNameBoundary(left);
        const surnameLength=Array.from(surname.name).length;
        for(const givenLength of [2,1]) {
          const cp=chars.slice(i,i+surnameLength+givenLength);
          if(cp.length!==surnameLength+givenLength)continue;
          const candidate=cp.join(''),end=start+candidate.length,right=text.slice(end);
          const rightBoundary=rightNameBoundary(right);
          const titleRight=title.test(right);
          const given=cp.slice(surnameLength).join('');
          const hint=cp.slice(surnameLength).every(c=>givenChars.has(c)),explicit=personLeft||titleRight;
          const listed=givenLength===2&&strongGiven.has(given);
          // A published common given name is evidence on its own, so it may start
          // mid-sentence; everything else still needs a clean left boundary.
          if(!leftBoundary&&!personLeft&&!listed)continue;
          if((!rightBoundary&&!following.test(right))||grammar.test(candidate.slice(surname.name.length)))continue;
          if(rejected(tail,keepWords)||rejected(candidate,keepWords)||kept(start,end))continue;
          if(explicit||listed||(givenLength===2&&hint&&leftBoundary)||(leftBoundary&&rightBoundary)) {
            add(start,end,explicit?'person-context':(listed?'common-given-name':'surname-heuristic'),explicit||listed);break;
          }
        }
        offset+=chars[i].length;
      }
    }
    const manual=new Set((context.manualNames||[]).filter(n=>typeof n==='string'&&n.length));
    const exact=new Set([...(context.knownNames||[]),...manual]);
    for(const name of exact) {
      if(typeof name!=='string'||name.length>80||!name.length||(name.length<2&&!manual.has(name)))continue;
      for(let at=text.indexOf(name);at>=0;at=text.indexOf(name,at+name.length))
        add(at,at+name.length,manual.has(name)?'manual-name':'known-name');
    }
    if(o.givenNames!==false)for(const alias of context.givenNames||[]) {
      const length=Array.from(alias).length;
      if(length<1||length>3||rejected(alias,keepWords))continue;
      for(let start=text.indexOf(alias);start>=0;start=text.indexOf(alias,start+alias.length)) {
        const end=start+alias.length,left=text.slice(Math.max(0,start-24),start),right=text.slice(end);
        if(kept(start,end))continue;
        const lb=leftNameBoundary(left),rb=rightNameBoundary(right);
        const ref=referencePrefix.test(left),human=humanFollowing.test(right)||aliasFollowing.test(right);
        // Single-character aliases need human context, not an isolated glyph or any substring.
        const accept=length===1?((lb||ref)&&singleFollowing.test(right)||ref&&rb):(lb||ref)&&(rb||human);
        if(accept)add(start,end,'given-name');
      }
    }
    // A keep word wins over every automatic rule, so the list is actually usable to fix a
    // false positive. An explicit manual name is the one thing it does not override, since
    // the user asked for that by name; keeping both is a contradiction the user must resolve.
    const survives=span=>span.reason==='manual-name'||!kept(span.start,span.end);
    return {spans:mergeSpans(spans.filter(survives)),confirmedNames:[...confirmedNames],candidateNames:[...candidateNames]};
  }
  function buildNameIndex(documents,options={},manualNames=[],keepWords=[]) {
    const o=opts(options),knownNames=new Set(),fullNames=new Set(),givenNames=new Set(),strongNames=new Set(manualNames);
    if(!o.rules.names)return {knownNames:[],givenNames:[],candidateCount:0};
    for(const item of documents) {
      const result=analyze(item.text,o,{nameField:item.nameField,birthField:item.birthField,
        clinicalField:item.clinicalField,keepWords});
      result.confirmedNames.forEach(n=>{knownNames.add(n);fullNames.add(n);strongNames.add(n);});
      // Filtered full-name guesses can seed aliases. This remains fallible, is rebuilt
      // from the original text every scan, and never learns from aliases.
      result.candidateNames.forEach(n=>{fullNames.add(n);knownNames.add(n);});
    }
    manualNames.forEach(n=>fullNames.add(n));
    // A given name can itself start with a surname. Do not derive a second alias from it
    // unless it is independently established as a full name in a strong field/manual list.
    const derived=new Set();
    for(const full of fullNames) {
      if(typeof full!=='string'||!/^\p{Script=Han}{2,5}$/u.test(full))continue;
      const surname=surnameOf(full,500);
      if(surname)derived.add(full.slice(surname.name.length));
    }
    for(const full of fullNames)if(derived.has(full)&&!strongNames.has(full)) {
      fullNames.delete(full);knownNames.delete(full);
    }
    if(o.givenNames!==false)for(const full of fullNames) {
      if(typeof full!=='string'||!/^\p{Script=Han}{2,5}$/u.test(full))continue;
      const surname=surnameOf(full,500);
      if(!surname)continue;
      const given=full.slice(surname.name.length),length=Array.from(given).length;
      if(length>=1&&length<=2&&!rejected(given,keepWords))givenNames.add(given);
    }
    return {knownNames:[...knownNames],givenNames:[...givenNames],candidateCount:fullNames.size};
  }
  function maskText(text,options,context) {
    if(typeof text!=='string')return text;
    const replacement=opts(options).replacement,{spans}=analyze(text,options,context);
    let out='',cursor=0;
    for(const s of spans){out+=text.slice(cursor,s.start)+replacement;cursor=s.end;}
    return out+text.slice(cursor);
  }
  function maskSelection(text,start,end,options,context) {
    const spans=analyze(text,options,context).spans,replacement=opts(options).replacement;
    let result='',cursor=start;
    for(const s of spans) {
      if(s.end<=start||s.start>=end)continue;
      result+=text.slice(cursor,Math.max(start,s.start))+replacement;
      cursor=Math.min(end,s.end);
    }
    return result+text.slice(cursor,end);
  }
  const api={analyze,maskText,maskSelection,buildNameIndex,isSensitiveNameLabel,isBirthLabel,isClinicalDateLabel,isLikelyStandaloneName,surnameOf,
    isMedicalRecordNumber,mrnCheckDigit,isCustomFormat,isRecentDate,dateSpans,isBirthLabel};
  g.MaskOOO=Object.freeze(api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
