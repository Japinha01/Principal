/* ============================================================
   BALSA FURADA — jogo principal
   Menu, sala (anfitrião ou convidado), laço do jogo, controles,
   interações, HUD e os painéis do saguão, do porto e do fim.
   ============================================================ */
import * as THREE from 'three';
import { VERSAO, RAFT, ESTACOES, LOOT, MELHORIAS, NOMES_TRECHO, ROLETA, CORES, CEUS, MAX_JOGADORES, clamp, pedagio } from './data.js';
import { makeRiver } from './river.js';
import { Sim } from './sim.js';
import { Net } from './net.js';
import { View } from './render.js';
import { Marujo, pesa } from './player.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const moedas = (v) => `<span class="coin"></span>${Math.round(v)}`;

const audio = new Audio();
const view = new View($('c'));
const me = new Marujo();

/* ---------- preferências ---------- */
const prefs = { nome: '', cor: CORES[(Math.random() * CORES.length) | 0], sens: 1, inv: false, viuComo: false };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('bf-prefs') || '{}')); } catch (e) { /* sem storage */ }
if (!prefs.nome) prefs.nome = 'Marujo' + ((Math.random() * 900 + 100) | 0);
const salvaPrefs = () => { try { localStorage.setItem('bf-prefs', JSON.stringify(prefs)); } catch (e) { /* ok */ } };

/* ---------- estado ---------- */
let net = null, sim = null;
let S = null, snapT = 0;       // último retrato do anfitrião
let river = null, riverSeed = null;
let jogando = false;
let lastPhase = null, lastLevel = -1;
const raftI = { x: 0, z: 0, vx: 0, vz: 0, water: 0, rudder: 0 };
const outros = new Map();       // posições suavizadas dos outros marujos
let painelModo = null, painelAberto = false;
let sendT = 0, hudT = 0;
let bombeando = false, tapando = 0, lemePedido = 0, pedidoT = 0;
let rudderEnviado = 0, rudderT = 0;
let camYaw = 0, camPitch = 0.38;
let aposta = 10;
let rodaAng = 0, rodaAnim = null;
let afundandoT = 0;

/* ============================================================
   MENU
   ============================================================ */
$('versao').textContent = 'v' + VERSAO;
$('nome').value = prefs.nome;
$('nome').addEventListener('input', () => { prefs.nome = $('nome').value.trim() || prefs.nome; salvaPrefs(); });
function desenhaCores() {
  $('cores').innerHTML = CORES.map((c) => `<button data-c="${c}" style="background:${c}" class="${c === prefs.cor ? 'sel' : ''}" aria-label="cor ${c}"></button>`).join('');
}
desenhaCores();
$('cores').addEventListener('click', (e) => {
  const c = e.target.dataset.c;
  if (!c) return;
  prefs.cor = c; salvaPrefs(); desenhaCores(); audio.unlock(); audio.play('clique');
});
$('codigo').addEventListener('input', () => { $('codigo').value = $('codigo').value.toUpperCase().replace(/[^A-Z]/g, ''); });
$('codigo').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btEntrar').click(); });
const menuErro = (t) => { $('menuErro').textContent = t || ''; };
const trava = (v) => ['btCriar', 'btSolo', 'btEntrar'].forEach((id) => { $(id).disabled = v; });

$('btSolo').onclick = () => { audio.unlock(); iniciaAnfitriao(false); };
$('btCriar').onclick = async () => {
  audio.unlock();
  menuErro('Criando sala…');
  trava(true);
  try { await iniciaAnfitriao(true); } catch (e) { menuErro(e.message + ' Você ainda pode jogar sozinho.'); }
  trava(false);
};
$('btEntrar').onclick = async () => {
  audio.unlock();
  const code = $('codigo').value.trim();
  if (code.length < 5) { menuErro('Digite o código de 5 letras da sala.'); return; }
  menuErro('Entrando…');
  trava(true);
  try { await entra(code); } catch (e) { menuErro(e.message); net?.close(); net = null; }
  trava(false);
};
$('btComo').onclick = () => { $('como').hidden = false; };
$('btComo2').onclick = () => { $('como').hidden = false; };
$('btComoOk').onclick = () => { $('como').hidden = true; prefs.viuComo = true; salvaPrefs(); };

const hello = () => ({ t: 'hello', name: prefs.nome, cor: prefs.cor, v: VERSAO });

async function iniciaAnfitriao(online) {
  net = new Net();
  if (online) await net.host(); else net.solo();
  sim = new Sim(net);
  net.onHostMsg = (id, m) => sim.onMsg(id, m);
  net.onMsg = onMsg;
  net.onJoin = (id, h) => {
    if (h.v !== VERSAO) { net.sendTo(id, { t: 'ev', e: 'recusado', txt: `Versão diferente (sala: ${VERSAO}, você: ${h.v}). Atualize o jogo.` }); net.kick(id); return; }
    if (!sim.addPlayer(id, h.name, h.cor)) { net.sendTo(id, { t: 'ev', e: 'recusado', txt: 'A sala está cheia.' }); net.kick(id); return; }
    net.broadcast({ t: 'ev', e: 'aviso', txt: `${String(h.name).slice(0, 16)} subiu na balsa!` });
  };
  net.onLeave = (id) => sim.removePlayer(id);
  sim.addPlayer('h', prefs.nome, prefs.cor);
  comecaJogo();
}

async function entra(code) {
  net = new Net();
  net.onMsg = onMsg;
  net.onClose = (motivo) => sai(motivo);
  await net.join(code, hello());
  comecaJogo();
}

