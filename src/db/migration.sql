-- ============================================================
-- PowerSync 迁移: 拆表 + RLS + 复制配置
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 1. 创建新表 ------------------------------------------------

CREATE TABLE IF NOT EXISTS records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date text NOT NULL,
  time text NOT NULL,
  text text NOT NULL,
  period text NOT NULL DEFAULT 'morning',
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  deleted_at bigint,
  user_id uuid REFERENCES auth.users DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_records_date ON records(date);

CREATE TABLE IF NOT EXISTS reflections (
  date text PRIMARY KEY,
  text text NOT NULL DEFAULT '',
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  user_id uuid REFERENCES auth.users DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date text NOT NULL,
  module_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  deleted_at bigint,
  user_id uuid REFERENCES auth.users DEFAULT auth.uid(),
  UNIQUE(date, module_id)
);
CREATE INDEX IF NOT EXISTS idx_modules_date ON modules(date);

-- 2. RLS 策略 ------------------------------------------------

ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own records" ON records FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own reflections" ON reflections FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own modules" ON modules FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Grant 权限 (Data API) -----------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reflections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON modules TO authenticated;
GRANT SELECT ON records TO service_role;
GRANT SELECT ON reflections TO service_role;
GRANT SELECT ON modules TO service_role;

-- 4. PowerSync 复制角色 --------------------------------------
-- 注意: 请修改密码为强密码

CREATE ROLE powersync_role WITH REPLICATION BYPASSRLS LOGIN PASSWORD 'CHANGE_ME_strong_password_123';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_role;

-- 5. Publication (PowerSync 需要) ----------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync') THEN
    CREATE PUBLICATION powersync FOR TABLE records, reflections, modules;
  END IF;
END $$;
