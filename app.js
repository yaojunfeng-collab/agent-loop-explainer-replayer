/**
 * AGENT LOOP REPLAYER - APPLICATION LOGIC
 */

// ─── State ─────────────────────────────────────────────────────
let currentThreadIdx = 0;
let currentTurnIdx = 0;
let currentStepIdx = 0;
let currentFrameIdx = 0;
let playInterval = null;
let quizAnswered = false;

const SYSTEM_PROMPT_ITEM = `You are a coding agent running in the Codex CLI.
Respect sandbox/approval policy and solve tasks step-by-step with tools when needed.`;

// ─── DOM refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ─── Init ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    renderThreadSelectorOptions();
    setupEventListeners();
    const initialThreadIdx = normalizeThreadIndex(parseInt($('thread-selector')?.value || '0', 10));
    renderThread(initialThreadIdx);
});

function setupEventListeners() {
    // Thread selector
    $('thread-selector').addEventListener('change', e => {
        const nextIdx = normalizeThreadIndex(parseInt(e.target.value, 10));
        currentTurnIdx = 0;
        currentStepIdx = 0;
        currentFrameIdx = 0;
        renderThread(nextIdx);
    });

    // Concept overlay
    $('btn-show-concepts').addEventListener('click', () => {
        $('concept-overlay').style.display = 'flex';
    });
    const toggleRightBtn = $('btn-toggle-right');
    if (toggleRightBtn) {
        toggleRightBtn.addEventListener('click', toggleRightPanel);
    }
    $('overlay-close').addEventListener('click', () => {
        $('concept-overlay').style.display = 'none';
    });
    $('concept-overlay').addEventListener('click', e => {
        if (e.target === $('concept-overlay')) $('concept-overlay').style.display = 'none';
    });

    // Playback controls
    $('btn-first').addEventListener('click', () => goToFrame(0));
    $('btn-last').addEventListener('click', () => {
        const frames = currentFrames();
        goToFrame(frames.length - 1);
    });
    $('btn-prev').addEventListener('click', () => {
        if (currentFrameIdx > 0) goToFrame(currentFrameIdx - 1);
    });
    $('btn-next').addEventListener('click', () => {
        const frames = currentFrames();
        if (currentFrameIdx < frames.length - 1) goToFrame(currentFrameIdx + 1);
    });
    $('btn-play').addEventListener('click', togglePlay);
    $('step-slider').addEventListener('input', e => goToFrame(+e.target.value));

    // Tab switching
    $$('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.tab-btn').forEach(b => b.classList.remove('active'));
            $$('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            $('tab-' + btn.dataset.tab).classList.add('active');
        });
    });

    // Block toggles (model input collapsible sections)
    $$('.block-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const target = toggle.dataset.target;
            const content = $(target);
            if (content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                toggle.classList.add('open');
            } else {
                content.classList.add('collapsed');
                toggle.classList.remove('open');
            }
        });
    });

    // Action buttons (optional in simplified UI)
    const promptBtn = $('btn-show-prompt');
    if (promptBtn) promptBtn.addEventListener('click', showFullPrompt);
    const deltaBtn = $('btn-show-delta');
    if (deltaBtn) deltaBtn.addEventListener('click', showDelta);
}

// ─── Helpers ───────────────────────────────────────────────────
function currentThread() { return THREADS[currentThreadIdx]; }
function currentTurn() { return currentThread().turns[currentTurnIdx]; }
function currentStep() { return currentTurn().steps[currentStepIdx]; }
function currentFrames() {
    const frames = [];
    currentThread().turns.forEach((turn, turnIdx) => {
        turn.steps.forEach((step, stepIdx) => {
            frames.push({ turn, turnIdx, step, stepIdx });
        });
    });
    return frames;
}
function currentFrame() { return currentFrames()[currentFrameIdx]; }
function previousStep() {
    return currentFrameIdx > 0 ? currentFrames()[currentFrameIdx - 1].step : null;
}
function getTurnSummary(turn) {
    const firstStep = turn.steps[0];
    const lastStep = turn.steps[turn.steps.length - 1];
    return {
        user: compactPreview(firstStep?.userContent || turn.goal),
        model: compactPreview(lastStep?.outputSummary || lastStep?.desc || '等待模型返回'),
    };
}
function firstFrameIndexForTurn(turnIdx) {
    return currentFrames().findIndex(frame => frame.turnIdx === turnIdx);
}

function normalizeThreadIndex(idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= THREADS.length) return 0;
    return idx;
}

