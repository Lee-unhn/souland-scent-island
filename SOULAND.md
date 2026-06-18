# 嗅覺島 SOULAND 2026 — 招商報名網站

> 台灣第一個香氛產業年度展覽平台官網（招商 + 線上報名 + 金流 + Google Sheet 回寫）。
> 2026.10.30 – 11.01 · 台北華山1914文創園區 東2館 ABCD。
> 共同主辦：六赫茲 The Hex。
> 建立日：2026-06-16　·　狀態：MVP 本機可跑版 ✅

---

## 0. 一句話

把客戶提供的「嗅覺島招商品牌簡報 PDF + 主視覺」轉成一個**會跑的招商官網**：五大內容區 + 報名表 + **綠界 ECPay 測試金流** + **報名資料回寫 Google Sheet**，本機 `npm start` 即可端對端運作。

## 1. 怎麼跑（本機）

```bash
cd 桌面專案/嗅覺島-souland/server
npm install          # 只需 express
npm start            # → http://localhost:3000
```

- 首頁 `http://localhost:3000/`（多頁：首頁/關於/展覽資訊/特色體驗/參展品牌/年度大賞/B2B・媒體/聯絡我們）
- 報名頁 `http://localhost:3000/vendor.html`（六大效益/四方案/費用試算/申請表）
- 報名完成頁 `http://localhost:3000/thank-you.html`（**招商簡章 PDF 下載** + 匯款備註）
- **參展廠商後台 `http://localhost:3000/admin.html`（帳密登入，預設 `admin` / `souland2026`）**
- 健康檢查 `http://localhost:3000/api/health`、本機報名查詢 `/api/registrations`

> 預設使用**綠界公開測試特店 2000132（STAGE）**，可端對端跑通付款且**不會真實扣款**。
> 綠界測試信用卡：卡號 `4311-9522-2222-2222`、有效期任意未來、CVV `222`、3D OTP `1234`。

## 2. 架構（多頁 · 非一頁式）

> 2026-06-16 依使用者提供的 demo（`Downloads/souland-website-v1`）改為**多頁設計**，採其真實 logo PNG、招商簡章 PDF 與多頁路由；並把該 demo 的金流 stub 換成我這邊已驗證可跑的綠界測試金流。舊單頁版保留在 `public/_legacy_singlepage/`。

```
使用者(參展品牌) ─▶ 瀏覽器
     │
     ├─ 前端(靜態 public/ · 多頁)
     │    index.html        SPA 路由：首頁/關於/展覽資訊/特色體驗/參展品牌(目錄+品牌詳情)/
     │                      年度大賞/B2B・媒體/聯絡我們（含開幕倒數、等高線 hero、品牌篩選）
     │    vendor.html       我要參展：六大效益 / 四方案 / 申請流程 / 費用試算 / 申請表
     │    thank-you.html    報名完成：申請摘要 + 招商簡章 PDF 下載 + 線上付款按鈕
     │    payment-complete.html  綠界付款結果頁
     │    styles.css · app.js（主站）· vendor.js（報名+試算）· config.js（全站設定）
     │    assets/ logo-mark/lockup(light/dark).png · poster.jpg · souland-prospectus.pdf
     │
     └─ 後端(server/server.js · Express)
          POST /api/register         驗證 → registrations.json(備份) + 轉寫 Google Sheet
          POST /api/payment/ecpay    產生綠界 CheckMacValue → 回傳自動送出表單(/Cashier/AioCheckOut/V5)
          POST /api/payment/result   綠界 browser 導回(OrderResultURL) → 驗章 → 更新狀態
          POST /api/payment/notify   綠界 S2S 通知(ReturnURL) → 驗章 → 回 1|OK
                │                        │
                ▼                        ▼
        Google Apps Script         綠界 ECPay (STAGE 測試)
        (apps-script/Code.gs)      payment-stage.ecpay.com.tw
                │
                ▼
        你現有的 Google Sheet（攤商報名/工作坊候補/B2B買手/聯絡 四分頁，付款狀態自動回寫）
```

**報名 → 簡介下載流程**：填申請表 → `/api/register`（寫 Sheet+本機、回單號）→ `thank-you.html?order=…&pay=…` →
①下載招商簡章 PDF（`assets/souland-prospectus.pdf`）②「立即線上付款」→ 綠界測試結帳。

完整互動架構圖見 [`docs/diagrams/`](docs/diagrams/) 最新日期資料夾的 `architecture.html`（註：架構已改多頁，下次階段收尾時依 §3.5.7 開新日期資料夾重畫）。

