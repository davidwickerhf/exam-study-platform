// Uses a unique schema in an explicitly supplied disposable Postgres database.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { createMcpStore } from '../../lib/mcp-store.mjs'

if(!process.env.MCP_TEST_DATABASE_URL)throw new Error('Set MCP_TEST_DATABASE_URL to a disposable test database.')
const schema=`mcp_test_${randomBytes(8).toString('hex')}`
const admin=new pg.Pool({connectionString:process.env.MCP_TEST_DATABASE_URL})
await admin.query(`CREATE SCHEMA ${schema}`)
const pool=new pg.Pool({connectionString:process.env.MCP_TEST_DATABASE_URL,options:`-c search_path=${schema}`,max:12})
const sql=async(strings,...values)=>(await pool.query(strings.reduce((text,part,index)=>text+(index?`$${index}`:'')+part,''),values)).rows
try{
  await pool.query(await readFile(new URL('../../db/035_remote_mcp.sql',import.meta.url),'utf8'))
  const store=createMcpStore(sql)
  await store.put('code','single-use',{used:false,userId:'owner'},60000)
  const results=await Promise.all(Array.from({length:20},()=>store.cas('code','single-use',0,{used:true,userId:'owner'})))
  assert.equal(results.filter(Boolean).length,1)
  const charges=await Promise.all(Array.from({length:40},()=>store.charge('quota',4,20,60000)))
  assert.equal(charges.filter(Boolean).length,5)
  const leases=await Promise.all(Array.from({length:20},(_,index)=>store.acquireLease('slot',String(index),60000)))
  assert.equal(leases.filter(Boolean).length,1)
  const winner=String(leases.findIndex(Boolean))
  await store.releaseLease('slot','wrong-owner')
  assert.equal(await store.acquireLease('slot','next',60000),false)
  await store.releaseLease('slot',winner)
  assert.equal(await store.acquireLease('slot','next',60000),true)
  await store.deleteOwner('owner')
  assert.equal(await store.get('code','single-use'),null)
  await store.cleanup()
  console.log('Postgres MCP checks passed: atomic code claims, concurrent token budgets, owned leases, account erasure.')
}finally{
  await pool.end()
  await admin.query(`DROP SCHEMA ${schema} CASCADE`)
  await admin.end()
}
