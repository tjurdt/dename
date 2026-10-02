# OOO 去識別化

在本機遮住姓名、出生日期、病歷號、身分證號等敏感資料。同一套辨識規則，兩種用法：

- **網站**：https://tjurdt.github.io/dename/ — 上傳 PDF / TXT 或貼上文字，輸出去識別化的 TXT。單一 HTML 檔，可存檔離線使用。
- **Chrome 插件**：[OOO 敏感資料遮罩](https://chromewebstore.google.com/detail/cgmlhgmlmojmigmkdahomgcfplcppfjm) — 在任何網頁上即時遮罩畫面與剪貼簿。

全程在瀏覽器內處理，不上傳任何資料。這是規則比對工具，一定會有誤遮與漏遮，對外提供前請人工檢查。

## 開發

```sh
npm install
npm test        # 建置 + 全部測試
```

目錄結構、修改規則與發版流程見 [CLAUDE.md](CLAUDE.md)。
