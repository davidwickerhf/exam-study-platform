export function registerFeedbackTools(server, { z, run, api }) {
  const id = z.string().min(1).max(180),
    subject = z.object({
      kind: z
        .enum([
          "general",
          "answer",
          "material",
          "assignment",
          "announcement",
          "sync",
          "attendance",
          "credits",
          "practice",
        ])
        .optional(),
      route: z.string().max(500).optional(),
      conversationId: id.optional(),
      answerId: id.optional(),
      answerRevision: id.optional(),
      courseCode: id.optional(),
      academicYear: id.optional(),
      assetId: id.optional(),
      itemId: id.optional(),
      jobId: id.optional(),
    });
  const tool = (name, description, schema, handler) =>
    server.tool(name, description, schema, run(handler));
  tool(
    "feedback_prepare",
    "Prepare an encrypted feedback preview. This does NOT submit it. Show the complete returned preview and ask explicit confirmation. Include only the user’s intended feedback; excerpts require their consent. This report is separate from Tutor memory.",
    {
      category: z.enum([
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
      ]),
      note: z.string().max(4000),
      shareContactEmail: z
        .boolean()
        .optional()
        .describe(
          "Share the verified account email only if the user explicitly opts in. The preview shows the exact address.",
        ),
      subject: subject.optional(),
      evidence: z
        .array(
          z.object({
            label: z.string().max(100),
            mediaType: z.literal("text/plain"),
            content: z.string().max(12000),
          }),
        )
        .max(5)
        .optional(),
    },
    (args) => api("/api/feedback/drafts", { method: "POST", body: args }),
  );
  tool(
    "feedback_submit",
    "Submit exactly the reviewed feedback draft. Obtain fresh explicit user confirmation for this report; pass its unchanged revision. Retrying the same confirmed draft returns the same receipt.",
    { draftId: id, revision: id },
    (args) => api("/api/feedback/reports", { method: "POST", body: args }),
  );
  tool(
    "feedback_list",
    "Read the user’s submitted feedback and public review status. Private administrator notes are excluded.",
    { before: id.optional() },
    (args) => api("/api/feedback/reports", { query: args }),
  );
  tool(
    "feedback_read",
    "Read one owned feedback report, public replies and attachment metadata. Does not read any referenced chat or private course file.",
    { reportId: id },
    (args) => api(`/api/feedback/reports/${encodeURIComponent(args.reportId)}`),
  );
  tool(
    "feedback_reply",
    "Add the exact user-approved follow-up to an owned report.",
    { reportId: id, body: z.string().min(1).max(4000) },
    (args) =>
      api(
        `/api/feedback/reports/${encodeURIComponent(args.reportId)}/replies`,
        { method: "POST", body: args },
      ),
  );
  tool(
    "feedback_withdraw_evidence",
    "Permanently withdraw a shared attachment from an owned feedback report after explicit confirmation. Does not delete the original course or Tutor file.",
    { reportId: id, evidenceId: id },
    (args) =>
      api(
        `/api/feedback/reports/${encodeURIComponent(args.reportId)}/evidence/${encodeURIComponent(args.evidenceId)}`,
        { method: "DELETE", body: args },
      ),
  );
  tool(
    "feedback_react",
    "Record or remove the student’s explicitly chosen reaction to one exact Tutor answer revision.",
    { subject, value: z.enum(["helpful", "not-helpful"]).nullable() },
    (args) => api("/api/feedback/reactions", { method: "POST", body: args }),
  );
  tool(
    "feedback_withdraw_contact",
    "Stop sharing the account email on this report, after explicit user confirmation.",
    { reportId: id },
    (args) =>
      api(
        `/api/feedback/reports/${encodeURIComponent(args.reportId)}/contact`,
        { method: "DELETE", body: args },
      ),
  );
}
