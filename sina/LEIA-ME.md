# Sina — como publicar com anúncios e compras

## 1. Onde colocar cada arquivo no seu projeto da Vercel

```
(raiz do projeto japax01)
├── ads.txt                    ← na raiz do site (troque pelo seu ID do AdSense)
├── api/
│   ├── sina-pagamento.js      ← cria o pagamento no Mercado Pago
│   └── sina-confirmar.js      ← confere se o pagamento foi aprovado
└── sina/
    ├── index.html             ← o jogo
    └── privacidade.html       ← política de privacidade (preencha data e e-mail)
```

A pasta `api` precisa ficar **na raiz** do projeto, não dentro de `sina`.

## 2. Configurar o jogo

Abra `sina/index.html` e procure o bloco **CONFIGURAÇÃO DO SITE** logo no começo:

```js
adsenseClient: '',   // seu ID do AdSense, ex.: 'ca-pub-1234567890123456'
adsenseTest: true,   // true enquanto testa; false depois da aprovação
lojaApi: '/api',     // ativa o Tesouro (compras)
privacidade: '/sina/privacidade.html'
```

Com `adsenseClient` vazio, o jogo funciona sem anúncios. Com `lojaApi` vazio, o Tesouro fica escondido.

## 3. Mercado Pago (compras)

1. Entre em **Mercado Pago Developers → Suas integrações** e crie uma aplicação (Checkout Pro).
2. Copie o **Access Token de produção**. Para testar antes, use o de teste.
3. Na Vercel: **Settings → Environment Variables**:
   - `MP_ACCESS_TOKEN` = seu Access Token
   - `SINA_URL` = `https://japax01.com.br/sina/` (opcional, mas recomendado)
4. Faça um novo deploy.
5. Teste uma compra. Depois do pagamento, o Mercado Pago volta para o jogo e aplica o pacote sozinho.

**Preços:** se mudar algum preço, altere nos **dois** lugares: na lista `PACOTES` dentro do `index.html` (texto mostrado) e em `api/sina-pagamento.js` e `api/sina-confirmar.js` (valor cobrado e conferido).

**Restaurar compra:** o jogador digita o número do pagamento (está no comprovante do Mercado Pago) em Tesouro → Restaurar compra. Serve para outro aparelho ou para pagamentos que demoraram a aprovar (Pix pendente, por exemplo).

## 4. Google AdSense para Jogos

1. Crie a conta no AdSense e adicione o site `japax01.com.br`.
2. Coloque o `ads.txt` na raiz, com o seu `pub-...` no lugar dos zeros.
3. Publique a política de privacidade e deixe o link nas Opções do jogo (campo `privacidade`).
4. Em **Privacidade e mensagens**, ative a mensagem de consentimento (exigida para visitantes da Europa e do Reino Unido).
5. Peça acesso aos **anúncios para jogos H5 (AdSense for Games)**. A aprovação é do Google e não é automática.
6. Enquanto não aprovar, deixe `adsenseTest: true`. Depois, mude para `false`.

## 5. Onde aparecem os anúncios

- **Intervalos:** ao clicar em Jogar e entre rodadas. O Google controla a frequência (no mínimo 2 minutos entre intervalos). Quem tem o Pacote Apoiador não vê intervalos.
- **Recompensados** (sempre opcionais, o jogador escolhe):
  - Reviver ao morrer
  - Dobrar as almas no fim da partida
  - Trocar as cartas quando acabam as trocas grátis (uma vez por rodada)
  - Bolsa do mercador: +15 moedas (uma vez por visita)
  - Presente diário extra: +80 almas (uma vez por dia)
  - Jogar com bênção: começa a partida com um baú

## 6. Testar sem anúncios de verdade

Abra o jogo com `?anuncios=teste` no fim do endereço. Todos os botões de anúncio aparecem e dão a recompensa na hora, sem mostrar nada.

## 7. Créditos obrigatórios

Já estão em Opções → Créditos:
- Super Pixel Effects Gigapack — Will Tice / unTied Games (crédito exigido pela licença)
- 32rogues — Seth Boyles
- Kenney (kenney.nl)

As licenças permitem uso comercial dentro do jogo, mas **não** permitem redistribuir os pacotes de arte separados.
