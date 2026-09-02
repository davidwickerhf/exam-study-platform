"use client";

/**
 * The gate for migrated routes.
 *
 * Every /api/* route is authenticated server-side, so a signed-out visitor
 * would get a shell and a page full of 401s rather than a sign-in. This does
 * provides the two client behaviours the React workspace needs:
 *
 *   1. Sends an unauthenticated visitor to /sign-in.
 *   2. Attaches the Clerk bearer token to same-origin /api/* requests, so a
 *      page can call plain `fetch`.
 *
 * Without a publishable key there is no sign-in at all — that is local
 * development, where the server resolves every request to one account.
 */

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  browserStateSnapshot,
  mergeBrowserState,
} from "@/lib/v2/migration.mjs";

function Waiting() {
  return (
    <div
      className="flex flex-col gap-3 p-8"
      aria-busy="true"
      aria-label="Checking your session"
    >
      <Skeleton className="h-14 w-72" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const patched = useRef(false);
  const [ready, setReady] = useState(false);
  const [access, setAccess] = useState<
    | { kind: "checking" }
    | { kind: "allowed" }
    | { kind: "ineligible"; domains: string[] }
    | {
        kind: "programme";
        programmes: {
          id: string;
          degree: string;
          name: string;
          institution?: { name?: string; city?: string };
        }[];
        saving: boolean;
        error?: string;
      }
    | { kind: "error"; message: string }
  >({ kind: "checking" });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      window.location.replace("/sign-in");
      return;
    }
    if (patched.current) return;
    patched.current = true;

    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const href =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const target = new URL(href, window.location.href);
      // Only this origin's API is ours to sign.
      if (
        target.origin !== window.location.origin ||
        !target.pathname.startsWith("/api/")
      )
        return original(input, init);
      const headers = new Headers(
        init.headers || (input instanceof Request ? input.headers : undefined),
      );
      const token = await getToken();
      if (token) headers.set("authorization", `Bearer ${token}`);
      return original(input, { ...init, headers });
    };
    async function check() {
      try {
        const response = await window.fetch("/api/auth/session");
        const session = await response.json().catch(() => ({}));
        if (response.status === 403) {
          setAccess({
            kind: "ineligible",
            domains: session.allowedDomains || [],
          });
          setReady(true);
          return;
        }
        if (!response.ok)
          throw new Error(
            session.error || "Your session could not be verified.",
          );
        if (session.needsProgramme && (session.eligible?.length || 0) > 1)
          setAccess({
            kind: "programme",
            programmes: session.eligible,
            saving: false,
          });
        else setAccess({ kind: "allowed" });
        setReady(true);
      } catch (cause) {
        setAccess({ kind: "error", message: (cause as Error).message });
        setReady(true);
      }
    }
    void check();
  }, [getToken, isLoaded, isSignedIn]);

  if (!isLoaded || !ready) return <Waiting />;
  if (access.kind === "ineligible")
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This account is not eligible yet</EmptyTitle>
          <EmptyDescription>
            Sign in with{" "}
            {access.domains.map((domain) => `@${domain}`).join(" or ") ||
              "an eligible university"}{" "}
            address. You are signed in as{" "}
            {user?.primaryEmailAddress?.emailAddress || "this account"}.
          </EmptyDescription>
        </EmptyHeader>
        <Button
          variant="outline"
          onClick={() => void clerk.signOut({ redirectUrl: "/sign-in" })}
        >
          Sign out and use another account
        </Button>
      </Empty>
    );
  if (access.kind === "error")
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Unable to start your workspace</EmptyTitle>
          <EmptyDescription>{access.message}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  if (access.kind === "programme") {
    const choose = async (programmeId: string) => {
      setAccess({ ...access, saving: true, error: undefined });
      try {
        const response = await window.fetch("/api/account/programme", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ programmeId }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(body.error || "Could not join this programme.");
        setAccess({ kind: "allowed" });
      } catch (cause) {
        setAccess({
          ...access,
          saving: false,
          error: (cause as Error).message,
        });
      }
    };
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-6 p-8">
        <div>
          <h1 className="font-heading text-4xl font-semibold">
            Which programme are you in?
          </h1>
          <p className="text-muted-foreground mt-2">
            Your address matches more than one maintained programme. Choose the
            record that governs your courses and institution calendar.
          </p>
        </div>
        <div className="flex flex-col">
          {access.programmes.map((programme) => (
            <button
              key={programme.id}
              disabled={access.saving}
              onClick={() => void choose(programme.id)}
              className="hover:bg-card flex flex-col gap-1 border-b p-4 text-left disabled:opacity-50"
            >
              <strong>
                {programme.degree} {programme.name}
              </strong>
              <span className="text-muted-foreground text-sm">
                {[programme.institution?.name, programme.institution?.city]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          ))}
        </div>
        {access.error && (
          <p role="alert" className="text-sm font-medium">
            {access.error}
          </p>
        )}
        <Button
          variant="ghost"
          className="w-fit"
          onClick={() => void clerk.signOut({ redirectUrl: "/sign-in" })}
        >
          Sign out
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}

function CloudBrowserState() {
  useEffect(() => {
    let live = true;
    let last = "";
    let timer: number | null = null;
    const push = async () => {
      const snapshot = browserStateSnapshot(localStorage);
      const serialized = JSON.stringify(snapshot);
      if (serialized === last) return;
      const response = await fetch("/api/browser-state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: serialized,
      });
      if (response.ok) last = serialized;
    };
    const start = async () => {
      try {
        const response = await fetch("/api/browser-state");
        if (!response.ok || !live) return;
        const remote = await response.json();
        const merged = mergeBrowserState(
          browserStateSnapshot(localStorage),
          remote,
        );
        for (const [key, value] of Object.entries(merged))
          if (value != null) localStorage.setItem(key, value);
        last = JSON.stringify(merged);
      } catch {
        /* Browser-state backup is optional; live APIs remain available. */
      } finally {
        if (live)
          timer = window.setInterval(
            () => void push().catch(() => undefined),
            2500,
          );
      }
    };
    void start();
    const hidden = () => {
      if (document.visibilityState === "hidden")
        void push().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      live = false;
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  return null;
}

function LocalGate({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<'checking' | 'allowed' | 'error'>('checking')

  useEffect(() => {
    let live = true
    fetch('/api/auth/session', { cache: 'no-store' }).then(async (response) => {
      if (response.status === 401) {
        window.location.replace(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        return
      }
      if (!response.ok) throw new Error('Your test session could not be verified.')
      if (live) setAccess('allowed')
    }).catch(() => { if (live) setAccess('error') })
    return () => { live = false }
  }, [])

  if (access === 'checking') return <Waiting />
  if (access === 'error') return <Empty><EmptyHeader><EmptyTitle>Unable to verify your session</EmptyTitle><EmptyDescription>Return to sign in and try again.</EmptyDescription></EmptyHeader><Button render={<a href="/sign-in" />}>Go to sign in</Button></Empty>
  return <>{children}</>
}

export function RequireAuth({
  authEnabled,
  localLoginEnabled,
  children,
}: {
  authEnabled: boolean;
  localLoginEnabled: boolean;
  children: ReactNode;
}) {
  if (localLoginEnabled)
    return (
      <LocalGate>
        <CloudBrowserState />
        {children}
      </LocalGate>
    );
  if (!authEnabled)
    return (
      <>
        <CloudBrowserState />
        {children}
      </>
    );
  return (
    <Gate>
      <CloudBrowserState />
      {children}
    </Gate>
  );
}
