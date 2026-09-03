"use client";

/**
 * The flashcard review loop.
 *
 * The queue lives on the page rather than in this component, so switching tabs
 * mid-sitting does not silently re-deal cards that have already been rated. How
 * the queue moves — rated card gone, skipped card to the back, removed card out
 * of the deck — is `advanceReviewQueue` in lib/workspace/practice.mjs, next to
 * the SM-2 pass boundary it belongs to.
 */

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingResume } from "@/components/workspace/onboarding-resume";
import {
  type SrDue,
  type SrPayload,
  SR_QUALITIES,
  advanceReviewQueue,
  canSkip,
  cardLine,
  passed,
  summariseSession,
} from "@/lib/workspace/practice.mjs";
import {
  COLUMN_LABEL,
  Choices,
  NUMERALS,
  PAPER,
  PROSE,
  Prose,
  type SessionEvent,
  TypeLine,
  api,
} from "./shared";
import { SessionLedger } from "./session-ledger";

type ReviewEvent = SessionEvent<SrDue>;

export default function FlashcardsTab({
  payload,
  error,
  codeOf,
  queue,
  onQueueChange,
  events,
  onEvent,
  onClearSession,
  onReviewed,
  onRemoved,
}: {
  payload: SrPayload | null;
  error: string | null;
  codeOf: (courseId: string) => string;
  queue: SrDue[];
  onQueueChange: (queue: SrDue[]) => void;
  events: ReviewEvent[];
  onEvent: (event: ReviewEvent) => void;
  onClearSession: () => void;
  onReviewed: () => void;
  onRemoved: (id: string) => void;
}) {
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const current = queue[0] ?? null;
  const summary = summariseSession(events);

  const rate = async (quality: number) => {
    if (!current || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch("/api/sr/review", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ questionId: current.id, quality }),
      });
      if (!response.ok)
        throw new Error(`The review was not recorded (${response.status})`);
      onEvent({
        key: current.id,
        courseId: current.courseId,
        courseCode: codeOf(current.courseId),
        correct: passed(quality),
        item: current,
      });
      onQueueChange(advanceReviewQueue(queue, "rate"));
      setReveal(false);
      onReviewed();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    onQueueChange(advanceReviewQueue(queue, "skip"));
    setReveal(false);
  };

  const remove = async () => {
    if (!current || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      await api("/api/sr/remove", {
        method: "POST",
        body: JSON.stringify({ questionId: current.id }),
      });
      onQueueChange(advanceReviewQueue(queue, "remove"));
      onRemoved(current.id);
      setReveal(false);
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Your deck could not be read</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!payload)
    return <Skeleton className="h-64 w-full motion-reduce:animate-none" />;

  if (!payload.totalCards) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Your deck is empty</EmptyTitle>
          <EmptyDescription>
            Open the Questions tab and add any published question, or submit an
            answer for grading. Graded questions join the deck automatically.
          </EmptyDescription>
        </EmptyHeader>
        <OnboardingResume />
      </Empty>
    );
  }

  if (!current) {
    if (events.length) {
      return (
        <SessionLedger
          title="That is the queue cleared"
          note={`SM-2 has scheduled every card you rated; ${payload.totalCards} ${payload.totalCards === 1 ? "card remains" : "cards remain"} in the deck. Anything rated below 3 comes back tomorrow whatever you do here.`}
          unit="Reviewed"
          summary={summary}
          onRetryMissed={() => {
            onQueueChange(
              summary.missed
                .map((event) => event.item)
                .filter(Boolean) as SrDue[],
            );
            setReveal(false);
          }}
          onDone={onClearSession}
        />
      );
    }
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Nothing is due right now</EmptyTitle>
          <EmptyDescription>
            {payload.totalCards}{" "}
            {payload.totalCards === 1 ? "card sits" : "cards sit"} in the deck,
            none of them due.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex w-full max-w-[74ch] flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-2">
        <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
          {codeOf(current.courseId)} · Ch {current.chapterId}
        </span>
        <span className={`text-muted-foreground text-xs ${NUMERALS}`}>
          {[cardLine(current.card), `${queue.length} left`]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      <TypeLine question={current.question} />
      <Prose source={current.question.question} className={PROSE} />
      <Choices question={current.question} />

      {reveal ? (
        <>
          <Prose source={current.question.expected} className={PAPER} />
          <div className="flex flex-col gap-2">
            <p className={COLUMN_LABEL}>How well did you recall it?</p>
            {/* Ruled rows on a phone, a row of controls from sm up. */}
            <div className="flex flex-col divide-y border-y sm:flex-row sm:flex-wrap sm:gap-2 sm:divide-y-0 sm:border-0">
              {SR_QUALITIES.map((quality) => (
                <Button
                  key={quality.value}
                  variant="ghost"
                  size="lg"
                  disabled={busy}
                  onClick={() => void rate(quality.value)}
                  title={quality.hint}
                  className="w-full justify-start rounded-none px-1 sm:w-auto sm:justify-center sm:rounded-sm sm:border sm:px-4"
                >
                  <span className={`font-semibold ${NUMERALS}`}>
                    {quality.value}
                  </span>
                  <span className="text-muted-foreground">{quality.label}</span>
                  <span className="text-muted-foreground ml-auto text-xs sm:hidden">
                    {quality.hint}
                  </span>
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              0–2 resets the card and shows it again tomorrow. 3–5 lengthens the
              interval.
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button className="w-full sm:w-auto" onClick={() => setReveal(true)}>
            Show answer
          </Button>
          <Button
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={skip}
            disabled={!canSkip(queue)}
            title={
              canSkip(queue)
                ? undefined
                : "This is the last card in the queue."
            }
          >
            Skip for now
          </Button>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => void remove()}
        disabled={busy}
      >
        <Trash2Icon data-icon="inline-start" />
        Remove from deck
      </Button>

      {failure && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {failure}
        </p>
      )}
    </div>
  );
}