function comecaJogo() {
  jogando = true;
  S = null; riverSeed = null; lastPhase = null; lastLevel = -1;
  outros.clear();
  $('menu').hidden = true;
  $('hud').hidden = false;
  $('sala').hidden = !net.online;
  $('sCodigo').textContent = net.code;
  $('chatLog').innerHTML = '';
  menuErro('');
  if (!prefs.viuComo) $('como').hidden = false;
}

function sai(motivo) {
  if (!jogando) return;
  jogando = false;
  net?.close();
  net = null; sim = null; S = null;
  fechaPainel();
  $('pausa').hidden = true;
  $('hud').hidden = true;
  $('menu').hidden = false;
  menuErro(motivo || '');
  if (document.pointerLockElement) document.exitPointerLock();
}
$('btSair').onclick = () => sai('');

/* ============================================================
   MENSAGENS (todo mundo, inclusive o anfitrião, recebe aqui)
   ============================================================ */
function onMsg(m) {
  if (!jogando || !m) return;
  if (m.t === 'snap') return onSnap(m);
  if (m.t === 'ev') return onEvento(m);
}

function onSnap(s) {
  const primeira = !S;
  S = s;
  snapT = performance.now();
  if (s.seed !== riverSeed) {
    riverSeed = s.seed;
    river = makeRiver(s.seed, Math.max(1, s.lv));
    view.setRiver(river, s.lv);
    Object.assign(raftI, { x: s.r[0], z: s.r[1], vx: s.r[2], vz: s.r[3] });
  }
  if (primeira) Object.assign(raftI, { x: s.r[0], z: s.r[1] });
  if (s.ph !== lastPhase || s.lv !== lastLevel) transicao(lastPhase, s.ph, primeira);
  lastPhase = s.ph; lastLevel = s.lv;
  if (me.m === 'leme' && s.lm !== net.myId && performance.now() - lemePedido > 700) me.m = 'deck';
  if (painelAberto) atualizaPainel();
}

const meuIndice = () => Math.max(0, S ? S.p.findIndex((p) => p[0] === net.myId) : 0);

function transicao(de, para, primeira) {
  if (para === 'lobby') {
    me.reset(meuIndice());
    abrePainel('lobby');
  } else if (para === 'rio') {
    me.reset(meuIndice());
    fechaPainel();
    const nome = NOMES_TRECHO[(S.lv - 1) % NOMES_TRECHO.length];
    aviso(`Trecho ${S.lv}: ${nome}`, 'grande', 3500);
    if (!primeira) audio.play('sino');
  } else if (para === 'porto') {
    if (me.m !== 'deck') me.reset(meuIndice());
    abrePainel('porto');
    audio.play('sino');
  } else if (para === 'fim') {
    abrePainel('fim');
  }
}

function onEvento(m) {
  switch (m.e) {
    case 'batida': {
      audio.play('batida');
      view.kick(0.7 * m.f);
      view.splash(m.x, m.z, 1.2 * m.f, 0.2);
      if (m.furos) aviso(m.furos > 1 ? `${m.furos} furos novos!` : 'Furo novo!', 'ruim', 1600);
      if (me.m === 'deck' && Math.random() < 0.3 * m.f) { const a = Math.random() * 6.28; me.empurrao(Math.cos(a), Math.sin(a), 4.5); }
      break;
    }
    case 'tranco':
      view.kick(0.25);
      audio.play('range');
      if (me.m === 'deck' && Math.random() < 0.12) { const a = Math.random() * 6.28; me.empurrao(Math.cos(a), Math.sin(a), 3); }
      break;
    case 'splash': view.splash(m.x, m.z, m.s || 1); audio.play(m.s > 0.8 ? 'splash' : 'splashP'); break;
    case 'pegou': if (m.id === net.myId) audio.play('pega'); break;
    case 'tapou': audio.play('martelo'); break;
    case 'trinca': audio.play('trinca'); break;
    case 'empurrao':
      me.empurrao(m.dx, m.dz, 7.5);
      if (me.m === 'leme') me.m = 'deck';
      aviso(`${m.por} te empurrou!`, '', 1500);
      break;
    case 'som': audio.play(m.s); break;
    case 'boia': {
      audio.play('boia');
      const b = ESTACOES.boia;
      view.lancaBoia(new THREE.Vector3(raftI.x + b.x, 1.2, raftI.z + b.z), new THREE.Vector3(m.x, 0, m.z));
      break;
    }
    case 'resgate':
      me.m = 'deck'; me.x = m.x; me.z = m.z; me.y = 0.6; me.vy = 3; me.kx = me.kz = 0;
      aviso('Puxaram você de volta!', 'bom', 1600);
      break;
    case 'perdido': me.m = 'ghost'; break;
    case 'aviso': aviso(esc(m.txt), '', 2600); break;
    case 'saiu': aviso(`${esc(m.name)} saiu da sala`, '', 2600); break;
    case 'chat': chatLinha(`<b style="color:${esc(m.cor)}">${esc(m.name)}:</b> ${esc(m.txt)}`); audio.play('chat'); break;
    case 'comprou': chatLinha(`<b style="color:${esc(m.cor)}">${esc(m.name)}</b> comprou <b>${esc(m.nome)}</b>`); audio.play('moeda'); break;
    case 'pagou': aviso(`Pedágio pago: ${moedas(m.v)}`, '', 2600); audio.play('moeda'); break;
    case 'porto': aviso(`Porto! Vendido por ${moedas(m.vendido)}`, 'bom', 3000); if (m.vendido) audio.play('moeda'); break;
    case 'afundou':
      audio.play('afundou');
      if (me.m === 'deck' || me.m === 'leme') { me.m = 'deck'; me.caiNaAgua(raftI); }
      aviso('A BALSA AFUNDOU!', 'ruim grande', 4000);
      break;
    case 'roleta':
      giraRoda(m.casa);
      chatLinha(`<b style="color:${esc(m.pcor)}">${esc(m.name)}</b> apostou ${moedas(m.qt)} no <b>${m.cor}</b>`);
      break;
    case 'roletaFim':
      if (m.ganhou) { aviso(`${esc(m.name)} ganhou ${moedas(m.premio)} na roleta!`, 'bom', 3000); audio.play('ganhou'); }
      else { aviso(`${esc(m.name)} perdeu ${moedas(m.qt)} na roleta…`, 'ruim', 3000); audio.play('perdeu'); }
      break;
    case 'recusado': sai(m.txt); break;
  }
}

