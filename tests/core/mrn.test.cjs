'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../../core/masker.js');
const {isMedicalRecordNumber,mrnCheckDigit,isRecentDate}=engine;
// v0.8.0 added the birth-date rule, which reads the same digit runs. As in the v0.8.1
// release, record-number tests run with it off so each rule's behaviour stays visible.
const noDates=(o={})=>({...o,rules:{birthDate:false,...o.rules}});
const maskText=(s,o,c)=>engine.maskText(s,noDates(o),c);
const maskSelection=(s,a,b,o,c)=>engine.maskSelection(s,a,b,noDates(o),c);
const analyze=(s,o,c)=>engine.analyze(s,noDates(o),c);
const {normalize}=require('../../core/settings.js');
// All numbers below are constructed from the published check-digit rule, not from real records.
const weights=[7,6,5,4,3,2,1];
const withCheckDigit=seven=>seven+String(seven.split('').reduce((sum,d,i)=>sum+Number(d)*weights[i],0)%10);

test('check digit follows weights 7,6,5,4,3,2,1 mod 10',()=>{
  assert.equal(mrnCheckDigit('1234567'),(7+12+15+16+15+12+7)%10);
  for(const seven of ['1234567','0000000','9999999','1010101','7654321']) {
    const full=withCheckDigit(seven);
    assert.equal(isMedicalRecordNumber(full),true,full);
    // Any other final digit must fail.
    for(let d=0;d<10;d++)if(String(d)!==full[7])assert.equal(isMedicalRecordNumber(seven+d),false,seven+d);
  }
});
test('eight-digit dates are rejected unless they coincidentally satisfy the rule',()=>{
  assert.equal(isMedicalRecordNumber('20240115'),false);
  assert.equal(maskText('入院日 20240115'),'入院日 20240115');
  assert.equal(maskText('2024-01-15 出院'),'2024-01-15 出院');
});
test('six and seven digits are masked without a check digit',()=>{
  assert.equal(maskText('病歷號 123456'),'病歷號 OOO');
  assert.equal(maskText('病歷號 1234567'),'病歷號 OOO');
  assert.equal(maskText('病歷號 '+withCheckDigit('1234567')),'病歷號 OOO');
});
test('checked mode narrows the rule to verified eight-digit numbers',()=>{
  const o={mrnMode:'checked'};
  assert.equal(maskText('123456',o),'123456');
  assert.equal(maskText('1234567',o),'1234567');
  assert.equal(maskText(withCheckDigit('1234567'),o),'OOO');
  assert.equal(normalize().mrnMode,'all');
  assert.equal(normalize({mrnMode:'checked'}).mrnMode,'checked');
  assert.equal(normalize({mrnMode:'nonsense'}).mrnMode,'all');
});
test('digit runs outside 6-8 and parts of larger numbers stay intact',()=>{
  for(const text of ['12345','123456789','1234567890','12.345678','123456.78','1,234,567','0912-345-678','0912345678'])
    assert.equal(maskText(text),text,text);
  assert.equal(maskText('a123456789'),'OOO'); // National ID rule, one span, not split by the number rule.
});
test('rule can be switched off independently of other rules',()=>{
  assert.equal(maskText('123456',{rules:{medicalRecordNumber:false}}),'123456');
  assert.equal(maskText('王小明 123456',{rules:{medicalRecordNumber:false}}),'OOO 123456');
  assert.equal(maskText('王小明 123456',{rules:{names:false}}),'王小明 OOO');
});
test('chart numbers combine with names, ids and partial selections',()=>{
  const text='姓名：王小明 病歷號 123456 證號 A123456789';
  assert.equal(maskText(text),'姓名：OOO 病歷號 OOO 證號 OOO');
  assert.deepEqual(analyze('123456').spans.map(s=>s.reason),['mrn']);
  const start=text.indexOf('123456');
  for(let a=start;a<start+6;a++)for(let b=a+1;b<=start+6;b++)assert.equal(maskSelection(text,a,b),'OOO');
});

