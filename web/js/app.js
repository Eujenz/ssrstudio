/**
 * SSRStudio v2 — Main Application Orchestrator (Commercial UX 2.1)
 * Pure Vanilla ES Module. Integrates the 5-Step Guided Production Pipeline:
 * Step 1: Guided Wizard + 5-Stage Story Funnel
 * Step 2: Asset Bible (@Characters, @Locations, @Props) + Pillow Headless Cropper
 * Step 3: 2.39:1 Animatic Slate + 2D Spatial Radar + #FF0000 Red-Arrow Contact Canvas
 * Step 4: Meisner Physical Acting Editor + Real 20-Point QA Checklist & Auto-Fix
 * Step 5: Dual Prompt Contract Exporter + 15-Iteration Stop-Loss Rescue + FFmpeg Timeline
 */

import { api } from './api_client.js';
import { GuidedWizard } from './guided_wizard.js';
import { BacklotBoard } from './backlot_board.js';
import { RadarCanvas } from './radar_canvas.js';
import { PropCanvas } from './prop_canvas.js';

class StudioApp {
  constructor() {
    this.currentStep = 1; // 1 | 2 | 3 | 4 | 5
    this.layoutMode = 'step'; // 'step' (Guided Step-by-Step) | 'all' (All-in-One Expert Overview)
    this.activeStep3Tool = 'radar'; // 'radar' | 'prop'
    this.currentProject = null;
    this.allProjects = [];

    this.wizard = null;
    this.backlot = null;
    this.radar = null;
    this.prop = null;

    this.toastTimer = null;
  }

  async init() {
    console.log('🚀 Initializing SSRStudio v2 Commercial UX 2.1...');

    // 1. Initialize Components
    this.wizard = new GuidedWizard({
      containerId: 'view-wizard-container',
      onProjectCreated: (proj) => {
        this.onProjectLoaded(proj);
        // Scroll down slightly so user sees the newly generated Story Funnel in Step 1
        const funnelEl = document.getElementById('view-funnel-container');
        if (funnelEl) {
          funnelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
      onToast: (msg, type) => this.showToast(msg, type),
    });

    this.backlot = new BacklotBoard({
      onShotSelected: (shot) => this.onShotSelected(shot),
      onProjectUpdated: (proj) => {
        this.currentProject = proj;
        this.updateStepperBadges();
      },
      onStepChangeRequest: (stepNum) => this.switchStep(stepNum),
      onToast: (msg, type) => this.showToast(msg, type),
    });

    this.radar = new RadarCanvas({
      containerId: 'tactical-radar-container',
      onNodesChanged: (nodes) => this.onRadarNodesChanged(nodes),
      onSpatialCompiled: () => {},
      onToast: (msg, type) => this.showToast(msg, type),
    });

    this.prop = new PropCanvas({
      containerId: 'tactical-prop-container',
      onSaveContactSheet: () => {
        if (this.currentProject) {
          this.backlot.autoCompileActiveShot();
        }
      },
      onToast: (msg, type) => this.showToast(msg, type),
    });

    // 2. Render Step 1 Wizard
    this.wizard.render();

    // 3. Bind Header, Stepper, Onboarding Drawer & Step 3 Tool Sub-tabs
    this.bindGlobalControls();

    // 4. Connect SSE
    this.connectSSE();

    // 5. Load project list & default project
    await this.refreshProjectList();
    if (this.allProjects.length > 0) {
      await this.loadProject(this.allProjects[0].project_id);
    }

    this.applyViewVisibility();
  }

  bindGlobalControls() {
    // Layout mode switcher (Step-by-Step vs All-in-One Overview)
    const btnStepMode = document.getElementById('btn-layout-step');
    const btnAllMode = document.getElementById('btn-layout-all');

    if (btnStepMode) {
      btnStepMode.addEventListener('click', () => {
        this.layoutMode = 'step';
        btnStepMode.classList.add('active');
        if (btnAllMode) btnAllMode.classList.remove('active');
        this.applyViewVisibility();
        this.showToast('🧭 已切換為「分步引導模式」：一次專注完成一個步驟');
      });
    }

    if (btnAllMode) {
      btnAllMode.addEventListener('click', () => {
        this.layoutMode = 'all';
        btnAllMode.classList.add('active');
        if (btnStepMode) btnStepMode.classList.remove('active');
        this.applyViewVisibility();
        this.syncTacticalCanvases();
        this.showToast('🖥️ 已切換為「全景專家總覽」：一頁展開全部 5 個步驟');
      });
    }

    // Onboarding Banner Toggle
    const btnToggleOnboarding = document.getElementById('btn-toggle-onboarding');
    const btnCloseOnboarding = document.getElementById('btn-close-onboarding');
    const onboardingBanner = document.getElementById('onboarding-banner');

    if (btnToggleOnboarding && onboardingBanner) {
      btnToggleOnboarding.addEventListener('click', () => {
        const isHidden = onboardingBanner.style.display === 'none';
        onboardingBanner.style.display = isHidden ? 'block' : 'none';
      });
    }
    if (btnCloseOnboarding && onboardingBanner) {
      btnCloseOnboarding.addEventListener('click', () => {
        onboardingBanner.style.display = 'none';
      });
    }

    // 5-Step Pipeline Stepper Clicks
    const stepperBar = document.getElementById('pipeline-stepper-bar');
    if (stepperBar) {
      stepperBar.querySelectorAll('.step-item[data-step]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const stepNum = parseInt(btn.getAttribute('data-step'), 10);
          this.switchStep(stepNum);
        });
      });
    }

    // Project Selector
    const projectSelect = document.getElementById('header-project-select');
    if (projectSelect) {
      projectSelect.addEventListener('change', (e) => {
        const pId = e.target.value;
        if (pId) this.loadProject(pId);
      });
    }

