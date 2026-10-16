/**
 * SSRStudio v2 — Pre-comp Prop & Contact Canvas Component (Commercial UX 2.1)
 * Allows drawing #FF0000 red contact arrows, grip vectors, and anchor bounding boxes
 * onto props or character turnaround sheets to enforce physical grip and eliminate hand hallucinations.
 */

import { api } from './api_client.js';

export class PropCanvas {
  constructor({ containerId, onSaveContactSheet, onToast }) {
    this.container = document.getElementById(containerId);
    this.onSaveContactSheet = onSaveContactSheet || (() => {});
    this.onToast = onToast || console.log;

    this.canvas = null;
    this.ctx = null;
    this.baseImage = null;
    this.currentTool = 'arrow'; // 'arrow' | 'box'
    this.arrows = [
      { x1: 185, y1: 130, x2: 270, y2: 185, label: 'GRIP_LOCK_THUMB' },
      { x1: 410, y1: 245, x2: 325, y2: 205, label: 'HILT_PRESSURE' },
    ];
    this.boxes = [
      { x1: 255, y1: 155, x2: 345, y2: 235, label: 'CONTACT_ZONE' },
    ];

    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.activeProjectId = null;
    this.activeShotId = null;
    this.lastSavedPath = null;
  }

  init(projectId, shotId) {
    this.activeProjectId = projectId;
    this.activeShotId = shotId;
    this.render();
  }

