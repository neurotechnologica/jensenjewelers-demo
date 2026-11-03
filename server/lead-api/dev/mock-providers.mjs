// Local stand-in for Stripe Checkout + Paystack, for tests and for trying the payment flow on a laptop with NO real provider and NO real money.
// Point the API at it:  STRIPE_API_BASE=http://127.0.0.1:<port>  PAYSTACK_API_BASE=http://127.0.0.1:<port>
// It serves a tiny "hosted page" with a "Complete test payment" button; pressing it sends a correctly SIGNED webhook to the API (the same
// signature code path the real providers use) and redirects back to the success URL.
import http from 'node:http';
import { signStripe } from '../lib/payments/stripe.mjs';
import { signPaystack } from '../lib/payments/paystack.mjs';

const page = (title, id, amount, cur) => `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>${title}</title><body style="font:16px system-ui;padding:24px;max-width:420px;margin:auto"><h1 style="font-size:20px">${title}</h1><p data-testid="mock-amount">${(amount / 100).toFixed(2)} ${cur}</p><form method=post action="/pay/${id}/complete"><button data-testid="mock-pay" style="font-size:16px;padding:14px 18px;width:100%">Complete test payment</button></form><form method=post action="/pay/${id}/cancel" style="margin-top:12px"><button data-testid="mock-cancel" style="font-size:16px;padding:14px 18px;width:100%">Cancel</button></form></body>`;

export async function startMockProviders({ webhookBase, stripeWebhookSecret, paystackSecret, stripeKey = 'sk_test_mock', paystackKey = 'sk_test_mock' }) {
  const sessions = new Map(); // id -> { kind, amount, currency, leadId, successUrl, cancelUrl }
  const calls = [];
  let n = 0, port = 0;
  const deliver = async (path, body, headers) => { const r = await fetch(`${webhookBase}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body }); calls.push({ kind: 'webhook-out', path, status: r.status }); return r.status; };

  const srv = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const url = new URL(req.url, 'http://x');
      const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      try {
        if (req.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
          calls.push({ kind: 'stripe-create', headers: req.headers, form: Object.fromEntries(new URLSearchParams(raw)) });
          if (req.headers.authorization !== `Bearer ${stripeKey}`) return json(401, { error: { message: 'Invalid API Key' } });
          const f = new URLSearchParams(raw);
          const id = `cs_test_${++n}`;
          sessions.set(id, { kind: 'stripe', amount: Number(f.get('line_items[0][price_data][unit_amount]')), currency: f.get('line_items[0][price_data][currency]'), leadId: f.get('client_reference_id'), successUrl: f.get('success_url'), cancelUrl: f.get('cancel_url') });
          return json(200, { id, url: `http://127.0.0.1:${port}/pay/${id}` });
        }
        if (req.method === 'POST' && url.pathname === '/transaction/initialize') {
          const b = JSON.parse(raw || '{}');
          calls.push({ kind: 'paystack-init', headers: req.headers, body: b });
          if (req.headers.authorization !== `Bearer ${paystackKey}`) return json(401, { status: false, message: 'Invalid key' });
          sessions.set(b.reference, { kind: 'paystack', amount: b.amount, currency: b.currency, leadId: b.metadata?.lead_id, successUrl: b.callback_url, cancelUrl: b.callback_url });
          return json(200, { status: true, message: 'ok', data: { authorization_url: `http://127.0.0.1:${port}/pay/${b.reference}`, access_code: 'ac_mock', reference: b.reference } });
        }
        const m = url.pathname.match(/^\/pay\/([^/]+)(\/complete|\/cancel)?$/);
        if (m) {
          const s = sessions.get(decodeURIComponent(m[1]));
          if (!s) { res.writeHead(404); return res.end('unknown session'); }
          if (req.method === 'GET' && !m[2]) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page(s.kind === 'stripe' ? 'Mock Stripe Checkout (test)' : 'Mock Paystack (test)', m[1], s.amount, s.currency.toUpperCase())); }
          if (req.method === 'POST' && m[2] === '/complete') {
            if (s.kind === 'stripe') {
              const body = JSON.stringify({ id: `evt_mock_${++n}`, type: 'checkout.session.completed', data: { object: { id: m[1], client_reference_id: s.leadId, payment_status: 'paid', amount_total: s.amount, currency: s.currency, metadata: { lead_id: s.leadId } } } });
              await deliver('/api/pay/webhook/stripe', body, { 'stripe-signature': signStripe(body, stripeWebhookSecret) });
            } else {
              const body = JSON.stringify({ event: 'charge.success', data: { id: ++n, reference: m[1], status: 'success', amount: s.amount, currency: s.currency.toUpperCase(), metadata: { lead_id: s.leadId } } });
              await deliver('/api/pay/webhook/paystack', body, { 'x-paystack-signature': signPaystack(body, paystackSecret) });
            }
            res.writeHead(303, { location: s.successUrl }); return res.end();
          }
          if (req.method === 'POST' && m[2] === '/cancel') { res.writeHead(303, { location: s.cancelUrl }); return res.end(); }
        }
        res.writeHead(404); res.end('not found');
      } catch (e) { res.writeHead(500); res.end(String(e.message)); }
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  port = srv.address().port;
  return { port, base: `http://127.0.0.1:${port}`, sessions, calls, close: () => new Promise((r) => { srv.close(() => r()); srv.closeAllConnections?.(); }) };
}
