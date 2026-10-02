'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../../core/masker.js');
// v0.5 has a single detection mode; these are the baseline cases it must keep passing.
const maskText=(s,o={},c)=>engine.maskText(s,o,c);
const analyze=(s,o={},c)=>engine.analyze(s,o,c);
const {surnameOf,isSensitiveNameLabel}=engine;
const data=require('../../core/surnames.js');
const cases=[
  ['王小明','OOO'],['陳美華','OOO'],['林雅婷','OOO'],['歐陽雅婷','OOO'],['范姜子晴','OOO'],
  ['張簡家豪','OOO'],['𡍼志明','OOO'],['髙志明','OOO'],['温家豪','OOO'],['溫家豪','OOO'],
  ['王小明、李小華','OOO、OOO'],['王小明今天出院','OOO今天出院'],
  ['病人李白今日回診','病人OOO今日回診'],['李白先生','OOO先生'],
  ['患者陳皞韜於今日出院','患者OOO於今日出院'],['醫師：王小明','醫師：OOO'],
  ['姓名：高雄','姓名：OOO'],['姓名：王龘齉','姓名：OOO'],['姓名：达娜·拉飛','姓名：OOO'],
  ['Name: Alice Smith','Name: OOO'],['patient_name: Alice Smith','patient_name: OOO'],
  ['姓名：王小明今日回診','姓名：OOO今日回診'],['姓名：王小明，65 歲','姓名：OOO，65 歲'],
  ['林口長庚','林口長庚'],['高血壓','高血壓'],['陳列商品','陳列商品'],['許可證','許可證'],
  ['曾經','曾經'],['王國','王國'],['高雄','高雄'],['葉酸','葉酸'],['白血球','白血球'],
  ['金額','金額'],['王朝','王朝'],['李子','李子'],['張貼公告','張貼公告'],['姓名','姓名'],
  ['姓名：未知','姓名：未知'],['一般中文字','一般中文字'],['username','username'],
  ['A123456789','OOO'],['a123456789','OOO'],['證號：A123456789。','證號：OOO。'],
  ['B823456789','OOO'],['AA123456789','AA123456789'],
  ['王龘齉','OOO'], // Rare given name, clean boundaries: masked, and may be a false positive.
  ['今天王小明出院了','今天OOO出院了'], // Published common given name: no boundary needed.
  ['今天王家豪出院了','今天OOO出院了'],['病人陳淑芬今日回診','病人OOO今日回診'],
  ['安寧病房','安寧病房'],['白血球低下','白血球低下'],['施打疫苗','施打疫苗'],
  ['嚴重程度','嚴重程度'],['主治醫師','主治醫師'],['簡易評估','簡易評估']
];
for(const [input,expected]of cases)test(input,()=>assert.equal(maskText(input),expected));
test('source excludes aggregate and private-use glyph',()=>{
  assert.equal(data.records.length,498);
  assert.equal(data.records.filter(x=>x.rank<=100).length,100);
  assert.equal(data.records.some(x=>x.name==='其他'),false);
  assert.equal(data.records[0].name,'陳');
  assert.equal(surnameOf('歐陽雅婷').name,'歐陽');
});
test('published given names are strong evidence, guesses are not learned',()=>{
  assert.deepEqual(analyze('王家豪').confirmedNames,['王家豪']);
  assert.deepEqual(analyze('王龘齉').confirmedNames,[]);
  assert.deepEqual(analyze('王龘齉').candidateNames,['王龘齉']);
  assert.equal(maskText('陳列商品'),'陳列商品');
});
test('strong fields do not require surname membership',()=>{
  assert.equal(maskText('龘罕名',{}, {nameField:true}),'OOO');
  assert.equal(maskText('李白',{}, {nameField:true}),'OOO');
  assert.equal(maskText('達悟·拉飛',{}, {nameField:true}),'OOO');
});
test('exact memory handles unpunctuated narrative',()=>{
  const known=analyze('姓名：王龘齉').confirmedNames;
  assert.deepEqual(known,['王龘齉']);
  assert.equal(maskText('今天王龘齉出院了',{}, {knownNames:known}),'今天OOO出院了');
});
test('name data exposes its sources',()=>{
  const data=require('../../core/namedata.js');
  assert.ok(data.sources.length>=3);
  assert.equal(data.strongGiven.has('家豪'),true);
  assert.equal(data.strongGiven.has('淑芬'),true);
  assert.equal([...data.strongGiven].every(n=>Array.from(n).length===2),true);
});
test('manual literal names and names toggle',()=>{
  assert.equal(maskText('今天達悟·拉飛來訪',{}, {manualNames:['達悟·拉飛']}),'今天OOO來訪');
  assert.equal(maskText('王小明 A123456789',{rules:{names:false}}),'王小明 OOO');
});
test('replacement is literal, idempotent for default',()=>{
  assert.equal(maskText('王小明',{replacement:'$&'}),'$&');
  assert.equal(maskText(maskText('王小明 A123456789')),'OOO OOO');
});
test('label matching avoids broad name substrings',()=>{
  assert.equal(isSensitiveNameLabel('username'),false);
  assert.equal(isSensitiveNameLabel('patientName'),true);
  assert.equal(isSensitiveNameLabel('病人姓名'),true);
});
test('rank setting controls unlabelled surname candidates',()=>{
  assert.equal(maskText('伍家豪',{surnameLimit:100}),'伍家豪');
  assert.equal(maskText('伍家豪',{surnameLimit:500}),'OOO');
});
test('large non-name prose returns promptly',()=>{
  const text='這是一段沒有姓名的普通句子'.repeat(3000);
  const start=performance.now();assert.ok(maskText(text)===text,'ordinary prose must be preserved');
  assert.ok(performance.now()-start<3000);
});
