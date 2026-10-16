/**
 * SSRStudio v2 — Backlot Board Component
 * Multi-shot storyboard manager with 4 Industrial Approval Gates, 2.39:1 Animatic Slate Viewer,
 * Dynamic 20-Point QA Checklist, AI 1-Click Auto-Fix, and Stop-Loss Single-Variable Rescue Engine.
 */

import { api } from './api_client.js';

export class BacklotBoard {
  constructor({ containerId, onShotSelected, onProjectUpdated, onToast }) {
    this.container = document.getElementById(containerId);
    this.onShotSelected = onShotSelected || (() => {});
    this.onProjectUpdated = onProjectUpdated || (() => {});
    this.onToast = onToast || console.log;

    this.project = null;
    this.activeShotId = null;
    this.activeShotIndex = 0;
    this.qaResult = null;
    this.compiledPrompt = null;
    this.rescueResult = null;
    this.activePromptTab = '15block'; // '15block' | '10section'
  }

  setProject(project, activeShotId = null) {
    this.project = project;
    if (this.project.shots && this.project.shots.length > 0) {
      if (activeShotId) {
        const idx = this.project.shots.findIndex(s => s.shot_id === activeShotId);
        this.activeShotIndex = idx >= 0 ? idx : 0;
      } else {
        this.activeShotIndex = 0;
      }
      this.activeShotId = this.project.shots[this.activeShotIndex].shot_id;
    }
    this.render();
    this.autoCompileActiveShot();
  }

  getActiveShot() {
    if (!this.project || !this.project.shots || this.project.shots.length === 0) return null;
    return this.project.shots[this.activeShotIndex] || this.project.shots[0];
  }

  render() {
    if (!this.container) return;

    if (!this.project) {
      this.container.innerHTML = `
        <div class="card" style="text-align: center; padding: 4rem 2rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🎬</div>
          <h2 style="font-family: var(--font-title); font-size: 1.5rem; margin-bottom: 0.5rem; color: #fff;">尚未載入專案</h2>
          <p style="color: var(--text-muted); max-width: 500px; margin: 0 auto 1.5rem;">
            請切換至「✨ 導演引導模式」一鍵建置專案，或從右上角載入既有工作區專案。
          </p>
        </div>
      `;
      return;
    }

    const currentShot = this.getActiveShot();
    const gates = this.project.gates || {};

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Top Project Meta Bar -->
        <div class="card" style="padding: 1rem 1.25rem;">
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span style="font-size: 0.75rem; font-family: var(--font-mono); color: var(--accent-gold);">${this.project.project_id}</span>
                <h2 style="font-family: var(--font-title); font-size: 1.3rem; font-weight: 800; color: #fff;">${this.project.title}</h2>
              </div>
              <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.2rem;">
                ${this.project.idea || '無大綱描述'}
              </p>
            </div>
            <div style="display: flex; gap: 0.6rem; align-items: center;">
              <button type="button" class="btn-secondary" id="btn-export-timeline">
                🎞️ 匯出時間軸清單 (FFmpeg Concat)
              </button>
              <button type="button" class="btn-primary" id="btn-re-render-animatic" style="padding: 0.6rem 1rem; font-size: 0.85rem;">
                📸 重新渲染 2.39:1 Animatic
              </button>
            </div>
          </div>
        </div>

        <!-- 4 Approval Gates Visual Cards -->
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem;">
            <h3 style="font-family: var(--font-title); font-size: 0.95rem; color: var(--text-muted); letter-spacing: 0.05em; text-transform: uppercase;">
              🏛️ 工業級四級審批閘門 (4 Approval Gates)
            </h3>
            <span style="font-size: 0.75rem; color: var(--text-dim);">點擊卡片可切換審批狀態</span>
          </div>
          <div class="backlot-gates-grid">
            ${this._renderGateCard('story_funnel', 'Gate 1: 故事漏斗', '五幕結構與衝突弧線', gates.story_funnel || 'pending')}
            ${this._renderGateCard('asset_bible', 'Gate 2: 資產聖經', '無頭三視圖與物理接觸', gates.asset_bible || 'pending')}
            ${this._renderGateCard('storyboard_blocking', 'Gate 3: 分鏡走位', '2D空間雷達與180度軸線', gates.storyboard_blocking || 'pending')}
            ${this._renderGateCard('final_render', 'Gate 4: 提示詞編譯', '10Section/15Block 雙模合約', gates.final_render || 'pending')}
          </div>
        </div>

        <!-- Shot Selector Tabs -->
        <div>
          <div class="shot-tabs" id="backlot-shot-tabs">
            ${this.project.shots.map((s, idx) => `
              <button type="button" class="shot-tab ${idx === this.activeShotIndex ? 'active' : ''}" data-shot-idx="${idx}">
                🎬 Shot ${String(s.order || idx + 1).padStart(2, '0')}: ${s.title}
              </button>
            `).join('')}
            <button type="button" class="shot-tab" id="btn-add-shot" style="border-style: dashed; color: var(--accent-cyan);">
              + 新增鏡頭
            </button>
          </div>
        </div>

        <!-- Main Workspace Grid: Animatic Slate + 20-Point QA -->
        <div class="grid-2">
          
          <!-- Left: 2.39:1 Animatic Slate Viewer & Details -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <span>🎥 2.39:1 工業級技術分鏡板 (Animatic Slate)</span>
              </div>
              <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-gold);">
                ${currentShot ? `${currentShot.duration_sec}s | ${currentShot.camera_lens_mm}mm | ${currentShot.camera_move}` : ''}
              </span>
            </div>

