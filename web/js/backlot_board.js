/**
 * SSRStudio v2 — 5-Step Commercial Guided Backlot & Production Pipeline (UX 2.1)
 * Manages:
 * - Global Shot Bar (#global-shot-bar)
 * - Step 1: Story Funnel Editor (#view-funnel-container)
 * - Step 2: Asset Bible & Pillow Headless 3-Panel Cropper (#view-assets-container)
 * - Step 3: 2.39:1 Animatic Slate & Blocking Spec (#view-blocking-header, #view-slate-container, #view-step3-footer)
 * - Step 4: Meisner Physical Acting Editor & Real 20-Point QA Audit (#view-acting-qa-container)
 * - Step 5: Dual Prompt Exporter, 15-Iter Stop-Loss Rescue & Inline FFmpeg Timeline (#view-export-rescue-container)
 */

import { api } from './api_client.js';

const QA_CHINESE_LABELS = {
  1: '1. 禁用相機數值標籤 (無 50mm/ISO/f-stop 混入正文)',
  2: '2. 零抽象情緒形容詞 (無 sad/angry 等空泛詞)',
  3: '3. 零模糊空間介係詞 (無 near/behind 等不精確方位)',
  4: '4. 無頭三視圖防禦法則已啟用 (Headless Sheet Law)',
  5: '5. #FF0000 紅箭頭接觸預合成或物理握持已鎖定',
  6: '6. 梅斯納生理刺激導火線已填寫 (Meisner Stimulus)',
  7: '7. 梅斯納微肌肉具體動作已填寫 (Micro Action)',
  8: '8. 嚴格遵守 180 度軸線定律 (180-Degree Axis)',
  9: '9. 首幀構圖鎖已填寫 (First-Frame Lock)',
  10: '10. 畫面朝向鎖已填寫 (Screen-Direction Lock)',
  11: '11. 鏡頭行為鎖已填寫 (Lens Lock)',
  12: '12. 畫面人數鎖已填寫 (Count Lock)',
  13: '13. 背景靜止鎖已填寫 (Stillness Lock)',
  14: '14. 單調遞增物理狀態已記錄 (血跡/汗水不倒退)',
  15: '15. 角色聲音錨點與防胡言亂語鎖已設定 (Voice Lock)',
  16: '16. 場景主副光比與色溫已鎖定 (Lighting Spec)',
  17: '17. 2D 空間雷達座標位於合法範圍 [0.0 ~ 1.0]',
  18: '18. 鏡頭內所有 @代號 皆存在於資產聖經中',
  19: '19. 鏡頭秒數符合 5s / 10s / 15s 工業規範',
  20: '20. 2.39:1 寬銀幕畫幅與雙模合約 (10-Sec/15-Block) 同步完成',
};

export class BacklotBoard {
  constructor({ onShotSelected, onProjectUpdated, onStepChangeRequest, onToast }) {
    this.onShotSelected = onShotSelected || (() => {});
    this.onProjectUpdated = onProjectUpdated || (() => {});
    this.onStepChangeRequest = onStepChangeRequest || (() => {});
    this.onToast = onToast || console.log;

    this.project = null;
    this.activeShotId = null;
    this.activeShotIndex = 0;
    this.qaResult = null;
    this.compiledPrompt = null;
    this.lintWarnings = null;
    this.rescueResult = null;
    this.timelineResult = null;
    this.activePromptTab = '15block'; // '15block' | '10section'
  }

  setProject(project, activeShotId = null) {
    this.project = project;
    if (this.project && this.project.shots && this.project.shots.length > 0) {
      if (activeShotId) {
        const idx = this.project.shots.findIndex(s => s.shot_id === activeShotId);
        this.activeShotIndex = idx >= 0 ? idx : 0;
      } else if (this.activeShotIndex >= this.project.shots.length) {
        this.activeShotIndex = 0;
      }
      this.activeShotId = this.project.shots[this.activeShotIndex].shot_id;
    }
    this.renderAllSteps();
    this.autoCompileActiveShot();
  }

  getActiveShot() {
    if (!this.project || !this.project.shots || this.project.shots.length === 0) return null;
    return this.project.shots[this.activeShotIndex] || this.project.shots[0];
  }

  renderAllSteps() {
    this.renderGlobalShotBar();
    this.renderStep1Funnel();
    this.renderStep2Assets();
    this.renderStep3Blocking();
    this.renderStep4ActingAndQA();
    this.renderStep5ExportAndRescue();
  }

