"use client";

/**
 * Practice.
 *
 * One destination, four local tabs, and a page frame that stays the same
 * height whichever tab is open: a title, one line saying what is waiting in
 * the tab you are on, this sitting's figure at the right, then the tab row.
 * Nothing inside the canvas repeats the destination's name back at you.
 *
 * The shell is all that loads up front. Each tab, and the markdown/KaTeX
 * pipeline the questions are set in, arrive on demand — the mistake bank has
 * no reason to ship a mock runner or a formula renderer.
 *
 * Session state (what has been answered, what has been reviewed, and the cards
 * still in hand) is held here rather than inside a tab, because Base UI
 * unmounts the panel you are not looking at and a sitting should survive a
 * glance at another tab.
 */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type Mistake,
  type MockSession,
  type PracticePayload,
  type PracticeQuestion,
  type SrDue,
  type SrPayload,
  courseFacets,
  practiceHeadline,
  practiceLocation,
  sessionMeter,
} from "@/lib/workspace/practice.mjs";
import type { StudyCourse } from "@/lib/workspace/courses.mjs";
import { NUMERALS, type SessionEvent, api } from "./shared";

const TabSkeleton = () => (
  <div className="flex flex-col gap-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <Skeleton key={index} className="h-20 w-full motion-reduce:animate-none" />
    ))}
  </div>
);

const QuestionsTab = dynamic(() => import("./questions-tab"), {
  ssr: false,
  loading: TabSkeleton,
});
const FlashcardsTab = dynamic(() => import("./flashcards-tab"), {
  ssr: false,
  loading: TabSkeleton,
});
const MistakesTab = dynamic(() => import("./mistakes-tab"), {
  ssr: false,
  loading: TabSkeleton,
});
const MocksTab = dynamic(() => import("./mocks-tab"), {
  ssr: false,
  loading: TabSkeleton,
});

function TabCount({ value }: { value: number }) {
  return (
    <span
      className={`text-muted-foreground rounded-full border px-1.5 py-px text-[11px] font-medium ${NUMERALS}`}
    >
      {value}
    </span>
  );
}

