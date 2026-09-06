"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  FeedbackButton,
  feedbackApi,
  field,
  label,
  useFeedback,
  categories,
} from "./feedback";
const statuses = [
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
type Item = {
  id: string;
  title: string;
  category: string;
  status: string;
  note?: string;
  severity?: string;
  createdAt?: string;
  created_at?: string;
  unread?: boolean;
  reports?: number;
  occurrences?: number;
};
type Event = {
  id: string;
  kind: string;
  body: string;
  visibility: string;
  created_at: string;
};
type Evidence = {
  id: string;
  label: string;
  media_type: string;
  content?: string;
  mediaType?: string;
  byte_size: number;
};
type Report = Item & {
  issueId: string;
  receivedAt?: string;
  contactShared?: boolean;
  contactEmail?: string;
  events: Event[];
  evidence: Evidence[];
  subject: Record<string, string>;
};
type Issue = Item & {
  revision: number;
  resolution: string;
  verification: string;
  owner_id?: string;
  subject: Record<string, string>;
};
type Detail = {
  issue: Issue;
  reports: { id: string; category: string; created_at: string }[];
  events: Event[];
  diagnostics: {
    code: string;
    stage: string;
    duration_ms?: number;
    created_at: string;
    release: string;
  }[];
  audits: { action: string; actor_id: string; created_at: string }[];
  roles: string[];
};
function when(v?: string) {
  return v ? new Date(v).toLocaleString() : "";
}
function State({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium">
      {label(value)}
    </span>
  );
}
function Shell({
  title,
  description,
  children,
  actions,
  admin = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  admin?: boolean;
}) {
  return (
    <main className="min-h-full">
      <header className="border-b px-5 py-6 sm:px-8">
        <Link
          href={admin ? "/app/admin" : "/app"}
          className="text-muted-foreground text-sm"
        >
          ← {admin ? "Admin" : "Workspace"}
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
              {description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">{children}</div>
    </main>
  );
}
export function FeedbackInbox({ admin = false }: { admin?: boolean }) {
  const [items, setItems] = useState<Item[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [cursor, setCursor] = useState<string | null>(null),
    [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [owner, setOwner] = useState("");
  const open = useFeedback(),
    params = useSearchParams(),
    draft = params.get("draft");
  useEffect(() => {
    if (draft) open({ draftId: draft });
  }, [draft]);
  const base = admin ? "/api/admin/feedback/issues" : "/api/feedback/reports";
  async function load(before = "") {
    setLoading(true);
    setError("");
    try {
      const result = await feedbackApi(
        `${base}?${new URLSearchParams({ status, category, owner, before })}`,
      );
      setItems((old) => (before ? [...old, ...result.items] : result.items));
      setCursor(result.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [admin, status, category, owner]);
  return (
    <Shell
      admin={admin}
      title={admin ? "Feedback review" : "My feedback"}
      description={
        admin
          ? "Review reports, investigate recurring failures and track verified fixes."
          : "Your reports, replies and shared evidence in one place."
      }
      actions={
        <>
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
          {!admin && <FeedbackButton />}
        </>
      }
    >
      {admin && <FeedbackReviewOverview />}
      {admin && (
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Status
            <select
              className={field}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Category
            <select
              className={field}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Owner
            <select
              className={field}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">Everyone</option>
              <option value="me">Assigned to me</option>
            </select>
          </label>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {loading && !items.length ? (
        <div
          role="status"
          className="rounded-xl border p-8 text-muted-foreground"
        >
          Loading feedback…
        </div>
      ) : !items.length && !error ? (
        <div className="rounded-xl border bg-card p-8">
          <h2 className="font-heading text-xl font-semibold">
            {admin
              ? "No reports match these filters"
              : "A direct line to the team"}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {admin
              ? "New reports and technical incidents will appear here."
              : "Share a suggestion or report something that is not working. You choose the details to include and can follow the review here."}
          </p>
          {!admin && (
            <div className="mt-4">
              <FeedbackButton />
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`${admin ? "/app/admin/feedback" : "/app/feedback"}/${item.id}`}
              className="block px-5 py-4 hover:bg-muted/50"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  {item.unread && (
                    <span className="mr-2 inline-block size-2 rounded-full bg-primary" />
                  )}
                  {item.title}
                </h2>
                <State value={item.status} />
              </div>
              {item.note && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {item.note}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {when(item.createdAt || item.created_at)}
                {admin &&
                  ` · ${item.reports} reports · ${item.occurrences} diagnostic events · ${label(item.severity || "normal")}`}
              </p>
            </Link>
          ))}
        </div>
      )}
      {cursor && (
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => void load(cursor)}
        >
          Load more
        </Button>
      )}
      {!admin && <FeedbackPreferences />}
    </Shell>
  );
}
export function FeedbackPreferences() {
  const [prefs, setPrefs] = useState<{
      diagnostics: boolean;
      performance: boolean;
      notifications: boolean;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    feedbackApi("/api/feedback/preferences")
      .then(setPrefs)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="rounded-xl border p-5">
      <h2 className="font-heading text-lg font-semibold">
        Feedback & diagnostics preferences
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Technical diagnostics contain an error code, page category, timing and
        release. They never include messages, documents or credentials.
      </p>
      {prefs && (
        <div className="mt-4 space-y-3">
          {(
            [
              ["diagnostics", "Share minimized technical error diagnostics"],
              ["performance", "Share slow-operation timings"],
              ["notifications", "Show unread feedback updates"],
            ] as const
          ).map(([key, title]) => (
            <label key={key} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={prefs[key]}
                disabled={busy}
                onChange={async (e) => {
                  const old = prefs,
                    next = { ...prefs, [key]: e.target.checked };
                  setPrefs(next);
                  setBusy(true);
                  try {
                    await feedbackApi(
                      "/api/feedback/preferences",
                      next,
                      "PATCH",
                    );
                    window.dispatchEvent(
                      new CustomEvent("feedback-preferences", { detail: next }),
                    );
                    setError("");
                  } catch (err) {
                    setPrefs(old);
                    setError((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              {title}
            </label>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
export function FeedbackReport({
  id,
  admin = false,
}: {
  id: string;
  admin?: boolean;
}) {
  const base = `/api/${admin ? "admin/" : ""}feedback/reports/${id}`,
    [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [body, setBody] = useState(""),
    [internal, setInternal] = useState(true),
    [aiAssisted, setAiAssisted] = useState(false),
    [contact, setContact] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [opened, setOpened] = useState<Record<string, Evidence>>({});
  async function load() {
    try {
      setReport(await feedbackApi(base));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [id, admin]);
  useEffect(() => {
    setReport(null);
    setContact(null);
    setBody("");
    setAiAssisted(false);
    setOpened({});
    void load();
  }, [id, admin]);
  async function reply() {
    setBusy(true);
    try {
      setReport(
        await feedbackApi(base + "/replies", { body, internal, aiAssisted }),
      );
      setBody("");
      setAiAssisted(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={admin ? "space-y-4" : "mx-auto max-w-4xl space-y-5 p-5 sm:p-8"}
    >
      {!admin && (
        <Link className="text-sm text-muted-foreground" href="/app/feedback">
          ← My feedback
        </Link>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!report ? (
        <p role="status">{error ? "Report unavailable." : "Loading report…"}</p>
      ) : (
        <>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <h1 className="font-heading text-2xl font-semibold">
                {report.title}
              </h1>
              <State value={report.status} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Submitted {when(report.createdAt)}
              {report.receivedAt &&
                ` · Received by the team ${when(report.receivedAt)}`}
            </p>
            {!admin && (
              <ol className="mt-5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {["Submitted", "Received", "In progress", "Completed"].map(
                  (step, index) => {
                    const current = [
                      "resolved",
                      "closed-without-change",
                    ].includes(report.status)
                      ? 3
                      : !["new", "received"].includes(report.status)
                        ? 2
                        : report.receivedAt
                          ? 1
                          : 0;
                    return (
                      <li
                        key={step}
                        className={`border-t-2 pt-2 ${index <= current ? "border-primary text-foreground" : "border-muted text-muted-foreground"}`}
                        aria-current={index === current ? "step" : undefined}
                      >
                        {step}
                      </li>
                    );
                  },
                )}
              </ol>
            )}
            <p className="mt-5 whitespace-pre-wrap text-sm">
              {report.note || "No additional message."}
            </p>
            <details className="mt-4 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Submitted references</summary>
              <pre className="mt-2 overflow-auto">
                {JSON.stringify(report.subject, null, 2)}
              </pre>
            </details>
          </div>
          <section className="rounded-xl border p-5">
            <h2 className="font-semibold">Shared evidence & contact</h2>
            {report.contactShared && (
              <div className="my-4 rounded-lg bg-muted p-3">
                <p className="text-sm font-medium">
                  Account email shared for this investigation
                </p>
                <p className="mt-1 text-sm">{report.contactEmail || contact}</p>
                {admin ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={async () => {
                      try {
                        setContact(
                          (await feedbackApi(base + "/contact")).email,
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    View shared email
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await feedbackApi(base + "/contact", {}, "DELETE");
                        setContact(null);
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Stop sharing my email
                  </Button>
                )}
              </div>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {admin
                ? "Opening evidence requires the evidence role and is recorded in the access log."
                : "You can withdraw attachments at any time. This removes them from the review team’s access."}
            </p>
            {!report.evidence.length && (
              <p className="mt-3 text-sm">No attachments shared.</p>
            )}
            {report.evidence.map((e) => (
              <div key={e.id} className="mt-4 border-t pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    {e.label} · {Math.ceil(e.byte_size / 1024)} KB
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          setOpened((old) => ({ ...old, [e.id]: undefined! }));
                          const data = await feedbackApi(
                            base + "/evidence/" + e.id,
                          );
                          setOpened((old) => ({ ...old, [e.id]: data }));
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}
                    >
                      View
                    </Button>
                    {!admin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              "Permanently withdraw this attachment from your feedback report?",
                            )
                          )
                            return;
                          try {
                            await feedbackApi(
                              base + "/evidence/" + e.id,
                              {},
                              "DELETE",
                            );
                            setOpened((old) => {
                              const next = { ...old };
                              delete next[e.id];
                              return next;
                            });
                            await load();
                          } catch (err) {
                            setError((err as Error).message);
                          }
                        }}
                      >
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>
                {opened[e.id] &&
                  (opened[e.id].mediaType === "image/png" ? (
                    <img
                      src={opened[e.id].content}
                      alt={e.label}
                      className="mt-3 max-h-96 object-contain"
                    />
                  ) : (
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs">
                      {opened[e.id].content}
                    </pre>
                  ))}
              </div>
            ))}
          </section>
          <section className="rounded-xl border p-5">
            <h2 className="font-semibold">Conversation & updates</h2>
            {report.events.length ? (
              report.events.map((event) => (
                <div key={event.id} className="mt-4 border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    {event.kind === "staff-ai-reply"
                      ? "AI-assisted reply · reviewed by the team"
                      : label(event.kind)}{" "}
                    · {when(event.created_at)}
                    {admin && ` · ${event.visibility}`}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {event.body}
                  </p>
                  {admin && event.kind === "ai-triage-suggestion" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setBody(
                          event.body.replace(
                            /^AI suggestion — unverified. /,
                            "",
                          ),
                        );
                        setAiAssisted(true);
                        setInternal(false);
                      }}
                    >
                      Use as reply draft
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Your report is waiting for review.
              </p>
            )}
            <label className="mt-5 block text-sm font-medium">
              {admin ? "Write a review note or reply" : "Add information"}
              <textarea
                className={field}
                value={body}
                maxLength={4000}
                rows={3}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            {aiAssisted && (
              <p className="my-2 text-xs text-muted-foreground">
                AI-assisted draft. Review it before sending; it will be labeled
                as reviewed by the team.
              </p>
            )}
            {admin && (
              <label className="my-3 flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />
                Internal note — only the review team can see this
              </label>
            )}
            <Button
              disabled={busy || !body.trim()}
              onClick={() => void reply()}
            >
              {busy
                ? "Saving…"
                : admin && internal
                  ? "Save internal note"
                  : admin
                    ? "Send reply to student"
                    : "Add to report"}
            </Button>
          </section>
        </>
      )}
    </section>
  );
}
export function FeedbackIssue({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null),
    [edit, setEdit] = useState<Issue | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [publicUpdate, setPublicUpdate] = useState(false),
    [selected, setSelected] = useState(""),
    [target, setTarget] = useState("");
  const base = "/api/admin/feedback/issues/" + id;
  async function load() {
    try {
      const d = await feedbackApi(base);
      setData(d);
      setEdit(d.issue);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  async function save(extra = {}) {
    if (!edit) return;
    setBusy(true);
    try {
      const d = await feedbackApi(
        base,
        { ...edit, ...extra, publicUpdate },
        "PATCH",
      );
      setData(d);
      setEdit(d.issue);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell
      admin
      title={data?.issue.title || "Feedback review"}
      description="Keep investigation notes private. Share a clear resolution after verifying the fix."
      actions={
        <>
          <Link className="text-primary text-sm" href="/app/admin/feedback">
            All feedback
          </Link>
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {data && edit ? (
        <>
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              <section className="rounded-xl border bg-card p-5">
                <h2 className="font-semibold">Reports & evidence</h2>
                <div className="mt-4 space-y-2">
                  {data.reports.length ? (
                    data.reports.map((r) => (
                      <Button
                        key={r.id}
                        variant={selected === r.id ? "secondary" : "outline"}
                        className="mr-2"
                        onClick={() =>
                          setSelected(selected === r.id ? "" : r.id)
                        }
                      >
                        {label(r.category)} · {when(r.created_at)}
                      </Button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Automatic diagnostic incident; no student report attached.
                    </p>
                  )}
                </div>
                {selected && (
                  <div className="mt-5">
                    <FeedbackReport id={selected} admin />
                  </div>
                )}
              </section>
              <section className="rounded-xl border p-5">
                <h2 className="font-semibold">Investigation timeline</h2>
                {data.events.map((e) => (
                  <div key={e.id} className="mt-3 border-t pt-3">
                    <p className="text-xs text-muted-foreground">
                      {when(e.created_at)} · {e.visibility}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{e.body}</p>
                  </div>
                ))}
              </section>
              {data.roles.includes("reliability") && (
                <section className="rounded-xl border p-5">
                  <h2 className="font-semibold">Technical diagnostics</h2>
                  {data.diagnostics.map((d, i) => (
                    <div key={i} className="mt-3 border-t pt-3 text-sm">
                      <p>
                        {d.code} · {d.stage}
                        {d.duration_ms != null && ` · ${d.duration_ms} ms`}
                      </p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {when(d.created_at)} · Release {d.release}
                      </p>
                    </div>
                  ))}
                </section>
              )}
              <details className="rounded-xl border p-5">
                <summary className="cursor-pointer font-semibold">
                  Review access log
                </summary>
                {data.audits.map((a, i) => (
                  <p key={i} className="mt-3 break-all text-xs">
                    {when(a.created_at)} · {a.action} · {a.actor_id}
                  </p>
                ))}
              </details>
            </div>
            <aside className="h-fit space-y-4 rounded-xl border p-5">
              <h2 className="font-semibold">Triage & resolution</h2>
              <label className="block text-sm">
                Status
                <select
                  className={field}
                  value={edit.status}
                  onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Severity
                <select
                  className={field}
                  value={edit.severity}
                  onChange={(e) =>
                    setEdit({ ...edit, severity: e.target.value })
                  }
                >
                  {["critical", "high", "normal", "low"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <p className="break-all text-xs text-muted-foreground">
                Owner: {edit.owner_id || "Unassigned"}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void save({ assignToMe: true })}
                >
                  Assign to me
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void save({ unassign: true })}
                >
                  Unassign
                </Button>
              </div>
              <label className="block text-sm">
                Resolution
                <textarea
                  className={field}
                  rows={4}
                  value={edit.resolution}
                  onChange={(e) =>
                    setEdit({ ...edit, resolution: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                Verification evidence
                <textarea
                  className={field}
                  rows={3}
                  value={edit.verification}
                  placeholder="What was checked? Include the release or test result."
                  onChange={(e) =>
                    setEdit({ ...edit, verification: e.target.value })
                  }
                />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publicUpdate}
                  onChange={(e) => setPublicUpdate(e.target.checked)}
                />
                Share the comment below with all attached reporters (required to
                complete a report)
              </label>
              {publicUpdate && (
                <p className="rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
                  Public update: {edit.status}: {edit.resolution}
                </p>
              )}
              <Button disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Save review & update status"}
              </Button>
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold">
                  Investigate in context
                </h3>
                <div className="mt-2 flex flex-col gap-2 text-sm text-primary">
                  {edit.subject.kind === "sync" && (
                    <Link href="/app/settings/canvas-sync">
                      Open sync controls
                    </Link>
                  )}
                  {["material", "source"].includes(edit.subject.kind) && (
                    <Link href="/app/admin">Open editorial review</Link>
                  )}
                  <Link
                    href={
                      edit.subject.route?.startsWith("/app/")
                        ? edit.subject.route
                        : "/app"
                    }
                  >
                    Open reported surface
                  </Link>
                </div>
              </div>
              <details className="border-t pt-4">
                <summary className="cursor-pointer text-sm">
                  Group a duplicate issue
                </summary>
                <label className="mt-3 block text-xs">
                  Target issue ID
                  <input
                    className={field}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </label>
                <Button
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  disabled={!target || busy}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Move reports into this issue? Private report replies stay attached to their original report.",
                      )
                    )
                      return;
                    try {
                      await feedbackApi(base + "/merge", {
                        targetId: target,
                        confirmed: true,
                      });
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Group reports
                </Button>
              </details>
            </aside>
          </div>
        </>
      ) : (
        !error && <p role="status">Loading review…</p>
      )}
    </Shell>
  );
}

function FeedbackReviewOverview() {
  const [metrics, setMetrics] = useState<{
      overview: Record<string, number>;
      jobs: { status: string; count: number }[];
      roles: string[];
    } | null>(null),
    [roles, setRoles] = useState<{ user_id: string; roles: string[] }[]>([]),
    [user, setUser] = useState(""),
    [selected, setSelected] = useState<string[]>(["support"]),
    [error, setError] = useState("");
  useEffect(() => {
    feedbackApi("/api/admin/feedback/metrics")
      .then((m) => {
        setMetrics(m);
        if (m.roles.includes("manage"))
          feedbackApi("/api/admin/feedback/roles")
            .then(setRoles)
            .catch((e) => setError(e.message));
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      {metrics && (
        <>
          <div className="grid grid-cols-2 divide-x rounded-xl border bg-card sm:grid-cols-4">
            {[
              ["Reports · 30 days", metrics.overview.reports],
              [
                "Helpful / not helpful",
                `${metrics.overview.helpful} / ${metrics.overview.not_helpful}`,
              ],
              ["Open issues", metrics.overview.open],
              [
                "Oldest new issue",
                `${metrics.overview.oldest_new_days || 0} days`,
              ],
            ].map(([title, value]) => (
              <div key={title} className="p-4">
                <p className="text-xs text-muted-foreground">{title}</p>
                <p className="mt-2 font-data text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Ratings are voluntary signals, not a measure of factual accuracy.
            Unrated answers are not counted as positive.
          </p>
          {metrics.jobs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Background review jobs:{" "}
              {metrics.jobs.map((j) => `${j.count} ${j.status}`).join(" · ")}
            </p>
          )}
          {metrics.roles.includes("manage") && (
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Review team permissions
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                Support can triage and reply. Reliability can inspect
                diagnostics. Evidence can open explicitly shared attachments.
                Editorial work still requires the existing editorial
                permissions.
              </p>
              {roles.map((r) => (
                <p key={r.user_id} className="mt-2 break-all text-xs">
                  {r.user_id}: {r.roles.join(", ") || "No access"}
                </p>
              ))}
              <label className="mt-3 block text-sm">
                Account ID
                <input
                  className={field}
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                />
              </label>
              <div className="my-3 flex flex-wrap gap-3">
                {["support", "reliability", "editorial", "evidence"].map(
                  (role) => (
                    <label key={role} className="flex gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selected.includes(role)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, role]
                              : selected.filter((r) => r !== role),
                          )
                        }
                      />
                      {label(role)}
                    </label>
                  ),
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!user}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Set ${user} to roles: ${selected.join(", ") || "none"}?`,
                    )
                  )
                    return;
                  try {
                    setRoles(
                      await feedbackApi(
                        "/api/admin/feedback/roles",
                        { userId: user, roles: selected },
                        "PATCH",
                      ),
                    );
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Save permissions
              </Button>
            </details>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </>
  );
}