/* ============================================================
   CONTROLES
   ============================================================ */
const keys = new Set();
const pressed = new Set();
const chatAberto = () => !$('chatIn').hidden;
const overlayAberto = () => painelAberto || !$('pausa').hidden || !$('como').hidden || !$('menu').hidden;
let soltandoMouse = false;

addEventListener('keydown', (e) => {
  if (!jogando) return;
  if (chatAberto()) {
    if (e.key === 'Enter') { const t = $('chatIn').value.trim(); if (t) net.sendHost({ t: 'act', a: 'chat', txt: t }); fechaChat(); }
    else if (e.key === 'Escape') fechaChat();
    return;
  }
  if (e.code === 'Tab') {
    e.preventDefault();
    if (S && ['lobby', 'porto', 'fim'].includes(S.ph)) { if (painelAberto) fechaPainel(); else abrePainel(S.ph); }
    return;
  }
  if (e.key === 'Enter' || e.code === 'KeyT') {
    e.preventDefault();
    $('chatIn').hidden = false;
    $('chatIn').value = '';
    soltaMouse();
    setTimeout(() => $('chatIn').focus(), 0);
    return;
  }
  if (e.key === 'Escape') {
    if (!$('como').hidden) { $('como').hidden = true; return; }
    if (!$('pausa').hidden) { fechaPausa(); return; }
    if (!document.pointerLockElement) abrePausa();
    return;
  }
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function fechaChat() { $('chatIn').hidden = true; $('chatIn').blur(); $('c').focus(); }
function soltaMouse() { if (document.pointerLockElement) { soltandoMouse = true; document.exitPointerLock(); } }
function prendeMouse() {
  if (overlayAberto() || chatAberto()) return;
  const c = $('c');
  try { const r = c.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => c.requestPointerLock()); } catch (e) { c.requestPointerLock(); }
}
function abrePausa() {
  $('oSens').value = prefs.sens; $('oVol').value = audio.vol; $('oInv').checked = !!prefs.inv;
  $('pausa').hidden = false;
}
function fechaPausa() { $('pausa').hidden = true; prendeMouse(); }
$('btVoltar').onclick = fechaPausa;
$('oSens').oninput = () => { prefs.sens = +$('oSens').value; salvaPrefs(); };
$('oVol').oninput = () => audio.setVol(+$('oVol').value);
$('oInv').onchange = () => { prefs.inv = $('oInv').checked; salvaPrefs(); };

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && jogando && !soltandoMouse && !overlayAberto() && !chatAberto()) abrePausa();
  soltandoMouse = false;
});
let arrastando = false, clicou = false;
$('c').addEventListener('mousedown', (e) => {
  audio.unlock();
  if (!jogando) return;
  if (!document.pointerLockElement) { prendeMouse(); arrastando = true; return; }
  if (e.button === 0) clicou = true;
});
addEventListener('mouseup', () => { arrastando = false; });
addEventListener('mousemove', (e) => {
  if (!jogando || (!document.pointerLockElement && !arrastando)) return;
  const k = prefs.sens;
  camYaw -= e.movementX * 0.0024 * k;
  camPitch = clamp(camPitch + e.movementY * 0.0022 * k * (prefs.inv ? -1 : 1), -0.3, 1.25);
});
addEventListener('wheel', (e) => { view.camDist = clamp(view.camDist + Math.sign(e.deltaY) * 0.6, 3, 11); }, { passive: true });

/* ============================================================
   LAÇO
   ============================================================ */
