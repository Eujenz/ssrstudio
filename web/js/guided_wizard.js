/**
 * SSRStudio v2 — Guided Director Wizard Component
 * Allows 1-click bootstrap of industrial AI video projects with 5-stage story funnel,
 * characters, locations, props, spatial blocking, and animatic slates.
 */

import { api } from './api_client.js';

export const PRESETS = [
  {
    id: 'hell_grind',
    name: '🔥 Hell Grind 鐵籠死鬥',
    title: 'Hell Grind Arena',
    idea: '地下拳手 Roco 在鐵籠中迎戰機械宗師 Kane，爭奪最後的自由通行證',
    shotCount: 3,
    stylePreset: 'hell_grind_anamorphic',
  },
  {
    id: 'cyber_heist',
    name: '⚡ Cyber Heist 量子金庫潛行',
    title: 'Cyber Heist: Sub-Level 9',
    idea: '駭客 Elena 潛入新東京第 9 區水浸量子金庫，在雷射掃描與武裝無人機逼近前破解主機',
    shotCount: 4,
    stylePreset: 'cyber_noir_anamorphic',
  },
  {
    id: 'snow_bamboo',
    name: '❄️ Snow Bamboo 暴風雪竹林決戰',
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
        <div class="hero-box">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
            <h1 class="hero-title">✨ AI 導演引導工作台 (Guided Director)</h1>
            <span class="studio-version-tag">INDUSTRIAL SPEC v2.0</span>
          </div>
          <p class="hero-desc">
            無需手動編寫繁瑣的 15-Block 提示詞與視線鎖定。只需提供一句話核心創意或點選預設主題，本地決定論引導導演將自動展開 5 階段故事漏斗、@角色與場景連續性鎖、2D 走位與 2.39:1 技術分鏡板。
          </p>

          <div style="margin-bottom: 0.6rem;">
            <label class="wizard-label">⚡ 點選經典高張力電影片段預設</label>
            <div class="preset-pills" id="wizard-presets">
              ${PRESETS.map(p => `
                <button type="button" class="preset-btn" data-preset-id="${p.id}">
                  ${p.name}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="wizard-form-group">
            <label class="wizard-label" for="wizard-title">專案片名 (Project Title)</label>
            <input type="text" id="wizard-title" class="wizard-input" placeholder="例如：Hell Grind Arena" value="${PRESETS[0].title}" />
          </div>

          <div class="wizard-form-group">
            <label class="wizard-label" for="wizard-idea">故事核心大綱 / 衝突設定 (Story Idea & Core Conflict)</label>
            <textarea id="wizard-idea" class="wizard-textarea" rows="3" placeholder="請描述主角的困境、對手與關鍵戲劇衝突...">${PRESETS[0].idea}</textarea>
          </div>

          <div class="grid-2">
            <div class="wizard-form-group">
              <label class="wizard-label" for="wizard-shot-count">分鏡鏡頭數 (Shot Count: 3 - 8 鏡)</label>
              <select id="wizard-shot-count" class="wizard-select">
                <option value="3" selected>3 鏡頭 (標準極短篇三幕弧線)</option>
                <option value="4">4 鏡頭 (緊張遞進四步走)</option>
                <option value="5">5 鏡頭 (完整起承轉合)</option>
                <option value="6">6 鏡頭 (高密度動作段落)</option>
                <option value="8">8 鏡頭 (完整敘事預告篇)</option>
              </select>
            </div>

            <div class="wizard-form-group">
              <label class="wizard-label" for="wizard-style-preset">攝影與視覺風格預設 (Cinematography Preset)</label>
              <select id="wizard-style-preset" class="wizard-select">
                <option value="hell_grind_anamorphic" selected>🔥 Hell Grind 變形寬銀幕硬漢膠卷風 (2.39:1 / 35mm)</option>
                <option value="cyber_noir_anamorphic">⚡ Cyber Noir 冷冽青紅霓虹高對比 (2.39:1 / 50mm)</option>
                <option value="snow_bamboo_widescreen">❄️ Snow Bamboo 暴風雪水墨極簡黑白 (2.39:1 / 85mm)</option>
              </select>
            </div>
          </div>

          <div style="margin-top: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
            <div style="color: var(--text-dim); font-size: 0.8rem; font-family: var(--font-mono);">
              🛡️ 自動包含：Pillow 2.39:1 Animatic Slate + 20 點 QA 驗證 + 具名連續性鎖
            </div>
            <button type="button" class="btn-primary" id="btn-bootstrap-project">
              <span id="bootstrap-spinner" style="display:none;">⏳</span>
              <span id="bootstrap-btn-text">🚀 一鍵生成完整分鏡與資產審批看板</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // Preset buttons
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
          this.onToast(`已套用「${found.name}」劇本預設！`);
        }
      });
    });

    // 1-Click bootstrap button
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
      this.onToast('請輸入專案名稱與故事核心大綱！', 'error');
      return;
    }

    this.isBootstrapping = true;
    const btnText = document.getElementById('bootstrap-btn-text');
    const spinner = document.getElementById('bootstrap-spinner');
    if (btnText) btnText.textContent = '導演引擎全速編譯中 (生成分鏡與 Animatic)...';
    if (spinner) spinner.style.display = 'inline-block';

    try {
      const project = await api.bootstrapWizard({
        title,
        idea,
        shot_count: shotCount,
        style_preset: stylePreset,
      });

      this.onToast(`專案「${project.title}」已成功建置！共產生 ${project.shots.length} 顆鏡頭。`);
      this.onProjectCreated(project);
    } catch (err) {
      console.error('Bootstrap failed:', err);
      this.onToast(`建立專案失敗: ${err.message}`, 'error');
    } finally {
      this.isBootstrapping = false;
      if (btnText) btnText.textContent = '🚀 一鍵生成完整分鏡與資產審批看板';
      if (spinner) spinner.style.display = 'none';
    }
  }
}
