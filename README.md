# HELL GRIND Pipeline Studio
### 剪紙繪本與導演工作台風格 • 工業級 AI 電影提示詞與管線架構系統
> **Validated by the 2026 Cannes Feature Film *Hell Grind***  
> Supported AI Models: **Seedance 2.0**, **Higgsfield Soul 2.0 / Soul Cinema**, **Nano Banana Pro (NBP)**, **Seedream 4.5**, and **GPT Image 2**.

---

## 📖 簡介 (Introduction)
**HELL GRIND Pipeline Studio** 是一套專為零基礎創作者與獨立電影導演打造的**互動式 AI 短片全流程架構工作台**。

本系統全盤收錄並工程化了坎城獲獎電影《Hell Grind》驗證的工業級電影製作法則，直擊 AI 視頻生成中最昂貴的六大死線災難：
1. **全景臉漂 (Face Drift)**
2. **空間瞬移 (Character Teleportation)**
3. **死板眼神 (Dead Eyes)**
4. **空氣抓握 (Mimed Manipulation)**
5. **台詞亂動嘴 (Post-Line Filler-Babble)**
6. **提示詞污染 (Prompt Pollution & Latent Hallucination)**

---

## 🎨 視覺風格：剪紙繪本與導演工作台 (Tactile Paper-Cut Workbench)
- **羊皮紙底色 (Parchment)**：`#f4ece1` 搭配手繪微格紋
- **卡片紙質 (Card Surfaces)**：`#fbf7f0`
- **墨黑邊框 (Ink Borders)**：`2.5px solid #25211e`
- **硬邊紙雕陰影 (Paper-Cut Shadows)**：`6px 6px 0px #25211e`
- **和紙膠帶飾帶 (Washi Tape Ribbons)**：
  - 緋紅 (Crimson): `#b92b27`
  - 晶藍 (Crystal Blue): `#2b7a9b`
  - 暖金 (Warm Gold): `#d49a35`
  - 鼠尾草綠 (Sage): `#4a6b5b`
- **深邃黑曜石代碼終端 (Obsidian Terminals)**：`#1e1b18`
- **雙語介面切換**：`雙語輔助 (BI)` / `純繁中介面 (ZH)` / `English UI (EN)`

---

## 🧭 六大引導階段架構 (The 6 Guided Stages)

### 0. 算力漏斗與立項評估 (Scope & Compute Funnel Calculator)
- **坎城實戰錄取率基準**：
  - **設定圖錄取率 1.0%**（約每 100 抽獲得 1 張鎖定圖；主角基準約 800 抽）。
  - **視頻鏡頭錄取率 1.5%**（約每 65–100 抽獲得 1 鏡可用剪輯鏡頭）。
- **雙週攻堅時間表**：
  - **Phase 1（粗剪骨架，前 7 天）**：迅速填滿時間軸，先求有再求好，忽略輕微瑕疵。
  - **Phase 2（70% 算力狂飆，後 7 天）**：集中 70% 算力狂攻主角高壓對決特寫 (Hero Close-ups)。

### 1. 資產鍛造與無頭設定圖工坊 (Asset Forge & Gatekeeper)
- **黃金法則 #1：資產未立，禁止開鏡 (Assets First)**
  - 10/10 壓力測試檢查表未過關前，鎖定 Stage 4 提示詞生成。
- **角色三視圖建構器 (`@char_tag`)**：
  - 模型路由：`Higgsfield Soul 2.0 (16:9, 2K, Soul ID)`（警示 Soul 2.0 不支援 21:9）。
  - **無頭法則 (The Headless Law)**：Panel 1 正面全身照徹底抹除頭部，強迫模型在全景時從 Panel 3 高解析特寫取樣面孔，消滅遠景臉漂。
  - **無聊設定圖鐵則**：鎖定中灰純色背景 (`#808080`) 與平光，嚴禁烘焙顆粒或強色調。
  - **狀態拆分器**：1鍵複製為 `@hero_wet`、`@hero_blood`、`@hero_wounded`。
  - **聲線身分鎖**：鎖定年齡、音色、節奏、情緒壓迫為不可變字面字串。
- **場景空鏡盤建構器 (`@loc_tag`)**：
  - 模型路由：`Higgsfield Soul Cinema (21:9)`。
  - 強制 3/4 斜對角俯視錨定、單一主光源邏輯、明確空間錨定物。
  - 反打鏡頭逆向秘技（NBP 鏡像法 / Seedance 空鏡運鏡抽幀法）。
- **道具紅箭頭標註工作台 (`@prop_tag`)**：
  - HTML5 互動畫布，拖曳繪製紅箭頭鎖定手部接觸點，消滅空氣抓握。
- **圖像微創手術三步法 (Surgical Mask Pipeline)**：
  - 1. NBP（遮罩定點微調）➔ 2. Seedream 4.5（材質廢料拯救）➔ 3. GPT Image 2（微創最後手段）。

### 2. GEO 空間平面圖與 180° 越軸雷達 (Spatial Radar)
- **互動 2D 舞台頂視圖畫布 (HTML5 Canvas)**：
  - 標示主錨定物（3米圓形訓練墊）與次級道具。
  - 角色標記獨立控制「**身軀朝向角度 (Torso)**」與「**獨立視線凝視角度 (Gaze)**」。
  - 180° 攝影機軸線（嚴禁越軸）與逆光 (Contre-Jour) 陰影側拍攝規劃。
