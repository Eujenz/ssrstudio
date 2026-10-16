/**
 * SSRStudio v2.1 — Interactive 2D Spatial Radar Canvas
 * Provides real-time normalized (x,y) positioning and orientation (facing_deg)
 * for camera, subjects, lights, and props, feeding directly into /api/compiler/spatial.
 */

import { api } from './api_client.js';

export class RadarCanvas {
  constructor({ containerId, onNodesChanged, onSpatialCompiled, onToast }) {
    this.container = document.getElementById(containerId);
    this.onNodesChanged = onNodesChanged || (() => {});
    this.onSpatialCompiled = onSpatialCompiled || (() => {});
    this.onToast = onToast || console.log;

    this.canvas = null;
    this.ctx = null;
    this.nodes = [];
    this.lensMm = 35;
    this.cameraMove = 'Locked-off tripod';
    this.selectedNodeId = null;
    this.isDragging = false;
    this.draggedNode = null;
    this.compiledText = '';
  }

  init(nodes = [], lensMm = 35, cameraMove = 'Locked-off tripod') {
    this.nodes = JSON.parse(JSON.stringify(nodes));
    this.lensMm = lensMm;
    this.cameraMove = cameraMove;
    this.render();
  }

  setNodes(nodes, lensMm, cameraMove) {
    this.nodes = JSON.parse(JSON.stringify(nodes || []));
    if (lensMm !== undefined) this.lensMm = lensMm;
    if (cameraMove !== undefined) this.cameraMove = cameraMove;
    this.draw();
    this.renderNodesList();
    this.triggerSpatialCompile();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="card" style="padding: 1.1rem;">
        <div class="card-header" style="margin-bottom: 0.6rem;">
          <div>
            <div class="card-title">
              <span>🎯 2D 空間雷達走位盤 (Spatial Radar Blocking)</span>
              <span class="engine-badge real">🟢 即時座標運算 (/api/compiler/spatial)</span>
            </div>
          </div>
          <div style="display: flex; gap: 0.45rem; align-items: center;">
            <select id="radar-lens-select" class="wizard-select" style="padding: 0.25rem 0.55rem; font-size: 0.76rem; width: auto;" title="切換鏡頭焦段會即時改變視錐寬度">
              <option value="24" ${this.lensMm === 24 ? 'selected' : ''}>24mm 廣角全景</option>
              <option value="35" ${this.lensMm === 35 ? 'selected' : ''}>35mm 變形主鏡</option>
              <option value="50" ${this.lensMm === 50 ? 'selected' : ''}>50mm 標準中景</option>
              <option value="85" ${this.lensMm === 85 ? 'selected' : ''}>85mm 緊湊特寫</option>
              <option value="135" ${this.lensMm === 135 ? 'selected' : ''}>135mm 極限特寫</option>
            </select>
            <button type="button" class="btn-secondary" id="radar-add-node-btn" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
              + 新增角色/道具點
            </button>
          </div>
        </div>

        <div class="helper-box" style="margin-bottom: 0.75rem;">
          <div style="font-weight: 700; color: #fff; margin-bottom: 0.2rem;">💡 為什麼這一步很重要？怎麼操作？</div>
          <div>
            AI 影片模型看不懂「站在旁邊、靠近門口」這種模糊詞，容易讓兩個角色黏在一起或忽左忽右（越軸）。<br/>
            👆 <strong>操作方式：</strong>用滑鼠<strong>按住畫布上的圓點拖曳</strong>改變站位，將游標移到圓點上<strong>滾動滑鼠滾輪</strong>改變面對方向（箭頭），放開滑鼠後下方會<strong>即時算出真實公尺距離與景深象限</strong>，並自動存入當前鏡頭！
          </div>
        </div>

        <div class="canvas-wrapper" style="border: 1px solid var(--border-dim); position: relative;">
          <canvas id="radar-canvas-element" width="600" height="390" class="interactive-canvas"></canvas>
          <div style="position: absolute; bottom: 8px; left: 10px; font-family: var(--font-mono); font-size: 0.72rem; color: #cbd5e1; background: rgba(0,0,0,0.65); padding: 2px 8px; border-radius: 4px; pointer-events: none;">
            🖱️ 左鍵按住圓點拖曳位置 ｜ 滾輪旋轉面對方向 (0°–360°)
          </div>
        </div>

        <div style="margin-top: 0.65rem; display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center;" id="radar-nodes-list">
          <!-- Rendered dynamically -->
        </div>

        <div style="margin-top: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
            <span style="font-size: 0.76rem; font-weight: 700; color: var(--accent-emerald);">
              ✅ 後端即時換算出的精確空間指令（已自動寫入提示詞 Block [07/15]）：
            </span>
            <span style="font-size: 0.72rem; font-family: var(--font-mono); color: var(--accent-cyan);" id="radar-coords-readout">
              拖曳圓點查看即時座標
            </span>
          </div>
          <div class="prompt-display" id="radar-spatial-output" style="max-height: 115px; font-size: 0.76rem; padding: 0.65rem;">
            ${this.compiledText || '載入走位中...'}
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('radar-canvas-element');
    this.ctx = this.canvas.getContext('2d');

    this._bindEvents();
    this.draw();
    this.renderNodesList();
    this.triggerSpatialCompile();
  }

