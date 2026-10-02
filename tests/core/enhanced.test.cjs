'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {maskText,analyze,buildNameIndex}=require('../../core/masker.js');
const {normalize}=require('../../core/settings.js');
// Synthetic variants; user-supplied real names are not bundled into this package.
for(const name of ['周宥安','蔡沛柔','黃宜蓁','郭承翰','趙彤','劉子晴','陳品睿','王宏','洪冠廷','張詠曦']) {
  test('default accepts uncommon-name variant '+name,()=>assert.equal(maskText(name),'OOO'));
}
for(const word of ['時間','資訊','招募中','標籤','海宣部','時間表','資料庫','標準化','管理員','海報','公關部','行政組','財務中心','資訊處','權限','應徵中','過程','所有資訊','海宣部的公告']) {
  test('preserve non-person '+word,()=>assert.equal(maskText(word),word));
}
test('exactly marked fields and manual names take precedence over ordinary words',()=>{
  assert.equal(maskText('時間',{}, {nameField:true}),'OOO');
  assert.equal(maskText('時間',{}, {manualNames:['時間'],keepWords:['時間']}),'OOO');
  assert.equal(maskText('時間',{rules:{names:false}}, {manualNames:['時間']}),'時間');
});
test('enhanced builds full names and given names without recursive learning',()=>{
  const index=buildNameIndex([{text:'周宥安、黃宜蓁'}]);
  assert.deepEqual(new Set(index.givenNames),new Set(['宥安','宜蓁']));
  assert.equal(maskText('宥安表示，請宜蓁協助整理。',{},index),'OOO表示，請OOO協助整理。');
  assert.equal(maskText('今天收到宜蓁回覆。',{},index),'今天收到OOO回覆。');
  assert.equal(maskText('今天周宥安已回覆。',{},index),'今天OOO已回覆。');
  assert.deepEqual(analyze('宥安',{},index).candidateNames,[]);
  assert.equal(buildNameIndex([{text:'宥安表示'}]).givenNames.length,0);
});
test('given-only text without a full name stays unknown',()=>assert.equal(maskText('宥安表示，宜蓁回覆。'),'宥安表示，宜蓁回覆。'));
test('same document content can appear before or after the source name',()=>{
  const docs=[{text:'宥安表示'},{text:'周宥安'}];const index=buildNameIndex(docs);
  assert.equal(maskText(docs[0].text,{},index),'OOO表示');
});
test('single-character aliases need human context',()=>{
  const index=buildNameIndex([{text:'趙彤、王宏'}]);
  assert.equal(maskText('彤表示，宏回覆。',{},index),'OOO表示，OOO回覆。');
  assert.equal(maskText('請彤協助，已收到宏回覆。',{},index),'請OOO協助，已收到OOO回覆。');
  assert.equal(maskText('宏觀作品、宏偉、彤',{},index),'宏觀作品、宏偉、彤');
  assert.equal(maskText('聯絡人：彤',{},index),'聯絡人：OOO');
});
test('ordinary given-name mention grammar',()=>{
  const index=buildNameIndex([{text:'周宥安'}]);
  for(const tail of ['是窗口','會回覆','正在處理','參與活動','安排會議'])assert.equal(maskText('宥安'+tail,{},index),'OOO'+tail);
});
test('given name beginning with a surname cannot recursively seed a shorter alias',()=>{
  const index=buildNameIndex([{text:'周林文'},{text:'林文'}]);
  assert.deepEqual(index.givenNames,['林文']);
  const separate=buildNameIndex([{text:'周林文'},{text:'林文',nameField:true}]);
  assert.equal(separate.givenNames.includes('文'),true);
});
test('manual single-character masking is explicit',()=>assert.equal(maskText('宏觀作品',{}, {manualNames:['宏']}),'OOO觀作品'));
test('given-name toggle and no stale document index',()=>{
  const index=buildNameIndex([{text:'周宥安'}]);
  assert.equal(maskText('宥安表示',{givenNames:false},index),'宥安表示');
  assert.equal(buildNameIndex([{text:'宥安表示'}]).givenNames.length,0);
  assert.equal(buildNameIndex([{text:'周宥安'}],{givenNames:false}).givenNames.length,0);
});
test('compound surname leaves correct given name',()=>{
  const index=buildNameIndex([{text:'歐陽宥安、范姜宜蓁'}]);
  assert.deepEqual(new Set(index.givenNames),new Set(['宥安','宜蓁']));
  assert.equal(maskText('宜蓁來電',{},index),'OOO來電');
});
test('common-word alias is not created',()=>{
  const index=buildNameIndex([{text:'陳時間',nameField:true}]);
  assert.deepEqual(index.givenNames,[]);
  assert.equal(maskText('時間到了',{},index),'時間到了');
});
test('a name field always seeds its alias',()=>{
  assert.deepEqual(buildNameIndex([{text:'王小明',nameField:true}]).givenNames,['小明']);
  // No alias without a recognised surname to strip.
  assert.deepEqual(buildNameIndex([{text:'龘罕名',nameField:true}]).givenNames,[]);
});
// v0.7.0: a keep word wins over every automatic rule, explicit name fields included.
test('keep words suppress guessing, including fragments and explicit fields',()=>{
  assert.equal(maskText('海研社'),'OOO');
  assert.equal(maskText('海研社',{}, {keepWords:['海研社']}),'海研社');
  assert.equal(maskText('海研社',{}, {nameField:true,keepWords:['海研社']}),'海研社');
  assert.deepEqual(buildNameIndex([{text:'海研社'}],{},[],['海研社']).givenNames,[]);
  const index=buildNameIndex([{text:'周宥安'}]);
  assert.equal(maskText('宥安作品',{}, {...index,keepWords:['宥安作品']}),'宥安作品');
});
test('settings migration drops the removed mode and keeps explicit choices',()=>{
  assert.equal('nameMode' in normalize({nameMode:'balanced'}),false);
  assert.equal(normalize({disabledHosts:['example.test']}).disabledHosts[0],'example.test');
  assert.equal(normalize({rules:{names:false}}).rules.names,false);
  // The two protections are independent and both default to on.
  assert.equal(normalize().maskScreen,true);
  assert.equal(normalize().maskClipboard,true);
  assert.equal(normalize({maskScreen:false}).maskClipboard,true);
  assert.equal(normalize({maskClipboard:false}).maskScreen,true);
  // v0.4 clipboard switches migrate to the new names.
  assert.equal(normalize({safeCopy:false,safePaste:false}).maskClipboard,false);
  assert.equal(normalize({safeCopy:true,safePaste:false}).maskPaste,false);
});
test('manual full names seed aliases, manual given names mask literally',()=>{
  const index=buildNameIndex([],{},['周宥安']);
  assert.equal(maskText('宥安表示',{},index),'OOO表示');
  assert.equal(maskText('只見宥安',{}, {manualNames:['宥安']}),'只見OOO');
});