export default function PracticePage() {
  const [practice, setPractice] = useState<PracticePayload | null>(null);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [sr, setSr] = useState<SrPayload | null>(null);
  const [srError, setSrError] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null);
  const [mistakesError, setMistakesError] = useState<string | null>(null);
  const [mocks, setMocks] = useState<MockSession[] | null>(null);
  const [mocksError, setMocksError] = useState<string | null>(null);
  const [courses, setCourses] = useState<StudyCourse[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [deck, setDeck] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState("questions");
  const [initialSessionId, setInitialSessionId] = useState<string | null>(null);

  // This sitting, kept above the tab panels so it survives a tab switch.
  const [answers, setAnswers] = useState<SessionEvent<PracticeQuestion>[]>([]);
  const [answersEnded, setAnswersEnded] = useState(false);
  const [queue, setQueue] = useState<SrDue[]>([]);
  const [reviews, setReviews] = useState<SessionEvent<SrDue>[]>([]);

  useEffect(() => {
    let live = true;
    const search = new URLSearchParams(window.location.search);
    const location = practiceLocation(
      `/practice/${search.get("tab") ?? "questions"}${search.get("session") ? `/${encodeURIComponent(search.get("session")!)}` : ""}`,
    );
    setTab(location.tab);
    setInitialSessionId(location.sessionId);
    const json = async (path: string) => {
      const response = await fetch(path, {
        headers: { accept: "application/json" },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data.error === "string"
            ? data.error
            : `${path} returned ${response.status}`;
        throw new Error(message);
      }
      return data;
    };

    json("/api/practice")
      .then((data: PracticePayload) => {
        if (live) setPractice(data);
      })
      .catch((cause: Error) => {
        if (live) setPracticeError(cause.message);
      });
    json("/api/sr/due")
      .then((data: SrPayload) => {
        if (live) {
          setSr(data);
          setQueue(data.due ?? []);
          setDueCount(data.dueCount ?? 0);
          setDeck(new Set(data.allIds ?? []));
        }
      })
      .catch((cause: Error) => {
        if (live) setSrError(cause.message);
      });
    json("/api/mistakes?open=true")
      .then((data: Mistake[]) => {
        if (live) setMistakes(Array.isArray(data) ? data : []);
      })
      .catch((cause: Error) => {
        if (live) setMistakesError(cause.message);
      });
    json("/api/mocks")
      .then((data: MockSession[]) => {
        if (live) setMocks(Array.isArray(data) ? data : []);
      })
      .catch((cause: Error) => {
        if (live) setMocksError(cause.message);
      });
    json("/api/state")
      .then((data) => {
        if (live) setCourses(data.courses ?? []);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  const codeOf = (courseId: string) =>
    courses.find((entry) => entry.id === courseId)?.code ?? courseId;
  const openMistakes = mistakes?.length ?? 0;
  const questionCount = practice?.questions.length ?? 0;
  const courseCount = useMemo(
    () => courseFacets(practice?.questions ?? []).length,
    [practice],
  );

  const loaded =
    tab === "flashcards"
      ? Boolean(sr || srError)
      : tab === "mistakes"
        ? Boolean(mistakes || mistakesError)
        : tab === "mocks"
          ? Boolean(mocks || mocksError)
          : Boolean(practice || practiceError);

  const headline = practiceHeadline({
    tab,
    loaded,
    questionCount,
    courseCount,
    dueCount,
    totalCards: sr?.totalCards ?? 0,
    mistakeCount: openMistakes,
    mockCount: mocks?.length ?? 0,
  });
  const meter = sessionMeter({
    tab,
    answered: answers.length,
    reviewed: reviews.length,
  });

  return (
    <div className="mx-auto flex w-full max-w-[1180px] min-w-0 flex-col gap-6 p-5 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">
            Practice
          </h1>
          <p className="text-muted-foreground max-w-[74ch] text-sm">
            {headline}
          </p>
        </div>
        {meter && (
          <p className={`text-muted-foreground text-sm ${NUMERALS}`}>{meter}</p>
        )}
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          history.replaceState(null, "", `/app/practice?tab=${value}`);
        }}
        className="min-w-0 gap-6"
      >
        <TabsList
          variant="line"
          className="max-w-full justify-start overflow-x-auto"
        >
          <TabsTrigger value="questions">
            Questions
            {questionCount > 0 && <TabCount value={questionCount} />}
          </TabsTrigger>
          <TabsTrigger value="flashcards">
            Flashcards
            {dueCount > 0 && <TabCount value={dueCount} />}
          </TabsTrigger>
          <TabsTrigger value="mistakes">
            Mistakes
            {openMistakes > 0 && <TabCount value={openMistakes} />}
          </TabsTrigger>
          <TabsTrigger value="mocks">Mocks</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="min-w-0">
          <QuestionsTab
            payload={practice}
            error={practiceError}
            deck={deck}
            onDeckChange={(id) =>
              setDeck((current) => new Set(current).add(id))
            }
            onMistake={() => {
              api<Mistake[]>("/api/mistakes?open=true")
                .then(setMistakes)
                .catch((cause: Error) => setMistakesError(cause.message));
            }}
            events={answers}
            onEvent={(event) => setAnswers((current) => [...current, event])}
            ended={answersEnded}
            onEndedChange={setAnswersEnded}
            onClearSession={() => {
              setAnswers([]);
              setAnswersEnded(false);
            }}
          />
        </TabsContent>

        <TabsContent value="flashcards" className="min-w-0">
          <FlashcardsTab
            payload={sr}
            error={srError}
            codeOf={codeOf}
            queue={queue}
            onQueueChange={setQueue}
            events={reviews}
            onEvent={(event) => setReviews((current) => [...current, event])}
            onClearSession={() => setReviews([])}
            onReviewed={() => setDueCount((count) => Math.max(0, count - 1))}
            onRemoved={(id) => {
              setDeck((current) => {
                const next = new Set(current);
                next.delete(id);
                return next;
              });
              setDueCount((count) => Math.max(0, count - 1));
            }}
          />
        </TabsContent>

        <TabsContent value="mistakes" className="min-w-0">
          <MistakesTab
            mistakes={mistakes}
            error={mistakesError}
            courses={courses}
            onChanged={setMistakes}
            onDeckChange={(id) =>
              setDeck((current) => new Set(current).add(id))
            }
          />
        </TabsContent>

        <TabsContent value="mocks" className="min-w-0">
          <MocksTab
            sessions={mocks}
            error={mocksError}
            courses={courses}
            bank={practice?.questions ?? []}
            onChanged={setMocks}
            initialSessionId={initialSessionId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