## 3. 兩個「先建立」基礎件

| 件 | 決策 | 現況 | 你要做的最後一步 |
|---|---|---|---|
| **繳費方式** | **不收線上金流，改報名後匯款**（2026-06-16 使用者決定） | ✅ 線上金流已關閉（`config.js` `PAYMENT.ENABLED:false`）；vendor 與 thank-you 皆顯示匯款備註 | 把匯款帳號流程走 Email（審核通過後寄）；備註文字改 `config.js` 的 `REMITTANCE.NOTE` 一處即可 |
| **報名回寫 Google Sheet** | **你已有 Sheet/表單** | ✅ 後端已備好寫入邏輯；`apps-script/Code.gs` 已寫好 | 把 `Code.gs` 貼進你 Sheet 的 Apps Script → 部署為 Web App → 把 `/exec` 網址填進 `server/.env` 的 `REGISTRATION_WEBHOOK_URL` |

> 未設定 webhook 時，報名仍會完整存進本機 `server/registrations.json`，不會掉資料。
>
> **報名後簡介下載**（使用者要求）：報名完成頁 `thank-you.html` 提供招商簡章 PDF 下載（`public/assets/souland-prospectus.pdf`，18.8MB，來自 demo），檔名/路徑可在 `config.js` 的 `PROSPECTUS_URL` / `PROSPECTUS_NAME` 改。
>
> **繳費＝報名後匯款**（使用者要求）：線上金流關閉，網頁兩處顯示匯款備註——① 報名頁費用試算側欄（`#payMethodNote`）② 報名完成頁繳費區（`#payBox`）。文字統一由 `config.js` 的 `REMITTANCE.NOTE` 控制。**綠界 ECPay 程式碼整套保留**（後端 `/api/payment/ecpay`、CheckMacValue、`/Cashier/AioCheckOut/V5`、測試特店 2000132 都還在），未來要恢復線上付款只需把 `PAYMENT.ENABLED` 改回 `true`。

## 3.5 報名表 / Google Sheet / Admin 後台（2026-06-16 依 docx 報名表更新）

**① 報名表單欄位**（對齊 `SOULLAND 嗅覺島 報名表.docx`）：公司名稱中/英、品牌名稱中/英、平面圖顯示名稱、統一編號、地址+郵遞區號、展覽聯絡人、公司負責人、電話、手機、Email、公司網站、IG、Facebook、創立年份、主要產地、**參展品類複選**（香水/居家香氛/香氛蠟燭/其他/供應鏈 共 20 項）、攤位方案、數量、備註。

**② 攤位價格**（2026-06-17 依最新活動簡介改為**單一價**，早鳥移除）：

| 方案 | 單一價 | 格數上限 |
|---|---|---|
| 市集攤位 | 6,000 | 1 |
| 2×2 精巧攤位 | 28,000 | 2 |
| 3×3 標準攤位 | 35,000 | 6 |
| 供應鏈攤位 | 30,000 | 12 |

保證金每格 NT$10,000（展後 45 天退還）。簽約應繳＝訂金（攤位費 50%）＋保證金。

**③ Google Sheet（資料庫）**：三張 Sheet（報名資料 / 參展品牌 / 工作坊候補）建於主辦 Google Drive。**Sheet ID 不放進此 repo**（含申請人個資的報名表尤其敏感），改放 Apps Script 的「指令碼屬性 Script Properties」（`SHEET_REG` / `SHEET_BRANDS` / `SHEET_WS`）。部署步驟見 [DEPLOY.md](DEPLOY.md)。

**④ Admin 後台 `/admin.html`**（給操作人員）：帳密登入（預設 `admin`/`souland2026`，改 `server/.env` 的 `ADMIN_USER`/`ADMIN_PASS`/`ADMIN_SECRET`）→ 新增/編輯/刪除**參展廠商**（品牌名、英文名、類型、產地、攤位、香調前中後、品牌故事、產品推薦多筆、logo、是否公開）。資料存 `server/brands.json`，已發布者由公開 `/api/brands` 提供，官網「參展品牌」頁即時讀取顯示（取代原 placeholder）。
後端：`POST /api/admin/login`（回簽章 token，8 小時效期）＋ `GET/POST/PUT/DELETE /api/admin/brands`（Bearer 驗證）＋ 公開 `GET /api/brands`。

