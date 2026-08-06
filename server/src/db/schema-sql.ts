/** 建表 SQL（内联为字符串，避免运行时依赖外部文件） */

export const SCHEMA_SQL = `
-- 报价记录
CREATE TABLE IF NOT EXISTS quotes (
  id          TEXT PRIMARY KEY,
  quote_no    TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'quoted',
  input       TEXT NOT NULL,
  result      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);

-- 订单记录
CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  order_no         TEXT NOT NULL UNIQUE,
  quote_id         TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  customer         TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  size             TEXT NOT NULL,
  materials        TEXT NOT NULL,
  finance          TEXT NOT NULL,
  shipping         TEXT,
  remark           TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 设置（单行，id 固定 1）
CREATE TABLE IF NOT EXISTS settings (
  id    INTEGER PRIMARY KEY CHECK (id = 1),
  data  TEXT NOT NULL
);

-- 管理员账户（单用户，单行，id 固定 1）。首次启动通过 /api/auth/setup 创建。
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

-- 服务端会话表（cookie 存不透明 session id，支持真正的登出/撤销）
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`;
