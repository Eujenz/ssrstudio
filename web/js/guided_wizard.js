/**
 * SSRStudio v2.1 — Step 1: Guided Director Wizard Component
 * Clear, beginner-friendly entry point with goal explanation and engine transparency badge.
 */

import { api } from './api_client.js';

export const PRESETS = [
  {
    id: 'hell_grind',
    name: '🔥 範例 1：鐵籠格鬥死鬥 (Hell Grind)',
    title: 'Hell Grind Arena',
    idea: '地下拳手 Roco 在鐵籠中迎戰機械宗師 Kane，爭奪最後的自由通行證',
    shotCount: 3,
    stylePreset: 'hell_grind_anamorphic',
  },
  {
    id: 'cyber_heist',
    name: '⚡ 範例 2：量子金庫潛行 (Cyber Heist)',
    title: 'Cyber Heist: Sub-Level 9',
    idea: '駭客 Elena 潛入新東京第 9 區水浸量子金庫，在雷射掃描與武裝無人機逼近前破解主機',
    shotCount: 4,
    stylePreset: 'cyber_noir_anamorphic',
  },
  {
    id: 'snow_bamboo',
    name: '❄️ 範例 3：暴風雪竹林決戰 (Snow Bamboo)',
    title: 'Snow Bamboo Duel',
    idea: '一名獨臂女武士在暴風雪竹林中，用斷刃精準架開機甲忍者的紅外線高頻太刀',
    shotCount: 3,
    stylePreset: 'snow_bamboo_widescreen',
  },
];