// a simulação roda num timer (continua mesmo com a janela em segundo plano)
let lastSim = performance.now();
setInterval(() => {
  const n = performance.now();
  const dt = Math.min(0.1, (n - lastSim) / 1000);
  lastSim = n;
  if (sim && jogando) sim.tick(dt);
}, 1000 / 40);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (jogando && S && river) passo(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function meuItem() {
  return S.i.find((it) => it[2] === 'c' && it[6] === net.myId);
}

function passo(dt) {
  // balsa: o anfitrião usa a simulação; os outros extrapolam o último retrato
  if (sim) {
    const R = sim.raft;
    Object.assign(raftI, { x: R.x, z: R.z, vx: R.vx, vz: R.vz, water: R.water, rudder: R.rudder });
  } else {
    const idade = Math.min(0.3, (performance.now() - snapT) / 1000);
    const tx = S.r[0] + S.r[2] * idade, tz = S.r[1] + S.r[3] * idade;
    if (Math.hypot(tx - raftI.x, tz - raftI.z) > 5) { raftI.x = tx; raftI.z = tz; }
    raftI.x += (tx - raftI.x) * Math.min(1, dt * 10);
    raftI.z += (tz - raftI.z) * Math.min(1, dt * 10);
    raftI.vx = S.r[2]; raftI.vz = S.r[3];
    raftI.water += (S.r[4] - raftI.water) * Math.min(1, dt * 8);
    raftI.rudder += (S.r[5] - raftI.rudder) * Math.min(1, dt * 10);
  }

  // entrada
  const livre = !overlayAberto() && !chatAberto();
  const k = (c) => livre && keys.has(c);
  const inp = {
    f: (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0),
    s: (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0),
    run: k('ShiftLeft') || k('ShiftRight'),
    jump: livre && pressed.has('Space'),
  };
  const aperta = (c) => livre && pressed.has(c);
  const segura = (c) => k(c);
  const carregado = meuItem();
  const others = [];
  for (const p of S.p) if (p[0] !== net.myId) others.push({ id: p[0], m: p[3], x: p[4], z: p[6] });

  // leme
  if (me.m === 'leme') {
    const alvo = (k('KeyA') || k('ArrowLeft') ? 1 : 0) - (k('KeyD') || k('ArrowRight') ? 1 : 0);
    rudderT -= dt;
    if (alvo !== rudderEnviado && rudderT <= 0) { net.sendHost({ t: 'act', a: 'virar', v: alvo }); rudderEnviado = alvo; rudderT = 0.08; }
    inp.f = 0; inp.s = 0;
    if (aperta('KeyE') || aperta('KeyW') || aperta('KeyS') || aperta('Space')) {
      me.m = 'deck'; me.z += 0.15;
      net.sendHost({ t: 'act', a: 'leme', on: false });
      rudderEnviado = 0;
      pressed.delete('KeyE');
    }
  }

  const eventos = me.update(dt, inp, camYaw, { raft: raftI, river, others, pesado: carregado && pesa(carregado[1]) });
  const w = me.world(raftI);
  for (const ev of eventos) {
    if (ev === 'caiu') { net.sendHost({ t: 'act', a: 'caiu', x: w.x, z: w.z }); if (me.m === 'water' && tapando) tapando = 0; }
    if (ev === 'pulo') audio.play('pulo');
    if (ev === 'subiu') audio.play('splashP');
  }

  // interações
  interage(dt, aperta, segura, carregado, w, others);

  // manda a posição
  sendT -= dt;
  if (sendT <= 0) {
    sendT = 1 / 20;
    net.sendHost({ t: 'me', m: me.m, x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), an: bombeando ? 3 : me.an });
  }

  // monta a lista de bonecos para desenhar
  const players = [];
  const carregando = new Set(S.i.filter((it) => it[2] === 'c').map((it) => it[6]));
  for (const p of S.p) {
    const [id, name, cor, m, x, y, z, ry, an] = p;
    if (id === net.myId) {
      players.push({ id, name, cor, m: me.m, x: me.x, y: me.y, z: me.z, ry: me.ry, an: bombeando ? 3 : me.an, carry: carregando.has(id) });
      continue;
    }
    let o = outros.get(id);
    if (!o || o.m !== m) { o = { m, x, y, z, ry }; outros.set(id, o); }
    const a = Math.min(1, dt * 14);
    o.x += (x - o.x) * a; o.y += (y - o.y) * a; o.z += (z - o.z) * a;
    let d = ry - o.ry; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    o.ry += d * a;
    players.push({ id, name, cor, m, x: o.x, y: o.y, z: o.z, ry: o.ry, an, carry: carregando.has(id) });
  }
  for (const id of outros.keys()) if (!S.p.some((p) => p[0] === id)) outros.delete(id);

  afundandoT = S.ph === 'afundou' ? afundandoT + dt : 0;

  // câmera
  const alvo = me.m === 'ghost' ? new THREE.Vector3(raftI.x, 1.5, raftI.z) : new THREE.Vector3(w.x, (me.m === 'water' ? -0.2 : RAFT.DECK_Y + me.y) + 1.35 + view.raft.g.position.y * (me.m === 'water' ? 0 : 1), w.z);
  view.camYaw = camYaw;
  view.camPitch = camPitch;
  if (me.m === 'ghost') view.camDist = Math.max(view.camDist, 10);

  view.update(dt, {
    raft: raftI, phase: S.ph, sunkT: afundandoT,
    carga: S.cg, holes: S.h, items: S.i, players, meId: net.myId,
    pumping: players.some((p) => p.an === 3), boiaCd: S.bc, camTarget: alvo,
  });

  audio.rio(clamp((raftI.vz - 3) / 4, 0, 1) + (river.inRapids(raftI.z) ? 0.5 : 0));
  if (bombeando && Math.random() < dt * 3) audio.play('bomba');

  hudT -= dt;
  if (hudT <= 0) { hudT = 0.1; atualizaHud(); }
  pressed.clear();
  clicou = false;
}

