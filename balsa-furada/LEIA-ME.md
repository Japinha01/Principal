# Balsa Furada

Co-op de 1 a 6 amigos numa balsa velha descendo o rio. Um pilota, outro bombeia água, outro tapa os furos com tábuas e alguém pesca os tesouros que passam boiando. No fim de cada trecho tem um porto: o Barqueiro compra o que chegou no convés e cobra o pedágio para seguir. Faltou dinheiro, acabou a viagem. E tem a roleta dele, com o dinheiro que é de todo mundo.

## Como funciona

- **Leme:** fica atrás. Bater em pedra ou na margem abre furo e pode derrubar gente e carga no rio.
- **Bomba:** segure `E` para tirar água. Se a água chegar a 100%, a balsa afunda.
- **Tábuas:** pegue na pilha, leve até o furo e segure `E`. Acabou? Compre mais no porto.
- **Boia:** puxa de volta quem caiu. Sem ninguém na água, ela fisga o tesouro mais perto.
- **Área de carga:** a frente com corda. O que fica lá não cai nas batidas, e dali ninguém escorrega.
- **Peso:** quanto mais carga, mais água entra pelos furos. Ganância afunda.
- **Quem cai** nada até a balsa e sobe com `Espaço`. Se ficar mais de 40 m para trás, só volta no próximo porto.
- **Porto:** vende a carga, conserta a balsa, tem a loja de melhorias e a roleta (vermelho/preto ×2, verde ×14). Todo mundo dá "Zarpar" e o pedágio é cobrado.
- Cada trecho fica mais longo, com mais pedras e corredeiras, e o horário muda: manhã, meio-dia, tarde, pôr do sol e noite.

Controles: `WASD` anda, `Shift` corre, `Espaço` pula ou sobe, `E` usa, clique arremessa, `F` empurra um amigo, `Enter` abre o chat, `Tab` abre o painel do porto, `Esc` pausa, `F11` tela cheia.

## Jogar com os amigos (online)

1. Um jogador clica em **Criar sala** e passa o código de 5 letras.
2. Os outros digitam o código e clicam em **Entrar na sala**.

A conexão é direta entre os computadores (WebRTC). O servidor público do PeerJS só apresenta um jogador ao outro, então não precisa de servidor próprio. Quem cria a sala roda a balsa: se essa pessoa sair, a sala fecha.

Se algum dia o servidor público do PeerJS cair, dá para usar um próprio (`npx peerjs --port 9000`) e abrir o jogo com `?servidor=host:9000` no endereço.

## Gerar o .exe (Windows)

É automático pelo GitHub Actions (`.github/workflows/balsa-furada.yml`):

- **Todo push** que mexe em `balsa-furada/` gera o instalador e o `.exe` portátil. Baixe em *Actions → Balsa Furada (Windows) → a execução → Artifacts → BalsaFurada-Windows*.
- **Uma tag** `balsa-v1.0.0` (por exemplo) também cria uma *Release* com os dois `.exe`, com link público para mandar aos amigos.

Saem dois arquivos:

- `BalsaFurada-1.0.0-instalador.exe`: instala, cria atalho na área de trabalho e no menu Iniciar.
- `BalsaFurada-1.0.0-portatil.exe`: roda direto, sem instalar.

O `.exe` não é assinado digitalmente, então o Windows SmartScreen pode avisar na primeira vez: clique em *Mais informações → Executar assim mesmo*.

Para gerar na sua máquina Windows:

```
cd balsa-furada
npm install
npm run dist        # instalador + portátil em dist/
npm start           # abre o jogo sem empacotar
```

## Onde fica cada coisa

```
balsa-furada/
├── main.js            app de computador (Electron): janela, F11, serve o jogo
├── package.json       versão, dependências e configuração do instalador
├── build/icon.png     ícone do app
└── jogo/              o jogo em si (HTML + JS, roda também no navegador)
    ├── index.html     menus, HUD, painéis e estilos
    ├── src/data.js    números do jogo: itens, preços, pedágio, roleta
    ├── src/river.js   gera o rio de cada trecho a partir de uma semente
    ├── src/sim.js     simulação (roda só em quem criou a sala)
    ├── src/net.js     salas online (PeerJS)
    ├── src/player.js  movimento do seu marujo
    ├── src/render.js  cena 3D (three.js)
    ├── src/models.js  modelos 3D feitos por código
    ├── src/audio.js   sons sintetizados
    └── src/main.js    menu, controles, interações e painéis
```

Para lançar uma versão nova, suba `version` no `package.json` **e** `VERSAO` em `jogo/src/data.js`. A sala recusa jogadores com versão diferente, porque a simulação precisa ser igual para todo mundo.

A pasta `jogo/` também funciona como site: `japax01.com.br/balsa-furada/jogo/` depois do deploy.
