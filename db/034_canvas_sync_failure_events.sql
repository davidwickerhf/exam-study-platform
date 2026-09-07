-- Do not claim every failure exhausted retries; connection failures stop immediately.
CREATE OR REPLACE FUNCTION record_canvas_sync_transition() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO canvas_sync_events (job_id, attempt, stage, level, message)
    VALUES (NEW.id, NEW.attempts, 'queue',
      CASE WHEN NEW.status = 'failed' THEN 'error' WHEN NEW.status = 'pending' AND NEW.attempts > 0 THEN 'warning' ELSE 'info' END,
      CASE NEW.status
        WHEN 'pending' THEN CASE WHEN NEW.attempts > 0 THEN 'Attempt interrupted. Retry queued.' ELSE 'Sync queued.' END
        WHEN 'running' THEN 'Worker started this attempt.'
        WHEN 'completed' THEN 'Sync finished. Check stage events for warnings or skipped material.'
        WHEN 'cancelled' THEN 'Sync stopped or superseded. Stored material remains available.'
        WHEN 'failed' THEN CASE WHEN NEW.payload->>'blockedReason'='canvas-connection'
          THEN 'Sync needs a working connection on this server. Automatic retries are paused; saved material is retained.'
          ELSE 'Sync stopped with an error. See the preceding event for the cause; retry controls are in Canvas sync.' END
      END);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
