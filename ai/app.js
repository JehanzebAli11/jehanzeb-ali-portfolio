// ai.jehanzeb.xyz: every moving part on the page. Everything renders as plain
// content first; this script only animates it. Under reduced motion each part
// shows its end state and nothing loops.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const seen = (el, cb, threshold = 0.25) => new IntersectionObserver(([e]) => cb(e.isIntersecting), { threshold }).observe(el);

  // seeded shuffle, so the grid looks the same on every visit
  const shuffled = (n, seed) => {
    const a = [...Array(n).keys()];
    let s = seed;
    for (let i = n - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  /* ---------- hero: 400 attacks, one square each ---------- */
  const rates = {
    en: { fig: '48.5', count: '194 / 400 attacks caught', note: '48.5% of 400 attacks caught in English.', caught: 194, total: 400, seed: 11 },
    ur: { fig: '11.5', count: '46 / 399 attacks caught', note: '11.5% of 399 attacks caught in Roman Urdu.', caught: 46, total: 399, seed: 29 },
  };
  const grid = $('[data-attacks]');
  const cells = [];
  if (grid) {
    for (let i = 0; i < 400; i++) {
      const c = document.createElement('span');
      c.className = 'attacks__cell';
      c.style.setProperty('--d', `${((i % 20) + Math.floor(i / 20)) * 9}ms`);
      grid.appendChild(c); cells.push(c);
    }
  }
  const scan = $('.attacks__scan');
  const paint = (lang) => {
    const r = rates[lang];
    const lit = new Set(shuffled(400, r.seed).slice(0, r.caught));
    cells.forEach((c, i) => { c.classList.toggle('is-lit', lit.has(i)); c.classList.toggle('is-void', i >= r.total); });
    if (scan && !reduce) { scan.classList.remove('is-on'); void scan.offsetWidth; scan.classList.add('is-on'); }
  };
  const fig = $('[data-fig]'), count = $('[data-fig-count]'), note = $('[data-fig-note]');
  $$('[data-lang] input').forEach((input) => input.addEventListener('change', () => {
    const r = rates[input.value];
    fig.textContent = r.fig; count.textContent = r.count; note.textContent = r.note;
    paint(input.value);
  }));
  if (grid) {
    // light the starting language once the hero is on screen
    if (reduce) paint('ur'); else requestAnimationFrame(() => setTimeout(() => paint(($('[data-lang] input:checked') || {}).value || 'ur'), 350));
  }

  /* ---------- the sample attacks type out, word by word ---------- */
  $$('[data-stream]').forEach((p) => {
    if (reduce) return;
    const words = p.textContent.split(/(\s+)/);
    p.setAttribute('aria-label', p.textContent);
    p.textContent = '';
    const spans = words.map((w) => { const s = document.createElement('span'); s.textContent = w; s.className = 'tok'; s.setAttribute('aria-hidden', 'true'); p.appendChild(s); return s; });
    p.classList.add('is-streaming');
    let done = false;
    seen(p, (on) => {
      if (!on || done) return; done = true;
      spans.forEach((s, i) => setTimeout(() => s.classList.add('is-in'), i * 55));
      setTimeout(() => p.classList.remove('is-streaming'), spans.length * 55 + 400);
    }, 0.6);
  });

  /* ---------- headings decode in from noise ---------- */
  const glyphs = 'abcdefghijklmnopqrstuvwxyz0123456789';
  $$('main h2').forEach((h) => {
    if (reduce) return;
    const final = h.textContent;
    h.setAttribute('aria-label', final);
    let done = false;
    seen(h, (on) => {
      if (!on || done) return; done = true;
      const start = performance.now(), dur = 700;
      const step = (now) => {
        const k = Math.min(1, (now - start) / dur), n = Math.floor(k * final.length);
        h.textContent = final.slice(0, n) + [...final.slice(n)].map((ch) => (/[a-z0-9]/i.test(ch) ? glyphs[(Math.random() * glyphs.length) | 0] : ch)).join('');
        if (k < 1) requestAnimationFrame(step); else h.textContent = final;
      };
      requestAnimationFrame(step);
    }, 0.6);
  });

  /* ---------- nav: the context window meter ---------- */
  const ctx = $('[data-ctx]'), bar = $('[data-progress]');
  const words = ($('main').innerText.match(/\S+/g) || []).length;
  const total = Math.round(words * 1.33); // about 1.33 tokens per English word
  const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);
  let ticking = false;
  const meter = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const f = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 1;
    if (ctx) ctx.textContent = `context ${fmt(Math.round(total * f))} / ${fmt(total)} tokens`;
    if (bar) bar.style.transform = `scaleX(${f})`;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(meter); } }, { passive: true });
  meter();

  /* ---------- a loop that pauses: off screen, on hover and focus, by button ---------- */
  const pausable = (root, btn, onChange) => {
    const s = { seen: false, hover: false, focus: false, held: false };
    const sync = () => { const run = s.seen && !s.hover && !s.focus && !s.held; if (btn) btn.textContent = s.held ? 'play' : 'pause'; onChange(run); };
    if (btn) btn.addEventListener('click', () => { s.held = !s.held; sync(); });
    [['pointerenter', 'hover', true], ['pointerleave', 'hover', false], ['focusin', 'focus', true], ['focusout', 'focus', false]].forEach(([t, k, v]) => root.addEventListener(t, () => { s[k] = v; sync(); }));
    seen(root, (on) => { s.seen = on; sync(); }, 0.3);
  };

  /* ---------- firewall: the sample trace streams line by line ---------- */
  const trace = $('[data-trace]');
  if (trace) {
    const lines = $$('.trace__log li', trace), btn = $('[data-trace-toggle]', trace);
    if (reduce) { btn.hidden = true; }
    else {
      trace.classList.add('is-live');
      let t = 0, last = 0, running = false;
      const per = 1100, hold = 3200, cycle = lines.length * per + hold;
      const frame = (now) => {
        if (!running) return;
        t = (t + Math.min(100, now - last)) % cycle; last = now;
        const shown = Math.floor(t / per);
        lines.forEach((li, i) => li.classList.toggle('is-shown', i <= shown));
        requestAnimationFrame(frame);
      };
      pausable(trace, btn, (run) => {
        if (run && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
        if (!run) { running = false; if (btn.textContent === 'play') lines.forEach((li) => li.classList.add('is-shown')); }
      });
    }
  }

  /* ---------- worldsmith: the repair loop, played in a tile room ---------- */
  const world = $('[data-world]');
  if (world) {
    const COLS = 16, ROWS = 4, FLOOR = 3, PIT = [6, 7, 8], TELE = [[5, 2], [12, 2]], GOAL = 15;
    const tiles = {};
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const t = document.createElement('span');
      let k = 'air';
      if (y === FLOOR && !PIT.includes(x)) k = 'floor';
      if (y === FLOOR && PIT.includes(x)) k = 'bridge';
      if (x === GOAL && (y === 1 || y === 2)) k = 'goal';
      if (TELE.some(([tx, ty]) => tx === x && ty === y)) k = 'tele';
      t.className = `tile tile--${k}`;
      t.style.gridColumn = x + 1; t.style.gridRow = y + 1;
      world.appendChild(t);
      (tiles[k] = tiles[k] || []).push(t);
    }
    const player = $('[data-player]', world), wnote = $('[data-world-note]', world);
    const steps = $$('.loop__steps > li', world.parentElement);
    // player keyframes: [ms, x, y, opacity]
    const keys = [[0, 0, 2, 1], [1800, 5, 2, 1], [2100, 6, 1.3, 1], [2500, 6.6, 3.6, 0], [2600, 0, 2, 0], [2900, 0, 2, 1], [7000, 0, 2, 1], [9400, 14, 2, 1], [10600, 14, 2, 1]];
    const END = 10600;
    const at = (t) => {
      let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= t) i++;
      const [t0, x0, y0, o0] = keys[i], [t1, x1, y1, o1] = keys[i + 1];
      const k = t1 === t0 ? 1 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, o0 + (o1 - o0) * k];
    };
    const notes = ['the player falls in the pit', 'the architect proposes two patches', 'the validator rejects the teleport', 'the same player finishes'];
    let lastStep = -1;
    const render = (t) => {
      const [x, y, o] = at(t);
      player.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
      player.style.opacity = o;
      const step = t < 2600 ? 0 : t < 4800 ? 1 : t < 7000 ? 2 : 3;
      tiles.bridge.forEach((b) => { b.classList.toggle('is-proposed', step === 1); b.classList.toggle('is-accepted', step >= 2); });
      tiles.tele.forEach((b) => { b.classList.toggle('is-proposed', step === 1); b.classList.toggle('is-rejected', step === 2); });
      tiles.goal.forEach((g) => g.classList.toggle('is-reached', t >= 9400));
      if (step !== lastStep) { lastStep = step; wnote.textContent = notes[step]; steps.forEach((li, i) => li.classList.toggle('is-now', i === step)); }
    };
    const btn = $('[data-world-toggle]');
    if (reduce) { render(END); btn.hidden = true; steps.forEach((li) => li.classList.remove('is-now')); }
    else {
      world.classList.add('is-live');
      let t = 0, last = 0, running = false;
      const frame = (now) => { if (!running) return; t = (t + Math.min(100, now - last)) % END; last = now; render(t); requestAnimationFrame(frame); };
      render(0);
      pausable(world.parentElement, btn, (run) => {
        if (run && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
        if (!run) running = false;
      });
    }
  }

  /* ---------- the valar recording ---------- */
  $$('[data-loop]').forEach((el) => {
    const btn = $('[data-loop-toggle]', el);
    if (reduce) { btn.textContent = 'play'; }
    let held = reduce;
    const s = { seen: false, hover: false, focus: false };
    const sync = () => {
      const run = s.seen && !s.hover && !s.focus && !held;
      $$('video', el).forEach((v) => (run ? v.play().catch(() => {}) : v.pause()));
      btn.textContent = held ? 'play' : 'pause';
    };
    btn.addEventListener('click', () => { held = !held; sync(); });
    [['pointerenter', 'hover', true], ['pointerleave', 'hover', false], ['focusin', 'focus', true], ['focusout', 'focus', false]].forEach(([t, k, v]) => el.addEventListener(t, () => { s[k] = v; sync(); }));
    seen(el, (on) => { s.seen = on; sync(); }, 0.3);
  });

  /* ---------- ask my cv: keyword retrieval over the CV, no model ---------- */
  const KB = [
    { k: ['roman urdu', 'urdu', 'translit', 'prompt guard', 'multilingual', 'research', 'classifier', 'scanner', 'paper'], src: ['lost in transliteration', '#transliteration'],
      a: "Lost in Transliteration measures how prompt-injection defences fail in Urdu and Roman Urdu. Meta's Prompt Guard 2 (86M) caught 48.5% of English attacks but 11.5% of the same attacks in Roman Urdu (194/400 vs 46/399). I evaluated 6 open-source classifiers on 2,908 inputs, 3 LLMs on 927 tasks each and 6 MCP security scanners on 120 test servers, and I'm now training a small multilingual detector to close the gap." },
    { k: ['agent firewall', 'firewall', 'guardrail', 'wallet', 'tool use', 'tool-using', 'action', 'injection success'], src: ['the agent firewall', '#firewall'],
      a: 'My agent firewall is an action-level guardrail for tool-using agents. On scripted agents under synthetic attack, injection success fell from 22.4% to 0.0% (2 of 16,666 attacked episodes) while it blocked 0.9% of legitimate actions. Wallet drains fell from 97.9% to 0% across 1,102 malicious requests. Next: real Claude agents, and unseen tasks.' },
    { k: ['worldsmith', 'architect', 'level', 'world', 'specification', 'spec gaming', 'godot', 'validator', 'repair', 'in progress', 'current'], src: ['worldsmith', '#worldsmith'],
      a: "Worldsmith is what I'm building now. An AI architect agent repairs a 3D game world so a frozen AI player can finish it. An independent validator rejects patches that cheat (moving the goal, changing player physics, adding teleports), the room rebuilds from a bounded JSON grammar, and the same player retries. It's evaluated against equal-budget baselines (random patches, Claude Haiku, Sonnet and Opus, a local Gemma), with a safety layer for specification gaming and prompt injection hidden in 3D assets." },
    { k: ['valar', 'gateway', 'pii', 'redact', 'dlp', 'proxy', 'secret', 'company', 'startup', 'founder', 'enterprise'], src: ['valar', '#valar'],
      a: "I founded Valar in April 2026. It's an OpenAI-compatible AI traffic firewall between a company's staff, apps and agents and its LLM providers. It detects secrets, personal data and prompt injection in English, Urdu and Roman Urdu, applies a policy (observe, alert, redact, block, require approval) and keeps metadata-only audit logs." },
    { k: ['autopilot', 'open source', 'open-source', 'pull request', ' pr', 'github', 'contribut', 'upstream', 'merged'], src: ['the bench', '#bench'],
      a: "Three of my pull requests were merged into ramenvr/autopilot's staging branch on 7 Nov 2026: #40 roblox-mcp (a plugin-free Roblox Studio connector), #38 autopilot regress (model-free replay of confirmed results) and #39 evolve (an autoresearch loop over the prompt, kit and constants)." },
    { k: ['fine-tun', 'finetun', 'fine tun', 'lora', 'qlora', 'dgx', 'spark', 'vllm', 'gemma', 'local model', 'train', 'gpu', 'lab', 'open-weight', 'unsloth'], src: ['the bench', '#bench'],
      a: 'Yes. I run a personal lab on an NVIDIA DGX Spark (Grace Blackwell, 128 GB unified memory). I fine-tune open-weight models with LoRA and QLoRA (PyTorch, Transformers, PEFT, TRL, Unsloth) and serve them with vLLM, including Gemma 4 31B as a local teacher model. I also built JzLab (steers Claude Code agents over SSH), spark-lab (a self-healing GPU job queue), spark-one (a calibrated small decision model) and Scam Radar (an on-device scam checker).' },
    { k: ['game', 'roblox', 'nfl', 'unity', 'vr', 'quest', 'remio', 'voldex', 'luau', 'unreal', 'ship'], src: ['the games portfolio', 'https://jehanzeb.xyz/'],
      a: 'Before AI I shipped real-time games for 5+ years. At Voldex I worked on NFL Universe Football on Roblox (400k+ daily active users) in Luau. At Remio I spent four years building Unity VR worlds for 100k+ monthly users, published 15+ experiences to the Meta Store and cut loading times by 25%.' },
    { k: ['tableside', 'menu', 'restaurant', 'photo', '3d model', 'pipeline', 'ar '], src: ['tableside.pk', 'https://tableside.pk/'],
      a: "I founded TableSide in July 2026. A fully automated pipeline turns phone photos of a dish into a 3D model for AR menus in about 10 minutes, with no manual input. We launched Asia's first AR menus with 5+ restaurant brands: 130+ dishes modelled and 4,000 diner scans in 4 weeks, at under $20 per menu per month." },
    { k: ['relocat', 'remote', 'visa', 'move', 'where', 'based', 'karachi', 'location', 'timezone', 'time zone'], src: ['email me', 'mailto:jehanzebali111@gmail.com'],
      a: "I'm based in Karachi, Pakistan, and open to remote work or relocation." },
    { k: ['stack', 'skill', 'python', 'typescript', 'pytorch', 'tools', 'rag', 'agent sdk', 'mcp', 'eval', 'red-team', 'red team'], src: ['the ai cv', '/cv/Jehanzeb-Ali-CV-Applied-AI.pdf'],
      a: 'Python, TypeScript, PyTorch, Hugging Face (Transformers, PEFT, TRL), vLLM, Unsloth, LoRA and QLoRA, MCP, the Claude Agent SDK, and the Anthropic, OpenAI and Google APIs. For evals and safety: eval-set design, held-out splits and baselines, calibration, red-teaming, prompt-injection detection, guardrails, PII redaction and audit logging.' },
    { k: ['degree', 'education', 'university', 'study', 'studied', 'staffordshire', 'bsc', 'graduat'], src: ['the ai cv', '/cv/Jehanzeb-Ali-CV-Applied-AI.pdf'],
      a: 'BSc (Hons) Games Design and Programming, Staffordshire University, graduated June 2020.' },
    { k: ['speak', 'native', 'fluent', 'english'], src: ['lost in transliteration', '#transliteration'],
      a: "Urdu and Roman Urdu are native for me, and my English is fluent. It's why I test guardrails in the scripts people here actually type." },
    { k: ['hire', 'contact', 'email', 'reach', ' cv', 'resume', 'available', 'interview'], src: ['email me', 'mailto:jehanzebali111@gmail.com'],
      a: 'Email me at jehanzebali111@gmail.com, or download the AI CV from the top of this page.' },
  ];
  const ask = $('[data-ask]'), thread = $('[data-ask-thread]');
  if (ask) {
    const input = $('input', ask), submit = $('button', ask);
    let busy = false;
    const answer = (q) => {
      const t = ` ${q.toLowerCase()} `;
      let best = null, score = 0;
      KB.forEach((e) => { const sc = e.k.reduce((n, k) => n + (t.includes(k) ? k.length : 0), 0); if (sc > score) { score = sc; best = e; } });
      return best || { a: "That isn't in my CV, so I won't guess. Ask me directly at jehanzebali111@gmail.com.", src: ['email me', 'mailto:jehanzebali111@gmail.com'] };
    };
    const send = (q) => {
      q = q.trim(); if (!q || busy) return;
      busy = true; submit.disabled = true;
      const item = document.createElement('div'); item.className = 'qa';
      const qe = document.createElement('p'); qe.className = 'qa__q'; qe.textContent = q;
      const ae = document.createElement('p'); ae.className = 'qa__a';
      item.append(qe, ae); thread.prepend(item);
      while (thread.children.length > 3) thread.lastElementChild.remove();
      const { a, src } = answer(q);
      const finish = () => {
        ae.textContent = a;
        const s = document.createElement('p'); s.className = 'qa__src readout';
        const link = document.createElement('a'); link.href = src[1]; link.textContent = src[0];
        s.append('from ', link); item.appendChild(s);
        busy = false; submit.disabled = false; item.removeAttribute('aria-busy');
      };
      item.setAttribute('aria-busy', 'true');
      if (reduce) return finish();
      ae.classList.add('is-typing');
      let i = 0;
      const tick = () => { i = Math.min(a.length, i + 3); ae.textContent = a.slice(0, i); if (i < a.length) setTimeout(tick, 14); else { ae.classList.remove('is-typing'); finish(); } };
      tick();
    };
    ask.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); input.value = ''; });
    $$('[data-ask-chips] .chip').forEach((c) => c.addEventListener('click', () => send(c.textContent)));
  }

  /* ---------- command palette: ctrl or cmd + k ---------- */
  const pal = $('[data-palette]');
  if (pal) {
    const q = $('[data-palette-q]', pal), items = $$('[data-palette-list] li', pal), empty = $('[data-palette-empty]', pal);
    let cur = 0;
    const shown = () => items.filter((li) => !li.hidden);
    const mark = () => { const v = shown(); items.forEach((li) => li.classList.remove('is-on')); v.forEach((li, i) => li.classList.toggle('is-on', i === cur)); empty.hidden = v.length > 0; };
    const open = () => { q.value = ''; items.forEach((li) => (li.hidden = false)); cur = 0; mark(); pal.showModal(); q.focus(); };
    $$('[data-cmd-open]').forEach((b) => b.addEventListener('click', open));
    addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.open ? pal.close() : open(); } });
    q.addEventListener('input', () => { const t = q.value.trim().toLowerCase(); items.forEach((li) => (li.hidden = !li.textContent.toLowerCase().includes(t))); cur = 0; mark(); });
    q.addEventListener('keydown', (e) => {
      const v = shown();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!v.length) return; cur = (cur + (e.key === 'ArrowDown' ? 1 : v.length - 1)) % v.length; mark(); v[cur].scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'Enter') { e.preventDefault(); const a = v[cur] && $('a', v[cur]); if (a) { pal.close(); a.click(); } }
    });
    $$('a', pal).forEach((a) => a.addEventListener('click', () => pal.close()));
    pal.addEventListener('click', (e) => { if (e.target === pal) pal.close(); });
  }
})();
