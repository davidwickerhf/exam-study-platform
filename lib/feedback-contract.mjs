import { cleanFeedbackPng } from "./feedback-images.mjs";
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
export const FEEDBACK_CATEGORIES = [
  "incorrect",
  "outdated",
  "missing",
  "source",
  "slow",
  "broken",
  "confusing",
  "accessibility",
  "suggestion",
  "other",
  "wrong-edition",
  "incomplete-extraction",
  "broken-download",
  "ignored-context",
  "too-wordy",
  "wrong-action",
];
export const FEEDBACK_STATUSES = [
  "new",
  "triaged",
  "investigating",
  "planned",
  "in-progress",
  "needs-information",
  "awaiting-verification",
  "resolved",
  "closed-without-change",
];
export const FEEDBACK_KINDS = [
  "general",
  "answer",
  "material",
  "assignment",
  "announcement",
  "sync",
  "attendance",
  "credits",
  "practice",
];
export const FEEDBACK_CODES = [
  "API_FAILURE",
  "TUTOR_FAILURE",
  "TUTOR_INTERRUPTED",
  "ANSWER_INVALID_REFERENCE",
  "ANSWER_INVALID_WIDGET",
  "SYNC_FAILURE",
  "EXTRACTION_FAILURE",
  "NAVIGATION_FAILURE",
  "CLIENT_FAILURE",
  "PERFORMANCE",
];
export class FeedbackError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const hash = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export const text = (v, max = 2000) =>
  String(v ?? "")
    .trim()
    .slice(0, max);
export const identifier = (v) => (/^[\w.:@-]{1,180}$/.test(v || "") ? v : "");
export function safeRoute(value) {
  const path = String(value || "").split(/[?#]/)[0];
  if (path === "/app") return "/app";
  const match = path.match(
    /^\/(app|api)\/(tutor|courses|updates|practice|planning|calendar|settings|documents|feedback|admin|account|integrations|retrieve|academics)(?:\/|$)/,
  );
  return match ? `/${match[1]}/${match[2]}` : "/app/other";
}
export function redact(value) {
  return text(value, 12000)
    .replace(/\b(?:Bearer\s+)[\w.~-]+/gi, "[redacted credential]")
    .replace(/\b(?:sk-|wsk_|wk_)[\w-]{12,}/g, "[redacted credential]")
    .replace(
      /([?&](?:token|verifier|key|access_token)=)[^\s&#]+/gi,
      "$1[redacted]",
    )
    .replace(
      /\b(?:password|secret|access_token)\s*[:=]\s*\S+/gi,
      "[redacted credential]",
    );
}
export function normalizeSubject(value = {}) {
  const kind = FEEDBACK_KINDS.includes(value.kind) ? value.kind : "general";
  const out = { kind, route: safeRoute(value.route) };
  for (const key of [
    "conversationId",
    "answerId",
    "answerRevision",
    "courseId",
    "courseCode",
    "editionId",
    "academicYear",
    "assetId",
    "chapterId",
    "itemId",
    "jobId",
    "questionId",
    "version",
    "page",
    "recordId",
  ])
    if (identifier(String(value[key] || ""))) out[key] = String(value[key]);
  return out;
}
export function normalizeReport(input = {}) {
  if (!FEEDBACK_CATEGORIES.includes(input.category))
    throw new FeedbackError("Choose a feedback category.");
  const evidence = input.evidence || [];
  if (!Array.isArray(evidence) || evidence.length > 5)
    throw new FeedbackError("Attach up to five items.");
  const normalized = evidence.map((item) => {
    const mediaType =
      item.mediaType === "image/png" ? "image/png" : "text/plain";
    let content =
      mediaType === "text/plain"
        ? redact(item.content)
        : String(item.content || "");
    if (
      mediaType === "image/png" &&
      (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(content) ||
        content.length > 7_000_000)
    )
      throw new FeedbackError("Choose a PNG screenshot under 5 MB.");
    if (mediaType === "image/png") {
      try {
        content = cleanFeedbackPng(content);
      } catch (error) {
        throw new FeedbackError(error.message);
      }
    }
    if (!content) throw new FeedbackError("Evidence must not be empty.");
    return {
      label: redact(item.label || "Shared excerpt").slice(0, 100),
      mediaType,
      content,
    };
  });
  if (JSON.stringify(normalized).length > 20_000_000)
    throw new FeedbackError("Attachments are too large.");
  return {
    shareContactEmail: input.shareContactEmail === true,
    category: input.category,
    subject: normalizeSubject(input.subject),
    note: redact(input.note).slice(0, 4000),
    evidence: normalized,
    aiReview: input.aiReview === true,
    channel: ["tutor", "mcp", "material", "error"].includes(input.channel)
      ? input.channel
      : "web",
    consentVersion: "feedback-v1",
  };
}
function key() {
  const k = Buffer.from(
    process.env.FEEDBACK_ENCRYPTION_KEY ||
      process.env.CANVAS_CONNECTION_ENCRYPTION_KEY ||
      "",
    "base64",
  );
  if (k.length !== 32)
    throw new FeedbackError(
      "Secure feedback evidence storage is unavailable.",
      503,
    );
  return k;
}
export function seal(value) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes]
    .map((x) => x.toString("base64url"))
    .join(".");
}
export function unseal(value) {
  const [iv, tag, data] = value
    .split(".")
    .map((x) => Buffer.from(x, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
// JSONB reorders object keys. A revision must represent the visible content,
// not the order in which its presentation properties were serialized.
function canonicalPresentation(value) {
  if (Array.isArray(value)) return value.map(canonicalPresentation);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalPresentation(value[key])]),
    );
  return value;
}
export function stableTutorMessages(conversation) {
  let turn = "";
  return (conversation.messages || []).map((message, index) => {
    const id =
      message.id ||
      `msg-${hash(`${conversation.id}:${index}:${message.at || ""}:${message.role}:${message.content || ""}`).slice(0, 32)}`;
    if (message.role === "user") turn = message.turnId || id;
    return {
      ...message,
      id,
      turnId: message.turnId || turn,
      answerRevision: hash(
        `${message.content || ""}:${JSON.stringify(canonicalPresentation(message.presentation || {}))}`,
      ).slice(0, 24),
    };
  });
}
export function qualityPayload(input = {}) {
  if (!FEEDBACK_CODES.includes(input.code))
    throw new FeedbackError("Unknown diagnostic code.");
  return {
    code: input.code,
    stage: [
      "request",
      "retrieval",
      "generation",
      "stream",
      "download",
      "extraction",
      "index",
      "navigation",
      "render",
    ].includes(input.stage)
      ? input.stage
      : "request",
    route: safeRoute(input.route),
    durationMs: Number.isFinite(input.durationMs)
      ? Math.min(3600000, Math.max(0, Math.round(input.durationMs)))
      : null,
    outcome: ["failed", "interrupted", "completed", "cancelled"].includes(
      input.outcome,
    )
      ? input.outcome
      : "failed",
  };
}
