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

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders }
  });
}

// CORS para /api/ai (Bloque 12): el frontend siempre le pega a esta ruta con fetch relativo
// desde el mismo origen, así que una petición del navegador legítima trae Origin === el
// origen del propio Worker (o sin header Origin en algunos casos de same-origin). Solo se
// hace eco de Access-Control-Allow-Origin cuando el Origin recibido coincide exactamente con
// el origen del Worker — cualquier otro sitio que intente pegarle desde el navegador de un
// tercero no puede leer la respuesta. Esto NO es la única protección: no evita que alguien le
// pegue directo por curl/servidor (CORS es una restricción que solo cumplen los navegadores),
// por eso también hay rate limit por IP abajo, que sí aplica sin importar quién llame.
function aiCorsHeaders(request, url) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && origin === url.origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

// Rate limit por IP para /api/ai (Bloque 12): ventana fija de 10 minutos, 30 solicitudes por
// IP. Guardado en D1 (`ai_rate_limit`, ver schema.sql) — un Worker no tiene memoria persistente
// entre invocaciones/isolates, así que sin esto cualquier límite en memoria se resetearía solo.
// 30/10min es generoso para uso normal (brief, consulta rápida, pros/contras, prompt lab,
// radar en una sesión activa) pero corta un abuso sostenido o un loop con bug que golpee el
// endpoint sin parar.
const AI_RATE_LIMIT = 30;
const AI_RATE_WINDOW_SEC = 600;
async function checkAiRateLimit(env, ip) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare('SELECT window_start, count FROM ai_rate_limit WHERE ip = ?').bind(ip).first();
  if (!row || now - row.window_start >= AI_RATE_WINDOW_SEC) {
    await env.DB.prepare(
      `INSERT INTO ai_rate_limit (ip, window_start, count) VALUES (?,?,1)
       ON CONFLICT(ip) DO UPDATE SET window_start = excluded.window_start, count = 1`
    ).bind(ip, now).run();
    return { allowed: true };
  }
  if (row.count >= AI_RATE_LIMIT) {
    return { allowed: false, retryAfter: AI_RATE_WINDOW_SEC - (now - row.window_start) };
  }
  await env.DB.prepare('UPDATE ai_rate_limit SET count = count + 1 WHERE ip = ?').bind(ip).run();
  return { allowed: true };
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

  if (pathname === '/api/ai' && method === 'OPTIONS') {
    // Preflight de CORS — solo lo dispara el navegador para llamadas cross-origin (el propio
    // frontend, same-origin, nunca lo necesita). Responder 204 con los headers correctos.
    return new Response(null, { status: 204, headers: aiCorsHeaders(request, url) });
  }
  if (pathname === '/api/ai' && method === 'POST') {
    const cors = aiCorsHeaders(request, url);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = await checkAiRateLimit(env, ip);
    if (!rl.allowed) {
      return json(
        { error: 'Demasiadas solicitudes de IA en poco tiempo. Espera unos minutos e intenta de nuevo.' },
        429,
        { ...cors, 'Retry-After': String(rl.retryAfter) }
      );
    }
    const res = await handleAI(request, env);
    const merged = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) merged.set(k, v);
    return new Response(res.body, { status: res.status, headers: merged });
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

  const vapid = {
    subject: 'mailto:reinersanchez1@gmail.com',
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const message = {
    data: JSON.stringify({ title, body: msg || '', icon: icon || './assets/santuario-icon.svg', tag: tag || 'santuario' }),
    options: { ttl: 60 * 60 * 24 }, // 24h: si el dispositivo está offline, el push service la reintenta durante este tiempo
  };

  const { results } = await env.DB.prepare('SELECT * FROM push_subscriptions').all();

  const outcomes = await Promise.all(results.map(async (row) => {
    const subscription = {
      endpoint: row.endpoint,
      expirationTime: null,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      const payload = await buildPushPayload(message, subscription, vapid);
      const res = await fetch(subscription.endpoint, payload);
      if (!res.ok) {
        // 404/410 = la suscripción ya no existe del lado del navegador (desinstalada, etc.) — límpiala.
        if (res.status === 404 || res.status === 410) {
          await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(row.endpoint).run();
        }
        return { endpoint: row.endpoint, ok: false, error: `Push service HTTP ${res.status}` };
      }
      return { endpoint: row.endpoint, ok: true };
    } catch (err) {
      return { endpoint: row.endpoint, ok: false, error: String((err && err.message) || err) };
    }
  }));

  return json({ sent: outcomes.filter(o => o.ok).length, total: outcomes.length, outcomes });
}

// Cuando Gemini/Claude/OpenAI responden con error, su body trae el motivo real (modelo
// inválido, cuota agotada, key revocada, etc.) — nunca incluye la key en sí, solo describe
// qué estuvo mal con la petición. Antes esto se perdía y el frontend solo veía "HTTP 400/403"
// sin contexto. Truncado a 200 caracteres para no inflar el toast de error.
async function upstreamErrorDetail(res) {
  try {
    const txt = await res.text();
    if (!txt) return '';
    return ' — ' + txt.slice(0, 200);
  } catch { return ''; }
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
      // "gemini-2.5-flash" (versión fija) dejó de estar disponible para keys nuevas — Google
      // recomienda el alias rotativo "gemini-flash-latest", que siempre apunta al flash
      // vigente sin que el código se rompa cada vez que Google retira una versión fechada.
      // Confirmado disponible contra la key real vía /v1beta/models (Bloque 12, post-cierre).
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${env.GEMINI_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: system ? { parts: [{ text: system }] } : undefined
        })
      });
      if (!res.ok) return json({ error: `Gemini HTTP ${res.status}${await upstreamErrorDetail(res)}` }, 502);
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
      if (!res.ok) return json({ error: `Claude HTTP ${res.status}${await upstreamErrorDetail(res)}` }, 502);
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
      if (!res.ok) return json({ error: `OpenAI HTTP ${res.status}${await upstreamErrorDetail(res)}` }, 502);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      return json({ text });
    }

    return json({ error: `Proveedor desconocido: ${p}` }, 400);
  } catch (err) {
    return json({ error: String((err && err.message) || err) }, 502);
  }
}
