import { suggestFeedbackTriage } from "./feedback-triage.mjs";
import { randomUUID } from "node:crypto";
import { sql as database } from "./db.mjs";
import { currentAuth, currentUserId } from "./request-context.mjs";
import { activeProgrammeId } from "./programme-scope.mjs";
import { readConversation } from "./tutor-store.mjs";
import {
  FeedbackError,
  FEEDBACK_STATUSES,
  normalizeReport,
  normalizeSubject,
  qualityPayload,
  text,
  hash,
  seal,
  unseal,
  stableTutorMessages,
  redact,
} from "./feedback-contract.mjs";
const json = JSON.stringify;
const id = () => randomUUID();
const defaults = { diagnostics: true, performance: false, notifications: true };
function db() {
  if (!database)
    throw new FeedbackError(
      "Feedback requires the hosted workspace database.",
      503,
    );
  return database;
}
const reportHref = (id) => `/app/feedback/${encodeURIComponent(id)}`;
export async function feedbackPreferences() {
  const sql = db();
  const [row] =
    await sql`SELECT diagnostics,performance,notifications FROM feedback_preferences WHERE user_id=${currentUserId()}`;
  return row || defaults;
}
export async function saveFeedbackPreferences(input) {
  const sql = db();
  if (
    ["diagnostics", "performance", "notifications"].some(
      (k) => typeof input[k] !== "boolean",
    )
  )
    throw new FeedbackError("Choose each feedback preference.");
  await sql`INSERT INTO feedback_preferences(user_id,diagnostics,performance,notifications) VALUES(${currentUserId()},${input.diagnostics},${input.performance},${input.notifications}) ON CONFLICT(user_id) DO UPDATE SET diagnostics=excluded.diagnostics,performance=excluded.performance,notifications=excluded.notifications,updated_at=now()`;
  return feedbackPreferences();
}
export async function feedbackRole() {
  if (
    currentAuth().mode === "api-key" &&
    !currentAuth().scopes?.includes("admin")
  )
    throw new FeedbackError("Administrator-scoped access required.", 403);
  if (currentAuth().admin)
    return ["support", "reliability", "editorial", "evidence", "manage"];
  const sql = db();
  const [row] =
    await sql`SELECT roles FROM feedback_roles WHERE user_id=${currentUserId()}`;
  return row?.roles || [];
}
export async function requireFeedbackRole(role = "support") {
  const roles = await feedbackRole();
  if (!roles.includes(role))
    throw new FeedbackError(
      "You do not have permission for this feedback operation.",
      403,
    );
  return roles;
}
export async function feedbackRoles(input) {
  const sql = db();
  await requireFeedbackRole("manage");
  if (input) {
    const roles = input.roles;
    if (
      !Array.isArray(roles) ||
      roles.some(
        (r) => !["support", "reliability", "editorial", "evidence"].includes(r),
      ) ||
      !text(input.userId, 180)
    )
      throw new FeedbackError("Choose a user and valid roles.");
    await sql.transaction([
      sql`INSERT INTO feedback_roles(user_id,roles) VALUES(${text(input.userId, 180)},${roles}) ON CONFLICT(user_id) DO UPDATE SET roles=excluded.roles,updated_at=now()`,
      audit("roles-changed"),
    ]);
  }
  return sql`SELECT user_id,roles FROM feedback_roles ORDER BY user_id LIMIT 100`;
}
function audit(action, { issueId = null, reportId = null } = {}) {
  return db()`INSERT INTO feedback_admin_audit(id,actor_id,issue_id,report_id,action) VALUES(${id()},${currentUserId()},${issueId},${reportId},${action})`;
}
export async function verifyFeedbackSubject(subject) {
  const sql = db();
  if (subject.kind === "answer") {
    const conversation = await readConversation(subject.conversationId);
    const message =
      conversation &&
      stableTutorMessages(conversation).find(
        (m) =>
          m.id === subject.answerId &&
          m.role === "assistant" &&
          !m.tool_calls?.length,
      );
    if (!message || message.answerRevision !== subject.answerRevision)
      throw new FeedbackError(
        "This answer is unavailable or changed. Reopen the conversation.",
        409,
      );
  }
  if (subject.jobId) {
    const rows =
      await sql`SELECT j.id,b.course_code,b.academic_year FROM canvas_sync_jobs j LEFT JOIN canvas_course_bindings b ON b.id=j.binding_id WHERE j.id=${subject.jobId} AND j.user_id=${currentUserId()}`;
    if (!rows.length)
      throw new FeedbackError("Sync not found in your account.", 404);
    Object.assign(subject, {
      courseCode: rows[0].course_code,
      academicYear: rows[0].academic_year,
    });
  }
  if (subject.assetId) {
    const rows =
      await sql`SELECT s.id,s.sha256,b.course_code,b.academic_year,b.edition_id FROM canvas_source_snapshots s JOIN canvas_course_bindings b ON b.id=s.binding_id WHERE s.asset_id=${subject.assetId} AND (s.contributor_user_id=${currentUserId()} OR (s.sharing_mode='community' AND EXISTS(SELECT 1 FROM canvas_corpus_access a WHERE a.binding_id=s.binding_id AND a.user_id=${currentUserId()}) AND EXISTS(SELECT 1 FROM editorial_contributions e WHERE e.id=s.contribution_id AND e.consent_status='accepted'))) LIMIT 1`;
    if (!rows.length)
      throw new FeedbackError("Source not available to your account.", 404);
    Object.assign(subject, {
      version: rows[0].sha256,
      courseCode: rows[0].course_code,
      academicYear: rows[0].academic_year,
      editionId: rows[0].edition_id,
    });
  }
  return subject;
}
export async function prepareFeedback(input) {
  const sql = db(),
    payload = normalizeReport(input);
  if (payload.shareContactEmail) {
    const email = text(currentAuth().email, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new FeedbackError(
        "Your account email is unavailable. Leave contact sharing off or sign in again.",
      );
    payload.contactEmail = email;
  }
  await verifyFeedbackSubject(payload.subject);
  const [limit] =
    await sql`SELECT count(*)::int n FROM feedback_drafts WHERE user_id=${currentUserId()} AND created_at>now()-interval '1 hour'`;
  if (limit.n >= 30)
    throw new FeedbackError(
      "Too many feedback drafts. Please try again later.",
      429,
    );
  const draftId = id(),
    revision = hash(payload),
    expiresAt = new Date(Date.now() + 30 * 60_000).toISOString(),
    programmeId = await activeProgrammeId();
  await sql`INSERT INTO feedback_drafts(id,user_id,programme_id,revision,payload,expires_at) VALUES(${draftId},${currentUserId()},${programmeId},${revision},${json({ sealed: seal(json(payload)) })}::jsonb,${expiresAt})`;
  return {
    draftId,
    revision,
    expiresAt,
    preview: payload,
    confirmationRequired: true,
  };
}
export async function readFeedbackDraft(draftId) {
  const sql = db();
  const [row] =
    await sql`SELECT * FROM feedback_drafts WHERE id=${draftId} AND user_id=${currentUserId()} AND programme_id=${await activeProgrammeId()}`;
  if (!row) throw new FeedbackError("Feedback draft not found.", 404);
  if (row.report_id)
    return {
      reportId: row.report_id,
      url: reportHref(row.report_id),
      submitted: true,
    };
  if (new Date(row.expires_at) <= new Date())
    throw new FeedbackError("This preview expired. Prepare it again.", 409);
  return {
    draftId: row.id,
    revision: row.revision,
    expiresAt: row.expires_at,
    preview: JSON.parse(unseal(row.payload.sealed)),
    confirmationRequired: true,
  };
}
export async function submitFeedback({ draftId, revision, confirmed }) {
  if (confirmed !== true)
    throw new FeedbackError(
      "Confirm this exact feedback submission first.",
      403,
    );
  const sql = db(),
    draft = await readFeedbackDraft(draftId);
  if (draft.submitted) return draft;
  if (draft.revision !== revision)
    throw new FeedbackError("The preview changed. Review it again.", 409);
  const p = draft.preview,
    reviewedHash = hash(draft.preview);
  await verifyFeedbackSubject(p.subject);
  if (hash(p) !== reviewedHash)
    throw new FeedbackError(
      "The referenced source changed. Prepare a new preview.",
      409,
    );
  const reportId = `fr-${hash(`${currentUserId()}:${draftId}`).slice(0, 32)}`;
  // References to private records are grouped only inside their account.
  const fingerprint = hash({
    category: p.category,
    subject: p.subject,
    account: currentUserId(),
  });
  const issueId = `fi-${fingerprint.slice(0, 32)}`,
    title = `${p.category.replaceAll("-", " ")} · ${p.subject.kind}${p.subject.courseCode ? " · " + p.subject.courseCode : ""}`;
  const evidence = p.evidence.map((e) => ({
    id: id(),
    label: e.label,
    mediaType: e.mediaType,
    byteSize: Buffer.byteLength(e.content),
    sha256: hash(e.content),
    ciphertext: seal(e.content),
  }));
  await sql.transaction([
    // Serialize confirmations; every statement is guarded by the same draft.
    sql`SELECT id FROM feedback_drafts WHERE id=${draftId} AND user_id=${currentUserId()} FOR UPDATE`,
    sql`INSERT INTO feedback_issues(id,fingerprint,title,category,subject) SELECT ${issueId},${fingerprint},${title},${p.category},${json(p.subject)}::jsonb WHERE EXISTS(SELECT 1 FROM feedback_drafts WHERE id=${draftId} AND report_id IS NULL AND expires_at>now()) ON CONFLICT(fingerprint) DO UPDATE SET updated_at=now(),status=CASE WHEN feedback_issues.status IN ('resolved','closed-without-change') THEN 'new' ELSE feedback_issues.status END`,
    sql`INSERT INTO feedback_reports(id,user_id,programme_id,issue_id,channel,category,subject,note,ai_review,consent_version,idempotency_key,contact_email_ciphertext)
   SELECT ${reportId},user_id,programme_id,${issueId},${p.channel},${p.category},${json(p.subject)}::jsonb,${p.note},${p.aiReview},${p.consentVersion},${draftId},${p.contactEmail ? seal(p.contactEmail) : null} FROM feedback_drafts WHERE id=${draftId} AND user_id=${currentUserId()} AND revision=${revision} AND expires_at>now() AND report_id IS NULL ON CONFLICT DO NOTHING`,
    ...evidence.map(
      (e) =>
        sql`INSERT INTO feedback_evidence(id,report_id,label,media_type,byte_size,sha256,ciphertext) SELECT ${e.id},${reportId},${e.label},${e.mediaType},${e.byteSize},${e.sha256},${e.ciphertext} WHERE EXISTS(SELECT 1 FROM feedback_drafts WHERE id=${draftId} AND report_id IS NULL) AND EXISTS(SELECT 1 FROM feedback_reports WHERE id=${reportId})`,
    ),
    sql`INSERT INTO feedback_jobs(id,report_id,kind) SELECT ${id()},${reportId},'classification' WHERE EXISTS(SELECT 1 FROM feedback_reports WHERE id=${reportId}) ON CONFLICT DO NOTHING`,
    sql`UPDATE feedback_drafts SET report_id=${reportId},payload='{}'::jsonb WHERE id=${draftId} AND user_id=${currentUserId()} AND EXISTS(SELECT 1 FROM feedback_reports WHERE id=${reportId})`,
  ]);
  const [saved] =
    await sql`SELECT id FROM feedback_reports WHERE id=${reportId} AND user_id=${currentUserId()}`;
  if (!saved)
    throw new FeedbackError(
      "The preview expired before submission. Prepare it again.",
      409,
    );
  return { reportId, url: reportHref(reportId), submitted: true };
}
const publicRow = (row) => ({
  id: row.id,
  category: row.category,
  subject: row.subject,
  note: row.note,
  status: row.status === "new" && row.received_at ? "received" : row.status,
  receivedAt: row.received_at,
  contactShared: Boolean(row.contact_email_ciphertext),
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  unread:
    row.notifications !== false &&
    (row.seen_at == null || new Date(row.updated_at) > new Date(row.seen_at)),
});
export async function listFeedback({ before = "", limit = 30 } = {}) {
  const sql = db(),
    count = Math.max(1, Math.min(50, Number(limit) || 30));
  const rows =
    await sql`SELECT r.*,i.title,i.status,i.resolution,p.notifications FROM feedback_reports r JOIN feedback_issues i ON i.id=r.issue_id LEFT JOIN feedback_preferences p ON p.user_id=r.user_id WHERE r.user_id=${currentUserId()} AND (${before}='' OR (r.created_at,r.id)<(SELECT created_at,id FROM feedback_reports WHERE id=${before} AND user_id=${currentUserId()})) ORDER BY r.created_at DESC,r.id DESC LIMIT ${count + 1}`;
  return {
    items: rows.slice(0, count).map(publicRow),
    nextCursor: rows.length > count ? rows[count - 1].id : null,
  };
}
export async function readFeedback(
  reportId,
  { admin = false, markSeen = true } = {},
) {
  const sql = db();
  if (admin) await requireFeedbackRole();
  const [row] =
    await sql`SELECT r.*,i.status,i.title,i.resolution FROM feedback_reports r JOIN feedback_issues i ON i.id=r.issue_id WHERE r.id=${reportId} AND (${admin} OR r.user_id=${currentUserId()})`;
  if (!row) throw new FeedbackError("Feedback not found.", 404);
  if (admin && currentAuth().mode !== "api-key") {
    const received =
      await sql`WITH received AS (UPDATE feedback_reports SET received_at=now(),updated_at=now() WHERE id=${reportId} AND received_at IS NULL RETURNING id,issue_id,received_at), event AS (INSERT INTO feedback_events(id,issue_id,report_id,actor_id,visibility,kind,body) SELECT ${id()},issue_id,id,${currentUserId()},'public','received','Your report has been opened by the review team.' FROM received) SELECT received_at FROM received`;
    if (received.length) row.received_at = received[0].received_at;
  }
  const [events, evidence] = await Promise.all([
    sql`SELECT id,visibility,kind,body,created_at FROM feedback_events WHERE (report_id=${reportId} OR (${admin} AND issue_id=${row.issue_id} AND report_id IS NULL)) AND (${admin} OR visibility='public') ORDER BY created_at LIMIT 200`,
    sql`SELECT id,label,media_type,byte_size,sha256 FROM feedback_evidence WHERE report_id=${reportId} ORDER BY created_at`,
  ]);
  if (!admin && markSeen)
    await sql`UPDATE feedback_reports SET seen_at=now() WHERE id=${reportId} AND user_id=${currentUserId()}`;
  if (admin) await audit("report-read", { issueId: row.issue_id, reportId });
  return {
    ...publicRow(row),
    issueId: row.issue_id,
    aiReview: row.ai_review,
    consentVersion: row.consent_version,
    ...(!admin && row.contact_email_ciphertext
      ? { contactEmail: unseal(row.contact_email_ciphertext) }
      : {}),
    events,
    evidence,
  };
}
export async function feedbackEvidence(
  reportId,
  evidenceId,
  { admin = false, remove = false } = {},
) {
  const sql = db();
  if (admin) await requireFeedbackRole("evidence");
  const [row] =
    await sql`SELECT e.* FROM feedback_evidence e JOIN feedback_reports r ON r.id=e.report_id WHERE e.id=${evidenceId} AND r.id=${reportId} AND (${admin} OR r.user_id=${currentUserId()})`;
  if (!row) throw new FeedbackError("Shared evidence is unavailable.", 404);
  if (admin)
    await audit("evidence-read", {
      reportId,
      issueId: (
        await sql`SELECT issue_id FROM feedback_reports WHERE id=${reportId}`
      )[0].issue_id,
    });
  if (remove) {
    await sql`DELETE FROM feedback_evidence WHERE id=${evidenceId}`;
    return { removed: true };
  }
  return {
    label: row.label,
    mediaType: row.media_type,
    content: unseal(row.ciphertext),
    sha256: row.sha256,
  };
}
export async function replyFeedback(reportId, input, { admin = false } = {}) {
  const sql = db(),
    report = await readFeedback(reportId, { admin }),
    body = redact(input.body).slice(0, 4000);
  if (!body) throw new FeedbackError("Write a message.");
  const visibility = admin && input.internal === true ? "internal" : "public";
  const [recent] =
    await sql`SELECT count(*)::int n FROM feedback_events WHERE actor_id=${currentUserId()} AND created_at>now()-interval '1 hour'`;
  if (recent.n >= 60)
    throw new FeedbackError(
      "Too many follow-ups. Please try again later.",
      429,
    );
  await sql.transaction([
    sql`INSERT INTO feedback_events(id,issue_id,report_id,actor_id,visibility,kind,body) VALUES(${id()},${report.issueId},${reportId},${currentUserId()},${visibility},${admin ? (input.aiAssisted === true ? "staff-ai-reply" : "staff-reply") : "student-reply"},${body})`,
    sql`UPDATE feedback_reports SET updated_at=now() WHERE id=${reportId} AND ${visibility === "public"}`,
    sql`UPDATE feedback_issues SET updated_at=now() WHERE id=${report.issueId}`,
    ...(admin
      ? [audit("reply-added", { reportId, issueId: report.issueId })]
      : []),
  ]);
  return readFeedback(reportId, { admin });
}
export async function reactToAnswer(input) {
  const sql = db(),
    subject = normalizeSubject({ ...input.subject, kind: "answer" });
  await verifyFeedbackSubject(subject);
  if (!["helpful", "not-helpful", null].includes(input.value))
    throw new FeedbackError("Choose a valid reaction.");
  if (input.value === null)
    await sql`DELETE FROM feedback_reactions WHERE user_id=${currentUserId()} AND answer_id=${subject.answerId} AND answer_revision=${subject.answerRevision}`;
  else
    await sql`INSERT INTO feedback_reactions(user_id,answer_id,answer_revision,subject,value,reason) VALUES(${currentUserId()},${subject.answerId},${subject.answerRevision},${json(subject)}::jsonb,${input.value},${text(input.reason, 80)}) ON CONFLICT(user_id,answer_id,answer_revision) DO UPDATE SET value=excluded.value,reason=excluded.reason,updated_at=now()`;
  return { value: input.value };
}
export async function feedbackReactions(conversationId) {
  const sql = db();
  return sql`SELECT answer_id,answer_revision,value,reason FROM feedback_reactions WHERE user_id=${currentUserId()} AND subject->>'conversationId'=${conversationId} LIMIT 500`;
}
export async function listFeedbackIssues({
  status = "",
  category = "",
  owner = "",
  before = "",
  limit = 30,
} = {}) {
  await requireFeedbackRole();
  const sql = db(),
    count = Math.min(50, Math.max(1, Number(limit) || 30));
  const items =
    await sql`SELECT i.*,(SELECT count(*)::int FROM feedback_reports r WHERE r.issue_id=i.id) reports,(SELECT count(DISTINCT user_id)::int FROM feedback_reports r WHERE r.issue_id=i.id) reporters,(SELECT count(*)::int FROM quality_events q WHERE q.issue_id=i.id) occurrences FROM feedback_issues i WHERE (${status}='' OR i.status=${status}) AND (${category}='' OR i.category=${category}) AND (${owner}='' OR i.owner_id=${owner === "me" ? currentUserId() : owner}) AND (${before}='' OR (i.created_at,i.id)<(SELECT created_at,id FROM feedback_issues WHERE id=${before})) ORDER BY i.created_at DESC,i.id DESC LIMIT ${count + 1}`;
  return {
    items: items.slice(0, count),
    nextCursor: items.length > count ? items[count - 1].id : null,
    roles: await feedbackRole(),
  };
}
export async function readFeedbackIssue(issueId) {
  const roles = await requireFeedbackRole();
  const sql = db();
  const [issue] = await sql`SELECT * FROM feedback_issues WHERE id=${issueId}`;
  if (!issue) throw new FeedbackError("Issue not found.", 404);
  const [reports, events, diagnostics, audits] = await Promise.all([
    sql`SELECT id,category,channel,created_at FROM feedback_reports WHERE issue_id=${issueId} ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT id,kind,visibility,body,created_at FROM feedback_events WHERE issue_id=${issueId} AND report_id IS NULL ORDER BY created_at LIMIT 200`,
    sql`SELECT code,stage,route,release,duration_ms,outcome,created_at FROM quality_events WHERE issue_id=${issueId} AND ${roles.includes("reliability")} ORDER BY created_at DESC LIMIT 50`,
    sql`SELECT actor_id,action,created_at FROM feedback_admin_audit WHERE issue_id=${issueId} ORDER BY created_at DESC LIMIT 50`,
  ]);
  await audit("issue-read", { issueId });
  return {
    issue,
    reports,
    events,
    diagnostics,
    audits,
    roles: await feedbackRole(),
  };
}
export async function updateFeedbackIssue(issueId, input) {
  await requireFeedbackRole();
  const sql = db();
  const current = await readFeedbackIssue(issueId),
    issue = current.issue;
  if (input.revision !== issue.revision)
    throw new FeedbackError("This issue changed. Refresh before saving.", 409);
  const status = FEEDBACK_STATUSES.includes(input.status)
      ? input.status
      : issue.status,
    severity = ["critical", "high", "normal", "low"].includes(input.severity)
      ? input.severity
      : issue.severity,
    resolution = redact(input.resolution ?? issue.resolution).slice(0, 2000),
    verification = redact(input.verification ?? issue.verification).slice(
      0,
      2000,
    );
  if (status === "resolved" && (!resolution || !verification))
    throw new FeedbackError("Record the resolution and how it was verified.");
  if (status === "closed-without-change" && !resolution)
    throw new FeedbackError("Explain why this issue is being closed.");
  if (
    ["resolved", "closed-without-change"].includes(status) &&
    input.publicUpdate !== true
  )
    throw new FeedbackError(
      "Share a completion comment with the reporter before closing this issue.",
    );
  const statusChanged = status !== issue.status;
  const owner = input.assignToMe
      ? currentUserId()
      : input.unassign
        ? null
        : issue.owner_id,
    publicUpdate = input.publicUpdate === true;
  const changed = await sql`WITH changed AS (
 UPDATE feedback_issues SET status=${status},severity=${severity},owner_id=${owner},resolution=${resolution},verification=${verification},revision=revision+1,updated_at=now() WHERE id=${issueId} AND revision=${input.revision} RETURNING id
 ), event AS (INSERT INTO feedback_events(id,issue_id,actor_id,visibility,kind,body) SELECT ${id()},id,${currentUserId()},'internal','status',${status + ": " + resolution} FROM changed),
 public_events AS (INSERT INTO feedback_events(id,issue_id,report_id,actor_id,visibility,kind,body) SELECT ${id()}||r.id,r.issue_id,r.id,${currentUserId()},'public','status',${publicUpdate ? status + ": " + resolution : "Review status: " + status} FROM feedback_reports r JOIN changed c ON c.id=r.issue_id WHERE ${publicUpdate || statusChanged}),
 touched AS (UPDATE feedback_reports SET updated_at=now() WHERE issue_id IN(SELECT id FROM changed) AND ${publicUpdate || statusChanged}),
 logged AS (INSERT INTO feedback_admin_audit(id,actor_id,issue_id,action) SELECT ${id()},${currentUserId()},id,'issue-updated' FROM changed) SELECT id FROM changed`;
  if (!changed.length)
    throw new FeedbackError("This issue changed. Refresh before saving.", 409);
  return readFeedbackIssue(issueId);
}
export async function mergeFeedbackIssues(sourceId, targetId) {
  await requireFeedbackRole();
  if (sourceId === targetId) throw new FeedbackError("Choose another issue.");
  const sql = db();
  const target = await readFeedbackIssue(targetId),
    source = await readFeedbackIssue(sourceId);
  const [result] =
    await sql`WITH locked AS MATERIALIZED (SELECT id FROM feedback_issues WHERE id IN (${sourceId},${targetId}) ORDER BY id FOR UPDATE),
  valid AS MATERIALIZED (SELECT s.id FROM feedback_issues s,feedback_issues t WHERE s.id=${sourceId} AND t.id=${targetId} AND s.revision=${source.issue.revision} AND t.revision=${target.issue.revision} AND t.status NOT IN ('resolved','closed-without-change') AND (SELECT count(*) FROM locked)=2),
  reports AS (UPDATE feedback_reports SET issue_id=${targetId},updated_at=now() WHERE issue_id=${sourceId} AND EXISTS(SELECT 1 FROM valid) RETURNING id),
  diagnostics AS (UPDATE quality_events SET issue_id=${targetId} WHERE issue_id=${sourceId} AND EXISTS(SELECT 1 FROM valid)),
  events AS (UPDATE feedback_events SET issue_id=${targetId} WHERE issue_id=${sourceId} AND EXISTS(SELECT 1 FROM valid) AND (report_id IS NOT NULL OR visibility='internal')),
  notices AS (INSERT INTO feedback_events(id,issue_id,report_id,actor_id,visibility,kind,body) SELECT ${id()}||id,${targetId},id,${currentUserId()},'public','grouped','Your report is being investigated together with related reports. Your messages and attachments remain private to your report.' FROM reports),
  source AS (UPDATE feedback_issues SET status='closed-without-change',resolution='Grouped into another issue',updated_at=now(),revision=revision+1 WHERE id=${sourceId} AND EXISTS(SELECT 1 FROM valid)),
  target AS (UPDATE feedback_issues SET updated_at=now(),revision=revision+1 WHERE id=${targetId} AND EXISTS(SELECT 1 FROM valid)),
  logged AS (INSERT INTO feedback_admin_audit(id,actor_id,issue_id,action) SELECT ${id()},${currentUserId()},${targetId},'issues-grouped' FROM valid)
  SELECT count(*)::int n FROM valid`;
  if (!result.n)
    throw new FeedbackError(
      "The issues changed, or the target is already closed. Refresh before grouping.",
      409,
    );
  return readFeedbackIssue(targetId);
}
export async function recordQualityEvent(
  input,
  { userId = currentUserId(), eventId = id() } = {},
) {
  if (
    !database ||
    process.env.FEEDBACK_DIAGNOSTICS === "off" ||
    process.env.VERCEL_ENV === "preview"
  )
    return;
  const sql = database,
    p = qualityPayload(input),
    release = text(process.env.VERCEL_GIT_COMMIT_SHA || "local", 48),
    fingerprint = hash({ ...p, durationMs: null, release }),
    issueId = `fi-${fingerprint.slice(0, 32)}`;
  if (p.code === "PERFORMANCE" && (p.durationMs == null || p.durationMs < 2000))
    return;
  const [settings] =
    await sql`SELECT diagnostics,performance FROM feedback_preferences WHERE user_id=${userId}`;
  if (
    settings?.diagnostics === false ||
    (p.code === "PERFORMANCE" && settings?.performance !== true)
  )
    return;
  const [count] =
    await sql`SELECT count(*)::int n FROM quality_events WHERE user_id=${userId} AND created_at>now()-interval '1 hour'`;
  if (count.n >= 60) return;
  await sql.transaction([
    sql`INSERT INTO feedback_issues(id,fingerprint,title,category,subject) VALUES(${issueId},${fingerprint},${p.code + " · " + p.stage},${p.code === "PERFORMANCE" ? "slow" : "broken"},${json({ kind: "general", route: p.route })}::jsonb) ON CONFLICT(fingerprint) DO UPDATE SET updated_at=now(),status=CASE WHEN feedback_issues.status='resolved' THEN 'new' ELSE feedback_issues.status END`,
    sql`INSERT INTO quality_events(id,user_id,issue_id,fingerprint,code,stage,route,release,duration_ms,outcome) VALUES(${eventId},${userId},${issueId},${fingerprint},${p.code},${p.stage},${p.route},${release},${p.durationMs},${p.outcome}) ON CONFLICT DO NOTHING`,
  ]);
}
export async function feedbackMaintenance() {
  if (!database || process.env.VERCEL_ENV === "preview") return;
  const sql = database;
  await sql.transaction([
    sql`DELETE FROM feedback_drafts WHERE expires_at<now()-interval '1 day'`,
    sql`DELETE FROM quality_events WHERE created_at<now()-interval '30 days'`,
    sql`UPDATE feedback_reports r SET contact_email_ciphertext=null FROM feedback_issues i WHERE r.issue_id=i.id AND i.status IN ('resolved','closed-without-change') AND i.updated_at<now()-interval '90 days'`,
    sql`DELETE FROM feedback_evidence e USING feedback_reports r,feedback_issues i WHERE e.report_id=r.id AND r.issue_id=i.id AND i.status IN ('resolved','closed-without-change') AND i.updated_at<now()-interval '90 days'`,
    sql`DELETE FROM feedback_reports r USING feedback_issues i WHERE r.issue_id=i.id AND i.status IN ('resolved','closed-without-change') AND i.updated_at<now()-interval '12 months'`,
    sql`DELETE FROM feedback_issues i WHERE i.updated_at<now()-interval '30 days' AND NOT EXISTS(SELECT 1 FROM feedback_reports r WHERE r.issue_id=i.id) AND NOT EXISTS(SELECT 1 FROM quality_events q WHERE q.issue_id=i.id)`,
    sql`DELETE FROM feedback_admin_audit WHERE created_at<now()-interval '12 months'`,
  ]);
  const jobs =
    await sql`UPDATE feedback_jobs SET status='running',lease_token=${id()},lease_until=now()+interval '2 minutes',attempts=attempts+1 WHERE id IN (SELECT id FROM feedback_jobs WHERE (status='pending' OR (status='running' AND lease_until<now())) AND run_after<=now() AND attempts<3 ORDER BY created_at LIMIT 2 FOR UPDATE SKIP LOCKED) RETURNING *`;
  for (const job of jobs) {
    try {
      const [report] =
        await sql`SELECT * FROM feedback_reports WHERE id=${job.report_id}`;
      if (report) {
        const suggestion =
          ["credits", "attendance"].includes(report.subject.kind) ||
          report.category === "wrong-action"
            ? "high"
            : report.category === "suggestion"
              ? "low"
              : "normal";
        await sql`INSERT INTO feedback_events(id,issue_id,report_id,visibility,kind,body) VALUES(${`job-${job.id}`},${report.issue_id},${report.id},'internal','triage-suggestion',${`Suggested severity: ${suggestion}. Based on the selected category and surface; requires administrator review.`}) ON CONFLICT DO NOTHING`;
      }
      if (report?.ai_review && process.env.FEEDBACK_AI_TRIAGE === "on") {
        const [daily] =
          await sql`SELECT count(*)::int n FROM feedback_events WHERE kind='ai-triage-suggestion' AND created_at>now()-interval '1 day'`;
        if (daily.n < 20) {
          const evidence =
            await sql`SELECT label,media_type,ciphertext FROM feedback_evidence WHERE report_id=${report.id} AND media_type='text/plain' LIMIT 3`;
          const suggestion = await suggestFeedbackTriage(
            report,
            evidence.map((e) => ({
              label: e.label,
              mediaType: e.media_type,
              content: unseal(e.ciphertext),
            })),
          );
          if (suggestion)
            await sql`INSERT INTO feedback_events(id,issue_id,report_id,visibility,kind,body) SELECT ${`ai-${job.id}`},${report.issue_id},${report.id},'internal','ai-triage-suggestion',${"AI suggestion — unverified. " + suggestion} WHERE EXISTS(SELECT 1 FROM feedback_jobs WHERE id=${job.id} AND lease_token=${job.lease_token}) ON CONFLICT DO NOTHING`;
        }
      }
      await sql`UPDATE feedback_jobs SET status='completed',lease_until=null WHERE id=${job.id} AND lease_token=${job.lease_token}`;
    } catch {
      await sql`UPDATE feedback_jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'pending' END,run_after=now()+interval '5 minutes',lease_until=null WHERE id=${job.id} AND lease_token=${job.lease_token}`;
    }
  }
}
export async function exportFeedback() {
  if (!database) return { reports: [], reactions: [], preferences: defaults };
  const sql = database;
  const reports =
    await sql`SELECT r.*,i.status,i.resolution FROM feedback_reports r JOIN feedback_issues i ON i.id=r.issue_id WHERE r.user_id=${currentUserId()}`;
  return {
    reports: await Promise.all(
      reports.map(async (r) => ({
        ...(await readFeedback(r.id, { markSeen: false })),
        evidence: await Promise.all(
          (
            await sql`SELECT id FROM feedback_evidence WHERE report_id=${r.id}`
          ).map((e) => feedbackEvidence(r.id, e.id)),
        ),
      })),
    ),
    reactions:
      await sql`SELECT * FROM feedback_reactions WHERE user_id=${currentUserId()}`,
    preferences: await feedbackPreferences(),
  };
}
export async function eraseFeedback() {
  if (!database) return;
  const sql = database,
    user = currentUserId();
  await sql.transaction([
    sql`DELETE FROM feedback_drafts WHERE user_id=${user}`,
    sql`DELETE FROM feedback_reports WHERE user_id=${user}`,
    sql`DELETE FROM feedback_reactions WHERE user_id=${user}`,
    sql`DELETE FROM quality_events WHERE user_id=${user}`,
    sql`DELETE FROM feedback_preferences WHERE user_id=${user}`,
    sql`DELETE FROM feedback_roles WHERE user_id=${user}`,
    sql`DELETE FROM feedback_events WHERE actor_id=${user}`,
    sql`DELETE FROM feedback_admin_audit WHERE actor_id=${user}`,
    sql`DELETE FROM feedback_issues i WHERE NOT EXISTS(SELECT 1 FROM feedback_reports r WHERE r.issue_id=i.id) AND NOT EXISTS(SELECT 1 FROM quality_events q WHERE q.issue_id=i.id)`,
  ]);
}
export async function feedbackMetrics() {
  const roles = await requireFeedbackRole(),
    sql = db();
  const [overview] =
    await sql`SELECT (SELECT count(*)::int FROM feedback_reports WHERE created_at>now()-interval '30 days') reports, (SELECT count(*)::int FROM feedback_reactions WHERE value='helpful' AND updated_at>now()-interval '30 days') helpful, (SELECT count(*)::int FROM feedback_reactions WHERE value='not-helpful' AND updated_at>now()-interval '30 days') not_helpful, (SELECT count(*)::int FROM feedback_issues WHERE status NOT IN ('resolved','closed-without-change')) open, (SELECT round(extract(epoch FROM now()-min(created_at))/86400,1) FROM feedback_issues WHERE status='new') oldest_new_days`;
  const jobs = roles.includes("reliability")
    ? await sql`SELECT status,count(*)::int count FROM feedback_jobs GROUP BY status`
    : [];
  return { overview, jobs, roles };
}

export function feedbackContactOption() {
  return { email: currentAuth().email || null };
}
export async function feedbackContact(
  reportId,
  { admin = false, remove = false } = {},
) {
  const sql = db();
  if (admin) await requireFeedbackRole();
  const [row] =
    await sql`SELECT issue_id,contact_email_ciphertext FROM feedback_reports WHERE id=${reportId} AND (${admin} OR user_id=${currentUserId()})`;
  if (!row) throw new FeedbackError("Report not found.", 404);
  if (remove) {
    await sql`UPDATE feedback_reports SET contact_email_ciphertext=null WHERE id=${reportId} AND user_id=${currentUserId()}`;
    return { removed: true };
  }
  if (!row.contact_email_ciphertext)
    throw new FeedbackError("No contact email is shared on this report.", 404);
  if (admin)
    await audit("contact-email-read", { issueId: row.issue_id, reportId });
  return { email: unseal(row.contact_email_ciphertext) };
}
