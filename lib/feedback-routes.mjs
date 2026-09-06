import * as store from "./feedback-store.mjs";
import { FeedbackError } from "./feedback-contract.mjs";
import { currentAuth } from "./request-context.mjs";
export async function handleFeedbackRoute(req, res, url, { readBody, send }) {
  const path = url.pathname,
    admin = path.startsWith("/api/admin/feedback");
  if (!path.startsWith("/api/feedback") && !admin) return false;
  const reply = (value, status = 200) =>
    send(
      res,
      status,
      JSON.stringify(value),
      "application/json; charset=utf-8",
      { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    );
  try {
    if (
      process.env.FEEDBACK_SUBMISSIONS === "off" &&
      req.method !== "GET" &&
      !admin &&
      path !== "/api/feedback/diagnostics"
    )
      throw new FeedbackError(
        "Feedback submissions are temporarily paused. Please try again later.",
        503,
      );
    const method = req.method,
      body = ["POST", "PATCH", "DELETE"].includes(method)
        ? await readBody(
            req,
            path === "/api/feedback/drafts" ? 21 * 1024 * 1024 : 16 * 1024,
          )
        : {};
    // A local AI must obtain fresh permission for each write, including replies,
    // votes and evidence withdrawal. Preparing an encrypted preview is not a report.
    if (
      currentAuth().mode === "api-key" &&
      method !== "GET" &&
      path !== "/api/feedback/drafts" &&
      body.confirmed !== true
    )
      throw new FeedbackError(
        "Explicit user confirmation is required for this write.",
        403,
      );
    if (path === "/api/feedback/contact" && method === "GET")
      reply(store.feedbackContactOption());
    else if (path === "/api/feedback/preferences" && method === "GET")
      reply(await store.feedbackPreferences());
    else if (path === "/api/feedback/preferences" && method === "PATCH")
      reply(await store.saveFeedbackPreferences(body));
    else if (path === "/api/feedback/drafts" && method === "POST")
      reply(
        await store.prepareFeedback({
          ...body,
          channel: currentAuth().mode === "api-key" ? "mcp" : body.channel,
        }),
        201,
      );
    else if (/^\/api\/feedback\/drafts\/[^/]+$/.test(path) && method === "GET")
      reply(await store.readFeedbackDraft(path.split("/").at(-1)));
    else if (path === "/api/feedback/reports" && method === "POST")
      reply(await store.submitFeedback(body), 201);
    else if (path === "/api/feedback/reports" && method === "GET")
      reply(await store.listFeedback(Object.fromEntries(url.searchParams)));
    else if (path === "/api/feedback/reactions" && method === "POST")
      reply(await store.reactToAnswer(body));
    else if (path === "/api/feedback/reactions" && method === "GET")
      reply(
        await store.feedbackReactions(
          url.searchParams.get("conversationId") || "",
        ),
      );
    else if (path === "/api/feedback/diagnostics" && method === "POST") {
      await store.recordQualityEvent(body);
      reply({ received: true });
    } else if (path === "/api/admin/feedback/metrics" && method === "GET")
      reply(await store.feedbackMetrics());
    else if (path === "/api/admin/feedback/roles" && method === "GET")
      reply(await store.feedbackRoles());
    else if (path === "/api/admin/feedback/roles" && method === "PATCH")
      reply(await store.feedbackRoles(body));
    else if (path === "/api/admin/feedback/issues" && method === "GET")
      reply(
        await store.listFeedbackIssues(Object.fromEntries(url.searchParams)),
      );
    else {
      const contact = path.match(
        /^\/api\/(admin\/)?feedback\/reports\/([^/]+)\/contact$/,
      );
      if (
        contact &&
        ["GET", "DELETE"].includes(method) &&
        !(admin && method === "DELETE")
      ) {
        reply(
          await store.feedbackContact(contact[2], {
            admin,
            remove: method === "DELETE",
          }),
        );
        return true;
      }
      const evidence = path.match(
        /^\/api\/(admin\/)?feedback\/reports\/([^/]+)\/evidence\/([^/]+)$/,
      );
      const report = path.match(
        /^\/api\/(admin\/)?feedback\/reports\/([^/]+)(\/replies)?$/,
      );
      const issue = path.match(
        /^\/api\/admin\/feedback\/issues\/([^/]+)(\/merge)?$/,
      );
      if (
        evidence &&
        ["GET", "DELETE"].includes(method) &&
        !(admin && method === "DELETE")
      )
        reply(
          await store.feedbackEvidence(evidence[2], evidence[3], {
            admin,
            remove: method === "DELETE",
          }),
        );
      else if (report && method === "GET" && !report[3])
        reply(await store.readFeedback(report[2], { admin }));
      else if (report && method === "POST" && report[3])
        reply(await store.replyFeedback(report[2], body, { admin }));
      else if (issue && method === "GET" && !issue[2])
        reply(await store.readFeedbackIssue(issue[1]));
      else if (issue && method === "PATCH" && !issue[2])
        reply(await store.updateFeedbackIssue(issue[1], body));
      else if (
        issue &&
        method === "POST" &&
        issue[2] &&
        body.confirmed === true
      )
        reply(await store.mergeFeedbackIssues(issue[1], body.targetId));
      else throw new FeedbackError("Feedback operation not found.", 404);
    }
  } catch (error) {
    reply(
      {
        error:
          error instanceof FeedbackError
            ? error.message
            : "Feedback could not be saved or loaded. Please retry.",
      },
      error instanceof FeedbackError ? error.status : 503,
    );
  }
  return true;
}