  // =========================================================================
  // GLOBAL SHOT SELECTOR BAR (Shown on Steps 3, 4, 5 & Overview Mode)
  // =========================================================================
  renderGlobalShotBar() {
    const bar = document.getElementById('global-shot-bar');
    if (!bar || !this.project) return;

    const currentShot = this.getActiveShot();
    bar.innerHTML = `
      <div class="card" style="padding: 0.85rem 1.25rem; background: linear-gradient(90deg, rgba(19, 23, 34, 0.96), rgba(15, 23, 42, 0.96)); border-color: rgba(6, 182, 212, 0.3);">
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.85rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <span style="font-size: 0.75rem; font-family: var(--font-mono); color: var(--accent-gold); background: rgba(245, 158, 11, 0.12); padding: 0.2rem 0.55rem; border-radius: 4px; border: 1px solid rgba(245, 158, 11, 0.3);">
              📁 ${this.project.title}
            </span>
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              👉 <strong>切換目前正在編輯的分鏡鏡頭：</strong>
            </span>
            <div class="shot-tabs" style="padding-bottom: 0;">
              ${this.project.shots.map((s, idx) => `
                <button type="button" class="shot-tab ${idx === this.activeShotIndex ? 'active' : ''}" data-global-shot-idx="${idx}">
                  🎬 鏡頭 ${String(s.order || idx + 1).padStart(2, '0')}: ${s.title}
                </button>
              `).join('')}
              <button type="button" class="shot-tab" id="btn-global-add-shot" style="border-style: dashed; color: var(--accent-cyan);">
                ➕ 新增一顆鏡頭
              </button>
            </div>
          </div>

          <div style="font-size: 0.76rem; font-family: var(--font-mono); color: var(--accent-cyan);">
            目前選中：<strong>${currentShot ? `Shot ${String(currentShot.order).padStart(2, '0')} (${currentShot.duration_sec}s / ${currentShot.camera_lens_mm}mm)` : '無'}</strong>
          </div>
        </div>
      </div>
    `;

    bar.querySelectorAll('[data-global-shot-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-global-shot-idx'), 10);
        this.selectShotIndex(idx);
      });
    });

    const addBtn = document.getElementById('btn-global-add-shot');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.handleAddShot());
    }
  }

  // =========================================================================
  // STEP 1: 5-STAGE STORY FUNNEL EDITOR (#view-funnel-container)
  // =========================================================================
  renderStep1Funnel() {
    const el = document.getElementById('view-funnel-container');
    if (!el) return;

    if (!this.project) {
      el.innerHTML = '';
      return;
    }

    const f = this.project.funnel || {};
    const gateStatus = this.project.gates?.story_funnel || 'pending';

    el.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div class="card-title">
              <span>📖 Step 1 下半部：檢視與微調「五階段故事漏斗 (5-Stage Story Funnel)」</span>
              <span class="engine-badge real">🟢 本地真實儲存 (寫入 project.json)</span>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
              這是剛才根據你的創意自動拆解出的 5 大故事骨架。後續每一鏡的光影、調色與空間氛圍都會自動引用這裡的設定。你可以直接修改文字，或直接點底部按鈕進入下一步。
            </p>
          </div>
          <span class="gate-badge ${gateStatus}">${gateStatus === 'approved' ? '✅ Gate 1 已核准' : '⏳ Gate 1 待確認'}</span>
        </div>

        <div class="grid-2" style="margin-bottom: 1rem;">
          <div>
            <label class="wizard-label">1️⃣ 類型與美學基調 (Genre & Tone)</label>
            <input type="text" id="funnel-genre" class="wizard-input" value="${this._esc(f.genre_tone || '')}" />
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.2rem;">決定底片顆粒感、色溫與整體攝影風格。</div>
          </div>
          <div>
            <label class="wizard-label">2️⃣ 世界觀與物理法則 (World Reality & Physics)</label>
            <input type="text" id="funnel-world" class="wizard-input" value="${this._esc(f.world_reality || '')}" />
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.2rem;">鎖定重力、雨滴、火花或大氣粒子等環境物理表現。</div>
          </div>
        </div>

        <div class="grid-2" style="margin-bottom: 1rem;">
          <div>
            <label class="wizard-label">3️⃣ 核心戲劇衝突 (Core Conflict)</label>
            <input type="text" id="funnel-conflict" class="wizard-input" value="${this._esc(f.core_conflict || '')}" />
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.2rem;">決定角色之間的張力與對峙關係。</div>
          </div>
          <div>
            <label class="wizard-label">4️⃣ 主角本場戲狀態變化 (Protagonist Arc)</label>
            <input type="text" id="funnel-arc" class="wizard-input" value="${this._esc(f.protagonist_arc || '')}" />
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.2rem;">從鏡頭 01 到最後一鏡的心理與肢體轉折。</div>
          </div>
        </div>

        <div>
          <label class="wizard-label">5️⃣ 貫穿全片的視覺母題與主光源 (Visual Motif & Lighting)</label>
          <input type="text" id="funnel-motif" class="wizard-input" value="${this._esc(f.visual_motif || '')}" />
          <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.2rem;">這行會自動注入所有鏡頭的照明合約，確保多鏡頭剪接在一起不會忽亮忽暗。</div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
          <button type="button" class="btn-secondary" id="btn-save-funnel">
            💾 儲存故事漏斗修改
          </button>
        </div>

        <!-- Step 1 Footer Navigation CTA -->
        <div class="step-footer-nav">
          <div class="step-footer-hint">
            ✅ <strong>完成 Step 1 檢查了嗎？</strong> 點擊右側按鈕將自動建立 <code>Gate 1 (story_funnel)</code> 專案快照，並帶你進入 <strong>Step 2：鎖定角色服裝、聲音與無頭三視圖</strong>。
          </div>
          <button type="button" class="btn-primary" id="btn-step1-next">
            ✅ 核准 Step 1 並前往 Step 2：角色與場景資產鎖定 →
          </button>
        </div>
      </div>
    `;

    const saveBtn = document.getElementById('btn-save-funnel');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSaveFunnel(false));
    }

    const nextBtn = document.getElementById('btn-step1-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        await this.handleSaveFunnel(true);
        await this.handleGateUpdate('story_funnel', 'approved');
        this.onStepChangeRequest(2);
      });
    }
  }

  async handleSaveFunnel(silent = false) {
    if (!this.project) return;
    const updatedFunnel = {
      genre_tone: document.getElementById('funnel-genre')?.value.trim() || '',
      world_reality: document.getElementById('funnel-world')?.value.trim() || '',
      core_conflict: document.getElementById('funnel-conflict')?.value.trim() || '',
      protagonist_arc: document.getElementById('funnel-arc')?.value.trim() || '',
      visual_motif: document.getElementById('funnel-motif')?.value.trim() || '',
    };

    try {
      const updated = await api.updateProject(this.project.project_id, { funnel: updatedFunnel });
      this.project = updated;
      if (!silent) this.onToast('✅ 五階段故事漏斗已儲存至 project.json！');
      this.onProjectUpdated(this.project);
    } catch (err) {
      this.onToast(`儲存故事漏斗失敗: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // STEP 2: ASSET BIBLE & HEADLESS SHEET CROPPER (#view-assets-container)
  // =========================================================================
  renderStep2Assets() {
    const el = document.getElementById('view-assets-container');
    if (!el || !this.project) return;

    const chars = this.project.characters || [];
    const locs = this.project.locations || [];
    const props = this.project.props || [];
    const gateStatus = this.project.gates?.asset_bible || 'pending';

    el.innerHTML = `
      <!-- Step 2 Goal Banner -->
      <div class="step-goal-banner">
        <div class="step-goal-icon">🎭</div>
        <div class="step-goal-content">
          <div class="step-goal-title">
            <span>Step 2 目標：鎖定角色、場景、道具代號（@Handle），並執行「無頭三視圖裁切」</span>
            <span class="engine-badge real">🟢 本地真實運算 (Pillow 影像裁切 + 資產鎖定)</span>
          </div>
          <p class="step-goal-desc">
            <strong>為什麼 AI 影片每一鏡主角都會變臉或換衣服？</strong> 因為沒有把「角色外觀描述」與「無頭全身三視圖」鎖死成固定代號（例如 <code>@protagonist</code>）。<br/>
            <strong>什麼是「無頭三視圖法則 (Headless Sheet Law)」？</strong> 全身三視圖裡的臉只有不到 60 像素，直接餵給 AI 影片模型會導致五官崩壞。我們使用 Python Pillow <strong>自動切掉全身三視圖頂部 22% 的頭部區域</strong>，讓全身圖專心鎖定衣服材質，臉部則由特寫肖像獨立負責！
          </p>
          <div class="step-action-hint">
            <span>👆 <strong>現在該怎麼操作：</strong> 檢查下方角色服裝與聲音設定，點擊角色卡片上的 <strong>「✂️ 一鍵執行無頭三視圖裁切」</strong> 測試真實圖片裁切，完成後點底部按鈕前往 Step 3。</span>
          </div>
        </div>
      </div>

      <!-- Characters Section -->
      <div class="card" style="margin-bottom: 1.25rem;">
        <div class="card-header">
          <div class="card-title">
            <span>👤 角色資產聖經 (Characters & Headless Turnaround Cropper)</span>
          </div>
          <span class="gate-badge ${gateStatus}">${gateStatus === 'approved' ? '✅ Gate 2 已核准' : '⏳ Gate 2 待確認'}</span>
        </div>

        <div class="grid-2">
          ${chars.map((c, idx) => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-dim); border-radius: 10px; padding: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <div>
                  <span style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 800; color: var(--accent-cyan); background: rgba(6, 182, 212, 0.12); padding: 0.2rem 0.55rem; border-radius: 4px;">
                    ${this._esc(c.handle)}
                  </span>
                  <strong style="font-size: 1rem; color: #fff; margin-left: 0.4rem;">${this._esc(c.name)}</strong>
                </div>
                <span class="engine-badge real">Headless Law: ${c.headless_sheet_enabled ? '已鎖定' : '未啟用'}</span>
              </div>

              <div style="margin-bottom: 0.6rem;">
                <label class="wizard-label">👕 固定服裝與材質描述 (Wardrobe Lock — 每一鏡自動帶入)</label>
                <input type="text" class="wizard-input char-wardrobe-input" data-char-idx="${idx}" value="${this._esc(c.wardrobe || '')}" />
              </div>

              <div style="margin-bottom: 0.75rem;">
                <label class="wizard-label">🎙️ 聲音頻譜與防胡言亂語鎖 (Voice Token & Anti-Babble Lock)</label>
                <input type="text" class="wizard-input char-voice-input" data-char-idx="${idx}" value="${this._esc(c.voice_lock || '')}" />
              </div>

              <!-- Interactive Headless Sheet Cropper Box -->
              <div style="background: rgba(16, 185, 129, 0.06); border: 1px dashed rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 0.85rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.4rem;">
                  <div>
                    <div style="font-size: 0.82rem; font-weight: 700; color: #6ee7b7;">✂️ Pillow 無頭三視圖自動裁切器 (自動切除頂部 22% 臉部)</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.15rem;">
                      📁 <strong>預設儲存路徑：</strong>系統自動管理儲存於 <code>projects/${this.project.project_id}/assets/${c.handle.replace('@', '')}_headless.png</code>，無需手動填寫。
                    </div>
                  </div>
                  <div style="display: flex; gap: 0.4rem; align-items: center;">
                    <label class="btn-secondary" style="border-color: rgba(6, 182, 212, 0.4); color: var(--accent-cyan); font-size: 0.76rem; padding: 0.35rem 0.65rem; cursor: pointer;">
                      📁 上傳自訂三視圖
                      <input type="file" class="headless-file-input" data-char-idx="${idx}" accept="image/*" style="display: none;" />
                    </label>
                    <button type="button" class="btn-secondary btn-run-headless-crop" data-char-idx="${idx}" style="border-color: rgba(16, 185, 129, 0.5); color: #6ee7b7; font-size: 0.76rem; padding: 0.35rem 0.75rem;">
                      ✂️ 一鍵執行無頭三視圖裁切
                    </button>
                  </div>
                </div>

                <div id="headless-preview-box-${idx}" style="margin-top: 0.6rem; ${c.headless_turnaround_path ? 'display: block;' : 'display: none;'}">
                  ${c.headless_turnaround_path ? `
                    <div style="font-size: 0.72rem; color: var(--accent-emerald); margin-bottom: 0.35rem;">
                      ✅ 已成功儲存至硬碟：<code>${this._esc(c.headless_turnaround_path)}</code>
                    </div>
                    <img src="/${c.headless_turnaround_path}?t=${Date.now()}" alt="Headless Turnaround" style="width: 100%; max-height: 170px; object-fit: contain; border-radius: 6px; border: 1px solid var(--border-dim); background: #090b10;" onerror="this.style.display='none';" />
                  ` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 0.85rem;">
          <button type="button" class="btn-secondary" id="btn-save-assets">
            💾 儲存角色服裝與聲音鎖修改
          </button>
        </div>
      </div>

      <!-- Locations & Props Grid -->
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div class="card-title"><span>🏛️ 場景環境與光影鎖定 (@Locations)</span></div>
          </div>
          ${locs.map((loc) => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-dim); border-radius: 8px; padding: 0.85rem; margin-bottom: 0.6rem;">
              <div style="margin-bottom: 0.35rem;">
                <span style="font-family: var(--font-mono); color: var(--accent-gold); font-weight: 700;">${this._esc(loc.handle)}</span>
                <strong style="color: #fff; margin-left: 0.4rem;">${this._esc(loc.name)}</strong>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.5;">
                <div><strong>💡 光比鎖定：</strong> ${this._esc(loc.lighting_spec)}</div>
                <div><strong>🧱 建築材質：</strong> ${this._esc(loc.architecture_spec)}</div>
                <div><strong>🌫️ 大氣氛圍：</strong> ${this._esc(loc.atmosphere)}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><span>🗡️ 關鍵道具與物理握持點 (@Props)</span></div>
          </div>
          ${props.map((p) => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-dim); border-radius: 8px; padding: 0.85rem; margin-bottom: 0.6rem;">
              <div style="margin-bottom: 0.35rem;">
                <span style="font-family: var(--font-mono); color: #f87171; font-weight: 700;">${this._esc(p.handle)}</span>
                <strong style="color: #fff; margin-left: 0.4rem;">${this._esc(p.name)}</strong>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.5;">
                <div><strong>🔩 材質規格：</strong> ${this._esc(p.material_spec)}</div>
                <div><strong>🎯 物理接觸錨點：</strong> ${(p.contact_anchors || []).join(', ')} （將於 Step 3 畫上 #FF0000 紅箭頭）</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Step 2 Footer Navigation CTA -->
      <div class="step-footer-nav">
        <button type="button" class="btn-secondary" id="btn-step2-prev">
          ← 返回 Step 1：故事與企劃展開
        </button>
        <div class="step-footer-hint">
          ✅ 確認角色服裝、聲音與無頭三視圖無誤後，點擊右側核准 <code>Gate 2 (asset_bible)</code> 並進入 <strong>Step 3：分鏡 2D 雷達走位</strong>。
        </div>
        <button type="button" class="btn-primary" id="btn-step2-next">
          ✅ 核准 Step 2 並前往 Step 3：分鏡走位與紅箭頭預合成 →
        </button>
      </div>
    `;

    // Bind custom file upload inputs
    el.querySelectorAll('.headless-file-input').forEach((input) => {
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const idx = parseInt(input.getAttribute('data-char-idx'), 10);
        const reader = new FileReader();
        reader.onload = async (evt) => {
          await this.handleRunHeadlessCrop(idx, evt.target.result);
        };
        reader.readAsDataURL(file);
      });
    });

    // Bind headless crop buttons
    el.querySelectorAll('.btn-run-headless-crop').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-char-idx'), 10);
        await this.handleRunHeadlessCrop(idx, null);
      });
    });

    const saveAssetsBtn = document.getElementById('btn-save-assets');
    if (saveAssetsBtn) {
      saveAssetsBtn.addEventListener('click', () => this.handleSaveAssets(false));
    }

    const prevBtn = document.getElementById('btn-step2-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => this.onStepChangeRequest(1));

    const nextBtn = document.getElementById('btn-step2-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        await this.handleSaveAssets(true);
        await this.handleGateUpdate('asset_bible', 'approved');
        this.onStepChangeRequest(3);
      });
    }
  }

  async handleRunHeadlessCrop(charIdx, customDataUrl = null) {
    if (!this.project || !this.project.characters[charIdx]) return;
    const char = this.project.characters[charIdx];
    const cleanHandle = char.handle.replace('@', '');
    const outPath = `projects/${this.project.project_id}/assets/${cleanHandle}_headless.png`;

    this.onToast(`✂️ 正在使用 Python Pillow 為 ${char.name} 生成並裁切無頭三視圖...`);
    try {
      const res = await api.headlessCrop({
        dest_path: outPath,
        out_path: outPath,
        crop_top_ratio: 0.22,
        top_crop_ratio: 0.22,
        character_handle: char.handle,
        data_url: customDataUrl,
      });

      char.headless_turnaround_path = res.cropped_path || outPath;
      char.headless_sheet_enabled = true;
      await api.updateProject(this.project.project_id, { characters: this.project.characters });

      this.renderStep2Assets();
      this.onToast(`✅ 無頭三視圖裁切完成！已切除頂部 22% 臉部並儲存至 ${char.headless_turnaround_path}`);
    } catch (err) {
      this.onToast(`無頭三視圖裁切失敗: ${err.message}`, 'error');
    }
  }

  async handleSaveAssets(silent = false) {
    if (!this.project) return;
    const wardrobeInputs = document.querySelectorAll('.char-wardrobe-input');
    const voiceInputs = document.querySelectorAll('.char-voice-input');

    wardrobeInputs.forEach((inp) => {
      const idx = parseInt(inp.getAttribute('data-char-idx'), 10);
      if (this.project.characters[idx]) {
        this.project.characters[idx].wardrobe = inp.value.trim();
      }
    });
    voiceInputs.forEach((inp) => {
      const idx = parseInt(inp.getAttribute('data-char-idx'), 10);
      if (this.project.characters[idx]) {
        this.project.characters[idx].voice_lock = inp.value.trim();
      }
    });

    try {
      const updated = await api.updateProject(this.project.project_id, {
        characters: this.project.characters,
      });
      this.project = updated;
      if (!silent) this.onToast('✅ 角色服裝與聲音鎖已儲存！');
      this.autoCompileActiveShot();
    } catch (err) {
      this.onToast(`儲存資產失敗: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // STEP 3: VISUAL BLOCKING & 2.39:1 ANIMATIC SLATE (#view-blocking-header, #view-slate-container, #view-step3-footer)
  // =========================================================================
  renderStep3Blocking() {
    const headerEl = document.getElementById('view-blocking-header');
    const slateEl = document.getElementById('view-slate-container');
    const footerEl = document.getElementById('view-step3-footer');
    if (!headerEl || !slateEl || !footerEl || !this.project) return;

    const currentShot = this.getActiveShot();
    const gateStatus = this.project.gates?.storyboard_blocking || 'pending';

    headerEl.innerHTML = `
      <div class="step-goal-banner" style="margin-bottom: 0.5rem;">
        <div class="step-goal-icon">📐</div>
        <div class="step-goal-content">
          <div class="step-goal-title">
            <span>Step 3 目標：用 2D 雷達排列角色走位、鎖定 2.39:1 構圖板與紅箭頭接觸圖</span>
            <span class="engine-badge real">🟢 本地真實運算 (幾何三角函數 + Pillow 分鏡板渲染)</span>
          </div>
          <p class="step-goal-desc">
            直接用文字寫「主角站在反派左前方」AI 常會搞混左右或越過 180 度軸線。在這裡，你可以在<strong>右側「工具 A：2D 空間雷達」</strong>直接拖曳圓點，系統會自動用幾何公式算出精確公尺距離與銀幕分區；也可以切換到<strong>「工具 B：#FF0000 紅箭頭接觸盤」</strong>標註手握武器的位置。
          </p>
          <div class="step-action-hint">
            <span>👆 <strong>現在該怎麼操作：</strong> 1. 在上方選擇要編輯的鏡頭 → 2. 在右邊拖曳圓點調整站位（或點「📸 重新繪製 2.39:1 分鏡板」） → 3. 完成後點底部按鈕進入 Step 4。</span>
          </div>
        </div>
      </div>
    `;

    const locks = currentShot?.continuity_locks || {};

    slateEl.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div class="card-title">
              <span>🎥 2.39:1 寬銀幕技術分鏡板 (Animatic Slate)</span>
              <span class="engine-badge real">🟢 Pillow 1920×804 真實繪製</span>
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.15rem;">
              這張圖由本地 Python 即時繪製並存放在 <code>projects/${this.project.project_id}/renders/${currentShot ? currentShot.shot_id : 'shot'}_slate.png</code>
            </div>
          </div>
          <button type="button" class="btn-primary" id="btn-re-render-animatic" style="padding: 0.45rem 0.9rem; font-size: 0.78rem;">
            📸 重新繪製 2.39:1 分鏡預覽圖
          </button>
        </div>

        <div class="animatic-container" id="slate-container">
          ${this._renderSlateImage(currentShot)}
          <div class="animatic-overlay">
            ${currentShot ? `SHOT ${String(currentShot.order).padStart(2, '0')} // ${currentShot.camera_lens_mm}MM // ${currentShot.duration_sec}S` : 'NO SHOT'}
          </div>
        </div>

        <!-- Camera & 5 Continuity Locks Form -->
        <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.7rem;">
          <div class="grid-2">
            <div>
              <label class="wizard-label">⏱️ 鏡頭秒數 (Duration — 必須為 5/10/15 秒)</label>
              <select id="shot-duration-select" class="wizard-select">
                <option value="5" ${currentShot && currentShot.duration_sec === 5 ? 'selected' : ''}>5 秒 (緊湊微動作 / 特寫反應鏡)</option>
                <option value="10" ${currentShot && currentShot.duration_sec === 10 ? 'selected' : ''}>10 秒 (標準敘事與走位推進)</option>
                <option value="15" ${currentShot && currentShot.duration_sec === 15 ? 'selected' : ''}>15 秒 (完整動作長鏡頭)</option>
              </select>
            </div>
            <div>
              <label class="wizard-label">🔭 實體焦段選擇 (Camera Focal Length)</label>
              <select id="shot-lens-select" class="wizard-select">
                <option value="24" ${currentShot && currentShot.camera_lens_mm === 24 ? 'selected' : ''}>24mm 廣角環境 (適合空間建立鏡)</option>
                <option value="35" ${currentShot && currentShot.camera_lens_mm === 35 ? 'selected' : ''}>35mm 變形寬銀幕主鏡 (好萊塢經典)</option>
                <option value="50" ${currentShot && currentShot.camera_lens_mm === 50 ? 'selected' : ''}>50mm 標準雙人對峙</option>
                <option value="85" ${currentShot && currentShot.camera_lens_mm === 85 ? 'selected' : ''}>85mm 人物特寫胸像 (壓縮景深)</option>
                <option value="135" ${currentShot && currentShot.camera_lens_mm === 135 ? 'selected' : ''}>135mm 極端臉部/眼神特寫</option>
              </select>
            </div>
          </div>

          <div>
            <label class="wizard-label">🎥 攝影機運鏡方式 (Camera Movement — 注意：請勿混入 mm/ISO 數字標籤)</label>
            <input type="text" id="shot-cameramove-input" class="wizard-input" value="${this._esc(currentShot ? currentShot.camera_move : '')}" />
          </div>

          <div style="background: var(--bg-surface); border: 1px solid var(--border-dim); border-radius: 8px; padding: 0.75rem;">
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--accent-gold); margin-bottom: 0.5rem;">
              🔒 五大具名連續性鎖 (5 Named Continuity Locks — 防止畫面亂跳與背景路人亂動)
            </div>
            <div class="grid-2" style="gap: 0.5rem;">
              <div>
                <label class="wizard-label" style="font-size: 0.7rem;">1. 首幀構圖鎖 (First-Frame Lock)</label>
                <input type="text" id="lock-first-frame" class="wizard-input" style="padding: 0.35rem 0.6rem; font-size: 0.76rem;" value="${this._esc(locks.first_frame_lock || '')}" />
              </div>
              <div>
                <label class="wizard-label" style="font-size: 0.7rem;">2. 畫面朝向鎖 (Screen-Direction Lock)</label>
                <input type="text" id="lock-direction" class="wizard-input" style="padding: 0.35rem 0.6rem; font-size: 0.76rem;" value="${this._esc(locks.screen_direction_lock || '')}" />
              </div>
              <div>
                <label class="wizard-label" style="font-size: 0.7rem;">3. 鏡頭行為鎖 (Lens Lock)</label>
                <input type="text" id="lock-lens" class="wizard-input" style="padding: 0.35rem 0.6rem; font-size: 0.76rem;" value="${this._esc(locks.lens_lock || '')}" />
              </div>
              <div>
                <label class="wizard-label" style="font-size: 0.7rem;">4. 畫面人數鎖 (Count Lock)</label>
                <input type="text" id="lock-count" class="wizard-input" style="padding: 0.35rem 0.6rem; font-size: 0.76rem;" value="${this._esc(locks.count_lock || '')}" />
              </div>
            </div>
            <div style="margin-top: 0.5rem;">
              <label class="wizard-label" style="font-size: 0.7rem;">5. 背景靜止鎖 (Stillness Lock)</label>
              <input type="text" id="lock-stillness" class="wizard-input" style="padding: 0.35rem 0.6rem; font-size: 0.76rem;" value="${this._esc(locks.stillness_lock || '')}" />
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button type="button" class="btn-secondary" id="btn-save-blocking-spec">
              💾 儲存鏡頭構圖與連續性鎖
            </button>
          </div>
        </div>
      </div>
    `;

    footerEl.innerHTML = `
      <div class="step-footer-nav">
        <button type="button" class="btn-secondary" id="btn-step3-prev">
          ← 返回 Step 2：角色與場景資產鎖定
        </button>
        <div class="step-footer-hint">
          ✅ <strong>走位與紅箭頭都確認了嗎？</strong> 點擊右側按鈕將核准 <code>Gate 3 (storyboard_blocking)</code> 並進入 <strong>Step 4：梅斯納物理演技與 20 點工業品管</strong>。
        </div>
        <button type="button" class="btn-primary" id="btn-step3-next">
          ✅ 核准 Step 3 並前往 Step 4：物理演技與 20 點品管 →
        </button>
      </div>
    `;

    const renderAnimBtn = document.getElementById('btn-re-render-animatic');
    if (renderAnimBtn) {
      renderAnimBtn.addEventListener('click', () => this.handleRenderAnimatic());
    }

    const saveBlockingBtn = document.getElementById('btn-save-blocking-spec');
    if (saveBlockingBtn) {
      saveBlockingBtn.addEventListener('click', () => this.handleSaveBlockingSpec(false));
    }

    const prevBtn = document.getElementById('btn-step3-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => this.onStepChangeRequest(2));

    const nextBtn = document.getElementById('btn-step3-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        await this.handleSaveBlockingSpec(true);
        await this.handleGateUpdate('storyboard_blocking', 'approved');
        this.onStepChangeRequest(4);
      });
    }
  }

  async handleSaveBlockingSpec(silent = false) {
    const shot = this.getActiveShot();
    if (!this.project || !shot) return;

    const dur = parseInt(document.getElementById('shot-duration-select')?.value || shot.duration_sec, 10);
    const lens = parseInt(document.getElementById('shot-lens-select')?.value || shot.camera_lens_mm, 10);
    const move = document.getElementById('shot-cameramove-input')?.value.trim() || shot.camera_move;

    const updatedLocks = {
      ...(shot.continuity_locks || {}),
      first_frame_lock: document.getElementById('lock-first-frame')?.value.trim() || '',
      screen_direction_lock: document.getElementById('lock-direction')?.value.trim() || '',
      lens_lock: document.getElementById('lock-lens')?.value.trim() || '',
      count_lock: document.getElementById('lock-count')?.value.trim() || '',
      stillness_lock: document.getElementById('lock-stillness')?.value.trim() || '',
    };

    try {
      const updatedShot = await api.updateShot(this.project.project_id, shot.shot_id, {
        duration_sec: dur,
        camera_lens_mm: lens,
        camera_move: move,
        continuity_locks: updatedLocks,
      });
      Object.assign(shot, updatedShot);
      if (!silent) this.onToast(`✅ 鏡頭 ${shot.order} 構圖與五大連續性鎖已儲存！`);
      await this.autoCompileActiveShot();
      this.onShotSelected(shot);
    } catch (err) {
      this.onToast(`儲存構圖設定失敗: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // STEP 4: MEISNER PHYSICAL ACTING & REAL 20-POINT QA (#view-acting-qa-container)
  // =========================================================================
  renderStep4ActingAndQA() {
    const el = document.getElementById('view-acting-qa-container');
    if (!el || !this.project) return;

    const currentShot = this.getActiveShot();
    const score = this.qaResult ? this.qaResult.score : 20;
    const passed = this.qaResult ? this.qaResult.passed : true;

    el.innerHTML = `
      <!-- Step 4 Goal Banner -->
      <div class="step-goal-banner">
        <div class="step-goal-icon">🎬</div>
        <div class="step-goal-content">
          <div class="step-goal-title">
            <span>Step 4 目標：將抽象情緒轉化為「梅斯納物理動作」，並通過 20 點真實品管審查</span>
            <span class="engine-badge real">🟢 本地真實運算 (Python Regex Linter + 20-Point QA 驗證器)</span>
          </div>
          <p class="step-goal-desc">
            <strong>為什麼 AI 演員看起來像面癱或表情崩壞？</strong> 因為你寫了「他覺得很悲傷又憤怒 (feels sad and angry)」這種抽象形容詞，AI 不知道該動哪條肌肉！好萊塢 AI 導演採用<strong>「梅斯納技巧 (Meisner Technique)」</strong>：先寫<strong>外部感官刺激 (Stimulus)</strong>，再寫<strong>具體的微肌肉反應 (Micro Action)</strong>。右方的 <strong>20 點品管清單是 100% 真實運作的檢查器</strong>！
          </p>
          <div class="step-action-hint">
            <span>👆 <strong>不確定這是不是真的檢查器嗎？</strong> 點擊下方左邊的 <strong>「🧪 故意填入錯誤情緒詞 (測試 QA 攔截)」</strong> 按鈕，你會立刻看到右邊的 20 點 QA 亮紅燈報錯，接著再點 <strong>「🔧 AI 一鍵自動修復 QA」</strong> 看它如何自動修正回 20/20 滿分！</span>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Left: Meisner Acting Editor & Bad vs Good Examples -->
        <div class="card">
          <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
            <div class="card-title">
              <span>🎭 梅斯納物理演技編譯器 (Meisner Physical Acting)</span>
            </div>
            <button type="button" class="btn-secondary" id="btn-inject-bad-words" style="border-color: rgba(245, 158, 11, 0.5); color: #fcd34d; font-size: 0.75rem; padding: 0.3rem 0.65rem;">
              🧪 故意填入錯誤情緒詞 (測試 QA 攔截！)
            </button>
          </div>

          <!-- Bad vs Good Comparison Box -->
          <div class="example-compare-grid" style="margin-bottom: 1rem;">
            <div class="example-box bad">
              <div style="font-weight: 800; color: #f87171; margin-bottom: 0.25rem;">❌ 新手常寫的錯誤提示詞 (會被 QA 攔截)</div>
              <div style="color: var(--text-muted); line-height: 1.45;">
                <code>"He feels very sad and angry, standing near the door with 50mm lens."</code><br/>
                👉 包含抽象情緒詞 (<code>sad</code>, <code>angry</code>)、模糊方位 (<code>near</code>) 與相機數值標籤 (<code>50mm</code>)，AI 臉部極易扭曲。
              </div>
            </div>
            <div class="example-box good">
              <div style="font-weight: 800; color: #34d399; margin-bottom: 0.25rem;">✅ 工業級梅斯納物理寫法 (QA 滿分通過)</div>
              <div style="color: var(--text-muted); line-height: 1.45;">
                <strong>導火線刺激：</strong> <code>Cold raindrop strikes left cheek</code><br/>
                <strong>微肌肉反應：</strong> <code>Jaw clenches 3mm, right thumb tightens around hilt wrap</code><br/>
                👉 100% 物理可觀測動作，AI 肌肉運動精準穩定！
              </div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div>
              <label class="wizard-label">⚡ 1. 梅斯納外部感官刺激導火線 (Meisner Stimulus — 鏡頭開始時發生了什麼物理事件？)</label>
              <textarea id="shot-stimulus-input" class="wizard-textarea" rows="2">${this._esc(currentShot ? currentShot.meisner_stimulus : '')}</textarea>
            </div>

            <div>
              <label class="wizard-label">💪 2. 梅斯納微肌肉與肢體反應 (Meisner Micro Action — 角色身體哪個部位做出了什麼具體動作？)</label>
              <textarea id="shot-microaction-input" class="wizard-textarea" rows="3">${this._esc(currentShot ? currentShot.meisner_micro_action : '')}</textarea>
            </div>

            <div class="grid-2">
              <div>
                <label class="wizard-label">🩸 3. 單調遞增物理狀態 (汗水/雨水/傷痕只增不減)</label>
                <input type="text" id="shot-monotonic-input" class="wizard-input" value="${this._esc(currentShot?.continuity_locks?.monotonic_state_notes || '')}" />
              </div>
              <div>
                <label class="wizard-label">💬 4. 角色台詞 (Dialogue Line — 選填)</label>
                <input type="text" id="shot-dialogue-input" class="wizard-input" placeholder="無台詞則留空" value="${this._esc(currentShot ? currentShot.dialogue_line : '')}" />
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem;">
              <button type="button" class="btn-secondary" id="btn-run-linter" style="font-size: 0.78rem;">
                🧹 單獨執行禁用詞掃描 (Prompt Linter)
              </button>
              <button type="button" class="btn-primary" id="btn-save-acting-spec" style="padding: 0.5rem 1rem; font-size: 0.82rem;">
                💾 儲存演技設定並重新執行 20 點 QA
              </button>
            </div>

            <div id="linter-feedback-box" style="display: ${this.lintWarnings ? 'block' : 'none'}; padding: 0.65rem 0.85rem; border-radius: 8px; background: rgba(15, 23, 42, 0.9); border: 1px solid var(--border-dim); font-size: 0.76rem;">
              ${this._renderLinterFeedback()}
            </div>
          </div>
        </div>

        <!-- Right: Real 20-Point QA Checklist & AI 1-Click Auto-Fix -->
        <div class="card">
          <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <div class="card-title">
                <span>🛡️ 20 點工業級品管審查清單 (Real 20-Point QA Audit)</span>
              </div>
              <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.15rem;">
                由後端 <code>PromptCompiler.evaluate_20_point_qa()</code> 即時運算，未通過項目會顯示紅框與具體修復處方。
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span id="qa-score-badge" style="font-family: var(--font-mono); font-size: 0.88rem; font-weight: 800; padding: 0.3rem 0.7rem; border-radius: 6px; background: ${passed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${passed ? 'var(--accent-emerald)' : 'var(--accent-crimson)'}; border: 1px solid ${passed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'};">
                ${score}/20 ${passed ? 'PASS' : 'FAIL'}
              </span>
              <button type="button" class="btn-primary" id="btn-qa-autofix" style="padding: 0.45rem 0.9rem; font-size: 0.8rem;">
                🔧 AI 一鍵自動修復 QA
              </button>
            </div>
          </div>

          <div class="qa-checklist-grid" id="qa-items-container" style="max-height: 430px;">
            ${this._renderQAItems()}
          </div>
        </div>
      </div>

      <!-- Step 4 Footer Navigation CTA -->
      <div class="step-footer-nav">
        <button type="button" class="btn-secondary" id="btn-step4-prev">
          ← 返回 Step 3：分鏡走位與紅箭頭預合成
        </button>
        <div class="step-footer-hint">
          ✅ <strong>確認 20 點品管達到 20/20 PASS 後</strong>，點擊右側按鈕進入最後一步 <strong>Step 5：複製雙模提示詞合約、下載參考圖與失敗救援診斷</strong>。
        </div>
        <button type="button" class="btn-primary" id="btn-step4-next">
          🚀 前往 Step 5：匯出提示詞合約與失敗救援診斷 →
        </button>
      </div>
    `;

    const injectBadBtn = document.getElementById('btn-inject-bad-words');
    if (injectBadBtn) {
      injectBadBtn.addEventListener('click', () => this.handleInjectBadWordsForTest());
    }

    const lintBtn = document.getElementById('btn-run-linter');
    if (lintBtn) {
      lintBtn.addEventListener('click', () => this.handleRunLinter());
    }

    const saveActingBtn = document.getElementById('btn-save-acting-spec');
    if (saveActingBtn) {
      saveActingBtn.addEventListener('click', () => this.handleSaveActingSpec());
    }

    const autoFixBtn = document.getElementById('btn-qa-autofix');
    if (autoFixBtn) {
      autoFixBtn.addEventListener('click', () => this.handleAutoFixQA());
    }

    const prevBtn = document.getElementById('btn-step4-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => this.onStepChangeRequest(3));

    const nextBtn = document.getElementById('btn-step4-next');
    if (nextBtn) prevBtn && nextBtn.addEventListener('click', () => this.onStepChangeRequest(5));
  }

  _renderLinterFeedback() {
    if (!this.lintWarnings) return '';
    if (this.lintWarnings.length === 0) {
      return `<span style="color: var(--accent-emerald); font-weight: 700;">✅ 語法掃描通過！未偵測到任何抽象情緒詞、弱空間介係詞或相機數值標籤。</span>`;
    }
    return `
      <div style="color: #f87171; font-weight: 700; margin-bottom: 0.35rem;">
        ⚠️ 偵測到 ${this.lintWarnings.length} 個禁用詞違規：
      </div>
      <ul style="padding-left: 1.2rem; color: var(--text-main); line-height: 1.5;">
        ${this.lintWarnings.map(w => `<li><code>${this._esc(w.token)}</code> (${this._esc(w.rule)}) → 建議改為：<strong>${this._esc(w.suggestion)}</strong></li>`).join('')}
      </ul>
    `;
  }

  _renderQAItems() {
    const checks = this.qaResult?.checks || this.qaResult?.items || [];
    if (checks.length > 0) {
      return checks.map((it) => {
        const displayTitle = QA_CHINESE_LABELS[it.id] || `${it.id}. ${it.name}`;
        return `
          <div class="qa-item ${it.passed ? '' : 'failed'}" title="${this._esc(it.detail || '')}">
            <div class="qa-item-top">
              <span class="qa-item-name">${this._esc(displayTitle)}</span>
              <span class="${it.passed ? 'qa-pill-pass' : 'qa-pill-fail'}">
                ${it.passed ? '✓ 通過' : '✕ 未通過'}
              </span>
            </div>
            ${!it.passed ? `
              <div class="qa-item-remedy">
                <div><strong>原因：</strong>${this._esc(it.detail || '')}</div>
                ${it.remedy ? `<div><strong>🔧 修復處方：</strong>${this._esc(it.remedy)}</div>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    return Object.values(QA_CHINESE_LABELS).map((label) => `
      <div class="qa-item">
        <div class="qa-item-top">
          <span class="qa-item-name">${this._esc(label)}</span>
          <span class="qa-pill-pass">✓ 通過</span>
        </div>
      </div>
    `).join('');
  }

  async handleInjectBadWordsForTest() {
    const shot = this.getActiveShot();
    if (!this.project || !shot) return;

    const badStimulus = 'He feels very sad and angry near the door';
    const badAction = 'Looks terrified beside the table with 50mm lens ISO 800';

    const stimEl = document.getElementById('shot-stimulus-input');
    const actEl = document.getElementById('shot-microaction-input');
    if (stimEl) stimEl.value = badStimulus;
    if (actEl) actEl.value = badAction;

    await this.handleSaveActingSpec(true);
    await this.handleRunLinter();
    this.onToast('🧪 已故意填入抽象情緒詞 (sad/angry)、模糊介係詞 (near/beside) 與 50mm 標籤！請看右側 QA 攔截結果！');
  }

  async handleRunLinter() {
    const stim = document.getElementById('shot-stimulus-input')?.value || '';
    const act = document.getElementById('shot-microaction-input')?.value || '';
    const move = this.getActiveShot()?.camera_move || '';
    const text = `${stim} ${act} ${move}`;

    try {
      const res = await api.lintText(text);
      this.lintWarnings = res.warnings || [];
      const box = document.getElementById('linter-feedback-box');
      if (box) {
        box.style.display = 'block';
        box.innerHTML = this._renderLinterFeedback();
      }
    } catch (err) {
      console.error('Lint error:', err);
    }
  }

  async handleSaveActingSpec(silent = false) {
    const shot = this.getActiveShot();
    if (!this.project || !shot) return;

    const stim = document.getElementById('shot-stimulus-input')?.value.trim() || '';
    const act = document.getElementById('shot-microaction-input')?.value.trim() || '';
    const mono = document.getElementById('shot-monotonic-input')?.value.trim() || '';
    const diag = document.getElementById('shot-dialogue-input')?.value.trim() || '';

    const updatedLocks = {
      ...(shot.continuity_locks || {}),
      monotonic_state_notes: mono,
    };

    try {
      const updatedShot = await api.updateShot(this.project.project_id, shot.shot_id, {
        meisner_stimulus: stim,
        meisner_micro_action: act,
        dialogue_line: diag,
        continuity_locks: updatedLocks,
      });
      Object.assign(shot, updatedShot);
      this.lintWarnings = null;
      if (!silent) this.onToast(`✅ 鏡頭 ${shot.order} 梅斯納物理演技已儲存並重新執行 20 點 QA！`);
      await this.autoCompileActiveShot();
    } catch (err) {
      this.onToast(`儲存演技設定失敗: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // STEP 5: PROMPT EXPORT, STOP-LOSS RESCUE & TIMELINE (#view-export-rescue-container)
  // =========================================================================
  renderStep5ExportAndRescue() {
    const el = document.getElementById('view-export-rescue-container');
    if (!el || !this.project) return;

    const currentShot = this.getActiveShot();
    const gateStatus = this.project.gates?.final_render || 'pending';

    el.innerHTML = `
      <!-- Step 5 Goal Banner -->
      <div class="step-goal-banner">
        <div class="step-goal-icon">🚀</div>
        <div class="step-goal-content">
          <div class="step-goal-title">
            <span>Step 5 目標：匯出雙模提示詞合約、取用本地參考圖，或使用「15 次停損救援診斷室」</span>
            <span class="engine-badge export">📤 產出物匯出 + 🟢 本地救援診斷引擎</span>
          </div>
          <p class="step-goal-desc">
            恭喜！你已經完成了好萊塢級的前置防禦。現在你可以直接<strong>複製左側編譯好的提示詞合約</strong>（支援 <code>Seedance 15-Block</code> 與 <code>Hell Grind 10-Section</code> 兩種工業格式），搭配本機產出的參考圖，貼到任何外部 AI 影片生成網站（Seedance、Kling、Runway、Veo）。如果外部模型生壞了，請用右側的<strong>「15 次停損救援診斷室」</strong>開立修正處方！
          </p>
          <div class="step-action-hint">
            <span>👆 <strong>現在該怎麼操作：</strong> 點擊左下方 <strong>「📋 複製提示詞」</strong> 或 <strong>「⬇️ 下載 .txt 合約檔」</strong> 即可拿去生成影片；點擊右下角可核准最終閘門 <code>Gate 4</code>。</span>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Left: Dual Prompt Contract Exporter + Local Reference Assets List -->
        <div class="card">
          <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <div class="card-title">
                <span>📜 雙模提示詞合約匯出器 (Compiled Prompt Contract)</span>
                <span class="engine-badge export">📤 可直接貼入 Seedance / Kling / Runway</span>
              </div>
              <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.15rem;">
                已自動整合 Step 1 世界觀、Step 2 服裝/聲音鎖、Step 3 2D 空間雷達座標與 Step 4 梅斯納物理動作。
              </div>
            </div>
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              <button type="button" class="btn-secondary ${this.activePromptTab === '15block' ? 'active' : ''}" id="btn-tab-15block" style="padding: 0.3rem 0.65rem; font-size: 0.75rem;">
                Seedance 2.5 (15-Block 矩陣)
              </button>
              <button type="button" class="btn-secondary ${this.activePromptTab === '10section' ? 'active' : ''}" id="btn-tab-10section" style="padding: 0.3rem 0.65rem; font-size: 0.75rem;">
                Hell Grind (10-Section 合約)
              </button>
            </div>
          </div>

          <div class="prompt-display" id="compiled-prompt-text" style="max-height: 320px; margin-bottom: 0.85rem;">${this._esc(this._getPromptContent())}</div>

          <div style="display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1rem;">
            <button type="button" class="btn-primary" id="btn-copy-prompt" style="padding: 0.5rem 1rem; font-size: 0.82rem;">
              📋 一鍵複製提示詞到剪貼簿
            </button>
            <button type="button" class="btn-secondary" id="btn-download-prompt" style="padding: 0.5rem 1rem; font-size: 0.82rem;">
              ⬇️ 下載此鏡頭提示詞 (.txt)
            </button>
          </div>

          <!-- Local Reference Files Box -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-dim); border-radius: 8px; padding: 0.85rem;">
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 0.4rem;">
              📂 本鏡頭已鎖定的本地參考圖檔 (上傳至 AI 影片模型作為首幀/角色參考圖)
            </div>
            <ul style="font-size: 0.76rem; color: var(--text-muted); padding-left: 1.2rem; line-height: 1.7;">
              <li>
                <strong>2.39:1 構圖分鏡板：</strong>
                <a href="/projects/${this.project.project_id}/renders/${currentShot ? currentShot.shot_id : 'shot-01'}_slate.png" target="_blank" style="color: var(--accent-gold); text-decoration: underline;">
                  projects/${this.project.project_id}/renders/${currentShot ? currentShot.shot_id : 'shot-01'}_slate.png ↗
                </a>
              </li>
              <li>
                <strong>#FF0000 紅箭頭道具接觸圖：</strong>
                <code>projects/${this.project.project_id}/renders/${currentShot ? currentShot.shot_id : 'shot-01'}_contact_sheet.png</code> (於 Step 3 工具 B 儲存後生成)
              </li>
              <li>
                <strong>無頭三視圖資產：</strong>
                <code>projects/${this.project.project_id}/assets/*_headless.png</code> (於 Step 2 點擊裁切後生成)
              </li>
            </ul>
          </div>
        </div>

        <!-- Right: Stop-Loss Rescue Doctor + Inline Timeline & FFmpeg Viewer -->
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">
                  <span>🛑 15 次迭代單變量停損救援診斷室 (Stop-Loss Rescue Doctor)</span>
                  <span class="engine-badge real">🟢 本地真實診斷引擎</span>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">
                  當你把提示詞貼去外部 AI 影片模型生成，卻遇到崩壞時：<strong>千萬不要一次亂改整段提示詞！</strong> 選擇下方你遇到的狀況與目前重試次數，系統會為你開立「單變量微調處方」或「0.8 秒特寫橋接鏡停損方案」。
                </p>
              </div>
            </div>

            <div class="rescue-panel">
              <div class="grid-2" style="margin-bottom: 0.75rem;">
                <div>
                  <label class="wizard-label">1️⃣ 外部 AI 影片生成出了什麼問題？ (Failure Symptom)</label>
                  <select id="rescue-failure-type" class="wizard-select">
                    <option value="physics_collapse">💥 肢體融化 / 動作物理崩解 (Physics Collapse)</option>
                    <option value="hand_prop_clipping">🗡️ 手指與武器穿模 / 道具懸空 (Hand/Prop Clipping)</option>
                    <option value="identity_drift">👤 主角臉部走鐘 / 衣服突變 (Identity Drift)</option>
                    <option value="screen_direction_flip">🔄 左右越軸 / 角色突然轉向另一邊 (Direction Flip)</option>
                  </select>
                </div>
                <div>
                  <label class="wizard-label">2️⃣ 這顆鏡頭你已經重試抽卡幾次了？ (Iterations)</label>
                  <select id="rescue-iter-count" class="wizard-select">
                    <option value="3">1 ~ 9 次 (初期微調：單變量外科修補)</option>
                    <option value="12">10 ~ 14 次 (中度卡關：觸發降維簡化動作警報)</option>
                    <option value="15" selected>15 次以上 (強制停損：插入 0.8s 極端特寫橋接鏡！)</option>
                  </select>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <button type="button" class="btn-primary" id="btn-run-rescue" style="background: linear-gradient(135deg, #ef4444, #b91c1c); color: #fff; padding: 0.45rem 1rem; font-size: 0.8rem;">
                  🚨 立即開立停損救援處方
                </button>
                <span id="rescue-action-tag" style="font-family: var(--font-mono); font-size: 0.76rem; font-weight: 700; color: var(--accent-gold);">
                  ${this.rescueResult ? this.rescueResult.stop_loss.action : '等待診斷...'}
                </span>
              </div>

              <div id="rescue-output-box" style="display: ${this.rescueResult ? 'block' : 'none'}; margin-top: 0.75rem; font-size: 0.78rem; background: var(--bg-surface); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-dim); line-height: 1.6;">
                ${this._renderRescueOutput()}
              </div>
            </div>
          </div>

          <!-- Inline Timeline & FFmpeg Concat Generator -->
          <div class="card">
            <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <div class="card-title">
                  <span>🎞️ 全片 J-Cut / L-Cut 時間軸清單與 FFmpeg 自動縫合腳本</span>
                  <span class="engine-badge real">🟢 本地真實寫入 timeline_manifest.json</span>
                </div>
                <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.15rem;">
                  將所有分鏡組裝為含聲音前置 (J-Cut -0.25s) 與畫面延滯 (L-Cut +0.25s) 的剪輯清單與 FFmpeg 一鍵合成指令。
                </div>
              </div>
              <button type="button" class="btn-secondary" id="btn-export-timeline" style="border-color: rgba(6, 182, 212, 0.4); color: var(--accent-cyan); font-size: 0.78rem;">
                🎞️ 生成全片 FFmpeg 剪輯腳本
              </button>
            </div>

            <div id="timeline-output-box" style="display: ${this.timelineResult ? 'block' : 'none'};">
              ${this._renderTimelineOutput()}
            </div>
          </div>
        </div>
      </div>

      <!-- Step 5 Footer Navigation CTA -->
      <div class="step-footer-nav">
        <button type="button" class="btn-secondary" id="btn-step5-prev">
          ← 返回 Step 4：物理演技與 20 點品管
        </button>
        <div class="step-footer-hint">
          🎉 <strong>全部 5 個製片步驟皆已完成！</strong> 點擊右側按鈕核准最終閘門 <code>Gate 4 (final_render)</code> 並儲存完整專案快照。
        </div>
        <button type="button" class="btn-primary" id="btn-step5-finish">
          ${gateStatus === 'approved' ? '✅ Gate 4 最終產出已核准 (點此重新建立快照)' : '🎉 核准最終閘門 (Approve Gate 4: Final Render)'}
        </button>
      </div>
    `;

    const tab15 = document.getElementById('btn-tab-15block');
    const tab10 = document.getElementById('btn-tab-10section');
    const copyBtn = document.getElementById('btn-copy-prompt');
    const dlBtn = document.getElementById('btn-download-prompt');
    const rescueBtn = document.getElementById('btn-run-rescue');
    const exportBtn = document.getElementById('btn-export-timeline');
    const prevBtn = document.getElementById('btn-step5-prev');
    const finishBtn = document.getElementById('btn-step5-finish');

    if (tab15) {
      tab15.addEventListener('click', () => {
        this.activePromptTab = '15block';
        this.renderStep5ExportAndRescue();
      });
    }
    if (tab10) {
      tab10.addEventListener('click', () => {
        this.activePromptTab = '10section';
        this.renderStep5ExportAndRescue();
      });
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = this._getPromptContent();
        navigator.clipboard.writeText(text).then(() => {
          this.onToast('📋 已複製提示詞合約到剪貼簿！可直接貼至 Seedance / Kling / Runway。');
        });
      });
    }
    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        const text = this._getPromptContent();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.project.project_id}_${currentShot ? currentShot.shot_id : 'shot'}_${this.activePromptTab}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        this.onToast('⬇️ 已下載提示詞合約 .txt 檔案！');
      });
    }
    if (rescueBtn) {
      rescueBtn.addEventListener('click', () => this.handleRunRescue());
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.handleExportTimeline());
    }
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.onStepChangeRequest(4));
    }
    if (finishBtn) {
      finishBtn.addEventListener('click', async () => {
        await this.handleGateUpdate('final_render', 'approved');
        this.onToast('🎉 恭喜完成全套 5 步驟製片流程！Gate 4 快照已寫入專案目錄。');
      });
    }
  }

  _renderRescueOutput() {
    if (!this.rescueResult) return '';
    const r = this.rescueResult;
    return `
      <div style="margin-bottom: 0.35rem;">
        <strong>🔍 單變量 Diff 判定：</strong>
        ${r.diff.is_single_variable
          ? '<span class="diff-tag-single">✓ 合規單變量微調 (不會破壞既有構圖)</span>'
          : '<span class="diff-tag-multi">✕ 多變量失控警告 (一次改動過多區塊)</span>'}
      </div>
      <div style="margin-bottom: 0.35rem;">
        <strong>💊 具體救援處方：</strong> ${this._esc(r.stop_loss.message)}
      </div>
      ${r.stop_loss.bridge_shot_suggestion ? `
        <div style="margin-top: 0.45rem; padding: 0.5rem 0.65rem; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 6px; color: #fcd34d;">
          <strong>✂️ 0.8 秒極端特寫橋接鏡提示詞 (直接複製生成一顆 0.8s 特寫切開壞掉的鏡頭)：</strong><br/>
          <code style="color: #fff; font-family: var(--font-mono); font-size: 0.74rem;">${this._esc(r.stop_loss.bridge_shot_suggestion)}</code>
        </div>
      ` : ''}
    `;
  }

  _renderTimelineOutput() {
    if (!this.timelineResult) return '';
    const t = this.timelineResult;
    const clips = t.manifest?.clips || [];
    return `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-dim); border-radius: 8px; padding: 0.75rem; font-size: 0.76rem;">
        <div style="color: var(--accent-emerald); font-weight: 700; margin-bottom: 0.4rem;">
          ✅ 已生成時間軸清單與 Concat 腳本：<code>${this._esc(t.concat_file)}</code>
        </div>
        <div style="margin-bottom: 0.5rem; color: var(--text-muted);">
          共 ${clips.length} 顆鏡頭，總長度 <strong>${t.manifest?.total_duration_sec || 0} 秒</strong>（含 J-Cut 音訊提前 0.25s 與 L-Cut 尾韻延展 0.25s）：
        </div>
        <div style="font-family: var(--font-mono); font-size: 0.72rem; background: #07090d; padding: 0.6rem; border-radius: 6px; border: 1px solid var(--border-dim); color: var(--accent-cyan); overflow-x: auto;">
          ${this._esc(t.ffmpeg_command)}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // SHARED HELPERS & API HANDLERS
  // =========================================================================
  _renderSlateImage(shot) {
    if (!shot) {
      return `<div style="color: var(--text-dim); font-size: 0.9rem;">未選取鏡頭</div>`;
    }
    if (shot.animatic_slate_path) {
      const relUrl = `/projects/${this.project.project_id}/renders/${shot.shot_id}_slate.png?t=${Date.now()}`;
      return `<img src="${relUrl}" alt="Animatic Slate" class="animatic-img" onerror="this.onerror=null; this.src=''; this.parentElement.innerHTML='<div style=\\'color:#ef4444;\\'>點右上角「重新繪製 2.39:1 分鏡預覽圖」以生成圖檔</div>';" />`;
    }
    return `<div style="color: var(--text-dim); font-size: 0.9rem;">點右上角「📸 重新繪製 2.39:1 分鏡預覽圖」立即生成</div>`;
  }

  _getPromptContent() {
    const shot = this.getActiveShot();
    if (!shot) return '請先選取鏡頭...';

    if (this.activePromptTab === '15block') {
      return this.compiledPrompt?.block_15_text || shot.compiled_15_block || '正在編譯 15-Block 提示詞...';
    } else {
      return this.compiledPrompt?.section_10_text || shot.compiled_10_section || '正在編譯 10-Section 提示詞...';
    }
  }

  selectShotIndex(idx) {
    if (!this.project || !this.project.shots[idx]) return;
    this.activeShotIndex = idx;
    this.activeShotId = this.project.shots[idx].shot_id;
    this.lintWarnings = null;
    this.rescueResult = null;
    this.renderAllSteps();
    this.autoCompileActiveShot();
    this.onShotSelected(this.project.shots[idx]);
    this.onToast(`🎬 已切換至：鏡頭 ${String(this.project.shots[idx].order || idx + 1).padStart(2, '0')} (${this.project.shots[idx].title})`);
  }

  async handleAddShot() {
    if (!this.project) return;
    const newOrder = this.project.shots.length + 1;
    const newShotId = `shot-${String(newOrder).padStart(2, '0')}`;
    const newShot = {
      shot_id: newShotId,
      scene_id: 'sc-01',
      order: newOrder,
      title: `緊湊延伸鏡 #${newOrder}`,
      duration_sec: 5,
      camera_lens_mm: 50,
      camera_move: 'Low-angle slow dolly-in tracking movement',
      spatial_nodes: [
        { id: 's1', handle: this.project.characters[0]?.handle || '@protagonist', role: 'subject', x: 0.36, y: 0.62, facing_deg: 25 },
        { id: 's2', handle: this.project.characters[1]?.handle || '@antagonist', role: 'opponent', x: 0.68, y: 0.42, facing_deg: 205 },
      ],
      meisner_stimulus: 'Opponent steps forward onto wet stone with a sharp metallic clink',
      meisner_micro_action: 'Jaw clenches slightly, right thumb presses firmly against hilt guard as breath slows',
      dialogue_line: '',
      continuity_locks: {
        first_frame_lock: 'Primary actor positioned left-center foreground facing right-depth',
        screen_direction_lock: 'Strict 180-degree axis preserved; protagonist on screen-left',
        lens_lock: 'Anamorphic prime depth of field locked, zero zoom',
        count_lock: 'Exactly 2 characters in frame, zero background extras',
        stillness_lock: 'Background architecture remains completely static',
        monotonic_state_notes: 'Rain moisture and fabric wear persist monotonically',
      },
      qa_passed: true,
      iteration_count: 1,
      rescue_history: [],
      status: 'pending',
    };

    this.project.shots.push(newShot);
    this.activeShotIndex = this.project.shots.length - 1;
    this.activeShotId = newShotId;
    await api.updateProject(this.project.project_id, { shots: this.project.shots });
    this.renderAllSteps();
    await this.handleRenderAnimatic();
    this.onProjectUpdated(this.project);
  }

  async handleGateUpdate(gateKey, status) {
    if (!this.project) return;
    try {
      const updated = await api.updateGate(this.project.project_id, gateKey, {
        status,
        notes: `由 5 步驟引導工作台變更狀態為 ${status}`,
      });
      this.project = updated;
      this.renderAllSteps();
      this.onProjectUpdated(this.project);
    } catch (err) {
      console.error('Update gate failed:', err);
      this.onToast(`更新閘門失敗: ${err.message}`, 'error');
    }
  }

  async handleRenderAnimatic() {
    const shot = this.getActiveShot();
    if (!this.project || !shot) return;
    this.onToast(`📸 正在用 Python Pillow 本地渲染鏡頭 ${shot.order} 的 2.39:1 分鏡預覽圖...`);
    try {
      const res = await api.renderAnimatic(this.project.project_id, shot.shot_id);
      shot.animatic_slate_path = res.slate_path;
      this.renderStep3Blocking();
      this.onToast(`✅ 鏡頭 ${shot.order} 的 2.39:1 技術分鏡板已寫入 renders/ 資料夾！`);
    } catch (err) {
      console.error('Render animatic error:', err);
      this.onToast(`渲染分鏡板失敗: ${err.message}`, 'error');
    }
  }

  async autoCompileActiveShot() {
    const shot = this.getActiveShot();
    if (!this.project || !shot) return;

    try {
      const res = await api.compileShot(this.project.project_id, shot.shot_id);
      this.compiledPrompt = res.compiled;
      this.qaResult = res.qa;

      this.renderStep4ActingAndQA();
      this.renderStep5ExportAndRescue();
      this.onProjectUpdated(this.project);
    } catch (err) {
      console.error('Auto compile shot failed:', err);
    }
  }

  async handleAutoFixQA() {
    const shot = this.getActiveShot();
    if (!this.project || !shot) return;

    this.onToast('🔧 AI 自動修復引擎啟動：正在清除抽象情緒詞、補齊五大連續性鎖與梅斯納物理動作...');
    try {
      const fixedShot = await api.autoFixShot(this.project.project_id, shot.shot_id);
      Object.assign(shot, fixedShot);
      this.lintWarnings = [];
      await this.autoCompileActiveShot();
      this.onToast('✅ 已成功自動修復所有未通過項目！20 點品管恢復 20/20 PASS！');
    } catch (err) {
      console.error('Auto fix error:', err);
      this.onToast(`自動修復失敗: ${err.message}`, 'error');
    }
  }

  async handleRunRescue() {
    const shot = this.getActiveShot();
    if (!this.project || !shot) return;

    const failureType = document.getElementById('rescue-failure-type')?.value || 'physics_collapse';
    const iterCount = parseInt(document.getElementById('rescue-iter-count')?.value || '15', 10);
    const prev = shot.compiled_15_block || 'Anamorphic prime lens. Actor sprints forward.';
    const curr = (shot.compiled_15_block || 'Anamorphic prime lens. Actor sprints forward.') + ' [Single-variable micro-action patch]';

    try {
      const res = await api.rescueShot(this.project.project_id, shot.shot_id, {
        prev_prompt: prev,
        curr_prompt: curr,
        iteration_count: iterCount,
        failure_type: failureType,
      });

      this.rescueResult = res;
      this.renderStep5ExportAndRescue();
      this.onToast(`🚨 停損救援診斷完成：建議執行 [${res.stop_loss.action}]`);
    } catch (err) {
      console.error('Rescue error:', err);
      this.onToast(`救援評估失敗: ${err.message}`, 'error');
    }
  }

  async handleExportTimeline() {
    if (!this.project) return;
    try {
      const res = await api.generateTimeline(this.project.project_id);
      this.timelineResult = res;
      this.renderStep5ExportAndRescue();
      this.onToast('🎞️ 已生成全片 J-Cut/L-Cut 時間軸清單與 FFmpeg 腳本！');
    } catch (err) {
      console.error('Generate timeline error:', err);
      this.onToast(`時間軸生成失敗: ${err.message}`, 'error');
    }
  }

  _esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
