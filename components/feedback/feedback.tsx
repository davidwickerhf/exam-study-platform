"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { MessageSquareIcon, ThumbsUpIcon, ThumbsDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { feedbackApi, type Options } from "./feedback-api";
export { feedbackApi, field, label, categories } from "./feedback-api";
export type { Subject } from "./feedback-api";
const ReportDialog = dynamic(() => import("./report-dialog"), { ssr: false });
const reactionReads = new Map<string, { at: number; promise: Promise<any> }>();
function reactions(conversationId: string) {
  const held = reactionReads.get(conversationId);
  if (held && Date.now() - held.at < 30000) return held.promise;
  const promise = feedbackApi(
    `/api/feedback/reactions?conversationId=${encodeURIComponent(conversationId)}`,
  );
  reactionReads.set(conversationId, { at: Date.now(), promise });
  promise.catch(() => reactionReads.delete(conversationId));
  return promise;
}
const Context = createContext<(options?: Options) => void>(() => {});
export function useFeedback() {
  return useContext(Context);
}
export function FeedbackButton({
  subject,
  excerpt,
  category,
  children,
}: Options & { children?: ReactNode }) {
  const open = useFeedback();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() =>
        open({
          subject,
          excerpt:
            excerpt ||
            (subject?.kind === "material"
              ? window.getSelection()?.toString()
              : undefined),
          category,
        })
      }
    >
      <MessageSquareIcon className="size-4" />
      {children || "Give feedback"}
    </Button>
  );
}
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname(),
    [options, setOptions] = useState<Options | null>(null);
  useEffect(() => {
    const listener = () => setOptions({});
    window.addEventListener("wicker-feedback", listener);
    return () => window.removeEventListener("wicker-feedback", listener);
  }, []);
  const navigation = useRef<{ at: number; path: string } | null>(null),
    timings = useRef(false);
  useEffect(() => {
    const timeout = setTimeout(() => {
      void feedbackApi("/api/feedback/preferences")
        .then((p) => {
          timings.current = p.performance === true;
        })
        .catch(() => {});
    }, 1500);
    const click = (event: MouseEvent) => {
      const target = (event.target as Element)?.closest("a");
      if (!target || event.metaKey || event.ctrlKey || event.button !== 0)
        return;
      const url = new URL(target.href);
      if (url.origin === location.origin && url.pathname !== location.pathname)
        navigation.current = { at: performance.now(), path: url.pathname };
    };
    const preference = (event: Event) => {
      timings.current = (event as CustomEvent).detail?.performance === true;
    };
    document.addEventListener("click", click, true);
    window.addEventListener("feedback-preferences", preference);
    return () => {
      clearTimeout(timeout);
      reactionReads.clear();
      document.removeEventListener("click", click, true);
      window.removeEventListener("feedback-preferences", preference);
    };
  }, []);
  useEffect(() => {
    const start = navigation.current;
    if (!start || start.path !== pathname) return;
    navigation.current = null;
    requestAnimationFrame(() => {
      const durationMs = performance.now() - start.at;
      if (timings.current && durationMs >= 2000)
        void feedbackApi("/api/feedback/diagnostics", {
          code: "PERFORMANCE",
          stage: "navigation",
          route: pathname,
          durationMs,
          outcome: "completed",
        }).catch(() => {});
    });
  }, [pathname]);
  // Technical events contain an allowlisted code and surface, never exception
  // messages, stack traces, URLs with query strings or conversation content.
  useEffect(() => {
    let sent = 0;
    const report = () => {
      if (sent++ < 3)
        void feedbackApi("/api/feedback/diagnostics", {
          code: "CLIENT_FAILURE",
          stage: "render",
          route: pathname,
        }).catch(() => {});
    };
    window.addEventListener("error", report);
    return () => window.removeEventListener("error", report);
  }, [pathname]);
  return (
    <Context.Provider value={(o) => setOptions(o || {})}>
      {children}
      {options && (
        <ReportDialog
          key={options.draftId || "report"}
          options={{
            ...options,
            subject: { route: pathname, ...options.subject },
          }}
          close={() => setOptions(null)}
        />
      )}
    </Context.Provider>
  );
}
export function AnswerFeedback({
  conversationId,
  message,
}: {
  conversationId: string;
  message: { id?: string; answerRevision?: string; content: string };
}) {
  const open = useFeedback(),
    [value, setValue] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    reactions(conversationId)
      .then((rows) => {
        if (active)
          setValue(
            rows.find(
              (r: { answer_id: string; answer_revision: string }) =>
                r.answer_id === message.id &&
                r.answer_revision === message.answerRevision,
            )?.value || null,
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [conversationId, message.id, message.answerRevision]);
  const subject = {
    kind: "answer",
    route: "/app/tutor",
    conversationId,
    answerId: message.id,
    answerRevision: message.answerRevision,
  };
  async function vote(next: string) {
    const old = value,
      updated = value === next ? null : next;
    setValue(updated);
    setBusy(true);
    setError("");
    try {
      await feedbackApi("/api/feedback/reactions", { subject, value: updated });
      reactionReads.delete(conversationId);
    } catch (e) {
      setValue(old);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!message.id || !message.answerRevision) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1 text-muted-foreground">
      <Button
        title="Sends only your rating and answer reference"
        size="icon-sm"
        variant="ghost"
        aria-label="Helpful answer"
        aria-pressed={value === "helpful"}
        disabled={busy}
        onClick={() => void vote("helpful")}
      >
        <ThumbsUpIcon className={value === "helpful" ? "text-primary" : ""} />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Not helpful"
        aria-pressed={value === "not-helpful"}
        disabled={busy}
        onClick={() => void vote("not-helpful")}
      >
        <ThumbsDownIcon
          className={value === "not-helpful" ? "text-primary" : ""}
        />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          open({ subject, excerpt: message.content, category: "incorrect" })
        }
      >
        Report an issue
      </Button>
      {value === "not-helpful" && (
        <span className="text-xs">
          Saved without chat text. Add details with “Report an issue”.
        </span>
      )}
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
