(function initPopup() {
  "use strict";
  const $ = id => document.querySelector('#' + id);
  const toggles = ['maskScreen','maskInputs','maskClipboard','maskCopy','maskPaste','ruleNames','ruleMrn',
    'ruleBirthDate','ruleNationalId','ruleEmail','rulePhone','givenNames','showCopyToast','mrnKeepDefault','mrnExcludeDates'];
  const selects = ['surnameLimit','mrnMode','dateMode'];

  let settings = OOOSettings.normalize();
  let activeTab = null, host = "", syncUnavailable = false;
  const LIST_KEY = {names:'manualNames', keep:'keepWords'};

  const supported = tab => !!tab && /^(?:https?|file):\/\//i.test(tab.url || "");
  const send = (message, done) => chrome.tabs.sendMessage(activeTab.id, message, {frameId: 0}, done);

  const LIST_HINTS = {
    names: '一行一個，所有分頁通用。這是真人姓名，只會存在這台電腦，不會同步到其他裝置。填全名可連帶遮住簡稱。',
    keep: '一行一詞，至少兩字，所有分頁通用並隨帳號同步。優先於所有自動規則；若同一個詞也在姓名清單裡，以姓名清單為準。'
  };
  const LIST_PLACEHOLDER = {names:'王小明\n達悟·拉飛', keep:'海研社\n某某中心'};

  function paint() {
    const ok = supported(activeTab);
    const on = settings.enabled;
    document.body.classList.toggle('off', !on);
    $('globalEnabled').checked = on;
    $('siteEnabled').disabled = !ok || !on;
    $('rescan').disabled = !ok;
    $('siteEnabled').checked = ok && !settings.disabledHosts.includes(host);
    $('siteHint').textContent = on ? '只影響目前網站' : '全域開關已關閉，所有網站都停止運作';
    $('maskInputs').checked = settings.maskInputs;
    $('screenSub').classList.toggle('off', !settings.maskScreen);
    $('maskScreen').checked = settings.maskScreen;
    $('maskClipboard').checked = settings.maskClipboard;
    $('maskCopy').checked = settings.maskCopy;
    $('maskPaste').checked = settings.maskPaste;
    $('ruleNames').checked = settings.rules.names;
    $('ruleMrn').checked = settings.rules.medicalRecordNumber;
    $('ruleBirthDate').checked = settings.rules.birthDate;
    $('dateMode').value = settings.dateMode;
    $('ruleNationalId').checked = settings.rules.nationalId;
    $('ruleEmail').checked = settings.rules.email;
    $('rulePhone').checked = settings.rules.phone;
    $('givenNames').checked = settings.givenNames;
    $('showCopyToast').checked = settings.showCopyToast;
    $('mrnKeepDefault').checked = settings.mrnKeepDefault;
    $('mrnExcludeDates').checked = settings.mrnExcludeDates;
    $('surnameLimit').value = String(settings.surnameLimit);
    $('mrnMode').value = settings.mrnMode;
    $('mrnPatterns').value = settings.mrnPatterns.join('\n');
    $('replacement').value = settings.replacement;
    $('clipSub').classList.toggle('off', !settings.maskClipboard);
    $('mrnCustom').classList.toggle('hidden', settings.mrnMode !== 'custom');
    $('siteName').textContent = ok ? (host || "本機檔案") : "這個頁面不允許外掛執行";
    $('syncNote').textContent = syncUnavailable
      ? '設定同步目前無法使用，只會存在這台電腦。'
      : '設定會跟著 Google 帳號同步。已停用的網站清單只留在這台電腦，不會上傳。';
    if (!ok) $('status').textContent = "請切換到一般網頁再試。";
    paintList();
  }

  function paintList() {
    const kind = $('listKind').value;
    const saved = settings[LIST_KEY[kind]] || [];
    if (document.activeElement !== $('listInput')) $('listInput').value = saved.join('\n');
    $('listInput').placeholder = LIST_PLACEHOLDER[kind];
    $('listHint').textContent = (saved.length ? `已儲存 ${saved.length} 筆。` : '') + LIST_HINTS[kind];
  }

  function save() {
    settings.maskScreen = $('maskScreen').checked;
    settings.maskClipboard = $('maskClipboard').checked;
    settings.maskCopy = $('maskCopy').checked;
    settings.maskPaste = $('maskPaste').checked;
    settings.givenNames = $('givenNames').checked;
    settings.showCopyToast = $('showCopyToast').checked;
    settings.maskInputs = $('maskInputs').checked;
    settings.mrnKeepDefault = $('mrnKeepDefault').checked;
    settings.mrnExcludeDates = $('mrnExcludeDates').checked;
    settings.surnameLimit = Number($('surnameLimit').value);
    settings.mrnMode = $('mrnMode').value;
    settings.dateMode = $('dateMode').value;
    settings.mrnPatterns = $('mrnPatterns').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    settings.replacement = $('replacement').value.trim().slice(0, 12) || "OOO";
    settings.rules = {
      nationalId: $('ruleNationalId').checked,
      names: $('ruleNames').checked,
      medicalRecordNumber: $('ruleMrn').checked,
      birthDate: $('ruleBirthDate').checked,
      email: $('ruleEmail').checked,
      phone: $('rulePhone').checked
    };
    settings = OOOSettings.normalize(settings);
    OOOSettings.save(chrome, settings, () => {paint(); setTimeout(refresh, 150);});
  }

  function refresh() {
    if (!supported(activeTab)) return;
    send({type: "OOO_GET_STATUS"}, response => {
      if (chrome.runtime.lastError || !response) {
        $('status').textContent = "重新整理網頁後開始運作。";
      } else if (!response.active) {
        $('status').textContent = "這個網站已暫停遮罩。";
      } else {
        const parts = [];
        if (response.screen) parts.push(`螢幕遮住 ${response.maskedTextNodes + response.maskedInputs} 處`);
        else parts.push('螢幕遮罩已關閉');
        parts.push(response.clipboard ? '複製貼上防護開啟' : '複製貼上防護關閉');
        $('status').textContent = `${parts.join('、')}；辨識到 ${response.confirmedNames || 0} 個姓名。仍請檢查。`;
      }
    });
  }

  $('globalEnabled').addEventListener('change', () => {
    settings.enabled = $('globalEnabled').checked;
    OOOSettings.save(chrome, settings, () => {paint(); setTimeout(refresh, 150);});
  });
  $('siteEnabled').addEventListener('change', () => {
    const disabled = new Set(settings.disabledHosts);
    $('siteEnabled').checked ? disabled.delete(host) : disabled.add(host);
    settings.disabledHosts = [...disabled];
    OOOSettings.save(chrome, settings, () => setTimeout(refresh, 100));
  });
  toggles.forEach(id => $(id).addEventListener('change', save));
  selects.forEach(id => $(id).addEventListener('change', save));
  $('mrnPatterns').addEventListener('change', save);
  $('replacement').addEventListener('change', save);
  $('replacement').addEventListener('keydown', e => {if (e.key === 'Enter') {save(); $('replacement').blur();}});
  $('rescan').addEventListener('click', () => send({type: "OOO_RESCAN"}, () => {
    if (chrome.runtime.lastError) $('status').textContent = "請重新整理網頁；本機檔案需先允許存取檔案網址。";
    else setTimeout(refresh, 100);
  }));

  $('listKind').addEventListener('change', paintList);
  function applyList(clear) {
    const kind = $('listKind').value;
    const values = clear ? [] : $('listInput').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    settings[LIST_KEY[kind]] = values;
    settings = OOOSettings.normalize(settings);
    OOOSettings.save(chrome, settings, () => {
      if (clear) $('listInput').value = '';
      paintList();
      if (!supported(activeTab)) return;
      // Storage already notified the page; this only forces an immediate rescan.
      send({type: kind === 'names' ? 'OOO_SET_MANUAL_NAMES' : 'OOO_SET_KEEP_WORDS'}, () => {
        if (chrome.runtime.lastError) $('listHint').textContent = '已儲存，重新整理網頁後生效。';
        else setTimeout(refresh, 120);
      });
    });
  }
  $('listApply').addEventListener('click', () => applyList(false));
  $('listClear').addEventListener('click', () => applyList(true));

  chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
    activeTab = tab || null;
    if (supported(activeTab)) host = new URL(activeTab.url).hostname;
    OOOSettings.load(chrome, (loaded, info) => {
      settings = loaded;
      syncUnavailable = info.syncUnavailable;
      paint();
      refresh();
    });
  });
})();
