CREATE TABLE IF NOT EXISTS movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT,
  descripcion TEXT,
  monto REAL,
  moneda TEXT,
  cuenta TEXT,
  categoria TEXT,
  tipo TEXT,
  ts TEXT
);

CREATE TABLE IF NOT EXISTS cuentas (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  saldo REAL,
  moneda TEXT
);

CREATE TABLE IF NOT EXISTS proyectos (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  servicio TEXT,
  presupuesto REAL,
  cobrado REAL,
  estado TEXT
);

-- Bloque 6: suscripciones de Web Push, una fila por dispositivo/navegador suscrito.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT UNIQUE,
  p256dh TEXT,
  auth TEXT,
  created_at TEXT
);

-- Bloque 12: rate limit de /api/ai por IP, ventana fija de 10 minutos. Una fila por IP que
-- haya llamado a /api/ai alguna vez; se sobreescribe cuando arranca una ventana nueva.
CREATE TABLE IF NOT EXISTS ai_rate_limit (
  ip TEXT PRIMARY KEY,
  window_start INTEGER,
  count INTEGER
);
