const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
var log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL || 'info');
require('dotenv').config();
//console.log(process.env.ANTHROPIC_AUTH_TOKEN)

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  if (req.path.startsWith('/api/')) log.debug(`[api] ${req.method} ${req.path}`);
  next();
});
const PORT = process.env.PORT || 3000;
const WORKSPACE_ROOT = path.join(__dirname, 'workspace');
if (!fs.existsSync(WORKSPACE_ROOT)) fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });

const ACTIVE_WORKSPACE_FILE = path.join(__dirname, '.active-workspace');

let activeWorkspaceName = (() => {
  try {
    const saved = fs.readFileSync(ACTIVE_WORKSPACE_FILE, 'utf-8').trim();
    const wsDir = path.join(__dirname, 'workspace', saved);
    return saved && fs.existsSync(wsDir) ? saved : null;
  } catch { return null; }
})();

function saveActiveWorkspace(name) {
  try {
    if (name) fs.writeFileSync(ACTIVE_WORKSPACE_FILE, name, 'utf-8');
    else if (fs.existsSync(ACTIVE_WORKSPACE_FILE)) fs.unlinkSync(ACTIVE_WORKSPACE_FILE);
  } catch { /* non-fatal */ }
}

function getWorkspaceDir(name) {
  if (!name) return null;
  return path.join(WORKSPACE_ROOT, name);
}

function getActiveWorkspaceDir() {
  return activeWorkspaceName ? getWorkspaceDir(activeWorkspaceName) : null;
}

// Base dir for all file operations: active workspace, or project root as fallback
function getBaseDir() {
  return getActiveWorkspaceDir() || __dirname;
}

// Last text message produced by any agent run
let lastMessage = '';

