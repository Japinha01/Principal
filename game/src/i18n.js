/* ============================================================
   FUNDIÇÃO 7 — textos (pt / en)
   ============================================================ */
const pt = {
  item: {
    minerio_ferro: 'Minério de ferro', minerio_cobre: 'Minério de cobre', carvao: 'Carvão', areia: 'Areia',
    petroleo: 'Petróleo', minerio_titanio: 'Minério de titânio', barra_ferro: 'Barra de ferro', barra_cobre: 'Barra de cobre',
    vidro: 'Vidro', chapa: 'Chapa de ferro', engrenagem: 'Engrenagem', fio: 'Fio de cobre', motor: 'Motor',
    circuito: 'Circuito', plastico: 'Plástico', robo: 'Robô', lingote_ti: 'Lingote de titânio', chapa_ti: 'Chapa de titânio',
    peca_foguete: 'Peça de foguete',
  },
  ore: { ferro: 'ferro', cobre: 'cobre', carvao: 'carvão', areia: 'areia', petroleo: 'petróleo', titanio: 'titânio' },
  m: {
    esteira: ['Esteira', 'Leva itens na direção da seta. Arraste para desenhar o caminho.'],
    mina: ['Mina', 'Vai em cima de um depósito de minério e solta o minério pela frente.'],
    mina2: ['Mina turbo', 'Uma mina bem mais rápida. Consome mais energia.'],
    bomba: ['Bomba de petróleo', 'Vai em cima de uma poça de petróleo e bombeia barris.'],
    fornalha: ['Fornalha', 'Derrete minério em barras. Mais tarde, derrete areia em vidro.'],
    divisor: ['Divisor', 'Reparte o que entra entre as outras saídas, uma por vez.'],
    cruzamento: ['Cruzamento', 'Deixa duas esteiras se cruzarem sem misturar.'],
    prensa: ['Prensa', 'Amassa barras em chapas.'],
    torno: ['Torno', 'Transforma barras de ferro em engrenagens.'],
    gerador: ['Gerador', 'Queima carvão e gera 25 MW quando a fábrica precisa.'],
    trefiladora: ['Trefiladora', 'Estica uma barra de cobre em 2 fios.'],
    montadora: ['Montadora', 'Monta motores e circuitos.'],
    turbina: ['Turbina eólica', '12 MW de graça, o tempo todo.'],
    refinaria: ['Refinaria', 'Transforma petróleo em plástico.'],
    fabrica: ['Fábrica', 'Monta robôs e peças de foguete.'],
    inducao: ['Forno de indução', 'Derrete titânio com carvão. Gasta muita energia.'],
    plataforma: ['Plataforma de lançamento', 'Receba aqui as peças do foguete. Só dá para ter uma.'],
    sede: ['Sede', 'Recebe tudo que chega, paga por cada item e conta os marcos.'],
  },
  era: ['', 'Primeira faísca', 'Oficina', 'Motores', 'Eletrônica', 'Petróleo e robôs', 'Rumo às estrelas'],
  group: { logistica: 'Logística', extracao: 'Extração', producao: 'Produção', energia: 'Energia', especial: 'Especial' },
  up: {
    esteiras: ['Esteiras rápidas', '+25% de velocidade nas esteiras'],
    maquinas: ['Máquinas turbinadas', '+20% de velocidade nas máquinas'],
    minas: ['Brocas afiadas', '+25% de velocidade nas minas'],
    vendas: ['Contratos melhores', '+15% no valor de cada entrega'],
  },
  st: {
    ok: 'Trabalhando', idle: 'Esperando o primeiro item', noinput: 'Faltando insumo', blocked: 'Saída cheia — ligue uma esteira na frente',
    nopower: 'Pouca energia', nofuel: 'Sem carvão', off: 'Desligado',
  },
  ui: {
    coins: 'Moedas', perMin: '/min', power: 'Energia', era: 'Era', goal: 'Marco', of: 'de', reward: 'Recompensa', unlocks: 'Libera',
    show: 'Mostrar', build: 'Construir', upgrades: 'Melhorias', menu: 'Menu', rotate: 'Girar', remove: 'Remover', cancel: 'Cancelar',
    close: 'Fechar', recipe: 'Receita', auto: 'Automática', inputs: 'Entrada', output: 'Saída', status: 'Situação',
    lockedEra: 'Era {n}', lockedGoal: 'Próximo marco', cost: 'Custo', level: 'Nível', max: 'Máximo', buy: 'Comprar',
    needEra: 'Libera na era {n}', play: 'Jogar', continue: 'Continuar', newGame: 'Novo jogo', sound: 'Som', music: 'Música',
    on: 'ligado', off: 'desligado', language: 'Idioma', save: 'Salvar', export: 'Exportar save', import: 'Importar save',
    exported: 'Save copiado! Guarde esse texto.', importPrompt: 'Cole aqui o texto do save:', importBad: 'Esse save não funcionou.',
    confirmNew: 'Começar uma ilha nova? O progresso atual será apagado.', saved: 'Jogo salvo',
    goalDone: 'Marco concluído!', eraUp: 'Nova era!', islandGrew: 'A ilha cresceu e revelou novos depósitos:',
    unlocked: 'Desbloqueado', keepGoing: 'Bora!', launchTitle: 'Lançamento!', victoryTitle: 'Você chegou às estrelas!',
    victoryText: 'A Fundição 7 lançou seu foguete. A ilha é sua: continue expandindo à vontade.',
    playTime: 'Tempo de jogo', totalMade: 'Itens produzidos', totalEarned: 'Itens entregues', keepPlaying: 'Continuar jogando',
    away: 'Enquanto você esteve fora, a fábrica rendeu {v}.', tapToStart: 'Uma fábrica de brinquedo numa ilha que cresce.',
    controls: 'Controles', ctlDesk: 'Clique: construir · Arraste: esteira · R: girar · Botão direito: remover · Q/E: girar câmera · Roda: zoom · Espaço/botão do meio + arrastar: mover',
    ctlTouch: 'Toque: construir · Arraste: esteira · Dois dedos: mover e zoom',
    why: {
      water: 'Só dá para construir em terra firme.', occupied: 'Já tem algo aqui.', needore: 'A mina precisa ficar em cima de um depósito de minério.',
      needoil: 'A bomba precisa ficar numa poça de petróleo.', money: 'Moedas insuficientes.', locked: 'Ainda bloqueado.',
      unique: 'Só pode existir uma.', invalid: 'Não dá para construir isso.',
    },
    rotateHint: 'R ou botão ↻ para girar', freePlay: 'Modo livre', seed: 'Ilha',
    stats: 'Estatísticas', launchIn: 'Peças do foguete',
  },
  hint: {
    hint_mine: 'Coloque uma {m} no depósito de {ore} (a seta amarela mostra onde).',
    hint_to_hub: 'Leve {it} até a Sede com esteiras.',
    hint_to_pad: 'Leve as {it} até a Plataforma de lançamento.',
    hint_build: 'Construa uma {m} (barra de baixo).',
    hint_recipe: 'Toque numa {m} e escolha a receita de {it}.',
    hint_feed: 'Leve {it} até a {m} com esteiras.',
    hint_power_build: 'A energia acabou! Construa um Gerador e leve carvão até ele.',
    hint_power_more: 'Energia fraca: mais Geradores com carvão ou Turbinas eólicas.',
    hint_scale: 'Tudo ligado! Mais máquinas em paralelo = marco mais rápido.',
    hint_wait_unlock: 'Complete os marcos para liberar a {m}.',
    hint_free: 'Modo livre: expanda a fábrica como quiser!',
  },
};

