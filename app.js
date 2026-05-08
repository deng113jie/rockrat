/* ============================================
   ResearchAgent Studio — Interactions
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const workspaceHub = document.getElementById('workspace-hub');
  const workbenchShell = document.getElementById('workbench-shell');
  const workspaceEntries = document.querySelectorAll('[data-open-workspace]');
  const workspaceCreateBtn = document.getElementById('workspace-create-btn');
  const editClaudeMdBtn = document.getElementById('edit-claude-md-btn');
  const wsCreateOverlay = document.getElementById('workspace-create-overlay');
  const wsCreateInput = document.getElementById('workspace-create-name');
  const wsCreateConfirmBtn = document.getElementById('workspace-create-confirm');
  const wsCreateCloseBtn = document.getElementById('workspace-create-close');
  const paperFileList = document.getElementById('paper-file-list');
  const paperAddBtn = document.getElementById('paper-add-btn');
  const paperLearnBtn = document.getElementById('paper-learn-btn');
  const paperDialogOverlay = document.getElementById('paper-dialog-overlay');
  const addChapterBtn = document.getElementById('add-chapter-btn');
  const generatePdfBtn = document.getElementById('generate-pdf-btn');
  const writePaperDialogOverlay = document.getElementById('write-paper-dialog-overlay');
  const writePaperDialogCloseBtn = document.getElementById('write-paper-dialog-close');
  const paperTitleInput = document.getElementById('paper-title-input');
  const paperFormatInput = document.getElementById('paper-format-input');
  const writePaperGenerateBtn = document.getElementById('write-paper-generate-btn');
  const ideasDialogOverlay = document.getElementById('ideas-dialog-overlay');
  const ideasDialogCloseBtn = document.getElementById('ideas-dialog-close');
  const ideasHintInput = document.getElementById('ideas-hint-input');
  const ideasDialogGenerateBtn = document.getElementById('ideas-dialog-generate-btn');
  const sectionDialogOverlay = document.getElementById('section-dialog-overlay');
  const sectionDialogCloseBtn = document.getElementById('section-dialog-close');
  const sectionTitleInput = document.getElementById('section-title-input');
  const sectionInstructionsInput = document.getElementById('section-instructions-input');
  const sectionGenerateBtn = document.getElementById('section-generate-btn');
  const improveBtn = document.getElementById('improve-btn');
  const improveDialogOverlay = document.getElementById('improve-dialog-overlay');
  const improveDialogCloseBtn = document.getElementById('improve-dialog-close');
  const improveInput = document.getElementById('improve-input');
  const improveSubmitBtn = document.getElementById('improve-submit-btn');
  const paperDialogCloseBtn = document.getElementById('paper-dialog-close');
  const paperUploadTrigger = document.getElementById('paper-upload-trigger');
  const paperUploadInput = document.getElementById('paper-upload-input');
  const paperDialogEnterBtn = document.getElementById('paper-dialog-enter');
  const paperDialogQuery = document.getElementById('paper-dialog-query');
  const titlebarName = document.querySelector('.titlebar__name');
  const breadcrumbProject = document.querySelector('.breadcrumb__item');
  const assetMapNodes = document.querySelectorAll('[data-asset-target]');

  function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- Streaming state: shared across all agent API calls ---
  let streamingController = null;

  function setStreaming(controller) {
    streamingController = controller;
    const btn = document.getElementById('pipeline-feedback-send');
    if (btn) btn.textContent = '!!!停止！!!';
  }

  function clearStreaming() {
    streamingController = null;
    const btn = document.getElementById('pipeline-feedback-send');
    if (btn) btn.textContent = '>>>发送>>>';
    clearSelectedSkills();
  }

  function showLiteratureCard() {
    let literatureCard = document.getElementById('literature_view_md');
    if (!literatureCard) {
      const anchor = document.getElementById('asset-target-brief');
      if (!anchor) return;
      literatureCard = document.createElement('section');
      literatureCard.className = 'workspace-card';
      literatureCard.id = 'literature_view_md';
      anchor.insertAdjacentElement('afterend', literatureCard);
    }
    literatureCard.innerHTML = `
      <div class="workspace-card__header">
        <span class="workspace-card__icon" style="color:#7fd8ff">&#128196;</span>
        <span>Literature View</span>
        <span style="margin-left:auto;font-size:11px;color:var(--text-2)">✓ Ready</span>
      </div>
      <div class="workspace-card__body" style="min-height:80px;display:flex;align-items:center;justify-content:center">
        <div id="study-file-icon" title="Double-click to open study.md" style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;padding:12px 16px;border-radius:6px;transition:background 0.15s">
          <img src="./icon/md_icon.png" style="width:36px;height:36px;object-fit:contain" alt="md">
          <span style="font-size:11px;color:var(--text-2)">study.md</span>
        </div>
      </div>`;
    const icon = document.getElementById('study-file-icon');
    icon.addEventListener('mouseenter', () => { icon.style.background = 'var(--hover-bg, rgba(255,255,255,0.06))'; });
    icon.addEventListener('mouseleave', () => { icon.style.background = ''; });
    icon.addEventListener('dblclick', () => {
      fetch('/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: 'study.md' }),
      });
    });
  }

  async function checkAndRestoreLiteratureCard() {
    try {
      const res = await fetch('/api/file-exists?file=study.md');
      const data = await res.json();
      if (data.exists) showLiteratureCard();
    } catch (_) {}
  }

  function showPlanCard(absPath) {
    const planCard = document.getElementById('asset-target-plan');
    if (!planCard) return;
    const body = planCard.querySelector('.workspace-card__body');
    if (!body) return;

    // Ensure header has a ✓ Ready badge (don't duplicate)
    if (!planCard.querySelector('#plan-ready-badge')) {
      const badge = document.createElement('span');
      badge.id = 'plan-ready-badge';
      badge.style.cssText = 'margin-left:auto;font-size:11px;color:var(--text-2)';
      badge.textContent = '✓ Ready';
      planCard.querySelector('.workspace-card__header')?.appendChild(badge);
    }

    body.style.cssText = 'min-height:80px;display:flex;align-items:center;justify-content:center';
    body.innerHTML = `
      <div id="plan-file-icon" title="双击打开 plan.md" style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;padding:12px 16px;border-radius:6px;transition:background 0.15s">
        <img src="./icon/md_icon.png" style="width:36px;height:36px;object-fit:contain" alt="md">
        <span style="font-size:11px;color:var(--text-2)">plan.md</span>
      </div>`;
    const icon = document.getElementById('plan-file-icon');
    icon.addEventListener('mouseenter', () => { icon.style.background = 'var(--hover-bg, rgba(255,255,255,0.06))'; });
    icon.addEventListener('mouseleave', () => { icon.style.background = ''; });
    icon.addEventListener('dblclick', () => {
      fetch('/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: absPath }),
      });
    });
  }

  async function checkAndRestorePlanCard() {
    try {
      const res = await fetch('/api/file-exists?file=plan.md');
      const data = await res.json();
      if (data.exists) showPlanCard(data.path);
    } catch (_) {}
  }

  function showIdeasCard(ideas) {
    const topicsCard = document.getElementById('asset-target-topics');
    if (!topicsCard) return;
    const body = topicsCard.querySelector('.workspace-card__body');
    if (!body) return;
    body.style.cssText = '';
    if (!ideas || ideas.length === 0) {
      body.innerHTML = '<p class="workspace-card__placeholder">未找到结构化创新点。</p>';
      return;
    }
    body.innerHTML = `<div class="workspace-topic-candidates"></div>`;
    const container = body.querySelector('.workspace-topic-candidates');
    ideas.forEach((idea, idx) => {
      const article = document.createElement('article');
      article.className = 'workspace-topic-card' + (idx === 0 ? ' featured selected' : '');
      article.innerHTML = `
        <div class="workspace-topic-card__header">
          <div>
            <h4 class="workspace-topic-card__title">${escapeHtml(idea.label)} — ${escapeHtml(idea.title)}</h4>
            <div class="workspace-topic-card__subtitle">${escapeHtml(idea.stars)}</div>
          </div>
          <div class="workspace-topic-card__aside">
            <button class="workspace-topic-card__adopt-btn" type="button">采纳</button>
          </div>
        </div>
        <div class="workspace-topic-card__summary">${escapeHtml(idea.summary)}</div>`;
      container.appendChild(article);
    });
  }

  function showIdeasFileFallback() {
    const topicsCard = document.getElementById('asset-target-topics');
    if (!topicsCard) return;
    const body = topicsCard.querySelector('.workspace-card__body');
    if (!body) return;
    body.style.cssText = 'min-height:80px;display:flex;align-items:center;justify-content:center';
    body.innerHTML = `
      <div id="idea-file-icon" title="Double-click to open idea.md" style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;padding:12px 16px;border-radius:6px;transition:background 0.15s">
        <img src="./icon/md_icon.png" style="width:36px;height:36px;object-fit:contain" alt="md">
        <span style="font-size:11px;color:var(--text-2)">idea.md</span>
      </div>`;
    const icon = document.getElementById('idea-file-icon');
    icon.addEventListener('mouseenter', () => { icon.style.background = 'var(--hover-bg, rgba(255,255,255,0.06))'; });
    icon.addEventListener('mouseleave', () => { icon.style.background = ''; });
    icon.addEventListener('dblclick', () => {
      fetch('/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: 'idea.md' }),
      });
    });
  }

  async function checkAndRestoreIdeasCard() {
    try {
      const res = await fetch('/api/ideas/load');
      const data = await res.json();
      if (data.ideas && data.ideas.length > 0) {
        showIdeasCard(data.ideas);
      } else if (data.ideaMdExists) {
        showIdeasFileFallback();
      }
    } catch (_) {}
  }

  async function checkAndRestoreSessionHistory() {
    const chatListEl = document.getElementById('pipeline-chat-list');
    if (chatListEl) chatListEl.innerHTML = '';
    try {
      const resp = await fetch('/api/session-history');
      if (!resp.ok) return;
      const { events } = await resp.json();
      if (!events || events.length === 0) return;
      pushAgentEventToChat('history', { type: 'start' });
      for (const event of events) {
        pushAgentEventToChat('history', event);
      }
      pushAgentEventToChat('history', { type: 'done' });
    } catch (e) {
      console.warn('[session-history] failed to load:', e);
    }
  }

  function openWorkspaceShell(workspaceName = 'New Research Workspace') {
    if (workspaceHub) workspaceHub.classList.add('hidden');
    if (workbenchShell) workbenchShell.classList.remove('hidden');
    if (breadcrumbProject) breadcrumbProject.textContent = `Project: ${workspaceName}`;
  }

  function showWorkspaceHub() {
    if (workspaceHub) workspaceHub.classList.remove('hidden');
    if (workbenchShell) workbenchShell.classList.add('hidden');
  }

  async function loadWorkspaceList() {
    const grid = document.getElementById('workspace-hub-grid');
    if (!grid) return;
    let workspaces = [];
    try {
      const res = await fetch('/api/workspace/list');
      const data = await res.json();
      workspaces = data.workspaces || [];
    } catch (_) {}

    const cards = workspaces.map(ws => {
      const badge = ws.isActive
        ? '<span class="workspace-entry__badge">Active</span>'
        : '<span class="workspace-entry__badge muted">Saved</span>';
      const dt = new Date(ws.updatedAt);
      const timeStr = dt.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      return `
        <article class="workspace-entry${ws.isActive ? ' featured' : ''}" data-open-workspace="${escapeHtml(ws.name)}">
          <div class="workspace-entry__header">
            ${badge}
            <span class="workspace-entry__time">${timeStr}</span>
          </div>
          <h3 class="workspace-entry__title">${escapeHtml(ws.name)}</h3>
          <p class="workspace-entry__desc">科研工作区</p>
        </article>`;
    }).join('');

    grid.innerHTML = cards + `
      <article class="workspace-entry workspace-entry--new" id="workspace-entry-new">
        <div class="workspace-entry__new-icon">＋</div>
        <h3 class="workspace-entry__title">创建新的 Workspace</h3>
        <p class="workspace-entry__desc">导入论文材料、数据、引用库与模板，启动一个新的科研主题工作区。</p>
      </article>`;

    grid.querySelectorAll('[data-open-workspace]').forEach(entry => {
      entry.addEventListener('click', async () => {
        const name = entry.dataset.openWorkspace;
        await fetch('/api/workspace/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        openWorkspaceShell(name);
        await refreshPaperList();
        await checkAndRestoreLiteratureCard();
        await checkAndRestoreIdeasCard();
        await checkAndRestorePlanCard();
        await checkAndRestoreSessionHistory();
      });
    });

    const newEntry = document.getElementById('workspace-entry-new');
    if (newEntry) newEntry.addEventListener('click', () => showCreateWorkspaceDialog());
  }

  loadWorkspaceList();

  function showCreateWorkspaceDialog() {
    if (wsCreateOverlay) {
      wsCreateOverlay.classList.remove('hidden');
      wsCreateOverlay.setAttribute('aria-hidden', 'false');
      if (wsCreateInput) { wsCreateInput.value = ''; wsCreateInput.focus(); }
    }
  }

  function hideCreateWorkspaceDialog() {
    if (wsCreateOverlay) {
      wsCreateOverlay.classList.add('hidden');
      wsCreateOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  async function createWorkspace(name) {
    try {
      const res = await fetch('/api/workspace/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success) {
        hideCreateWorkspaceDialog();
        await loadWorkspaceList();
        openWorkspaceShell(data.name);
        await refreshPaperList();
        await checkAndRestoreSessionHistory();
      } else {
        alert(data.error || '创建失败');
      }
    } catch (e) {
      alert('创建 Workspace 失败: ' + e.message);
    }
  }

  if (workspaceCreateBtn) {
    workspaceCreateBtn.addEventListener('click', () => showCreateWorkspaceDialog());
  }

  if (editClaudeMdBtn) {
    editClaudeMdBtn.addEventListener('click', () => {
      fetch('/api/open-claude-md', { method: 'POST' }).catch(() => {});
    });
  }

  if (wsCreateConfirmBtn) {
    wsCreateConfirmBtn.addEventListener('click', () => {
      const name = wsCreateInput ? wsCreateInput.value.trim() : '';
      if (!name) { alert('请输入 Workspace 名称'); return; }
      createWorkspace(name);
    });
  }

  if (wsCreateCloseBtn) {
    wsCreateCloseBtn.addEventListener('click', hideCreateWorkspaceDialog);
  }

  if (wsCreateOverlay) {
    wsCreateOverlay.addEventListener('click', (e) => {
      if (e.target === wsCreateOverlay) hideCreateWorkspaceDialog();
    });
  }

  if (wsCreateInput) {
    wsCreateInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const name = wsCreateInput.value.trim();
        if (name) createWorkspace(name);
      }
      if (e.key === 'Escape') hideCreateWorkspaceDialog();
    });
  }

  if (titlebarName) {
    titlebarName.addEventListener('click', () => showWorkspaceHub());
    titlebarName.style.cursor = 'pointer';
    titlebarName.title = '返回 Workspace 列表';
  }

  assetMapNodes.forEach(node => {
    node.addEventListener('click', () => {
      const targetId = node.getAttribute('data-asset-target');
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (!target) return;

      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('asset-target-highlight');
      window.setTimeout(() => target.classList.remove('asset-target-highlight'), 1800);
    });
  });

  let localPaperPdfFiles = [];

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderPaperFileTree(tree) {
    if (!paperFileList) return;

    if (!tree || tree.length === 0) {
      paperFileList.innerHTML = `<li class="paper-file-empty">暂无 PDF/.m/.py 文件，请点击"增加文献"上传或检查 papers 目录。</li>`;
      return;
    }

    const counter = { n: 0 };

    function buildLiHtml(nodes) {
      let html = '';
      for (const node of nodes) {
        if (node.type === 'dir') {
          html += `<li class="paper-tree-dir">
            <span class="paper-tree-dir__row">
              <span class="paper-tree-dir__icon">&#128193;</span>
              <span class="paper-tree-dir__name">${escapeHtml(node.name)}/</span>
            </span>`;
          if (node.children && node.children.length) {
            html += `<ul class="paper-tree-children">${buildLiHtml(node.children)}</ul>`;
          }
          html += `</li>`;
        } else {
          const idx = counter.n++;
          const ext = (node.name.split('.').pop() || '').toLowerCase();
          const icon = ext === 'pdf' ? '&#128196;' : ext === 'py' ? '&#128013;' : '&#128196;';
          html += `<li class="paper-file-item"
            data-paper-index="${idx}"
            data-paper-name="${escapeHtml(node.relPath)}"
            data-paper-abspath="${escapeHtml(node.absPath)}"
            data-paper-ext="${escapeHtml(ext)}"
            title="双击打开文件">
            <input id="paper-file-${idx}" type="checkbox" />
            <span class="paper-file-item__icon">${icon}</span>
            <label class="paper-file-item__name" for="paper-file-${idx}">${escapeHtml(node.name)}</label>
          </li>`;
        }
      }
      return html;
    }

    paperFileList.innerHTML = buildLiHtml(tree);
  }

  async function refreshPaperList() {
    let tree = [];
    try {
      const res = await fetch('/api/papers');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      tree = data.tree || [];
    } catch (_) {
      tree = [];
    }
    localPaperPdfFiles = tree;
    renderPaperFileTree(tree);
  }

  async function uploadPdfFiles(fileList) {
    const pdfs = Array.from(fileList || []).filter(f => /\.(pdf|txt|md|m|py)$/i.test(f.name));
    if (pdfs.length === 0) return;
    const form = new FormData();
    pdfs.forEach(f => form.append('files', f));
    try {
      await fetch('/api/papers/upload', { method: 'POST', body: form });
    } catch (_) {
      // upload failed silently; list refresh will reflect actual state
    }
    await refreshPaperList();
  }

  refreshPaperList();
  checkAndRestoreIdeasCard();

  if (paperFileList) {
    paperFileList.addEventListener('dblclick', async (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input[type="checkbox"]')) {
        return;
      }
      const item = e.target instanceof HTMLElement ? e.target.closest('.paper-file-item') : null;
      if (!item) return;
      const absPath = item.dataset.paperAbspath;
      if (!absPath) return;
      await fetch('/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: absPath }),
      });
    });
  }

  function setPaperDialogVisible(visible) {
    if (!paperDialogOverlay) return;
    paperDialogOverlay.classList.toggle('hidden', !visible);
    paperDialogOverlay.setAttribute('aria-hidden', String(!visible));
    if (visible && paperDialogQuery) paperDialogQuery.focus();
  }

  if (paperAddBtn) {
    paperAddBtn.addEventListener('click', () => {
      setPaperDialogVisible(true);
    });
  }

  if (paperDialogCloseBtn) {
    paperDialogCloseBtn.addEventListener('click', () => setPaperDialogVisible(false));
  }

  if (paperDialogOverlay) {
    paperDialogOverlay.addEventListener('click', (e) => {
      if (e.target === paperDialogOverlay) {
        setPaperDialogVisible(false);
      }
    });
  }

  function setSectionDialogVisible(visible) {
    if (!sectionDialogOverlay) return;
    sectionDialogOverlay.classList.toggle('hidden', !visible);
    sectionDialogOverlay.setAttribute('aria-hidden', String(!visible));
    if (visible && sectionTitleInput) sectionTitleInput.focus();
  }

  if (addChapterBtn) {
    addChapterBtn.addEventListener('click', () => setSectionDialogVisible(true));
  }

  if (sectionDialogCloseBtn) {
    sectionDialogCloseBtn.addEventListener('click', () => setSectionDialogVisible(false));
  }

  if (sectionDialogOverlay) {
    sectionDialogOverlay.addEventListener('click', (e) => {
      if (e.target === sectionDialogOverlay) setSectionDialogVisible(false);
    });
  }

  if (sectionGenerateBtn) {
    sectionGenerateBtn.addEventListener('click', async () => {
      const sectionTitle = sectionTitleInput ? sectionTitleInput.value.trim() : '';
      const instruction = sectionInstructionsInput ? sectionInstructionsInput.value.trim() : '';
      if (!sectionTitle) { alert('请填写 Section Title'); return; }

      setSectionDialogVisible(false);

      // Show/update the writing card status
      const writingCard = document.getElementById('asset-target-writing');
      let statusEl = document.getElementById('writing-section-status');
      if (writingCard && !statusEl) {
        const body = writingCard.querySelector('.workspace-card__body');
        if (body) {
          body.innerHTML = `<p id="writing-section-status" style="font-size:12px;color:var(--accent);margin:0;">● 正在生成：${escapeHtml(sectionTitle)}…</p>`;
          statusEl = document.getElementById('writing-section-status');
        }
      } else if (statusEl) {
        statusEl.textContent = `● 正在生成：${sectionTitle}…`;
        statusEl.style.color = 'var(--accent)';
      }

      const controller = new AbortController();
      setStreaming(controller);
      try {
        const res = await fetch('/api/write_section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionTitle, instruction, skills: getSelectedSkills(), model: getSelectedModel() }),
          signal: controller.signal,
        });
        if (!res.body) throw new Error('No response body');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop();
          for (const part of parts) {
            const line = part.replace(/^data:\s*/, '').trim();
            if (!line) continue;
            try {
              JSON.parse(line);
            } catch { /* ignore non-JSON lines */ }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          if (statusEl) { statusEl.textContent = '● 已停止'; statusEl.style.color = 'var(--text-2)'; }
        } else if (statusEl) {
          statusEl.textContent = `✗ 生成失败：${err.message}`;
          statusEl.style.color = '#f06292';
        }
      } finally {
        clearStreaming();
        await refreshLatexFileTree();
      }
    });
  }

  function setWritePaperDialogVisible(visible) {
    if (!writePaperDialogOverlay) return;
    writePaperDialogOverlay.classList.toggle('hidden', !visible);
    writePaperDialogOverlay.setAttribute('aria-hidden', String(!visible));
    if (visible && paperTitleInput) paperTitleInput.focus();
  }

  function setIdeasDialogVisible(visible) {
    if (!ideasDialogOverlay) return;
    ideasDialogOverlay.classList.toggle('hidden', !visible);
    ideasDialogOverlay.setAttribute('aria-hidden', String(!visible));
    if (visible && ideasHintInput) ideasHintInput.focus();
  }

  if (ideasDialogCloseBtn) ideasDialogCloseBtn.addEventListener('click', () => setIdeasDialogVisible(false));
  if (ideasDialogOverlay) {
    ideasDialogOverlay.addEventListener('click', (e) => {
      if (e.target === ideasDialogOverlay) setIdeasDialogVisible(false);
    });
  }

  if (generatePdfBtn) {
    generatePdfBtn.addEventListener('click', () => setWritePaperDialogVisible(true));
  }

  if (writePaperDialogCloseBtn) {
    writePaperDialogCloseBtn.addEventListener('click', () => setWritePaperDialogVisible(false));
  }

  if (writePaperDialogOverlay) {
    writePaperDialogOverlay.addEventListener('click', (e) => {
      if (e.target === writePaperDialogOverlay) setWritePaperDialogVisible(false);
    });
  }

  function setImproveDialogVisible(visible) {
    if (!improveDialogOverlay) return;
    improveDialogOverlay.classList.toggle('hidden', !visible);
    improveDialogOverlay.setAttribute('aria-hidden', String(!visible));
    if (visible && improveInput) improveInput.focus();
  }

  if (improveBtn) {
    improveBtn.addEventListener('click', () => setImproveDialogVisible(true));
  }

  if (improveDialogCloseBtn) {
    improveDialogCloseBtn.addEventListener('click', () => setImproveDialogVisible(false));
  }

  if (improveDialogOverlay) {
    improveDialogOverlay.addEventListener('click', (e) => {
      if (e.target === improveDialogOverlay) setImproveDialogVisible(false);
    });
  }

  if (improveSubmitBtn) {
    improveSubmitBtn.addEventListener('click', async () => {
      const userResponse = improveInput ? improveInput.value.trim() : '';
      if (!userResponse) { alert('请输入改进建议'); return; }

      setImproveDialogVisible(false);

      const approvalCard = document.getElementById('asset-target-approval');
      if (approvalCard) {
        const body = approvalCard.querySelector('.workspace-card__body');
        if (body) {
          body.innerHTML = `<p style="font-size:12px;color:var(--accent);margin:0;">● 正在提交改进建议…</p>`;
        }
      }

      const controller = new AbortController();
      setStreaming(controller);
      try {
        const res = await fetch('/api/improve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userResponse, skills: getSelectedSkills(), model: getSelectedModel() }),
          signal: controller.signal,
        });
        if (!res.body) throw new Error('No response body');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop();
          for (const part of parts) {
            if (!part.startsWith('data:')) continue;
            try {
              const evt = JSON.parse(part.slice(5).trim());
              if (evt.type === 'done') {
                if (approvalCard) {
                  const body = approvalCard.querySelector('.workspace-card__body');
                  if (body) body.innerHTML = `<p style="font-size:12px;color:#4ade80;margin:0;">✓ 改进建议已提交</p>`;
                }
              }
            } catch (_) {}
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          if (approvalCard) {
            const body = approvalCard.querySelector('.workspace-card__body');
            if (body) body.innerHTML = `<p style="font-size:12px;color:#f87171;margin:0;">提交失败：${escapeHtml(err.message)}</p>`;
          }
        }
      } finally {
        clearStreaming();
        if (improveInput) improveInput.value = '';
      }
    });
  }

  if (writePaperGenerateBtn) {
    writePaperGenerateBtn.addEventListener('click', async () => {
      const paperTitle = paperTitleInput ? paperTitleInput.value.trim() : '';
      const paperFormat = paperFormatInput ? paperFormatInput.value.trim() : '';
      if (!paperTitle) { alert('请填写 Paper Title'); return; }

      setWritePaperDialogVisible(false);

      const writingCard = document.getElementById('asset-target-writing');
      if (writingCard) {
        const body = writingCard.querySelector('.workspace-card__body');
        if (body) {
          body.innerHTML = `<p id="write-paper-status" style="font-size:12px;color:var(--accent);margin:0;">● 正在生成全文 PDF…</p>`;
        }
      }

      const controller = new AbortController();
      setStreaming(controller);
      try {
        const res = await fetch('/api/write-paper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperTitle, paperFormat, skills: getSelectedSkills(), model: getSelectedModel() }),
          signal: controller.signal,
        });
        if (!res.body) throw new Error('No response body');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop();
          for (const part of parts) {
            const line = part.replace(/^data:\s*/, '').trim();
            if (!line) continue;
            try {
              JSON.parse(line);
            } catch { /* ignore non-JSON lines */ }
          }
        }
      } catch (err) {
        const statusEl = document.getElementById('write-paper-status');
        if (err.name === 'AbortError') {
          if (statusEl) { statusEl.textContent = '● 已停止'; statusEl.style.color = 'var(--text-2)'; }
        } else if (statusEl) {
          statusEl.textContent = `✗ 生成失败：${err.message}`;
          statusEl.style.color = '#f06292';
        }
      } finally {
        clearStreaming();
        await refreshLatexFileTree();
      }
    });
  }

  if (paperUploadTrigger && paperUploadInput) {
    paperUploadTrigger.addEventListener('click', () => paperUploadInput.click());
    paperUploadInput.addEventListener('change', async () => {
      await uploadPdfFiles(paperUploadInput.files);
      paperUploadInput.value = '';
    });
  }

  const paperDropzone = document.querySelector('.paper-dialog__dropzone');
  if (paperDropzone) {
    paperDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    paperDropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      await uploadPdfFiles(e.dataTransfer?.files);
    });
  }

  if (paperDialogEnterBtn && paperDialogQuery) {
    paperDialogEnterBtn.addEventListener('click', () => {
      const query = paperDialogQuery.value.trim();
      if (!query) return;
      window.alert(`已提交搜索：${query}`);
    });
  }

  if (paperLearnBtn) {
    paperLearnBtn.addEventListener('click', async () => {
      // Collect checked papers
      const selectedPapers = Array.from(
        document.querySelectorAll('#paper-file-list .paper-file-item input[type="checkbox"]:checked')
      ).map(cb => cb.closest('.paper-file-item').dataset.paperName).filter(Boolean);

      // Create the output card if it doesn't exist, otherwise reset it
      let literatureCard = document.getElementById('literature_view_md');
      if (!literatureCard) {
        const anchor = document.getElementById('asset-target-brief');
        if (!anchor) return;
        literatureCard = document.createElement('section');
        literatureCard.className = 'workspace-card';
        literatureCard.id = 'literature_view_md';
        anchor.insertAdjacentElement('afterend', literatureCard);
      }

      literatureCard.innerHTML = `
        <div class="workspace-card__header">
          <span class="workspace-card__icon" style="color:#7fd8ff">&#128196;</span>
          <span>Literature View</span>
          <span id="literature-status" style="margin-left:auto;font-size:11px;color:var(--accent)">● 努力生成中，给我3-5分钟... <img src="./icon/loading.gif" style="width:50px;height:20px;vertical-align:middle" alt=""></span>
        </div>
        <div class="workspace-card__body" style="min-height:80px;display:flex;align-items:center;justify-content:center">
        </div>
      `;
      literatureCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const statusEl = document.getElementById('literature-status');


      const controller = new AbortController();
      setStreaming(controller);
      try {
        const res = await fetch('/api/learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ papers: selectedPapers, skills: getSelectedSkills(), model: getSelectedModel() }),
          signal: controller.signal,
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep any incomplete trailing line
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = JSON.parse(line.slice(6));
            if (data.type === 'done') {
              if (statusEl) { statusEl.textContent = '✓ Done'; statusEl.style.color = 'var(--text-2)'; }
              showLiteratureCard();
            } else if (data.type === 'error') {
              if (statusEl) { statusEl.textContent = '✗ Error'; statusEl.style.color = '#f87171'; }
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          if (statusEl) { statusEl.textContent = '● 已停止'; statusEl.style.color = 'var(--text-2)'; }
        } else {
          if (statusEl) { statusEl.textContent = '✗ Error'; statusEl.style.color = '#f87171'; }
        }
      } finally {
        clearStreaming();
      }
    });
  }

  // --- 采纳 buttons: trigger /api/adopt and populate 研究方案 card ---
  // Use event delegation so dynamically-rendered cards are covered too
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.workspace-topic-card__adopt-btn');
    if (!btn) return;
    {
      const card = btn.closest('.workspace-topic-card');
      const title = card?.querySelector('.workspace-topic-card__title')?.textContent?.trim() ?? '';
      const subtitle = card?.querySelector('.workspace-topic-card__subtitle')?.textContent?.trim() ?? '';
      const summary = card?.querySelector('.workspace-topic-card__summary')?.textContent?.trim() ?? '';
      const userMessage = [title, subtitle, summary].filter(Boolean).join('\n');

      const planCard = document.getElementById('asset-target-plan');
      if (!planCard) return;

      planCard.innerHTML = `
        <div class="workspace-card__header">
          <span class="workspace-card__icon" style="color:#f0b429">&#9881;</span>
          <span>研究方案</span>
          <span id="plan-status" style="margin-left:auto;font-size:11px;color:var(--accent)">● 努力生成中，给我3-5分钟... <img src="./icon/loading.gif" style="width:50px;height:20px;vertical-alignn:middle" alt=""></span>
        </div>
        <div class="workspace-card__body" style="min-height:80px;display:flex;align-items:center;justify-content:center">
        </div>
      `;
      planCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const planStatusEl = document.getElementById('plan-status');


      const controller = new AbortController();
      setStreaming(controller);
      try {
        const res = await fetch('/api/adopt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage, skills: getSelectedSkills(), model: getSelectedModel() }),
          signal: controller.signal,
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = JSON.parse(line.slice(6));
            if (data.type === 'done') {
              if (planStatusEl) { planStatusEl.textContent = '✓ Done'; planStatusEl.style.color = 'var(--text-2)'; }
              await checkAndRestorePlanCard();
            } else if (data.type === 'error') {
              if (planStatusEl) { planStatusEl.textContent = '✗ Error'; planStatusEl.style.color = '#f87171'; }
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          if (planStatusEl) { planStatusEl.textContent = '● 已停止'; planStatusEl.style.color = 'var(--text-2)'; }
        } else {
          if (planStatusEl) { planStatusEl.textContent = '✗ Error'; planStatusEl.style.color = '#f87171'; }
        }
      } finally {
        clearStreaming();
      }
    }
  });

  // --- 生成创新点 button: open hint dialog first ---
  const ideasGenerateBtn = document.getElementById('ideas-generate-btn');
  if (ideasGenerateBtn) {
    ideasGenerateBtn.addEventListener('click', () => setIdeasDialogVisible(true));
  }

  async function runIdeasGeneration(userHint) {
    const topicsCard = document.getElementById('asset-target-topics');
    if (!topicsCard) return;

    const header = topicsCard.querySelector('.workspace-card__header');
    const existingBody = topicsCard.querySelector('.workspace-card__body');
    if (existingBody) {
      existingBody.innerHTML = '';
      existingBody.style.cssText = 'min-height:80px;display:flex;align-items:center;justify-content:center';
    }
    let statusEl = topicsCard.querySelector('#ideas-status');
    if (!statusEl) {
      statusEl = document.createElement('span');
      statusEl.id = 'ideas-status';
      statusEl.style.cssText = 'margin-left:auto;font-size:11px;color:var(--accent)';
      const actions = header?.querySelector('.workspace-card__header-actions');
      if (actions) actions.insertAdjacentElement('afterend', statusEl);
      else header?.appendChild(statusEl);
    }
    statusEl.innerHTML = '● 努力生成中，给我3-5分钟... <img src="./icon/loading.gif" style="width:50px;height:20px;vertical-alignn:middle" alt="">';
    statusEl.style.color = 'var(--accent)';

    topicsCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const controller = new AbortController();
    setStreaming(controller);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userHint, skills: getSelectedSkills(), model: getSelectedModel() }),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === 'ideas') {
            showIdeasCard(data.ideas);
          } else if (data.type === 'done') {
            statusEl.textContent = '✓ Done';
            statusEl.style.color = 'var(--text-2)';
            await checkAndRestoreIdeasCard();
          } else if (data.type === 'error') {
            statusEl.textContent = '✗ Error';
            statusEl.style.color = '#f87171';
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        statusEl.textContent = '● 已停止';
        statusEl.style.color = 'var(--text-2)';
      } else {
        statusEl.textContent = '✗ Error';
        statusEl.style.color = '#f87171';
      }
    } finally {
      clearStreaming();
    }
  }

  if (ideasDialogGenerateBtn) {
    ideasDialogGenerateBtn.addEventListener('click', () => {
      const hint = ideasHintInput ? ideasHintInput.value.trim() : '';
      setIdeasDialogVisible(false);
      runIdeasGeneration(hint);
    });
  }
  if (ideasHintInput) {
    ideasHintInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ideasDialogGenerateBtn?.click();
    });
  }

  // --- 显示创新点 button: parse existing idea.md without running agent ---
  const ideasLoadBtn = document.getElementById('ideas-load-btn');
  if (ideasLoadBtn) {
    ideasLoadBtn.addEventListener('click', async () => {
      const topicsCard = document.getElementById('asset-target-topics');
      if (!topicsCard) return;
      try {
        const res = await fetch('/api/ideas/load');
        const data = await res.json();
        if (data.ideas && data.ideas.length > 0) {
          showIdeasCard(data.ideas);
        } else {
          const body = topicsCard.querySelector('.workspace-card__body');
          if (body) body.innerHTML = '<p class="workspace-card__placeholder">暂无创新点，请先运行生成创新点。</p>';
        }
      } catch (err) {
        console.error('Failed to load ideas:', err);
      }
    });
  }

  // --- 代码实现 card: file tree helpers ---
  function buildTreeHtml(nodes) {
    if (!nodes || nodes.length === 0) return '';
    let html = '<ul>';
    for (const node of nodes) {
      if (node.type === 'dir') {
        html += `<li><span class="ft-icon ft-dir">&#128193;</span><span class="ft-dir">${escapeHtml(node.name)}/</span></li>`;
        if (node.children && node.children.length) {
          html += `<li style="padding:0">${buildTreeHtml(node.children)}</li>`;
        }
      } else {
        html += `<li class="ft-file-row" data-filepath="${escapeHtml(node.absPath)}" title="双击打开文件"><span class="ft-icon ft-file">&#128196;</span><span class="ft-file">${escapeHtml(node.name)}</span></li>`;
      }
    }
    html += '</ul>';
    return html;
  }

  function attachFileTreeDblClick(container) {
    container.querySelectorAll('.ft-file-row').forEach(el => {
      el.addEventListener('dblclick', async () => {
        const filepath = el.dataset.filepath;
        if (!filepath) return;
        await fetch('/api/open-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: filepath }),
        });
      });
    });
  }

  async function refreshCodeFileTree() {
    const codeCard = document.getElementById('asset-target-code');
    if (!codeCard) return;
    const body = codeCard.querySelector('.workspace-card__body');
    if (!body) return;

    try {
      const res = await fetch('/api/code-files');
      const { tree, exists } = await res.json();
      if (!exists || tree.length === 0) {
        body.innerHTML = '<p class="workspace-card__placeholder">代码实现节点尚未启动。运行后，生成的代码文件、模块结构与版本记录将同步到这里。</p>';
        return;
      }
      body.innerHTML = `<div class="code-file-tree">${buildTreeHtml(tree)}</div>`;
      attachFileTreeDblClick(body);
    } catch { /* non-fatal */ }
  }

  async function refreshLatexFileTree() {
    const writingCard = document.getElementById('asset-target-writing');
    if (!writingCard) return;
    const body = writingCard.querySelector('.workspace-card__body');
    if (!body) return;

    try {
      const res = await fetch('/api/latex-files');
      const { tree, exists } = await res.json();
      if (!exists || tree.length === 0) {
        body.innerHTML = '<p class="workspace-card__placeholder">写作节点尚未启动。草稿章节、LaTeX 片段与修改历史将在节点产出后显示于此。</p>';
        return;
      }
      body.innerHTML = `<div class="code-file-tree">${buildTreeHtml(tree)}</div>`;
      attachFileTreeDblClick(body);
    } catch { /* non-fatal */ }
  }

  async function refreshReviewFiles() {
    const reviewCard = document.getElementById('asset-target-review');
    if (!reviewCard) return;
    const body = reviewCard.querySelector('.workspace-card__body');
    if (!body) return;

    try {
      const res = await fetch('/api/review-files');
      const { files } = await res.json();
      if (!files || files.length === 0) {
        body.innerHTML = '<p class="workspace-card__placeholder">AI 审稿节点尚未运行。审稿意见、评分与修改建议将在完成后汇总于此。</p>';
        return;
      }
      body.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;padding:8px 0';
      body.innerHTML = files.map(f => `
        <div class="review-file-icon" data-abspath="${escapeHtml(f.absPath)}" title="双击打开 ${escapeHtml(f.name)}"
          style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;padding:12px 16px;border-radius:6px;transition:background 0.15s">
          <span style="font-size:36px;line-height:1">&#128196;</span>
          <span style="font-size:11px;color:var(--text-2)">${escapeHtml(f.name)}</span>
        </div>`).join('');
      body.querySelectorAll('.review-file-icon').forEach(icon => {
        icon.addEventListener('mouseenter', () => { icon.style.background = 'var(--hover-bg, rgba(255,255,255,0.06))'; });
        icon.addEventListener('mouseleave', () => { icon.style.background = ''; });
        icon.addEventListener('dblclick', () => {
          fetch('/api/open-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: icon.dataset.abspath }),
          });
        });
      });
    } catch { /* non-fatal */ }
  }

  // Populate tree on load
  refreshCodeFileTree();
  refreshLatexFileTree();
  refreshReviewFiles();

  // --- 开始进行编程 button: trigger /api/coding and stream output into 代码实现 card ---
  const startCodingBtn = document.getElementById('start-coding-btn');
  if (startCodingBtn) {
    startCodingBtn.addEventListener('click', async () => {
      const codeCard = document.getElementById('asset-target-code');
      if (!codeCard) return;

      const header = codeCard.querySelector('.workspace-card__header');
      const existingBody = codeCard.querySelector('.workspace-card__body');
      if (existingBody) {
        existingBody.innerHTML = '';
        existingBody.style.cssText = '';
      }

      let statusEl = codeCard.querySelector('#coding-status');
      if (!statusEl) {
        statusEl = document.createElement('span');
        statusEl.id = 'coding-status';
        statusEl.style.cssText = 'margin-left:auto;font-size:11px;color:var(--accent)';
        const actions = header?.querySelector('.workspace-card__header-actions');
        if (actions) actions.insertAdjacentElement('afterend', statusEl);
        else header?.appendChild(statusEl);
      }
      statusEl.innerHTML = '● 努力生成中，给我10-20分钟... <img src="./icon/loading.gif" style="width:50px;height:20px;vertical-alignn:middle" alt="">';
      statusEl.style.color = 'var(--accent)';

      const logEl = document.createElement('div');
      logEl.style.cssText = 'font-size:12px;white-space:pre-wrap;word-break:break-word;padding:8px 0;color:var(--text-1)';
      existingBody?.appendChild(logEl);

      codeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const controller = new AbortController();
      setStreaming(controller);
      try {
        const res = await fetch('/api/coding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skills: getSelectedSkills(), model: getSelectedModel() }),
          signal: controller.signal,
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text' || data.type === 'result') {
              logEl.textContent += data.text + '\n';
            } else if (data.type === 'done') {
              statusEl.textContent = '✓ Done';
              statusEl.style.color = 'var(--text-2)';
              // Replace log with file tree after agent finishes
              existingBody.innerHTML = '';
              await refreshCodeFileTree();
            } else if (data.type === 'error') {
              statusEl.textContent = '✗ Error';
              statusEl.style.color = '#f87171';
              logEl.textContent += '\nError: ' + data.message;
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          statusEl.textContent = '● 已停止';
          statusEl.style.color = 'var(--text-2)';
        } else {
          statusEl.textContent = '✗ Error';
          statusEl.style.color = '#f87171';
          logEl.textContent += '\nError: ' + err.message;
        }
      } finally {
        clearStreaming();
      }
    });
  }

  // --- 开始审稿 button: trigger /api/review and stream output into AI审稿 card ---
  const aiReviewBtn = document.getElementById('ai-review-btn');
  if (aiReviewBtn) {
    aiReviewBtn.addEventListener('click', async () => {
      const reviewCard = document.getElementById('asset-target-review');
      if (!reviewCard) return;

      // Check paper.pdf exists before running the review agent
      try {
        const checkRes = await fetch('/api/check-paper-pdf');
        const { exists } = await checkRes.json();
        if (!exists) {
          const body = reviewCard.querySelector('.workspace-card__body');
          if (body) body.innerHTML = `<p style="font-size:12px;color:#f87171;margin:0;">未找到 latex/paper.pdf，请先点击 <strong>生成全文</strong> 生成 PDF 文件。</p>`;
          reviewCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      } catch { /* network error — let the review proceed anyway */ }

      const body = reviewCard.querySelector('.workspace-card__body');
      if (body) {
        body.innerHTML = `<p id="review-status" style="font-size:12px;color:var(--accent);margin:0 0 8px 0;">● 努力生成中，给我3-5分钟… <img src="./icon/loading.gif" style="width:50px;height:20px;vertical-alignn:middle" alt=""></p><div id="review-log" style="font-size:12px;white-space:pre-wrap;word-break:break-word;color:var(--text-1)"></div>`;
      }
      reviewCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const statusEl = document.getElementById('review-status');
      const logEl = document.getElementById('review-log');

      const controller = new AbortController();
      setStreaming(controller);
      try {
        const res = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skills: getSelectedSkills(), model: getSelectedModel() }), signal: controller.signal });
        if (!res.body) throw new Error('No response body');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop();
          for (const part of parts) {
            const line = part.replace(/^data:\s*/, '').trim();
            if (!line) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.type === 'text' || msg.type === 'result') {
                if (logEl) logEl.textContent += msg.text + '\n';
              } else if (msg.type === 'done') {
                if (statusEl) { statusEl.textContent = '✓ Done'; statusEl.style.color = 'var(--text-2)'; }
                await refreshReviewFiles();
              } else if (msg.type === 'error') {
                if (statusEl) { statusEl.textContent = '✗ Error'; statusEl.style.color = '#f87171'; }
                if (logEl) logEl.textContent += '\nError: ' + msg.message;
              }
            } catch { /* ignore non-JSON lines */ }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          if (statusEl) { statusEl.textContent = '● 已停止'; statusEl.style.color = 'var(--text-2)'; }
        } else {
          if (statusEl) { statusEl.textContent = '✗ Error'; statusEl.style.color = '#f87171'; }
          if (logEl) logEl.textContent += '\nError: ' + err.message;
        }
      } finally {
        clearStreaming();
      }
    });
  }

  // --- Activity Bar: switch sidebar panels ---
  const activityBtns = document.querySelectorAll('.activity-btn');
  const sidebarPanels = document.querySelectorAll('.sidebar-panel');
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');

  function setSidebarCollapsed(collapsed) {
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed', collapsed);

    if (sidebarToggle) {
      const svg = sidebarToggle.querySelector('svg polyline');
      if (svg) {
        if (collapsed) {
          svg.setAttribute('points', '9 18 15 12 9 6');
        } else {
          svg.setAttribute('points', '15 18 9 12 15 6');
        }
      }
    }
  }

  activityBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const isAlreadyActive = btn.classList.contains('active');

      if (sidebar && sidebar.classList.contains('collapsed')) {
        setSidebarCollapsed(false);
      } else if (isAlreadyActive && btn.dataset.panel) {
        setSidebarCollapsed(true);
        return;
      }

      activityBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const panelId = 'panel-' + btn.dataset.panel;
      sidebarPanels.forEach(p => p.classList.remove('active'));
      const target = document.getElementById(panelId);
      if (target) target.classList.add('active');
    });
  });

  // --- Titlebar Tabs: switch main views ---
  const tabs = document.querySelectorAll('.tab');
  const views = document.querySelectorAll('.view');
  const bottomPanel = document.getElementById('bottom-panel');
  const investigatePaletteNode = document.querySelector('.palette-node[data-node-type="investigate"]');

  function activateMainView(viewName) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.view === viewName));
    const viewId = 'view-' + viewName;
    views.forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');

    if (bottomPanel) {
      if (viewName === 'pipeline') {
        bottomPanel.style.display = 'flex';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (typeof drawEdges === 'function') drawEdges();
          });
        });
      } else {
        bottomPanel.style.display = 'none';
      }
    }
  }

  document.querySelectorAll('.palette-node[data-asset-target]').forEach(node => {
    node.addEventListener('click', () => {
      const targetId = node.getAttribute('data-asset-target');
      if (!targetId) return;
      activateMainView('workspace');
      const target = document.getElementById(targetId);
      if (!target) return;
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('asset-target-highlight');
        setTimeout(() => target.classList.remove('asset-target-highlight'), 1800);
      });
    });
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activateMainView(tab.dataset.view || 'workspace');
    });
  });

  if (investigatePaletteNode) {
    investigatePaletteNode.addEventListener('click', () => {
      activateMainView('workspace');
      const targetBriefCard = document.getElementById('asset-target-brief');
      if (!targetBriefCard) return;
      targetBriefCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetBriefCard.classList.add('asset-target-highlight');
      window.setTimeout(() => targetBriefCard.classList.remove('asset-target-highlight'), 1800);
    });
  }

  // Bottom panel hidden by default (CSS: display:none), no extra JS needed

  // --- Bottom panel tabs ---
  const bottomTabs = document.querySelectorAll('.bottom-tab');
  const bottomSections = document.querySelectorAll('.bottom-section');

  bottomTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      bottomTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const sectionId = 'bottom-' + tab.dataset.bottom;
      bottomSections.forEach(s => s.classList.remove('active'));
      const target = document.getElementById(sectionId);
      if (target) target.classList.add('active');
    });
  });

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      setSidebarCollapsed(!sidebar.classList.contains('collapsed'));
    });
  }

  // Double-click activity bar button to toggle sidebar collapse
  activityBtns.forEach(btn => {
    btn.addEventListener('dblclick', () => {
      if (sidebar) {
        setSidebarCollapsed(!sidebar.classList.contains('collapsed'));
      }
    });
  });

  // --- Node interaction panels: toggle open/close ---
  const interactToggles = document.querySelectorAll('.node-interact__toggle');
  interactToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = toggle.closest('.node-interact');
      // Close other open panels
      document.querySelectorAll('.node-interact.open').forEach(p => {
        if (p !== panel) p.classList.remove('open');
      });
      panel.classList.toggle('open');
    });
  });

  // Close interaction panels when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.node-interact')) {
      document.querySelectorAll('.node-interact.open').forEach(p => p.classList.remove('open'));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (paperDialogOverlay && !paperDialogOverlay.classList.contains('hidden')) {
        setPaperDialogVisible(false);
      }
      if (sectionDialogOverlay && !sectionDialogOverlay.classList.contains('hidden')) {
        setSectionDialogVisible(false);
      }
      if (writePaperDialogOverlay && !writePaperDialogOverlay.classList.contains('hidden')) {
        setWritePaperDialogVisible(false);
      }
    }
  });

  // Prevent drag when interacting with panel content
  const interactPanels = document.querySelectorAll('.node-interact__panel');
  interactPanels.forEach(panel => {
    panel.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  });
  const sectionHeaders = document.querySelectorAll('.tool-section__header');
  sectionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.dataset.toggle;
      const body = document.getElementById(targetId);
      if (!body) return;
      header.classList.toggle('collapsed');
      body.classList.toggle('collapsed');
    });
  });

  // --- Live agent event stream → chat panel ---
  const agentLabelInfo = {
    'learn':         { title: '文献调研',  agent: 'Literature Agent' },
    'ideas':         { title: '创新点生成', agent: 'Ideation Agent' },
    'adopt':         { title: '研究方案',  agent: 'Evaluation Planner' },
    'coding':        { title: '代码实现',  agent: 'Coding Agent' },
    'write_section': { title: '写作成文',  agent: 'Section Writer' },
    'write-paper':   { title: '生成全文',  agent: 'Paper Compiler' },
    'review':        { title: 'AI审稿',   agent: 'AI Reviewer' },
    'feedback':      { title: '反馈处理',  agent: 'Feedback Agent' },
    'history':       { title: '历史会话',  agent: 'Agent' },
  };

  // Live message elements for the current stream
  let liveMessageBodyEl = null;   // non-null sentinel = stream is active; points to last body
  let liveMessageParentEl = null; // wrapper for 'text'/'result' continuation events

  function appendMarkdownBodies(parent, text) {
    const chunks = (text || '').split(/\n{2,}|(?:^|\n)[─━═\-=_*]{5,}(?:\n|$)/)
      .map(s => s.trim()).filter(Boolean);
    for (const chunk of (chunks.length ? chunks : [text])) {
      const bodyEl = document.createElement('div');
      bodyEl.className = 'chat-message__body';
      try { bodyEl.innerHTML = marked.parse(chunk); }
      catch { bodyEl.style.cssText = 'white-space:pre-wrap;word-break:break-word'; bodyEl.textContent = chunk; }
      parent.appendChild(bodyEl);
      liveMessageBodyEl = bodyEl;
    }
  }

  function pushAgentEventToChat(label, msg) {
    const chatListEl   = document.getElementById('pipeline-chat-list');
    const chatTitleEl  = document.getElementById('pipeline-chat-title');
    const chatAgentEl  = document.getElementById('pipeline-chat-agent');
    const chatStatusEl = document.getElementById('pipeline-chat-status');
    if (!chatListEl) return;

    const info = agentLabelInfo[label] || { title: label, agent: 'Agent' };
    const now  = new Date();
    const ts   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    function newMsgEl(cssClass, metaLabel) {
      const el = document.createElement('div');
      el.className = cssClass;
      el.innerHTML = `<div class="chat-message__meta"><span>${ts}</span><span>${escapeHtml(metaLabel)}</span></div>`;
      chatListEl.appendChild(el);
      chatListEl.scrollTop = chatListEl.scrollHeight;
      return el;
    }

    if (msg.type === 'start') {
      if (chatTitleEl)  chatTitleEl.textContent  = info.title;
      if (chatAgentEl)  chatAgentEl.textContent  = info.agent;
      if (chatStatusEl) {
        chatStatusEl.textContent = '运行中';
        chatStatusEl.className   = 'pipeline-chat-status is-running';
      }
      const el = newMsgEl('chat-message system', info.title);
      liveMessageParentEl = el;
      liveMessageBodyEl   = el; // non-null sentinel

    } else if (msg.type === 'system') {
      const label_ = msg.subtype || 'System';
      const el = newMsgEl('chat-message system', label_);
      const bodyEl = document.createElement('div');
      bodyEl.className = 'chat-message__body';
      try { bodyEl.innerHTML = marked.parse(msg.text || ''); }
      catch { bodyEl.style.cssText = 'white-space:pre-wrap;word-break:break-word'; bodyEl.textContent = msg.text || ''; }
      el.appendChild(bodyEl);
      chatListEl.scrollTop = chatListEl.scrollHeight;

    } else if (msg.type === 'assistant') {
      const el = newMsgEl('chat-message event', info.agent);
      const bodyEl = document.createElement('div');
      bodyEl.className = 'chat-message__body';
      try { bodyEl.innerHTML = marked.parse(msg.text || ''); }
      catch { bodyEl.style.cssText = 'white-space:pre-wrap;word-break:break-word'; bodyEl.textContent = msg.text || ''; }
      el.appendChild(bodyEl);
      chatListEl.scrollTop = chatListEl.scrollHeight;

    } else if (msg.type === 'user') {
      const el = newMsgEl('chat-message user', 'Tool Result');
      const bodyEl = document.createElement('div');
      bodyEl.className = 'chat-message__body';
      const preview = (msg.text || '').slice(0, 400);
      bodyEl.style.cssText = 'white-space:pre-wrap;word-break:break-word;opacity:0.75';
      bodyEl.textContent = preview + ((msg.text || '').length > 400 ? '\n…' : '');
      el.appendChild(bodyEl);
      chatListEl.scrollTop = chatListEl.scrollHeight;

    } else if ((msg.type === 'text' || msg.type === 'result') && liveMessageBodyEl) {
      appendMarkdownBodies(liveMessageParentEl, msg.text);
      chatListEl.scrollTop = chatListEl.scrollHeight;

    } else if (msg.type === 'done') {
      liveMessageBodyEl   = null;
      liveMessageParentEl = null;
      // Only update to '已产出结果' if no fetch-stream is active.
      // The SSE 'done' from broadcastAgentEvent arrives before the
      // fetch stream has finished reading, so we must not overwrite
      // the '运行中' status that the fetch handler maintains.
      if (chatStatusEl && label !== 'feedback' && !streamingController) {
        chatStatusEl.textContent = '已产出结果';
        chatStatusEl.className   = 'pipeline-chat-status is-done';
      }

    } else if (msg.type === 'error') {
      liveMessageBodyEl   = null;
      liveMessageParentEl = null;
      if (chatStatusEl) {
        chatStatusEl.textContent = '出错';
        chatStatusEl.className   = 'pipeline-chat-status is-pending';
      }
      const el = document.createElement('div');
      el.className = 'chat-message event';
      el.innerHTML = `
        <div class="chat-message__meta"><span>${ts}</span><span>Error</span></div>
        <div class="chat-message__body" style="color:#f87171">${escapeHtml(msg.message || 'Unknown error')}</div>`;
      chatListEl.appendChild(el);
      chatListEl.scrollTop = chatListEl.scrollHeight;
    }
  }

  const agentEvtSource = new EventSource('/api/agent-events');
  agentEvtSource.onopen = () => {
    console.log('[agent-events] SSE connected');
  };
  agentEvtSource.onerror = (e) => {
    console.error('[agent-events] SSE error / reconnecting', e);
  };
  agentEvtSource.onmessage = (e) => {
    // Ignore heartbeat comment lines (EventSource filters these, but just in case)
    if (!e.data || e.data.trim() === '') return;
    let msg;
    try { msg = JSON.parse(e.data); } catch (err) {
      console.warn('[agent-events] bad JSON:', e.data, err);
      return;
    }
    console.log('[agent-events] message:', msg.label, msg.type);
    pushAgentEventToChat(msg.label, msg);
  };

  // --- Pipeline feedback panel ---
  const pipelineNodes = document.querySelectorAll('.pipeline-node');
  const chatTitle = document.getElementById('pipeline-chat-title');
  const chatAgent = document.getElementById('pipeline-chat-agent');
  const chatStatus = document.getElementById('pipeline-chat-status');
  const chatList = document.getElementById('pipeline-chat-list');
  const feedbackInput = document.getElementById('pipeline-feedback-input');
  const sendBtn = document.getElementById('pipeline-send-btn');
  const rerunBtn = document.getElementById('pipeline-rerun-btn');
  const pipelineLayout = document.getElementById('pipeline-layout');
  let savedPipelineCols = null; // remembers manual resize through collapse/expand
  const feedbackPanel = document.getElementById('pipeline-feedback');
  const feedbackToggle = document.getElementById('pipeline-feedback-toggle');
  const zoomInBtn = document.getElementById('pipeline-zoom-in');
  const zoomOutBtn = document.getElementById('pipeline-zoom-out');
  const zoomResetBtn = document.getElementById('pipeline-zoom-reset');
  const zoomValue = document.getElementById('pipeline-zoom-value');
  const executionOverview = document.getElementById('execution-overview');
  const executionMonitor = document.querySelector('#bottom-monitor .execution-monitor');
  const overviewNodeCards = document.querySelectorAll('[data-monitor-node]');

  const nodeConversationMap = {
    'node-1': {
      title: 'Literature Survey',
      agent: 'Literature Review Agent',
      status: 'done',
      messages: [
        {
          role: 'system',
          meta: 'System · 14:24',
          body: '已完成文献检索与验证：共发现 47 篇候选论文，筛选并验证 39 篇有效引用。已起草 Introduction 和 Related Work。',
          actions: ['补充 2025 后工作', '增加工业界论文', '查看引用清单']
        },
        {
          role: 'event',
          meta: 'Result · 14:25',
          body: '当前结果等待用户确认：是否需要继续追踪长上下文 benchmark、工业部署案例或最新稀疏注意力变种？'
        }
      ]
    },
    'node-2': {
      title: 'Hypothesis Assessment',
      agent: 'Baseline Scout + Q&A Engine',
      status: 'done',
      messages: [
        {
          role: 'system',
          meta: 'System · 14:31',
          body: '识别出 3 个缺失 baseline：ScissorHands、H2O、Dynamic Token Pruning；2 条核心声明需要补充外部验证。',
          actions: ['补齐 baseline', '只验证核心声明', '生成评估摘要']
        }
      ]
    },
    'node-3a': {
      title: 'Run Ablations',
      agent: 'Coding Agent',
      status: 'running',
      messages: [
        {
          role: 'system',
          meta: 'System · 14:36',
          body: '当前正在执行 ratio=0.9 的 ablation。已有中间结果：ratio=0.7 时 ppl=18.4，速度提升 1.8x。'
        },
        {
          role: 'event',
          meta: 'Suggestion · 14:37',
          body: '如需调整实验，可直接反馈新的 ratio 取值、数据集或评价指标，系统将中断并重跑当前节点。'
        }
      ]
    },
    'node-3b': {
      title: 'Generate Figures',
      agent: 'Plotting Agent',
      status: 'running',
      messages: [
        {
          role: 'system',
          meta: 'System · 14:38',
          body: '图表节点已生成 2/4 张图。Critic round 2 指出图 2 信息层级仍偏拥挤，正在优化排版。',
          actions: ['改成横向布局', '提高可读性', '强调主贡献']
        }
      ]
    },
    'node-4': {
      title: 'Draft Paper',
      agent: 'Section Writer + LaTeX',
      status: 'pending',
      messages: [
        {
          role: 'system',
          meta: 'System · waiting',
          body: '该节点尚未启动。你可以预先指定写作风格、强调章节或自定义模板偏好。'
        }
      ]
    },
    'node-gate': {
      title: 'Author Approval',
      agent: 'Human Gate',
      status: 'pending',
      messages: [
        {
          role: 'system',
          meta: 'System · waiting',
          body: '草稿完成后，这里会汇总关键结果并请求作者批准继续进入 refinement。'
        }
      ]
    },
    'node-5': {
      title: 'Refinement',
      agent: 'Content Refinement Agent',
      status: 'pending',
      messages: [
        {
          role: 'system',
          meta: 'System · waiting',
          body: '该节点等待审批。可预先设置审稿标准，例如 novelty / soundness / clarity 优先级。'
        }
      ]
    }
  };

  let activePipelineNodeId = null;

  function formatStatus(status) {
    if (status === 'done') return { text: '已产出结果', className: 'is-done' };
    if (status === 'running') return { text: '运行中', className: 'is-running' };
    return { text: '等待中', className: 'is-pending' };
  }

  function createMessageEl(message, nodeTitle) {
    const el = document.createElement('div');
    el.className = `chat-message ${message.role}`;
    const actions = Array.isArray(message.actions) && message.actions.length
      ? `<div class="chat-message__actions">${message.actions.map(a => `<span class="chat-action-pill">${escapeHtml(a)}</span>`).join('')}</div>`
      : '';
    el.innerHTML = `
      <div class="chat-message__meta">
        <span>${escapeHtml(message.meta)}</span>
        <span>${escapeHtml(nodeTitle)}</span>
      </div>
      <div class="chat-message__body">${message.body}</div>
      ${actions}`;
    return el;
  }

  function renderPipelineChat(nodeId) {
    const nodeData = nodeConversationMap[nodeId];
    if (!nodeData || !chatList) return;

    const nodeChanged = activePipelineNodeId !== nodeId;
    activePipelineNodeId = nodeId;
    if (chatTitle) chatTitle.textContent = nodeData.title;
    if (chatAgent) chatAgent.textContent = nodeData.agent;
    if (chatStatus) {
      const mapped = formatStatus(nodeData.status);
      chatStatus.textContent = mapped.text;
      chatStatus.className = `pipeline-chat-status ${mapped.className}`;
    }

    const messages = nodeData.messages;

    if (nodeChanged || chatList.children.length > messages.length) {
      // Switching to a different node or messages were cleared — full rebuild
      chatList.innerHTML = '';
      messages.forEach(msg => chatList.appendChild(createMessageEl(msg, nodeData.title)));
    } else {
      // Same node — append any new messages
      for (let i = chatList.children.length; i < messages.length; i++) {
        chatList.appendChild(createMessageEl(messages[i], nodeData.title));
      }
      // If count unchanged, the last message body may have grown (streaming) — update it
      if (chatList.children.length === messages.length && messages.length > 0) {
        const bodyEl = chatList.lastElementChild.querySelector('.chat-message__body');
        if (bodyEl) bodyEl.innerHTML = messages[messages.length - 1].body;
      }
    }

    chatList.scrollTop = chatList.scrollHeight;
    pipelineNodes.forEach(node => node.classList.toggle('selected', node.id === nodeId));
  }

  function syncExecutionMonitorMode() {
    const hasSelection = Boolean(activePipelineNodeId);
    if (executionOverview) executionOverview.classList.toggle('hidden', hasSelection);
    if (executionMonitor) executionMonitor.classList.toggle('hidden', !hasSelection);
  }

  function clearPipelineSelection() {
    activePipelineNodeId = null;
    pipelineNodes.forEach(node => node.classList.remove('selected'));
    syncExecutionMonitorMode();
  }

  function pushUserFeedback({ rerun = false } = {}) {
    const text = feedbackInput ? feedbackInput.value.trim() : '';
    if (!text) return;

    const nodeData = nodeConversationMap[activePipelineNodeId];
    if (!nodeData) return;

    const time = new Date();
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    const timestamp = `${hh}:${mm}`;

    nodeData.messages.push({
      role: 'user',
      meta: `User · ${timestamp}`,
      body: text
    });

    if (rerun) {
      nodeData.status = 'running';
      nodeData.messages.push({
        role: 'event',
        meta: `System · ${timestamp}`,
        body: `已接收反馈并准备重跑当前节点：${nodeData.title}。系统会先基于你的意见调整策略，再重新执行。`
      });
      const activeNode = document.getElementById(activePipelineNodeId);
      if (activeNode) {
        activeNode.dataset.nodeStatus = 'running';
        activeNode.classList.remove('result-ready');
        activeNode.classList.add('running-node');
        const statusEl = activeNode.querySelector('.pipeline-node__status');
        if (statusEl) {
          statusEl.classList.remove('pipeline-node__status--done', 'pipeline-node__status--pending');
          statusEl.classList.add('pipeline-node__status--active');
          statusEl.innerHTML = '&#9654;';
        }
      }
    }

    if (feedbackInput) feedbackInput.value = '';
    renderPipelineChat(activePipelineNodeId);
  }

  pipelineNodes.forEach(node => {
    node.addEventListener('click', (e) => {
      if (e.target.classList.contains('port')) return;
      activePipelineNodeId = node.id;
      renderPipelineChat(node.id);
      syncExecutionMonitorMode();
    });
  });

  overviewNodeCards.forEach(card => {
    card.addEventListener('click', () => {
      const nodeId = card.getAttribute('data-monitor-node');
      if (!nodeId) return;
      activePipelineNodeId = nodeId;
      renderPipelineChat(nodeId);
      syncExecutionMonitorMode();
    });
  });

  if (sendBtn) {
    sendBtn.addEventListener('click', () => pushUserFeedback({ rerun: false }));
  }

  if (rerunBtn) {
    rerunBtn.addEventListener('click', () => pushUserFeedback({ rerun: true }));
  }

  const feedbackSendBtn = document.getElementById('pipeline-feedback-send');
  if (feedbackSendBtn) {
    feedbackSendBtn.addEventListener('click', async () => {
      // If any agent stream is active, this button acts as a stop button
      if (streamingController) {
        streamingController.abort();
        return;
      }

      const text = feedbackInput ? feedbackInput.value.trim() : '';
      if (!text || !activePipelineNodeId) return;

      const nodeData = nodeConversationMap[activePipelineNodeId];
      if (!nodeData) return;

      const time = new Date();
      const timestamp = `${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`;

      // Append user message
      nodeData.messages.push({ role: 'user', meta: `User · ${timestamp}`, body: escapeHtml(text) });
      if (feedbackInput) feedbackInput.value = '';
      renderPipelineChat(activePipelineNodeId);

      if (chatTitle) chatTitle.textContent = 'Feedback';
      if (chatStatus) { chatStatus.innerHTML = '对话中 <img src="./icon/loading.gif" style="width:50px;height:20px;vertical-align:middle" alt="">'; chatStatus.className = 'pipeline-chat-status is-running'; }

      const controller = new AbortController();
      setStreaming(controller);
      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text, nodeTitle: nodeData.title, skills: getSelectedSkills(), model: getSelectedModel() }),
          signal: controller.signal,
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        function ts() {
          const n = new Date();
          return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
        }

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            let data;
            try { data = JSON.parse(line.slice(6)); } catch { continue; }
            if (data.type === 'assistant') {
              nodeData.messages.push({ role: 'event', meta: `Agent · ${ts()}`, body: marked.parse(data.text || '') });
              renderPipelineChat(activePipelineNodeId);
            } else if (data.type === 'user') {
              const preview = escapeHtml((data.text || '').slice(0, 400)) + ((data.text || '').length > 400 ? '\n…' : '');
              nodeData.messages.push({ role: 'user', meta: `Tool · ${ts()}`, body: `<pre style="white-space:pre-wrap;opacity:0.75">${preview}</pre>` });
              renderPipelineChat(activePipelineNodeId);
            } else if (data.type === 'system') {
              nodeData.messages.push({ role: 'system', meta: `System · ${ts()}`, body: marked.parse(data.text || '') });
              renderPipelineChat(activePipelineNodeId);
            } else if (data.type === 'error') {
              nodeData.messages.push({ role: 'event', meta: `Error · ${ts()}`, body: `<span style="color:#f87171">${escapeHtml(data.message || 'Unknown error')}</span>` });
              renderPipelineChat(activePipelineNodeId);
            }
            // 'result' and 'text' are skipped — 'assistant' already has the clean model text
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          nodeData.messages.push({ role: 'event', meta: `Error · ${timestamp}`, body: `<span style="color:#f87171">${escapeHtml(err.message)}</span>` });
          renderPipelineChat(activePipelineNodeId);
        }
      } finally {
        clearStreaming();
        if (chatStatus) { chatStatus.textContent = '等待输入'; chatStatus.className = 'pipeline-chat-status is-pending'; }
      }
    });
  }

  if (feedbackInput) {
    feedbackInput.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (feedbackSendBtn) feedbackSendBtn.click();
      }
    });
  }

  function syncFeedbackToggle() {
    if (!feedbackToggle || !pipelineLayout) return;
    const collapsed = pipelineLayout.classList.contains('feedback-collapsed');
    feedbackToggle.textContent = collapsed ? '⇤' : '⇥';
    feedbackToggle.title = collapsed ? '展开右侧对话区' : '收起右侧对话区';
    if (feedbackPanel) {
      feedbackPanel.setAttribute('aria-expanded', String(!collapsed));
    }
  }

  if (feedbackToggle && pipelineLayout) {
    feedbackToggle.addEventListener('click', () => {
      const collapsing = !pipelineLayout.classList.contains('feedback-collapsed');
      // Inline gridTemplateColumns overrides CSS classes — clear it so the class rule wins
      pipelineLayout.style.gridTemplateColumns = '';
      pipelineLayout.classList.toggle('feedback-collapsed');
      // On expand, restore the last manual resize (if any)
      if (!collapsing && savedPipelineCols) {
        pipelineLayout.style.gridTemplateColumns = savedPipelineCols;
      }
      syncFeedbackToggle();
      setTimeout(drawEdges, 260);
    });
    syncFeedbackToggle();
  }

  let chatFontSize = 12;
  const CHAT_FONT_MIN = 10, CHAT_FONT_MAX = 22;
  function applyChatFontSize() {
    if (chatList) chatList.style.setProperty('--chat-font-size', chatFontSize + 'px');
  }
  const chatZoomIn = document.getElementById('chat-zoom-in');
  const chatZoomOut = document.getElementById('chat-zoom-out');
  if (chatZoomIn) chatZoomIn.addEventListener('click', () => { chatFontSize = Math.min(CHAT_FONT_MAX, chatFontSize + 1); applyChatFontSize(); });
  if (chatZoomOut) chatZoomOut.addEventListener('click', () => { chatFontSize = Math.max(CHAT_FONT_MIN, chatFontSize - 1); applyChatFontSize(); });

  renderPipelineChat('node-1');

  // --- Resizable panels ---
  function makeResizeHandle(handle, getStart, onMove) {
    if (!handle) return;
    handle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX;
      const state  = getStart();
      handle.classList.add('is-dragging');
      document.body.style.cursor     = 'col-resize';
      document.body.style.userSelect = 'none';
      const move = ev => onMove(ev.clientX - startX, state);
      const up   = () => {
        handle.classList.remove('is-dragging');
        document.body.style.cursor     = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup',   up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup',   up);
    });
  }

  // Sidebar ↔ main content
  const sidebarEl     = document.getElementById('sidebar');
  const sidebarHandle = document.getElementById('sidebar-resizer');
  makeResizeHandle(
    sidebarHandle,
    () => sidebarEl ? sidebarEl.getBoundingClientRect().width : 0,
    (dx, startW) => {
      if (!sidebarEl) return;
      sidebarEl.style.width = Math.max(180, Math.min(480, startW + dx)) + 'px';
    }
  );

  // Editor-views ↔ pipeline-feedback
  const pipelineHandle = document.getElementById('pipeline-resizer');
  makeResizeHandle(
    pipelineHandle,
    () => {
      const editorEl = pipelineLayout ? pipelineLayout.querySelector('.editor-views') : null;
      return editorEl ? editorEl.getBoundingClientRect().width : 0;
    },
    (dx, startEditorW) => {
      if (!pipelineLayout || pipelineLayout.classList.contains('feedback-collapsed')) return;
      const totalW    = pipelineLayout.getBoundingClientRect().width - 4; // subtract 4px handle
      const newEditorW = Math.max(300, Math.min(totalW - 200, startEditorW + dx));
      const cols = `${newEditorW}px 4px 1fr`;
      pipelineLayout.style.gridTemplateColumns = cols;
      savedPipelineCols = cols;
    }
  );

  // --- Search panel ---
  const searchInput   = document.getElementById('search-input');
  const searchBtn     = document.getElementById('search-btn');
  const searchResults = document.getElementById('search-results');

  function highlightFragment(fragment, words, phrase) {
    const safe  = escapeHtml(fragment);
    // Longest terms first so the phrase match wraps before individual words do
    const terms = [phrase, ...words]
      .map(t => escapeHtml(t))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    const re = new RegExp(
      `(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
      'gi'
    );
    return safe.replace(re, '<mark>$1</mark>');
  }

  async function runSearch() {
    if (!searchInput || !searchResults) return;
    const q = searchInput.value.trim();
    if (!q) { searchResults.innerHTML = ''; return; }
    searchResults.innerHTML = '<div class="search-no-results">Searching…</div>';
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.error && !data.results.length) {
        searchResults.innerHTML = `<div class="search-no-results">${escapeHtml(data.error)}</div>`;
        return;
      }
      if (!data.results.length) {
        searchResults.innerHTML = '<div class="search-no-results">No matches found</div>';
        return;
      }
      const scoreLabel = { 3: 'phrase', 2: 'all-words', 1: 'word' };
      searchResults.innerHTML = data.results.map(r => {
        const highlighted = highlightFragment(r.fragment, data.words, data.query);
        const ts = r.ts ? new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const badge = `<span class="search-score-badge score-${r.score}">${scoreLabel[r.score]}</span>`;
        return `<div class="search-result-item">
          <div class="search-result-meta">
            <span>${escapeHtml(r.source)}${ts ? ' · ' + ts : ''}</span>${badge}
          </div>
          <div class="search-result-body">${highlighted}</div>
        </div>`;
      }).join('');
    } catch (err) {
      searchResults.innerHTML = `<div class="search-no-results" style="color:#f87171">${escapeHtml(err.message)}</div>`;
    }
  }

  if (searchBtn)   searchBtn.addEventListener('click', runSearch);
  if (searchInput) searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });

  // --- Pipeline node dragging ---
  const canvas = document.getElementById('pipeline-canvas');
  const canvasInner = document.getElementById('pipeline-canvas-inner');
  const nodes = document.querySelectorAll('.pipeline-node');
  let dragging = null;
  let offsetX = 0, offsetY = 0;
  let pipelineScale = 1;

  function updatePipelineZoom(nextScale) {
    if (!canvasInner || !zoomValue) return;
    pipelineScale = Math.min(1.6, Math.max(0.6, nextScale));
    canvasInner.style.transform = `scale(${pipelineScale})`;
    zoomValue.textContent = `${Math.round(pipelineScale * 100)}%`;
    drawEdges();
  }

  if (zoomInBtn) zoomInBtn.addEventListener('click', () => updatePipelineZoom(pipelineScale + 0.1));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => updatePipelineZoom(pipelineScale - 0.1));
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => updatePipelineZoom(1));

  if (canvas) {
    canvas.addEventListener('wheel', (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      updatePipelineZoom(pipelineScale + delta);
    }, { passive: false });
  }

  function getRelativePos(element, ancestor) {
    let x = 0;
    let y = 0;
    let current = element;
    while (current && current !== ancestor) {
      x += current.offsetLeft;
      y += current.offsetTop;
      current = current.offsetParent;
    }
    return { x, y };
  }

  nodes.forEach(node => {
    node.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('port')) return;
      dragging = node;
      const rect = node.getBoundingClientRect();
      offsetX = (e.clientX - rect.left) / pipelineScale;
      offsetY = (e.clientY - rect.top) / pipelineScale;
      node.style.zIndex = 10;
      e.preventDefault();
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const canvasRect = canvas.getBoundingClientRect();
    const x = (e.clientX - canvasRect.left + canvas.scrollLeft) / pipelineScale - offsetX;
    const y = (e.clientY - canvasRect.top + canvas.scrollTop) / pipelineScale - offsetY;
    dragging.style.left = Math.max(0, x) + 'px';
    dragging.style.top = Math.max(0, y) + 'px';
    drawEdges();
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging.style.zIndex = 2;
      dragging = null;
    }
  });

  if (canvas) {
    canvas.addEventListener('click', (e) => {
      if (e.target === canvas || e.target === canvasInner || e.target === edgesSvg) {
        clearPipelineSelection();
      }
    });
  }

  // --- Draw SVG edges between nodes ---
  const edgesSvg = document.getElementById('pipeline-edges');

  function getPortPos(nodeId, portName) {
    const node = document.getElementById(nodeId);
    const port = node ? node.querySelector(`[data-port="${portName}"]`) : null;
    if (!port || !canvasInner) return null;
    const rel = getRelativePos(port, canvasInner);
    return {
      x: rel.x + port.offsetWidth / 2,
      y: rel.y + port.offsetHeight / 2
    };
  }

  const connections = [
    { from: { node: 'node-1', port: 'out-1' }, to: { node: 'node-2', port: 'in-2' } },
    { from: { node: 'node-2', port: 'out-2' }, to: { node: 'node-fork', port: 'in-fork' } },
    { from: { node: 'node-fork', port: 'out-fork-a' }, to: { node: 'node-3a', port: 'in-3a' } },
    { from: { node: 'node-fork', port: 'out-fork-b' }, to: { node: 'node-3b', port: 'in-3b' } },
    { from: { node: 'node-3a', port: 'out-3a' }, to: { node: 'node-merge', port: 'in-merge-a' } },
    { from: { node: 'node-3b', port: 'out-3b' }, to: { node: 'node-merge', port: 'in-merge-b' } },
    { from: { node: 'node-merge', port: 'out-merge' }, to: { node: 'node-4', port: 'in-4' } },
    { from: { node: 'node-4', port: 'out-4' }, to: { node: 'node-gate', port: 'in-gate' } },
    { from: { node: 'node-gate', port: 'out-gate' }, to: { node: 'node-5', port: 'in-5' } },
  ];

  function drawEdges() {
    if (!edgesSvg || !canvasInner) return;
    edgesSvg.setAttribute('width', String(canvasInner.offsetWidth));
    edgesSvg.setAttribute('height', String(canvasInner.offsetHeight));
    edgesSvg.setAttribute('viewBox', `0 0 ${canvasInner.offsetWidth} ${canvasInner.offsetHeight}`);
    const defs = `
      <defs>
        <marker id="edge-arrow-default" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 1 L 10 6 L 0 11 Q 3 6 0 1 Z" fill="rgba(94, 116, 134, 0.95)" />
        </marker>
        <marker id="edge-arrow-ready" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 1 L 10 6 L 0 11 Q 3 6 0 1 Z" fill="rgba(0, 212, 170, 0.95)" />
        </marker>
        <marker id="edge-arrow-running" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 1 L 10 6 L 0 11 Q 3 6 0 1 Z" fill="rgba(240, 180, 41, 0.98)" />
        </marker>
      </defs>`;
    let paths = defs;
    connections.forEach(conn => {
      const from = getPortPos(conn.from.node, conn.from.port);
      const to = getPortPos(conn.to.node, conn.to.port);
      if (!from || !to) return;

      const sourceNode = document.getElementById(conn.from.node);
      const sourceStatus = sourceNode?.dataset.nodeStatus || 'pending';
      const edgeVariant = sourceStatus === 'done' ? 'ready' : sourceStatus === 'running' ? 'running' : 'default';
      const edgeLabel = sourceStatus === 'done' ? 'validated' : sourceStatus === 'running' ? 'in-flight' : 'queued';

      const dx = Math.abs(to.x - from.x) * 0.5;
      const d = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const labelWidth = edgeLabel.length * 6.4 + 12;
      paths += `
        <path class="edge-underlay" d="${d}" />
        <path class="edge-main ${edgeVariant}" d="${d}" marker-end="url(#edge-arrow-${edgeVariant})" />
        <path class="edge-flow" d="${d}" />
        <rect class="edge-label-bg" x="${midX - labelWidth / 2}" y="${midY - 10}" width="${labelWidth}" height="16" rx="6" ry="6" />
        <text class="edge-label" x="${midX}" y="${midY + 1}" text-anchor="middle">${edgeLabel}</text>
      `;
    });
    edgesSvg.innerHTML = paths;
  }

  // Initial draw
  setTimeout(drawEdges, 100);
  window.addEventListener('resize', drawEdges);
  updatePipelineZoom(1);

  // --- Bottom panel resize ---
  const resizeHandle = document.querySelector('.bottom-panel__resize');
  let resizing = false;
  let startY = 0;
  let startHeight = 0;

  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', (e) => {
      resizing = true;
      startY = e.clientY;
      startHeight = bottomPanel.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const delta = startY - e.clientY;
      const newHeight = Math.max(120, Math.min(600, startHeight + delta));
      bottomPanel.style.height = newHeight + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (resizing) {
        resizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  // --- Node hover highlight ---
  nodes.forEach(node => {
    node.addEventListener('mouseenter', () => {
      node.style.borderColor = 'var(--accent)';
      node.style.boxShadow = '0 0 20px rgba(0, 212, 170, 0.15)';
    });
    node.addEventListener('mouseleave', () => {
      node.style.borderColor = '';
      node.style.boxShadow = '';
    });
  });

  // --- Tool item hover feedback ---
  const toolItems = document.querySelectorAll('.tool-item');
  toolItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
      item.style.borderLeft = '2px solid var(--accent)';
      item.style.paddingLeft = '20px';
    });
    item.addEventListener('mouseleave', () => {
      item.style.borderLeft = '';
      item.style.paddingLeft = '';
    });
  });

  // --- Skills: collect selected skill IDs ---
  function getSelectedSkills() {
    return Array.from(document.querySelectorAll('#skills-list .skill-checkbox:checked'))
      .map(cb => cb.dataset.skillId);
  }

  // --- Model: read currently selected model from titlebar dropdown ---
  function getSelectedModel() {
    const sel = document.getElementById('model-select');
    return sel?.value || 'claude-opus-4-6';
  }

  function clearSelectedSkills() {
    document.querySelectorAll('#skills-list .skill-checkbox:checked').forEach(cb => {
      cb.checked = false;
      cb.closest('.tool-item')?.classList.remove('skill--selected');
    });
  }

  // --- Skills: load from server and render with checkboxes ---
  function attachToolItemHover(item) {
    item.addEventListener('mouseenter', () => {
      item.style.borderLeft = '2px solid var(--accent)';
      item.style.paddingLeft = '20px';
    });
    item.addEventListener('mouseleave', () => {
      item.style.borderLeft = '';
      item.style.paddingLeft = '';
    });
  }

  function iconAbbrev(id) {
    const parts = id.split('-');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return id.slice(0, 2).toUpperCase();
  }

  async function loadSkills() {
    const listEl  = document.getElementById('skills-list');
    const badgeEl = document.getElementById('skills-badge');
    if (!listEl) return;
    try {
      const res  = await fetch('/api/skills');
      const data = await res.json();
      const skills = data.skills || [];
      badgeEl && (badgeEl.textContent = skills.length);
      listEl.innerHTML = '';
      skills.forEach(skill => {
        const item = document.createElement('div');
        item.className = 'tool-item';
        item.draggable = true;
        item.dataset.toolId   = skill.id;
        item.dataset.toolType = 'skill';
        item.innerHTML = `
          <span class="tool-icon tool-icon--skill">${iconAbbrev(skill.id)}</span>
          <div class="tool-item__info">
            <span class="tool-item__name">${skill.name}</span>
            <span class="tool-item__desc">${skill.description.slice(0, 60)}${skill.description.length > 60 ? '…' : ''}</span>
          </div>
          <input type="checkbox" class="skill-checkbox" title="Enable skill" data-skill-id="${skill.id}">
        `;
        const checkbox = item.querySelector('.skill-checkbox');
        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          item.classList.toggle('skill--selected', checkbox.checked);
        });
        // prevent drag starting from checkbox click
        checkbox.addEventListener('mousedown', (e) => e.stopPropagation());
        attachToolItemHover(item);
        listEl.appendChild(item);
      });
    } catch (err) {
      console.error('Failed to load skills:', err);
    }
  }

  loadSkills();
});