**⑤ 全站文字覆蓋（L3b，2026-06-16）**：用一張「文案」Google Sheet（欄位＝頁面／原文／新文字）做「**原文 → 新文字**」對照表。前台 `config.js` 的 `SOULAND_TEXT.apply()` 在頁面載入後讀後端 `textGet`，把畫面上**整段等於「原文」**的文字替換成「新文字」；沒填的維持原文（不影響載入速度，後台 admin 不套用）。
- 機制：**零標記、全站任何字可改**；只比對「整段相等」，不會把長句中的字亂代換。暫不替換表單 placeholder 等屬性文字。
- **兩種編輯方式**（同步）：① 後台 `/admin.html`「**文案**」分頁（搜尋原文 → 改「新文字」→ 儲存，只回寫有變更的列）② 直接編 Google「文案」Sheet。
- 後端：`textGet`（公開，前台讀）／`textList`＋`textSave`（後台，需 token）皆讀 Script Property `SHEET_TEXT` 指向的「文案」Sheet。
- 建立：把 `嗅覺島-文案表-匯入Google用.csv`（已 gitignore）匯入成新 Google Sheet → 把 Sheet ID 設成 Apps Script 的 `SHEET_TEXT` 屬性 → 重新部署 Code.gs。

**⑥ 調香師專區（獨立頁 + CRUD，2026-06-17）**：獨立頁面 `#page-perfumers`，由上方導覽列「調香師」按鈕跳轉（非首頁區塊）。後台「調香師」分頁可新增／編輯／刪除（姓名・照片URL・介紹・社群連結・是否公開），存 Apps Script 屬性 `SHEET_PERFUMERS` 指向的 Sheet（首次存取自動補表頭），前台 `loadPerfumers` 即時顯示。後端 `perfumerList/Save/Delete/perfumersPublic`。

**⑦ L1/L2 版面控制延伸到各獨立頁（2026-06-17）**：版面設定原本只控首頁區塊，現延伸到關於／展覽資訊／特色體驗／年度大賞／B2B媒體各頁。
- 機制：各獨立頁段落加 `data-section` 標記；layout 結構從 `sections`(首頁) 擴成 `sections + pages{about,visit,experience,awards,partners}`；`app.js applyLayout` 依 `cfg.pages` 對各頁段落排序／顯示隱藏（未列入者自動排最後）。
- 後台：版面設定加「分頁切換」鈕，逐頁 ↑↓ 排序＋勾選顯示/隱藏；下方仍有「導覽列項目（整頁開關）」與購票/報名開關。
- 啟用：後台版面設定**存一次即生效**；重部署 Code.gs 為可選（只影響沒存過的預設狀態）。

**⑧ 近期內容／部署更新（2026-06-16~17）**：
- **英文名改 SOUL LAND**（原 SCENT ISLAND；網域/email 維持 soulland 不動）。
- **攤位改一次付清**（攤位費全額＋保證金，移除簽約訂金50%/尾款）。單一價：3×3 **35,000**・2×2 **28,000**・供應鏈 **30,000**・市集 **6,000**；保證金 10,000/格、展後45天退。報名 Sheet 結構不變（「簽約應繳」欄值＝全額+保證金）。
- **首頁底部「媒體夥伴」專區**（生活風格／文化設計／數位KOL 三組）。
- **Meta Pixel**（PageView，像素 ID 26705614572453923）植入對外頁 `<head>`（admin 不裝）。
- **上線**：GitHub 公開 repo → **Netlify 部署**，正式網域 **https://soullandtw.com**（GoDaddy 網域＋Let's Encrypt SSL）。`netlify.toml` 對 *.html/*.js/*.css no-cache。另備 GitHub Pages 搬遷（gh-pages 分支＋CNAME，未啟用）。

## 4. 內容來源

| 來源檔（客戶提供） | 用途 |
|---|---|
| `嗅覺島招商品牌簡報.pdf`（19 頁） | 全站文案：展覽定位、規模、特色體驗、年度大賞、時間表、方案費用、申請流程 |
| `souland_pv-v0.1-01.jpg` | 牛皮紙 logo lockup → `public/assets/logo-kraft.jpg` |
| `未命名-7-02.jpg` | 霧藍島嶼主視覺海報 → `public/assets/poster-island.jpg` |
| `souland_pv-v0.1-03.jpg` | 品牌延伸視覺 → `public/assets/pv-03.jpg` |

## 5. 設計系統（霧藍島嶼 × 牛皮紙）

