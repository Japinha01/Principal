# Twitch PiP

Extensão para Chrome, Edge, Brave e Opera que adiciona um botão de **Picture-in-Picture** ao player da Twitch: a live fica numa janela flutuante enquanto você usa outras abas ou programas.

- Botão novo na barra do player, ao lado da tela cheia
- Atalho **Alt+P** (não dispara enquanto você digita no chat)
- Continua funcionando quando você troca de canal
- Não pede nenhuma permissão além de rodar na twitch.tv e não coleta nada

## Instalar para testar

1. Baixe esta pasta (`twitch-pip`).
2. Abra `chrome://extensions` (no Edge: `edge://extensions`).
3. Ligue o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e escolha a pasta `twitch-pip`.
5. Abra uma live na Twitch.

Depois de mudar o código, clique em ↻ na extensão em `chrome://extensions` e recarregue a aba da Twitch.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `manifest.json` | Configuração da extensão (Manifest V3) |
| `content.js` | Insere o botão no player e cuida do PiP e do atalho |
| `icons/` | Ícones da extensão |

## Publicar

Para a Chrome Web Store: compacte o conteúdo da pasta num `.zip` e envie em https://chrome.google.com/webstore/devconsole (taxa única de US$ 5). A mesma `.zip` serve para a loja de complementos do Edge, que é grátis.

O Firefox não deixa extensões abrirem o PiP por código; lá o PiP já vem embutido no navegador.
