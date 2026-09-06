import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeReport,
  qualityPayload,
  stableTutorMessages,
  seal,
  unseal,
} from "../lib/feedback-contract.mjs";
import { requiresWriteConfirmation } from "../mcp/write-confirmation.mjs";
test("feedback preview includes only intentional fields and redacts credentials", () => {
  const report = normalizeReport({
    category: "incorrect",
    note: "access_token=private",
    chat: "PRIVATE CHAT",
    subject: {
      kind: "answer",
      route: "/app/tutor?token=private",
      secret: "private",
    },
    evidence: [{ content: "Bearer abcdefghi", label: "Excerpt" }],
  });
  assert.equal(report.note, "[redacted credential]");
  assert.equal(report.subject.route, "/app/tutor");
  assert.ok(!JSON.stringify(report).includes("PRIVATE CHAT"));
  assert.equal(report.aiReview, false);
  assert.throws(() =>
    normalizeReport({
      category: "other",
      evidence: [
        { mediaType: "image/png", content: "data:image/png;base64,YWJj" },
      ],
    }),
  );
  assert.throws(() =>
    normalizeReport({
      category: "other",
      evidence: Array(6).fill({ content: "text" }),
    }),
  );
});
test("diagnostics discard raw errors, query strings, request bodies and private context", () => {
  assert.deepEqual(
    qualityPayload({
      code: "API_FAILURE",
      route: "/api/tutor?conversation=private",
      stage: "unknown",
      durationMs: Infinity,
      error: "SECRET",
      body: "PRIVATE",
    }),
    {
      code: "API_FAILURE",
      route: "/api/tutor",
      stage: "request",
      durationMs: null,
      outcome: "failed",
    },
  );
  assert.throws(() => qualityPayload({ code: "SECRET_ERROR_MESSAGE" }));
});
test("legacy answer references survive transcript compaction and subsequent turns", () => {
  const conversation = {
    id: "c",
    messages: [
      { role: "user", content: "one" },
      { role: "assistant", tool_calls: [{}] },
      { role: "tool", content: "payload" },
      { role: "assistant", content: "answer" },
    ],
  };
  const first = stableTutorMessages(conversation),
    answer = first[3];
  const compacted = stableTutorMessages({
    ...conversation,
    messages: [first[0], first[3], { role: "user", content: "two" }],
  });
  assert.equal(compacted[1].id, answer.id);
  assert.equal(compacted[1].answerRevision, answer.answerRevision);
  assert.equal(compacted[1].turnId, first[0].id);
});
test("feedback evidence encryption is randomized and rejects tampering", () => {
  process.env.FEEDBACK_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString("base64");
  const a = seal("private excerpt"),
    b = seal("private excerpt");
  assert.notEqual(a, b);
  assert.equal(unseal(a), "private excerpt");
  const parts = a.split(".");
  parts[1] = Buffer.alloc(16).toString("base64url");
  assert.throws(() => unseal(parts.join(".")));
});
test("MCP feedback mutations require one explicit confirmation per write", () => {
  for (const name of [
    "feedback_withdraw_contact",
    "feedback_submit",
    "feedback_reply",
    "feedback_withdraw_evidence",
    "feedback_react",
  ])
    assert.equal(requiresWriteConfirmation(name), true);
  for (const name of ["feedback_prepare", "feedback_read", "feedback_list"])
    assert.equal(requiresWriteConfirmation(name), false);
});