  _bindEvents() {
    const lensSelect = document.getElementById('radar-lens-select');
    if (lensSelect) {
      lensSelect.addEventListener('change', (e) => {
        this.lensMm = parseInt(e.target.value, 10);
        this.draw();
        this.triggerSpatialCompile();
        this.onNodesChanged(this.nodes, this.lensMm);
      });
    }

    const addBtn = document.getElementById('radar-add-node-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const id = 'n' + (this.nodes.length + 1);
        this.nodes.push({
          id,
          handle: `@actor_${this.nodes.length}`,
          role: 'subject',
          x: 0.5,
          y: 0.55,
          facing_deg: 90,
        });
        this.draw();
        this.renderNodesList();
        this.onNodesChanged(this.nodes, this.lensMm);
        this.triggerSpatialCompile();
        this.onToast('已在雷達盤新增一個走位節點，請用滑鼠拖曳調整位置！');
      });
    }

    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('mouseup', () => this._onMouseUp());
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
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
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      const nx = node.x * this.canvas.width;
      const ny = node.y * this.canvas.height;
      const dist = Math.hypot(coords.x - nx, coords.y - ny);
      if (dist <= 24) {
        this.isDragging = true;
        this.draggedNode = node;
        this.selectedNodeId = node.id;
        this.draw();
        this.renderNodesList();
        return;
      }
    }
  }

  _onMouseMove(e) {
    if (!this.isDragging || !this.draggedNode) return;
    const coords = this._getCanvasCoords(e);
    const normX = Math.max(0.05, Math.min(0.95, coords.x / this.canvas.width));
    const normY = Math.max(0.05, Math.min(0.95, coords.y / this.canvas.height));

    this.draggedNode.x = parseFloat(normX.toFixed(2));
    this.draggedNode.y = parseFloat(normY.toFixed(2));

    const readout = document.getElementById('radar-coords-readout');
    if (readout) {
      readout.textContent = `${this.draggedNode.handle} ➔ X: ${this.draggedNode.x} | Y: ${this.draggedNode.y} | 朝向: ${this.draggedNode.facing_deg}°`;
    }

    this.draw();
  }

  _onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.draggedNode = null;
      this.renderNodesList();
      this.onNodesChanged(this.nodes, this.lensMm);
      this.triggerSpatialCompile();
    }
  }

  _onWheel(e) {
    const coords = this._getCanvasCoords(e);
    for (const node of this.nodes) {
      const nx = node.x * this.canvas.width;
      const ny = node.y * this.canvas.height;
      const dist = Math.hypot(coords.x - nx, coords.y - ny);
      if (dist <= 28) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 15 : -15;
        node.facing_deg = (node.facing_deg + delta + 360) % 360;
        this.draw();
        this.renderNodesList();
        this.onNodesChanged(this.nodes, this.lensMm);
        this.triggerSpatialCompile();
        return;
      }
    }
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#090c15';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Depth zones
    ctx.fillStyle = 'rgba(56, 189, 248, 0.03)';
    ctx.fillRect(0, h * 0.6, w, h * 0.4); // Foreground
    ctx.fillStyle = 'rgba(245, 158, 11, 0.03)';
    ctx.fillRect(0, 0, w, h * 0.35); // Background

    // Clear bilingual stage labels
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "Noto Sans TC", Space Mono, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('◄ 畫面左側 (Screen-Left)', 12, 20);
    ctx.textAlign = 'right';
    ctx.fillText('畫面右側 (Screen-Right) ►', w - 12, 20);
    ctx.textAlign = 'center';
    ctx.fillText('▲ 遠景 / 背景區 (Background > 3m)', w / 2, 20);
    ctx.fillText('── 中景對峙區 (Midground 1.5m–3m) / 180° 軸線 ──', w / 2, h * 0.48);
    ctx.fillText('▼ 前景近鏡區 / 攝影機側 (Foreground < 1.5m)', w / 2, h - 14);

    // 180° Stage axis
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Default camera cone at bottom center if no explicit camera node
    const hasCam = this.nodes.some(n => n.role === 'camera');
    if (!hasCam) {
      const camX = w * 0.5;
      const camY = h * 0.92;
      const fovDeg = Math.max(22, 84 - (this.lensMm - 24) * 0.5);
      const fovRad = (fovDeg * Math.PI) / 180;
      const upRad = -Math.PI / 2;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.09)';
      ctx.beginPath();
      ctx.moveTo(camX, camY);
      ctx.arc(camX, camY, 240, upRad - fovRad / 2, upRad + fovRad / 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 10px Space Mono';
      ctx.fillText(`🎥 主攝影機 (${this.lensMm}mm 視錐)`, camX, camY - 6);
    }

    // Draw nodes
    this.nodes.forEach((node) => {
      const nx = node.x * w;
      const ny = node.y * h;
      const isSelected = node.id === this.selectedNodeId;

      let color = '#38bdf8'; // Subject (cyan/blue)
      if (node.role === 'camera') color = '#f59e0b';
      else if (node.role === 'light') color = '#fb923c';
      else if (node.role === 'prop') color = '#a855f7';

      if (node.role === 'camera') {
        const rad = (node.facing_deg * Math.PI) / 180;
        const fov = ((80 - (this.lensMm - 24) * 0.5) * Math.PI) / 180;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.arc(nx, ny, 160, rad - fov / 2, rad + fov / 2);
        ctx.closePath();
        ctx.fill();
      }

      // Orientation vector arrow
      const angleRad = (node.facing_deg * Math.PI) / 180;
      const arrowLen = 30;
      const ax = nx + Math.cos(angleRad) * arrowLen;
      const ay = ny + Math.sin(angleRad) * arrowLen;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.lineTo(ax, ay);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nx, ny, 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(nx, ny, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.handle || node.id, nx, ny + 27);
    });
  }

  renderNodesList() {
    const container = document.getElementById('radar-nodes-list');
    if (!container) return;

    const roleMap = {
      subject: '角色主體',
      camera: '攝影機',
      prop: '道具',
      light: '光源',
    };

    container.innerHTML = this.nodes.map(n => `
      <div style="background: var(--bg-surface); border: 1px solid ${n.id === this.selectedNodeId ? 'var(--accent-cyan)' : 'var(--border-dim)'}; border-radius: 6px; padding: 0.25rem 0.6rem; font-size: 0.74rem; display: flex; align-items: center; gap: 0.45rem;">
        <span style="font-weight: 700; color: #fff;">${n.handle}</span>
        <span style="color: var(--text-muted);">(${roleMap[n.role] || n.role})</span>
        <span style="font-family: var(--font-mono); color: var(--accent-cyan);">X:${n.x} Y:${n.y}</span>
        <span style="font-family: var(--font-mono); color: var(--accent-gold);">朝向:${n.facing_deg}°</span>
      </div>
    `).join('');
  }

  async triggerSpatialCompile() {
    try {
      const res = await api.compileSpatial({
        nodes: this.nodes,
        lens_mm: this.lensMm,
        camera_move: this.cameraMove,
      });
      this.compiledText = res.spatial_text;
      const output = document.getElementById('radar-spatial-output');
      if (output) output.textContent = res.spatial_text;
      this.onSpatialCompiled(res.spatial_text);
    } catch (err) {
      console.error('Spatial compile error:', err);
    }
  }
}
