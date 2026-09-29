/* ============================================================
   BALSA FURADA — rede (PeerJS / WebRTC, sem servidor próprio)
   Quem cria a sala vira o anfitrião: roda a simulação e repassa
   o estado para os outros. O código de 5 letras é parte do id do
   anfitrião no servidor público do PeerJS, que só apresenta os
   jogadores; depois disso o jogo vai direto de um PC para o outro.
   ============================================================ */
/* global Peer */

const PREFIXO = 'balsa-furada-v1-';
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const novoCodigo = () => Array.from({ length: 5 }, () => LETRAS[(Math.random() * LETRAS.length) | 0]).join('');
const later = (fn) => queueMicrotask(fn);

// servidor de apresentação: o público do PeerJS, ou um próprio com ?servidor=host:porta
function opcoesPeer() {
  const o = { debug: 0 };
  const s = new URLSearchParams(location.search).get('servidor');
  if (s) {
    const [host, port] = s.split(':');
    Object.assign(o, { host, port: +port || 9000, path: '/', secure: location.protocol === 'https:' && host !== 'localhost' });
  }
  return o;
}

export class Net {
  constructor() {
    this.peer = null;
    this.conn = null;          // cliente: conexão com o anfitrião
    this.conns = new Map();    // anfitrião: conexões com os clientes
    this.isHost = false;
    this.myId = 'h';
    this.code = '';
    this.onHostMsg = () => {}; // (id, msg) chega no anfitrião
    this.onJoin = () => {};    // (id, hello) alguém entrou
    this.onLeave = () => {};   // (id) alguém saiu
    this.onMsg = () => {};     // (msg) chega em todo mundo (inclusive no anfitrião)
    this.onClose = () => {};   // (motivo) cliente perdeu o anfitrião
  }

  get online() { return !!this.peer; }

  solo() {
    this.isHost = true;
    this.myId = 'h';
  }

  host() {
    this.isHost = true;
    this.myId = 'h';
    return new Promise((resolve, reject) => {
      let tentativas = 0;
      const tenta = () => {
        const code = novoCodigo();
        const peer = new Peer(PREFIXO + code, opcoesPeer());
        let aberto = false;
        peer.on('open', () => {
          aberto = true;
          this.peer = peer;
          this.code = code;
          resolve(code);
        });
        peer.on('connection', (conn) => this.aceita(conn));
        peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => peer.reconnect(), 1500); });
        peer.on('error', (e) => {
          if (aberto) return;
          peer.destroy();
          if (e.type === 'unavailable-id' && ++tentativas < 5) tenta();
          else reject(new Error(e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error'
            ? 'Sem conexão com o servidor de salas. Confira a internet.' : 'Não deu para criar a sala (' + e.type + ').'));
        });
      };
      tenta();
    });
  }

  aceita(conn) {
    conn.on('open', () => this.conns.set(conn.peer, conn));
    conn.on('data', (d) => {
      if (!d || typeof d !== 'object') return;
      if (d.t === 'hello') this.onJoin(conn.peer, d);
      else this.onHostMsg(conn.peer, d);
    });
    const sai = () => {
      if (!this.conns.has(conn.peer)) return;
      this.conns.delete(conn.peer);
      this.onLeave(conn.peer);
    };
    conn.on('close', sai);
    conn.on('error', sai);
  }

  join(code, hello) {
    this.isHost = false;
    code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '');
    return new Promise((resolve, reject) => {
      const peer = new Peer(opcoesPeer());
      let ok = false;
      const timer = setTimeout(() => { if (!ok) { peer.destroy(); reject(new Error('A sala não respondeu. Confira o código.')); } }, 15000);
      peer.on('open', (id) => {
        this.myId = id;
        const conn = peer.connect(PREFIXO + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          ok = true;
          clearTimeout(timer);
          this.peer = peer;
          this.conn = conn;
          this.code = code;
          conn.send(hello);
          resolve(code);
        });
        conn.on('data', (d) => this.onMsg(d));
        conn.on('close', () => { if (ok) this.onClose('O anfitrião fechou a sala.'); });
        conn.on('error', () => { if (ok) this.onClose('A conexão com a sala caiu.'); });
      });
      peer.on('error', (e) => {
        if (ok) { if (e.type !== 'peer-unavailable') this.onClose('A conexão com a sala caiu.'); return; }
        clearTimeout(timer);
        peer.destroy();
        reject(new Error(e.type === 'peer-unavailable' ? 'Sala não encontrada. Confira o código.'
          : e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' ? 'Sem conexão com o servidor de salas.' : 'Não deu para entrar (' + e.type + ').'));
      });
    });
  }

  // jogador → anfitrião
  sendHost(msg) {
    if (this.isHost) later(() => this.onHostMsg(this.myId, msg));
    else if (this.conn && this.conn.open) this.conn.send(msg);
  }

  // anfitrião → todos
  broadcast(msg) {
    for (const c of this.conns.values()) if (c.open) c.send(msg);
    later(() => this.onMsg(msg));
  }

  // anfitrião → um jogador
  sendTo(id, msg) {
    if (id === this.myId) later(() => this.onMsg(msg));
    else { const c = this.conns.get(id); if (c && c.open) c.send(msg); }
  }

  kick(id) {
    const c = this.conns.get(id);
    if (c) setTimeout(() => c.close(), 300);
  }

  close() {
    if (this.peer) this.peer.destroy();
    this.peer = null;
    this.conn = null;
    this.conns.clear();
  }
}