function ensureWorkspaceDirs(name) {
  const wsDir = getWorkspaceDir(name);
  if (!wsDir) return;
  for (const sub of ['', 'code', 'papers', 'latex']) {
    const d = sub ? path.join(wsDir, sub) : wsDir;
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

const PAPERS_DIR = path.join(__dirname, 'papers');

// Ensure papers directory exists
if (!fs.existsSync(PAPERS_DIR)) {
  fs.mkdirSync(PAPERS_DIR, { recursive: true });
}

// ── Workspace API ────────────────────────────────────────────────────────────

app.get('/api/workspace/list', (_req, res) => {
  try {
    const entries = fs.readdirSync(WORKSPACE_ROOT, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => {
        const wsDir = path.join(WORKSPACE_ROOT, e.name);
        const stat = fs.statSync(wsDir);
        return { name: e.name, updatedAt: stat.mtime.toISOString(), isActive: e.name === activeWorkspaceName };
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ workspaces: entries, active: activeWorkspaceName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workspace/create', (req, res) => {
  let { name } = req.body;
  if (!name || !name.trim()) {
    name = `research-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;
  }
  name = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\-\s]/g, '').trim().replace(/\s+/g, '-');
  if (!name) return res.status(400).json({ error: 'Invalid workspace name' });
  const wsDir = getWorkspaceDir(name);
  if (fs.existsSync(wsDir)) return res.status(409).json({ error: 'Workspace already exists', name });
  ensureWorkspaceDirs(name);
  activeWorkspaceName = name;
  saveActiveWorkspace(name);
  res.json({ success: true, name, path: wsDir });
});

app.post('/api/workspace/select', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const wsDir = getWorkspaceDir(name);
  if (!fs.existsSync(wsDir)) return res.status(404).json({ error: 'Workspace not found' });
  activeWorkspaceName = name;
  saveActiveWorkspace(name);
  ensureWorkspaceDirs(name);
  res.json({ success: true, name, path: wsDir });
});

app.get('/api/workspace/active', (_req, res) => {
  res.json({ name: activeWorkspaceName, path: getActiveWorkspaceDir() });
});

// Serve static files from project root
app.use(express.static(__dirname));

// Serve marked UMD bundle for client-side markdown rendering
app.get('/lib/marked.umd.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/marked/lib/marked.umd.js'));
});

// Resolve papers dir: prefer active workspace, fall back to legacy ./papers
function getPapersDir() {
  const wsDir = getActiveWorkspaceDir();
  return wsDir ? path.join(wsDir, 'papers') : PAPERS_DIR;
}

// List papers (PDF/.m/.py) as a recursive tree — from active workspace papers/
app.get('/api/papers', (_req, res) => {
  const dir = getPapersDir();

  function buildTree(scanDir) {
    if (!fs.existsSync(scanDir)) return [];
    return fs.readdirSync(scanDir, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() === b.isDirectory()) return a.name.localeCompare(b.name);
        return a.isDirectory() ? -1 : 1;
      })
      .map(e => {
        const absPath = path.join(scanDir, e.name);
        const relPath = path.relative(dir, absPath);
        if (e.isDirectory()) {
          const children = buildTree(absPath);
          return children.length ? { name: e.name, type: 'dir', children } : null;
        }
        if (/\.(pdf|m|py)$/i.test(e.name)) {
          return { name: e.name, type: 'file', absPath, relPath };
        }
        return null;
      })
      .filter(Boolean);
  }

  res.json({ tree: buildTree(dir), exists: fs.existsSync(dir) });
});

// Upload PDFs — destination resolved at request time so it tracks active workspace
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = getPapersDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, file.originalname),
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (/\.(pdf|txt|md|m|py)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, MD, .m, and .py files are allowed'));
    }
  },
});

app.post('/api/papers/upload', upload.array('files'), (req, res) => {
  const saved = (req.files || []).map(f => f.originalname);
  res.json({ saved });
});

// ── Session persistence ──────────────────────────────────────────────────────

function getSessionPath() {
  return path.join(getBaseDir(), '.session');
}

function get_context() {
  try {
    const raw = fs.readFileSync(getSessionPath(), 'utf-8').trim();
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function set_context(ctx, prompt) {
  if (!ctx || ctx.length === 0) return prompt;
  const lines = ctx.map((e, i) =>
    `[Entry ${i + 1}] ${e.timestamp}\nPrompt: ${e.prompt}\nMessage: ${JSON.stringify(e.message)}`
  ).join('\n\n');
  return `<session_context>\n${lines}\n</session_context>\n\n${prompt}`;
}

function update_session(prompt, message) {
  const sessionPath = getSessionPath();
  let entries = [];
  try {
    const raw = fs.readFileSync(sessionPath, 'utf-8').trim();
    if (raw) entries = JSON.parse(raw);
  } catch { /* start fresh */ }
  entries.push({ timestamp: new Date().toISOString(), prompt, message });
  try {
    fs.writeFileSync(sessionPath, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    log.warn(`[session] skipped write (${err.code}): ${err.message}`);
  }
}

// ── Session search ────────────────────────────────────────────────────────────

app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [], total: 0 });

  let entries = [];
  try {
    const raw = fs.readFileSync(getSessionPath(), 'utf-8').trim();
    if (raw) entries = JSON.parse(raw);
  } catch {
    return res.json({ results: [], total: 0, error: 'No session data' });
  }

  // Extract flat text segments from every session entry
  const segments = [];
  for (const entry of entries) {
    const ts = entry.timestamp || '';
    if (entry.prompt) {
      segments.push({ source: 'prompt', ts, text: entry.prompt });
    }
    const msg = entry.message;
    if (!msg) continue;
    if (msg.type === 'assistant') {
      for (const block of msg.message?.content ?? []) {
        if (block.type === 'text' && block.text)
          segments.push({ source: 'assistant', ts, text: block.text });
      }
    } else if (msg.type === 'user') {
      for (const block of msg.message?.content ?? []) {
        if (block.type === 'tool_result') {
          const text = Array.isArray(block.content)
            ? block.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
            : (typeof block.content === 'string' ? block.content : '');
          if (text) segments.push({ source: 'tool', ts, text });
        }
      }
    } else if ('result' in msg && msg.result) {
      segments.push({ source: 'result', ts, text: String(msg.result) });
    }
  }

  // Score each segment
  const qLow   = q.toLowerCase();
  const words   = qLow.split(/\s+/).filter(Boolean);
  const hits    = [];

  for (const seg of segments) {
    const tLow = seg.text.toLowerCase();
    let score = 0, matchAt = -1;

    // 1. Full phrase
    const pi = tLow.indexOf(qLow);
    if (pi !== -1) { score = 3; matchAt = pi; }

    // 2. All words present
    if (!score && words.every(w => tLow.includes(w))) {
      score = 2; matchAt = tLow.indexOf(words[0]);
    }

    // 3. Any single word
    if (!score) {
      for (const w of words) {
        const wi = tLow.indexOf(w);
        if (wi !== -1) { score = 1; if (matchAt === -1) matchAt = wi; }
      }
    }

    if (score && matchAt !== -1) {
      const s = Math.max(0, matchAt - 60);
      const e = Math.min(seg.text.length, matchAt + 140);
      let frag = seg.text.slice(s, e).replace(/\s+/g, ' ').trim();
      if (s > 0)              frag = '…' + frag;
      if (e < seg.text.length) frag = frag + '…';
      hits.push({ source: seg.source, ts: seg.ts, score, fragment: frag });
    }
  }

  // Sort: score desc, then newest first
  hits.sort((a, b) => b.score - a.score || b.ts.localeCompare(a.ts));

  // Deduplicate near-identical fragments
  const seen = new Set();
  const unique = hits.filter(h => {
    const key = h.fragment.slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  res.json({ results: unique.slice(0, 30), total: unique.length, query: q, words });
});

// ── Agent runner ─────────────────────────────────────────────────────────────

// Global SSE clients for broadcasting agent progress to the chat panel
const agentEventClients = new Set();

app.get('/api/agent-events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if behind proxy
  res.flushHeaders();
  // Disable Nagle algorithm so small SSE frames are sent immediately
  if (req.socket) req.socket.setNoDelay(true);
  agentEventClients.add(res);
  log.debug(`[agent-events] client connected, total=${agentEventClients.size}`);

  // Heartbeat every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    agentEventClients.delete(res);
    log.debug(`[agent-events] client disconnected, total=${agentEventClients.size}`);
  });
});

function broadcastAgentEvent(label, obj) {
  const data = `data: ${JSON.stringify({ label, ...obj })}\n\n`;
  for (const client of agentEventClients) {
    try { client.write(data); } catch { /* client disconnected */ }
  }
}

// Shared helper: run a claude-agent-sdk query, log prompt + every response message, stream via SSE send()
const BASE_TOOLS = ['Bash', 'Glob', 'Read', 'Edit', 'Write', 'Grep', 'Skill'];

// Global session ID: captured from non-feedback agents, reused by feedback to resume the conversation
let sessionId = null;

async function runAgent(label, prompt, send, skills = []) {
  const ctx = get_context();
  /*prompt = set_context(ctx, prompt);*/
  if (skills.length > 0) {
    prompt = prompt + `\n\nUse the those skills see if it could help with this task: ${skills.join(', ')}`;
  }
  log.debug(`[agent:${label}] prompt:\n${prompt}`);
  const isFeedback = label === 'feedback';
  if (!isFeedback) broadcastAgentEvent(label, { type: 'start' });
  try {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    // Seed sessionId from persisted file if not already in memory
    const sessionIdFile = path.join(getBaseDir(), '.session_id');
    if (isFeedback && !sessionId) {  // only load session if feedback api
      try { sessionId = fs.readFileSync(sessionIdFile, 'utf8').trim() || null; } catch { /* file absent */ }
      if (sessionId) log.debug(`[agent:${label}] loaded sessionId=${sessionId} from .session_id`);
    }
    const queryOptions = {
//      model: "claude-opus-4-7",
      allowedTools: [...BASE_TOOLS, "mcp__chrome-devtools__*"],
      mcpServers: {
        "chrome-devtools": {
          command: "npx",
          args: ["chrome-devtools-mcp@latest",
          "--no-usage-statistics",
          "--autoConnect"]
        }
      },
      cwd: getBaseDir(),
      settingSources: ["user", "project"],
      permissionMode: "auto",
      ...(isFeedback && sessionId ? { resume: sessionId } : {}),
    };
    for await (const message of query({ prompt, options: queryOptions })) {
      log.debug(`[agent:${label}] message: ${JSON.stringify(message)}`);
      update_session(prompt, message);
      // Capture session ID from non-feedback agents so feedback can resume it
      if (!isFeedback && message.session_id ) {  // refresh the session ID
        sessionId = message.session_id;
        log.debug(`[agent:${label}] captured sessionId=${sessionId}`);
        try { fs.writeFileSync(sessionIdFile, sessionId, 'utf8'); } catch (e) { log.warn(`[agent:${label}] failed to write .session_id: ${e.message}`); }
      }
      if ('result' in message) {
        const obj = { type: 'result', text: message.result };
        send(obj);
        if (!isFeedback) broadcastAgentEvent(label, obj);
      } else if (message.type === 'assistant') {
        for (const block of message.message?.content ?? []) {
          if (block.type === 'text' && block.text) {
            lastMessage = block.text;
            const obj = { type: 'assistant', text: block.text };
            send(obj);
            if (!isFeedback) broadcastAgentEvent(label, obj);
          }
        }
      } else if (message.type === 'user') {
        const toolResults = (message.message?.content ?? []).filter(b => b.type === 'tool_result');
        for (const tr of toolResults) {
          const raw = Array.isArray(tr.content)
            ? tr.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
            : (typeof tr.content === 'string' ? tr.content : '');
          if (raw) {
            const obj = { type: 'user', tool_use_id: tr.tool_use_id, text: raw };
            send(obj);
            if (!isFeedback) broadcastAgentEvent(label, obj);
          }
        }
      } else if ('output' in message) {
        const text = Array.isArray(message.output) ? message.output.join('\n') : message.output;
        if (text) {
          lastMessage = text;
          const obj = { type: 'text', text };
          send(obj);
          if (!isFeedback) broadcastAgentEvent(label, obj);
        }
      } else if (message.type === 'system') {
        let text;
        if (message.subtype === 'api_retry') {
          const statusPart = message.error_status ? ` (HTTP ${message.error_status})` : '';
          text = `API error${statusPart} — retrying ${message.attempt}/${message.max_retries}…`;
        } else {
          const parts = [message.message].filter(Boolean);
          text = parts.join(' ') || JSON.stringify(message);
        }
        const obj = { type: 'system', subtype: message.subtype || '', text };
        send(obj);
        if (!isFeedback) broadcastAgentEvent(label, obj);
      }
    }
    if (!isFeedback) broadcastAgentEvent(label, { type: 'done' });
  } catch (err) {
    const status = err.status ?? err.statusCode ?? null;
    const errMsg = status ? `${err.message} (HTTP ${status})` : err.message;
    const obj = { type: 'error', message: errMsg };
    send(obj);
    broadcastAgentEvent(label, obj);
    throw err;
  }
}

// Stream agent output via SSE when "开始调研" is clicked
app.post('/api/learn', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const { papers = [], skills = [] } = req.body;
  const paperList = papers.length > 0
    ? 'Look into those files from the folder: '+ papers.map(p => `- ${p}`).join('\n')
    : '';

  const baseDir = getBaseDir();
  const studyMdPath = path.join(baseDir, 'study.md');
  /*const prompt =  `You are a research assistant. The active workspace directory is: ${baseDir} ,
     PDF papers are stored in: ${getPapersDir()} ,
     The user selected these papers:\n${paperList} ,
     Task: Use Glob or Bash to list the relevant files, then give a concise one-paragraph summary ,
     of what each selected paper likely covers based on the file content. ,
     Store the summary of all files in: ${studyMdPath} ` */
  const prompt = `
You are an expert academic research surveyor specializing in systematic literature review and research ideation. 
Your role is to comprehensively survey academic literature and synthesize findings in the area.

**Your Core Responsibilities:**
1. You are given a set of pdf formatted related work or .m .py formatted code under ${getPapersDir()}. ${paperList}
study them well to have a deep understanding of the topic.
2. If chrome mcp tool is available, search academic databases (IEEE Xplore, Springer Nature, Google Scholar, arXiv) for relevant papers
3. Synthesize findings across papers to identify trends, methodologies, and open problems

**Search Strategy:**
1. Start with broad keyword searches to understand the landscape
2. Use the \`ieee-search\` skill for IEEE Xplore and \`springer-search\` skill for Springer Nature
3. Use WebSearch to find arXiv preprints and Google Scholar results
4. Track citations: identify highly cited foundational papers and recent breakthroughs
5. Categorize papers by: methodology, dataset, evaluation metric, results, limitations
6. Search for at least 15–30 relevant papers before drawing conclusions

**Synthesis Process:**
1. Group papers by theme/approach
2. Build a comparison table: Paper | Method | Dataset | Metric | Key Result | Limitations
3. Identify what methods dominate, what datasets are standard, what metrics are used
4. Spot underexplored combinations (e.g., Method A applied to Domain B, or Metric C rarely used with Method D)
5. Look for contradictory findings — these often signal productive research questions

**Output Format:**
Produce a structured report ${studyMdPath} containing:
- **Executive Summary**: 2–3 sentence overview of the field
- **Literature Map**: Thematic categories with representative papers
- **Comparison Table**: Papers × attributes

**Quality Standards:**
- Ground every claim in specific papers (cite authors, year, venue)
- Distinguish between well-established results and preliminary/contested findings
- Prefer recent work (last 3 years) unless a foundational older paper is critical
- Flag if the area is rapidly evolving and survey may become outdated quickly
  `

  try {
    await runAgent('learn', prompt, send, skills);
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

app.post('/api/feedback', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const { prompt: userMessage = '', nodeTitle = '', skills = [] } = req.body;
  const baseDir = getBaseDir();

  /*const prompt = [
    `You are an experienced researcher and research journal editor. 
    You are helping me writing a research paper with six tasks, with dedicate output for each task: 
    related work study: study.md, research idea generation: idea.md, 
    experiment evaluation planning: plan.md,  experiment implementation: code/, 
    research paper writing: latex/, and paper reviewing: review*.md .`,
    `The active workspace directory is: ${baseDir}`,
    nodeTitle ? `I am currently in task: "${nodeTitle}".` : '',
    `In the last message, we talked about: ${lastMessage}`,
    `And what I need from you now is: `,
    userMessage,
    `Please have a deep think of the context and task to understand where we are and what I need from you. 
    Respond concisely and helpfully. If the instruction requires code or file changes, make them in the workspace directory.`,
  ].filter(Boolean).join('\n\n'); */
  const prompt = `
    ${userMessage}.
    Please have a deep think of the session context to understand where we are and what I need from you. 
    Respond concisely and helpfully. If the instruction requires code or file changes, make them in the workspace directory
  `
  try {
    await runAgent('feedback', prompt, send, skills);
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});


// Generate research ideas: run the ideation agent and write idea.md
app.post('/api/ideas', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const { skills = [], userHint = '' } = req.body;
  const baseDir = getBaseDir();
  const prompt = `You are an expert academic research surveyor specializing in research ideation.
  Your role is to comprehensively identify research gaps, and propose novel research ideas to drive forward a collaborative research project.

The active workspace directory is: ${baseDir}
All input and output files must use this directory as the base path.

**Your Core Responsibilities:**
1. The survey agent has studied related works, and put the survey in \`${path.join(baseDir, 'study.md')}\`, have a good study of the file content
2. Synthesize findings across papers to identify trends, methodologies, and open problems
3. Identify research gaps — what has NOT been studied or inadequately addressed
4. Generate concrete, novel, and feasible research ideas grounded in the literature

**Idea Generation:**
After surveying, generate research ideas using the 'idea' skill and also these lenses:
- **Gap filling**: Something important that no paper has addressed
- **Combination**: Novel intersection of two existing lines of work
- **Transfer**: Successful method in Domain A applied to underexplored Domain B
- **Challenge existing assumptions**: Find a dominant assumption that may not hold in all cases
- **Scaling or generalization**: Extend a narrowly scoped result to broader settings

For each idea, state: (1) the core hypothesis, (2) why it's novel, (3) what prior work it builds on, (4) a rough sketch of how to test it.

**Output Format:**
Produce a structured report at \`${path.join(baseDir, 'idea.md')}\` containing:
- **Executive Summary**: 2–3 sentence overview of the field
- **Literature Map**: Thematic categories with representative papers
- **Comparison Table**: Papers × attributes
- **Research Gaps**: Bulleted list of underexplored areas with evidence
- **Proposed Research Ideas**: Ranked list with hypothesis, novelty, feasibility, and suggested evaluation approach
- **Recommended Papers to Read**: Top 5–10 key papers the team should study

**Quality Standards:**
- Ground every claim in specific papers (cite authors, year, venue)
- Distinguish between well-established results and preliminary/contested findings
- Prefer recent work (last 3 years) unless a foundational older paper is critical
- Flag if the area is rapidly evolving and survey may become outdated quickly

**Example output**
### 💡 Idea 1 — Orbital-Predictive Digital Twin for Proactive Satellite MEC Offloading
**Priority: ⭐⭐⭐ | Impact: Very High | Feasibility: High | Timeline: 6–9 months**

**Core Hypothesis:**
Because satellite orbital mechanics are fully deterministic (governed by Keplerian equations, predictable via SGP4 propagation), a *digital twin* that maintains a synchronized virtual model of the satellite constellation — including per-satellite position, link quality, battery state, and queue depth — enables *proactive* offloading decisions K minutes ahead of actual task arrival. This horizon exploitation reduces task failure rates, average latency, and energy consumption compared to both the reactive Hungarian algorithm (Paper 1) and the Nash equilibrium approach (Paper 2).

**Why It's Novel:**
- Both surveyed papers are *reactive*: Hungarian assignment responds to current load; Nash equilibrium responds to current cost.
- Paper 1 uses STK for orbital channel parameter derivation — but as a preprocessing step, not a live decision input.
- Exploiting orbital predictability for *proactive multi-step scheduling* is a fundamentally different paradigm: satellite networks are the only MEC environment where future link topology is analytically known.
- No paper in this domain treats the deterministic orbital trajectory as a look-ahead planning resource.

**Prior Work It Builds On:**
- Wang et al. (BUPT, Paper 1): cost function (latency + energy) and double-tier architecture as the evaluation scaffold.
- Wang et al. (NUDT, Paper 2): communication window modeling from elevation geometry — extend to multi-step window forecasting.
- Mao et al. 2017 (JSAC): DRL for terrestrial MEC as the algorithmic inspiration.

**How to Test:**
1. Build a satellite digital twin using SGP4 orbital propagation integrated with a simulated STIN (NS3 or OMNET++ with Celestlab).
2. State space for the proactive agent: {satellite positions/elevations at t, t+Δ, ..., t+KΔ; queue depths; battery levels; upcoming coverage windows}.
3. Use an LSTM-PPO (recurrent DRL) agent that ingests the K-step orbital forecast as additional state features.
4. Action space: {local execution, offload to satellite i, offload to terrestrial MEC, pre-stage task to approaching satellite}.
5. Reward: −(w₁·latency + w₂·energy + w₃·task failure indicator).
6. Compare: Paper 1 DECO-TCM, Paper 2 Nash equilibrium, reactive DRL (no look-ahead), proactive DRL (with look-ahead K=1,5,10 steps).
7. Key ablation: vary prediction horizon K to quantify the marginal value of orbital predictability.
${userHint ? `\n**User guidance for this run:** ${userHint}` : ''}
`;

  /*const prompt = `You are a helpful research assistant that output new research ideas.
  Have a good read of \`${path.join(baseDir, 'study.md')}\` to understand the existing related work.
  Please generate new research ideas and write into \`${path.join(baseDir, 'idea.md')}\` using the following structure and format:
  ### 💡 Idea 1 — Orbital-Predictive Digital Twin for Proactive Satellite MEC Offloading
**Priority: ⭐⭐⭐ | Impact: Very High | Feasibility: High | Timeline: 6–9 months**

**Core Hypothesis:**
Because satellite orbital mechanics are fully deterministic (governed by Keplerian equations, predictable via SGP4 propagation), a *digital twin* that maintains a synchronized virtual model of the satellite constellation — including per-satellite position, link quality, battery state, and queue depth — enables *proactive* offloading decisions K minutes ahead of actual task arrival. This horizon exploitation reduces task failure rates, average latency, and energy consumption compared to both the reactive Hungarian algorithm (Paper 1) and the Nash equilibrium approach (Paper 2).

**Why It's Novel:**
- Both surveyed papers are *reactive*: Hungarian assignment responds to current load; Nash equilibrium responds to current cost.
- Paper 1 uses STK for orbital channel parameter derivation — but as a preprocessing step, not a live decision input.
- Exploiting orbital predictability for *proactive multi-step scheduling* is a fundamentally different paradigm: satellite networks are the only MEC environment where future link topology is analytically known.
- No paper in this domain treats the deterministic orbital trajectory as a look-ahead planning resource.

**Prior Work It Builds On:**
- Wang et al. (BUPT, Paper 1): cost function (latency + energy) and double-tier architecture as the evaluation scaffold.
- Wang et al. (NUDT, Paper 2): communication window modeling from elevation geometry — extend to multi-step window forecasting.
- Mao et al. 2017 (JSAC): DRL for terrestrial MEC as the algorithmic inspiration.

**How to Test:**
1. Build a satellite digital twin using SGP4 orbital propagation integrated with a simulated STIN (NS3 or OMNET++ with Celestlab).
2. State space for the proactive agent: {satellite positions/elevations at t, t+Δ, ..., t+KΔ; queue depths; battery levels; upcoming coverage windows}.
3. Use an LSTM-PPO (recurrent DRL) agent that ingests the K-step orbital forecast as additional state features.
4. Action space: {local execution, offload to satellite i, offload to terrestrial MEC, pre-stage task to approaching satellite}.
5. Reward: −(w₁·latency + w₂·energy + w₃·task failure indicator).
6. Compare: Paper 1 DECO-TCM, Paper 2 Nash equilibrium, reactive DRL (no look-ahead), proactive DRL (with look-ahead K=1,5,10 steps).
7. Key ablation: vary prediction horizon K to quantify the marginal value of orbital predictability.
  `
  */

  try {
    await runAgent('ideas', prompt, send, skills);
    // Parse idea.md and send structured ideas before done
    const ideaMdPath = path.join(getBaseDir(), 'idea.md');
    if (fs.existsSync(ideaMdPath)) {
      const content = fs.readFileSync(ideaMdPath, 'utf-8');
      const ideas = parseIdeas(content);
      if (ideas.length > 0) send({ type: 'ideas', ideas });
    }
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

function parseIdeas(content) {
  const ideas = [];
  // Match ### headings that contain "Idea N" anywhere — handles emoji/icon prefixes like "### 💡 Idea 1 —"
  const ideaRegex = /^(###[^\n]*\bIdea\s+(\d+)\b[^\n]*)/gim;
  const matches = [...content.matchAll(ideaRegex)];
  for (let i = 0; i < matches.length; i++) {
    const fullHeading = matches[i][1].trim();          // e.g. "### 💡 Idea 1 — Some Title"
    const ideaNum    = parseInt(matches[i][2], 10);    // e.g. 1
    const start = matches[i].index + matches[i][0].length;
    const end   = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const body  = content.slice(start, end).trim();

    // Title: text after the first —/–/- following "Idea N"
    const titleMatch = fullHeading.match(/\bIdea\s+\d+\s*[—–-]\s*(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : fullHeading.replace(/^###\s*/, '').trim();

    // Stars: try heading first, then body's "Priority: ⭐⭐⭐" line
    let stars = '';
    const headingStars = fullHeading.match(/(⭐+)/);
    if (headingStars) {
      stars = headingStars[1];
    } else {
      const priorityStars = body.match(/Priority\s*[:\s]+(⭐+)/);
      if (priorityStars) stars = priorityStars[1];
    }

    // Summary: prefer the "Core Hypothesis" paragraph; otherwise first non-metadata paragraph
    let summary = '';
    const hypothesisMatch = body.match(/\*\*Core Hypothesis[^*]*\*\*[^\n]*\n+([\s\S]*?)(?=\n\n|\*\*[A-Z])/);
    if (hypothesisMatch) {
      summary = hypothesisMatch[1].replace(/\*\*/g, '').trim().slice(0, 320);
    } else {
      const fallbackPara = body.split(/\n\n+/).find(p => {
        const t = p.trim();
        return t && !t.startsWith('#') && !/^\*\*Priority:/i.test(t);
      }) || '';
      summary = fallbackPara.replace(/\*\*/g, '').replace(/^[-*]\s+/, '').trim().slice(0, 320);
    }

    const label = `Idea ${ideaNum}${stars ? ' ' + stars : ''}`;
    ideas.push({ label, title, stars, summary });
  }
  return ideas;
}

// Load ideas from idea.md (if it exists) without running the agent
app.get('/api/ideas/load', (_req, res) => {
  const ideaMdPath = path.join(getBaseDir(), 'idea.md');
  if (!fs.existsSync(ideaMdPath)) return res.json({ ideas: [] });
  try {
    const content = fs.readFileSync(ideaMdPath, 'utf-8');
    const ideas = parseIdeas(content);
    res.json({ ideas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if paper.pdf exists in the active workspace's latex/ directory
app.get('/api/check-paper-pdf', (_req, res) => {
  const pdfPath = path.join(getBaseDir(), 'latex', 'paper.pdf');
  res.json({ exists: fs.existsSync(pdfPath) });
});

// Adopt a research topic: run the eval-plan agent and write research/eval_plan.md
app.post('/api/adopt', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const { userMessage = '', skills = [] } = req.body;
  const baseDir = getBaseDir();

  const prompt = `You are an expert research methodology and evaluation design specialist. Your role is to translate raw research ideas (provided by the survey agent) into rigorous, reproducible, end-to-end experimental plans that will produce results convincing to top-venue reviewers.

The active workspace directory is: ${baseDir}
All input and output files must use this directory as the base path.

**Your Core Responsibilities:**
1. Read and understand the research idea from the survey agent's report
2. Design a complete experimental evaluation plan use the \`experiment\` skill: datasets, baselines, metrics, ablations, analysis
3. Specify implementation requirements clearly enough for the coding agent to act on without ambiguity
4. Ensure the plan meets the standards of the target publication venue
5. Identify potential failure modes and design robustness checks

**Research & Planning Process:**
1. Read \`${path.join(baseDir, 'study.md')}\` (survey agent's output) to understand the proposed idea and existing work
2. Read \`${path.join(baseDir, 'idea.md')}\` to understand the ideas proposed, but not finalized
3. Have a deep understanding of the finalized idea which followed by the end of this message
4. Identify the strongest baselines, use the \`baseline\` skill — what a fair comparison requires (same data, same compute, same splits)
5. Determine the right metrics: what the community uses AND what best captures the research question
6. Design ablations to isolate the contribution of each component of your method

**Evaluation Plan Structure:**

For each experiment, specify:
- **Goal**: What hypothesis does this experiment test?
- **Dataset**: Name, size, split ratios, source, preprocessing steps
- **Baselines**: Method name, reference, hyperparameters to use
- **Proposed Method**: Configuration, hyperparameters, variants
- **Metrics**: Primary metric, secondary metrics, how to compute them
- **Protocol**: Number of runs, seeds, train/val/test procedure
- **Statistical Analysis**: Significance tests (t-test, Wilcoxon, etc.), confidence intervals
- **Expected Outcome**: What result would validate the hypothesis?
- **Potential Issues**: What could go wrong and how to handle it

**Ablation Design:**
Always include ablations to validate each design choice:
- Remove one component at a time
- Vary key hyperparameters
- Test on out-of-distribution data
- Test computational cost vs. performance trade-off

**Reproducibility Checklist:**
- All random seeds specified
- Dataset download instructions or DOI
- Hardware requirements stated (GPU memory, training time estimate)
- Hyperparameter search space defined
- Evaluation code can be verified against a known baseline

**Output Format:**
Produce a document at \`${path.join(baseDir, 'plan.md')}\` containing:
- **Research Hypothesis**: One sentence statement of what we're testing
- **Target Venue & Standards**: What venue, what their expectations are
- **Datasets**: Table with Name | Task | Size | Source | License
- **Baselines**: Table with Name | Paper | Code URL | Key Hyperparams
- **Metrics**: Table with Metric | Formula | Library/Tool | Why chosen
- **Experiment Table**: Each experiment as a row with all specifications above
- **Ablation Plan**: List of ablations with purpose and expected finding
- **Implementation Spec**: Pseudocode or structured spec for coding agent
- **Timeline Estimate**: Rough compute time per experiment
- **Risks and Mitigations**: Known pitfalls and how to handle them
 Here goes the research idea: ${userMessage}`;
  /*
  const prompt = `You are an expert research methodology and evaluation design specialist. Your role is to translate raw research ideas (provided by the survey agent) into rigorous, reproducible, end-to-end experimental plans that will produce results convincing to top-venue reviewers.
      The active workspace directory is: ${baseDir}
  All input and output files must use this directory as the base path.
  1. Read \`${path.join(baseDir, 'study.md')}\` (survey agent's output) to understand the proposed idea and existing work
2. Read \`${path.join(baseDir, 'idea.md')}\` to understand the ideas proposed, but not finalized
3. Have a deep understanding of the finalized idea which followed by the end of this message 
4. Produce a document at \`${path.join(baseDir, 'plan.md')}\` containing steps in coding and experimenting 
Here goes the finalized research idea: ${userMessage} 
`; */

      try {
    await runAgent('adopt', prompt, send, skills);
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});


// Write a single paper section
app.post('/api/write_section', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const { sectionTitle = '', instruction = '', skills = [] } = req.body;
  if (!sectionTitle.trim()) {
    send({ type: 'error', message: 'sectionTitle is required' });
    return res.end();
  }

  const baseDir = getBaseDir();
  const latexDir = path.join(baseDir, 'latex');
  const safeTitle = sectionTitle.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\-\s]/g, '').replace(/\s+/g, '_');
  const texFile = path.join(latexDir, `${safeTitle}.tex`);

  const prompt = `
You are an expert academic writing specialist with deep experience in writing and publishing research papers at top venues (NeurIPS, ICML, ICLR, ACL, CVPR, IEEE transactions, etc.). Your role is to synthesize all team outputs — survey findings, evaluation plans, and experimental results — into a compelling, rigorous, publication-ready academic paper in LaTeX.
We are going to do this section by section, this section name is ${sectionTitle}, and instruction is ${instruction}. Write the section into ${texFile}
**Your Core Responsibilities:**
1. Read all team artifacts: study.md, idea.md, plan.md, and results.md to understand this project
2. Structure the paper according to target venue conventions
3. Write each section with appropriate academic tone, precision, and narrative flow
4. Create or describe figures and tables that communicate results clearly
5. Ensure proper citation management with BibTeX
6. Polish the writing for clarity, concision, and impact

**Input Sources:**
- \`${baseDir}/study.md\` — literature review 
- \`${baseDir}/idea.md\` — research ideas
- \`${baseDir}/plan.md\` — experimental design and methodology 
- \`${baseDir}/results.md\` — experiment results and figures 
- \`${baseDir}/code/figures/\` directory — PDF/PNG figures from experiments

**LaTeX Project Setup:**
Create a clean LaTeX project structure:
\`\`\`
latex/
├── paper.tex          # Main document
├── refs.bib    # BibTeX database
├── sections/
│   ├── abstract.tex
│   ├── introduction.tex
│   ├── related_work.tex
│   ├── method.tex
│   ├── experiments.tex
│   ├── results.tex
│   ├── discussion.tex
│   └── conclusion.tex
├── figures/          # Symlink or copy from code/figures/
└── Makefile          # pdflatex + bibtex build commands
\`\`\`

**Paper Structure (standard research paper):**

*Abstract* (250 words max):
- Problem motivation (1–2 sentences)
- Gap in existing work (1 sentence)
- Your approach (1–2 sentences)
- Key results with numbers (1–2 sentences)
- Broader impact (1 sentence)

*Introduction*:
- Hook: why this problem matters
- Current approaches and their limitations
- Your key insight / proposed approach
- Summary of contributions (bulleted, 3–5 items)
- Paper organization (1 paragraph)

*Related Work*:
- Organized by theme (2–4 subsections)
- Each paper: what they do, how it relates to yours
- Clear statement of how your work differs
- Do NOT dismiss prior work — contextualize it

*Methodology*:
- Problem formulation with formal notation
- Method description (top-down: overview first, then details)
- Algorithm box if applicable
- Theoretical justification or intuition for design choices

*Experimental Setup*:
- Datasets (table with stats)
- Baselines (list with references)
- Implementation details (hyperparameters, hardware)
- Evaluation metrics

*Results*:
- Main comparison table
- Analysis: what the numbers mean, not just what they are
- Ablation study table with interpretation
- Qualitative examples or case studies if applicable

*Discussion*:
- Why the method works (mechanistic explanation)
- Failure modes and limitations (be honest)
- Broader implications

*Conclusion*:
- 1-paragraph summary of contributions
- 1-paragraph future work

**Writing Style Standards:**
- Use active voice where possible: "We propose..." not "It is proposed..."
- Be precise: avoid "a lot", "very", "some" — use exact quantities
- Every claim needs a citation or evidence
- Figures and tables should be self-explanatory (good captions)
- Define all notation before using it
- Avoid jargon without definition
- Paragraph structure: topic sentence → evidence → analysis → transition

**Citation Management:**
- Use BibTeX throughout — never manually formatted references
- Use \`\\cite{}\`, \`\\citet{}\`, \`\\citep{}\` appropriately
- Verify all citations: author names, year, venue, title
- Use WebSearch or google-scholar-bib skill to retrieve BibTeX entries
- Organize \`references.bib\` alphabetically by cite key

**LaTeX Best Practices:**
- Use \`\\input{}\` to include section files from \`sections/\`
- Use \`\\label{}\` and \`\\ref{}\` for all figures, tables, equations, sections
- Use \`\\autoref{}\` for readable cross-references
- Use \`booktabs\` for professional tables (\`\\toprule\`, \`\\midrule\`, \`\\bottomrule\`)
- Use \`cleveref\` or \`hyperref\` for PDF links
- Figures: use \`\\includegraphics[width=\\linewidth]{...}\` with PDF format
- Keep lines under 100 characters for readability
- Run \`pdflatex\` + \`bibtex\` + \`pdflatex\` × 2 to resolve references
  `;

  try {
    await runAgent('write_section', prompt, send, skills);
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

// Generate full paper PDF
app.post('/api/write-paper', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const { paperTitle = '', paperFormat = '', skills = [] } = req.body;
  if (!paperTitle.trim()) {
    send({ type: 'error', message: 'paperTitle is required' });
    return res.end();
  }

  const baseDir = getBaseDir();
  const formatNote = paperFormat.trim() ? `\nFormat requirements: ${paperFormat.trim()}` : '';

  const prompt = `You are an experienced researcher and academic journal editor. Please help me generate a academic research paper using IEEE or Nature Springer template.${formatNote}
The paper title is: ${paperTitle}
The working folder is ${baseDir}. Please have a look of the tex files in ${path.join(baseDir, 'latex')}, which are the sections of the paper. 
Then, create a paper.tex in ${path.join(baseDir, 'latex')}, following the format requirement, and including those sections as \\input{section.tex}. 
If there is anything missing, but required by the template, e.g. abstract, generate it based on your understanding of the work. Finally, compile the tex file into a pdf

**Build and Validation:**
- Compile the paper with: \`cd paper && \`pdflatex paper.tex && bibtex paper && pdflatex paper.tex && pdflatex paper.tex\`)
- Fix all LaTeX warnings and errors
- Check that all references resolve (no \`??\` in output)
- Verify page count is within venue limits
- Check figure quality (not blurry, readable at print size)

**Quality Checklist Before Finalizing:**
- [ ] Abstract states problem, gap, approach, result, impact
- [ ] All contributions claimed in intro are demonstrated in experiments
- [ ] Every figure and table referenced in text
- [ ] All acronyms defined on first use
- [ ] Consistent notation throughout
- [ ] No orphaned sentences or paragraphs
- [ ] Related work covers all papers the survey agent found
- [ ] Limitations section is honest and complete
- [ ] Paper compiles cleanly to PDF
`;

  try {
    await runAgent('write-paper', prompt, send, skills);
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

// AI paper review
app.post('/api/review', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const { skills = [] } = req.body || {};
  const baseDir = getBaseDir();
  const pdfPath = path.join(baseDir, 'latex', 'paper.pdf');
  const prompt = `
   You are an expert AI research reviewer. Given a paper ${pdfPath},  execute the following six tasks in order:
                                                                                                                
  1. SUMMARY                                                      
  Summarize the paper's key contributions, methodology, and main results in a dense, reference-quality          
  paragraph.                                                                                                    
                                                                                                              
  2. LITERATURE REVIEW                                                                                          
  Conduct a comprehensive literature search for papers published on or after 2022. Identify the broad
  domain, sub-field, and core problem. Search local ${path.join(baseDir, 'papers')} directory first; use online search                  
  (chrome mcp/IEEE search/Springer search) if available. Find 10–25 significant papers across: foundational work, key datasets,
  current SOTA, direct competitors, and surveys. For each paper extract: title, authors, year, venue, core      
  method (no citation brackets), and datasets/performance (with specific numbers).
                                                                                                              
  3. GAP ANALYSIS                                                                                               
  Audit the literature review. Check for: (a) missing foundational papers cited by SOTA works, (b) missing
  dataset-introduction papers, (c) temporal gaps. Perform targeted searches to fill gaps. Return only new,      
  unique additions.                                               
                                                                                                                
  4. DOMAIN NARRATIVE (Historian)                                                                               
  Based on the full literature review, write a ~300–400 word Markdown summary with three sections:            
  - Domain History: Key paradigm shifts (chronological)                                                         
  - Open Problems: Unsolved issues and stated limitations in recent papers
  - Significance Criteria: What constitutes a meaningful contribution at {cutoff_date}                          
                                                                                                                
  5. BENCHMARKING                                                                                             
  Identify what the authors are hiding. From the paper's domain, datasets, and baselines, find recent SOTA      
  methods (published on or after 2022) that are missing from their comparisons. Return each missing      
  method with a brief justification of relevance.                                                               
                                                                                                                
  6. QUESTIONS                                                                                                  
  Generate at least 10 critical questions in two modes:                                                   
                                                                                                                
  - Evaluation mode: Probing questions on common aspects, e.g., methodology, reproducibility, inconsistent claims, etc. For each claim you identified, formulate one simple and direct question that assesses its soundness, novelty and significance 
  - Novelty mode: For each primary contribution claim identified from the paper, formulate one direct question a
   research assistant could use to find conflicting or related prior art.                                       
                                                                                                              
  Return novelty questions as a JSON list: ["Question 1?", "Question 2?", ...]
  `;

  try {
    await runAgent('review', prompt, send, skills);
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

// Continuous improvement based on user feedback
app.post('/api/improve', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const { userResponse = '', skills = [] } = req.body;
  const baseDir = getBaseDir();
  const prompt = [
    `You are an experienced researcher and research journal editor. 
    You are helping me with a research project with six tasks, with dedicate output for each task: 
    related work study: study.md, research idea generation: idea.md, 
    experiment evaluation planning: plan.md,  experiment implementation: code/, 
    research paper writing: latex/, and paper reviewing: review*.md .`,
    `The active workspace directory is: ${baseDir}`,
    `In the last message, we talked about: ${lastMessage}`,
    `And I have this idea of improve this research work: ${userResponse}`,
    `Please have a deep think of the context (read idea.md, plan.md, code, latex/paper.pdf, review*.md if they are available) 
    and try to understand where we are and what I need from you. 
    Respond concisely and helpfully. If the instruction requires code or file changes, make them in the workspace directory.`,
  ].filter(Boolean).join('\n\n');


  try {
    await runAgent('improve', prompt, send, skills);
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

// List review*.md files under baseDir
app.get('/api/review-files', (_req, res) => {
  const baseDir = getBaseDir();
  try {
    const files = fs.readdirSync(baseDir)
      .filter(f => /^review.*\.md$/i.test(f))
      .sort()
      .map(f => ({ name: f, absPath: path.join(baseDir, f) }));
    res.json({ files });
  } catch {
    res.json({ files: [] });
  }
});

// Return recursive file tree of .tex files under workspace/latex
app.get('/api/latex-files', (_req, res) => {
  const baseDir = getBaseDir();
  const latexDir = path.join(baseDir, 'latex');

  function buildTree(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() === b.isDirectory()) return a.name.localeCompare(b.name);
        return a.isDirectory() ? -1 : 1;
      })
      .map(e => {
        const absPath = path.join(dir, e.name);
        if (e.isDirectory()) {
          return { name: e.name, type: 'dir', children: buildTree(absPath) };
        }
        if (/\.(tex|pdf)$/i.test(e.name)) {
          return { name: e.name, type: 'file', absPath };
        }
        return null;
      })
      .filter(Boolean);
  }

  res.json({ tree: buildTree(latexDir), exists: fs.existsSync(latexDir) });
});

// Check if a file exists relative to the active workspace (or project root)
app.get('/api/file-exists', (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).json({ error: 'file required' });
  const filePath = path.join(getBaseDir(), file);
  res.json({ exists: fs.existsSync(filePath), path: filePath });
});

// Open a file with the system default text editor
app.post('/api/open-file', (req, res) => {
  const { file } = req.body;
  if (!file) return res.status(400).json({ error: 'file required' });
  // Accept absolute paths (from /api/code-files) or resolve relative ones against baseDir
  const filePath = path.isAbsolute(file) ? file : path.join(getBaseDir(), file);
  const { spawn } = require('child_process');
  let child;
  if (process.platform === 'win32') {
    child = spawn('cmd.exe', ['/c', 'start', '""', filePath], { detached: true, stdio: 'ignore' });
  } else {
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
    child = spawn(opener, [filePath], { detached: true, stdio: 'ignore' });
  }
  child.unref();
  res.json({ ok: true });
});

// Return recursive file tree under workspace/code (no hidden files)
app.get('/api/code-files', (_req, res) => {
  const baseDir = getBaseDir();
  const codeDir = path.join(baseDir, 'code');

  function buildTree(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() === b.isDirectory()) return a.name.localeCompare(b.name);
        return a.isDirectory() ? -1 : 1;
      })
      .map(e => {
        const absPath = path.join(dir, e.name);
        const entry = { name: e.name, type: e.isDirectory() ? 'dir' : 'file' };
        if (e.isDirectory()) entry.children = buildTree(absPath);
        else entry.absPath = absPath;
        return entry;
      });
  }

  res.json({ tree: buildTree(codeDir), exists: fs.existsSync(codeDir) });
});

// Generate code: run the coding agent
app.post('/api/coding', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const { skills = [] } = req.body || {};
  const baseDir = getBaseDir();
  /*
  const prompt = `You are a helpful coding agent, please start coding.
The active workspace directory is: ${path.join(baseDir, 'code')}
All input and output files must use this directory as the base path.
Read \`${path.join(baseDir, 'plan.md')}\` to understand the experimental plan and implementation spec, 
then implement the code accordingly. Place all generated code under \`${path.join(baseDir, 'code')}\``;
*/
  const prompt = `You are an expert research engineer specializing in implementing and running computational experiments for academic research. You translate evaluation plans into clean, efficient, reproducible code using Python and MATLAB, execute experiments, collect results, and produce publication-ready artifacts.

**Your Core Responsibilities:**
1. Read and fully understand ${path.join(baseDir, 'plan.md')} before writing any code
2. Implement the proposed method and all baselines according to the specification into ${path.join(baseDir, 'code')}
3. Run all experiments, collect results, and validate correctness
4. Produce clean, well-structured, reproducible code
5. Generate result tables and figures for the writing agent to use
6. Document the code clearly for future reproducibility

**Technology Stack:**

*Python (primary):*
- PyTorch / TensorFlow for deep learning experiments
- scikit-learn for classical ML baselines
- NumPy / Pandas for data processing
- Matplotlib / Seaborn for visualization
- Hugging Face Transformers for LLM-related work
- scipy.stats for statistical tests
- Use virtual environments; pin dependencies in \`requirements.txt\`

*MATLAB (when specified):*
- Signal processing, control systems, or domain-specific toolboxes
- Export results to CSV for cross-tool analysis
- Generate figures with publication-quality formatting
- 5G toolbox for 5G NR, NTN related protocol simulations
- use \`matlab-live-script\`, \`matlab-performance-optimizer\` skills for coding and  \`matlab-test-creator\` and \`matlab-test-execution\` skills for testing

**Implementation Process:**
1. Read ${path.join(baseDir, 'plan.md')} completely — understand every experiment before coding
2. Set up the project structure: \`src/\`, \`experiments/\`, \`data/\`, \`results/\`, \`figures/\`
3. Implement data loading and preprocessing first — validate against known statistics
4. Implement baselines before the proposed method — run them to establish ground truth
5. Implement the proposed method, unit test each component
6. Run the full evaluation pipeline, log all results to \`results/\`
7. Run statistical significance tests on final results
8. Generate tables and figures for the paper

**Code Quality Standards:**
- All random seeds must be set and logged
- Use \`argparse\` or config files for hyperparameters — never hardcode
- Log training curves, loss, and metrics during training
- Save checkpoints at regular intervals
- Write assertions to catch data shape mismatches early
- Include a \`README.md\` with exact commands to reproduce every result
- Test the reproduction pipeline end-to-end before reporting results

**Experiment Logging:**
For every experiment run, log:
- Timestamp, git commit hash, random seed
- All hyperparameters used
- Per-epoch metrics (training and validation)
- Final test metrics with mean and std over multiple runs
- Wall-clock time and peak memory usage
- Any anomalies or warnings encountered

**Result Validation:**
Before reporting results:
- Verify baselines match published numbers (within 1% is acceptable)
- Check for data leakage between train/val/test splits
- Confirm the eval metric matches the specification exactly
- Run ablations to confirm each component contributes
- Check statistical significance: use paired t-test or Wilcoxon signed-rank test

**Output Artifacts:**
Produce the following in \`results/\`:
- \`results/main_table.csv\` — main comparison table (method × metric)
- \`results/ablation_table.csv\` — ablation results
- \`figures/main_comparison.pdf\` — main result figure
- \`figures/ablation.pdf\` — ablation figure
- \`results/stats_tests.txt\` — significance test results
- \`code/\` — clean, documented implementation
- \`code/README.md\` — reproduction instructions

**Result Reporting to Team:**
Save a summary to \`research/results_summary.md\` with:
- Table of main results (copy of \`main_table.csv\` in markdown)
- Key finding in one sentence
- Paths to all figures and detailed result files
- Any surprising findings or anomalies
- Notes on compute time and resource requirements

**Error Handling:**
- If a baseline fails to reproduce published results, document the discrepancy and use your best-effort implementation
- If an experiment runs out of memory, implement gradient checkpointing or reduce batch size and note this
- If results are dramatically different from expectations, run a sanity check (overfit on a small subset) before investigating further
- Never silently ignore errors — log them and notify the team

**Outputs:**
- Clarify any ambiguities with the eval-planning agent before implementing
- Ouput ${path.join(baseDir, 'results.md')} when experiments are complete
- In results.md, explain the experiment idea, claims to prove, setup, and final figures.

## Verification Code Patterns

**Python shape check template:**
\`\`\`python
import torch
# x = torch.randn(*DUMMY_INPUT_SHAPE)
# out = model(x)
# assert out.shape == EXPECTED_SHAPE, f"Shape mismatch: {out.shape}"
# assert not torch.isnan(out).any(), "NaN detected in output"
# print("✅ Task TX.X verification passed")
\`\`\`

**MATLAB check template:**
\`\`\`matlab
% x = randn(DUMMY_INPUT_SIZE);
% out = module_function(x, params);
% assert(isequal(size(out), EXPECTED_SIZE), 'Size mismatch');
% assert(~any(isnan(out(:))), 'NaN detected');
% fprintf('✅ Task TX.X verification passed\\n');
\`\`\`
  `
  try {
    await runAgent('coding', prompt, send, skills);
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

// List available skills (subfolders in ./.claude/skills)
const SKILLS_DIR = path.join(__dirname, '/.claude/skills');
app.get('/api/skills', (_req, res) => {
  try {
    if (!fs.existsSync(SKILLS_DIR)) return res.json({ skills: [] });
    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => {
        const skillMd = path.join(SKILLS_DIR, e.name, 'SKILL.md');
        let name = e.name;
        let description = '';
        if (fs.existsSync(skillMd)) {
          const content = fs.readFileSync(skillMd, 'utf-8');
          const nameMatch = content.match(/^name:\s*(.+)$/m);
          const descMatch = content.match(/^description:\s*(.+)$/m);
          if (nameMatch) name = nameMatch[1].trim();
          if (descMatch) description = descMatch[1].trim();
        }
        return { id: e.name, name, description };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    res.json({ skills: entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT,'0.0.0.0', () => {
  console.log(`ResearchAgent Studio: http://localhost:${PORT}`);
});
