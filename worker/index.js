import { buildPushPayload } from '@block65/webcrypto-web-push';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: String((err && err.message) || err) }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

async function handleApi(request, env, url) {
  const { pathname } = url;
  const method = request.method;

  if (pathname === '/api/movimientos' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM movimientos ORDER BY id DESC').all();
    return json(results);
  }
  if (pathname === '/api/movimientos' && method === 'POST') {
    const b = await request.json();
    const { fecha, descripcion, monto, moneda, cuenta, categoria, tipo, ts } = b;
    const res = await env.DB.prepare(
      'INSERT INTO movimientos (fecha, descripcion, monto, moneda, cuenta, categoria, tipo, ts) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(fecha ?? null, descripcion ?? null, monto ?? null, moneda ?? null, cuenta ?? null, categoria ?? null, tipo ?? null, ts ?? null).run();
    return json({ id: res.meta.last_row_id, ...b }, 201);
  }

  if (pathname === '/api/cuentas' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM cuentas').all();
    return json(results);
  }
  const cuentaMatch = pathname.match(/^\/api\/cuentas\/([^/]+)$/);
  if (cuentaMatch && method === 'PUT') {
    const id = decodeURIComponent(cuentaMatch[1]);
    const b = await request.json();
    const saldo = b.saldo;
    const nombre = b.nombre ?? id;
    const moneda = b.moneda ?? null;
    await env.DB.prepare(
      `INSERT INTO cuentas (id, nombre, saldo, moneda) VALUES (?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET saldo = excluded.saldo,
         nombre = COALESCE(excluded.nombre, cuentas.nombre),
         moneda = COALESCE(excluded.moneda, cuentas.moneda)`
    ).bind(id, nombre, saldo ?? 0, moneda).run();
    return json({ id, nombre, saldo, moneda });
  }

  if (pathname === '/api/proyectos' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM proyectos').all();
    return json(results);
  }
  if (pathname === '/api/proyectos' && method === 'POST') {
    const b = await request.json();
    const id = String(b.id ?? Date.now());
    const nombre = b.nombre ?? '';
    const servicio = b.servicio ?? '';
    const presupuesto = b.presupuesto ?? 0;
    const cobrado = b.cobrado ?? 0;
    const estado = b.estado ?? 'activo';
    // Upsert por id: el frontend reenvía el objeto completo (p.ej. al registrar un cobro,
    // que no tiene endpoint PUT propio en el contrato), así que INSERT simple duplicaría
    // la fila. ON CONFLICT lo vuelve idempotente sin agregar rutas nuevas al contrato.
    await env.DB.prepare(
      `INSERT INTO proyectos (id, nombre, servicio, presupuesto, cobrado, estado) VALUES (?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, servicio = excluded.servicio,
         presupuesto = excluded.presupuesto, cobrado = excluded.cobrado, estado = excluded.estado`
    ).bind(id, nombre, servicio, presupuesto, cobrado, estado).run();
    return json({ id, nombre, servicio, presupuesto, cobrado, estado }, 201);
  }
  const proyMatch = pathname.match(/^\/api\/proyectos\/([^/]+)$/);
  if (proyMatch && method === 'DELETE') {
    const id = decodeURIComponent(proyMatch[1]);
    await env.DB.prepare('DELETE FROM proyectos WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  if (pathname === '/api/ai' && method === 'POST') {
    return handleAI(request, env);
  }

  if (pathname === '/api/push/subscribe' && method === 'POST') {
    const b = await request.json();
    const endpoint = b.endpoint;
    const p256dh = b.keys?.p256dh;
    const auth = b.keys?.auth;
    if (!endpoint || !p256dh || !auth) return json({ error: 'Suscripción incompleta' }, 400);
    await env.DB.prepare(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?,?,?,?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`
    ).bind(endpoint, p256dh, auth, new Date().toISOString()).run();
    return json({ ok: true }, 201);
  }

  if (pathname === '/api/push/unsubscribe' && method === 'POST') {
    const b = await request.json();
    if (!b.endpoint) return json({ error: 'Falta "endpoint"' }, 400);
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(b.endpoint).run();
    return json({ ok: true });
  }

  if (pathname === '/api/push/send' && method === 'POST') {
    return handlePushSend(request, env);
  }

  return json({ error: 'Not found', path: pathname, method }, 404);
}

// Envía una notificación push real (Web Push / RFC 8291) a TODAS las suscripciones
// guardadas. App de un solo usuario (Reiner) — en la práctica esto es "a todos sus
// dispositivos suscritos", no hace falta un sistema de autenticación/targeting por usuario.
async function handlePushSend(request, env) {
  if (!env.VAPID_PRIVATE_KEY) return json({ error: 'VAPID_PRIVATE_KEY no configurado' }, 501);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const { title, body: msg, icon, tag } = body || {};
  if (!title) return json({ error: 'Falta "title"' }, 400);

  webpush.setVapidDetails(
    'mailto:reinersanchez1@gmail.com',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );

  const { results } = await env.DB.prepare('SELECT * FROM push_subscriptions').all();
  const payload = JSON.stringify({ title, body: msg || '', icon: icon || './assets/santuario-icon.svg', tag: tag || 'santuario' });

  const outcomes = await Promise.all(results.map(async (row) => {
    const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      await webpush.sendNotification(sub, payload);
      return { endpoint: row.endpoint, ok: true };
    } catch (err) {
      // 404/410 = la suscripción ya no existe del lado del navegador (desinstalada, etc.) — límpiala.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(row.endpoint).run();
      }
      return { endpoint: row.endpoint, ok: false, error: String(err.message || err) };
    }
  }));

  return json({ sent: outcomes.filter(o => o.ok).length, total: outcomes.length, outcomes });
}

async function handleAI(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const { provider, prompt, system } = body || {};
  if (!prompt || typeof prompt !== 'string') return json({ error: 'Falta "prompt"' }, 400);
  const p = (provider || 'gemini').toLowerCase();

  try {
    if (p === 'gemini') {
      if (!env.GEMINI_KEY) return json({ error: 'GEMINI_KEY no configurado' }, 501);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: system ? { parts: [{ text: system }] } : undefined
        })
      });
      if (!res.ok) return json({ error: `Gemini HTTP ${res.status}` }, 502);
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return json({ text });
    }

    if (p === 'claude') {
      if (!env.CLAUDE_KEY) return json({ error: 'CLAUDE_KEY no configurado' }, 501);
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.CLAUDE_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: system || undefined,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!res.ok) return json({ error: `Claude HTTP ${res.status}` }, 502);
      const data = await res.json();
      const text = data?.content?.[0]?.text || '';
      return json({ text });
    }

    if (p === 'chatgpt' || p === 'openai') {
      if (!env.OPENAI_KEY) return json({ error: 'OPENAI_KEY no configurado' }, 501);
      const messages = [];
      if (system) messages.push({ role: 'system', content: system });
      messages.push({ role: 'user', content: prompt });
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${env.OPENAI_KEY}`
        },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages })
      });
      if (!res.ok) return json({ error: `OpenAI HTTP ${res.status}` }, 502);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      return json({ text });
    }

    return json({ error: `Proveedor desconocido: ${p}` }, 400);
  } catch (err) {
    return json({ error: String((err && err.message) || err) }, 502);
  }
}
