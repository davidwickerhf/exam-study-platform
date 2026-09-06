// Disposable database only. Never run this fixture against a hosted account.
import assert from "node:assert/strict";
import { mock } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";
const url = new URL(process.env.FEEDBACK_TEST_DATABASE_URL || "");
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("Local disposable database required.");
process.env.DATABASE_URL = "";
process.env.VERCEL_ENV = "";
process.env.FEEDBACK_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const pool = new pg.Pool({ connectionString: url.href });
const db = await import("../../lib/db.mjs");
function sql(strings, ...values) {
  const text = strings.reduce(
    (out, part, i) => out + (i ? `$${i}` : "") + part,
    "",
  );
  return {
    text,
    values,
    then(resolve, reject) {
      return pool
        .query(text, values)
        .then((r) => r.rows)
        .then(resolve, reject);
    },
  };
}
sql.transaction = async (queries) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const results = [];
    for (const q of queries)
      results.push((await client.query(q.text, q.values)).rows);
    await client.query("COMMIT");
    return results;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};
mock.module("../../lib/db.mjs", { namedExports: { ...db, sql } });
mock.module("../../lib/programme-scope.mjs", {
  namedExports: { activeProgrammeId: async () => "programme" },
});
mock.module("../../lib/tutor-store.mjs", {
  namedExports: { readConversation: async () => null },
});
const store = await import("../../lib/feedback-store.mjs"),
  { withRequestContext } = await import("../../lib/request-context.mjs");
const user = (name, fn, admin = false) =>
  withRequestContext(
    { userId: name, mode: "local", admin, email: name + "@example.test" },
    fn,
  );