/* ---------- o que dá para fazer agora ---------- */
function interage(dt, aperta, segura, carregado, w, others) {
  let texto = '', prog = -1;
  const ph = S.ph;
  const noConves = me.m === 'deck';
  const agora = performance.now();
  const esperando = agora - pedidoT < 350;

  // bombear: segurar E perto da bomba
  const B = ESTACOES.bomba;
  const pertoBomba = noConves && !carregado && Math.hypot(me.x - B.x, me.z - B.z) < 1.15;
  const querBombear = pertoBomba && segura('KeyE') && ph === 'rio';
  if (querBombear !== bombeando) { bombeando = querBombear; net.sendHost({ t: 'act', a: 'bomba', on: bombeando }); }

  // empurrar
  if (aperta('KeyF') && me.m !== 'ghost') {
    let alvo = null, best = 1.7;
    for (const q of others) {
      if (q.m === 'ghost') continue;
      const qw = q.m === 'water' ? { x: q.x, z: q.z } : { x: raftI.x + q.x, z: raftI.z + q.z };
      const d = Math.hypot(qw.x - w.x, qw.z - w.z);
      if (d < best) { best = d; alvo = { id: q.id, dx: qw.x - w.x, dz: qw.z - w.z }; }
    }
    if (alvo) net.sendHost({ t: 'act', a: 'empurrar', ...alvo });
    else audio.play('pulo');
  }

  if (me.m === 'leme') {
    texto = '<kbd>A</kbd> <kbd>D</kbd> virar · <kbd>E</kbd> largar o leme';
  } else if (me.m === 'ghost') {
    texto = '';
  } else if (carregado) {
    const k = carregado[1];
    // tábua em cima de furo
    let furo = null;
    if (k === 'tabua' && noConves) {
      let best = 1.0;
      for (const h of S.h) { const d = Math.hypot(h[1] - me.x, h[2] - me.z); if (d < best) { best = d; furo = h; } }
    }
    if (furo) {
      if (segura('KeyE')) {
        tapando += dt;
        if (tapando >= 0.9) { net.sendHost({ t: 'act', a: 'tapar', id: furo[0] }); tapando = 0; pedidoT = agora; pressed.delete('KeyE'); }
      } else tapando = 0;
      texto = 'Segure <kbd>E</kbd> tapar o furo';
      prog = tapando / 0.9;
    } else {
      tapando = 0;
      texto = `<kbd>E</kbd> soltar ${LOOT[k].nome} · <kbd>Clique</kbd> arremessar`;
      if (aperta('KeyE') && !esperando) {
        const frente = { x: w.x + Math.sin(me.ry) * 0.7, z: w.z + Math.cos(me.ry) * 0.7 };
        net.sendHost({ t: 'act', a: 'soltar', x: frente.x, z: frente.z });
        audio.play('solta');
        pedidoT = agora;
      } else if (clicou && !esperando) {
        const d = 5.5;
        net.sendHost({ t: 'act', a: 'soltar', x: w.x + Math.sin(camYaw) * d, z: w.z + Math.cos(camYaw) * d, jogou: true });
        audio.play('solta');
        pedidoT = agora;
      }
    }
  } else {
    tapando = 0;
    // procura o alvo mais perto
    let alvo = null, best = 99;
    const oferta = (d, a) => { if (d < best) { best = d; alvo = a; } };
    for (const it of S.i) {
      const [id, k, s, x, z, v] = it;
      if (s === 'c') continue;
      if (s === 'd') {
        const d = Math.hypot(x - me.x, z - me.z);
        if (noConves && d < 1.25) oferta(d + 0.1, { tipo: 'item', id, k, v });
      } else {
        const d = Math.hypot(x - w.x, z - w.z);
        if (d < 2.3) oferta(d, { tipo: 'item', id, k, v });
      }
    }
    if (noConves) {
      for (const [nome, st] of Object.entries(ESTACOES)) {
        const d = Math.hypot(st.x - me.x, st.z - me.z) - st.r;
        if (d < 0.75) oferta(d - 0.05, { tipo: nome });
      }
    }
    if (alvo) {
      if (alvo.tipo === 'item') {
        const L = LOOT[alvo.k];
        texto = `<kbd>E</kbd> pegar ${L.nome}${L.v ? ' · ' + moedas(alvo.v) : ''}${L.fragil ? ' · frágil' : ''}${L.pesado ? ' · pesado' : ''}`;
        if (aperta('KeyE') && !esperando) { net.sendHost({ t: 'act', a: 'pegar', id: alvo.id }); pedidoT = agora; }
      } else if (alvo.tipo === 'leme') {
        const livreLeme = !S.lm || S.lm === net.myId;
        texto = livreLeme ? (ph === 'rio' ? '<kbd>E</kbd> pilotar' : '<kbd>E</kbd> pegar o leme') : 'Alguém já está no leme';
        if (livreLeme && aperta('KeyE')) {
          net.sendHost({ t: 'act', a: 'leme', on: true });
          me.m = 'leme'; lemePedido = agora; rudderEnviado = 0;
        }
      } else if (alvo.tipo === 'bomba') {
        texto = ph === 'rio' ? (bombeando ? 'Bombeando…' : 'Segure <kbd>E</kbd> bombear água') : 'Bomba d’água';
      } else if (alvo.tipo === 'tabuas') {
        texto = S.pl > 0 ? `<kbd>E</kbd> pegar tábua (${S.pl})` : 'Acabaram as tábuas! Compre no porto';
        if (S.pl > 0 && aperta('KeyE') && !esperando) { net.sendHost({ t: 'act', a: 'tabua' }); pedidoT = agora; }
      } else if (alvo.tipo === 'boia') {
        texto = S.bc ? 'A boia está voltando…' : '<kbd>E</kbd> jogar a boia';
        if (!S.bc && aperta('KeyE')) net.sendHost({ t: 'act', a: 'boia' });
      }
    } else if (me.m === 'water' && me.pertoDaBalsa) {
      texto = '<kbd>Espaço</kbd> subir na balsa';
    } else if (me.m === 'water') {
      texto = 'Nade até a balsa!';
    }
  }

  const pr = $('prompt');
  if (texto) {
    const html = texto + (prog >= 0 ? `<span class="prog"><i style="width:${Math.round(prog * 100)}%"></i></span>` : '');
    if (pr.innerHTML !== html) pr.innerHTML = html;
    pr.hidden = false;
  } else pr.hidden = true;
}

