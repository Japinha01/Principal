/* ============================================================
   FUNDIÇÃO 7 — cola de tudo: laço do jogo, interface e controles
   ============================================================ */
import { Game, randomSeed, recipeById } from './sim.js';
import { View, makeIcons, wx, wz } from './render.js';
import { Audio } from './audio.js';
import * as L from './i18n.js';
import { MACHINES, BUILD_GROUPS, RECIPES, ERAS, UPGRADES, ORES, C, MAX_ERA, DX, DY } from './data.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'f7-save-v2';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ui = () => L.S().ui;
const isTouch = matchMedia('(pointer: coarse)').matches;

let game = null, view = null, icons = null;
const audio = new Audio();
let playing = false;
let tool = null, dir = 0, dirManual = false, hover = null, selId = null;
let newUnlocks = new Set();
let shownCoins = 0;
let pointerUntil = 0;
let lastHintKey = '';

/* quando cada máquina libera (era e se vem de um marco) */
const UNLOCK_AT = {};
ERAS.forEach((E, e) => {
  if (!E) return;
  E.unlock.forEach((m) => (UNLOCK_AT[m] ??= { era: e }));
  E.goals.forEach((g) => (g.unlock || []).forEach((m) => (UNLOCK_AT[m] ??= { era: e, goal: true })));
});
const KEYMAP = {};
for (const [m, M] of Object.entries(MACHINES)) if (M.key) KEYMAP[M.key.toLowerCase()] = m;

/* ============================================================ início */
function boot() {
  L.setLang(L.detectLang());
  view = new View($('c'));
  icons = makeIcons();
  const saved = readSave();
  game = saved ? safeLoad(saved) : null;
  view.setGame(game || new Game(randomSeed()), icons);
  view.cam.gdist = view.cam.dist = 30;
  applyTexts();
  titleScreen();
  addEventListener('resize', () => view.resize());
  bindInput();
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    tick(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  setInterval(() => playing && save(), 15000);
  addEventListener('visibilitychange', () => { if (document.hidden && playing) save(); });
  addEventListener('pagehide', () => playing && save());
}

function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
}
function safeLoad(s) { try { return Game.load(s); } catch (e) { return null; } }
function save(showToast) {
  if (!game) return;
  try {
    const s = game.serialize();
    s.savedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    if (showToast) toast(ui().saved);
  } catch (e) { /* armazenamento cheio ou bloqueado */ }
}

/* ============================================================ título */
function titleScreen() {
  $('title').hidden = false;
  const s = readSave();
  const canContinue = !!(s && safeLoad(s));
  $('tContinue').hidden = !canContinue;
  $('tContinue').onclick = () => { audio.unlock(); audio.play('click'); startGame(safeLoad(readSave()), readSave()); };
  $('tNew').onclick = () => {
    audio.unlock();
    audio.play('click');
    if (canContinue && !confirm(ui().confirmNew)) return;
    startGame(new Game(randomSeed()), null);
  };
  document.querySelectorAll('#tLang button').forEach((b) => {
    b.onclick = () => { setLanguage(b.dataset.l); titleScreen(); };
  });
}

function startGame(g, savedObj) {
  game = g;
  view.setGame(game, icons);
  $('title').hidden = true;
  ['top', 'goal', 'bar', 'quick'].forEach((id) => { $(id).hidden = false; });
  playing = true;
  tool = null; selId = null; newUnlocks = new Set();
  shownCoins = game.coins;
  if (savedObj && savedObj.savedAt && savedObj.revenue > 0) {
    const min = Math.min(120, (Date.now() - savedObj.savedAt) / 60000);
    if (min > 1) {
      const bonus = Math.round(min * savedObj.revenue * 0.5);
      if (bonus > 0) { game.coins += bonus; setTimeout(() => toast(L.fmt(ui().away, { v: L.money(bonus) })), 600); }
    }
  }
  renderBar();
  renderGoal();
  closeInspect();
  save();
}

function setLanguage(l) {
  L.setLang(l);
  try { localStorage.setItem('f7-lang', l); } catch (e) { /* ok */ }
  applyTexts();
  if (playing) { renderBar(); renderGoal(); if (selId) renderInspect(); }
}
function applyTexts() {
  document.documentElement.lang = L.lang === 'pt' ? 'pt-BR' : 'en';
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = ui()[el.dataset.t] || ''; });
  $('tTag').textContent = ui().tapToStart;
  $('tContinue').textContent = ui().continue;
  $('tNew').textContent = readSave() ? ui().newGame : ui().play;
  $('tCtl').textContent = isTouch ? ui().ctlTouch : ui().ctlDesk;
  document.querySelectorAll('#tLang button').forEach((b) => b.classList.toggle('on', b.dataset.l === L.lang));
}

