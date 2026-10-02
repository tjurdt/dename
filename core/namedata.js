(function (g) {
'use strict';
// Given-name data compiled from published Taiwanese naming statistics.
// Sources (all public, all secondary reporting of official tables):
//   - 內政部《全國姓名統計分析》112 年版 (2023-06-30 base), press release:
//     https://www.moi.gov.tw  ; coverage: https://www.thenewslens.com/article/193955
//   - 內政部 107 年版 top-10 tables, via 中央廣播電臺 https://www.rti.org.tw/news/view/id/2001172
//   - 各出生年代前三大名字 (內政部戶政司), via
//     https://zh.wikipedia.org/wiki/最常見名字列表
//   - 中央健康保險署 2014 兒童及青少年常見名排行, via 中時 20140610
//   - 臺北市民政局 2013-2015 新生兒命名統計, via 新頭殼 2016-06-05
// This is a frequency list, not a name-recognition model and not an accuracy claim.
// A name absent from this list is still detectable through the surname and context rules.
const decades = [
  // [birth range label, male, female] — 內政部戶政司 各出生年代前三大名字
  ['1912-1920', ['明','金水','健'], ['秀英','英','玉']],
  ['1921-1930', ['金龍','金水','金生'], ['秀英','玉蘭','玉英']],
  ['1931-1940', ['正雄','文雄','武雄'], ['秀英','玉蘭','玉英']],
  ['1941-1950', ['正雄','武雄','文雄'], ['秀英','秀琴','美玉']],
  ['1951-1960', ['金龍','進財','榮華'], ['麗華','秀琴','秀美']],
  ['1961-1970', ['志明','志成','文雄'], ['淑芬','美玲','淑惠']],
  ['1971-1980', ['志偉','志明','建宏'], ['淑芬','雅惠','淑娟']],
  ['1981-1990', ['家豪','志豪','志偉'], ['雅婷','怡君','雅雯']],
  ['1991-2000', ['家豪','冠宇','冠廷'], ['雅婷','怡君','怡婷']],
  ['2001-2010', ['承恩','承翰','冠廷'], ['宜蓁','欣妤','詩涵']],
  ['2011-2018', ['承恩','宥廷','品睿'], ['詠晴','子晴','品妍']]
];
const nationalTop = [
  // 內政部 全國前十大常見名字 (107 年及 112 年版)
  '家豪','志明','俊傑','建宏','俊宏','志豪','志偉','文雄','金龍','志強','承翰','冠宇',
  '淑芬','淑惠','美玲','雅婷','美惠','麗華','淑娟','淑貞','怡君','淑華'
];
const newborn = [
  // 新生兒／兒少常見名字：健保署 2014、臺北市民政局 2016、內政部 112 年世代分析
  '宥翔','宥廷','宇恩','承恩','宇翔','宥辰','品睿','睿恩','宸睿','柏宇',
  '承瀚','冠廷','冠宇','柏翰','彥廷','柏睿','恩碩','子睿',
  '語彤','品妍','詠晴','羽彤','子晴','禹彤','品妤','芯語','恩綺','思妤',
  '宜蓁','子涵','詩涵','怡萱','宥蓁','采潔','沛恩','苡菲','雨霏','品蓁'
];
const reduplicated = ['彬彬','安安','明明','婷婷','玲玲','莉莉']; // 內政部 112 年疊字統計
const alsoReported = [
  // Names named in the same reports as long-running or regional favourites.
  '淑婷','惠君','月娥','麗婷','雅惠','欣妤','秀蘭','玉珍','桂英','鳳英','美華','麗玲',
  '宏宇','志翔','冠毅','勝澤','凱傑','威霖','筱晴','舒涵','芯彤','怡雯','昕妍','芷芸','依潔'
];
// Widely used generic names that appear in teaching material and official examples
// rather than in the frequency tables. Kept separate so the provenance stays clear.
const conventional = ['小明','小華','小美','大明','志明','春嬌'];

const givenNames = new Set();
for (const [, male, female] of decades) for (const n of male.concat(female)) givenNames.add(n);
for (const list of [nationalTop, newborn, reduplicated, alsoReported, conventional]) for (const n of list) givenNames.add(n);
// Only two-character entries are treated as strong evidence; single characters are far
// too ambiguous on their own and are used as soft hints instead.
const strongGiven = new Set([...givenNames].filter(n => Array.from(n).length === 2));

// Soft hints: characters that appear in the names above, plus the curated set carried
// over from earlier versions. Presence here never masks anything by itself.
const hintChars = new Set();
for (const name of givenNames) for (const ch of name) hintChars.add(ch);
for (const ch of '小大明華美玉淑芬惠玲麗秀英雅婷怡君雯娟芳萍珍珠蓉霞燕梅蘭琴如欣妤詩涵宜蓁品妍子晴詠苡菲雨霏宥承恩碩睿廷冠宇翰家豪志偉建宏文雄武德成金龍水生進財榮國正清福昌忠義信仁智勇俊傑杰凱安平瑞祥柏佑哲學政宗聖毅達宇軒庭鈞均彥彬銘賢維旭昇鴻嘉佩珮盈柔玟婉雪云芸萱慈璇韻潔菁慧愛暐瑋緯皓昱祐宸諺博翔旻晉豐源益坤振興慶勝永松茂盛健育世東孟樂琳瑩璟琦綺珊玥璿瀚勳憲澤潤皞韜靖心思亮晟彤丞奕昊薇婕甯寧沛妘同') hintChars.add(ch);

// Ordinary vocabulary that begins with, or equals, a common surname. These suppress
// guesses only; an explicit name field or a manual entry still wins.
const commonWords = new Set((
  '王國 王朝 王道 王府 王牌 王子 王后 王者 王位 王水 ' +
  '林口 林業 林地 林木 林立 林區 林場 林蔭 林間 ' +
  '黃色 黃金 黃疸 黃豆 黃斑 黃體 黃麴 黃昏 黃泉 黃綠 ' +
  '張力 張貼 張數 張開 張望 張羅 張嘴 張數 ' +
  '李子 李樹 ' +
  '許可 許多 許願 許久 ' +
  '曾經 曾有 曾任 曾說 ' +
  '何時 何處 何必 何況 何以 何杰金 ' +
  '周末 周邊 周期 周圍 周全 周轉 周知 周年 周日 周報 ' +
  '高血壓 高血糖 高血脂 高雄 高山 高度 高溫 高興 高中 高齡 高危 高燒 高鐵 高階 高峰 高層 高效 高劑量 高鉀 高鈉 高鈣 高尿酸 ' +
  '江山 江湖 江河 ' +
  '白血球 白血病 白色 白天 白飯 白內障 白蛋白 白袍 白班 白斑 ' +
  '金額 金融 金錢 金屬 金黃 金針 ' +
  '石頭 石化 石油 石膏 石灰 ' +
  '古代 古蹟 古老 古典 ' +
  '連結 連續 連絡 連線 連日 連帶 連同 ' +
  '方形 方法 方式 方向 方才 方便 方案 方面 方針 ' +
  '施打 施行 施用 施政 施壓 施工 施術 ' +
  '胡椒 胡亂 胡說 ' +
  '吳郭魚 ' +
  '陳列 陳述 陳皮 陳年 陳舊 陳設 陳情 陳報 陳明 ' +
  '馬上 馬路 馬達 馬公 馬桶 馬鈴薯 ' +
  '葉片 葉子 葉酸 葉黃素 葉綠素 ' +
  '溫度 溫暖 溫泉 溫和 溫水 温度 温暖 温和 ' +
  '安全 安排 安心 安寧 安裝 安眠 安定 安置 安養 ' +
  '成功 成為 成本 成長 成人 成分 成果 成效 成像 ' +
  '全部 全國 全天 全身 全血 全數 全額 ' +
  '常見 常常 常用 常規 ' +
  '易於 易感 ' +
  '容易 容量 容器 容納 ' +
  '夏天 夏季 ' +
  '湯匙 湯圓 湯藥 ' +
  '毛巾 毛病 毛孔 毛髮 毛細 ' +
  '雷雨 雷射 雷同 ' +
  '楊桃 楊柳 楊梅 ' +
  '謝謝 謝絕 謝意 ' +
  '鄭重 ' +
  '洪水 洪流 洪峰 洪亮 ' +
  '賴床 賴皮 賴帳 ' +
  '徐徐 徐緩 ' +
  '蘇打 蘇醒 ' +
  '莊嚴 莊重 莊園 ' +
  '蕭條 ' +
  '羅列 羅盤 羅馬 ' +
  '簡單 簡易 簡介 簡稱 簡報 簡化 簡訊 簡便 ' +
  '游泳 游標 游離 ' +
  '沈默 沈重 ' +
  '顏色 顏面 顏料 ' +
  '孫子 孫女 ' +
  '田野 田地 ' +
  '童年 童話 ' +
  '姜母鴨 ' +
  '唐氏 巴金森 貝爾氏 ' +
  '嚴重 嚴格 嚴謹 ' +
  '姓名 名字 名稱 病人 患者 男性 女性 病歷 身分證 聯絡人 未知 不詳 無名氏 ' +
  '查詢 查核 門診 住院 出院 其他 正常 家庭 家屬 同意 支持 支援 ' +
  '皮膚 皮下 車輛 車站 目前 明天 明白 都是 電話 ' +
  '時間 資訊 資料 標籤 招募 招募中 海宣部 時間表 時段 時差 時刻 日期 日程 日曆 日誌 日報 ' +
  '訊息 公告 公開 公共 公關 宣傳 海宣 行政 人事 企劃 行銷 研發 客服 總務 招生 招聘 招標 ' +
  '招商 招待 報名 報到 登入 登出 註冊 搜尋 查找 查閱 設定 設置 設施 管理 管道 管理員 ' +
  '管理中 管理者 更新 更新中 新增 編輯 刪除 移除 儲存 儲值 保存 保留 保險 取消 確認 ' +
  '確定 確認中 確認碼 完成 完成率 完成中 完整 尚未 尚有 尚可 進行中 進度 待處理 已完成 ' +
  '已讀 未讀 來源 來自 來信 來電 地址 地點 地圖 地區 地理 名單 名片 類別 分類 分享 ' +
  '下載 上傳 上傳中 下載中 附件 文件 文件夾 文檔 文案 文字 文本 文書 文具 文法 文學 ' +
  '文章 內容 內文 聯絡 連接 連接中 狀態 狀況 狀態碼 權限 權益 權利 權責 權重 印表機 ' +
  '印刷 印章 印象 資格 資源 資料庫 資訊網 資料夾 資訊部 標題 標記 標示 標準 標準化 標點 ' +
  '海報 海外 海岸 海水 海洋 海關 海運 部門 部分 部署 組別 組織 科室 辦公室 姓氏 小組 ' +
  '中心 主頁 首頁 返回 返回值 功能 成員 安裝中 安全性 官網 官方 專區 表單 表格 表示 ' +
  '使用 使用者 使用中 用戶 用途 用法 應用 應用程式 應徵 應徵中 過程 過濾 過期 過去 更多 ' +
  '語言 說明 醫療 醫院 醫師 身份 證號 證件 病房 病床 男 女 性別 年齡 通知 流程 ' +
  '主治 主訴 護理 藥師 檢驗 影像 放射 復健 營養 個管 志工 排程 掛號 批價 領藥 ' +
  '生命徵象 意識 清醒 嗜睡 發燒 疼痛 治療 手術 麻醉 傷口 引流 換藥 出血 感染 ' +
  '嚴重度 嚴重程度 成績 成功率 成本價 返回中 返回鍵 通知中'
).split(/\s+/).filter(Boolean));

// v0.8.2: words found by probing the engine with résumé, cover-letter, clinical and
// everyday vocabulary. Each was masked as "surname + one character" when it stood alone
// on a line, before a colon, or right after a title (醫師國考, 醫師團隊). Words that are
// also plausible personal names were left out on purpose (e.g. 康健, 華麗, 姚明).
const probedWords = (
  // 求職、自傳、學歷
  '經歷 經驗 經過 經常 經濟 經營 經費 經由 經理 經手 經典 經年 履歷 簡歷 簡章 簡述 ' +
  '國考 國家 國際 國中 國小 國立 國內 國外 國語 國文 國籍 國民 國防 國健署 國泰 國道 國軍 國術 國寶 國旗 國樂 ' +
  '高級 高手 高考 高普考 高分 高壓 高處 高價 高速 高強度 高品質 高醫 ' +
  '常感 常態 常識 常駐 常務 常年 單位 單純 單車 單身 單獨 單一 單元 單次 單據 ' +
  '團隊 團體 房務 房間 房東 平面 平常 平時 平均 平台 平安 平衡 平日 ' +
  '文史 文化 文創 文青 同理 同理心 同學 同事 同時 同仁 師資 師長 師培 師大 曾獲 ' +
  '英文 日文 華語 臺語 華人 華僑 華文 華南 華北 程式 程度 程序 商業 商品 商管 應屆 應考 申辦 丁級 項目 ' +
  '計畫 計劃 計算 費用 費時 費心 費力 練習 段落 段考 章節 章程 ' +
  // 一般用語
  '於此 時期 時候 時常 時數 時效 明年 明顯 明確 明亮 明星 康復 包括 包含 包裝 包紮 包容 ' +
  '向來 向上 向下 尤其 卓越 卓見 祝福 祝賀 齊全 齊心 莫名 莫過 冷靜 冷氣 冷凍 冷卻 談話 談判 ' +
  '解決 解釋 解剖 解析 解說 和平 和諧 和睦 盛行 盛大 盛夏 夏日 夏令營 秋天 秋季 甘願 ' +
  '杜絕 余下 余裕 余光 余力 余額 余數 范圍 范例 史料 史實 史學 史詩 左右 左邊 左手 ' +
  '凌晨 焦慮 焦點 富足 甯靜 冉冉 景點 景觀 景色 紀律 紀錄 紀念 日出 日常 ' +
  '雲端 雲朵 花費 花園 花生 花錢 車禍 車程 車票 車上 祖父 祖母 祖先 席位 席次 ' +
  '牛奶 牛肉 牛排 羊肉 羊水 鳳梨 柳橙 柳丁 鮑魚 桂花 桂圓 梅花 甘草 甘油 甘露 葛根 柏油 ' +
  '季節 季度 季刊 雷達 龍頭 龍舟 戴口罩 戴上 賀卡 卜卦 宋體 林務 洪荒 侯門 巴士 谷底 谷歌 ' +
  // 醫療
  '經期 經痛 經絡 宮頸 宮縮 竇性 竇房結 梅毒 霍亂 ' +
  // 地名、學校、醫院、朝代與外來詞
  '宜蘭 臺北 臺中 臺南 臺東 花蓮 苗栗 南投 雲林 金門 馬祖 蘭嶼 東清 江蘇 湖南 湖北 杭州 鄭州 ' +
  '巴西 宮崎 夏威夷 蘇格蘭 榮總 馬偕 臺大 成大 陽明 東吳 東海 ' +
  '秦朝 唐朝 宋朝 明朝 元朝 周朝 魏晉 宮廷 蔡司 傅立葉 潘朵拉'
).split(/\s+/).filter(Boolean);
for (const word of probedWords) commonWords.add(word);

const api = {givenNames: [...givenNames], strongGiven, hintChars, commonWords,
  sources: ['內政部 全國姓名統計分析 (107/112)', '內政部戶政司 各出生年代前三大名字',
    '中央健康保險署 2014 兒少常見名排行', '臺北市民政局 2013-2015 新生兒命名統計']};
g.OOONameData = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
