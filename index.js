// Graphix : tracer des fonctions et changer leurs paramètres en direct. Un analyseur d'expressions maison (pas d'eval), jusqu'à 6 courbes,
// les curseurs a, b, c, le temps t qui s'anime, la dérivée, les zéros, les extremums et les intersections, une table de valeurs et l'export en PNG.
const CSS = `
.gxGrid{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px}
@media (max-width:900px){.gxGrid{grid-template-columns:minmax(0,1fr)}}
.gxFn{display:grid;grid-template-columns:18px 34px minmax(0,1fr) 30px 30px;gap:4px;align-items:center;margin:4px 0}
.gxFn .f{font:15px monospace;min-width:0}
.gxFn .f.bad{outline:2px solid #e05a5a}
.gxDot{width:14px;height:14px;border:2px solid #000;cursor:var(--cp,pointer)}
.gxDot.off{opacity:.25}
.gxName{font:14px monospace;color:var(--muted)}
.gxSl{display:grid;grid-template-columns:22px minmax(0,1fr) 54px;gap:6px;align-items:center;font:14px monospace;margin:4px 0}
.gxSl input[type=range]{width:100%;-webkit-appearance:none;appearance:none;height:10px;background:var(--bg0);border:2px solid var(--line);outline:none;margin:0}
.gxSl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:22px;background:var(--magenta);border:2px solid #000;cursor:var(--cp,pointer)}
.gxSl .btn{justify-self:start}
.gxCan{width:100%;aspect-ratio:16/10;display:block;background:#0b0816;border:2px solid var(--line);image-rendering:pixelated;cursor:grab;touch-action:none}
.gxCan.drag{cursor:grabbing}
.gxRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.gxInfo{font:13px monospace;color:var(--lilac);min-height:18px;margin-top:6px;white-space:pre-wrap}
.gxPts{font:13px monospace;max-height:200px;overflow:auto;margin-top:6px}
.gxPts div{padding:2px 0;cursor:var(--cp,pointer)}
.gxPts div:hover{color:#fff}
.gxTable{font:13px monospace;border-collapse:collapse;width:100%}
.gxTable td,.gxTable th{padding:2px 6px;text-align:right;border-bottom:1px solid rgba(255,255,255,.06)}
.gxHelp{font-size:12px;line-height:1.5;color:var(--muted)}
.gxHelp code{color:#ffd34f}
`;
const COLORS = ['#ff4fb0', '#4fc3ff', '#ffd34f', '#6ae06a', '#c07aff', '#ff8a4f'];
const FUNCS = {sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
  min: Math.min, max: Math.max, mod: (a, b) => ((a % b) + b) % b};