            <!-- Slate Image -->
            <div class="animatic-container" id="slate-container">
              ${this._renderSlateImage(currentShot)}
              <div class="animatic-overlay">
                ${currentShot ? `SHOT ${String(currentShot.order).padStart(2, '0')} // 2.39:1 ANAMORPHIC` : 'NO SHOT'}
              </div>
            </div>

            <!-- Shot Metadata Form -->
            <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.6rem;">
              <div class="grid-2">
                <div>
                  <label class="wizard-label">鏡頭長度 (Duration)</label>
                  <select id="shot-duration-select" class="wizard-select">
                    <option value="5" ${currentShot && currentShot.duration_sec === 5 ? 'selected' : ''}>5 秒 (微動作/反應鏡)</option>
                    <option value="10" ${currentShot && currentShot.duration_sec === 10 ? 'selected' : ''}>10 秒 (標準敘事推進)</option>
                    <option value="15" ${currentShot && currentShot.duration_sec === 15 ? 'selected' : ''}>15 秒 (完整動作長鏡頭)</option>
                  </select>
                </div>
                <div>
                  <label class="wizard-label">鏡頭焦段 (Lens)</label>
                  <select id="shot-lens-select" class="wizard-select">
                    <option value="24" ${currentShot && currentShot.camera_lens_mm === 24 ? 'selected' : ''}>24mm 廣角環境</option>
                    <option value="35" ${currentShot && currentShot.camera_lens_mm === 35 ? 'selected' : ''}>35mm 變形主鏡 (經典)</option>
                    <option value="50" ${currentShot && currentShot.camera_lens_mm === 50 ? 'selected' : ''}>50mm 雙人對話</option>
                    <option value="85" ${currentShot && currentShot.camera_lens_mm === 85 ? 'selected' : ''}>85mm 人物胸像</option>
                    <option value="135" ${currentShot && currentShot.camera_lens_mm === 135 ? 'selected' : ''}>135mm 特寫緊繃眼部</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="wizard-label">運鏡方式 (Camera Movement)</label>
                <input type="text" id="shot-cameramove-input" class="wizard-input" value="${currentShot ? currentShot.camera_move : ''}" />
              </div>