  setShot(projectId, shotId) {
    this.activeProjectId = projectId;
    this.activeShotId = shotId;
    this.draw();
    this._updateStatus();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="card" style="padding: 1.15rem;">
        <div class="card-header" style="margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div class="card-title">
              <span>🛡️ 紅箭頭道具接觸預合成畫布 (Pre-comp Contact Canvas)</span>
              <span class="engine-badge real">🟢 本地真實運算 (Pillow 寫入 PNG)</span>
            </div>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">
              <strong>為什麼要畫紅箭頭？</strong> AI 影片最常發生「手指穿過刀柄、武器懸空漂浮」。在首幀墊圖畫上高對比 <code>#FF0000</code> 紅箭頭與接觸框，能強制視覺編碼器鎖死手部握持點！
            </p>
          </div>
        </div>

        <!-- Step-by-Step Action Hint -->
        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; padding: 0.6rem 0.85rem; margin-bottom: 0.75rem; font-size: 0.78rem; color: var(--text-main); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <strong>👆 操作方式：</strong> 直接在下方畫布<strong>按住滑鼠拖曳</strong>畫出紅箭頭（指向手指握住刀柄的位置），再點右下角<strong>「💾 匯出並鎖定接觸圖」</strong>即可產生真實 PNG 圖檔。
          </div>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <button type="button" class="btn-secondary ${this.currentTool === 'arrow' ? 'active' : ''}" id="prop-tool-arrow" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">
              🏹 畫 #FF0000 紅箭頭
            </button>
            <button type="button" class="btn-secondary ${this.currentTool === 'box' ? 'active' : ''}" id="prop-tool-box" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">
              🔲 畫接觸錨框
            </button>
            <button type="button" class="btn-secondary" id="prop-tool-demo" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">
              🎯 載入範例標註
            </button>
            <button type="button" class="btn-secondary" id="prop-tool-clear" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">
              🧹 清空
            </button>
            <label class="btn-secondary" style="padding: 0.25rem 0.65rem; font-size: 0.75rem; cursor: pointer; border-color: rgba(6, 182, 212, 0.4); color: var(--accent-cyan);">
              📁 上傳自訂底圖
              <input type="file" id="prop-file-input" accept="image/*" style="display: none;" />
            </label>
          </div>
        </div>

        <div class="canvas-wrapper" style="border: 1px solid var(--border-dim); position: relative;">
          <canvas id="prop-canvas-element" width="600" height="380" class="interactive-canvas"></canvas>
        </div>

        <div style="margin-top: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div style="font-size: 0.76rem; font-family: var(--font-mono); color: #fca5a5;" id="prop-status-text">
            已標註: ${this.arrows.length} 個紅箭頭向量, ${this.boxes.length} 個接觸錨框
          </div>
          <button type="button" class="btn-primary" id="btn-save-contact-sheet" style="padding: 0.5rem 1.1rem; font-size: 0.82rem;">
            💾 匯出並鎖定接觸圖至專案 (Save Contact PNG)
          </button>
        </div>

        <div id="prop-saved-preview" style="display: ${this.lastSavedPath ? 'block' : 'none'}; margin-top: 0.65rem; padding: 0.6rem 0.85rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; font-size: 0.76rem; color: #6ee7b7;">
          ✅ 已寫入硬碟：<code>${this.lastSavedPath || ''}</code> （同时已自動勾選該鏡頭的「紅箭頭接觸圖鎖定」QA 檢查項！）
        </div>
      </div>
    `;

    this.canvas = document.getElementById('prop-canvas-element');
    this.ctx = this.canvas.getContext('2d');

    this._bindEvents();
    this.draw();
  }

  _bindEvents() {
    const arrowBtn = document.getElementById('prop-tool-arrow');
    const boxBtn = document.getElementById('prop-tool-box');
    const demoBtn = document.getElementById('prop-tool-demo');
    const clearBtn = document.getElementById('prop-tool-clear');
    const fileInput = document.getElementById('prop-file-input');
    const saveBtn = document.getElementById('btn-save-contact-sheet');

    if (arrowBtn) {
      arrowBtn.addEventListener('click', () => {
        this.currentTool = 'arrow';
        arrowBtn.classList.add('active');
        if (boxBtn) boxBtn.classList.remove('active');
        this.onToast('已切換為：🏹 #FF0000 紅箭頭接觸向量工具');
      });
    }

    if (boxBtn) {
      boxBtn.addEventListener('click', () => {
        this.currentTool = 'box';
        boxBtn.classList.add('active');
        if (arrowBtn) arrowBtn.classList.remove('active');
        this.onToast('已切換為：🔲 定位接觸錨框工具');
      });
    }

    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        this.arrows = [
          { x1: 185, y1: 130, x2: 270, y2: 185, label: 'GRIP_LOCK_THUMB' },
          { x1: 410, y1: 245, x2: 325, y2: 205, label: 'HILT_PRESSURE' },
        ];
        this.boxes = [
          { x1: 255, y1: 155, x2: 345, y2: 235, label: 'CONTACT_ZONE' },
        ];
        this.draw();
        this._updateStatus();
        this.onToast('已載入範例握柄接觸標註！可點右下角「匯出並鎖定接觸圖」保存。');
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.arrows = [];
        this.boxes = [];
        this.draw();
        this._updateStatus();
        this.onToast('已清除畫布標註');
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            this.baseImage = img;
            this.draw();
            this.onToast('底圖載入完成！請在物體接觸處拖曳繪製紅箭頭。');
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave());
    }

    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
  }

  _getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  _onMouseDown(e) {
    const coords = this._getCanvasCoords(e);
    this.isDrawing = true;
    this.startX = coords.x;
    this.startY = coords.y;
  }

  _onMouseMove(e) {
    if (!this.isDrawing) return;
    const coords = this._getCanvasCoords(e);
    this.draw();

    const ctx = this.ctx;
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 3;

    if (this.currentTool === 'arrow') {
      this._drawArrow(ctx, this.startX, this.startY, coords.x, coords.y, 'GRIP_CONTACT');
    } else {
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(this.startX, this.startY, coords.x - this.startX, coords.y - this.startY);
      ctx.setLineDash([]);
    }
  }

  _onMouseUp(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const coords = this._getCanvasCoords(e);

    const dist = Math.hypot(coords.x - this.startX, coords.y - this.startY);
    if (dist > 10) {
      if (this.currentTool === 'arrow') {
        this.arrows.push({
          x1: Math.round(this.startX),
          y1: Math.round(this.startY),
          x2: Math.round(coords.x),
          y2: Math.round(coords.y),
          label: 'GRIP_CONTACT',
        });
      } else {
        this.boxes.push({
          x1: Math.round(Math.min(this.startX, coords.x)),
          y1: Math.round(Math.min(this.startY, coords.y)),
          x2: Math.round(Math.max(this.startX, coords.x)),
          y2: Math.round(Math.max(this.startY, coords.y)),
          label: 'ANCHOR_REGION',
        });
      }
    }

    this.draw();
    this._updateStatus();
  }

  _drawArrow(ctx, x1, y1, x2, y2, label) {
    const headLen = 14;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.strokeStyle = '#FF0000';
    ctx.fillStyle = '#FF0000';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    if (label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Space Mono';
      ctx.textAlign = 'left';
      ctx.fillText(label, (x1 + x2) / 2 + 6, (y1 + y2) / 2 - 6);
    }
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#0d1017';
    ctx.fillRect(0, 0, w, h);

    if (this.baseImage) {
      ctx.drawImage(this.baseImage, 0, 0, w, h);
    } else {
      // Draw a clear schematic blueprint of Weapon Hilt + Hand Grip Zone so user understands immediately
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Draw schematic weapon blade & hilt diagonal across center
      ctx.save();
      ctx.translate(300, 195);
      ctx.rotate(-0.45);
      // Blade
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.fillRect(-190, -10, 140, 20);
      ctx.strokeRect(-190, -10, 140, 20);
      // Guard (Tsuba)
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-50, -28, 10, 56);
      // Hilt (Grip area)
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#94a3b8';
      ctx.fillRect(-40, -12, 125, 24);
      ctx.strokeRect(-40, -12, 125, 24);
      // Grip wrap lines
      ctx.strokeStyle = '#475569';
      for (let gx = -30; gx < 75; gx += 18) {
        ctx.beginPath(); ctx.moveTo(gx, -12); ctx.lineTo(gx + 10, 12); ctx.stroke();
      }
      ctx.restore();

      // Schematic hand grip silhouette around center
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(300, 195, 42, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('【預設道具握持示意底圖：角色手掌 × 武器刀柄接觸區】', w / 2, 34);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px "Noto Sans TC", sans-serif';
      ctx.fillText('在畫布上按住滑鼠拖曳即可新增 #FF0000 紅箭頭，或點上方「上傳自訂底圖」', w / 2, h - 18);
    }

    // Draw saved boxes
    this.boxes.forEach((b) => {
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Space Mono';
      ctx.textAlign = 'left';
      ctx.fillText(b.label, b.x1 + 4, b.y1 - 5);
    });

    // Draw saved arrows
    this.arrows.forEach((a) => {
      this._drawArrow(ctx, a.x1, a.y1, a.x2, a.y2, a.label);
    });
  }

  _updateStatus() {
    const status = document.getElementById('prop-status-text');
    if (status) {
      status.textContent = `已標註: ${this.arrows.length} 個紅箭頭向量, ${this.boxes.length} 個接觸錨框`;
    }
  }

  async handleSave() {
    if (!this.canvas) return;
    const dataUrl = this.canvas.toDataURL('image/png');
    const projectId = this.activeProjectId || 'demo-hell-grind';
    const shotId = this.activeShotId || 'shot-01';
    const outImgPath = `projects/${projectId}/renders/${shotId}_contact_sheet.png`;

    try {
      const res = await api.saveContactSheet({
        out_img_path: outImgPath,
        data_url: dataUrl,
        arrows: this.arrows,
        anchor_boxes: this.boxes,
      });

      this.lastSavedPath = res.contact_sheet_path || outImgPath;
      const previewEl = document.getElementById('prop-saved-preview');
      if (previewEl) {
        previewEl.style.display = 'block';
        previewEl.innerHTML = `✅ 已寫入硬碟：<code>${this.lastSavedPath}</code> （同時已自動滿足該鏡頭的「紅箭頭接觸圖鎖定」QA 檢查項！）`;
      }

      // Also update the shot's contact_sheet_path so QA check #4 is guaranteed locked
      await api.updateShot(projectId, shotId, {
        contact_sheet_path: this.lastSavedPath,
      });

      this.onToast('✅ 已成功匯出 #FF0000 紅箭頭接觸圖並鎖定至當前鏡頭！');
      this.onSaveContactSheet(res);
    } catch (err) {
      console.error('Save contact sheet error:', err);
      this.onToast(`匯出接觸圖失敗: ${err.message}`, 'error');
    }
  }
}
