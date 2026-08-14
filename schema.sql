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
