"use client";

/**
 * The gate for authenticated workspace routes.
 *
 * Every /api/* route is authenticated server-side, so a signed-out visitor
 * would get a shell and a page full of 401s rather than a sign-in. This does
 * provides the two client behaviours the workspace needs:
 *
 *   1. Sends an unauthenticated visitor to /sign-in.
 *   2. Attaches the Clerk bearer token to same-origin /api/* requests, so a
 *      page can call plain `fetch`.
 *
 * Without a publishable key there is no sign-in at all — that is local
 * development, where the server resolves every request to one account.
 */

import {
  type ReactNode,
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { ChevronRightIcon } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { createAuthenticatedFetch } from "@/lib/workspace/auth-session.mjs";
import { workspaceCache } from "@/hooks/use-workspace-data";
import { workspaceWriteAffectsReads } from "@/lib/workspace/resource-cache.mjs";
import { cn } from "@/lib/utils";
import {
  browserStateSnapshot,
  mergeBrowserState,
} from "@/lib/workspace/migration.mjs";

/**
 * What the gate already knows about this visitor.
 *
 * The gate reads `/api/auth/session` before it will render anything, so the
 * shell has no reason to ask for it a second time. `clerkEnabled` records
 * whether a ClerkProvider is mounted above, because the local development
 * modes have none and Clerk's hooks throw outside their provider.
 */
export type WorkspaceSession = {
  userId?: string | null;
  mode?: string;
  email?: string | null;
  admin?: boolean;
  needsProgramme?: boolean;
  /** Programme memberships, first joined first. */
  programmes?: { programmeId: string; role?: string }[];
};

const WorkspaceSessionContext = createContext<{
  clerkEnabled: boolean;
  session: WorkspaceSession | null;
}>({ clerkEnabled: false, session: null });

export function useWorkspaceSession() {
  return useContext(WorkspaceSessionContext);
}

function Waiting() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 12000); return () => clearTimeout(timer) }, []);
  return (
    <div
      className="flex flex-col gap-3 p-8"
      aria-busy="true"
      aria-label="Checking your session"
    >
      <Skeleton className="h-14 w-72 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-48 motion-reduce:animate-none" />
      {slow && <p className="text-sm text-muted-foreground">This is taking longer than expected. <button className="font-semibold text-primary underline" onClick={() => window.location.reload()}>Try again</button></p>}
    </div>
  );
}