const en = {
  item: {
    minerio_ferro: 'Iron ore', minerio_cobre: 'Copper ore', carvao: 'Coal', areia: 'Sand', petroleo: 'Crude oil',
    minerio_titanio: 'Titanium ore', barra_ferro: 'Iron bar', barra_cobre: 'Copper bar', vidro: 'Glass', chapa: 'Iron plate',
    engrenagem: 'Gear', fio: 'Copper wire', motor: 'Motor', circuito: 'Circuit', plastico: 'Plastic', robo: 'Robot',
    lingote_ti: 'Titanium ingot', chapa_ti: 'Titanium plate', peca_foguete: 'Rocket part',
  },
  ore: { ferro: 'iron', cobre: 'copper', carvao: 'coal', areia: 'sand', petroleo: 'oil', titanio: 'titanium' },
  m: {
    esteira: ['Belt', 'Carries items the way the arrow points. Drag to draw a path.'],
    mina: ['Miner', 'Goes on an ore deposit and pushes ore out the front.'],
    mina2: ['Turbo miner', 'A much faster miner. Uses more power.'],
    bomba: ['Oil pump', 'Goes on an oil puddle and pumps barrels.'],
    fornalha: ['Furnace', 'Melts ore into bars. Later, melts sand into glass.'],
    divisor: ['Splitter', 'Shares what comes in between the other sides, one at a time.'],
    cruzamento: ['Crossing', 'Lets two belts cross without mixing.'],
    prensa: ['Press', 'Squashes bars into plates.'],
    torno: ['Lathe', 'Turns iron bars into gears.'],
    gerador: ['Generator', 'Burns coal for 25 MW when the factory needs it.'],
    trefiladora: ['Wire drawer', 'Stretches one copper bar into 2 wires.'],
    montadora: ['Assembler', 'Builds motors and circuits.'],
    turbina: ['Wind turbine', 'Free 12 MW, all the time.'],
    refinaria: ['Refinery', 'Turns oil into plastic.'],
    fabrica: ['Factory', 'Builds robots and rocket parts.'],
    inducao: ['Induction furnace', 'Melts titanium with coal. Power hungry.'],
    plataforma: ['Launch pad', 'Deliver rocket parts here. Only one allowed.'],
    sede: ['HQ', 'Takes everything, pays for each item and tracks milestones.'],
  },
  era: ['', 'First spark', 'Workshop', 'Motors', 'Electronics', 'Oil & robots', 'To the stars'],
  group: { logistica: 'Logistics', extracao: 'Mining', producao: 'Production', energia: 'Power', especial: 'Special' },
  up: {
    esteiras: ['Fast belts', '+25% belt speed'],
    maquinas: ['Turbo machines', '+20% machine speed'],
    minas: ['Sharp drills', '+25% miner speed'],
    vendas: ['Better contracts', '+15% value per delivery'],
  },
  st: {
    ok: 'Working', idle: 'Waiting for the first item', noinput: 'Missing input', blocked: 'Output full — connect a belt in front',
    nopower: 'Low power', nofuel: 'Out of coal', off: 'Off',
  },
  ui: {
    coins: 'Coins', perMin: '/min', power: 'Power', era: 'Era', goal: 'Milestone', of: 'of', reward: 'Reward', unlocks: 'Unlocks',
    show: 'Show', build: 'Build', upgrades: 'Upgrades', menu: 'Menu', rotate: 'Rotate', remove: 'Remove', cancel: 'Cancel',
    close: 'Close', recipe: 'Recipe', auto: 'Automatic', inputs: 'Input', output: 'Output', status: 'Status',
    lockedEra: 'Era {n}', lockedGoal: 'Next milestone', cost: 'Cost', level: 'Level', max: 'Max', buy: 'Buy',
    needEra: 'Unlocks in era {n}', play: 'Play', continue: 'Continue', newGame: 'New game', sound: 'Sound', music: 'Music',
    on: 'on', off: 'off', language: 'Language', save: 'Save', export: 'Export save', import: 'Import save',
    exported: 'Save copied! Keep that text somewhere.', importPrompt: 'Paste your save text here:', importBad: 'That save did not work.',
    confirmNew: 'Start a new island? Current progress will be erased.', saved: 'Game saved',
    goalDone: 'Milestone complete!', eraUp: 'New era!', islandGrew: 'The island grew and revealed new deposits:',
    unlocked: 'Unlocked', keepGoing: 'Let’s go!', launchTitle: 'Liftoff!', victoryTitle: 'You reached the stars!',
    victoryText: 'Fundição 7 launched its rocket. The island is yours: keep expanding as much as you like.',
    playTime: 'Play time', totalMade: 'Items made', totalEarned: 'Items delivered', keepPlaying: 'Keep playing',
    away: 'While you were away, the factory earned {v}.', tapToStart: 'A toy factory on an island that grows.',
    controls: 'Controls', ctlDesk: 'Click: build · Drag: belt · R: rotate · Right click: remove · Q/E: turn camera · Wheel: zoom · Space/middle button + drag: pan',
    ctlTouch: 'Tap: build · Drag: belt · Two fingers: pan and zoom',
    why: {
      water: 'You can only build on land.', occupied: 'Something is already here.', needore: 'Miners go on top of an ore deposit.',
      needoil: 'Pumps go on an oil puddle.', money: 'Not enough coins.', locked: 'Still locked.',
      unique: 'Only one allowed.', invalid: 'Can’t build that.',
    },
    rotateHint: 'R or ↻ to rotate', freePlay: 'Free play', seed: 'Island',
    stats: 'Stats', launchIn: 'Rocket parts',
  },
  hint: {
    hint_mine: 'Place a {m} on the {ore} deposit (the yellow arrow shows where).',
    hint_to_hub: 'Carry {it} to the HQ with belts.',
    hint_to_pad: 'Carry the {it} to the Launch pad.',
    hint_build: 'Build a {m} (bottom bar).',
    hint_recipe: 'Tap a {m} and pick the {it} recipe.',
    hint_feed: 'Carry {it} to the {m} with belts.',
    hint_power_build: 'Out of power! Build a Generator and bring it coal.',
    hint_power_more: 'Weak power: more Generators with coal, or Wind turbines.',
    hint_scale: 'All connected! More machines side by side = faster milestone.',
    hint_wait_unlock: 'Complete milestones to unlock the {m}.',
    hint_free: 'Free play: grow the factory however you like!',
  },
};

