# PowerSync 同步失效：本地保存成功但不更新服务器（reflections/感悟）

日期：2026-08-18　状态：已解决

## 症状

- 保存/修改感悟 toast 提示成功，但服务器无变化
- 控制台可见 `PATCH ok` 但服务端 0 行命中（PostgREST 无匹配时不报错）

## 根因（三个叠加）

1. **opData 不含 id**：PowerSync `op.opData` 只有列数据，id 在 `op.id`。
   `upsert({...row})` 不带 id → 服务端 `gen_random_uuid()` 生成新 id → 本地/服务端 id 永久错位 → 后续 `.eq('id', op.id)` 全部 0 行命中且 HTTP 200 无错。
2. **服务器表结构与代码不一致**：线上 `reflections` 无 `id` 列（增量 SQL 从未执行）→ PUT 带 id 报 `PGRST204 Could not find the 'id' column`。
3. **sync rules 损坏**：PowerSync 下发的 reflections 行 `object_id` 为空字符串，id 映射缺失。

次因：单条 op 失败仅 console.error 仍 `batch.complete()` → 队列被永久丢弃；schema.ts 声明自定义 `id` 列（PowerSync 自动加 id，自定义非法）。

## 排查手法（实测有效）

```bash
# 1. 看线上真实表结构（OpenAPI introspection，用 service key）
curl -s "$SUPABASE_URL/rest/v1/" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
# → definitions.<table>.properties 即真实列名

# 2. 看 PowerSync 实际下发内容（object_id 是否为空、表是否被 sync rules 覆盖）
printf '{"type":"initialize","protocol":"2","version":"2.0"}\n{"type":"checkpoints","last_completed":null}\n' \
| curl -s -N -X POST "$POWERSYNC_URL/sync/stream" \
  -H "Content-Type: text/plain" -H "Authorization: Bearer $SUPABASE_JWT" --data-binary @-

# 3. 服务端插探针行 → 看是否被下发 → 验证 sync rules → 删除探针
```

## 修复（src/db/powersync.ts）

```ts
// PUT：必须带 id；有 UNIQUE 约束的表指定 onConflict 对齐服务端行
await supabase.from(table).upsert(
  { ...row, id: op.id, updated_at: now },
  { onConflict: table === 'reflections' ? 'date' : 'id' }
)

// PATCH：用 .select('id') 检测 0 行命中 → 读本地全行转 upsert 自愈
const { data: matched, error } = await supabase.from(table)
  .update({ ...row, updated_at: now }).eq('id', op.id).select('id')
if (!matched?.length) { /* getOptional 全行 → upsert */ }

// 失败：不 complete() 并 throw → PowerSync 保留队列自动重试；toast 提示（30s 节流）
```

配套：schema.ts 禁止声明 `id` 列；store 的 getOptional 查询加 `ORDER BY updated_at DESC LIMIT 1`。

## 服务器侧（SQL Editor + PowerSync Dashboard）

- 执行 migration.sql 底部增量段：reflections 加 `id uuid PRIMARY KEY` + `UNIQUE(date)`
- sync rules 中该表 `select: "*"` 必须含 id；改完 redeploy
- PG 不支持 `ADD CONSTRAINT IF NOT EXISTS`，需 DO 块包裹

## 教训

- PostgREST update 匹配 0 行返回 200，**必须 `.select()` 才能检测**
- 本地保存成功 ≠ 上云成功，验证链路要看 `[powersync] PUT/PATCH ... ok` 日志 + 服务器数据
- schema/迁移/sync rules 三处任一与服务器不一致都会静默失败
