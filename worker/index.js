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
    await env.DB.prepare(
      'INSERT INTO proyectos (id, nombre, servicio, presupuesto, cobrado, estado) VALUES (?,?,?,?,?,?)'
    ).bind(id, nombre, servicio, presupuesto, cobrado, estado).run();
    return json({ id, nombre, servicio, presupuesto, cobrado, estado }, 201);
  }
  const proyMatch = pathname.match(/^\/api\/proyectos\/([^/]+)$/);
  if (proyMatch && method === 'DELETE') {
    const id = decodeURIComponent(proyMatch[1]);
    await env.DB.prepare('DELETE FROM proyectos WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Not found', path: pathname, method }, 404);
}