function Gate({
  onSession,
  children,
}: {
  onSession: (session: WorkspaceSession) => void;
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn, getToken, sessionId } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const pathname = usePathname();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const [retry, setRetry] = useState(0);
  const [verifiedSessionId, setVerifiedSessionId] = useState<string | null>(null);
  // The route the onboarding verdict below was established for. Setup is
  // enforced per destination, so a later move to another route re-checks
  // rather than trusting a stale answer.
  const checkedPath = useRef<string | null>(null);
  const [onboardingFinished, setOnboardingFinished] = useState<boolean | null>(
    null,
  );
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
        /** The programme whose save is in flight. */
        choosing?: string;
        error?: string;
      }
    | { kind: "error"; message: string }
  >({ kind: "checking" });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      workspaceCache.setScope(null);
      router.replace(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    workspaceCache.setScope(sessionId || null);
    let live = true;
    let recoveringSession = false;
    const controller = new AbortController();
    const original = window.fetch;
    setReady(false);
    setAccess({ kind: "checking" });
    setOnboardingFinished(null);
    const authenticatedFetch = createAuthenticatedFetch({
      fetchImpl: original.bind(window),
      getToken: options => getTokenRef.current(options),
      origin: window.location.origin,
      isActive: () => live && sessionIdRef.current === sessionId,
      onUnauthorized: failure => {
        if (!live) return;
        if (failure?.reason === "stale_session" && !recoveringSession) {
          recoveringSession = true;
          void clerk.signOut({ redirectUrl: "/sign-in" }).catch(() => window.location.assign("/sign-in"));
        }
      },
    });
    window.fetch = authenticatedFetch;
    async function check() {
      try {
        // Both endpoints only read the authenticated account. Starting them
        // together removes a full network round-trip from every sign-in and
        // refresh; previously onboarding did not begin until session had
        // completely returned and been decoded.
        const [response, onboardingResponse] = await Promise.all([
          authenticatedFetch("/api/auth/session", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }),
          authenticatedFetch("/api/onboarding/status", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }),
        ]);
        const [session, onboarding] = await Promise.all([
          response.json().catch(() => ({})),
          onboardingResponse.json().catch(() => ({})),
        ]);
        if (!live) return;
        setVerifiedSessionId(sessionId || null);
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
        if (!onboardingResponse.ok)
          throw new Error(
            onboarding.error || "Your setup status could not be checked.",
          );
        onSession(session);
        checkedPath.current = window.location.pathname;
        setOnboardingFinished(Boolean(onboarding.finished));
        // A client navigation, not a document load: an unfinished setup used
        // to reload the whole application on every move inside the workspace.
        if (!onboarding.finished && window.location.pathname !== "/app/setup")
          router.replace("/app/setup");
        if (session.needsProgramme && (session.eligible?.length || 0) > 1)
          setAccess({
            kind: "programme",
            programmes: session.eligible,
            saving: false,
          });
        else setAccess({ kind: "allowed" });
        setReady(true);
      } catch (cause) {
        if (!live) return;
        setVerifiedSessionId(sessionId || null);
        setAccess({ kind: "error", message: (cause as Error).name === "TimeoutError" ? "Your workspace is taking longer than expected. Try again." : (cause as Error).message });
        setReady(true);
      }
    }
    void check();
    return () => {
      live = false;
      controller.abort();
      // Route changes/sign-out must not leave an old session's fetch wrapper
      // underneath the next mount (including React Strict Mode's re-mount).
      if (window.fetch === authenticatedFetch) window.fetch = original;
    };
  }, [clerk, isLoaded, isSignedIn, sessionId, onSession, router, retry]);

  // Setup stays compulsory: leaving it for another destination re-reads the
  // status once instead of reloading the document, and setup remains reachable
  // so the student can finish it.
  const awaitingSetup = ready && verifiedSessionId === sessionId && onboardingFinished === false && pathname !== "/app/setup";
  useEffect(() => {
    if (!awaitingSetup || checkedPath.current === pathname) return;
    let live = true;
    void window
      .fetch("/api/onboarding/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((onboarding) => {
        if (!live) return;
        checkedPath.current = pathname;
        if (onboarding?.finished) setOnboardingFinished(true);
        else router.replace("/app/setup");
      })
      .catch(() => {
        if (live) router.replace("/app/setup");
      });
    return () => {
      live = false;
    };
  }, [awaitingSetup, pathname, router]);

  if (!isLoaded || !isSignedIn || !ready || verifiedSessionId !== sessionId) return <Waiting />;
  if (awaitingSetup) return <Waiting />;
  if (access.kind === "ineligible")
    return (
      <Empty className="min-h-dvh items-center border-0 text-center">
        <EmptyHeader className="items-center">
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
      <Empty className="min-h-dvh items-center border-0 text-center">
        <EmptyHeader className="items-center">
          <EmptyTitle>Unable to start your workspace</EmptyTitle>
          <EmptyDescription>{access.message}</EmptyDescription>
        </EmptyHeader>
        <div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setRetry(value => value + 1)}>Try again</Button><Button variant="ghost" onClick={() => void clerk.signOut({ redirectUrl: "/sign-in" })}>Use another account</Button></div>
      </Empty>
    );
  if (access.kind === "programme") {
    const choose = async (programmeId: string) => {
      setAccess({
        ...access,
        saving: true,
        choosing: programmeId,
        error: undefined,
      });
      try {
        const response = await window.fetch("/api/account/programme", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ programmeId }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(body.error || "Could not join this programme.");
        // The join returns the refreshed session, so the workspace (and
        // setup's programme editor) sees the membership without a reload.
        onSession(body);
        setAccess({ kind: "allowed" });
      } catch (cause) {
        setAccess({
          ...access,
          saving: false,
          choosing: undefined,
          error: (cause as Error).message,
        });
      }
    };
    const address = user?.primaryEmailAddress?.emailAddress;
    // The same focused frame as /app/setup: a small brand bar with one quiet
    // escape action, a flat page header, then a ruled register of choices.
    return (
      <div className="mx-auto min-h-dvh w-full max-w-[1260px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark className="size-9 rounded-lg" />
            <div className="leading-none">
              <strong className="block text-sm">Wicker Study</strong>
              <span className="text-muted-foreground mt-1 block text-xs">
                Programme selection
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={access.saving}
            onClick={() => void clerk.signOut({ redirectUrl: "/sign-in" })}
          >
            Sign out
          </Button>
        </div>
        <main className="flex min-w-0 max-w-[68ch] flex-col gap-6">
          <header>
            <h1 className="font-heading text-[clamp(2rem,4vw,3.25rem)] leading-[0.98] font-semibold tracking-[-0.045em]">
              Which programme are you in?
            </h1>
            <p className="text-muted-foreground mt-3 max-w-[62ch] text-sm leading-relaxed">
              {address ? (
                <>
                  <span className="text-foreground font-medium">{address}</span>{" "}
                  matches more than one maintained programme.
                </>
              ) : (
                "Your address matches more than one maintained programme."
              )}{" "}
              Choose the one that governs your courses and institution
              calendar.
            </p>
          </header>
          <ol
            className="flex flex-col border-t"
            aria-label="Eligible programmes"
            aria-busy={access.saving || undefined}
          >
            {access.programmes.map((programme) => {
              const chosen = access.choosing === programme.id;
              const institution = [
                programme.institution?.name,
                programme.institution?.city,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={programme.id} className="border-b">
                  <button
                    type="button"
                    disabled={access.saving}
                    aria-current={chosen ? "true" : undefined}
                    onClick={() => void choose(programme.id)}
                    className={cn(
                      "focus-visible:ring-ring/50 -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 px-2 py-3 text-left transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed",
                      chosen ? "bg-card" : "hover:bg-card disabled:opacity-50",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <strong className="text-sm font-medium">
                        {programme.degree} {programme.name}
                      </strong>
                      {institution && (
                        <small className="text-muted-foreground text-[13.5px] leading-relaxed">
                          {institution}
                        </small>
                      )}
                    </div>
                    {chosen ? (
                      <Spinner
                        className="text-primary shrink-0"
                        aria-label="Joining programme"
                      />
                    ) : (
                      <ChevronRightIcon
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          {access.error && (
            <p role="alert" className="text-destructive text-sm font-medium">
              {access.error}
            </p>
          )}
        </main>
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
    // The backup only has to survive the tab, so it writes on change at a
    // resting cadence and flushes the moment the page is hidden or left.
    const push = async ({ keepalive = false } = {}) => {
      const snapshot = browserStateSnapshot(localStorage);
      const serialized = JSON.stringify(snapshot);
      if (serialized === last) return;
      const response = await fetch("/api/browser-state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: serialized,
        keepalive,
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
            30_000,
          );
      }
    };
    void start();
    const flush = () => void push({ keepalive: true }).catch(() => undefined);
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", flush);
    return () => {
      live = false;
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
  return null;
}

function LocalGate({ onSession, children }: { onSession: (session: WorkspaceSession) => void; children: ReactNode }) {
  const router = useRouter()
  const [access, setAccess] = useState<'checking' | 'allowed' | 'error'>('checking')

  useEffect(() => {
    let live = true
    fetch('/api/auth/session', { cache: 'no-store' }).then(async (response) => {
      if (response.status === 401) {
        router.replace(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        return
      }
      if (!response.ok) throw new Error('Your test session could not be verified.')
      const session = await response.json().catch(() => ({}))
      if (!live) return
      onSession(session)
      setAccess('allowed')
    }).catch(() => { if (live) setAccess('error') })
    return () => { live = false }
  }, [onSession, router])

  if (access === 'checking') return <Waiting />
  if (access === 'error') return <Empty className="min-h-dvh items-center border-0 text-center"><EmptyHeader className="items-center"><EmptyTitle>Unable to verify your session</EmptyTitle><EmptyDescription>Return to sign in and try again.</EmptyDescription></EmptyHeader><Button nativeButton={false} render={<a href="/sign-in" />}>Go to sign in</Button></Empty>
  return <>{children}</>
}

/**
 * The open development modes have no gate to read the session, so one quiet
 * read supplies the same facts the shell would otherwise fetch for itself.
 */
function OpenSession({ onSession }: { onSession: (session: WorkspaceSession) => void }) {
  useEffect(() => {
    let live = true;
    void fetch("/api/auth/session", { headers: { accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((session) => {
        if (live && session) onSession(session);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [onSession]);
  return null;
}

function WorkspaceFetchBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const original = window.fetch;
    const observed: typeof fetch = async (input, init) => {
      const response = await original(input, init);
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      const method = init?.method || (input instanceof Request ? input.method : "GET");
      if (response.ok && url.origin === window.location.origin && workspaceWriteAffectsReads(url.pathname, method)) workspaceCache.invalidate();
      return response;
    };
    window.fetch = observed;
    setReady(true);
    return () => { workspaceCache.setScope(null); if (window.fetch === observed) window.fetch = original };
  }, []);
  return ready ? children : <Waiting />;
}

function AuthenticatedWorkspace({
  authEnabled,
  localLoginEnabled,
  children,
}: {
  authEnabled: boolean;
  localLoginEnabled: boolean;
  children: ReactNode;
}) {
  const [session, updateSession] = useState<WorkspaceSession | null>(null);
  const setSession = useCallback((next: WorkspaceSession) => {
    if (!authEnabled) workspaceCache.setScope(next.userId || "local");
    updateSession(next);
  }, [authEnabled]);
  const value = useMemo(
    () => ({ clerkEnabled: authEnabled, session }),
    [authEnabled, session],
  );
  const workspace = (
    <WorkspaceSessionContext.Provider value={value}>
      <CloudBrowserState />
      {children}
    </WorkspaceSessionContext.Provider>
  );
  if (localLoginEnabled)
    return <LocalGate onSession={setSession}>{workspace}</LocalGate>;
  if (!authEnabled)
    return (
      <>
        <OpenSession onSession={setSession} />
        {workspace}
      </>
    );
  return <Gate onSession={setSession}>{workspace}</Gate>;
}

export function RequireAuth(props: { authEnabled: boolean; localLoginEnabled: boolean; children: ReactNode }) {
  return <WorkspaceFetchBoundary><AuthenticatedWorkspace {...props} /></WorkspaceFetchBoundary>;
}
