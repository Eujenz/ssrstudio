/**
 * SSRStudio v2 — Main Application Orchestrator
 * Pure Vanilla ES Module. Integrates Guided Wizard, Backlot Board, Radar Canvas, and Prop Canvas.
 * Connects to SSE /api/events for reactive real-time state synchronization.
 */

import { api } from './api_client.js';
import { GuidedWizard } from './guided_wizard.js';
import { BacklotBoard } from './backlot_board.js';
import { RadarCanvas } from './radar_canvas.js';
import { PropCanvas } from './prop_canvas.js';

class StudioApp {
  constructor() {
    this.currentMode = 'guided'; // 'guided' | 'tactical'
    this.currentProject = null;
    this.allProjects = [];

    this.wizard = null;
    this.backlot = null;
    this.radar = null;
    this.prop = null;

    this.toastTimer = null;
  }

  async init() {
    console.log('🚀 Initializing SSRStudio v2 Web Application...');

    // 1. Initialize Components
    this.wizard = new GuidedWizard({
      containerId: 'view-wizard-container',
      onProjectCreated: (proj) => this.onProjectLoaded(proj),
      onToast: (msg, type) => this.showToast(msg, type),
    });

    this.backlot = new BacklotBoard({
      containerId: 'view-backlot-container',
      onShotSelected: (shot) => this.onShotSelected(shot),
      onProjectUpdated: (proj) => {
        this.currentProject = proj;
        this.syncTacticalCanvases();
      },
      onToast: (msg, type) => this.showToast(msg, type),
    });

    this.radar = new RadarCanvas({
      containerId: 'tactical-radar-container',
      onNodesChanged: (nodes) => this.onRadarNodesChanged(nodes),
      onSpatialCompiled: (text) => this.onSpatialCompiled(text),
      onToast: (msg, type) => this.showToast(msg, type),
    });

    this.prop = new PropCanvas({
      containerId: 'tactical-prop-container',
      onSaveContactSheet: () => {
        if (this.currentProject) {
          this.loadProject(this.currentProject.project_id);
        }
      },
      onToast: (msg, type) => this.showToast(msg, type),
    });

    // 2. Render sub-views
    this.wizard.render();

    // 3. Bind Header and Global controls
    this.bindHeaderControls();

    // 4. Connect SSE
    this.connectSSE();

    // 5. Load project list
    await this.refreshProjectList();

    // 6. If projects exist, load the latest one; otherwise show wizard
    if (this.allProjects.length > 0) {
      await this.loadProject(this.allProjects[0].project_id);
    } else {
      this.switchMode('guided');
    }
  }

  bindHeaderControls() {
    const btnGuided = document.getElementById('btn-mode-guided');
    const btnTactical = document.getElementById('btn-mode-tactical');
    const projectSelect = document.getElementById('header-project-select');

    if (btnGuided) {
      btnGuided.addEventListener('click', () => this.switchMode('guided'));
    }
    if (btnTactical) {
      btnTactical.addEventListener('click', () => this.switchMode('tactical'));
    }

    if (projectSelect) {
      projectSelect.addEventListener('change', (e) => {
        const pId = e.target.value;
        if (pId) this.loadProject(pId);
      });
    }
  }

  switchMode(mode) {
    this.currentMode = mode;
    const btnGuided = document.getElementById('btn-mode-guided');
    const btnTactical = document.getElementById('btn-mode-tactical');
    const wizardView = document.getElementById('view-wizard-container');
    const tacticalView = document.getElementById('view-tactical-canvases');

    if (mode === 'guided') {
      if (btnGuided) btnGuided.classList.add('active');
      if (btnTactical) btnTactical.classList.remove('active');
      if (wizardView) wizardView.style.display = 'block';
      if (tacticalView) tacticalView.style.display = 'none';
    } else {
      if (btnTactical) btnTactical.classList.add('active');
      if (btnGuided) btnGuided.classList.remove('active');
      if (wizardView) wizardView.style.display = 'none';
      if (tacticalView) tacticalView.style.display = 'grid';
      this.syncTacticalCanvases();
    }
  }