    // Step 3 Sub-tabs (2D Radar vs #FF0000 Red Arrow Prop Canvas)
    const tabRadar = document.getElementById('tab-btn-radar');
    const tabProp = document.getElementById('tab-btn-prop');
    const radarContainer = document.getElementById('tactical-radar-container');
    const propContainer = document.getElementById('tactical-prop-container');

    if (tabRadar && tabProp && radarContainer && propContainer) {
      tabRadar.addEventListener('click', () => {
        this.activeStep3Tool = 'radar';
        tabRadar.classList.add('active');
        tabProp.classList.remove('active');
        radarContainer.style.display = 'block';
        propContainer.style.display = 'none';
        this.syncTacticalCanvases();
      });

      tabProp.addEventListener('click', () => {
        this.activeStep3Tool = 'prop';
        tabProp.classList.add('active');
        tabRadar.classList.remove('active');
        radarContainer.style.display = 'none';
        propContainer.style.display = 'block';
        this.syncTacticalCanvases();
      });
    }
  }

  switchStep(stepNum) {
    this.currentStep = stepNum;
    if (this.layoutMode === 'all') {
      // In overview mode, scroll smoothly to that step panel
      const panel = document.getElementById(`step-panel-${stepNum}`);
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      this.applyViewVisibility();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (stepNum === 3) {
      this.syncTacticalCanvases();
    }
    this.updateStepperBadges();
  }

  applyViewVisibility() {
    const globalShotBar = document.getElementById('global-shot-bar');

    if (this.layoutMode === 'all') {
      // Show all 5 panels at once
      for (let i = 1; i <= 5; i++) {
        const p = document.getElementById(`step-panel-${i}`);
        if (p) p.style.display = 'block';
      }
      if (globalShotBar) globalShotBar.style.display = 'block';
    } else {
      // Show only active step panel
      for (let i = 1; i <= 5; i++) {
        const p = document.getElementById(`step-panel-${i}`);
        if (p) p.style.display = i === this.currentStep ? 'block' : 'none';
      }
      // Show global shot selector on Steps 3, 4, 5
      if (globalShotBar) {
        globalShotBar.style.display = this.currentStep >= 3 ? 'block' : 'none';
      }
    }

    // Highlight active step button in stepper bar
    const stepperBar = document.getElementById('pipeline-stepper-bar');
    if (stepperBar) {
      stepperBar.querySelectorAll('.step-item[data-step]').forEach((btn) => {
        const s = parseInt(btn.getAttribute('data-step'), 10);
        if (s === this.currentStep) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  }

  updateStepperBadges() {
    if (!this.currentProject) return;
    const gates = this.currentProject.gates || {};
    const qa = this.backlot?.qaResult;

    const setGatePill = (stepIdx, statusText, isApproved, isWarning = false) => {
      const pill = document.getElementById(`stepper-gate-${stepIdx}`);
      const stepBtn = document.querySelector(`.step-item[data-step="${stepIdx}"]`);
      if (!pill) return;
      pill.textContent = statusText;
      if (isApproved) {
        pill.style.background = 'rgba(16, 185, 129, 0.2)';
        pill.style.color = '#34d399';
        if (stepBtn) stepBtn.classList.add('completed');
      } else if (isWarning) {
        pill.style.background = 'rgba(239, 68, 68, 0.2)';
        pill.style.color = '#f87171';
        if (stepBtn) stepBtn.classList.remove('completed');
      } else {
        pill.style.background = 'rgba(255, 255, 255, 0.08)';
        pill.style.color = 'var(--text-muted)';
        if (stepBtn) stepBtn.classList.remove('completed');
      }
    };

    setGatePill(1, gates.story_funnel === 'approved' ? '✓ 已核准' : '待確認', gates.story_funnel === 'approved');
    setGatePill(2, gates.asset_bible === 'approved' ? '✓ 已核准' : '待確認', gates.asset_bible === 'approved');
    setGatePill(3, gates.storyboard_blocking === 'approved' ? '✓ 已核准' : '待確認', gates.storyboard_blocking === 'approved');

    if (qa) {
      setGatePill(4, `${qa.score}/20 ${qa.passed ? '通過' : '未通過'}`, qa.passed, !qa.passed);
    } else {
      setGatePill(4, '20/20 通過', true);
    }

    setGatePill(5, gates.final_render === 'approved' ? '✓ 已完片' : '可匯出', gates.final_render === 'approved');
  }

  async refreshProjectList() {
    try {
      this.allProjects = await api.listProjects();
      const select = document.getElementById('header-project-select');
      if (!select) return;

      select.innerHTML = this.allProjects.map(p => `
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

    // Populate all 5 step views in BacklotBoard
    this.backlot.setProject(project);

    // Sync Tactical Canvases (Step 3)
    this.syncTacticalCanvases();
    this.updateStepperBadges();
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

  connectSSE() {
    const sseDot = document.getElementById('sse-status-dot');
    const sseText = document.getElementById('sse-status-text');

    api.subscribeEvents(
      (event) => {
        const eventType = event.event_type || event.type;
        if (eventType === 'wizard_bootstrapped' || eventType === 'project_created') {
          this.refreshProjectList();
        }
      },
      () => {
        if (sseDot) sseDot.style.background = 'var(--accent-emerald)';
        if (sseText) sseText.textContent = '本地引擎連線正常';
      },
      () => {
        if (sseDot) sseDot.style.background = 'var(--accent-crimson)';
        if (sseText) sseText.textContent = '重新連線中...';
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
    }, 4000);
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new StudioApp();
  window.__SSRSTUDIO_APP__ = app;
  app.init().catch(err => console.error('App init failed:', err));
});