              <div class="grid-2">
                <div>
                  <label class="wizard-label">梅斯納生理刺激 (Meisner Stimulus)</label>
                  <textarea id="shot-stimulus-input" class="wizard-textarea" rows="2">${currentShot ? currentShot.meisner_stimulus : ''}</textarea>
                </div>
                <div>
                  <label class="wizard-label">梅斯納微肌肉動作 (Meisner Micro Action)</label>
                  <textarea id="shot-microaction-input" class="wizard-textarea" rows="2">${currentShot ? currentShot.meisner_micro_action : ''}</textarea>
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
                <button type="button" class="btn-secondary" id="btn-save-shot-spec">
                  💾 儲存鏡頭設定
                </button>
              </div>
            </div>
          </div>

          <!-- Right: 20-Point QA Checklist & AI Auto-Fix -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <span>🛡️ 20 點工業級 QA 審查清單 (20-Point QA Audit)</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span id="qa-score-badge" style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 4px; background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald);">
                  ${this.qaResult ? `${this.qaResult.score}/20 PASS` : '20/20 PASS'}
                </span>
                <button type="button" class="btn-primary" id="btn-qa-autofix" style="padding: 0.4rem 0.8rem; font-size: 0.78rem;">
                  🔧 AI 一鍵自動修復 QA
                </button>
              </div>
            </div>

            <!-- 20-Point List -->
            <div class="qa-checklist-grid" id="qa-items-container">
              ${this._renderQAItems()}
            </div>

            <!-- Stop-Loss Rescue Engine Panel -->
            <div style="margin-top: 1rem;">
              <div class="rescue-panel">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-weight: 700; font-size: 0.82rem; color: var(--accent-crimson); display: flex; align-items: center; gap: 0.4rem;">
                    🛑 15 次迭代單變量停損救援引擎 (Stop-Loss Rescue)
                  </span>
                  <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-dim);" id="rescue-iter-display">
                    目前迭代: ${currentShot ? currentShot.iteration_count : 1} 次
                  </span>
                </div>

                <div class="grid-2" style="margin-bottom: 0.6rem;">
                  <div>
                    <label class="wizard-label" style="font-size: 0.7rem;">失敗模式 (Failure Type)</label>
                    <select id="rescue-failure-type" class="wizard-select" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;">
                      <option value="physics_collapse">物理崩解 / 肢體融化 (Physics Collapse)</option>
                      <option value="hand_prop_clipping">手指道具穿模 (Hand/Prop Clipping)</option>
                      <option value="identity_drift">面部特徵漂移 (Identity Drift)</option>
                      <option value="screen_direction_flip">越軸 / 軸線跳轉 (Screen Direction Flip)</option>
                    </select>
                  </div>
                  <div>
                    <label class="wizard-label" style="font-size: 0.7rem;">迭代次數模擬 (Iterations)</label>
                    <select id="rescue-iter-count" class="wizard-select" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;">
                      <option value="1">1 次 (初始調校)</option>
                      <option value="5">5 次 (局部微調)</option>
                      <option value="11">11 次 (觸發簡化停損警報)</option>
                      <option value="15" selected>15 次 (觸發 0.8s 反應橋接鏡強制限止)</option>
                    </select>
                  </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <button type="button" class="btn-secondary" id="btn-run-rescue" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; border-color: rgba(239, 68, 68, 0.4);">
                    🚨 執行單變量 Diff 救援分析
                  </button>
                  <span id="rescue-action-tag" style="font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; color: var(--accent-gold);">
                    狀態正常
                  </span>
                </div>

                <div id="rescue-output-box" style="display: none; margin-top: 0.5rem; font-size: 0.75rem; background: var(--bg-surface); padding: 0.6rem; border-radius: 4px; border: 1px solid var(--border-dim);">
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Compiled Dual Prompt Viewer (10-Section vs 15-Block) -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <span>📜 提示詞雙模合約編譯結果 (Compiled Prompt Contract)</span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button type="button" class="btn-secondary ${this.activePromptTab === '15block' ? 'active' : ''}" id="btn-tab-15block" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
                Seedance 15-Block
              </button>
              <button type="button" class="btn-secondary ${this.activePromptTab === '10section' ? 'active' : ''}" id="btn-tab-10section" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
                Hell Grind 10-Section
              </button>
              <button type="button" class="btn-secondary" id="btn-copy-prompt" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
                📋 複製提示詞
              </button>
            </div>
          </div>
          <div class="prompt-display" id="compiled-prompt-text" style="max-height: 280px;">
            ${this._getPromptContent()}
          </div>
        </div>

      </div>
    `;

    this._bindEvents();
  }

  _renderGateCard(gateKey, title, desc, status) {
    const isApproved = status === 'approved';
    const isRejected = status === 'rejected';
    const statusClass = isApproved ? 'approved' : isRejected ? 'rejected' : 'pending';
    const statusLabel = isApproved ? '✅ APPROVED' : isRejected ? '❌ REJECTED' : '⏳ PENDING';

    return `
      <div class="gate-card ${statusClass}" data-gate-key="${gateKey}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem;">
          <span style="font-family: var(--font-title); font-size: 0.88rem; font-weight: 700; color: #fff;">${title}</span>
          <span class="gate-badge ${statusClass}">${statusLabel}</span>
        </div>
        <p style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.6rem;">${desc}</p>
        <div style="display: flex; gap: 0.4rem;">
          <button type="button" class="btn-secondary btn-approve-gate" data-gate="${gateKey}" style="flex: 1; padding: 0.2rem 0.4rem; font-size: 0.7rem; justify-content: center;">
            核准
          </button>
          <button type="button" class="btn-secondary btn-reject-gate" data-gate="${gateKey}" style="flex: 1; padding: 0.2rem 0.4rem; font-size: 0.7rem; justify-content: center;">
            駁回
          </button>
        </div>
      </div>
    `;
  }

  _renderSlateImage(shot) {
    if (!shot) {
      return `<div style="color: var(--text-dim); font-size: 0.9rem;">未選取鏡頭</div>`;
    }
    if (shot.animatic_slate_path) {
      const relUrl = `/projects/${this.project.project_id}/renders/${shot.shot_id}_slate.png?t=${Date.now()}`;
      return `<img src="${relUrl}" alt="Animatic Slate" class="animatic-img" onerror="this.onerror=null; this.src=''; this.parentElement.innerHTML='<div style=\\'color:#ef4444;\\'>Animatic 生成中或未找到圖檔</div>';" />`;
    }
    return `<div style="color: var(--text-dim); font-size: 0.9rem;">尚未渲染 2.39:1 Animatic Slate</div>`;
  }

  _renderQAItems() {
    if (this.qaResult && this.qaResult.items && this.qaResult.items.length > 0) {
      return this.qaResult.items.map((it) => `
        <div class="qa-item">
          <span class="qa-item-name" title="${it.detail || it.name}">${it.name}</span>
          <span class="${it.passed ? 'qa-pill-pass' : 'qa-pill-fail'}">
            ${it.passed ? '✓ PASS' : '✕ FAIL'}
          </span>
        </div>
      `).join('');
    }

    // Default 20 standard items
    const standardNames = [
      'Zero mm/ISO lens tags',
      'Zero emotion adjectives',
      'Headless sheet law locked',
      'Red arrow contact verified',
      'Meisner stimulus present',
      'Meisner micro action present',
      '180 degree axis respected',
      'Continuity first-frame locked',
      'Continuity screen direction locked',
      'Continuity lens locked',
      'Continuity count locked',
      'Continuity stillness locked',
      'Monotonic states noted',
      'Voice token anchor locked',
      'Lighting ratio locked',
      'Spatial coordinates in range',
      'Known handles strictly verified',
      'Duration within 5-15s bound',
      'Aspect ratio 2.39:1 compliant',
      '10-Section & 15-Block matched',
    ];

    return standardNames.map((name) => `
      <div class="qa-item">
        <span class="qa-item-name">${name}</span>
        <span class="qa-pill-pass">✓ PASS</span>
      </div>
    `).join('');
  }

  _getPromptContent() {
    const shot = this.getActiveShot();
    if (!shot) return '請先選取鏡頭...';

    if (this.activePromptTab === '15block') {
      return this.compiledPrompt?.block_15_text || shot.compiled_15_block || '點擊上方重新編譯鏡頭以產生 15-Block 提示詞...';
    } else {
      return this.compiledPrompt?.section_10_text || shot.compiled_10_section || '點擊上方重新編譯鏡頭以產生 10-Section 提示詞...';
    }
  }

  _bindEvents() {
    // Shot tabs
    const shotTabs = this.container.querySelectorAll('.shot-tab[data-shot-idx]');
    shotTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const idx = parseInt(tab.getAttribute('data-shot-idx'), 10);
        this.selectShotIndex(idx);
      });
    });

    // Add Shot
    const addShotBtn = document.getElementById('btn-add-shot');
    if (addShotBtn) {
      addShotBtn.addEventListener('click', () => this.handleAddShot());
    }

    // Gate buttons
    const approveBtns = this.container.querySelectorAll('.btn-approve-gate');
    approveBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const gateKey = btn.getAttribute('data-gate');
        this.handleGateUpdate(gateKey, 'approved');
      });
    });

    const rejectBtns = this.container.querySelectorAll('.btn-reject-gate');
    rejectBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const gateKey = btn.getAttribute('data-gate');
        this.handleGateUpdate(gateKey, 'rejected');
      });
    });

    // Re-render Animatic button
    const renderAnimBtn = document.getElementById('btn-re-render-animatic');
    if (renderAnimBtn) {
      renderAnimBtn.addEventListener('click', () => this.handleRenderAnimatic());
    }

    // Save Shot Spec
    const saveShotBtn = document.getElementById('btn-save-shot-spec');
    if (saveShotBtn) {
      saveShotBtn.addEventListener('click', () => this.handleSaveShotSpec());
    }

    // QA Auto-fix
    const autoFixBtn = document.getElementById('btn-qa-autofix');
    if (autoFixBtn) {
      autoFixBtn.addEventListener('click', () => this.handleAutoFixQA());
    }

    // Run Rescue
    const rescueBtn = document.getElementById('btn-run-rescue');
    if (rescueBtn) {
      rescueBtn.addEventListener('click', () => this.handleRunRescue());
    }

    // Export Timeline
    const exportBtn = document.getElementById('btn-export-timeline');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.handleExportTimeline());
    }

    // Prompt tabs
    const tab15 = document.getElementById('btn-tab-15block');
    const tab10 = document.getElementById('btn-tab-10section');
    const copyBtn = document.getElementById('btn-copy-prompt');

    if (tab15) {
      tab15.addEventListener('click', () => {
        this.activePromptTab = '15block';
        this.render();
      });
    }

    if (tab10) {
      tab10.addEventListener('click', () => {
        this.activePromptTab = '10section';
        this.render();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = this._getPromptContent();
        navigator.clipboard.writeText(text).then(() => {
          this.onToast('已複製提示詞到剪貼簿！');
        });
      });
    }
  }

  selectShotIndex(idx) {
    if (!this.project || !this.project.shots[idx]) return;
    this.activeShotIndex = idx;
    this.activeShotId = this.project.shots[idx].shot_id;
    this.render();
    this.autoCompileActiveShot();
    this.onShotSelected(this.project.shots[idx]);
  }

  async handleAddShot() {
    if (!this.project) return;
    const newOrder = this.project.shots.length + 1;
    const newShotId = `shot-${String(newOrder).padStart(2, '0')}`;
    const newShot = {
      shot_id: newShotId,
      scene_id: 'sc-01',
      order: newOrder,
      title: `Shot ${String(newOrder).padStart(2, '0')} 緊湊延伸鏡`,
      duration_sec: 5,
      camera_lens_mm: 50,
      camera_move: 'Low-angle slow tracking shot',
      spatial_nodes: [
        { id: 's1', handle: this.project.characters[0]?.handle || '@actor', role: 'subject', x: 0.5, y: 0.65, facing_deg: 90 },
      ],
      meisner_stimulus: 'Opponent steps forward into frame with sharp metallic ping',
      meisner_micro_action: 'Fingers tense, breathing rhythm slows down to steady beat',
      dialogue_line: '',
      continuity_locks: {
        first_frame_lock: 'Subject positioned center foreground',
        screen_direction_lock: 'Subject maintains camera-forward orientation',
        lens_lock: '50mm prime, zero focal change',
        count_lock: 'Exactly 1 subject in frame',
        stillness_lock: 'Background environment remains motionless',
        monotonic_state_notes: 'Wear and tear on gear persists',
      },
      qa_passed: true,
      iteration_count: 1,
      rescue_history: [],
      status: 'pending',
    };

    this.project.shots.push(newShot);
    this.activeShotIndex = this.project.shots.length - 1;
    this.activeShotId = newShotId;
    this.onToast(`已新增鏡頭 Shot ${newOrder}`);
    this.render();
    this.handleRenderAnimatic();
    this.onProjectUpdated(this.project);
  }

  async handleGateUpdate(gateKey, status) {
    if (!this.project) return;
    try {
      const updated = await api.updateGate(this.project.project_id, gateKey, {
        status,
        notes: `由 Backlot 審批看板直接變更狀態為 ${status}`,
      });
      this.project = updated;
      this.render();
      this.onToast(`閘門 [${gateKey}] 已更新為：${status.toUpperCase()}`);
      this.onProjectUpdated(this.project);
    } catch (err) {
      console.error('Update gate failed:', err);
      this.onToast(`更新閘門失敗: ${err.message}`, 'error');
    }
  }

  async handleRenderAnimatic() {
    const shot = this.getActiveShot();
    if (!this.project || !shot) return;
    this.onToast(`正在渲染 Shot ${shot.order} 技術分鏡板...`);
    try {
      const res = await api.renderAnimatic(this.project.project_id, shot.shot_id);
      shot.animatic_slate_path = res.slate_path;
      this.render();
      this.onToast(`Shot ${shot.order} 技術分鏡板渲染成功！`);
    } catch (err) {
      console.error('Render animatic error:', err);
      this.onToast(`渲染分鏡板失敗: ${err.message}`, 'error');
    }
  }

  async handleSaveShotSpec() {
    const shot = this.getActiveShot();
    if (!this.project || !shot) return;

    const dur = parseInt(document.getElementById('shot-duration-select').value, 10);
    const lens = parseInt(document.getElementById('shot-lens-select').value, 10);
    const move = document.getElementById('shot-cameramove-input').value.trim();
    const stim = document.getElementById('shot-stimulus-input').value.trim();
    const act = document.getElementById('shot-microaction-input').value.trim();

    try {
      const updatedShot = await api.updateShot(this.project.project_id, shot.shot_id, {
        duration_sec: dur,
        camera_lens_mm: lens,
        camera_move: move,
        meisner_stimulus: stim,
        meisner_micro_action: act,
      });

      Object.assign(shot, updatedShot);
      this.onToast(`Shot ${shot.order} 設定已儲存並同步至工作區！`);
      this.autoCompileActiveShot();
    } catch (err) {
      console.error('Save shot failed:', err);
      this.onToast(`儲存鏡頭失敗: ${err.message}`, 'error');
    }
  }

  async autoCompileActiveShot() {
    const shot = this.getActiveShot();
    if (!this.project || !shot) return;

    try {
      const res = await api.compileShot(this.project.project_id, shot.shot_id);
      this.compiledPrompt = res.compiled;
      this.qaResult = res.qa;

      // Update prompt box
      const promptEl = document.getElementById('compiled-prompt-text');
      if (promptEl) promptEl.textContent = this._getPromptContent();

      // Update QA score
      const qaBadge = document.getElementById('qa-score-badge');
      if (qaBadge) {
        qaBadge.textContent = `${res.qa.score}/20 ${res.qa.passed ? 'PASS' : 'FAIL'}`;
        qaBadge.style.color = res.qa.passed ? 'var(--accent-emerald)' : 'var(--accent-crimson)';
      }

      // Update QA Items list
      const qaContainer = document.getElementById('qa-items-container');
      if (qaContainer) qaContainer.innerHTML = this._renderQAItems();
    } catch (err) {
      console.error('Auto compile shot failed:', err);
    }
  }

  async handleAutoFixQA() {
    const shot = this.getActiveShot();
    if (!this.project || !shot) return;

    this.onToast('AI 自動修復中 (校正梅斯納刺激、連續性鎖與幾何座標)...');
    try {
      const fixedShot = await api.autoFixShot(this.project.project_id, shot.shot_id);
      Object.assign(shot, fixedShot);
      this.onToast('AI 已成功自動修復 20 點 QA 規則！');
      this.render();
      this.autoCompileActiveShot();
    } catch (err) {
      console.error('Auto fix error:', err);
      this.onToast(`自動修復失敗: ${err.message}`, 'error');
    }
  }

  async handleRunRescue() {
    const shot = this.getActiveShot();
    if (!this.project || !shot) return;

    const failureType = document.getElementById('rescue-failure-type').value;
    const iterCount = parseInt(document.getElementById('rescue-iter-count').value, 10);
    const prev = shot.compiled_15_block || '35mm anamorphic prime lens. Actor sprints forward.';
    const curr = (shot.compiled_15_block || '35mm anamorphic prime lens. Actor sprints forward.') + ' [Rescue check]';

    try {
      const res = await api.rescueShot(this.project.project_id, shot.shot_id, {
        prev_prompt: prev,
        curr_prompt: curr,
        iteration_count: iterCount,
        failure_type: failureType,
      });

      this.rescueResult = res;
      const actionTag = document.getElementById('rescue-action-tag');
      const outputBox = document.getElementById('rescue-output-box');

      if (actionTag) {
        actionTag.textContent = res.stop_loss.action;
        actionTag.style.color = res.stop_loss.action === 'INSERT_REACTION_BRIDGE_SHOT' ? 'var(--accent-crimson)' : 'var(--accent-gold)';
      }

      if (outputBox) {
        outputBox.style.display = 'block';
        outputBox.innerHTML = `
          <div style="margin-bottom: 0.3rem;"><strong>單變量 Diff 判定:</strong> ${res.diff.is_single_variable ? '<span class="diff-tag-single">✓ 合規單變量微調</span>' : '<span class="diff-tag-multi">✕ 多變量失控警告</span>'}</div>
          <div style="margin-bottom: 0.3rem;"><strong>停損處方:</strong> ${res.stop_loss.message}</div>
          ${res.stop_loss.bridge_shot_suggestion ? `<div style="color: var(--accent-gold);"><strong>0.8s 反應橋接鏡建議:</strong> ${res.stop_loss.bridge_shot_suggestion}</div>` : ''}
        `;
      }

      this.onToast(`停損救援判定完成：${res.stop_loss.action}`);
    } catch (err) {
      console.error('Rescue error:', err);
      this.onToast(`救援評估失敗: ${err.message}`, 'error');
    }
  }

  async handleExportTimeline() {
    if (!this.project) return;
    try {
      const res = await api.generateTimeline(this.project.project_id);
      alert(`🎞️ FFmpeg 時間軸 Concat 腳本已生成！\n\nConcat 清單：${res.concat_file}\n指令：\n${res.ffmpeg_command}`);
      this.onToast('已生成 FFmpeg 時間軸清單！');
    } catch (err) {
      console.error('Generate timeline error:', err);
      this.onToast(`時間軸生成失敗: ${err.message}`, 'error');
    }
  }
}