/* ============================================================ laço */
let uiTimer = 0, coinAcc = 0, coinTimer = 0;
const keysDown = new Set();
function tick(dt) {
  if (!playing) {
    view.cam.gaz += dt * 0.08;
    view.frame(dt);
    return;
  }
  game.update(dt);
  handleEvents();
  // câmera pelo teclado
  const kp = 700 * dt;
  if (keysDown.has('w') || keysDown.has('arrowup')) view.pan(0, kp);
  if (keysDown.has('s') || keysDown.has('arrowdown')) view.pan(0, -kp);
  if (keysDown.has('a') || keysDown.has('arrowleft')) view.pan(kp, 0);
  if (keysDown.has('d') || keysDown.has('arrowright')) view.pan(-kp, 0);

  // moedinhas voando da Sede
  coinTimer -= dt;
  if (coinAcc > 0 && coinTimer <= 0) {
    floatText('+' + L.money(coinAcc), wx(C) + (Math.random() - 0.5) * 1.2, 2.2, wz(C) + (Math.random() - 0.5) * 1.2);
    coinAcc = 0;
    coinTimer = 0.4;
  }
  shownCoins += (game.coins - shownCoins) * Math.min(1, dt * 8);
  if (Math.abs(game.coins - shownCoins) < 1) shownCoins = game.coins;

  uiTimer -= dt;
  if (uiTimer <= 0) { uiTimer = 0.2; refreshUI(); }
  view.frame(dt);
}

function handleEvents() {
  const evs = game.ev;
  if (!evs.length) return;
  game.ev = [];
  const eraInBatch = evs.some((e) => e.t === 'era' || e.t === 'victory');
  for (const e of evs) {
    view.onEvent(e);
    switch (e.t) {
      case 'deliver': coinAcc += e.v; if (e.v) audio.play('coin'); break;
      case 'goal':
        e.unlocks.forEach((u) => newUnlocks.add(u));
        view.fx.confetti(wx(C), 2.4, wz(C), 80);
        if (!eraInBatch) { audio.play('goal'); banner(e); }
        renderBar();
        renderGoal();
        break;
      case 'era':
        e.unlocks.forEach((u) => newUnlocks.add(u));
        audio.play('era');
        renderBar();
        renderGoal();
        setTimeout(() => eraModal(e), 1400);
        save();
        break;
      case 'victory':
        closeInspect();
        setTool(null);
        audio.play('launch');
        setTimeout(() => view.startLaunch(() => { audio.play('victory'); victoryModal(); }), 400);
        renderGoal();
        save();
        break;
    }
  }
}

/* ============================================================ topo */
function refreshUI() {
  $('coins').textContent = L.money(shownCoins);
  $('rev').textContent = game.revenue > 0 ? `+${L.money(game.revenue)}${ui().perMin}` : '';
  const pw = game.power;
  $('power').hidden = !game.powerOn;
  if (game.powerOn) {
    $('ptext').textContent = `${Math.round(pw.demand)}/${Math.round(pw.supply)} MW`;
    $('pbar').classList.toggle('low', pw.ratio < 0.999);
    $('pbar').firstElementChild.style.width = (pw.supply ? Math.min(100, pw.demand / pw.supply * 100) : 100) + '%';
  }
  // barra: o que dá para pagar
  document.querySelectorAll('#bar .bb[data-m]').forEach((b) => {
    const m = b.dataset.m;
    b.classList.toggle('poor', game.unlocked.has(m) && game.coins < MACHINES[m].cost);
  });
  const up = Object.keys(UPGRADES).some((k) => { const U = UPGRADES[k], lv = game.up[k]; return lv < U.cost.length && game.era >= U.minEra[lv] && game.coins >= U.cost[lv]; });
  $('btnUp').classList.toggle('glow', up);
  updateGoal();
  if (selId) renderInspect(true);
}

/* ============================================================ barra de construção */
function renderBar() {
  const bar = $('bar');
  let html = `<button class="bb tool${tool === 'remove' ? ' sel' : ''}" data-tool="remove" title="X"><span class="ico">🗑</span><span class="cost">${esc(ui().remove)}</span></button><div class="sep"></div>`;
  let first = true;
  BUILD_GROUPS.forEach((G) => {
    // mostra o que já liberou e só uma espiadinha do que vem logo em seguida (esta era ou a próxima)
    const items = G.items.filter((m) => game.unlocked.has(m) || (UNLOCK_AT[m] && UNLOCK_AT[m].era <= game.era + 1));
    if (!items.length) return;
    if (!first) html += '<div class="sep"></div>';
    first = false;
    for (const m of items) {
      const M = MACHINES[m], un = game.unlocked.has(m);
      const lock = UNLOCK_AT[m] || { era: 1 };
      const cls = ['bb', un ? '' : 'locked', tool === m ? 'sel' : '', newUnlocks.has(m) ? 'new' : ''].join(' ');
      const label = un ? L.money(M.cost) : (lock.era > game.era ? L.fmt(ui().lockedEra, { n: lock.era }) : ui().lockedGoal);
      html += `<button class="${cls}" data-m="${m}"><img src="${icons.url[m]}" alt="">${un && !isTouch ? `<span class="key">${M.key}</span>` : ''}<span class="cost">${esc(label)}</span></button>`;
    }
  });
  bar.innerHTML = html;
  bar.querySelectorAll('.bb').forEach((b) => {
    b.onclick = () => {
      audio.unlock();
      if (b.dataset.tool) { setTool(tool === 'remove' ? null : 'remove'); return; }
      const m = b.dataset.m;
      if (!game.unlocked.has(m)) { audio.play('error'); return; }
      newUnlocks.delete(m);
      b.classList.remove('new');
      setTool(tool === m ? null : m);
    };
    if (!isTouch) {
      b.onmouseenter = () => showTip(b);
      b.onmouseleave = () => { $('tip').hidden = true; };
    }
  });
  highlightHinted();
}

