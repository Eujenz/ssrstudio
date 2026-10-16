/**
 * SSRStudio v2 — API Client Module
 * Provides typed, clean REST wrappers for all FastAPI endpoints & SSE event subscriptions.
 */

class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  async _request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
    };

    const res = await fetch(url, config);
    if (!res.ok) {
      let errorMsg = `HTTP ${res.status} ${res.statusText}`;
      try {
        const errJson = await res.json();
        if (errJson.detail) {
          errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch (_) {}
      throw new Error(errorMsg);
    }
    return await res.json();
  }

  // System
  async healthCheck() {
    return this._request('/api/health');
  }

  async listTools() {
    return this._request('/api/tools');
  }

  // Projects
  async listProjects() {
    return this._request('/api/projects');
  }

  async createProject(payload) {
    return this._request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getProject(projectId) {
    return this._request(`/api/projects/${encodeURIComponent(projectId)}`);
  }

  async updateProject(projectId, updates) {
    return this._request(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async updateGate(projectId, gateName, { status, notes = '' }) {
    return this._request(`/api/projects/${encodeURIComponent(projectId)}/gates/${encodeURIComponent(gateName)}`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    });
  }

  async updateShot(projectId, shotId, updates) {
    return this._request(`/api/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async renderAnimatic(projectId, shotId) {
    return this._request(`/api/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/render-animatic`, {
      method: 'POST',
    });
  }

  async generateTimeline(projectId) {
    return this._request(`/api/projects/${encodeURIComponent(projectId)}/timeline`, {
      method: 'POST',
    });
  }

  // Guided Wizard
  async bootstrapWizard({ title, idea, shot_count = 3, style_preset = 'hell_grind_anamorphic' }) {
    return this._request('/api/wizard/bootstrap', {
      method: 'POST',
      body: JSON.stringify({ title, idea, shot_count, style_preset }),
    });
  }

  async autoFixShot(projectId, shotId) {
    return this._request(`/api/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/auto-fix`, {
      method: 'POST',
    });
  }

  // Compiler & QA
  async compileShot(projectId, shotId) {
    return this._request(`/api/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/compile`, {
      method: 'POST',
    });
  }

  async compileSpatial({ nodes, lens_mm = 35, camera_move = 'Locked-off tripod' }) {
    return this._request('/api/compiler/spatial', {
      method: 'POST',
      body: JSON.stringify({ nodes, lens_mm, camera_move }),
    });
  }

  async lintPrompt(text) {
    return this._request('/api/compiler/lint', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async rescueShot(projectId, shotId, { prev_prompt, curr_prompt, iteration_count = 1, failure_type = 'physics_collapse' }) {
    return this._request(`/api/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/rescue`, {
      method: 'POST',
      body: JSON.stringify({ prev_prompt, curr_prompt, iteration_count, failure_type }),
    });
  }

  // Vision & Assets
  async headlessCrop({ src_path = null, dest_path, top_crop_ratio = 0.22, data_url = null, character_handle = '@character' }) {
    return this._request('/api/assets/headless-crop', {
      method: 'POST',
      body: JSON.stringify({ src_path, dest_path, top_crop_ratio, data_url, character_handle }),
    });
  }

  async saveContactSheet({ base_img_path, out_img_path, arrows = null, anchor_boxes = null, data_url = null }) {
    return this._request('/api/assets/contact-sheet', {
      method: 'POST',
      body: JSON.stringify({ base_img_path, out_img_path, arrows, anchor_boxes, data_url }),
    });
  }

  // Reactive SSE Connection
  subscribeEvents(onMessage, onConnected, onError) {
    const eventSource = new EventSource(`${this.baseUrl}/api/events`);

    eventSource.addEventListener('connected', (e) => {
      if (onConnected) {
        try {
          const data = JSON.parse(e.data);
          onConnected(data);
        } catch (_) {
          onConnected(e.data);
        }
      }
    });

    eventSource.addEventListener('message', (e) => {
      if (onMessage) {
        try {
          const parsed = JSON.parse(e.data);
          onMessage(parsed);
        } catch (_) {
          onMessage(e.data);
        }
      }
    });

    eventSource.onerror = (err) => {
      if (onError) onError(err);
    };

    return eventSource;
  }
}

export const api = new ApiClient();
export default api;