function renderThreadSelectorOptions() {
    const selector = $('thread-selector');
    if (!selector) return;
    if (!Array.isArray(THREADS) || THREADS.length === 0) {
        selector.innerHTML = '<option value="0">无可用任务</option>';
        selector.value = '0';
        return;
    }
    selector.innerHTML = THREADS.map((thread, idx) => {
        const label = thread?.title || `任务 ${idx + 1}`;
        return `<option value="${idx}">${escHtml(label)}</option>`;
    }).join('');
    selector.value = String(normalizeThreadIndex(currentThreadIdx));
}

// ─── Thread Render ─────────────────────────────────────────────
function renderThread(idx) {
    currentThreadIdx = normalizeThreadIndex(idx);
    const thread = currentThread();
    const selector = $('thread-selector');
    if (selector) selector.value = String(currentThreadIdx);
    if (!thread) return;

    // Thread info
    $('thread-info').innerHTML = `
    <strong>Thread ID:</strong> <code>${escHtml(thread.id)}</code><br>
    <strong>模式:</strong> ${escHtml(thread.mode)} &nbsp;|&nbsp; 
    <strong>模型:</strong> ${escHtml(thread.model)}<br>
    <em>${escHtml(thread.description)}</em>
  `;

    // Turn list
    const container = $('turns-list');
    container.innerHTML = '';
    thread.turns.forEach((turn, i) => {
        const summary = getTurnSummary(turn);
        const card = document.createElement('div');
        card.className = 'turn-card' + (i === currentTurnIdx ? ' active' : '');
        card.innerHTML = `
      <div class="turn-card-header">
        <span class="turn-label">${escHtml(turn.label)}</span>
        <span class="turn-status">${turn.status}</span>
      </div>
      <div class="turn-exchange">
        <div class="turn-exchange-row">
          <span class="exchange-role user-role">U</span>
          <span class="exchange-text">${escHtml(summary.user)}</span>
        </div>
        <div class="turn-exchange-row">
          <span class="exchange-role assistant-role">A</span>
          <span class="exchange-text">${escHtml(summary.model)}</span>
        </div>
      </div>
      <div class="turn-meta">
        <span class="turn-chip">⚡ ${turn.stepCount} steps</span>
        ${turn.hasModeSwitch ? '<span class="turn-chip" style="color:#f79c4f;background:rgba(247,156,79,.08)">⚡ 模式切换</span>' : ''}
      </div>
    `;
        card.addEventListener('click', () => selectTurn(i));
        container.appendChild(card);
    });

    // Auto-select first turn
    selectTurn(currentTurnIdx);
}

function selectTurn(idx) {
    stopPlay();
    const frameIdx = firstFrameIndexForTurn(idx);
    renderStepTimeline();
    renderRewardBar();
    goToFrame(frameIdx >= 0 ? frameIdx : 0);
}

// ─── Step Rendering ────────────────────────────────────────────
function goToFrame(idx) {
    const frames = currentFrames();
    currentFrameIdx = Math.max(0, Math.min(idx, frames.length - 1));
    quizAnswered = false;

    const frame = currentFrame();
    if (!frame) return;
    currentTurnIdx = frame.turnIdx;
    currentStepIdx = frame.stepIdx;
    const { turn, step, stepIdx } = frame;

    // Update compact playback strip
    $('playback-position').textContent = `${turn.label} / Step ${stepIdx + 1}`;
    const badge = $('step-type-badge');
    badge.textContent = step.type;
    badge.className = 'step-type-badge step-type-' + step.type.replace('_CALL', '_CALL');

    $('step-title').textContent = step.title;
    $('step-desc').textContent = step.desc;
    $('step-input-summary').textContent = step.inputSummary;
    $('step-output-summary').textContent = step.outputSummary;

    // Slider + counter
    $('step-slider').max = Math.max(0, frames.length - 1);
    $('step-slider').value = currentFrameIdx;
    $('step-current').textContent = currentFrameIdx + 1;
    $('step-total').textContent = frames.length;

    $('turn-badge-area').innerHTML = `
    <span style="font-size:12px;color:var(--text-2)">${escHtml(turn.label)}</span>
    <span style="font-size:12px;color:var(--text-3);margin:0 6px">|</span>
    <span style="font-size:12px;color:var(--text-1)">${escHtml(turn.goal)}</span>
    <span style="font-size:12px;color:var(--text-3);margin:0 6px">|</span>
    <span style="font-size:12px;color:var(--accent-blue)">全局 Frame ${currentFrameIdx + 1}</span>
  `;

    $$('.turn-card').forEach((c, i) => {
        c.classList.toggle('active', i === currentTurnIdx);
    });

    // Timeline dots
    $$('.timeline-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentFrameIdx);
        dot.classList.toggle('done', i < currentFrameIdx);
    });

    renderStepHistory();

    // Highlight reward bar item
    $$('.reward-bar-item').forEach((bar, i) => {
        bar.classList.toggle('active-bar', i === currentStepIdx);
    });

    // Update right panel
    updateModelInputPanel(step);
    updateToolIOPanel(step);
    updateDiffPanel(step);
    updateRewardPanel(step);
    updateLinkedHighlights(step);

    $('quiz-popup').style.display = 'none';
}

