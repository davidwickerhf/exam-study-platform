import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { splitSqlStatements } from '../lib/sql-statements.mjs'

test('migration splitting ignores semicolons in comments and quoted values', () => {
  assert.deepEqual(splitSqlStatements("-- stored; never returned\nCREATE TABLE test (value TEXT DEFAULT ';'); SELECT $$a;b$$;"), [
    "CREATE TABLE test (value TEXT DEFAULT ';')",
    'SELECT $$a;b$$'
  ])
})

test('every database migration splits into SQL statements', async () => {
  for (let number = 1; number <= 15; number += 1) {
    const prefix = String(number).padStart(3, '0')
    const files = {
      '001': '001_user_documents.sql', '002': '002_editorial_content.sql', '003': '003_editorial_retrieval.sql', '004': '004_ai_usage.sql',
      '005': '005_academic_intake_usage.sql', '006': '006_activity_events.sql', '007': '007_personal_tables.sql', '008': '008_api_keys.sql',
      '009': '009_editorial_admin.sql', '010': '010_editorial_flashcards.sql', '011': '011_calendars.sql', '012': '012_api_key_expiry.sql',
      '013': '013_programme_memberships.sql', '014': '014_attempt_context.sql', '015': '015_course_content_requests.sql'
    }
    const statements = splitSqlStatements(await readFile(resolve('db', files[prefix]), 'utf8'))
    assert.ok(statements.length > 0, `${files[prefix]} has no statements`)
    assert.ok(statements.every((statement) => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP|SELECT|WITH|DO|GRANT|REVOKE)\b/i.test(statement)), `${files[prefix]} contains an invalid statement boundary`)
  }
})
