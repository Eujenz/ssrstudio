/**
 * SSRStudio v2 — Interactive 2D Spatial Radar Canvas
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
    this.triggerSpatialCompile();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="card" style="padding: 1rem;">
        <div class="card-header" style="margin-bottom: 0.75rem;">
          <div class="card-title">
            <span>🎯 2D 空間雷達走位盤 (Spatial Radar Blocking)</span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <select id="radar-lens-select" class="wizard-select" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; width: auto;">
              <option value="24" ${this.lensMm === 24 ? 'selected' : ''}>24mm 超廣角</option>
              <option value="35" ${this.lensMm === 35 ? 'selected' : ''}>35mm 變形主鏡</option>
              <option value="50" ${this.lensMm === 50 ? 'selected' : ''}>50mm 標準人像</option>
              <option value="85" ${this.lensMm === 85 ? 'selected' : ''}>85mm 緊湊特寫</option>
              <option value="135" ${this.lensMm === 135 ? 'selected' : ''}>135mm 長焦壓縮</option>
            </select>
            <button type="button" class="btn-secondary" id="radar-add-node-btn" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
              + 新增節點
            </button>
          </div>
        </div>

        <div class="canvas-wrapper" style="border: 1px solid var(--border-dim); position: relative;">
          <canvas id="radar-canvas-element" width="600" height="420" class="interactive-canvas"></canvas>
          <div style="position: absolute; bottom: 8px; left: 10px; font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-dim); pointer-events: none;">
            拖曳節點調整走位 | 滾輪/點擊旋轉朝向角度 (0°-360°)
          </div>
        </div>

        <div style="margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;" id="radar-nodes-list">
          <!-- Rendered dynamically -->
        </div>

        <div style="margin-top: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
              即時空間幾何編譯 (Auto Spatial Geometry)
            </span>
            <span style="font-size: 0.7rem; font-family: var(--font-mono); color: var(--accent-cyan);" id="radar-coords-readout">
              x: 0.00 | y: 0.00
            </span>
          </div>
          <div class="prompt-display" id="radar-spatial-output" style="max-height: 120px; font-size: 0.75rem; padding: 0.6rem;">
            ${this.compiledText || '載入走位中...'}
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('radar-canvas-element');
    this.ctx = this.canvas.getContext('2d');

    this._bindEvents();
    this.draw();
    this.triggerSpatialCompile();
  }

  _bindEvents() {
    const lensSelect = document.getElementById('radar-lens-select');
    if (lensSelect) {
      lensSelect.addEventListener('change', (e) => {
        this.lensMm = parseInt(e.target.value, 10);
        this.triggerSpatialCompile();
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
          y: 0.5,
          facing_deg: 90,
        });
        this.draw();
        this.renderNodesList();
        this.triggerSpatialCompile();
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
    // Find clicked node (radius ~ 18px)
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
      readout.textContent = `${this.draggedNode.handle} => x: ${this.draggedNode.x} | y: ${this.draggedNode.y} | ${this.draggedNode.facing_deg}°`;
    }

    this.draw();
  }

  _onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.draggedNode = null;
      this.onNodesChanged(this.nodes);
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

    // Grid lines & Rule of thirds
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(0, h * 0.6, w, h * 0.4); // Foreground
    ctx.fillStyle = 'rgba(245, 158, 11, 0.03)';
    ctx.fillRect(0, 0, w, h * 0.35); // Background

    // Stage labels
    ctx.fillStyle = '#4b5563';
    ctx.font = '11px Space Mono';
    ctx.fillText('◄ SCREEN-LEFT', 15, 20);
    ctx.fillText('SCREEN-RIGHT ►', w - 110, 20);
    ctx.fillText('▲ BACKGROUND (Upstage)', w / 2 - 70, 20);
    ctx.fillText('▼ FOREGROUND (Downstage)', w / 2 - 80, h - 15);

    // 180° Stage axis
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw nodes
    this.nodes.forEach((node) => {
      const nx = node.x * w;
      const ny = node.y * h;
      const isSelected = node.id === this.selectedNodeId;

      // Color scheme by role
      let color = '#38bdf8'; // Subject (cyan/blue)
      if (node.role === 'camera') color = '#f59e0b'; // Gold
      else if (node.role === 'light') color = '#fb923c'; // Orange
      else if (node.role === 'prop') color = '#a855f7'; // Purple

      // FOV Cone if camera
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
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.lineTo(ax, ay);
      ctx.stroke();

      // Arrow head
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ax, ay, 3, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring if selected
      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nx, ny, 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Center Node Circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(nx, ny, 14, 0, Math.PI * 2);
      ctx.fill();

      // Node label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.handle || node.id, nx, ny + 26);
    });
  }

  renderNodesList() {
    const container = document.getElementById('radar-nodes-list');
    if (!container) return;

    container.innerHTML = this.nodes.map(n => `
      <div style="background: var(--bg-surface); border: 1px solid ${n.id === this.selectedNodeId ? 'var(--accent-cyan)' : 'var(--border-dim)'}; border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.72rem; display: flex; align-items: center; gap: 0.4rem;">
        <span style="font-weight: 700; color: #fff;">${n.handle}</span>
        <span style="color: var(--text-dim);">(${n.role})</span>
        <span style="font-family: var(--font-mono); color: var(--accent-gold);">${n.facing_deg}°</span>
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