function recipeLine(r, locked) {
  const ins = Object.entries(r.in).map(([k, n]) => `${n > 1 ? n + '×' : ''}<img src="${icons.url[k]}" title="${esc(L.itemName(k))}">`).join(' + ');
  return `<div class="rc${locked ? ' muted' : ''}">${ins} → ${r.q > 1 ? r.q + '×' : ''}<img src="${icons.url[r.out]}" title="${esc(L.itemName(r.out))}"> <span class="muted">${esc(L.itemName(r.out))}${locked ? ' · ' + L.fmt(ui().needEra, { n: r.era }) : ''}</span></div>`;
}

function showTip(b) {
  const tip = $('tip');
  if (b.dataset.tool) { tip.innerHTML = `<h4>${esc(ui().remove)}</h4><div class="muted">X · ${esc(L.lang === 'pt' ? 'devolve 100% das moedas' : 'refunds 100% of the coins')}</div>`; }
  else {
    const m = b.dataset.m, M = MACHINES[m];
    let h = `<h4>${esc(L.mName(m))}</h4><div>${esc(L.mDesc(m))}</div>`;
    const rs = RECIPES.filter((r) => r.m === m);
    rs.forEach((r) => { h += recipeLine(r, r.era > game.era); });
    if (M.kind === 'mine') h += `<div class="rc">${M.ores.map((o) => `<img src="${icons.url[ORES[o]]}" title="${esc(L.itemName(ORES[o]))}">`).join('')}</div>`;
    const extra = [];
    if (M.pw && game.powerOn) extra.push(`⚡ ${M.pw} MW`);
    if (M.out) extra.push(`⚡ +${M.out} MW`);
    if (!game.unlocked.has(m)) {
      const lock = UNLOCK_AT[m] || {};
      extra.push(lock.era > game.era ? L.fmt(ui().needEra, { n: lock.era }) : ui().lockedGoal);
    }
    if (extra.length) h += `<div class="muted" style="margin-top:6px;font-weight:600">${extra.join(' · ')}</div>`;
    tip.innerHTML = h;
  }
  tip.hidden = false;
  const r = b.getBoundingClientRect();
  tip.style.left = Math.max(8, Math.min(innerWidth - 268, r.left + r.width / 2 - 130)) + 'px';
  tip.style.top = (r.top - tip.offsetHeight - 10) + 'px';
}

function setTool(t) {
  tool = t;
  dirManual = false;
  if (t && t !== 'remove') closeInspect();
  document.querySelectorAll('#bar .bb').forEach((b) => b.classList.toggle('sel', (b.dataset.m || b.dataset.tool) === t && !!t));
  view.setGhost(null);
  view.setGhostPath(null);
  $('cursorTip').hidden = true;
  if (hover) updateHover(hover.sx, hover.sy);
}

/* ============================================================ objetivo */
let goalSig = '';
function renderGoal() {
  const g = game.goalDef, box = $('goal');
  const done = game.won;
  let h = '';
  const dots = ERAS[game.era].goals.map((_, i) => `<i class="${i < game.goal || done ? 'on' : i === game.goal ? 'cur' : ''}"></i>`).join('');
  h += `<div class="eh"><span>${esc(ui().era)} ${game.era} · ${esc(L.S().era[game.era])}</span><span class="dots">${dots}</span></div>`;
  if (done || !g) {
    h += `<h3>🚀 ${esc(ui().freePlay)}</h3><div class="body"><div class="hint"><b>💡</b><span>${esc(L.S().hint.hint_free)}</span></div></div>`;
  } else {
    h += `<div style="display:flex;justify-content:space-between;align-items:baseline"><h3>${esc(ui().goal)} ${game.goal + 1} ${esc(ui().of)} ${ERAS[game.era].goals.length}</h3><button id="goalToggle">▾</button></div><div class="body">`;
    for (const it of Object.keys(g.need)) {
      h += `<div class="need" data-it="${it}"><img src="${icons.url[it]}" alt=""><span class="nm">${esc(L.itemName(it))}</span><span class="ct"></span><div class="bar"><i></i></div></div>`;
    }
    const rw = [];
    if (g.reward) rw.push(`<span class="pill"><i class="coin" style="width:18px;height:18px"></i>+${L.money(g.reward)}</span>`);
    (g.unlock || []).forEach((m) => rw.push(`<span class="pill"><img src="${icons.url[m]}">${esc(L.mName(m))}</span>`));
    const last = game.goal === ERAS[game.era].goals.length - 1;
    if (last && game.era < MAX_ERA) rw.push(`<span class="pill">🏝️ ${esc(ui().era)} ${game.era + 1}</span>`);
    if (last && game.era === MAX_ERA) rw.push('<span class="pill">🚀</span>');
    if (rw.length) h += `<div class="reward">${esc(ui().reward)}: ${rw.join('')}</div>`;
    h += '<div class="hint" id="hint"></div></div>';
  }
  box.innerHTML = h;
  const tg = $('goalToggle');
  if (tg) tg.onclick = () => { box.classList.toggle('min'); tg.textContent = box.classList.contains('min') ? '▸' : '▾'; };
  goalSig = '';
  updateGoal();
}

