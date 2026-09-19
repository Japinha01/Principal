// Cria o pagamento do Sina no Mercado Pago (Checkout Pro) e devolve o link de pagamento.
// Variáveis de ambiente na Vercel:
//   MP_ACCESS_TOKEN  (obrigatória) — Access Token de produção da sua aplicação no Mercado Pago
//   SINA_URL         (opcional)    — endereço do jogo, ex.: https://japax01.com.br/sina/

// Os preços precisam ser iguais aos da lista PACOTES dentro do jogo (sina/index.html).
const PACOTES = {
  almas_p:  { titulo: 'Sina — Punhado de almas (1.000 almas)',   preco: 4.90 },
  almas_g:  { titulo: 'Sina — Caldeirão de almas (3.500 almas)', preco: 12.90 },
  apoiador: { titulo: 'Sina — Pacote Apoiador',                   preco: 14.90 },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'use POST' });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ erro: 'MP_ACCESS_TOKEN não configurado na Vercel' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const id = body && body.pacote;
  const pacote = PACOTES[id];
  if (!pacote) return res.status(400).json({ erro: 'pacote inválido' });

  const base = process.env.SINA_URL || `https://${req.headers.host}/sina/`;

  try {
    const resposta = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        items: [{ id, title: pacote.titulo, quantity: 1, unit_price: pacote.preco, currency_id: 'BRL' }],
        external_reference: id,
        back_urls: {
          success: `${base}?pagamento=ok`,
          failure: `${base}?pagamento=falhou`,
          pending: `${base}?pagamento=pendente`,
        },
        auto_return: 'approved',
        statement_descriptor: 'SINA JOGO',
      }),
    });
    const dados = await resposta.json();
    if (!resposta.ok) return res.status(502).json({ erro: 'mercado pago recusou', detalhe: dados.message });
    return res.status(200).json({ url: dados.init_point });
  } catch (e) {
    return res.status(502).json({ erro: 'falha ao falar com o mercado pago' });
  }
};
