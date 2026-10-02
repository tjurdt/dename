# OOO 去識別化（網站 + Chrome 插件）

同一套辨識引擎，兩個產品：

- **網站**「OOO 文件去識別化」：上傳 PDF/TXT 或貼上文字 → 輸出去識別化 TXT。
  GitHub Pages 從 `main` 根目錄發布 → https://tjurdt.github.io/dename/
- **Chrome 插件**「OOO 敏感資料遮罩」：在任何網頁上即時遮罩畫面與剪貼簿。
  商店 ID `cgmlhgmlmojmigmkdahomgcfplcppfjm`

## 目錄地圖：要改什麼，去哪裡改

| 想改的東西 | 檔案 | 影響範圍 |
|---|---|---|
| 辨識規則（姓名、日期、病歷號、身分證…） | `core/masker.js` | **網站 + 插件** |
| 姓氏表 / 常見名字表 / 排除詞 | `core/surnames.js`、`core/namedata.js` | **網站 + 插件** |
| 設定的欄位與預設值 | `core/settings.js` | **網站 + 插件** |
| 網站：版面 | `web/src/index.html`、`web/src/styles.css` | 網站 |
| 網站：互動流程 | `web/src/main.js` | 網站 |
| 網站：引擎轉接、類別與顏色 | `web/src/engine.js` | 網站 |
| 網站：OOO / 類別標籤 / 編號輸出 | `web/src/redact.js` | 網站 |
| 網站：網站專屬預設值（例：預設遮 email、電話） | `web/src/settings.js` | 網站 |
| 網站：讀 PDF / TXT | `web/src/read-file.js` | 網站 |
| 網站：PDF 斷行接回段落、康熙部首字正規化 | `web/src/pdf-text.js` | 網站 |
| 常用詞被誤判成姓名 | `core/namedata.js` 的 `probedWords`（加詞前先確認它不會是人名） | **網站 + 插件** |
| 插件：網頁上的遮罩行為 | `extension/content.js` | 插件 |
| 插件：彈出面板 | `extension/popup.html/css/js` | 插件 |
| 插件：版本號、權限 | `extension/manifest.json` | 插件 |
| 插件：上架文案、隱私權、宣傳圖 | `extension/store/` | 上架用，不打包 |

## 鐵則

1. **不要直接改根目錄的 `index.html`。** 它是 `npm run build` 的產物（但必須 commit，
   因為 Pages 直接發布它）。改 `web/src/` 或 `core/`，然後 `npm run build`。
   測試會檢查它是否與原始碼一致，手改或忘了建置都會讓測試失敗。
2. **改 `core/` = 同時改了網站和插件。** 改完要跑完整 `npm test`，
   並且依下方「插件發版」流程升版號——否則 repo 裡的插件程式碼和商店上同版號的不一樣。
3. **辨識邏輯只能放在 `core/`。** 網站用 `import` 引用 core，插件建置時把 core 檔案複製進包裝。
   不要把 core 的程式碼複製到 `web/` 或 `extension/`（有測試會擋）。
4. **`core/` 的檔案是一般 script，不是 ES module**：它們必須能直接被插件的
   content_scripts 載入（掛在 `globalThis.MaskOOO` 等），同時用 `module.exports` 給 Node/網站。
   改寫時保留檔尾的這兩種匯出。
5. 網站必須維持**單一 HTML 檔、可離線、CSP 封鎖所有對外連線**。不要加 CDN、字型、分析碼、fetch。
6. 每次 commit 都要是可直接上線的狀態：`npm test` 全綠才 commit。push 到 `main` 就是上線。

## 指令

```sh
npm install          # 第一次
npm test             # 建置 + 全部測試（含 Playwright 真瀏覽器測試），改完一定要跑
npm run build        # 只建置：index.html、dist/extension/、dist/ooo-sensitive-mask-v*-store.zip
npm run test:unit    # 快速：不開瀏覽器
```

本機試插件：`chrome://extensions` → 開發人員模式 → 載入未封裝項目 → 選 `dist/extension/`
（不是 `extension/`，那裡缺 core 的檔案）。改完重新 build，再按卡片上的重新載入。

## 測試分層（`tests/`）

- `core/*.test.cjs`：辨識引擎規則。來自插件 v0.6.1 原始碼的測試，加上 v0.8 出生日期的特徵化測試。
  **要改規則行為時，先改/加這裡的測試**，讓它從紅變綠。
- `web/*.test.js`：網站純邏輯。其中「網站 OOO 輸出 == 插件貼上結果」是兩個產品連動的契約，
  不要為了讓它通過而刪掉；它失敗代表網站和插件對同一段文字給出不同結果。
- `build/*.test.js`：index.html 是否為最新建置、CSP、插件打包是否完整、版本號一致、core 沒被複製。
- `e2e/*.test.js`：Playwright 對**建置後的 index.html** 做真瀏覽器測試（PDF 讀取、點擊命中、手機寬度）。
  版面問題（元素擋住點擊、手機跑版）只有這層測得出來。

## 插件發版

1. 改 `extension/manifest.json` 的 `version`。
2. 在 `extension/README.md` 改標題版號，並在最上方新增「## vX.Y.Z 變更」。（有測試檢查標題版號）
3. `npm test` 全綠。
4. 上傳 `dist/ooo-sensitive-mask-vX.Y.Z-store.zip` 到 Chrome 開發人員資訊主頁；
   上架文案在 `extension/store/STORE-LISTING.md`，有改權限時要一併更新 `PRIVACY.md` / `privacy.html`。
5. 網站沒有獨立版號；它跟著 `main` 走。

## 兩個產品的連動點

- 網站設定 = 插件設定（`core/settings.js` 的形狀）+ 網站專屬的 `outputMode`、`markDoubt`。
  表單元素的 id 與 `extension/popup.html` 相同（`ruleNames`、`dateMode`…），方便對照。
- 「一定要遮的姓名」（`manualNames`）是真人姓名：插件只存本機不同步；網站完全不存（只在分頁記憶體）。
- 網站結果區 `#docView` 帶 `data-ooo-extension-ui`：插件 v0.8.1 的 content.js 會跳過這種元素，
  所以裝了插件的人在網站上「標示原文」仍看得到原文。不要拿掉這個屬性。

## 已知技術債 / 待辦

- **漏遮**：姓名後面緊接的詞若不在 `core/masker.js` 的 `following` 清單（例如「王小明監考」），整個姓名不會被遮。
  這是插件原本的規則，修改會影響插件的誤遮率，要先討論再改。
- 插件「貼上時遮罩」從 Chrome PDF 檢視器複製的文字，也會帶有康熙部首字（⽣、⾼），姓氏會比對不到。
  網站已用 `normalizeCjk` 處理；插件端尚未處理。

- `core/masker.js` 匯出物件裡 `isBirthLabel` 寫了兩次（無害）。下次插件發版時順手刪掉，
  並移除 `scripts/build.mjs` 裡對應的 `duplicate-object-key` 靜音設定。
- 插件 README 宣稱 156 項測試；v0.8.1 的完整測試原始碼不在手邊，這裡移植的是 v0.6.1 版加上補寫的日期測試。
- 插件端（content.js / popup.js）尚無自動化測試；v0.6.1 的 `browser.test.cjs` 未移植。
- 連動的下一步候選：插件偵測到本網站時自動停用貼上遮罩（目前插件會先把貼進網站文字框的內容遮掉）；
  網站提供「匯出 / 匯入設定」與插件共用同一份 JSON。