function updateGoal() {
  const g = game.goalDef;
  if (!g || game.won) { view.setPointer(null); return; }
  document.querySelectorAll('#goal .need').forEach((row) => {
    const it = row.dataset.it;
    if (!g.need[it]) { goalSig = ''; renderGoal(); return; }
    const n = Math.min(g.need[it], game.prog[it] || 0);
    row.querySelector('.ct').textContent = `${n}/${g.need[it]}`;
    row.querySelector('.bar i').style.width = (n / g.need[it] * 100) + '%';
    row.classList.toggle('done', n >= g.need[it]);
  });
  const h = game.hint();
  const sig = h.k + JSON.stringify(h.p || {}) + (h.at || '');
  if (sig !== goalSig) {
    goalSig = sig;
    const el = $('hint');
    if (el) {
      el.innerHTML = `<b>💡</b><span>${esc(L.hintText(h))}</span>${h.at ? `<button id="hintGo">${esc(ui().show)}</button>` : ''}`;
      const go = $('hintGo');
      if (go) go.onclick = () => { audio.play('click'); view.focusTile(h.at[0], h.at[1]); pointerUntil = performance.now() + 9000; };
    }
    if (h.k !== lastHintKey && game.era === 1) pointerUntil = performance.now() + 60000;
    lastHintKey = h.k;
    highlightHinted(h);
  }
  const showPtr = h.at && (game.era === 1 && game.goal < 2 || performance.now() < pointerUntil);
  view.setPointer(showPtr ? h.at : null);
}

function highlightHinted(h = game && game.hint()) {
  document.querySelectorAll('#bar .bb').forEach((b) => {
    const m = b.dataset.m;
    const want = h && h.p && h.p.m === m && (h.k === 'hint_build' || h.k === 'hint_mine') && tool !== m;
    const pw = h && (h.k === 'hint_power_build' || h.k === 'hint_power_more') && m === 'gerador';
    b.classList.toggle('hinted', !!(want || pw));
  });
}

/* ============================================================ inspeção */
function openInspect(id) {
  selId = id;
  renderInspect();
  audio.play('click');
}
function closeInspect() { selId = null; $('inspect').hidden = true; document.body.classList.remove('insp'); }
let inspectSig = '';
function renderInspect(soft) {
  const e = game.ents.get(selId);
  if (!e) { closeInspect(); return; }
  const box = $('inspect');
  const M = MACHINES[e.type];
  const stKey = e.kind === 'hub' ? 'ok' : e.st || 'ok';
  const bad = ['noinput', 'blocked', 'nopower', 'nofuel'].includes(stKey);
  let bufs = '';
  if (e.kind === 'machine') {
    const r = e.recipe && recipeById[e.recipe];
    if (r) {
      for (const [k, n] of Object.entries(r.in)) bufs += `<span><img src="${icons.url[k]}">${e.inb[k] || 0}/${n}</span>`;
      bufs += `<span>→ <img src="${icons.url[r.out]}">${e.outb}</span>`;
    }
  } else if (e.kind === 'mine') bufs = `<span><img src="${icons.url[e.item]}">${e.outb}</span>`;
  else if (e.kind === 'generator') bufs = `<span><img src="${icons.url.carvao}">${e.fuel}/10</span>`;
  else if (e.kind === 'pad') bufs = `<span><img src="${icons.url.peca_foguete}">${e.count}</span>`;
  else if (e.kind === 'hub') bufs = `<span>+${L.money(game.revenue)}${ui().perMin}</span>`;
  const sig = [selId, stKey, bufs, e.recipe, L.lang].join('|');
  if (soft && sig === inspectSig) return;
  inspectSig = sig;
  let h = `<div class="h"><img src="${icons.url[e.type]}"><div><h3>${esc(L.mName(e.type))}</h3>`;
  if (e.kind !== 'belt' && e.kind !== 'hub' && e.kind !== 'cross') h += `<span class="st ${bad ? 'bad' : stKey === 'ok' ? '' : 'meh'}">${esc(L.S().st[stKey] || '')}</span>`;
  h += '</div></div>';
  h += `<p class="desc" style="margin:8px 0 0;font-size:14px;color:var(--ink2)">${esc(L.mDesc(e.type))}</p>`;
  if (bufs) h += `<div class="bufs">${bufs}</div>`;
  if (e.kind === 'machine') {
    const rs = game.recipesFor(e.type);
    if (rs.length > 1 || !e.recipe) {
      h += `<div class="rcps"><div style="font-size:13px;font-weight:700;color:var(--ink2)">${esc(ui().recipe)}</div>`;
      for (const r of rs) {
        const ins = Object.entries(r.in).map(([k, n]) => `${n > 1 ? n + '×' : ''}<img src="${icons.url[k]}">`).join('+');
        h += `<button class="rcp${e.recipe === r.id ? ' on' : ''}" data-r="${r.id}">${ins} → <img src="${icons.url[r.out]}"> ${esc(L.itemName(r.out))}<span class="t">${r.t}s</span></button>`;
      }
      h += '</div>';
    }
  }
  if (e.kind !== 'hub') {
    h += `<div class="acts">${e.kind !== 'pad' && e.kind !== 'turbine' ? `<button id="iRot">↻ ${esc(ui().rotate)}</button>` : ''}<button class="del" id="iDel">🗑 ${esc(ui().remove)}</button><button id="iClose" class="x">✕</button></div>`;
  } else h += `<div class="acts"><button id="iClose">✕ ${esc(ui().close)}</button></div>`;
  box.innerHTML = h;
  box.hidden = false;
  document.body.classList.add('insp');
  box.querySelectorAll('.rcp').forEach((b) => { b.onclick = () => { game.setRecipe(e.id, b.dataset.r); audio.play('click'); renderInspect(); }; });
  const rot = $('iRot'); if (rot) rot.onclick = () => { game.rotate(e.x, e.y); audio.play('rotate'); };
  const del = $('iDel'); if (del) del.onclick = () => { game.remove(e.x, e.y); audio.play('remove'); closeInspect(); };
  $('iClose').onclick = closeInspect;
}

