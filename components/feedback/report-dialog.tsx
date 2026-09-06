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
    [excerpt, setExcerpt] = useState(options.excerpt || ""),
    [aiReview, setAiReview] = useState(false),
    [shareContactEmail, setShareContactEmail] = useState(false),
    [accountEmail, setAccountEmail] = useState<string | null>(null),
    [images, setImages] = useState<Evidence[]>([]),
    [processingImages, setProcessingImages] = useState(false),
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
            ...(include && excerpt.trim()
              ? [
                  {
                    label:
                      options.subject?.kind === "answer"
                        ? "Tutor conversation excerpt"
                        : "Shared text excerpt",
                    mediaType: "text/plain",
                    content: excerpt,
                  },
                ]
              : []),
            ...images,
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
  async function screenshots(files: File[]) {
    if (!files.length) return;
    setError("");
    setProcessingImages(true);
    try {
      if (images.length + files.length > 4)
        throw new Error(
          "Attach up to four screenshots. Remove one before adding another.",
        );
      const additions: Evidence[] = [];
      for (const file of files) {
        if (
          file.size > 5 * 1024 * 1024 ||
          !["image/png", "image/jpeg", "image/webp"].includes(file.type)
        )
          throw new Error("Choose PNG, JPEG or WebP images under 5 MB each.");
        const bitmap = await createImageBitmap(file);
        if (bitmap.width > 4096 || bitmap.height > 4096) {
          bitmap.close();
          throw new Error("Choose images up to 4096 × 4096 pixels.");
        }
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
        bitmap.close();
        const content = canvas.toDataURL("image/png");
        if (content.length > 7_000_000)
          throw new Error(
            "A screenshot is too large after conversion. Choose a smaller image.",
          );
        additions.push({
          label: `Screenshot ${images.length + additions.length + 1}`,
          mediaType: "image/png",
          content,
        });
      }
      const next = [...images, ...additions];
      if (JSON.stringify(next).length > 19_900_000)
        throw new Error(
          "These screenshots are too large together. Choose smaller images or fewer screenshots.",
        );
      setImages(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessingImages(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy && !processingImages) close();
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
                <div className="space-y-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={include}
                      onChange={(e) => setInclude(e.target.checked)}
                    />
                    Attach Tutor conversation text or another excerpt
                  </label>
                  {include && (
                    <label className="block text-sm font-medium">
                      Text to share
                      <textarea
                        className={field}
                        rows={6}
                        maxLength={12000}
                        value={excerpt}
                        onChange={(e) => setExcerpt(e.target.value)}
                        placeholder="Paste the relevant question and Tutor reply. Remove anything you do not want the team to see."
                      />
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {excerpt.length.toLocaleString()} / 12,000 characters.{" "}
                        {excerpt.length > 12000
                          ? "Shorten this excerpt before continuing."
                          : "Edit or paste only the parts that explain the issue."}
                      </span>
                    </label>
                  )}
                </div>
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
                  Screenshots (optional)
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Up to four PNG, JPEG or WebP images. 5 MB each, up to 4096 ×
                    4096 pixels.
                  </span>
                  <input
                    className={field}
                    type="file"
                    multiple
                    disabled={busy || processingImages || images.length >= 4}
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      e.target.value = "";
                      void screenshots(files);
                    }}
                  />
                </label>
                {processingImages && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Preparing screenshots…
                  </p>
                )}
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {images.map((image, index) => (
                      <div key={index} className="min-w-0">
                        <img
                          src={image.content}
                          alt={`Selected screenshot ${index + 1}`}
                          className="h-28 w-full rounded-md border object-contain"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={processingImages || busy}
                          onClick={() =>
                            setImages(
                              images
                                .filter((_, i) => i !== index)
                                .map((item, i) => ({
                                  ...item,
                                  label: `Screenshot ${i + 1}`,
                                })),
                            )
                          }
                        >
                          Remove screenshot {index + 1}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Check screenshots for personal information before sharing. The
                  next step shows the exact report. Only the text and
                  screenshots you attach are shared; the rest of your chat and
                  private files stay private.
                </p>
                <div className="flex items-center justify-between">
                  <Link
                    className="text-primary text-sm"
                    href="/app/feedback"
                    onClick={close}
                  >
                    My feedback
                  </Link>
                  <Button
                    disabled={
                      busy ||
                      processingImages ||
                      (include && (!excerpt.trim() || excerpt.length > 12000))
                    }
                    onClick={() => void preview()}
                  >
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
