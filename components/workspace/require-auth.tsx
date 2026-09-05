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
  return (
    <div
      className="flex flex-col gap-3 p-8"
      aria-busy="true"
      aria-label="Checking your session"
    >
      <Skeleton className="h-14 w-72 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-48 motion-reduce:animate-none" />
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
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const pathname = usePathname();
  const patched = useRef(false);
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
      router.replace("/sign-in");
      return;
    }
    if (patched.current) return;
    patched.current = true;

    const original = window.fetch.bind(window);
    let heldToken: { value: string; expiresAt: number } | null = null;
    let tokenRequest: Promise<string | null> | null = null;
    let recoveringSession = false;
    const recoverSession = () => {
      if (recoveringSession) return;
      recoveringSession = true;
      heldToken = null;
      void clerk
        .signOut({ redirectUrl: "/sign-in" })
        .catch(() => window.location.assign("/sign-in"));
    };
    const sessionToken = async () => {
      if (heldToken && heldToken.expiresAt > Date.now()) return heldToken.value;
      tokenRequest ??= getToken().then((value) => {
        if (value) heldToken = { value, expiresAt: Date.now() + 30_000 };
        return value;
      }).finally(() => { tokenRequest = null; });
      return tokenRequest;
    };
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
      // Clerk token resolution is async and used to run once per API request.
      // A page commonly starts three or four reads together, so deduplicate
      // those lookups and briefly retain the same short-lived session token.
      const token = await sessionToken();
      if (token) headers.set("authorization", `Bearer ${token}`);
      const response = await original(input, { ...init, headers });
      // A Clerk identity can be deleted while this already-mounted workspace
      // still holds its old token. Clear that client session immediately; all
      // API calls otherwise keep retrying an identity Clerk no longer knows.
      if (response.status === 401) recoverSession();
      return response;
    };
    async function check() {
      try {
        // Both endpoints only read the authenticated account. Starting them
        // together removes a full network round-trip from every sign-in and
        // refresh; previously onboarding did not begin until session had
        // completely returned and been decoded.
        const [response, onboardingResponse] = await Promise.all([
          window.fetch("/api/auth/session"),
          window.fetch("/api/onboarding"),
        ]);
        const [session, onboarding] = await Promise.all([
          response.json().catch(() => ({})),
          onboardingResponse.json().catch(() => ({})),
        ]);
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
        setAccess({ kind: "error", message: (cause as Error).message });
        setReady(true);
      }
    }
    void check();
  }, [getToken, isLoaded, isSignedIn, onSession, router]);

  // Setup stays compulsory: leaving it for another destination re-reads the
  // status once instead of reloading the document, and setup remains reachable
  // so the student can finish it.
  const awaitingSetup = onboardingFinished === false && pathname !== "/app/setup";
  useEffect(() => {
    if (!awaitingSetup || checkedPath.current === pathname) return;
    let live = true;
    void window
      .fetch("/api/onboarding")
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

  if (!isLoaded || !ready) return <Waiting />;
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

export function RequireAuth({
  authEnabled,
  localLoginEnabled,
  children,
}: {
  authEnabled: boolean;
  localLoginEnabled: boolean;
  children: ReactNode;
}) {
  const [session, setSession] = useState<WorkspaceSession | null>(null);
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
