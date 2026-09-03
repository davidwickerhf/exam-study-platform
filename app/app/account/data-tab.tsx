"use client";

/**
 * Data & privacy: the record-by-record view, and the ways to take it back.
 *
 * Nothing here is destructive on one click. Resetting study data, erasing
 * everything and deleting the account each go through the shared typed
 * confirmation, which will not enable its button until the exact word the
 * server itself demands has been typed.
 */

import { useMemo, useState } from "react";
import { DownloadIcon, RotateCcwIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readJson } from "@/components/workspace/use-json";
import {
  type AccountSummary,
  type NamespaceEntry,
  type ResetScope,
  RESET_SCOPES,
  formatBytes,
  formatCount,
  groupNamespaces,
  namespaceLabel,
} from "@/lib/workspace/account.mjs";
import { Confirm, Failed, NUMERALS, RULE, Section, relative } from "./shared";

function StorageTable({ entries }: { entries: NamespaceEntry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Record</TableHead>
          <TableHead className="text-right">Rows</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead className="text-right">Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.namespace}>
            <TableCell>
              <span className="flex flex-col gap-0.5">
                <strong className="text-[15px] font-medium">
                  {namespaceLabel(entry)}
                </strong>
                {entry.detail && (
                  <small className="text-muted-foreground text-xs">
                    {entry.detail}
                  </small>
                )}
              </span>
            </TableCell>
            <TableCell className={`text-right ${NUMERALS}`}>
              {formatCount(entry.count)}
            </TableCell>
            <TableCell className={`text-right ${NUMERALS}`}>
              {formatBytes(entry.bytes)}
            </TableCell>
            <TableCell
              className={`text-muted-foreground text-right ${NUMERALS}`}
            >
              {relative(entry.updatedAt) ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function DataTab({
  summary,
  summaryError,
  reload,
}: {
  summary: AccountSummary | null;
  summaryError: string | null;
  reload: () => void;
}) {
  const groups = useMemo(
    () => groupNamespaces(summary?.namespaces ?? []),
    [summary],
  );
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [scope, setScope] = useState<ResetScope | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function exportData() {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch("/api/account/export", {
        headers: { accept: "application/json" },
      });
      if (!response.ok)
        throw new Error(`The export returned ${response.status}`);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `wicker-study-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (cause) {
      setExportError((cause as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function reset() {
    if (!scope) return;
    setResetBusy(true);
    setResetError(null);
    try {
      await readJson("/api/account/data", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "RESET", scope }),
      });
      // The vanilla half keeps read-state in localStorage; both halves have to
      // agree that it is gone.
      for (const key of Object.keys(localStorage)) {
        if (
          /^(chapter-read:|chapter-tab|recent-chapter|attempt|practice|mock)/.test(
            key,
          )
        )
          localStorage.removeItem(key);
      }
      setScope(null);
      reload();
    } catch (cause) {
      setResetError(`Nothing was changed. ${(cause as Error).message}`);
    } finally {
      setResetBusy(false);
    }
  }

  async function deleteAccount() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await readJson("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      localStorage.clear();
      window.location.assign("/?account-deleted=1");
    } catch (cause) {
      setDeleteBusy(false);
      setDeleteError(
        `Your account remains accessible and nothing was deleted. ${(cause as Error).message}`,
      );
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="What is stored"
        note="Your personal record, separate from shared course material. Nothing here is used to train models."
        action={
          summary && (
            <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
              {formatCount(summary.totals.documents)} records ·{" "}
              {formatBytes(summary.totals.bytes)}
            </span>
          )
        }
      >
        {summaryError ? (
          <Failed
            what="Your storage record could not be read"
            message={summaryError}
          />
        ) : !summary ? (
          <Skeleton className="h-40 w-full" />
        ) : !summary.namespaces.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nothing stored yet</EmptyTitle>
              <EmptyDescription>
                Records appear here as you read, practise and plan.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h3 className={RULE}>Cleared by a reset</h3>
                <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
                  {formatCount(groups.cleared.count)} rows ·{" "}
                  {formatBytes(groups.cleared.bytes)}
                </span>
              </div>
              {groups.cleared.entries.length ? (
                <StorageTable entries={groups.cleared.entries} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No study records yet.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h3 className={RULE}>Kept on reset</h3>
                <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
                  {formatCount(groups.kept.count)} rows ·{" "}
                  {groups.kept.measured
                    ? formatBytes(groups.kept.bytes)
                    : `at least ${formatBytes(groups.kept.bytes)}`}
                </span>
              </div>
              {groups.kept.entries.length ? (
                <StorageTable entries={groups.kept.entries} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nothing outside your study record.
                </p>
              )}
              {!groups.kept.measured && (
                <p className="text-muted-foreground text-sm">
                  Some of these families are not measured in bytes by the
                  server, so this total is a floor, not a size.
                </p>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Your data"
        note="Export, reset, or remove what Wicker Study holds about you."
      >
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-6 border-b py-3">
            <div className="flex flex-col gap-0.5">
              <strong className="text-[15px] font-medium">
                Export personal data
              </strong>
              <small className="text-muted-foreground text-sm">
                A machine-readable JSON copy of your study records, plan,
                attempts, review history, account details and AI usage. Canvas
                access tokens are never included.
              </small>
              {exportError && (
                <small role="alert" className="text-sm font-medium">
                  The export failed. {exportError}
                </small>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={exportData}
              disabled={exporting}
            >
              <DownloadIcon data-icon="inline-start" />
              {exporting ? "Preparing…" : "Download JSON"}
            </Button>
          </div>
          <div className="flex items-start justify-between gap-6 border-b py-3">
            <div className="flex flex-col gap-0.5">
              <strong className="text-[15px] font-medium">
                Reset study data
              </strong>
              <small className="text-muted-foreground text-sm">
                Clears progress, flashcards, mistakes, mock sessions, personal
                exercises and the activity log. Your account, academic plan and
                AI usage ledger are kept.
              </small>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setResetError(null);
                setScope("study");
              }}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Reset study data
            </Button>
          </div>
          <div className="flex items-start justify-between gap-6 border-b py-3">
            <div className="flex flex-col gap-0.5">
              <strong className="text-[15px] font-medium">
                Erase all personal data
              </strong>
              <small className="text-muted-foreground text-sm">
                Removes every record, including your academic plan and usage
                ledger, but keeps your sign-in so you can start again.
              </small>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setResetError(null);
                setScope("everything");
              }}
            >
              <TrashIcon data-icon="inline-start" />
              Erase everything
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          For access, correction, restriction or objection requests that are not
          available here, write to{" "}
          <a
            className="text-primary font-semibold"
            href="mailto:privacy@study.wicker.life"
          >
            privacy@study.wicker.life
          </a>
          . See the{" "}
          <a className="text-primary font-semibold" href="/privacy">
            privacy notice
          </a>
          .
        </p>
      </Section>

      {/*
        The danger zone. There is no danger red in this world, so it is set
        apart by position, a rule and its copy: last on the page, below a full
        separator, alone under its own heading.
      */}
      <div className="flex flex-col gap-6 pt-4">
        <Separator />
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-2xl tracking-tight">
            Deleting your account
          </h2>
          <p className="text-muted-foreground max-w-[60ch] text-sm">
            This is the only action on this page that removes your sign-in as
            well as your data. Your sources are withdrawn from future editorial
            work; material already published after review is unaffected. It
            cannot be undone, and support cannot restore it.
          </p>
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
            >
              <TrashIcon data-icon="inline-start" />
              Delete account and all data
            </Button>
          </div>
        </section>
      </div>

      <Confirm
        open={Boolean(scope)}
        onOpenChange={(next) => {
          if (!next) setScope(null);
        }}
        title={scope ? RESET_SCOPES[scope].title : ""}
        description={scope ? RESET_SCOPES[scope].description : ""}
        removes={scope ? RESET_SCOPES[scope].removes : []}
        word="RESET"
        action={scope ? RESET_SCOPES[scope].action : "Reset"}
        busy={resetBusy}
        error={resetError}
        onConfirm={reset}
      />

      <Confirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Permanently delete your account?"
        description="Your sign-in identity and every personal record are removed, and you are signed out when it finishes."
        removes={[
          "Your authentication identity, so you cannot sign back in",
          "Progress, notes, answers, review history, tutor conversations and usage records",
          "Encrypted Canvas connections and uploaded academic-record history",
        ]}
        word="DELETE"
        action="Delete account and data"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={deleteAccount}
      />
    </div>
  );
}