- 底色牛皮紙 `#EDE3D1`、墨黑 `#211E18`、霧藍 `#5E7891`/`#2E4257`、金 `#C2A05E`（月亮）。
- 字體：標題 Noto Serif TC、英文 Cormorant Garamond（斜體小標）、內文 Noto Sans TC。
- 紙質噪點疊層、地形等高線 SVG 動機、東方留白、金色細分隔線。

## 6. 階段完成度（§3.1 / §3.3）

| 階段 | 內容 | % |
|---|---|---|
| P0 內容萃取 | 解析 PDF 19 頁 + 3 張視覺 | ✅ 100% |
| P1 設計系統 + 主頁五區 | 主頁/展覽資訊/特色體驗/參展品牌/年度大賞 | ✅ 100% |
| P2 報名頁 | 4 方案 + 申請流程 + 報名表 + 費用試算 | ✅ 100% |
| P3 金流（測試） | 綠界 ECPay STAGE 端對端、CheckMacValue 驗證 PASS | ✅ 100% |
| P4 Google Sheet 回寫 | Apps Script 後端：報名/品牌/工作坊/文案/調香師/版面，全走 JSONP | ✅ 100%（已部署、線上驗證） |
| P5 架構圖 + 文件 | 互動架構圖（[`docs/diagrams/2026-06-16_嗅覺島-souland_預設圖/`](docs/diagrams/2026-06-16_嗅覺島-souland_預設圖/)）、SOULAND.md、README、總覽 | ✅ 100%（架構已大改，下次重畫） |
| P6 部署上線 | GitHub repo → **Netlify**，正式網域 **https://soullandtw.com**（SSL） | ✅ 100% |
| P7 後台功能 | 品牌 CRUD・報名管理・文案(L3b)・調香師 CRUD・版面 L1/L2（首頁＋各獨立頁） | ✅ 100% |
| P8 行銷/內容 | Meta Pixel・SOUL LAND・一次付清・媒體夥伴・調香師專區 | ✅ 100% |

**全程約 99%**（站體＋後端＋後台＋網域＋SSL 全上線；剩內容陸續填入＝主辦端日常維運）。

## 7. 治理 · PM 指揮層級（CLAUDE.md §3.6.2.1）

| 層 | 角色 | Agent |
|---|---|---|
| **L1 總PM（唯一領導）** | 跨案總協調、目標對齊硬閘門 | `specialized-chief-of-staff`（Chief of Staff） |
| **L2 分案PM** | 本案專案管理、階段回報 | `project-shepherd`（Project Shepherd） |

> 八拍 plugin-precedence 不適用（本案非 Rytass repo，§0 step 4 已判定為個人/客戶案）。

## 8. 可用 Agent / Skill（§3.6.1 — 已套用）

| Agent / Skill | 在本案的用途 | 狀態 |
|---|---|---|
| Chief of Staff | L1 總PM，掌跨案優先序與目標對齊 | ✅ 啟用 |
| Project Shepherd | L2 分案PM，階段切分與回報 | ✅ 啟用 |
| UI Designer | 霧藍島嶼×牛皮紙視覺系統、配色與排版 | ✅ 套用 |
| Frontend Developer | 多頁前端、互動（護照集章、品牌牆篩選、費用試算） | ✅ 套用 |
| Backend Architect | Express + 綠界金流 CheckMacValue + Sheet 整合 | ✅ 套用 |
| Rapid Prototyper | 本機可跑 MVP 快速建置 | ✅ 套用 |
| Visual Storyteller / Frontend Developer | `docs/diagrams/` 互動架構圖 | ✅ 套用 |
| Accessibility Auditor / Security Engineer | 上線前無障礙 + 金流安全複查 | ⬜ 上線前再用 |

> **「open design」**：採 code-first 直接設計（直接以 HTML/CSS 產出可驗證的成品），未啟動第三方 `nexu-io/open-design` 工具——本機可跑版直接交付更可靠。若日後要在 open-design / Figma 內二次設計，素材與設計 token 已沉澱在 `css/style.css` 變數，可直接匯入。

## 9. 待辦 / 交接

1. 部署 `apps-script/Code.gs` 到你的 Sheet，回填 `REGISTRATION_WEBHOOK_URL`。
2. 正式上線金流時換綠界正式特店資料（`.env`），並用 ngrok / 正式網域讓 `ReturnURL` 可被外網存取。
3. 參展品牌牆目前為「募集中」placeholder，確認品牌後改 `js/main.js` 的 `brands` 陣列或改抓 Sheet。
4. （選）部署到 GitHub Pages + Apps Script，或 Netlify/Vercel Functions。
5. 上線前跑 Accessibility Auditor + Security Engineer 複查。