/* ============================================================ avisos e janelas */
function toast(msg, err) {
  const t = document.createElement('div');
  t.className = 'toast panel' + (err ? ' err' : '');
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 2600);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}
let bannerTimer = 0;
function banner(e) {
  const b = $('banner');
  const un = e.unlocks.map((m) => `<img src="${icons.url[m]}" title="${esc(L.mName(m))}"> ${esc(L.mName(m))}`).join(' ');
  b.innerHTML = `<h2>⭐ ${esc(ui().goalDone)}</h2><div class="row">${e.reward ? `<i class="coin"></i>+${L.money(e.reward)}` : ''}${un ? ` · ${esc(ui().unlocked)}: ${un}` : ''}</div>`;
  b.hidden = false;
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { b.hidden = true; }, 3400);
}
function floatText(txt, x, y, z) {
  const p = view.project(x, y, z);
  if (!p.vis) return;
  const d = document.createElement('div');
  d.className = 'fl';
  d.textContent = txt;
  d.style.left = p.x + 'px';
  d.style.top = p.y + 'px';
  $('floats').appendChild(d);
  setTimeout(() => d.remove(), 1100);
}
function modal(html, onOpen) {
  $('modalCard').innerHTML = html;
  $('modal').hidden = false;
  onOpen && onOpen($('modalCard'));
}
function closeModal() { $('modal').hidden = true; }
$('modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') closeModal(); });

function eraModal(e) {
  const ores = (e.ores || []).map((o) => `<div><img src="${icons.url[ORES[o]]}">${esc(L.itemName(ORES[o]))}</div>`).join('');
  const un = e.unlocks.map((m) => `<div><img src="${icons.url[m]}">${esc(L.mName(m))}</div>`).join('');
  modal(`<div class="kick">${esc(ui().eraUp)}</div><h2>${esc(ui().era)} ${e.era} · ${esc(L.S().era[e.era])}</h2>
    ${ores ? `<p>${esc(ui().islandGrew)}</p><div class="unl">${ores}</div>` : ''}
    ${un ? `<p><b>${esc(ui().unlocked)}</b></p><div class="unl">${un}</div>` : ''}
    <button class="big" id="mOk">${esc(ui().keepGoing)}</button>`, (c) => {
    c.querySelector('#mOk').onclick = () => { audio.play('click'); closeModal(); };
    audio.play('unlock');
  });
}