  async refreshProjectList() {
    try {
      this.allProjects = await api.listProjects();
      const select = document.getElementById('header-project-select');
      if (!select) return;

      select.innerHTML = '<option value="">📁 切換工作區專案...</option>' +
        this.allProjects.map(p => `
          <option value="${p.project_id}" ${this.currentProject && this.currentProject.project_id === p.project_id ? 'selected' : ''}>
            ${p.title} (${p.project_id})
          </option>
        `).join('');
    } catch (err) {
      console.warn('Could not list projects:', err);
    }
  }

  async loadProject(projectId) {
    try {
      const proj = await api.getProject(projectId);
      this.onProjectLoaded(proj);
    } catch (err) {
      console.error(`Failed to load project ${projectId}:`, err);
      this.showToast(`載入專案失敗: ${err.message}`, 'error');
    }
  }

  onProjectLoaded(project) {
    this.currentProject = project;
    this.refreshProjectList();

    // Pass to Backlot Board
    this.backlot.setProject(project);

    // Sync Tactical Canvases
    this.syncTacticalCanvases();
  }

  onShotSelected(shot) {
    if (!this.currentProject || !shot) return;
    this.radar.setNodes(shot.spatial_nodes || [], shot.camera_lens_mm, shot.camera_move);
    this.prop.setShot(this.currentProject.project_id, shot.shot_id);
  }

  syncTacticalCanvases() {
    if (!this.currentProject) return;
    const activeShot = this.backlot.getActiveShot();
    if (activeShot) {
      this.radar.init(activeShot.spatial_nodes || [], activeShot.camera_lens_mm, activeShot.camera_move);
      this.prop.init(this.currentProject.project_id, activeShot.shot_id);
    }
  }

  async onRadarNodesChanged(nodes) {
    const activeShot = this.backlot.getActiveShot();
    if (!this.currentProject || !activeShot) return;

    activeShot.spatial_nodes = nodes;
    try {
      await api.updateShot(this.currentProject.project_id, activeShot.shot_id, {
        spatial_nodes: nodes,
      });
      this.backlot.autoCompileActiveShot();
    } catch (err) {
      console.error('Failed to sync radar nodes:', err);
    }
  }

  onSpatialCompiled(text) {
    // Spatial text compiled
  }

  connectSSE() {
    const sseDot = document.getElementById('sse-status-dot');
    const sseText = document.getElementById('sse-status-text');

    api.subscribeEvents(
      (event) => {
        // Reactive event handler
        const eventType = event.event_type || event.type;
        console.log('⚡ SSE Event received:', eventType, event.data);

        if (eventType === 'wizard_bootstrapped' || eventType === 'project_created') {
          this.refreshProjectList();
          if (event.data?.project_id && (!this.currentProject || this.currentProject.project_id !== event.data.project_id)) {
            this.loadProject(event.data.project_id);
          }
        } else if (eventType === 'gate_updated' || eventType === 'animatic_rendered' || eventType === 'shot_updated') {
          if (this.currentProject && event.data?.project_id === this.currentProject.project_id) {
            // Background refresh without destroying form focus
            api.getProject(this.currentProject.project_id).then((fresh) => {
              this.currentProject = fresh;
            });
          }
        }
      },
      (connectData) => {
        if (sseDot) sseDot.style.background = 'var(--accent-emerald)';
        if (sseText) sseText.textContent = 'SSE ONLINE';
      },
      (err) => {
        if (sseDot) sseDot.style.background = 'var(--accent-crimson)';
        if (sseText) sseText.textContent = 'SSE RECONNECTING';
      }
    );
  }

  showToast(message, type = 'info') {
    let toast = document.getElementById('studio-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'studio-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.borderColor = type === 'error' ? 'var(--accent-crimson)' : 'var(--accent-cyan)';
    toast.style.display = 'block';

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new StudioApp();
  window.__SSRSTUDIO_APP__ = app;
  app.init().catch(err => console.error('App init failed:', err));
});