/* ============================================================
   HUD
   ============================================================ */
function aviso(html, cls = '', ms = 2200) {
  const d = document.createElement('div');
  d.className = 'aviso ' + cls;
  d.innerHTML = html;
  $('avisos').appendChild(d);
  while ($('avisos').children.length > 4) $('avisos').firstChild.remove();
  setTimeout(() => d.remove(), ms);
}
function chatLinha(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  $('chatLog').appendChild(d);
  while ($('chatLog').children.length > 8) $('chatLog').firstChild.remove();
  setTimeout(() => d.classList.add('velha'), 12000);
  setTimeout(() => d.remove(), 13500);
}

let hudCache = {};
const setHtml = (id, html) => { if (hudCache[id] !== html) { hudCache[id] = html; $(id).innerHTML = html; } };
function atualizaHud() {
  const lv = S.lv, ph = S.ph;
  if (ph === 'lobby') {
    setHtml('tNome', 'Porto de Saída');
    setHtml('tSub', 'esperando a tripulação');
    $('tBar').style.width = '0%';
  } else {
    setHtml('tNome', `Trecho ${lv} · ${NOMES_TRECHO[(lv - 1) % NOMES_TRECHO.length]}`);
    const falta = Math.max(0, Math.round(river.len - 26 - raftI.z));
    setHtml('tSub', ph === 'rio' ? `${CEUS[(lv - 1) % CEUS.length].nome} · faltam ${falta} m até o porto${river.inRapids(raftI.z) ? ' · <b style="color:#ff5a4e">CORREDEIRA</b>' : ''}` : ph === 'porto' ? 'no porto' : ph === 'afundou' ? 'afundando…' : 'fim da viagem');
    $('tBar').style.width = Math.min(100, (raftI.z / (river.len - 26)) * 100) + '%';
  }
  const carga = S.i.reduce((s, it) => s + ((it[2] === 'd' || it[2] === 'c') ? it[5] : 0), 0);
  setHtml('dCofre', String(S.c));
  setHtml('dCarga', `tesouro a bordo: ${moedas(carga)}`);
  setHtml('dPed', ph === 'lobby' ? 'pedágio no 1º porto: ' + moedas(pedagio(1)) : `pedágio deste porto: ${moedas(S.pd)}`);
  const pct = Math.round(raftI.water * 100);
  setHtml('aPct', pct + '%');
  $('aBar').style.width = pct + '%';
  $('agua').classList.toggle('perigo', pct >= 70 && ph === 'rio');
  setHtml('aFuros', S.h.length === 1 ? '1 furo' : `${S.h.length} furos`);
  setHtml('aTabuas', `tábuas: ${S.pl}`);
  setHtml('aPeso', `peso: ${S.cg}`);
  $('agua').hidden = ph !== 'rio' && ph !== 'afundou';
  const st = { water: 'na água', ghost: 'ficou pra trás', leme: 'no leme' };
  setHtml('jogadores', S.p.map((p) => `<div><span class="bola" style="background:${esc(p[2])}"></span>${esc(p[1])}${st[p[3]] ? ` <small style="opacity:.75">· ${st[p[3]]}</small>` : ''}</div>`).join(''));
  const dica = $('dica');
  if (me.m === 'ghost' && ph === 'rio') { dica.innerHTML = 'Você ficou pra trás!<br><small>A tripulação te resgata no próximo porto.</small>'; dica.hidden = false; }
  else if (!document.pointerLockElement && !overlayAberto() && !chatAberto() && ph !== 'fim') { dica.innerHTML = 'Clique para controlar o marujo'; dica.hidden = false; }
  else dica.hidden = true;
  $('mira').hidden = !meuItem() || !document.pointerLockElement;
}

/* ============================================================
   PAINÉIS: saguão, porto, fim
   ============================================================ */
function abrePainel(modo) {
  painelModo = modo;
  painelAberto = true;
  soltaMouse();
  $('painel').hidden = false;
  keys.clear();
  if (bombeando) { bombeando = false; net?.sendHost({ t: 'act', a: 'bomba', on: false }); }
  montaPainel();
}
function fechaPainel() {
  painelAberto = false;
  $('painel').hidden = true;
}

