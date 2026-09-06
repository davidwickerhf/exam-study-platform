"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  feedbackApi,
  field,
  label,
  categories,
  type Options,
  type Evidence,
  type Draft,
} from "./feedback-api";
export default function ReportDialog({
  options,
  close,
}: {
  options: Options;
  close: () => void;
}) {
  const [category, setCategory] = useState(options.category || "other"),
    [note, setNote] = useState(""),
    [include, setInclude] = useState(false),
    [aiReview, setAiReview] = useState(false),
    [shareContactEmail, setShareContactEmail] = useState(false),
    [accountEmail, setAccountEmail] = useState<string | null>(null),
    [image, setImage] = useState<Evidence | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState("");
  useEffect(() => {
    feedbackApi("/api/feedback/contact")
      .then((result) => setAccountEmail(result.email))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (options.draftId) {
      setBusy(true);
      feedbackApi(`/api/feedback/drafts/${options.draftId}`)
        .then((d) => (d.submitted ? setReceipt(d.url) : setDraft(d)))
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
    }
  }, [options.draftId]);
  async function preview() {
    setBusy(true);
    setError("");
    try {
      setDraft(
        await feedbackApi("/api/feedback/drafts", {
          category,
          note,
          aiReview,
          shareContactEmail,
          subject: options.subject,
          evidence: [
            ...(include && options.excerpt
              ? [
                  {
                    label: "Selected answer or excerpt",
                    mediaType: "text/plain",
                    content: options.excerpt,
                  },
                ]
              : []),
            ...(image ? [image] : []),
          ],
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const result = await feedbackApi("/api/feedback/reports", {
        draftId: draft.draftId,
        revision: draft.revision,
        confirmed: true,
      });
      setReceipt(result.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function screenshot(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (
        file.size > 5 * 1024 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      )
        throw new Error("Choose an image under 5 MB.");
      const bitmap = await createImageBitmap(file);
      if (bitmap.width > 4096 || bitmap.height > 4096) {
        bitmap.close();
        throw new Error("Choose an image up to 4096 × 4096 pixels.");
      }
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
      bitmap.close();
      setImage({
        label: "Screenshot",
        mediaType: "image/png",
        content: canvas.toDataURL("image/png"),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-xl">
        <DialogTitle className="font-heading text-2xl font-semibold">
          {receipt
            ? "Feedback received"
            : draft
              ? "Review what will be sent"
              : "Help improve Wicker"}
        </DialogTitle>
        <DialogDescription>
          {receipt
            ? "Follow the review and add details in My feedback."
            : draft
              ? "Only the information below will be shared with the review team."
              : "Report a problem, suggest an improvement, or tell us what worked."}
        </DialogDescription>
        {receipt ? (
          <>
            <Link
              className="text-primary font-semibold"
              href={receipt}
              onClick={close}
            >
              Open your report →
            </Link>
            <Button onClick={close}>Done</Button>
          </>
        ) : (
          <>
            {draft ? (
              <>
                <div className="rounded-lg border p-4 text-sm">
                  <p className="font-semibold">
                    {label(draft.preview.category)} ·{" "}
                    {label(draft.preview.subject.kind || "general")}
                  </p>
                  <dl className="mt-3 space-y-1 text-muted-foreground">
                    {Object.entries(draft.preview.subject).map(
                      ([key, value]) => (
                        <div key={key} className="break-all">
                          <dt className="inline font-medium">{label(key)}: </dt>
                          <dd className="inline">{value}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                  <p className="mt-4 whitespace-pre-wrap">
                    {draft.preview.note || "No additional message."}
                  </p>
                </div>
                {draft.preview.evidence.map((e, i) => (
                  <details key={i} open className="rounded-lg border p-3">
                    <summary className="font-medium">{e.label}</summary>
                    {e.mediaType === "image/png" ? (
                      <img
                        src={e.content}
                        alt="Screenshot to be submitted"
                        className="mt-3 max-h-72 object-contain"
                      />
                    ) : (
                      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-xs">
                        {e.content}
                      </pre>
                    )}
                  </details>
                ))}
                <p className="text-xs">
                  Contact email: {draft.preview.contactEmail || "Not shared"}
                </p>
                <p className="text-xs">
                  AI-assisted report review:{" "}
                  {draft.preview.aiReview
                    ? "Allowed for your message and attached text excerpts"
                    : "Not allowed"}
                </p>
                <p className="text-muted-foreground text-xs">
                  Your account and submission time are included. Referenced
                  conversations and files are not copied or opened by reviewers
                  unless you attach an excerpt. Submitted evidence is encrypted.
                  No messages are sent by email.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setDraft(null)}
                  >
                    Edit
                  </Button>
                  <Button disabled={busy} onClick={() => void submit()}>
                    {busy ? "Submitting…" : "Submit this feedback"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <label className="text-sm font-medium">
                  What is this about?
                  <select
                    className={field}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {label(c)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium">
                  What happened, or what could be better?
                  <textarea
                    rows={4}
                    maxLength={4000}
                    className={field}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What did you expect? What did you see instead?"
                  />
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={shareContactEmail}
                    disabled={!accountEmail}
                    onChange={(e) => setShareContactEmail(e.target.checked)}
                  />
                  <span>
                    Share my account email for this investigation
                    {accountEmail && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {accountEmail}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Optional. The team can contact you if more information is
                      needed. You can withdraw it later.{" "}
                      {!accountEmail &&
                        "No account email is available in this session."}
                    </span>
                  </span>
                </label>
                {options.excerpt && (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={include}
                      onChange={(e) => setInclude(e.target.checked)}
                    />
                    Include this answer or selected excerpt
                  </label>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={aiReview}
                    onChange={(e) => setAiReview(e.target.checked)}
                  />
                  Allow AI to help the team review this report’s message and
                  attached text excerpts. Screenshots and referenced private
                  records are excluded.
                </label>
                <label className="text-sm">
                  Screenshot (optional)
                  <input
                    className={field}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void screenshot(e.target.files?.[0])}
                  />
                </label>
                {image && (
                  <div>
                    <img
                      src={image.content}
                      alt="Selected screenshot"
                      className="max-h-40"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setImage(null)}
                    >
                      Remove screenshot
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Check screenshots for personal information before sharing. The
                  next step shows the exact report. Your full chat, private
                  documents and credentials are not included.
                </p>
                <div className="flex items-center justify-between">
                  <Link
                    className="text-primary text-sm"
                    href="/app/feedback"
                    onClick={close}
                  >
                    My feedback
                  </Link>
                  <Button disabled={busy} onClick={() => void preview()}>
                    {busy ? "Preparing preview…" : "Review submission"}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