function victoryModal() {
  const made = Object.values(game.produced).reduce((a, b) => a + b, 0);
  const deliv = Object.values(game.delivered).reduce((a, b) => a + b, 0);
  const mins = Math.round(game.time / 60);
  const tm = mins >= 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}` : `${mins} min`;
  modal(`<div class="kick">${esc(ui().launchTitle)}</div><h2>🚀 ${esc(ui().victoryTitle)}</h2><p>${esc(ui().victoryText)}</p>
    <div class="stats"><div><b>${tm}</b>${esc(ui().playTime)}</div><div><b>${made.toLocaleString()}</b>${esc(ui().totalMade)}</div><div><b>${deliv.toLocaleString()}</b>${esc(ui().totalEarned)}</div></div>
    <button class="big" id="mOk">${esc(ui().keepPlaying)}</button>`, (c) => {
    view.fx.confetti(wx(C), 3, wz(C), 150, { power: 8 });
    c.querySelector('#mOk').onclick = () => { closeModal(); save(); };
  });
}

function upgradesModal() {
  const render = () => {
    let h = `<h2>⬆ ${esc(ui().upgrades)}</h2><div class="ups">`;
    for (const k of Object.keys(UPGRADES)) {
      const U = UPGRADES[k], lv = game.up[k], max = lv >= U.cost.length;
      const need = !max && game.era < U.minEra[lv];
      const [nm, desc] = L.S().up[k];
      h += `<div class="up"><h4>${esc(nm)}</h4><p>${esc(desc)}</p><div class="pips">${U.cost.map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>`;
      h += `<button data-k="${k}" ${max || need || game.coins < U.cost[lv] ? 'disabled' : ''}>${max ? esc(ui().max) : need ? esc(L.fmt(ui().needEra, { n: U.minEra[lv] })) : `${esc(ui().buy)} · ${L.money(U.cost[lv])}`}</button></div>`;
    }
    h += `</div><button class="big sec" id="mOk">${esc(ui().close)}</button>`;
    return h;
  };
  const bind = (c) => {
    c.querySelectorAll('.up button').forEach((b) => {
      b.onclick = () => {
        if (game.buyUpgrade(b.dataset.k)) { audio.play('unlock'); view.fx.confetti(wx(C), 2, wz(C), 30); }
        $('modalCard').innerHTML = render();
        bind(c);
      };
    });
    c.querySelector('#mOk').onclick = closeModal;
  };
  modal(render(), bind);
}

function menuModal() {
  const seg = (id, a, b, on) => `<div class="seg" id="${id}"><button class="${on ? 'on' : ''}" data-v="1">${a}</button><button class="${on ? '' : 'on'}" data-v="0">${b}</button></div>`;
  modal(`<h2>☰ ${esc(ui().menu)}</h2><div class="menu">
    <div class="line"><span>${esc(ui().language)}</span><div class="seg" id="mLang"><button data-l="pt" class="${L.lang === 'pt' ? 'on' : ''}">PT</button><button data-l="en" class="${L.lang === 'en' ? 'on' : ''}">EN</button></div></div>
    <div class="line"><span>${esc(ui().sound)}</span>${seg('mSfx', esc(ui().on), esc(ui().off), audio.sfxOn)}</div>
    <div class="line"><span>${esc(ui().music)}</span>${seg('mMus', esc(ui().on), esc(ui().off), audio.musicOn)}</div>
    <button class="wide" id="mSave">💾 ${esc(ui().save)}</button>
    <button class="wide" id="mExp">📋 ${esc(ui().export)}</button>
    <button class="wide" id="mImp">📥 ${esc(ui().import)}</button>
    <button class="wide del" id="mNew">🏝️ ${esc(ui().newGame)}</button>
    <small><b>${esc(ui().controls)}:</b> ${esc(isTouch ? ui().ctlTouch : ui().ctlDesk)}</small>
    <small>${esc(ui().seed)}: ${esc(game.seed)}</small>
  </div><button class="big sec" id="mOk">${esc(ui().close)}</button>`, (c) => {
    c.querySelectorAll('#mLang button').forEach((b) => { b.onclick = () => { setLanguage(b.dataset.l); menuModal(); }; });
    c.querySelectorAll('#mSfx button').forEach((b) => { b.onclick = () => { audio.setSfx(b.dataset.v === '1'); menuModal(); }; });
    c.querySelectorAll('#mMus button').forEach((b) => { b.onclick = () => { audio.setMusic(b.dataset.v === '1'); menuModal(); }; });
    c.querySelector('#mSave').onclick = () => { save(true); };
    c.querySelector('#mExp').onclick = async () => {
      save();
      const txt = btoa(unescape(encodeURIComponent(JSON.stringify(game.serialize()))));
      try { await navigator.clipboard.writeText(txt); toast(ui().exported); } catch (e) { prompt(ui().exported, txt); }
    };
    c.querySelector('#mImp').onclick = () => {
      const txt = prompt(ui().importPrompt);
      if (!txt) return;
      try {
        const g = Game.load(JSON.parse(decodeURIComponent(escape(atob(txt.trim())))));
        closeModal();
        startGame(g, null);
      } catch (e) { toast(ui().importBad, true); }
    };
    c.querySelector('#mNew').onclick = () => {
      if (!confirm(ui().confirmNew)) return;
      closeModal();
      startGame(new Game(randomSeed()), null);
    };
    c.querySelector('#mOk').onclick = closeModal;
  });
}

/* ============================================================ controles */
function dirTo(dx, dy) { return dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3; }
function beltPath(a, b, axis) {
  const pts = [{ x: a.x, y: a.y }];
  let x = a.x, y = a.y;
  const sx = Math.sign(b.x - a.x), sy = Math.sign(b.y - a.y);
  const walkX = () => { while (x !== b.x) { x += sx; pts.push({ x, y }); } };
  const walkY = () => { while (y !== b.y) { y += sy; pts.push({ x, y }); } };
  if (axis === 'y') { walkY(); walkX(); } else { walkX(); walkY(); }
  for (let i = 0; i < pts.length; i++) {
    const n = pts[i + 1], p = pts[i - 1];
    pts[i].dir = n ? dirTo(n.x - pts[i].x, n.y - pts[i].y) : p ? dirTo(pts[i].x - p.x, pts[i].y - p.y) : dir;
  }
  return pts;
}

// máquina nova já nasce virada para a esteira vizinha (que não aponte para ela) ou para a Sede
function autoDir(type, x, y) {
  if (dirManual || type === 'esteira') return dir;
  const K = MACHINES[type].kind;
  if (K === 'pad' || K === 'turbine' || K === 'splitter' || K === 'cross') return dir;
  for (let d = 0; d < 4; d++) {
    const n = game.entAt(x + DX[d], y + DY[d]);
    if (!n) continue;
    if (n.kind === 'hub') return d;
    if (n.kind === 'belt' && n.dir !== (d + 2) % 4) {
      // só vale se nenhuma esteira desse lado estiver alimentando esta casa
      return d;
    }
  }
  const dx = C - x, dy = C - y;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
}

function tryPlace(type, x, y, d, quiet) {
  const c = game.canPlace(type, x, y);
  if (!c.ok) {
    if (!quiet) { toast(ui().why[c.why] || c.why, true); audio.play('error'); }
    return false;
  }
  game.place(type, x, y, d);
  if (!quiet) audio.play(type === 'esteira' ? 'belt' : 'place');
  return true;
}

function placePath(path) {
  let n = 0, fail = null;
  for (const p of path) {
    const e = game.entAt(p.x, p.y);
    if (e && e.kind !== 'belt') continue; // esteira passa por dentro de máquinas
    const c = game.canPlace('esteira', p.x, p.y);
    if (!c.ok) { fail = fail || c.why; continue; }
    game.place('esteira', p.x, p.y, p.dir);
    n++;
  }
  if (n) audio.play('belt');
  if (fail && fail !== 'occupied') { toast(ui().why[fail], true); if (!n) audio.play('error'); }
  if (path.length) dir = path[path.length - 1].dir;
}

function updateHover(sx, sy) {
  const t = view.pick(sx, sy);
  hover = t ? { ...t, sx, sy } : { sx, sy };
  const ct = $('cursorTip');
  if (!t || !playing) { view.setGhost(null); ct.hidden = true; return; }
  if (drag && drag.mode === 'belt') return;
  if (tool === 'remove') {
    const e = game.entAt(t.x, t.y);
    view.setGhost('remove', t.x, t.y, 0, !!e && e.kind !== 'hub');
    ct.hidden = true;
  } else if (tool) {
    const c = game.canPlace(tool, t.x, t.y);
    view.setGhost(tool, t.x, t.y, autoDir(tool, t.x, t.y), c.ok);
    if (tool === 'esteira') view.setGhostPath([{ x: t.x, y: t.y, dir }], c.ok);
    if (!c.ok && c.why !== 'occupied' && !isTouch) { ct.textContent = ui().why[c.why]; ct.hidden = false; ct.style.left = sx + 'px'; ct.style.top = sy + 'px'; }
    else ct.hidden = true;
  } else {
    view.setGhost(null, t.x, t.y, 0, true);
    const o = game.oreAt(t.x, t.y);
    if (o && !game.entAt(t.x, t.y) && !isTouch) { ct.textContent = L.itemName(ORES[o]); ct.hidden = false; ct.style.left = sx + 'px'; ct.style.top = sy + 'px'; }
    else ct.hidden = true;
  }
}

let drag = null;
const pointers = new Map();
let pinch = null;
let spaceDown = false;

function bindInput() {
  const cv = $('c');
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (ev) => {
    if (!playing) return;
    audio.unlock();
    cv.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    $('tip').hidden = true;
    if (pointers.size === 2) {
      // dois dedos: cancela o que estava fazendo e vira pan + zoom
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      view.grabStart(pinch.cx, pinch.cy);
      drag = null;
      view.setGhostPath(null);
      return;
    }
    if (pointers.size > 2) return;
    const t = view.pick(ev.clientX, ev.clientY);
    const base = { sx: ev.clientX, sy: ev.clientY, lx: ev.clientX, ly: ev.clientY, t, moved: false };
    if (ev.button === 1 || (ev.button === 0 && spaceDown)) { drag = { ...base, mode: 'pan' }; view.grabStart(ev.clientX, ev.clientY); }
    else if (ev.button === 2) {
      if (tool) { setTool(null); drag = null; return; }
      drag = { ...base, mode: 'remove' };
      if (t) removeAt(t);
    } else if (tool === 'esteira') drag = { ...base, mode: 'belt', start: t, axis: null };
    else if (tool === 'remove') { drag = { ...base, mode: 'remove' }; if (t) removeAt(t); }
    else { drag = { ...base, mode: 'tap' }; view.grabStart(ev.clientX, ev.clientY); }
  });

  cv.addEventListener('pointermove', (ev) => {
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      view.zoom(pinch.d / Math.max(1, d));
      view.grabMove(cx, cy);
      pinch = { d, cx, cy };
      return;
    }
    if (!drag) { if (ev.pointerType === 'mouse') updateHover(ev.clientX, ev.clientY); return; }
    const dist = Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy);
    if (dist > (ev.pointerType === 'mouse' ? 5 : 12)) drag.moved = true;
    if (drag.mode === 'pan' || (drag.mode === 'tap' && drag.moved)) {
      drag.mode = 'pan';
      view.grabMove(ev.clientX, ev.clientY);
    } else if (drag.mode === 'belt' && drag.start) {
      const t = view.pick(ev.clientX, ev.clientY);
      if (t) {
        if (!drag.axis && (t.x !== drag.start.x || t.y !== drag.start.y)) drag.axis = t.x !== drag.start.x ? 'x' : 'y';
        drag.path = beltPath(drag.start, t, drag.axis);
        const ok = drag.path.every((p) => { const e = game.entAt(p.x, p.y); return (e && e.kind !== 'belt') || game.canPlace('esteira', p.x, p.y).ok; });
        view.setGhostPath(drag.path, ok);
        view.setGhost('esteira', t.x, t.y, 0, ok);
      }
    } else if (drag.mode === 'remove') {
      const t = view.pick(ev.clientX, ev.clientY);
      if (t && (!drag.last || drag.last.x !== t.x || drag.last.y !== t.y)) { drag.last = t; removeAt(t, true); }
    }
    drag.lx = ev.clientX; drag.ly = ev.clientY;
    if (ev.pointerType === 'mouse' && drag.mode !== 'belt') updateHover(ev.clientX, ev.clientY);
  });

  const up = (ev) => {
    pointers.delete(ev.pointerId);
    view.grabEnd();
    if (pinch) { if (pointers.size < 2) pinch = null; drag = null; return; }
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.mode === 'belt') {
      const path = d.path || (d.start ? [{ x: d.start.x, y: d.start.y, dir }] : []);
      view.setGhostPath(null);
      if (path.length === 1) tryPlace('esteira', path[0].x, path[0].y, path[0].dir);
      else placePath(path);
    } else if (d.mode === 'tap' && !d.moved && d.t) {
      if (tool && tool !== 'remove') tryPlace(tool, d.t.x, d.t.y, autoDir(tool, d.t.x, d.t.y));
      else if (!tool) {
        const e = game.entAt(d.t.x, d.t.y);
        if (e) openInspect(e.id); else closeInspect();
      }
    }
    if (ev.pointerType === 'mouse') updateHover(ev.clientX, ev.clientY);
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse' && !drag) { view.setGhost(null); $('cursorTip').hidden = true; } });
  cv.addEventListener('wheel', (ev) => { ev.preventDefault(); view.zoom(Math.exp(ev.deltaY * 0.0012)); }, { passive: false });

  addEventListener('keydown', (ev) => {
    if (!playing || ev.target.tagName === 'INPUT') return;
    const k = ev.key.toLowerCase();
    if (!$('modal').hidden) { if (k === 'escape') closeModal(); return; }
    if (k === ' ') { spaceDown = true; ev.preventDefault(); return; }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keysDown.add(k); ev.preventDefault(); return; }
    if (k === 'escape') { if (tool) setTool(null); else closeInspect(); return; }
    if (k === 'r') { rotateAction(ev.shiftKey ? -1 : 1); return; }
    if (k === 'q') { view.turn(-1); return; }
    if (k === 'e') { view.turn(1); return; }
    if (k === 'x' || k === 'delete') { setTool(tool === 'remove' ? null : 'remove'); return; }
    const m = KEYMAP[k];
    if (m && MACHINES[m]) {
      if (!game.unlocked.has(m)) { audio.play('error'); return; }
      newUnlocks.delete(m);
      setTool(tool === m ? null : m);
      document.querySelectorAll('#bar .bb.new').forEach((b) => { if (b.dataset.m === m) b.classList.remove('new'); });
    }
  });
  addEventListener('keyup', (ev) => {
    const k = ev.key.toLowerCase();
    if (k === ' ') spaceDown = false;
    keysDown.delete(k);
  });
  addEventListener('blur', () => { keysDown.clear(); spaceDown = false; });

  $('qRot').onclick = () => rotateAction(1);
  $('qCamL').onclick = () => view.turn(-1);
  $('qCamR').onclick = () => view.turn(1);
  $('btnUp').onclick = () => { audio.unlock(); audio.play('click'); upgradesModal(); };
  $('btnMenu').onclick = () => { audio.unlock(); audio.play('click'); menuModal(); };
}

function rotateAction(s) {
  if (tool && tool !== 'remove') {
    if (!dirManual && hover && hover.x != null) dir = autoDir(tool, hover.x, hover.y);
    dirManual = true;
    dir = (dir + s + 4) % 4;
    audio.play('rotate');
    if (hover) updateHover(hover.sx, hover.sy);
    return;
  }
  const target = selId ? game.ents.get(selId) : hover && hover.x != null ? game.entAt(hover.x, hover.y) : null;
  if (target && game.rotate(target.x, target.y, s)) audio.play('rotate');
}

function removeAt(t, quiet) {
  const e = game.entAt(t.x, t.y);
  if (!e || e.kind === 'hub') return;
  if (selId === e.id) closeInspect();
  game.remove(t.x, t.y);
  audio.play('remove');
}

boot();
// acesso para testes automatizados e depuração no console
window.F7 = { get game() { return game; }, get view() { return view; }, setTool: (t) => setTool(t), get tool() { return tool; } };
