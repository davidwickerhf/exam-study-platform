"use client";

import Link from "next/link";

import { useState } from "react";
import {
  DownloadIcon,
  FileArchiveIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJson } from "@/components/workspace/use-json";
import type { AccountIdentity } from "@/lib/workspace/account.mjs";
import { Confirm } from "./shared";

type Notice = { tone: "success" | "error"; text: string } | null;

export function AccountDataControls({
  account,
  reload,
}: {
  account: AccountIdentity | null | undefined;
  reload: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [uploadsOpen, setUploadsOpen] = useState(false);
  const [uploadsBusy, setUploadsBusy] = useState(false);
  const [uploadsError, setUploadsError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const accountConfirmation = account?.email || "DELETE";

  async function exportData() {
    setExporting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/account/export", {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`The export returned ${response.status}`);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `wicker-study-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setNotice({ tone: "success", text: "Your data export is ready." });
    } catch (cause) {
      setNotice({
        tone: "error",
        text: `The export could not be prepared. ${(cause as Error).message}`,
      });
    } finally {
      setExporting(false);
    }
  }

  async function deleteUploads() {
    setUploadsBusy(true);
    setUploadsError(null);
    try {
      await readJson("/api/account/data", {
        method: "DELETE",
        body: JSON.stringify({
          confirmation: "DELETE UPLOADS",
          scope: "uploads",
        }),
      });
      setUploadsOpen(false);
      setNotice({
        tone: "success",
        text: "Private uploads and their indexes were deleted. Material already accepted into the public library remains available anonymously.",
      });
      reload();
    } catch (cause) {
      setUploadsError(`Uploaded data was not deleted. ${(cause as Error).message}`);
    } finally {
      setUploadsBusy(false);
    }
  }

  async function deleteAccount() {
    setAccountBusy(true);
    setAccountError(null);
    try {
      await readJson("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: accountConfirmation }),
      });
      localStorage.clear();
      window.location.assign("/?account-deleted=1");
    } catch (cause) {
      const message = (cause as Error).message;
      setAccountError(
        /Wicker data was removed|Account deletion did not finish|temporarily unavailable/i.test(message)
          ? message
          : `The account was not deleted. ${message}`,
      );
      setAccountBusy(false);
    }
  }

  const rows = [
    {
      icon: DownloadIcon,
      title: "Download your data",
      description:
        "Export your study record, plans, activity and Tutor history as JSON. Canvas access tokens are never included.",
      action: (
        <Button variant="outline" onClick={() => void exportData()} disabled={exporting}>
          {exporting ? "Preparing…" : "Download JSON"}
        </Button>
      ),
    },
    {
      icon: FileArchiveIcon,
      title: "Delete uploaded data",
      description:
        "Remove files sent through Tutor or Documents, private retrieval indexes, transcript snapshots and document revision history. Your plan stays in place, as does material already accepted into the public library.",
      action: (
        <Button
          variant="outline"
          onClick={() => {
            setUploadsError(null);
            setUploadsOpen(true);
          }}
        >
          Delete uploads
        </Button>
      ),
    },
    {
      icon: Trash2Icon,
      title: "Delete your account",
      description:
        "Permanently remove your private Wicker records and Clerk sign-in identity. Public library material you agreed to share stays available without a link to your account.",
      danger: true,
      action: (
        <Button
          variant="destructive"
          onClick={() => {
            setAccountError(null);
            setAccountOpen(true);
          }}
        >
          Delete account
        </Button>
      ),
    },
  ];

  return (
    <section id="data-controls" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="flex max-w-2xl items-start gap-3">
          <span className="bg-primary/8 text-primary mt-0.5 grid size-9 shrink-0 place-items-center rounded-md">
            <ShieldCheckIcon className="size-4.5" />
          </span>
          <div>
            <h2 className="font-heading text-xl font-semibold tracking-tight">Your data</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Take a copy, remove your private uploads, or close the account completely.
            </p>
          </div>
        </div>
        <Link className="text-primary text-sm font-semibold hover:underline" href="/app/settings?tab=data">
          Detailed data settings
        </Link>
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`border-t px-5 py-3 text-sm sm:px-6 ${notice.tone === "error" ? "text-destructive" : "text-foreground"}`}
        >
          {notice.text}
        </p>
      )}

      <div className="border-t">
        {rows.map(({ icon: Icon, title, description, action, danger }) => (
          <div
            key={title}
            className="grid gap-4 border-b px-5 py-4 last:border-b-0 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-center sm:px-6"
          >
            <span className={`hidden size-8 place-items-center rounded-md sm:grid ${danger ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 className={danger ? "text-destructive text-sm font-semibold" : "text-sm font-semibold"}>{title}</h3>
              <p className="text-muted-foreground mt-1 max-w-[74ch] text-xs leading-relaxed">{description}</p>
            </div>
            <div className="sm:justify-self-end">{action}</div>
          </div>
        ))}
      </div>

      <Confirm
        open={uploadsOpen}
        onOpenChange={setUploadsOpen}
        title="Delete all uploaded data?"
        description="This removes private material you supplied across every programme without resetting your study plan. Content already accepted into the public library stays available anonymously under its sharing licence."
        removes={[
          "Files and pictures uploaded through Tutor or Documents",
          "Private text and image indexes used for retrieval",
          "Transcript snapshots, document versions and private or pending source requests",
        ]}
        word="DELETE UPLOADS"
        action="Delete uploaded data"
        busy={uploadsBusy}
        error={uploadsError}
        onConfirm={() => void deleteUploads()}
        destructive
      />

      <Confirm
        open={accountOpen}
        onOpenChange={setAccountOpen}
        title="Permanently delete your account?"
        description="Wicker first removes your private data, then deletes your sign-in identity from Clerk and signs you out."
        removes={[
          "Every programme, course plan, result, attendance record and study event",
          "Tutor conversations, remembered plans, files and private retrieval indexes",
          "Canvas connections, API keys, usage records and your Clerk sign-in identity",
        ]}
        word={accountConfirmation}
        action="Delete account permanently"
        busy={accountBusy}
        error={accountError}
        onConfirm={() => void deleteAccount()}
        destructive
      />
    </section>
  );
}
