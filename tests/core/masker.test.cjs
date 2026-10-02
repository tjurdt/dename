"use strict";

const assert = require("node:assert/strict");
const { maskText } = require('../../core/masker.js');
const { isSensitiveNameLabel } = require('../../core/masker.js');

const base = {
  replacement: "OOO",
  rules: { nationalId: true, names: true, email: false, phone: false }
};

assert.equal(maskText("A123456789", base), "OOO");
assert.equal(maskText("證號：A123456789。", base), "證號：OOO。");
assert.equal(maskText("姓名：王小明", base), "姓名：OOO");
assert.equal(maskText("王小明", base, { nameField: true }), "OOO");
assert.equal(maskText("一般中文字", base), "一般中文字");
assert.equal(isSensitiveNameLabel("username"), false);
assert.equal(isSensitiveNameLabel("patient_name"), true);
assert.equal(maskText("test@example.com", base), "test@example.com");
assert.equal(
  maskText("test@example.com", { ...base, rules: { ...base.rules, email: true } }),
  "OOO"
);

console.log("masker tests passed");