try {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  for (const name of (await readdir(new URL("../../db/", import.meta.url)))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await pool.query(
      await readFile(new URL("../../db/" + name, import.meta.url), "utf8"),
    );
  const draft = await user("alice", () =>
    store.prepareFeedback({
      category: "incorrect",
      shareContactEmail: true,
      subject: { kind: "credits", route: "/app?token=secret" },
      note: "Expected 92 credits",
      evidence: [{ content: "Selected excerpt only", label: "Excerpt" }],
    }),
  );
  await assert.rejects(
    user("bob", () => store.readFeedbackDraft(draft.draftId)),
    (e) => e.status === 404,
  );
  await assert.rejects(
    user("alice", () => store.submitFeedback({ ...draft, confirmed: false })),
    (e) => e.status === 403,
  );
  await assert.rejects(
    user("alice", () =>
      store.submitFeedback({ ...draft, revision: "wrong", confirmed: true }),
    ),
    (e) => e.status === 409,
  );
  const receipts = await Promise.all(
    Array.from({ length: 5 }, () =>
      user("alice", () => store.submitFeedback({ ...draft, confirmed: true })),
    ),
  );
  assert.equal(new Set(receipts.map((r) => r.reportId)).size, 1);
  const id = receipts[0].reportId,
    report = await user("alice", () => store.readFeedback(id)),
    issue = report.issueId;
  assert.equal(report.evidence.length, 1);
  assert.equal(report.contactEmail, "alice@example.test");
  await assert.rejects(
    user("bob", () => store.feedbackContact(id)),
    (e) => e.status === 404,
  );
  assert.equal(
    (
      await user(
        "admin",
        () => store.feedbackContact(id, { admin: true }),
        true,
      )
    ).email,
    "alice@example.test",
  );
  await user("alice", () => store.feedbackContact(id, { remove: true }));
  await assert.rejects(
    user("admin", () => store.feedbackContact(id, { admin: true }), true),
    (e) => e.status === 404,
  );
  assert.equal(report.subject.route, "/app");
  assert.equal(
    (await pool.query("SELECT count(*) n FROM feedback_reports")).rows[0].n,
    "1",
  );
  assert.ok(
    !(
      await pool.query("SELECT ciphertext FROM feedback_evidence")
    ).rows[0].ciphertext.includes("Selected excerpt"),
  );
  await assert.rejects(
    user("bob", () => store.readFeedback(id)),
    (e) => e.status === 404,
  );
  await assert.rejects(
    user("bob", () => store.feedbackEvidence(id, report.evidence[0].id)),
    (e) => e.status === 404,
  );
  await assert.rejects(
    user("bob", () => store.listFeedbackIssues()),
    (e) => e.status === 403,
  );
  await user(
    "admin",
    () =>
      store.replyFeedback(
        id,
        { body: "PRIVATE staff note", internal: true },
        { admin: true },
      ),
    true,
  );
  assert.equal(
    (await user("alice", () => store.readFeedback(id))).events.length,
    1,
  );
  await user(
    "admin",
    () =>
      store.replyFeedback(
        id,
        { body: "Could you share the total shown?", internal: false },
        { admin: true },
      ),
    true,
  );
  assert.equal(
    (await user("alice", () => store.readFeedback(id))).events.length,
    2,
  );
  await assert.rejects(
    user(
      "admin",
      () =>
        store.updateFeedbackIssue(issue, { revision: 0, status: "resolved" }),
      true,
    ),
    (e) => e.status === 400,
  );
  const races = await Promise.allSettled([
    user(
      "admin",
      () =>
        store.updateFeedbackIssue(issue, {
          revision: 0,
          status: "investigating",
          resolution: "PRIVATE resolution",
        }),
      true,
    ),
    user(
      "admin",
      () =>
        store.updateFeedbackIssue(issue, { revision: 0, status: "triaged" }),
      true,
    ),
  ]);
  assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(
    !JSON.stringify(await user("alice", () => store.readFeedback(id))).includes(
      "PRIVATE",
    ),
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*) n FROM feedback_events WHERE kind='status' AND visibility='internal'",
      )
    ).rows[0].n,
    "1",
  );
  await user(
    "admin",
    () =>
      store.updateFeedbackIssue(issue, {
        revision: 1,
        status: "resolved",
        resolution: "Corrected total",
        verification: "Regression fixture passed",
        publicUpdate: true,
      }),
    true,
  );
  assert.ok(
    (await user("alice", () => store.readFeedback(id))).events.some((e) =>
      e.body.includes("Corrected total"),
    ),
  );
  await user(
    "admin",
    () => store.feedbackRoles({ userId: "support", roles: ["support"] }),
    true,
  );
  await assert.rejects(
    user("support", () =>
      store.feedbackEvidence(id, report.evidence[0].id, { admin: true }),
    ),
    (e) => e.status === 403,
  );
  await user(
    "admin",
    () => store.feedbackEvidence(id, report.evidence[0].id, { admin: true }),
    true,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*) n FROM feedback_admin_audit WHERE action='evidence-read'",
      )
    ).rows[0].n,
    "1",
  );
  await user("alice", () =>
    store.feedbackEvidence(id, report.evidence[0].id, { remove: true }),
  );
  await assert.rejects(
    user(
      "admin",
      () => store.feedbackEvidence(id, report.evidence[0].id, { admin: true }),
      true,
    ),
    (e) => e.status === 404,
  );
  const expired = await user("alice", () =>
    store.prepareFeedback({ category: "other", note: "expired" }),
  );
  await pool.query(
    "UPDATE feedback_drafts SET expires_at=now()-interval '1 hour' WHERE id=$1",
    [expired.draftId],
  );
  await assert.rejects(
    user("alice", () => store.submitFeedback({ ...expired, confirmed: true })),
    (e) => e.status === 409,
  );
  await user("alice", () =>
    store.saveFeedbackPreferences({
      diagnostics: false,
      performance: false,
      notifications: true,
    }),
  );
  await user("alice", () =>
    store.recordQualityEvent({
      code: "CLIENT_FAILURE",
      route: "/app/tutor?private=value",
    }),
  );
  assert.equal(
    (await pool.query("SELECT count(*) n FROM quality_events")).rows[0].n,
    "0",
  );
  await user("bob", () =>
    store.recordQualityEvent(
      {
        code: "CLIENT_FAILURE",
        route: "/app/tutor?private=value",
        stack: "secret",
      },
      { eventId: "same" },
    ),
  );
  await user("bob", () =>
    store.recordQualityEvent(
      { code: "CLIENT_FAILURE", route: "/app/tutor?private=value" },
      { eventId: "same" },
    ),
  );
  assert.equal(
    (await pool.query("SELECT count(*) n FROM quality_events")).rows[0].n,
    "1",
  );
  assert.ok(
    !JSON.stringify(
      (await pool.query("SELECT * FROM quality_events")).rows,
    ).includes("private"),
  );
  await store.feedbackMaintenance();
  assert.equal(
    (await pool.query("SELECT status FROM feedback_jobs LIMIT 1")).rows[0]
      .status,
    "completed",
  );
  assert.ok(
    !JSON.stringify(await user("alice", () => store.exportFeedback())).includes(
      "PRIVATE",
    ),
  );
  await user("alice", () => store.eraseFeedback());
  assert.equal(
    (
      await pool.query(
        "SELECT count(*) n FROM feedback_reports WHERE user_id='alice'",
      )
    ).rows[0].n,
    "0",
  );
  assert.equal(
    (await pool.query("SELECT count(*) n FROM feedback_evidence")).rows[0].n,
    "0",
  );
  console.log(
    "Feedback integration passed: migration, isolation, concurrent confirmation/CAS, consent, roles, public/private boundaries, encryption, withdrawal, diagnostics, maintenance and erasure.",
  );
} finally {
  await pool.end();
}
