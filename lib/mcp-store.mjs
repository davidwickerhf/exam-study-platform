import { sql } from './db.mjs'

// In-memory storage is only for local development/tests; hosted deployments
// require Postgres. All claims use compare-and-swap, never read-then-delete.
export function createMcpStore(database = sql) {
  if (!database && (process.env.VERCEL || process.env.NODE_ENV === 'production')) throw new Error('Remote MCP requires DATABASE_URL.')
  const records = new Map(), budgets = new Map()
  const key = (kind, id) => `${kind}:${id}`
  return {
    async acquireLease(id, nonce, ttl) {
      const expires=Date.now()+ttl
      if(database)return (await database`INSERT INTO mcp_records (kind,id,value,expires_at) VALUES ('lease',${id},${JSON.stringify({nonce})}::jsonb,${new Date(expires).toISOString()}::timestamptz)
        ON CONFLICT (kind,id) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at,version=mcp_records.version+1 WHERE mcp_records.expires_at<=now() RETURNING id`).length>0
      const held=records.get(key('lease',id));if(held&&held.expires>Date.now())return false
      records.set(key('lease',id),{value:{nonce},version:0,expires});return true
    },
    async releaseLease(id,nonce) {
      if(database)await database`DELETE FROM mcp_records WHERE kind='lease' AND id=${id} AND value->>'nonce'=${nonce}`
      else if(records.get(key('lease',id))?.value.nonce===nonce)records.delete(key('lease',id))
    },
    async deleteOwner(userId) {
      if(database)await database`DELETE FROM mcp_records WHERE value->>'userId'=${userId}`
      else for(const [id,row]of records)if(row.value.userId===userId)records.delete(id)
    },
    async get(kind, id) {
      if (database) {
        const rows = await database`SELECT value, version FROM mcp_records WHERE kind=${kind} AND id=${id} AND expires_at>now()`
        return rows[0] || null
      }
      const row = records.get(key(kind,id))
      return row && row.expires > Date.now() ? structuredClone(row) : null
    },
    async put(kind, id, value, ttl) {
      const expires = Date.now() + ttl
      if (database) await database`INSERT INTO mcp_records (kind,id,value,expires_at) VALUES (${kind},${id},${JSON.stringify(value)}::jsonb,${new Date(expires).toISOString()}::timestamptz)`
      else { if (records.has(key(kind,id))) throw new Error('Duplicate MCP record'); records.set(key(kind,id),{value:structuredClone(value),version:0,expires}) }
    },
    async cas(kind, id, version, value) {
      if (database) return (await database`UPDATE mcp_records SET value=${JSON.stringify(value)}::jsonb, version=version+1 WHERE kind=${kind} AND id=${id} AND version=${version} AND expires_at>now() RETURNING id`).length>0
      const row=records.get(key(kind,id))
      if (!row || row.expires<=Date.now() || row.version!==version) return false
      records.set(key(kind,id),{...row,value:structuredClone(value),version:version+1}); return true
    },
    async list(kind, userId) {
      if (database) return (await database`SELECT id,value FROM mcp_records WHERE kind=${kind} AND value->>'userId'=${userId} AND expires_at>now()`).map(row=>({id:row.id,...row.value}))
      return [...records].filter(([id,row])=>id.startsWith(`${kind}:`)&&row.value.userId===userId&&row.expires>Date.now()).map(([id,row])=>({id:id.slice(kind.length+1),...structuredClone(row.value)}))
    },
    async charge(id, cost, limit, windowMs) {
      const expires = new Date(Date.now()+windowMs).toISOString()
      if (cost>limit) return false
      if (database) return (await database`INSERT INTO mcp_budgets (id,used,expires_at) VALUES (${id},${cost},${expires}::timestamptz)
        ON CONFLICT (id) DO UPDATE SET used=CASE WHEN mcp_budgets.expires_at<=now() THEN ${cost} ELSE mcp_budgets.used+${cost} END,
        expires_at=CASE WHEN mcp_budgets.expires_at<=now() THEN ${expires}::timestamptz ELSE mcp_budgets.expires_at END
        WHERE mcp_budgets.expires_at<=now() OR mcp_budgets.used+${cost}<=${limit} RETURNING id`).length>0
      const row=budgets.get(id); const used=row&&row.expires>Date.now()?row.used:0
      if(used+cost>limit)return false
      budgets.set(id,{used:used+cost,expires:used?row.expires:Date.now()+windowMs}); return true
    },
    async cleanup() {
      if(database) { await database`DELETE FROM mcp_records WHERE expires_at<=now()`; await database`DELETE FROM mcp_budgets WHERE expires_at<=now()` }
      else { for(const [id,row] of records)if(row.expires<=Date.now())records.delete(id);for(const [id,row] of budgets)if(row.expires<=Date.now())budgets.delete(id) }
    }
  }
}
