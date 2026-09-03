"use client";

/**
 * The pieces every account tab is built from.
 *
 * The account surface was one 1,950-line module, so opening Profile parsed and
 * shipped the Canvas connection forms, the key table, the allowance meters and
 * the storage tables too. Each tab is its own module now and they share this
 * one: the vocabulary (a section, a figure, a failure), the two date
 * formatters, and the typed-confirmation gate that every irreversible action
 * on this page passes through.
 */

import { type ReactNode, useEffect, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmationMatches } from "@/lib/workspace/account.mjs";

export const NUMERALS = "font-data tabular-nums";
export const RULE =
  "text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase";

/**
 * The flat local tab row.
 *
 * shadcn's default tab list is a filled, rounded control — a box holding the
 * navigation of a destination that has no other boxes in it. These two class
 * lists keep base-ui's roving focus and arrow-key movement and answer only its
 * appearance: one rule under the whole row, and the single signal blue drawn
 * as a 2px mark under the tab you are on. The overrides repeat the base
 * variant prefixes so tailwind-merge replaces the rule rather than racing it.
 */
export const TAB_LIST = [
  "w-full max-w-full justify-start gap-6 overflow-x-auto rounded-none",
  "border-b bg-transparent p-0",
  "group-data-horizontal/tabs:h-auto",
].join(" ");

export const TAB_TRIGGER = [
  "h-auto flex-none rounded-none border-0 px-0 pb-2.5 text-sm",
  "data-active:bg-transparent data-active:text-foreground",
  "after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px]",
].join(" ");

// ----- plumbing -----------------------------------------------------------

export function relative(value: string | null | undefined) {
  if (!value) return null;
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return null;
  if (diff < 0) return "just now";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function longDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function clockOrDate(
  value: string | null | undefined,
  mode: "time" | "date",
) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(
    "en-GB",
    mode === "date"
      ? { day: "numeric", month: "short", year: "numeric" }
      : {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZoneName: "short",
        },
  ).format(date);
}

// ----- shared pieces ------------------------------------------------------

export function Section({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b pb-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {note && <p className="text-muted-foreground text-sm">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Figure({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <span className="flex min-w-[8rem] flex-col gap-1">
      <span className={RULE}>{label}</span>
      <strong className={`text-2xl font-semibold tracking-tight ${NUMERALS}`}>
        {value}
      </strong>
      {detail && (
        <small className="text-muted-foreground text-xs">{detail}</small>
      )}
    </span>
  );
}

export function Failed({ what, message }: { what: string; message: string }) {
  return (
    <Alert>
      <AlertTitle>{what}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function HostedProfileActions() {
  const clerk = useClerk();
  return (
    <span className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => clerk.openUserProfile()}
      >
        Edit sign-in profile
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => void clerk.signOut({ redirectUrl: "/sign-in" })}
      >
        Sign out of Wicker Study
      </Button>
    </span>
  );
}

/**
 * The one gate every irreversible action passes through.
 *
 * The confirm button stays disabled until the typed word matches exactly —
 * the same comparison the server makes, so a student cannot be waved through
 * here only to be refused there.
 */
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  removes,
  word,
  action,
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  removes?: string[];
  word: string;
  action: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  const ready = confirmationMatches(typed, word) && !busy;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <p className="font-semibold">This cannot be undone.</p>
          {removes && (
            <ul className="text-muted-foreground flex flex-col gap-1">
              {removes.map((line) => (
                <li key={line} className="border-l pl-3">
                  {line}
                </li>
              ))}
            </ul>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-sm">
              Type <b className={`text-foreground ${NUMERALS}`}>{word}</b> to
              confirm
            </span>
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={busy}
              aria-label={`Type ${word} to confirm`}
              className={NUMERALS}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
          <Button variant="secondary" disabled={!ready} onClick={onConfirm}>
            {busy ? "Working…" : action}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
