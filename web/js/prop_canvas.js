/**
 * SSRStudio v2 — Pre-comp Prop & Contact Canvas Component
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
    this.arrows = []; // [{ x1, y1, x2, y2, label }]
    this.boxes = [];  // [{ x1, y1, x2, y2, label }]

    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.activeProjectId = null;
    this.activeShotId = null;
  }

  init(projectId, shotId) {
    this.activeProjectId = projectId;
    this.activeShotId = shotId;
    this.render();
  }

  setShot(projectId, shotId) {
    this.activeProjectId = projectId;
    this.activeShotId = shotId;
    this.arrows = [];
    this.boxes = [];
    this.draw();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="card" style="padding: 1rem;">
        <div class="card-header" style="margin-bottom: 0.75rem;">
          <div class="card-title">
            <span>🛡️ 道具物理接觸標註盤 (Pre-comp Contact Canvas)</span>
          </div>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <button type="button" class="btn-secondary ${this.currentTool === 'arrow' ? 'active' : ''}" id="prop-tool-arrow" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
              🏹 #FF0000 紅箭頭
            </button>
            <button type="button" class="btn-secondary ${this.currentTool === 'box' ? 'active' : ''}" id="prop-tool-box" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
              🔲 定位錨框
            </button>
            <button type="button" class="btn-secondary" id="prop-tool-clear" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
              🧹 清除標註
            </button>
          </div>
        </div>

        <div style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            防禦性視覺預合成：標註握柄接觸點與作用力向量，防止手指與道具穿模
          </div>
          <label class="btn-secondary" style="padding: 0.2rem 0.6rem; font-size: 0.72rem; cursor: pointer;">
            📁 載入底圖
            <input type="file" id="prop-file-input" accept="image/*" style="display: none;" />
          </label>
        </div>

        <div class="canvas-wrapper" style="border: 1px solid var(--border-dim); position: relative;">
          <canvas id="prop-canvas-element" width="600" height="380" class="interactive-canvas"></canvas>
        </div>

        <div style="margin-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 0.75rem; font-family: var(--font-mono); color: var(--accent-crimson);" id="prop-status-text">
            已標註: 0 個箭頭向量, 0 個錨框
          </div>
          <button type="button" class="btn-primary" id="btn-save-contact-sheet" style="padding: 0.4rem 1rem; font-size: 0.82rem;">
            💾 匯出並鎖定接觸圖 (Save Contact Sheet)
          </button>
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
    const clearBtn = document.getElementById('prop-tool-clear');
    const fileInput = document.getElementById('prop-file-input');
    const saveBtn = document.getElementById('btn-save-contact-sheet');

    if (arrowBtn) {
      arrowBtn.addEventListener('click', () => {
        this.currentTool = 'arrow';
        this.onToast('已切換為：#FF0000 紅箭頭接觸向量工具');
      });
    }

    if (boxBtn) {
      boxBtn.addEventListener('click', () => {
        this.currentTool = 'box';
        this.onToast('已切換為：定位錨框工具');
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
            this.onToast('底圖載入完成！請在物體接觸處繪製紅箭頭。');
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

    // Draw live preview
    const ctx = this.ctx;
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 3;

    if (this.currentTool === 'arrow') {
      this._drawArrow(ctx, this.startX, this.startY, coords.x, coords.y, 'CONTACT_VECTOR');
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

    // Line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrow Head
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Label
    if (label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Space Mono';
      ctx.fillText(label, (x1 + x2) / 2 + 5, (y1 + y2) / 2 - 5);
    }
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#0f1118';
    ctx.fillRect(0, 0, w, h);

    // Draw base image if loaded
    if (this.baseImage) {
      ctx.drawImage(this.baseImage, 0, 0, w, h);
    } else {
      // Default schematic guide
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeRect(20, 20, w - 40, h - 40);
      ctx.fillStyle = '#4b5563';
      ctx.font = '12px Space Mono';
      ctx.textAlign = 'center';
      ctx.fillText('點選上方「載入底圖」或直接在畫布上繪製 #FF0000 接觸向量', w / 2, h / 2);
    }

    // Draw saved boxes
    this.boxes.forEach((b) => {
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Space Mono';
      ctx.fillText(b.label, b.x1 + 4, b.y1 + 12);
    });

    // Draw saved arrows
    this.arrows.forEach((a) => {
      this._drawArrow(ctx, a.x1, a.y1, a.x2, a.y2, a.label);
    });
  }

  _updateStatus() {
    const status = document.getElementById('prop-status-text');
    if (status) {
      status.textContent = `已標註: ${this.arrows.length} 個箭頭向量, ${this.boxes.length} 個錨框`;
    }
  }

  async handleSave() {
    if (!this.canvas) return;
    const dataUrl = this.canvas.toDataURL('image/png');
    const projectId = this.activeProjectId || 'demo-project';
    const shotId = this.activeShotId || 'shot-01';
    const outImgPath = `projects/${projectId}/renders/${shotId}_contact_sheet.png`;

    try {
      const res = await api.saveContactSheet({
        out_img_path: outImgPath,
        data_url: dataUrl,
        arrows: this.arrows,
        anchor_boxes: this.boxes,
      });

      this.onToast('已成功匯出 #FF0000 接觸圖至專案目錄！');
      this.onSaveContactSheet(res);
    } catch (err) {
      console.error('Save contact sheet error:', err);
      this.onToast(`匯出接觸圖失敗: ${err.message}`, 'error');
    }
  }
}