function renderStepTimeline() {
    const frames = currentFrames();
    const container = $('step-timeline');
    container.innerHTML = '';

    const typeAbbr = {
        PLAN: 'PL', TOOL_CALL: 'TC', OBSERVE: 'OB', EDIT: 'ED', ANSWER: 'AN', ERROR: 'ER', RETRY: 'RT'
    };
    const typeColor = {
        PLAN: '#4f8ef7', TOOL_CALL: '#f79c4f', OBSERVE: '#4fddcf', EDIT: '#9b6ef8',
        ANSWER: '#4fcf8a', ERROR: '#f76f6f', RETRY: '#f7df4f'
    };

    frames.forEach((frame, i) => {
        const step = frame.step;
        const dot = document.createElement('div');
        dot.className = 'timeline-dot' + (i === currentFrameIdx ? ' active' : '');
        if (frame.stepIdx === 0) dot.classList.add('turn-start');
        dot.title = `${frame.turn.label} / Step ${frame.stepIdx + 1}: ${step.title}`;
        dot.textContent = typeAbbr[step.type] || step.type.slice(0, 2);
        dot.style.color = i === currentFrameIdx ? typeColor[step.type] : '';
        dot.addEventListener('click', () => goToFrame(i));
        container.appendChild(dot);
    });
}

function renderStepHistory() {
    const container = $('step-history-list');
    if (!container) return;
    const rewardSummaryEl = $('history-reward-summary');

    const visibleFrames = currentFrames().slice(0, currentFrameIdx + 1);
    const visibleCount = visibleFrames.length;
    container.classList.remove('density-normal', 'density-compact', 'density-micro');
    if (visibleCount <= 6) container.classList.add('density-normal');
    else if (visibleCount <= 10) container.classList.add('density-compact');
    else container.classList.add('density-micro');

    container.innerHTML = '';
    let cumulativeScore = 0;
    let turnStepContainer = null;
    visibleFrames.forEach((frame, i) => {
        const { turn, turnIdx, step, stepIdx } = frame;
        if (i === 0 || visibleFrames[i - 1].turnIdx !== turnIdx) {
            const summary = getTurnSummary(turn);
            const turnGroup = document.createElement('div');
            turnGroup.className = 'hist-turn-group';
            const turnMarker = document.createElement('div');
            turnMarker.className = 'hist-turn-marker';
            turnMarker.innerHTML = `
      <div class="hist-turn-top">
        <span class="hist-turn-label">${escHtml(turn.label)}</span>
        <span class="hist-turn-goal">${escHtml(turn.goal)}</span>
      </div>
      <div class="hist-turn-row">
        <span class="exchange-role user-role">U</span>
        <span class="hist-turn-text">${escHtml(summary.user)}</span>
      </div>
      <div class="hist-turn-row">
        <span class="exchange-role assistant-role">A</span>
        <span class="hist-turn-text">${escHtml(summary.model)}</span>
      </div>
    `;
            turnMarker.addEventListener('click', () => selectTurn(turnIdx));
            turnStepContainer = document.createElement('div');
            turnStepContainer.className = 'hist-turn-steps';
            turnGroup.appendChild(turnMarker);
            turnGroup.appendChild(turnStepContainer);
            container.appendChild(turnGroup);
        }

        const eventRole = step.type;
        const roleClass = eventRole.toLowerCase().replace('_', '-');
        const eventPreview = step.outputSummary || step.desc || '(无输出摘要)';

        const reward = step.reward || {};
        const score = typeof reward.score === 'number' ? reward.score : null;
        const scoreClass = score === null ? 'neu' : (score < 0 ? 'neg' : 'pos');
        if (score !== null) cumulativeScore += score;

        const entry = document.createElement('div');
        entry.className = `track-append-item ${roleClass}`;
        if (i === currentFrameIdx) entry.classList.add('hist-active', 'hist-new');

        entry.innerHTML = `
      <div class="track-append-main">
        <div class="track-append-head">
          <span class="append-role ${roleClass}">${escHtml(eventRole)}</span>
          <span class="append-frame">${escHtml(turn.label)} · Step ${stepIdx + 1}</span>
          <span class="append-loop">LLM#${i + 1}</span>
        </div>
        <pre class="track-append-text">${escHtml(eventPreview)}</pre>
      </div>
      <div class="track-append-reward">
        <span class="hist-reward-score ${scoreClass}">${score === null ? '—' : `${score > 0 ? '+' : ''}${score.toFixed(1)}`}</span>
        <span class="hist-reward-total">Σ ${cumulativeScore >= 0 ? '+' : ''}${cumulativeScore.toFixed(1)}</span>
      </div>
      ${i === currentFrameIdx ? '<span class="hist-new-tag">NOW</span>' : ''}
    `;

        entry.addEventListener('click', () => goToFrame(i));
        if (turnStepContainer) {
            turnStepContainer.appendChild(entry);
        } else {
            container.appendChild(entry);
        }
    });

    container.scrollTop = container.scrollHeight;

    if (rewardSummaryEl) {
        const current = currentFrame();
        const currentScore = current?.step?.reward?.score ?? 0;
        const turnFrames = visibleFrames.filter(frame => frame.turnIdx === currentTurnIdx);
        const turnCumulative = turnFrames.reduce((acc, frame) => acc + (frame.step.reward?.score ?? 0), 0);
        const totalClass = cumulativeScore >= 0 ? 'pos' : 'neg';
        const stepClass = currentScore >= 0 ? 'pos' : 'neg';
        rewardSummaryEl.innerHTML = `
      <span class="reward-kpi ${stepClass}">Step ${currentScore >= 0 ? '+' : ''}${currentScore.toFixed(1)}</span>
      <span class="reward-kpi turn ${turnCumulative >= 0 ? 'pos' : 'neg'}">Turn Σ ${turnCumulative >= 0 ? '+' : ''}${turnCumulative.toFixed(1)}</span>
      <span class="reward-kpi total ${totalClass}">Thread Σ ${cumulativeScore >= 0 ? '+' : ''}${cumulativeScore.toFixed(1)}</span>
    `;
    }
}