export class GuidedWizard {
  constructor({ containerId, onProjectCreated, onToast }) {
    this.container = document.getElementById(containerId);
    this.onProjectCreated = onProjectCreated || (() => {});
    this.onToast = onToast || console.log;
    this.isBootstrapping = false;
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="wizard-container">
        <!-- Step 1 Goal Banner -->
        <div class="step-goal-banner">
          <div style="max-width: 960px;">
            <div class="step-goal-title">
              <span>🎯 Step 1 目標：從「一句話靈感」展開完整電影企劃與分鏡初稿</span>
              <span class="engine-badge real">🟢 本地真實運算 (Python 決定論導演引擎)</span>
            </div>
            <p class="step-goal-desc">
              你不需要自己從頭苦思幾十個鏡頭參數。只要在下方<strong>輸入一句你想拍的故事衝突</strong>（或直接點選 3 個經典範例），系統就會自動幫你拆出「五階段世界觀漏斗」、「角色服裝與聲音鎖定」以及「多顆 2.39:1 分鏡構圖板」。
            </p>
            <div class="step-action-hint">
              👆 <strong>現在請這樣做：</strong> ① 點選任一範例或修改故事大綱 ➔ ② 點擊金色「🚀 展開新專案與分鏡」按鈕（或直接往下捲動檢視目前已載入專案的五幕漏斗）。
            </div>
          </div>
        </div>

        <div class="hero-box">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <h2 style="font-size: 1.2rem; font-weight: 800; color: #fff;">
              ✨ 快速建立新影片專案 (1-Click Project Bootstrap)
            </h2>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">
              執行後將寫入：projects/&lt;project_id&gt;/project.json
            </span>
          </div>

          <div style="margin-bottom: 0.85rem;">
            <label class="wizard-label">
              <span>⚡ 第一步：點選經典範例快速體驗（或自行輸入下方欄位）</span>
              <span class="wizard-label-hint">點擊按鈕會自動帶入下方片名與故事大綱</span>
            </label>
            <div class="preset-pills" id="wizard-presets">
              ${PRESETS.map(p => `
                <button type="button" class="preset-btn" data-preset-id="${p.id}">
                  ${p.name}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="grid-2">
            <div class="wizard-form-group">
              <label class="wizard-label" for="wizard-title">
                <span>專案片名 (Project Title)</span>
                <span class="wizard-label-hint">給你的短片取個名字</span>
              </label>
              <input type="text" id="wizard-title" class="wizard-input" placeholder="例如：Hell Grind Arena" value="${PRESETS[0].title}" />
            </div>

            <div class="grid-2" style="gap: 0.75rem;">
              <div class="wizard-form-group">
                <label class="wizard-label" for="wizard-shot-count">
                  <span>要拆成幾顆鏡頭？</span>
                </label>
                <select id="wizard-shot-count" class="wizard-select">
                  <option value="3" selected>3 顆鏡頭 (建立全景 → 中景對峙 → 特寫爆發)</option>
                  <option value="4">4 顆鏡頭 (起承轉合四步遞進)</option>
                  <option value="5">5 顆鏡頭 (完整敘事短片)</option>
                  <option value="6">6 顆鏡頭 (高密度動作戲)</option>
                </select>
              </div>

              <div class="wizard-form-group">
                <label class="wizard-label" for="wizard-style-preset">
                  <span>視覺攝影風格</span>
                </label>
                <select id="wizard-style-preset" class="wizard-select">
                  <option value="hell_grind_anamorphic" selected>🔥 硬派寫實寬銀幕 (2.39:1 膠卷感)</option>
                  <option value="cyber_noir_anamorphic">⚡ 賽博霓虹高反差 (冷青與雷射紅)</option>
                  <option value="snow_bamboo_widescreen">❄️ 東方武俠暴風雪 (高對比冷冽風)</option>
                </select>
              </div>
            </div>
          </div>

          <div class="wizard-form-group">
            <label class="wizard-label" for="wizard-idea">
              <span>故事核心大綱 / 你想拍的畫面 (Story Idea & Conflict)</span>
              <span class="wizard-label-hint">請寫出「主角是誰、在哪裡、跟誰發生什麼衝突動作」</span>
            </label>
            <textarea id="wizard-idea" class="wizard-textarea" rows="2" placeholder="請描述主角的困境、對手與關鍵戲劇衝突...">${PRESETS[0].idea}</textarea>
          </div>

          <div style="margin-top: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <div style="color: var(--text-muted); font-size: 0.8rem;">
              💡 點擊右側按鈕後，系統會在硬碟生成全新專案、渲染每顆鏡頭的 <code>1920×804</code> 構圖預覽圖，並更新下方「五階段故事漏斗」。
            </div>
            <button type="button" class="btn-primary" id="btn-bootstrap-project">
              <span id="bootstrap-spinner" style="display:none;">⏳</span>
              <span id="bootstrap-btn-text">🚀 展開新專案與分鏡初稿</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const presetButtons = this.container.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const presetId = btn.getAttribute('data-preset-id');
        const found = PRESETS.find(p => p.id === presetId);
        if (found) {
          document.getElementById('wizard-title').value = found.title;
          document.getElementById('wizard-idea').value = found.idea;
          document.getElementById('wizard-shot-count').value = found.shotCount;
          document.getElementById('wizard-style-preset').value = found.stylePreset;
          this.onToast(`已帶入「${found.name}」範例！請點擊「🚀 展開新專案與分鏡初稿」生成專案。`);
        }
      });
    });

    const bootstrapBtn = document.getElementById('btn-bootstrap-project');
    if (bootstrapBtn) {
      bootstrapBtn.addEventListener('click', () => this.handleBootstrap());
    }
  }

  async handleBootstrap() {
    if (this.isBootstrapping) return;

    const title = document.getElementById('wizard-title').value.trim();
    const idea = document.getElementById('wizard-idea').value.trim();
    const shotCount = parseInt(document.getElementById('wizard-shot-count').value, 10) || 3;
    const stylePreset = document.getElementById('wizard-style-preset').value;

    if (!title || !idea) {
      this.onToast('請輸入專案片名與故事核心大綱！', 'error');
      return;
    }

    this.isBootstrapping = true;
    const btnText = document.getElementById('bootstrap-btn-text');
    const spinner = document.getElementById('bootstrap-spinner');
    if (btnText) btnText.textContent = '正在呼叫本地 Python 導演引擎建立專案與分鏡圖...';
    if (spinner) spinner.style.display = 'inline-block';

    try {
      const project = await api.bootstrapWizard({
        title,
        idea,
        shot_count: shotCount,
        style_preset: stylePreset,
      });

      this.onToast(`✅ 新專案「${project.title}」已建立！請在下方檢視五階段故事漏斗，確認後進入 Step 2。`);
      this.onProjectCreated(project);
    } catch (err) {
      console.error('Bootstrap failed:', err);
      this.onToast(`建立專案失敗: ${err.message}`, 'error');
    } finally {
      this.isBootstrapping = false;
      if (btnText) btnText.textContent = '🚀 展開新專案與分鏡初稿';
      if (spinner) spinner.style.display = 'none';
    }
  }
}
