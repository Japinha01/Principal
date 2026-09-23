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
    ├── privacidade.html       ← política de privacidade (preencha data e e-mail)
    ├── manifest.json          ← dados do app instalável
    ├── sw.js                  ← permite instalar e jogar sem internet
    ├── og-capa.jpg            ← imagem que aparece ao compartilhar o link
    ├── icon-32.png
    ├── icon-180.png
    ├── icon-192.png
    └── icon-512.png
```

Esses arquivos substituem os antigos com o mesmo nome que já estavam na pasta `sina`.

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

## 7. App instalável e compartilhamento

**Endereço com barra no final.** `japax01.com.br/sina` e `japax01.com.br/sina/` precisam funcionar igual. Sem a barra, o navegador procura os arquivos na raiz do site e a instalação do app falha. O `vercel-exemplo.json` traz o redirecionamento que resolve isso:

```json
"redirects": [
  { "source": "/sina", "destination": "/sina/", "permanent": false }
]
```

Copie esse bloco para o seu `vercel.json` da raiz (junte com o que já existir) e faça um novo deploy.

**Se o endereço do jogo não for `japax01.com.br/sina/`**, abra `sina/index.html` e troque o domínio nas linhas `og:url` e `og:image` do começo do arquivo. É o que faz o link mostrar capa, título e descrição no WhatsApp, Discord e redes sociais.

**Se o ícone antigo continuar aparecendo** na aba ou o app não atualizar, force a recarga com Ctrl + Shift + R no computador. No celular, feche a aba e abra de novo. O `sw.js` guarda a versão antiga até trocar o número em `VERSAO`.

**Importante:** apague os arquivos antigos `manifest.webmanifest` e `sw.js` que já estavam na pasta, para não conflitarem com os novos.


No celular (Chrome/Edge) e no computador, aparece o botão **Instalar o app** no menu quando o navegador permite. No iPhone o botão também aparece, mas mostrando o passo a passo, porque a Apple não permite instalação automática. O jogo instalado abre em tela cheia, com ícone próprio, e funciona sem internet (menos anúncios e compras).

Ao publicar uma versão nova do jogo, abra `sina/sw.js` e mude `VERSAO` (por exemplo de `sina-v8` para `sina-v9`), para os jogadores receberem a atualização.



## 8. Login e save na nuvem (Firebase)

1. Entre em **console.firebase.google.com** e crie um projeto (pode ser "sina-jogo").
2. Em **Criação → Authentication → Começar**, ative os métodos:
   - **Google** (obrigatório)
   - **Anônimo** (para o modo convidado)
   - **Apple** (opcional; exige conta paga no Apple Developer Program, US$ 99 por ano)
3. Em **Authentication → Settings → Domínios autorizados**, adicione `japax01.com.br`.
4. Em **Criação → Firestore Database**, crie o banco em modo produção e cole estas regras em **Regras**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /saves/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /wishlist/{id} {
      allow create: if request.auth != null
        && request.resource.data.email is string
        && request.resource.data.email.size() < 150;
      allow read, update, delete: if false;
    }
    match /feedback/{id} {
      allow create: if request.auth != null
        && request.resource.data.texto is string
        && request.resource.data.texto.size() < 1500;
      allow read, update, delete: if false;
    }
  }
}
```

Os feedbacks aparecem no **Firestore → Dados → feedback** e os e-mails da lista em **Dados → wishlist**. Ninguém consegue ler os feedbacks pelo site, só você pelo console.

Isso garante que cada jogador só acessa o próprio save.

5. Em **Configurações do projeto → Seus apps → Web**, registre um app e copie o objeto de configuração.
6. Cole no bloco **CONFIGURAÇÃO DO SITE** do `sina/index.html`:

```js
appleLogin: false,   // mude para true se ativar o Apple
firebase: {
  apiKey: 'AIza...',
  authDomain: 'sina-jogo.firebaseapp.com',
  projectId: 'sina-jogo',
  appId: '1:123...:web:abc...'
}
```

Com `firebase: null`, o botão Conta some do menu e o jogo funciona só com o save local.

**Como funciona para o jogador:** ao entrar, o jogo compara o progresso do aparelho com o da conta. Se os dois tiverem conteúdo, ele **pergunta qual manter**. Depois disso, o save sobe para a nuvem sozinho ao fim de cada partida. Quem joga como convidado pode vincular a conta depois sem perder nada.

**Custo:** a camada gratuita do Firebase cobre com folga um jogo pequeno (50 mil leituras e 20 mil gravações por dia).

## 9. Página de lançamento, lista de espera e beta

**Endereço:** a Vercel serve o arquivo em `japax01.com.br/sina/lancamento.html`. Para o endereço curto (`/sina/lancamento`) funcionar, o `vercel-exemplo.json` traz a regra:

```json
"rewrites": [
  { "source": "/sina/lancamento", "destination": "/sina/lancamento.html" }
]
```

O arquivo `sina/lancamento.html` é a página de divulgação: capa, o que é o Sina, capturas, estado do beta e o formulário da lista de espera. É esse endereço que vale a pena compartilhar, e não o do jogo em si.

**Lista de espera:** os e-mails caem no Firestore, em **Dados → wishlist**, com data, idioma e origem. Dá para exportar pelo console quando quiser avisar todo mundo.

**Janelas do beta.** Configure em dois lugares, com as mesmas datas:
1. No começo de `sina/lancamento.html`, no bloco `const BETA`.
2. No `sina/index.html`, no bloco de configuração, campo `beta`.

```js
beta: {
  ativo: true,                    // false libera o jogo para todo mundo
  codigo: 'SINA2026',             // código de acesso antecipado (amigos, streamers)
  pagina: '/sina/lancamento.html',
  janelas: [
    {de: '2026-09-26T19:00:00-03:00', ate: '2026-09-26T23:59:00-03:00'}
  ]
}
```

Fora das janelas, quem abrir o jogo vê uma tela com contagem regressiva, o campo de código e o link para a lista. Quem digita o código certo fica liberado naquele aparelho para sempre.

**Dica de divulgação:** anuncie a janela com um ou dois dias de antecedência e deixe ela curta (3 a 5 horas). Muita gente entrando junto rende mais feedback e dá sensação de evento.

## 10. Créditos obrigatórios

Já estão em Opções → Créditos:
- Super Pixel Effects Gigapack — Will Tice / unTied Games (crédito exigido pela licença)
- 32rogues — Seth Boyles
- Kenney (kenney.nl)

As licenças permitem uso comercial dentro do jogo, mas **não** permitem redistribuir os pacotes de arte separados.