const CONSTS = {pi: Math.PI, e: Math.E, 'π': Math.PI};
// une expression -> une fonction (vars) => nombre. Grammaire : somme de produits de puissances, avec multiplication implicite (2x, 3sin(x), (x+1)(x-1))
function compile(src) {
  const toks = [], re = /\s*(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[A-Za-zπ_]\w*|\*\*|[-+*/^(),²³|])/gy; let m, pos = 0;
  // 2,5 -> 2.5, sauf entre les arguments d'une fonction : max(1,2) garde sa virgule ; × ÷ − deviennent * / -
  const stack = []; let s = '';
  for (let k = 0; k < src.length; k++) {
    const ch = src[k];
    if (ch === '(') stack.push(/[A-Za-z]\s*$/.test(src.slice(0, k)) ? 'f' : 'p'); else if (ch === ')') stack.pop();
    s += ch === ',' && /\d/.test(src[k - 1] || '') && /\d/.test(src[k + 1] || '') && stack[stack.length - 1] !== 'f' ? '.' : ch === '×' ? '*' : ch === '÷' ? '/' : ch === '−' ? '-' : ch;
  }
  while (pos < s.length) { re.lastIndex = pos; m = re.exec(s); if (!m) { if (/^\s+$/.test(s.slice(pos))) break; throw new Error('caractère inattendu « ' + s[pos] + ' »'); } toks.push(m[1]); pos = re.lastIndex; }
  let i = 0; const peek = () => toks[i], eat = t => { if (toks[i] !== t) throw new Error(t ? 'il manque « ' + t + ' »' : 'fin inattendue'); i++; };
  const startsAtom = t => t !== undefined && (/^[\d.A-Za-zπ_(|]/.test(t));
  function expr() { let a = term(); while (peek() === '+' || peek() === '-') { const op = toks[i++], b = term(), x = a; a = op === '+' ? v => x(v) + b(v) : v => x(v) - b(v); } return a; }
  function term() {
    let a = unary();
    for (;;) {
      if (peek() === '*' || peek() === '/') { const op = toks[i++], b = unary(), x = a; a = op === '*' ? v => x(v) * b(v) : v => x(v) / b(v); }
      else if (startsAtom(peek()) && peek() !== '|') { const b = power(), x = a; a = v => x(v) * b(v); }  // multiplication implicite
      else return a;
    }
  }
  function unary() { if (peek() === '-') { i++; const a = unary(); return v => -a(v); } if (peek() === '+') { i++; return unary(); } return power(); }
  function power() {
    let a = atom();
    if (peek() === '²') { i++; const x = a; return v => x(v) ** 2; } if (peek() === '³') { i++; const x = a; return v => x(v) ** 3; }
    if (peek() === '^' || peek() === '**') { i++; const b = unary(), x = a; a = v => Math.pow(x(v), b(v)); }  // à droite : 2^3^2 = 2^9
    return a;
  }
  function atom() {
    const t = toks[i++];
    if (t === undefined) throw new Error('expression incomplète');
    if (/^[\d.]/.test(t)) { const n = +t; return () => n; }
    if (t === '(') { const a = expr(); eat(')'); return a; }
    if (t === '|') { const a = expr(); eat('|'); return v => Math.abs(a(v)); }
    if (FUNCS[t]) {
      if (peek() !== '(') { const a = power(); return v => FUNCS[t](a(v)); }  // sin x
      i++; const args = [expr()]; while (peek() === ',') { i++; args.push(expr()); } eat(')');
      const f = FUNCS[t]; return args.length === 1 ? v => f(args[0](v)) : v => f(...args.map(a => a(v)));
    }
    if (t in CONSTS) { const c = CONSTS[t]; return () => c; }
    if (/^[xabct]+$/.test(t)) { const cs = [...t]; return v => cs.reduce((p, c) => p * v[c], 1); }  // ax = a × x
    throw new Error('inconnu : « ' + t + ' »');
  }
  const f = expr(); if (i < toks.length) throw new Error('en trop : « ' + toks[i] + ' »'); return f;
}
const fmt = n => Number.isFinite(n) && Math.abs(n) < 1e-9 ? '0' : !Number.isFinite(n) ? (Number.isNaN(n) ? '—' : n > 0 ? '∞' : '-∞') : Math.abs(n) >= 1e5 || (n && Math.abs(n) < 1e-3) ? n.toExponential(3) : String(Math.round(n * 1e4) / 1e4);
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const { el, toast } = ctx.host;
  ctx.host.addStyle(CSS);
  // vérification : quelques expressions connues
  { const v = {x: 2, a: 3, b: 0, c: 0, t: 0}, ok = (s, r) => Math.abs(compile(s)(v) - r) < 1e-9;
    console.assert(ok('2x^2+1', 9) && ok('3sin(pi/2)', 3) && ok('(x+1)(x-1)', 3) && ok('-x^2', -4) && ok('2^3^2', 512) && ok('|1-a|x', 4) && ok('sqrt x', Math.SQRT2) && ok('max(x,a)', 3) && ok('x²+2,5', 6.5), 'graphix : expressions'); }
  let data = null; try { data = await ctx.folder.read('graphix'); } catch {}
  const st = {fns: data?.fns || [{s: 'a*sin(b*x + t)', on: true}, {s: 'x^2/4 - c', on: true}, {s: '', on: true}], a: data?.a ?? 2, b: data?.b ?? 1, c: data?.c ?? 1,
    cx: data?.cx ?? 0, cy: data?.cy ?? 0, sc: data?.sc ?? 40, deriv: !!data?.deriv, tab: data?.tab || 'pts'};
  let saveT = 0; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => ctx.folder.write('graphix', st).catch(() => {}), 500); };
  let T = 0, playing = false, comp = [];
  view.innerHTML = '';
  const wrap = el('div', 'appWrap'), head = el('div', 'agHead'), grid = el('div', 'gxGrid'), left = el('div', 'sysCard px'), right = el('div');
  head.append(el('span', 'label', 'Graphix · tracer des fonctions')); grid.append(left, right); wrap.append(head, grid); view.append(wrap);
  const fnBox = el('div'), slBox = el('div'), helpEl = el('div', 'gxHelp');
  const addFn = el('button', 'btn px', '+ Fonction'); addFn.onclick = () => { if (st.fns.length >= 6) return toast('6 fonctions au plus'); st.fns.push({s: '', on: true}); save(); drawFns(); fnBox.querySelectorAll('input')[st.fns.length - 1]?.focus(); };
  helpEl.innerHTML = 'Écris avec <code>x</code>, les curseurs <code>a b c</code> et le temps <code>t</code>. Opérations <code>+ - * / ^</code>, <code>2x</code>, <code>|x|</code>, <code>x²</code>. Fonctions <code>sin cos tan sqrt abs ln log exp floor round min max mod</code>, constantes <code>pi e</code>.';
  left.append(el('span', 'label', 'Fonctions'), fnBox, addFn, el('span', 'label', 'Paramètres'), slBox, helpEl);
  const can = el('canvas', 'gxCan'), g = can.getContext('2d'), info = el('div', 'gxInfo'), tools = el('div', 'gxRow'), below = el('div', 'sysCard px'), tabs = el('div', 'gxRow'), tabBody = el('div');
  can.id = 'gx_canvas'; info.id = 'gx_info';
  right.append(can, info, tools, below); below.append(tabs, tabBody);
  function drawFns() {
    comp = []; fnBox.replaceChildren();
    st.fns.forEach((f, k) => {
      const row = el('div', 'gxFn'), dot = el('span', 'gxDot' + (f.on ? '' : ' off')), inp = el('input', 'f'), del = el('button', 'btn px', '×'), up = el('span');
      dot.style.background = COLORS[k]; dot.title = 'Afficher / cacher'; dot.onclick = () => { f.on = !f.on; save(); drawFns(); };
      inp.value = f.s; inp.spellcheck = false; inp.placeholder = 'par exemple x^3 - 2x'; inp.id = 'gx_f' + k;
      const check = () => { try { comp[k] = f.s.trim() ? compile(f.s) : null; inp.classList.remove('bad'); inp.title = ''; } catch (e) { comp[k] = null; inp.classList.add('bad'); inp.title = e.message; } };
      inp.oninput = () => { f.s = inp.value; check(); save(); plot(); drawTab(); };
      del.title = 'Retirer'; del.onclick = () => { st.fns.splice(k, 1); if (!st.fns.length) st.fns.push({s: '', on: true}); save(); drawFns(); };
      check(); row.append(dot, el('span', 'gxName', String.fromCharCode(102 + k) + '(x)'), inp, up, del); fnBox.append(row);
    });
    plot(); drawTab();
  }
  function drawSliders() {
    slBox.replaceChildren();
    for (const p of ['a', 'b', 'c']) {
      const r = el('div', 'gxSl'), sl = el('input'), val = el('input', 'f');
      sl.type = 'range'; sl.min = -10; sl.max = 10; sl.step = .1; sl.value = st[p]; val.value = st[p]; val.id = 'gx_' + p;
      sl.oninput = () => { st[p] = +sl.value; val.value = sl.value; save(); plot(); drawTab(); };
      val.oninput = () => { const v = parseFloat(val.value.replace(',', '.')); if (Number.isFinite(v)) { st[p] = v; sl.value = v; save(); plot(); drawTab(); } };
      r.append(el('span', '', p), sl, val); slBox.append(r);
    }
    const r = el('div', 'gxSl'), play = el('button', 'btn px', '▶'), tv = el('span', 'hint', 't = 0');
    play.title = 'Animer le temps t'; play.onclick = () => { playing = !playing; play.textContent = playing ? '❚❚' : '▶'; if (playing) loop(); };
    r.append(el('span', '', 't'), play, tv); slBox.append(r); tvEl = tv;
  }
  let tvEl = null, last = 0;
  const loop = now => { if (!playing) return; if (last && now) T += Math.min(.1, (now - last) / 1000); last = now || 0; if (tvEl) tvEl.textContent = 't = ' + T.toFixed(1); plot(); requestAnimationFrame(loop); };
  const vars = x => ({x, a: st.a, b: st.b, c: st.c, t: T});
  const evalF = (k, x) => { try { return comp[k](vars(x)); } catch { return NaN; } };
  const deriv = (k, x) => { const h = 1e-4 * Math.max(1, Math.abs(x)); return (evalF(k, x + h) - evalF(k, x - h)) / (2 * h); };
  // l'écran : 1 unité = st.sc pixels du canevas, centré en (cx, cy)
  let W = 640, H = 400, hover = null;
  const sx = x => W / 2 + (x - st.cx) * st.sc, sy = y => H / 2 - (y - st.cy) * st.sc, wx = px => st.cx + (px - W / 2) / st.sc, wy = py => st.cy - (py - H / 2) / st.sc;
  function niceStep() { const raw = 80 / st.sc, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  function plot() {
    const r = can.getBoundingClientRect(); if (r.width) { W = Math.round(r.width); H = Math.round(r.width * 10 / 16); if (can.width !== W) { can.width = W; can.height = H; } }
    g.fillStyle = '#0b0816'; g.fillRect(0, 0, W, H);
    const step = niceStep(), x0 = wx(0), x1 = wx(W), y0 = wy(H), y1 = wy(0);
    g.lineWidth = 1; g.font = '11px monospace'; g.fillStyle = '#6a5a8a';
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { const p = Math.round(sx(x)) + .5; g.strokeStyle = Math.abs(x) < step / 2 ? '#8a7aa8' : '#1e1834'; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, H); g.stroke(); if (Math.abs(x) > step / 2) g.fillText(fmt(x), p + 3, Math.min(H - 4, Math.max(12, sy(0) + 13))); }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { const p = Math.round(sy(y)) + .5; g.strokeStyle = Math.abs(y) < step / 2 ? '#8a7aa8' : '#1e1834'; g.beginPath(); g.moveTo(0, p); g.lineTo(W, p); g.stroke(); if (Math.abs(y) > step / 2) g.fillText(fmt(y), Math.min(W - 40, Math.max(3, sx(0) + 4)), p - 3); }
    st.fns.forEach((f, k) => {
      if (!f.on || !comp[k]) return;
      for (const d of st.deriv ? [false, true] : [false]) {
        g.strokeStyle = COLORS[k]; g.lineWidth = d ? 1 : 2; g.setLineDash(d ? [4, 4] : []); g.beginPath(); let pen = false, prev = null;
        for (let px = 0; px <= W; px++) {
          const x = wx(px), y = d ? deriv(k, x) : evalF(k, x), py = sy(y);
          if (!Number.isFinite(y) || Math.abs(py) > 1e5 || (prev !== null && Math.abs(py - prev) > H * 2)) { pen = false; prev = Number.isFinite(py) ? py : null; continue; }  // trou ou asymptote : on lève le crayon
          if (pen) g.lineTo(px, py); else g.moveTo(px, py); pen = true; prev = py;
        }
        g.stroke();
      }
    });
    g.setLineDash([]);
    if (hover != null) {
      const x = wx(hover); g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(hover + .5, 0); g.lineTo(hover + .5, H); g.stroke();
      const parts = ['x = ' + fmt(x)];
      st.fns.forEach((f, k) => { if (!f.on || !comp[k]) return; const y = evalF(k, x); parts.push(String.fromCharCode(102 + k) + ' = ' + fmt(y)); if (Number.isFinite(y)) { g.fillStyle = COLORS[k]; g.fillRect(Math.round(hover) - 3, Math.round(sy(y)) - 3, 7, 7); } });
      info.textContent = parts.join('   ');
    } else info.textContent = 'Glisse pour te déplacer, molette pour zoomer, survole pour lire les valeurs.';
    for (const p of marks) { g.fillStyle = '#fff'; g.fillRect(Math.round(sx(p.x)) - 2, Math.round(sy(p.y)) - 2, 5, 5); }
  }
  let marks = [];
  // les points remarquables dans la zone visible : zéros (changement de signe), extremums (la dérivée change de signe), intersections deux à deux
  function points() {
    const out = [], N = 800, x0 = wx(0), x1 = wx(W), dx = (x1 - x0) / N;
    const refine = (fn, a, b) => { let fa = fn(a); for (let it = 0; it < 60; it++) { const m = (a + b) / 2, fm = fn(m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; } return (a + b) / 2; };
    const scan = (fn, kind, k, k2) => { let pa = fn(x0); for (let i = 1; i <= N && out.length < 60; i++) { const xb = x0 + i * dx, pb = fn(xb); if (Number.isFinite(pa) && Number.isFinite(pb) && Math.sign(pa) !== Math.sign(pb) && Math.abs(pa - pb) < 1e3 * (1 + Math.abs(pa))) { const x = refine(fn, xb - dx, xb); out.push({kind, k, k2, x, y: evalF(k, x)}); } pa = pb; } };
    st.fns.forEach((f, k) => { if (!f.on || !comp[k]) return; scan(x => evalF(k, x), 'zéro', k); scan(x => deriv(k, x), 'extremum', k); });
    for (let k = 0; k < st.fns.length; k++) for (let k2 = k + 1; k2 < st.fns.length; k2++) if (st.fns[k].on && st.fns[k2].on && comp[k] && comp[k2]) scan(x => evalF(k, x) - evalF(k2, x), 'intersection', k, k2);
    for (const p of out) if (p.kind === 'extremum') p.kind = deriv(p.k, p.x - 1e-3) > 0 ? 'maximum' : 'minimum';
    return out.sort((a, b) => a.x - b.x).filter((p, i, all) => !all.slice(0, i).some(q => q.kind === p.kind && q.k === p.k && q.k2 === p.k2 && Math.abs(q.x - p.x) < dx * 2));  // un zéro pile sur un point d'échantillon est vu deux fois
  }
  const TABS = [['pts', 'Points remarquables'], ['table', 'Table de valeurs']];
  function drawTab() {
    tabs.replaceChildren(...TABS.map(([k, t]) => { const b = el('button', 'btn px' + (st.tab === k ? ' main' : ''), t); b.onclick = () => { st.tab = k; save(); drawTab(); }; return b; }));
    if (st.tab === 'pts') {
      const ps = points(), l = el('div', 'gxPts'); l.id = 'gx_pts'; marks = ps;
      if (!ps.length) l.append(el('span', 'hint', 'Aucun zéro, extremum ou intersection dans la zone visible.'));
      for (const p of ps) { const d = el('div', '', (p.kind === 'intersection' ? 'intersection ' + String.fromCharCode(102 + p.k) + ' et ' + String.fromCharCode(102 + p.k2) : p.kind + ' de ' + String.fromCharCode(102 + p.k)) + ' : (' + fmt(p.x) + ' ; ' + fmt(p.y) + ')'); d.style.color = COLORS[p.k]; d.onclick = () => { st.cx = p.x; st.cy = p.y; save(); drawTab(); }; l.append(d); }
      tabBody.replaceChildren(l);
    } else {
      marks = [];
      const t = el('table', 'gxTable'), hr = el('tr'), step = niceStep() / 2, start = Math.ceil(wx(0) / step) * step; hr.append(el('th', '', 'x'));
      const on = st.fns.map((f, k) => f.on && comp[k] ? k : -1).filter(k => k >= 0);
      for (const k of on) { const th = el('th', '', String.fromCharCode(102 + k) + '(x)'); th.style.color = COLORS[k]; hr.append(th); }
      t.append(hr);
      for (let x = start, n = 0; x <= wx(W) && n < 40; x += step, n++) { const tr = el('tr'); tr.append(el('td', '', fmt(x))); for (const k of on) tr.append(el('td', '', fmt(evalF(k, x)))); t.append(tr); }
      tabBody.replaceChildren(t);
    }
    plot();
  }
  for (const [t, tip, fn] of [['−', 'Dézoomer', () => st.sc = Math.max(2, st.sc / 1.5)], ['+', 'Zoomer', () => st.sc = Math.min(5000, st.sc * 1.5)], ['⌂', 'Revenir au centre', () => { st.cx = 0; st.cy = 0; st.sc = 40; }]]) {
    const b = el('button', 'btn px', t); b.title = tip; b.onclick = () => { fn(); save(); drawTab(); }; tools.append(b);
  }
  const dv = el('button', 'btn px' + (st.deriv ? ' main' : ''), 'Dérivées en pointillés'); dv.onclick = () => { st.deriv = !st.deriv; dv.classList.toggle('main', st.deriv); save(); plot(); };
  const png = el('button', 'btn px', 'Exporter en PNG'); png.onclick = () => { const a = document.createElement('a'); a.href = can.toDataURL('image/png'); a.download = 'graphix.png'; a.click(); };
  tools.append(dv, png);
  let drag = null;
  can.onpointerdown = e => { drag = {x: e.clientX, y: e.clientY, cx: st.cx, cy: st.cy}; can.setPointerCapture(e.pointerId); can.classList.add('drag'); };
  can.onpointermove = e => {
    const r = can.getBoundingClientRect(), k = W / r.width;
    if (drag) { st.cx = drag.cx - (e.clientX - drag.x) * k / st.sc; st.cy = drag.cy + (e.clientY - drag.y) * k / st.sc; hover = null; plot(); return; }
    hover = (e.clientX - r.left) * k; plot();
  };
  can.onpointerup = () => { if (drag) { drag = null; can.classList.remove('drag'); save(); drawTab(); } };
  can.onpointerleave = () => { hover = null; plot(); };
  can.addEventListener('wheel', e => { e.preventDefault(); const r = can.getBoundingClientRect(), k = W / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, x = wx(px), y = wy(py);
    st.sc = Math.min(5000, Math.max(2, st.sc * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); st.cx = x - (px - W / 2) / st.sc; st.cy = y + (py - H / 2) / st.sc; save(); plot(); clearTimeout(can._t); can._t = setTimeout(drawTab, 200); }, {passive: false});
  new ResizeObserver(() => plot()).observe(can);
  ctx.onClose?.(() => { playing = false; });
  drawSliders(); drawFns();
}
