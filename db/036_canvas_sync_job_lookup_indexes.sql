-- The every-minute dispatcher (scheduleDueRefreshes) checks, per account,
-- whether a catalog job was created recently. Without an index on
-- (user_id, origin, created_at) that NOT EXISTS became a full sequential scan
-- of canvas_sync_jobs once a minute: on production ~58k scans reading ~3.4
-- billion rows, as the table is almost entirely completed history. The
-- existing partial indexes cover only pending/running rows.
CREATE INDEX IF NOT EXISTS canvas_sync_jobs_catalog_recent_idx
  ON canvas_sync_jobs (user_id, origin, created_at DESC)
  WHERE job_type = 'catalog';

-- Per-course history lookups (recent priority/freshness jobs, the latest
-- completed scrape, cooldown checks) filter by account and binding, often
-- without naming job_type, so this index is not partial. Otherwise the planner
-- walks the queue index or the whole table.
CREATE INDEX IF NOT EXISTS canvas_sync_jobs_binding_recent_idx
  ON canvas_sync_jobs (user_id, binding_id, created_at DESC);
