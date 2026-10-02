'use strict';
// v0.8.2: ordinary words that start with a surname must not be taken for names in the
// contexts that used to trigger it, while real names around them are still masked.
const test=require('node:test');
const assert=require('node:assert/strict');
const {maskText}=require('../../core/masker.js');

// Reported from a real cover letter, plus a sample of the probed vocabulary.
const WORDS=['經歷','國考','經驗','高級','常感','團隊','同事','單位','計畫','程度','宜蘭','榮總','陽明',
  '平安','文化','明顯','包括','解決','凌晨','景點','國健署','高普考'];
const CONTEXTS=[w=>`\n${w}\n`,w=>`${w}：`,w=>`醫師${w}。`,w=>`，${w}，`,w=>w];

test('ordinary words are not names in isolating contexts',()=>{
  for(const w of WORDS)for(const ctx of CONTEXTS)assert.equal(maskText(ctx(w)),ctx(w),JSON.stringify(ctx(w)));
});
test('the reported sentences keep their words and lose only the name',()=>{
  assert.equal(maskText('並已通過一階醫師國考。'),'並已通過一階醫師國考。');
  assert.equal(maskText('經歷：實習醫師'),'經歷：實習醫師');
  assert.equal(maskText('持有 ACLS 高級急救證照'),'持有 ACLS 高級急救證照');
  assert.equal(maskText('經歷：王小明主任'),'經歷：OOO主任');
  assert.equal(maskText('醫師國考，醫師王小明表示'),'醫師國考，醫師OOO表示');
});
test('isolated two-character names are still masked (recall is unchanged)',()=>{
  for(const name of ['趙彤','王宏','林森','陳澄','李白'])assert.equal(maskText(`\n${name}\n`),'\nOOO\n',name);
});