const LANGS = { pt, en };
export let lang = 'pt';
export function setLang(l) { lang = LANGS[l] ? l : 'pt'; }
export function detectLang() {
  try { const s = localStorage.getItem('f7-lang'); if (LANGS[s]) return s; } catch (e) { /* sem storage */ }
  return (navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
}
export const S = () => LANGS[lang];
export const itemName = (it) => S().item[it] || it;
export const mName = (m) => (S().m[m] || [m])[0];
export const mDesc = (m) => (S().m[m] || ['', ''])[1];
export function fmt(str, p = {}) { return str.replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? '')); }
export function hintText(h) {
  const tpl = S().hint[h.k] || '';
  const p = { ...(h.p || {}) };
  if (p.m) p.m = mName(p.m);
  if (p.it) p.it = itemName(p.it);
  if (h.k === 'hint_mine' && h.p && h.p.it) {
    const oreKey = Object.entries({ ferro: 'minerio_ferro', cobre: 'minerio_cobre', carvao: 'carvao', areia: 'areia', petroleo: 'petroleo', titanio: 'minerio_titanio' })
      .find(([, v]) => v === h.p.it);
    p.ore = oreKey ? S().ore[oreKey[0]] : '';
  }
  return fmt(tpl, p);
}
export const money = (n) => '$' + Math.floor(n).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');