function renderRewardBar() {
    const frames = currentFrames();
    const container = $('reward-bar');
    container.innerHTML = '';

    const maxScore = Math.max(...frames.map(frame => Math.abs(frame.step.reward?.score || 0.1)));

    frames.forEach((frame, i) => {
        const step = frame.step;
        const r = step.reward;
        if (!r) return;
        const item = document.createElement('div');
        const absScore = Math.abs(r.score);
        const h = Math.max(8, Math.round((absScore / maxScore) * 50));
        item.className = `reward-bar-item ${r.type}` + (r.score < 0 ? ' negative' : '');
        item.style.height = h + 'px';
        item.setAttribute('data-label', `${frame.turn.label} / Step ${frame.stepIdx + 1}: ${r.label} ${r.score > 0 ? '+' : ''}${r.score.toFixed(1)}`);
        if (i === currentFrameIdx) item.classList.add('active-bar');
        item.addEventListener('click', () => goToFrame(i));
        container.appendChild(item);
    });
}

// ─── Right Panel Updates ───────────────────────────────────────
function updateModelInputPanel(step) {
    const _ = step;
    updateModelAppendStream();
}

function updateModelAppendStream() {
    const container = $('model-append-stream');
    if (!container) return;

    const frames = currentFrames().slice(0, currentFrameIdx + 1);
    const events = [];

    frames.forEach((frame, idx) => {
        const step = frame.step;
        const prevStep = idx > 0 ? frames[idx - 1].step : null;
        const frameLabel = `Turn ${frame.turnIdx + 1} / Step ${frame.stepIdx + 1}`;
        const llmCallId = idx + 1;

        if (idx === 0) {
            events.push({
                role: 'system',
                preview: `item.type=message role=system\ncontent: ${compactPreview(SYSTEM_PROMPT_ITEM)}`,
                frameLabel,
                frameIdx: idx,
            });

            buildInitDeveloperItems(step.developerContent).forEach(item => {
                events.push({
                    role: 'developer',
                    preview: item,
                    frameLabel,
                    frameIdx: idx,
                });
            });
        }

        const prevDeveloper = normalizeForAppendCompare(prevStep?.developerContent);
        const currDeveloper = normalizeForAppendCompare(step.developerContent);
        const shouldAppendDeveloper = idx > 0 && frame.stepIdx === 0 && prevDeveloper !== currDeveloper;
        if (shouldAppendDeveloper) {
            events.push({
                role: 'developer',
                preview: `item.type=message role=developer update=turn_start\ncontent: ${compactPreview(step.developerContent || 'developer instructions')}`,
                frameLabel,
                frameIdx: idx,
            });
        }

        if (frame.stepIdx === 0 && (idx === 0 || hasChanged(prevStep?.userContent, step.userContent))) {
            events.push({
                role: 'user',
                preview: `item.type=message role=user\ncontent: ${compactPreview(step.userContent || 'user request')}`,
                frameLabel,
                frameIdx: idx,
            });
        }

        if (events.length > 0) {
            events[events.length - 1].llmCallId = llmCallId;
        }

        if (step.toolIO) {
            const callPreview = `item.type=function_call name=${step.toolIO.name}\narguments: ${compactPreview(step.toolIO.args || '')}`;
            events.push({
                role: 'function_call',
                preview: callPreview,
                frameLabel,
                frameIdx: idx,
            });

            const outputPreview = step.toolIO.status === 'ok'
                ? compactPreview(step.toolIO.stdout || step.outputSummary || '')
                : compactPreview(step.toolIO.stderr || step.toolIO.stdout || step.outputSummary || '');
            events.push({
                role: 'function_call_output',
                preview: `item.type=function_call_output\noutput: ${outputPreview || '(tool output)'}`,
                frameLabel,
                frameIdx: idx,
            });
        } else {
            events.push({
                role: 'message',
                preview: `item.type=message role=assistant\ncontent: ${compactPreview(step.outputSummary || step.desc || '(assistant message)')}`,
                frameLabel,
                frameIdx: idx,
            });
        }
    });

    if (events.length === 0) {
        container.innerHTML = '<div class="append-empty">当前还没有可见的 append 事件</div>';
        return;
    }

    container.innerHTML = events.map((event, eventIdx) => `
    <div class="append-item ${event.frameIdx === currentFrameIdx ? 'current' : ''}">
      <span class="append-seq">${eventIdx + 1}</span>
      ${event.llmCallId ? `<span class="append-loop-mark">LLM#${event.llmCallId}</span>` : ''}
      <span class="append-role ${event.role.toLowerCase().replace('_', '-')}">${event.role}</span>
      <span class="append-frame">${escHtml(event.frameLabel)}</span>
      <pre class="append-text">${escHtml(event.preview)}</pre>
    </div>
  `).join('');
    container.scrollTop = container.scrollHeight;
}

function toggleRightPanel() {
    const body = document.body;
    const collapsed = body.classList.toggle('right-panel-hidden');
    const btn = $('btn-toggle-right');
    if (btn) {
        btn.textContent = collapsed ? '显示细节栏' : '隐藏细节栏';
    }
}

function updateToolIOPanel(step) {
    const prev = previousStep();
    const container = $('tool-io-display');
    if (!step.toolIO) {
        container.innerHTML = '<div class="empty-state">此 Step 无工具调用</div>';
        toggleChangeClass(container, false);
        return;
    }
    const t = step.toolIO;
    const statusClass = t.status === 'ok' ? 'tool-status-ok' : 'tool-status-err';
    const statusIcon = t.status === 'ok' ? '✅ 成功' : '❌ 失败';
    const prevTool = prev?.toolIO || {};
    container.innerHTML = `
    <div class="tool-card">
      <div class="tool-card-header">
        <span class="tool-name">${escHtml(t.name)}</span>
        <span class="${statusClass}">${statusIcon}</span>
        ${t.exitCode !== undefined ? `<span style="font-size:11px;color:var(--text-3)">exit: ${t.exitCode}</span>` : ''}
      </div>
      <div class="tool-body">
        <div class="tool-section-label">Arguments</div>
        <pre class="tool-code" style="margin-bottom:10px;white-space:pre-wrap">${renderDeltaText(prevTool.args, t.args, true)}</pre>
        ${t.stdout ? `<div class="tool-section-label">stdout</div><pre class="tool-code tool-stdout" style="white-space:pre-wrap">${renderDeltaText(prevTool.stdout, t.stdout, true)}</pre>` : ''}
        ${t.stderr ? `<div class="tool-section-label">stderr</div><pre class="tool-code tool-stderr" style="white-space:pre-wrap">${renderDeltaText(prevTool.stderr, t.stderr, true)}</pre>` : ''}
      </div>
    </div>
  `;
    toggleChangeClass(container, hasChanged(prev?.toolIO, step.toolIO));
}

function updateDiffPanel(step) {
    const prev = previousStep();
    const container = $('diff-display');
    if (!step.diff) {
        container.innerHTML = '<div class="empty-state">此 Step 无文件变更</div>';
        toggleChangeClass(container, false);
        return;
    }
    const lines = step.diff.split('\n');
    const html = lines.map(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) return `<div class="diff-add">+ ${escHtml(line.slice(1))}</div>`;
        if (line.startsWith('-') && !line.startsWith('---')) return `<div class="diff-remove">- ${escHtml(line.slice(1))}</div>`;
        if (line.startsWith('@@')) return `<div class="diff-header">${escHtml(line)}</div>`;
        if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('+++') || line.startsWith('---') || line.startsWith('new file')) {
            return `<div class="diff-header" style="color:var(--text-3)">${escHtml(line)}</div>`;
        }
        return `<div class="diff-ctx"> ${escHtml(line)}</div>`;
    }).join('');
    container.innerHTML = `<div class="diff-wrap">${html}</div>`;
    toggleChangeClass(container, hasChanged(prev?.diff, step.diff));
}

function updateRewardPanel(step) {
    const prev = previousStep();
    const container = $('reward-detail');
    if (!step.reward) {
        container.innerHTML = '<div class="empty-state">无 Reward 信息</div>';
        toggleChangeClass(container, false);
        return;
    }
    const r = step.reward;
    const scoreClass = r.score > 0.4 ? 'positive' : (r.score < 0 ? 'negative' : 'neutral');
    const rubricHTML = (r.rubric || []).map(item => `
    <div class="reward-rubric-item">
      <span class="${item.ok === true ? 'reward-check' : (item.ok === false ? 'reward-cross' : 'reward-neutral')}">
        ${item.ok === true ? '✓' : (item.ok === false ? '✗' : '○')}
      </span>
      <span>${escHtml(item.text)}</span>
    </div>
  `).join('');

    const typeLabel = {
        step: 'Step 级奖励 (局部)',
        milestone: '里程碑奖励 (中间目标)',
        turn: 'Turn 级奖励 (用户验收)',
        negative: '负奖励（失败惩罚）',
    }[r.type] || r.type;

    const frames = currentFrames().slice(0, currentFrameIdx + 1);
    const threadScore = frames.reduce((acc, frame) => acc + (frame.step.reward?.score ?? 0), 0);
    const turnScore = frames
        .filter(frame => frame.turnIdx === currentTurnIdx)
        .reduce((acc, frame) => acc + (frame.step.reward?.score ?? 0), 0);
    const turnReasonRows = currentThread().turns.map((turn, turnIdx) => {
        const turnFrames = frames.filter(frame => frame.turnIdx === turnIdx);
        if (turnFrames.length === 0) return '';
        const turnTotal = turnFrames.reduce((acc, frame) => acc + (frame.step.reward?.score ?? 0), 0);
        const latestFrame = turnFrames[turnFrames.length - 1];
        const turnCompleted = turnFrames.length >= turn.steps.length;
        let reason;
        if (turnCompleted) {
            const finalEvalStep = [...turnFrames]
                .reverse()
                .map(frame => frame.step)
                .find(step => step.reward?.type === 'turn' || step.reward?.type === 'milestone');
            reason = finalEvalStep?.reward?.label || latestFrame.step.reward?.label || `${turn.label} 完成`;
        } else {
            reason = `进行中：${latestFrame.step.reward?.label || latestFrame.step.title}`;
        }

        const stepScoreItems = turnFrames.map(frame => {
            const score = frame.step.reward?.score;
            const scoreText = typeof score === 'number'
                ? `${score >= 0 ? '+' : ''}${score.toFixed(1)}`
                : '—';
            const scoreClass = typeof score !== 'number' ? 'neutral' : (score >= 0 ? 'pos' : 'neg');
            return `
      <span class="reward-step-chip ${scoreClass}">
        S${frame.stepIdx + 1} ${scoreText}
      </span>
    `;
        }).join('');

        return `
      <div class="reward-turn-row ${turnIdx === currentTurnIdx ? 'current' : ''}">
        <div class="reward-turn-head">
          <span class="reward-turn-name">${escHtml(turn.label)}</span>
          <span class="reward-turn-score ${turnTotal >= 0 ? 'pos' : 'neg'}">${turnTotal >= 0 ? '+' : ''}${turnTotal.toFixed(1)}</span>
          <span class="reward-turn-reason">${escHtml(reason)}</span>
        </div>
        <div class="reward-step-vector">${stepScoreItems}</div>
      </div>
    `;
    }).join('');

    const keyReasons = (r.rubric || [])
        .slice(0, 3)
        .map(item => `<li>${escHtml(item.text)}</li>`)
        .join('');

    container.innerHTML = `
    <div class="reward-global-card">
      <div class="reward-global-title">全局累计视角（Thread / Turn / Step）</div>
      <div class="reward-global-kpis">
        <span class="reward-kpi-chip ${r.score >= 0 ? 'pos' : 'neg'}">Step ${r.score >= 0 ? '+' : ''}${r.score.toFixed(1)}</span>
        <span class="reward-kpi-chip ${turnScore >= 0 ? 'pos' : 'neg'}">Turn Σ ${turnScore >= 0 ? '+' : ''}${turnScore.toFixed(1)}</span>
        <span class="reward-kpi-chip ${threadScore >= 0 ? 'pos' : 'neg'}">Thread Σ ${threadScore >= 0 ? '+' : ''}${threadScore.toFixed(1)}</span>
      </div>
      <div class="reward-turn-list">${turnReasonRows}</div>
    </div>
    <div class="reward-detail-card">
      <div class="reward-score ${scoreClass}">${r.score > 0 ? '+' : ''}${r.score.toFixed(1)}</div>
      <div class="reward-label">${escHtml(r.label)}</div>
      <div style="font-size:11px;color:var(--accent-purple);margin-bottom:10px;">${typeLabel}</div>
      <div class="reward-rubric">${rubricHTML}</div>
    </div>
    <div class="rl-explain-box">
      <div class="rl-explain-title">💡 RL 视角解析（重点看原因）</div>
      <ul class="rl-reason-list">${keyReasons}</ul>
      ${renderRLExplain(r.type, r.score)}
    </div>
  `;
    toggleChangeClass(container, hasChanged(prev?.reward, step.reward));
}

function renderRLExplain(type, score) {
    const explanations = {
        step: `这是 <strong>Step 级奖励</strong>：对应一次 (state→action) 决策。RL 通过大量这样的 step 数据，学习"在当前 context 下，什么动作概率应该提高/降低"。Policy 更新公式：∇logπ(a|s) · R`,
        milestone: `这是 <strong>里程碑奖励</strong>：当某个关键目标达成时（如测试通过、文件修改成功）给予较大分值。这类分数会通过 credit assignment 分配回之前的关键 step，鼓励 Agent 规划正确的中间路径。`,
        turn: `这是 <strong>Turn 级奖励</strong>：一个 Turn 完成时的整体评估。Turn = RL 里的"episode"。最终奖励 R 会通过 REINFORCE/PPO 等算法反向传播到 Turn 内每一个 step 的更新。`,
        negative: `这是 <strong>负奖励</strong>：惩罚无效或错误的动作。RL 会降低在相似 state 下产生相同 action 的概率。配合失败后的恢复 step，Agent 可以学到"observe-adapt"的错误恢复策略。`,
    };
    return explanations[type] || '该 step 的 reward 信息。';
}

// ─── Quiz ──────────────────────────────────────────────────────
function renderQuiz(step) {
    const popup = $('quiz-popup');
    if (!step.quiz) { popup.style.display = 'none'; return; }
    popup.style.display = 'block';
    quizAnswered = false;

    $('quiz-question').textContent = step.quiz.question;
    $('quiz-answer').style.display = 'none';

    const optContainer = $('quiz-options');
    optContainer.innerHTML = '';
    step.quiz.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => {
            if (quizAnswered) return;
            quizAnswered = true;
            const correctIdx = step.quiz.correctIndex;
            $$('.quiz-opt-btn').forEach((b, bi) => {
                if (bi === correctIdx) b.classList.add('correct');
                else if (bi === i && i !== correctIdx) b.classList.add('wrong');
            });
            $('quiz-answer').style.display = 'block';
            $('quiz-answer').innerHTML = `<strong>✅ Codex 的选择：</strong><br>${escHtml(step.quiz.answer)}`;
        });
        optContainer.appendChild(btn);
    });
}

// ─── Action Buttons ────────────────────────────────────────────
function showFullPrompt() {
    const btn = $('btn-show-prompt');
    const isActive = btn.classList.toggle('active-btn');
    const blocks = [
        ['block-developer', '[data-target="block-developer"]'],
        ['block-user', '[data-target="block-user"]'],
        ['block-history', '[data-target="block-history"]'],
        ['block-tools', '[data-target="block-tools"]'],
    ];

    blocks.forEach(([blockId, toggleSelector]) => {
        const block = $(blockId);
        const toggle = document.querySelector(toggleSelector);
        if (!block || !toggle) return;
        if (isActive) {
            block.classList.remove('collapsed');
            toggle.classList.add('open');
        }
    });
}

function showDelta() {
    const btn = $('btn-show-delta');
    const isActive = btn.classList.toggle('active-btn');
    const target = $('block-history');
    const toggle = document.querySelector('[data-target="block-history"]');
    if (isActive && target && toggle) {
        target.classList.remove('collapsed');
        toggle.classList.add('open');
    }
    updateModelInputPanel(currentStep());
}

function updateLinkedHighlights(step) {
    const prev = previousStep();
    const inputChanged = hasChanged(prev?.developerContent, step.developerContent)
        || hasChanged(prev?.userContent, step.userContent)
        || hasChanged(prev?.historyContent, step.historyContent);
    const toolChanged = !!step.toolIO && hasChanged(prev?.toolIO, step.toolIO);
    const diffChanged = !!step.diff && hasChanged(prev?.diff, step.diff);
    const rewardChanged = !!step.reward && hasChanged(prev?.reward, step.reward);

    const tabChangedMap = {
        'model-input': inputChanged,
        'tool-io': toolChanged,
        'workspace-diff': diffChanged,
        reward: rewardChanged,
    };

    $$('.tab-btn').forEach(btn => {
        btn.classList.toggle('linked-hot', !!tabChangedMap[btn.dataset.tab]);
    });
}

// ─── Playback ──────────────────────────────────────────────────
function togglePlay() {
    if (playInterval) {
        stopPlay();
    } else {
        const btn = $('btn-play');
        btn.textContent = '⏸';
        btn.classList.add('playing');
        playInterval = setInterval(() => {
            const frames = currentFrames();
            if (currentFrameIdx < frames.length - 1) {
                goToFrame(currentFrameIdx + 1);
            } else {
                stopPlay();
            }
        }, 2200);
    }
}

function stopPlay() {
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
    }
    const btn = $('btn-play');
    btn.textContent = '▶';
    btn.classList.remove('playing');
}

function hasChanged(previous, current) {
    return JSON.stringify(previous ?? null) !== JSON.stringify(current ?? null);
}

function toggleChangeClass(el, shouldHighlight) {
    if (!el) return;
    el.classList.toggle('delta-focus', !!shouldHighlight);
}

function updateInputBlockState(blockId, changed) {
    const block = $(blockId);
    const toggle = document.querySelector(`[data-target="${blockId}"]`);
    if (!block || !toggle) return;

    toggleChangeClass(block, changed);
    toggle.classList.toggle('delta-focus', !!changed);
    toggle.classList.toggle('has-delta', !!changed);

    if (changed) {
        block.classList.remove('collapsed');
        toggle.classList.add('open');
    }
}

function setDeltaRenderedContent(el, previousText, currentText) {
    if (!el) return;
    const showDeltaMode = $('btn-show-delta')?.classList.contains('active-btn');
    el.innerHTML = renderDeltaText(previousText, currentText, showDeltaMode);
}

function renderDeltaText(previousText, currentText, showDeltaMode) {
    const prevLines = String(previousText ?? '').split('\n');
    const currLines = String(currentText ?? '').split('\n');
    const prevSet = new Set(prevLines);

    return currLines.map(line => {
        const safe = escHtml(line || '');
        if (!safe && !showDeltaMode) {
            return '<span class="delta-dim-line">&nbsp;</span>';
        }

        const isNew = line.trim() && !prevSet.has(line);
        if (isNew) {
            return `<span class="delta-new-line">${safe}</span>`;
        }

        if (showDeltaMode) {
            return `<span class="delta-dim-line">${safe || '&nbsp;'}</span>`;
        }

        return safe;
    }).join('\n');
}

function extractAppendedLines(previousText, currentText) {
    const prevLines = String(previousText ?? '').split('\n').map(line => line.trim()).filter(Boolean);
    const currLines = String(currentText ?? '').split('\n').map(line => line.trim()).filter(Boolean);
    const prevSet = new Set(prevLines);
    return currLines.filter(line => !prevSet.has(line)).slice(0, 4);
}

function compactPreview(text) {
    const oneLine = String(text ?? '').replace(/\s+/g, ' ').trim();
    if (!oneLine) return '...';
    return oneLine.length > 80 ? `${oneLine.slice(0, 80)}...` : oneLine;
}

function normalizeForAppendCompare(text) {
    return String(text ?? '')
        .replace(/\[同 Step \d+\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildInitDeveloperItems(developerContent) {
    const content = String(developerContent ?? '');
    const lines = content.split('\n');
    const pick = pattern => {
        const line = lines.find(line => pattern.test(line));
        return line ? line.trim() : '';
    };

    const approvalLine = pick(/approval|sandbox/i) || 'approval_policy: on-failure; sandbox_policy: network-disabled';
    const modeLine = pick(/collaboration_mode|mode/i) || 'collaboration_mode: default';
    const memoryLine = 'memory_access: enabled (workspace + session context)';
    const personalityLine = 'personality: concise, direct, pragmatic';

    return [
        `item.type=message role=developer part=approval_sandbox\ncontent: ${compactPreview(approvalLine)}`,
        `item.type=message role=developer part=collaboration_mode\ncontent: ${compactPreview(modeLine)}`,
        `item.type=message role=developer part=memory\ncontent: ${memoryLine}`,
        `item.type=message role=developer part=personality\ncontent: ${personalityLine}`,
    ];
}

// ─── Utilities ─────────────────────────────────────────────────
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
