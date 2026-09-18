// Confere no Mercado Pago se um pagamento do Sina foi aprovado e qual pacote ele comprou.
// Usa a mesma variável MP_ACCESS_TOKEN da outra função.

// Precisa bater com os preços de sina-pagamento.js
const PRECOS = { almas_p: 4.90, almas_g: 12.90, apoiador: 14.90 };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = String((req.query && req.query.id) || '').replace(/\D/g, '');
  if (!id) return res.status(400).json({ ok: false, status: 'sem_id' });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ ok: false, status: 'sem_token' });

  try {
    const resposta = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resposta.ok) return res.status(200).json({ ok: false, status: 'nao_encontrado' });

    const pagamento = await resposta.json();
    const pacote = pagamento.external_reference;
    const preco = PRECOS[pacote];
    const aprovado = pagamento.status === 'approved'
      && preco !== undefined
      && Number(pagamento.transaction_amount) >= preco - 0.001;

    return res.status(200).json({ ok: aprovado, status: pagamento.status, pacote: aprovado ? pacote : null });
  } catch (e) {
    return res.status(502).json({ ok: false, status: 'erro' });
  }
};
