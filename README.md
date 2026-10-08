# japax01.com.br

Meu site pessoal: o ponto de entrada para tudo que eu construo, com portfólio, produto, jogos e a Guilda.

![Portfólio](portfolio/og.jpg)

🌐 **[japax01.com.br](https://japax01.com.br)** · 📁 **[Portfólio](https://japax01.com.br/portfolio)**

## O que tem aqui

| Caminho | O que é |
|---|---|
| `/` | Página inicial: um cartão para cada projeto |
| `/portfolio` | Portfólio de automação e sistemas: projetos em destaque, produtos, front-end e stack |
| `/streammarker` | Página de venda do **StreamMarker Pro** (PT/EN), produto desktop para streamers |
| `/twitch-pip` | Código da extensão **Twitch PiP** para Chrome/Edge (Picture-in-Picture no player da Twitch). Ver [twitch-pip/README.md](twitch-pip/README.md) |
| `/game` | **Fundição 7**, jogo 3D de fábrica (Three.js, PWA). Código em [Fundicao7](https://github.com/Japinha01/Fundicao7) |
| `/sina` | **Sina**, roguelite de cartas (Canvas, PWA, 7 idiomas, conta com Firebase, compras e anúncios). Código em [Sina](https://github.com/Japinha01/Sina) |
| `/api` | Funções serverless da Vercel para as compras do Sina pelo **Mercado Pago** (Checkout Pro) |
| `/guilda` | Redireciona para [guilda.japax01.com.br](https://guilda.japax01.com.br) |

## Tecnologias

HTML, CSS e JavaScript puros, feitos à mão e sem framework · Vercel (hospedagem, redirecionamentos e funções serverless) · Mercado Pago · Firebase Auth · PWA (service worker e manifest)

## Rodar localmente

É um site estático: basta servir a pasta.

```bash
npx serve .        # ou: python -m http.server
```

As funções em `api/` rodam com `vercel dev` e precisam das variáveis `MP_ACCESS_TOKEN` e `SINA_URL` (ver [LEIA-ME.md](LEIA-ME.md), que explica a configuração de compras e anúncios do Sina).