function montaPainel() {
  const c = $('painelCard');
  const acoes = (rotulo) => `<div class="pronto"><button class="btn verde" id="pBtn" data-act="pronto">${rotulo}</button>${painelModo !== 'fim' ? '<button class="btn cinza" data-act="andar">Andar pela balsa <kbd>Tab</kbd></button>' : '<button class="btn cinza" data-act="sair">Sair para o menu</button>'}<span id="pInfo" class="sub2"></span></div>`;
  if (painelModo === 'lobby') {
    c.innerHTML = `
      <h2>Porto de Saída</h2>
      <p class="sub2">O Barqueiro cobra pedágio a cada porto. Juntem tesouros no caminho, vendam no porto e sigam o máximo que der.</p>
      <div class="cols">
        <div>
          ${net.online ? `<div class="caixa"><div class="sub2">Código da sala: mande para os amigos</div><div class="codigoGrande">${esc(net.code)}</div><button class="btn peq azul" data-act="copiar">Copiar código</button></div>`
            : '<div class="caixa"><b>Jogando sozinho.</b><p class="sub2">Para jogar com amigos, volte ao menu e crie uma sala.</p></div>'}
          <h3>Tripulação <span id="pConta"></span></h3><div class="lista" id="pLista"></div>
        </div>
        <div>
          <h3>Divisão de tarefas</h3>
          <div class="controles">
            <b>Leme</b><span>Desviar das pedras e margens.</span>
            <b>Bomba</b><span>Segurar <kbd>E</kbd> para tirar água.</span>
            <b>Tábuas</b><span>Levar tábua até o furo e segurar <kbd>E</kbd>.</span>
            <b>Pesca</b><span>Pegar tesouros perto da borda, ou pular no rio atrás deles.</span>
            <b>Boia</b><span>Resgata quem caiu, ou fisga tesouro.</span>
          </div>
          <p class="sub2" style="margin-top:10px">Deixe os tesouros na <b>área de carga</b> (frente, com corda): lá eles não caem nas batidas.</p>
          <button class="btn peq cinza" data-act="como" style="margin-top:8px">Todos os controles</button>
        </div>
      </div>
      ${acoes('Pronto pra zarpar!')}`;
  } else if (painelModo === 'porto') {
    const po = S.po || { vendido: 0, lista: [], level: S.lv };
    c.innerHTML = `
      <h2>Porto do trecho ${po.level}</h2>
      <p class="sub2">${po.lista.length ? `O Barqueiro comprou ${po.lista.length} ${po.lista.length === 1 ? 'tesouro' : 'tesouros'}.` : 'Chegaram de mãos vazias…'} O dinheiro é da tripulação toda.</p>
      <div class="cols">
        <div>
          <div class="caixa"><div class="contas">
            <span>Vendido neste porto</span><b>+${moedas(po.vendido)}</b>
            <span>Cofre agora</span><b id="pCofre"></b>
            <span>Pedágio para seguir</span><b>−${moedas(pedagio(po.level))}</b>
            <span class="tot">Sobra depois</span><b class="tot" id="pSobra"></b>
          </div></div>
          <h3>Loja do porto</h3><div class="loja" id="pLoja"></div>
        </div>
        <div>
          <h3>Roleta do Barqueiro</h3>
          <div class="caixa"><div id="roletaBox"><canvas id="roda" width="380" height="380"></canvas>
            <div class="apostas">
              <div class="fichas" id="pFichas"></div>
              <div style="font-weight:600">Aposta: <b id="pQt"></b></div>
              <div class="corBtns"><button class="btn verm" data-cor="vermelho">Vermelho ×2</button><button class="btn preto" data-cor="preto">Preto ×2</button><button class="btn verde" data-cor="verde">Verde ×14</button></div>
              <div class="sub2" style="font-size:13px">Qualquer um pode apostar o dinheiro do cofre. Boa sorte explicando pros amigos.</div>
            </div></div></div>
          <h3>Tripulação</h3><div class="lista" id="pLista"></div>
        </div>
      </div>
      ${acoes('Zarpar!')}`;
    desenhaRoda(rodaAng);
  } else if (painelModo === 'fim') {
    const st = S.st || {};
    const motivo = st.motivo === 'afundou' ? `A balsa afundou no trecho ${S.lv}.` : 'Faltou dinheiro pro pedágio. O Barqueiro ficou com a balsa.';
    const melhor = st.melhor ? `${LOOT[st.melhor.k].nome} (${moedas(st.melhor.v)})` : 'nenhum';
    c.innerHTML = `
      <h2>Fim da viagem</h2>
      <p class="sub2" style="font-size:18px">${motivo}</p>
      <div class="caixa" style="margin-top:14px"><div class="contas">
        <span>Trechos vencidos</span><b>${st.trechos || 0}</b>
        <span>Total vendido</span><b>${moedas(st.ganho || 0)}</b>
        <span>Total apostado na roleta</span><b>${moedas(st.apostado || 0)}</b>
        <span>Melhor tesouro</span><b>${melhor}</b>
      </div></div>
      <h3>Tripulação</h3><div class="lista" id="pLista"></div>
      ${acoes('Jogar de novo')}`;
  }
  hudCache = {};
  atualizaPainel();
}

function atualizaPainel() {
  if (!S) return;
  if (S.ph !== painelModo && ['lobby', 'porto', 'fim'].includes(S.ph)) { painelModo = S.ph; montaPainel(); return; }
  const eu = S.p.find((p) => p[0] === net.myId);
  const pronto = eu && eu[9];
  const lista = S.p.map((p) => `<div class="lj"><span class="bola" style="background:${esc(p[2])}"></span>${esc(p[1])}${p[0] === net.myId ? ' <small class="sub2">(você)</small>' : ''}<span class="ok ${p[9] ? 'sim' : ''}">${p[9] ? 'pronto' : 'esperando'}</span></div>`).join('');
  setHtml('pLista', lista);
  if ($('pConta')) setHtml('pConta', `(${S.p.length}/${MAX_JOGADORES})`);
  const faltam = S.p.filter((p) => !p[9]).length;
  if ($('pBtn')) {
    const rot = painelModo === 'lobby' ? 'Pronto pra zarpar!' : painelModo === 'porto' ? 'Zarpar!' : 'Jogar de novo';
    setHtml('pBtn', pronto ? 'Cancelar pronto' : rot);
    $('pBtn').className = 'btn ' + (pronto ? 'cinza' : 'verde');
  }
  let info = faltam ? `Esperando ${faltam} de ${S.p.length}…` : '';
  if (painelModo === 'porto') {
    const ped = pedagio(S.po?.level || S.lv);
    setHtml('pCofre', moedas(S.c));
    setHtml('pSobra', S.c >= ped ? moedas(S.c - ped) : `<span class="alerta">faltam ${moedas(ped - S.c)}</span>`);
    if (S.c < ped) info = `<span class="alerta">Sem dinheiro pro pedágio! Se todos zarparem assim, a viagem acaba.</span> ` + info;
    if (S.rl) info = 'A roleta está girando… ' + info;
    // loja
    setHtml('pLoja', MELHORIAS.map((u) => {
      const n = u.id === 'tabuas' ? 0 : S.up[u.id];
      const max = n >= u.max;
      return `<button class="up" data-up="${u.id}" ${max || S.c < u.preco ? 'disabled' : ''}><b>${u.nome}${u.max > 1 && u.max < 99 ? ` <small>${n}/${u.max}</small>` : ''}</b><small>${u.desc}</small><span>${max ? 'comprado' : moedas(u.preco)}</span></button>`;
    }).join(''));
    // fichas da roleta
    const opcoes = [10, 25, 50, 100, 'metade', 'tudo'];
    setHtml('pFichas', opcoes.map((o) => `<button data-qt="${o}" class="${aposta === o ? 'sel' : ''}">${typeof o === 'number' ? o : o === 'metade' ? 'Metade' : 'Tudo'}</button>`).join(''));
    const qt = valorAposta();
    setHtml('pQt', qt > 0 ? moedas(qt) : 'cofre vazio');
    for (const b of document.querySelectorAll('[data-cor]')) b.disabled = !!S.rl || !!rodaAnim || qt <= 0;
  }
  if ($('pInfo')) setHtml('pInfo', info);
}

