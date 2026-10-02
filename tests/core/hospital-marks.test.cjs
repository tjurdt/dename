'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {maskText,maskSelection,analyze,buildNameIndex}=require('../../core/masker.js');
test('prefix/suffix combinations preserve exact annotation and whitespace',()=>{
  const names=['王小明','周宥安','趙彤','歐陽宜蓁','𡍼志明'];
  const prefixes=['','D','D ','D\u00a0','D\u3000','D\u202f','D\t','@','@ ','@\u00a0','D @','@D ','D\u00a0@'];
  const suffixes=['','H',' H','\u00a0H','I',' I','\u00a0I','\u3000I','\u202fH','HI','H I'];
  for(const name of names)for(const prefix of prefixes)for(const suffix of suffixes) {
    const original=prefix+name+suffix,expected=prefix+'OOO'+suffix;
    assert.equal(maskText(original),expected);
    assert.equal(maskText(original,{}, {nameField:true}),expected);
  }
});
test('markers are stripped from the detected name, not from the value',()=>{
  assert.equal(maskText('D王小明H'),'DOOOH');
  assert.equal(maskText('D周龘齉H'),'DOOOH');
  assert.equal(maskText('D周龘齉H',{},{nameField:true}),'DOOOH');
});
test('rare surnames in a marked name field are learned without markers',()=>{
  const text='  D\u00a0@龘罕名 H I  ';
  const result=analyze(text,{}, {nameField:true});
  assert.deepEqual(result.confirmedNames,['龘罕名']);
  assert.equal(maskText(text,{}, {nameField:true}),'  D\u00a0@OOO H I  ');
  const index=buildNameIndex([{text,nameField:true}]);
  assert.equal(maskText('今天龘罕名出院',{},index),'今天OOO出院');
});
test('labelled values with prefixes, suffixes and NBSP',()=>{
  for(const label of ['姓名：','姓名\u00a0','Patient Name:\u00a0']) {
    const text=label+'D\u00a0@龘罕名H，備註';
    assert.equal(maskText(text),label+'D\u00a0@OOOH，備註');
    assert.deepEqual(analyze(text).confirmedNames,['龘罕名']);
  }
});
test('marker handling does not remove Latin letters in larger identifiers',()=>{
  // The Latin run is never consumed by the marker rule. A recognised name inside the
  // string is still masked, which is the safer outcome for a masking tool.
  for(const text of ['ID王小明','AD王小明','CodeD王小明'])
    assert.equal(maskText(text),text.replace('王小明','OOO'));
  for(const text of ['王小明HTTP','王小明INFO','王小明I9','王小明H2'])assert.equal(maskText(text),text);
  assert.equal(maskText('Name: David Henry'),'Name: OOO');
  assert.equal(maskText('David Henry',{}, {nameField:true}),'OOO');
});
test('severity words stay unchanged and do not seed names',()=>{
  for(const text of ['嚴重','嚴重度','嚴重程度','嚴重的症狀','病情嚴重','嚴重嗎','D嚴重H','@嚴重 I']) {
    assert.equal(maskText(text),text);
    assert.deepEqual(buildNameIndex([{text}]).givenNames,[]);
    assert.deepEqual(buildNameIndex([{text}]).knownNames,[]);
  }
  assert.equal(maskText('嚴志明'),'OOO');
  assert.equal(maskText('姓名：嚴重'),'姓名：OOO'); // Explicit field still wins.
});
test('marker-free full names seed marker-free aliases',()=>{
  const index=buildNameIndex([{text:'D\u00a0周宥安H'}]);
  assert.deepEqual(index.knownNames,['周宥安']);
  assert.deepEqual(index.givenNames,['宥安']);
  assert.equal(maskText('宥安表示',{},index),'OOO表示');
  assert.equal(maskText('D宥安H',{},index),'DOOOH');
});
test('copy complete form selection preserves flags',()=>{
  const text='D\u00a0@王小明 H';
  assert.equal(maskSelection(text,0,text.length,{}, {nameField:true}),'D\u00a0@OOO H');
});
test('partial selected name never leaks its original characters',()=>{
  const text='D\u00a0@王小明 H',start=text.indexOf('王');
  for(let a=start;a<start+3;a++)for(let b=a+1;b<=start+3;b++)assert.equal(maskSelection(text,a,b,{}, {nameField:true}),'OOO');
  assert.equal(maskSelection(text,0,start+1,{}, {nameField:true}),'D\u00a0@OOO');
  assert.equal(maskSelection(text,start+2,text.length,{}, {nameField:true}),'OOO H');
  assert.equal(maskSelection(text,0,start,{}, {nameField:true}),'D\u00a0@');
});
test('partial ID and multiple detected spans preserve surrounding selected text',()=>{
  const text='證號 A123456789；姓名 D王小明H';
  assert.equal(maskSelection(text,0,text.length),'證號 OOO；姓名 DOOOH');
  assert.equal(maskSelection('A123456789',2,6),'OOO');
  assert.equal(maskSelection(text,0,0),'');
});
test('name toggle and keep-word choices still apply',()=>{
  assert.equal(maskText('D王小明H',{rules:{names:false}}),'D王小明H');
  assert.equal(maskText('@周宥安 I',{}, {keepWords:['周宥安']}),'@周宥安 I');
  // v0.7.0: keep words also override explicit name fields.
  assert.equal(maskText('@周宥安 I',{}, {nameField:true,keepWords:['周宥安']}),'@周宥安 I');
});