- **嚴格空間詞彙攔截器 (Strict GEO Linter)**：
  - 自動攔截並替換 `near`、`around`、`beside` 等模糊詞，改為精確公尺與 `frame-LEFT`/`frame-RIGHT` 定位。

### 3. 梅斯納行為演技與音軌隔離室 (Meisner Acting Lab)
- **梅斯納核心公理**：「演戲是高壓下的具體行為，不是情緒展示。」
- **五大支柱建構表**：
  - 1. 目標 Objective（對對手施加的動作動詞）
  - 2. 障礙與生死賭注 Obstacle & Stakes
  - 3. 戰術轉折鏈 Tactic Shift
  - 4. 忙碌雙手 Hand Business
  - 5. 停頓重音 Interrupted Accent
- **情緒形容詞與定格攔截器**：
  - 即時阻擋 `angry`、`sad`、`nervous`、`frozen`，1鍵轉譯為肌肉抽動、呼吸頻率與下唇緊繃。
- **靈動眼神與三段式微眨眼 (Phased Eye-Life)**：
  - 注入 `one lazy blink -> quick double-blink -> hard reset-blink; eyes reach target 0.5s before head`。
- **台詞隔離與防亂動嘴音軌 (Filler-Babble Fix)**：
  - 台詞與動作完全隔離，注入坎城專利閉嘴鎖。

### 4. 15層 CINEDANCE 組裝機 (15-Block Shot Compiler)
- **完整的 15 層提示詞骨架**：
  1. `GLOBAL_STYLE_PREFIX`
  2. `POSITIVE_CONSTRAINTS`
  3. `CAMERA_PERSPECTIVE_AND_FOV`
  4. `CAMERA_MOTION_AND_SPEED`
  5. `LIGHTING_AND_COLOR_SCIENCE`
  6. `LOCATION_ENVIRONMENT_PLATE`
  7. `SPATIAL_ANCHORS_AND_GEO`
  8. `CHARACTER_IDENTITY_AND_WARDROBE`
  9. `HERO_PROPS_AND_INTERACTION`
  10. `MEISNER_OBJECTIVE_AND_BEHAVIOR`
  11. `EYE_LIFE_AND_MICRO_EXPRESSIONS`
  12. `ACTION_TIMING_BEATS`
  13. `SEAM_STITCH_AND_FIRST_SECOND_WIDE`
  14. `ISOLATED_AUDIO_AND_DIALOGUE`
  15. `NEGATIVE_AND_ANTI_DRIFT_LOCKS`
- **核心光學決策樹**：
  - 嚴格禁用 `mm`、`f-stop`、`ISO`。提供 6 款 canonical 對角線 FOV（`107°`, `84°`, `47°`, `29°`, `18°`, `8°`）。
- **黃金第 1 秒定裝與片尾台詞縫合 (0.0–1.0s Holding Beat)**。
- **三句上限分秒動作拍**。
- **20 項導演靜默自我審查 (Live 20-Point QA Checklist)**。

### 5. 單變量手術日誌與急救室 (Doctor & Diff Log)
- **版本對比引擎 (Diff Checker)**：高亮行對比，重寫超過 20% 自動警告。
- **10–15 次迭代停損警報 (Stop-Loss Siren)**：
  - 第 10 次觸發黃色警報。
  - 第 15 次啟動紅色停損警報（「停止換詞！此動作已超出模型潛在空間」）。
  - **1鍵降維救援方案**：拆分為兩鏡 / 切換為胸上中特寫 / 移除次要道具。
- **6 大死線災難一鍵急救室**：
  1. 滑步漂移 (Walking Float) ➔ 注入地面接觸陰影鎖
  2. 空氣抓握 (Mimed Manipulation) ➔ 注入紅箭頭接觸與指節泛白鎖
  3. 打鬥斷裂 (Choppy Fight Cuts) ➔ 注入 0.0s 慣性繼承
  4. 破門卡死 (Door/Impact Freeze) ➔ 注入 0.0s 已埋入三寸預爆裂
  5. 巨物縮小 (Shrinking Giant) ➔ 注入巨物絕對比例尺度律
  6. 講完話亂動嘴 (Post-Line Babble) ➔ 注入下顎緊閉絕對靜音鎖

---

## 🚀 如何運行 (How to Run)

本系統為 **Zero-Dependency（零依賴）** 輕量架構，無需任何 `npm install` 或編譯打包步驟。

### 方法 1：直接在瀏覽器開啟
直接在 Windows 檔案總管中雙擊 `index.html`，或將檔案拖入 Google Chrome / Microsoft Edge / Safari 即可完整運行。

### 方法 2：使用本機輕量伺服器
```powershell
# 使用 Python 內建伺服器
python -m http.server 8000
```
瀏覽器訪問：`http://localhost:8000`

---

## 💾 專案存檔與範本
- **自動保存**：所有修改即時儲存於瀏覽器 `localStorage`。
- **坎城獲獎範本**：內建預載《Hell Grind》「Roco's Underground Training Room + Ritual Cliff」全套資產、空間平面圖與提示詞。
- **專案匯入 / 匯出**：支援 1 鍵將專案規格打包為 `.json` 檔案備份或團隊協作分享。