test('custom formats replace or extend the built-in one',()=>{
  const custom={mrnMode:'custom',mrnPatterns:['A#######'],mrnKeepDefault:false};
  assert.equal(maskText('V0012345 就診',custom),'OOO 就診');
  assert.equal(maskText('123456',custom),'123456','built-in is off in this mode');
  assert.equal(maskText('123456 與 V0012345',{...custom,mrnKeepDefault:true}),'OOO 與 OOO');
  assert.equal(maskText('AB-1234',{mrnMode:'custom',mrnPatterns:['AA-####'],mrnKeepDefault:false}),'OOO');
  assert.equal(maskText('AB-12345',{mrnMode:'custom',mrnPatterns:['AA-####'],mrnKeepDefault:false}),'AB-12345');
});
test('malformed or oversized custom patterns are ignored, not thrown',()=>{
  for(const pattern of ['','##','   ','#'.repeat(80),'(((','[a-']) {
    assert.equal(maskText('123456 abc',{mrnMode:'custom',mrnPatterns:[pattern],mrnKeepDefault:false}),'123456 abc',pattern);
  }
  assert.deepEqual(normalize({mrnPatterns:['##','A#######','  A#######  ']}).mrnPatterns,['A#######']);
  assert.equal(normalize({mrnMode:'custom'}).mrnMode,'custom');
});

// A fixed "today" so the moving window is deterministic.
const NOW=Date.parse('2026-09-08T00:00:00Z');
const day=n=>{
  const d=new Date(NOW+n*86400000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;
};
test('a recent calendar date is not a record number even if the check digit fits',()=>{
  // Find real dates inside the window that would otherwise pass the built-in rule.
  const colliding=[];
  for(let n=-183;n<=31;n++)if(isMedicalRecordNumber(day(n)))colliding.push(day(n));
  assert.ok(colliding.length>0,'the collision this rule exists for must be reachable');
  for(const value of colliding) {
    assert.equal(maskText(value,{now:NOW}),value,value);
    assert.equal(maskText(value,{now:NOW,mrnExcludeDates:false}),'OOO',value+' with the exclusion off');
  }
});
test('window edges: inside is kept, outside stays eligible',()=>{
  assert.equal(isRecentDate(day(0),NOW),true);
  assert.equal(isRecentDate(day(-183),NOW),true);
  assert.equal(isRecentDate(day(-184),NOW),false);
  assert.equal(isRecentDate(day(31),NOW),true);
  assert.equal(isRecentDate(day(32),NOW),false);
});
test('ROC and two-digit year dates are recognised too',()=>{
  assert.equal(isRecentDate('20260707',NOW),true);
  assert.equal(isRecentDate('1150707',NOW),true,'民國 115 年 7 月 7 日');
  assert.equal(isRecentDate('260707',NOW),true);
  assert.equal(maskText('入院日 1150707',{now:NOW}),'入院日 1150707');
  assert.equal(maskText('入院日 260707',{now:NOW}),'入院日 260707');
});
test('impossible dates are not dates, so they remain eligible',()=>{
  for(const value of ['20260230','20261340','20260000','20260732','1150230'])
    assert.equal(isRecentDate(value,NOW),false,value);
  assert.equal(maskText('20260230',{now:NOW,mrnMode:'custom',mrnPatterns:['########'],mrnKeepDefault:false}),'OOO');
});
test('the exclusion also applies to all-digit custom formats',()=>{
  const custom={now:NOW,mrnMode:'custom',mrnPatterns:['########'],mrnKeepDefault:false};
  assert.equal(maskText(day(-10),custom),day(-10));
  assert.equal(maskText(day(-10),{...custom,mrnExcludeDates:false}),'OOO');
  // A format with letters is not date-shaped and is unaffected.
  assert.equal(maskText('V0260707',{...custom,mrnPatterns:['A#######']}),'OOO');
});
test('the exclusion is a setting and defaults to on',()=>{
  assert.equal(normalize().mrnExcludeDates,true);
  assert.equal(normalize({mrnExcludeDates:false}).mrnExcludeDates,false);
});