function valorAposta() {
  if (!S) return 0;
  const v = aposta === 'tudo' ? S.c : aposta === 'metade' ? Math.floor(S.c / 2) : aposta;
  return Math.min(v, S.c);
}

$('painelCard').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  audio.play('clique');
  if (b.dataset.act === 'pronto') {
    const eu = S.p.find((p) => p[0] === net.myId);
    net.sendHost({ t: 'act', a: 'pronto', v: !(eu && eu[9]) });
  } else if (b.dataset.act === 'andar') { fechaPainel(); prendeMouse(); }
  else if (b.dataset.act === 'sair') sai('');
  else if (b.dataset.act === 'como') $('como').hidden = false;
  else if (b.dataset.act === 'copiar') { navigator.clipboard?.writeText(net.code).then(() => { b.textContent = 'Copiado!'; }, () => {}); }
  else if (b.dataset.up) net.sendHost({ t: 'act', a: 'comprar', id: b.dataset.up });
  else if (b.dataset.qt) { aposta = isNaN(+b.dataset.qt) ? b.dataset.qt : +b.dataset.qt; atualizaPainel(); }
  else if (b.dataset.cor) { const qt = valorAposta(); if (qt > 0) net.sendHost({ t: 'act', a: 'apostar', qt, cor: b.dataset.cor }); }
});

/* ---------- a roda da roleta ---------- */
const PASSO = (Math.PI * 2) / ROLETA.length;
const COR_CASA = { vermelho: '#ff5a4e', preto: '#27304a', verde: '#3ccf7a' };
function desenhaRoda(ang) {
  const cv = $('roda');
  if (!cv) return;
  const x = cv.getContext('2d'), W = cv.width, R = W / 2 - 10;
  x.clearRect(0, 0, W, W);
  x.save();
  x.translate(W / 2, W / 2);
  x.beginPath(); x.arc(0, 0, R + 8, 0, Math.PI * 2); x.fillStyle = '#a86f3c'; x.fill();
  for (let i = 0; i < ROLETA.length; i++) {
    const a0 = ang + i * PASSO;
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, a0, a0 + PASSO); x.closePath();
    x.fillStyle = COR_CASA[ROLETA[i]]; x.fill();
    x.strokeStyle = '#fffdf7'; x.lineWidth = 2; x.stroke();
    x.save();
    x.rotate(a0 + PASSO / 2);
    x.fillStyle = '#fff'; x.font = '700 24px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(i), R * 0.78, 0);
    x.restore();
  }
  x.beginPath(); x.arc(0, 0, R * 0.32, 0, Math.PI * 2); x.fillStyle = '#fffdf7'; x.fill();
  x.fillStyle = '#27304a'; x.font = '700 22px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(rodaAnim ? '…' : '$', 0, 1);
  x.restore();
  // ponteiro no topo
  x.beginPath(); x.moveTo(W / 2 - 16, 2); x.lineTo(W / 2 + 16, 2); x.lineTo(W / 2, 34); x.closePath();
  x.fillStyle = '#ffd23f'; x.fill(); x.strokeStyle = '#27304a'; x.lineWidth = 3; x.stroke();
}
function giraRoda(casa) {
  const ini = rodaAng;
  // centro da casa sorteada no topo (ângulo -90°)
  let fim = -Math.PI / 2 - casa * PASSO - PASSO / 2;
  while (fim < ini + Math.PI * 2 * 5) fim += Math.PI * 2;
  const t0 = performance.now(), dur = 4000;
  let ultimaCasa = -1;
  rodaAnim = true;
  const anda = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    rodaAng = ini + (fim - ini) * e;
    const casaAgora = Math.floor(((-Math.PI / 2 - rodaAng) / PASSO % ROLETA.length + ROLETA.length) % ROLETA.length);
    if (casaAgora !== ultimaCasa) { ultimaCasa = casaAgora; audio.play('tic'); }
    desenhaRoda(rodaAng);
    if (k < 1) requestAnimationFrame(anda);
    else { rodaAnim = null; rodaAng %= Math.PI * 2; desenhaRoda(rodaAng); atualizaPainel(); }
  };
  requestAnimationFrame(anda);
}

// para testes automáticos
window.__balsa = { get S() { return S; }, get me() { return me; }, get sim() { return sim; }, get net() { return net; }, raftI };
