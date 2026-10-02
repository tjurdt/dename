'use strict';
// Characterisation of the v0.8.0/v0.8.1 birth-date rule, matching the behaviour the
// v0.8.1 README documents. The record-number rule is off so only the date rule acts.
const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../../core/masker.js');
const {normalize}=require('../../core/settings.js');
const NOW=Date.parse('2026-09-08T00:00:00Z');
const opts=(o={})=>({now:NOW,...o,rules:{medicalRecordNumber:false,...o.rules}});
const mask=(s,o)=>engine.maskText(s,opts(o));

const WRITTEN_FORMS=['1986/03/02','1986-03-02','1986.03.02','19860302','1986年3月2日','西元1986年3月2日',
  '民國75年3月2日','75/03/02','75.03.02','750302','115-03-02','1150302','03/02/1986','2/3/1986','1959-12-27'];
const NOT_DATES=['1.2.3','2.10.15','192.168.1.1','120/80','16/9','10.5.20'];

test('every documented written form is a date (default unlabelled mode)',()=>{
  for(const s of WRITTEN_FORMS)assert.equal(mask(s),'OOO',s);
});
test('version strings, IPs, blood pressure and ratios are never dates',()=>{
  for(const mode of ['unlabelled','labelled','all'])for(const s of NOT_DATES)assert.equal(mask(s,{dateMode:mode}),s,mode+' '+s);
});
test('impossible and future dates are not birth dates',()=>{
  for(const mode of ['unlabelled','all']) {
    assert.equal(mask('1986/02/30',{dateMode:mode}),'1986/02/30');
    assert.equal(mask('2027/01/01',{dateMode:mode}),'2027/01/01');
  }
});
test('a birth label masks in every mode and wins over nothing else being said',()=>{
  for(const mode of ['unlabelled','labelled','all']) {
    assert.equal(mask('生日：1986/03/02',{dateMode:mode}),'生日：OOO');
    assert.equal(mask('出生日期 2026/08/01',{dateMode:mode}),'出生日期 OOO');
  }
});
test('unlabelled mode spares dates labelled as clinical, all mode masks them',()=>{
  for(const s of ['檢驗日 2026/08/01','入院日期：2026-08-01','手術日 1990/05/05']) {
    assert.equal(mask(s),s);
    assert.equal(mask(s,{dateMode:'labelled'}),s);
    assert.notEqual(mask(s,{dateMode:'all'}),s);
  }
});
test('labelled mode leaves bare dates alone',()=>{
  for(const s of ['1986/03/02','19860302','民國75年3月2日'])assert.equal(mask(s,{dateMode:'labelled'}),s);
});
test('birth-date field context masks without a label in the text',()=>{
  assert.equal(engine.maskText('1986/03/02',opts({dateMode:'labelled'}),{birthField:true}),'OOO');
  assert.equal(engine.maskText('2026/08/01',opts(),{clinicalField:true}),'2026/08/01');
});
test('rule switch and settings defaults',()=>{
  assert.equal(mask('1986/03/02',{rules:{birthDate:false}}),'1986/03/02');
  assert.equal(normalize().dateMode,'unlabelled');
  assert.equal(normalize().rules.birthDate,true);
  assert.equal(normalize({dateMode:'bogus'}).dateMode,'unlabelled');
});
