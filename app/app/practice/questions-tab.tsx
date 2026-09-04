"use client";

/**
 * The question queue.
 *
 * One question is on the board at a time, ruled into header, body and footer
 * inside a single surface — the queue position is stated once, in the footer,
 * where the controls that change it are. The course chips are a contained
 * scroller rather than a wrapping row, because at 390px a five-course bank
 * would otherwise push the whole canvas sideways.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  ShuffleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type PracticePayload,
  type PracticeQuestion,
  answerWasCorrect,
  chapterFacets,
  courseFacets,
  filterQuestions,
  gradeRequest,
  questionKey,
  summariseSession,
  typeFacets,
  typeLabel,
} from "@/lib/workspace/practice.mjs";
import {
  AnswerControl,
  NUMERALS,
  PAPER,
  PROSE,
  Prose,
  type SessionEvent,
  TypeLine,
  api,
} from "./shared";
import { SessionLedger } from "./session-ledger";

type QuestionEvent = SessionEvent<PracticeQuestion>;

function SessionDatum({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 px-4 py-3 sm:px-5 ${className}`}>
      <span className="text-muted-foreground block text-[10px] font-semibold tracking-[0.1em] uppercase">
        {label}
      </span>
      <strong className="mt-0.5 block truncate text-sm font-medium">
        {value}
      </strong>
    </div>
  );
}

function QuestionCard({
  question,
  inDeck,
  onDeckChange,
  onMistake,
  onEvent,
}: {
  question: PracticeQuestion;
  inDeck: boolean;
  onDeckChange: (id: string) => void;
  onMistake: () => void;
  onEvent: (event: QuestionEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState("");
  const [result, setResult] = useState<{
    correction: string;
    score: number | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const grade = async () => {
    if (!attempt.trim() || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const data = await api<{
        correction: string;
        score: number | null;
        savedAsMistake?: string | null;
      }>("/api/grade", {
        method: "POST",
        body: JSON.stringify(
          gradeRequest(
            question,
            attempt,
            question.courseCode ?? question.courseId,
            question.chapterName ?? "Practice",
          ),
        ),
      });
      setResult(data);
      onEvent({
        key: questionKey(question),
        courseId: question.courseId,
        courseCode: question.courseCode ?? question.courseId,
        correct: answerWasCorrect(data.score),
        item: question,
      });
      if (data.savedAsMistake) onMistake();
      onDeckChange(question.id);
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await api("/api/sr/add", {
        method: "POST",
        body: JSON.stringify({ questionId: question.id }),
      });
      onDeckChange(question.id);
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[900px] flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-2 sm:gap-3">
        <TypeLine question={question} />
        <Prose
          source={question.question}
          className={`${PROSE} font-heading text-[21px] leading-[1.45] font-semibold tracking-[-0.015em]`}
        />
      </div>
      <div className="flex flex-col gap-4">
        <AnswerControl
          question={question}
          value={attempt}
          onChange={(value) => {
            setAttempt(value);
            setResult(null);
            setFailure(null);
          }}
          disabled={busy}
          actions={
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => void grade()}
                disabled={busy || !attempt.trim()}
              >
                {busy ? "Checking…" : "Check answer"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full bg-background sm:w-auto"
                onClick={() => void add()}
                disabled={busy || inDeck}
              >
                {inDeck ? (
                  <CheckIcon data-icon="inline-start" />
                ) : (
                  <PlusIcon data-icon="inline-start" />
                )}
                {inDeck ? "In flashcards" : "Add to flashcards"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full sm:ml-auto sm:w-auto"
                onClick={() => {
                  setAttempt("");
                  setResult(null);
                  setFailure(null);
                }}
                disabled={!attempt && !result}
              >
                Clear answer
              </Button>
              {question.expected && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full sm:w-auto"
                  onClick={() => setOpen((shown) => !shown)}
                >
                  <ChevronDownIcon
                    data-icon="inline-start"
                    className={open ? "rotate-180" : ""}
                  />
                  {open ? "Hide reference" : "Reference answer"}
                </Button>
              )}
            </div>
          }
        />
      </div>
      {result && (
        <div className="bg-card overflow-hidden rounded-[10px] border">
          <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
            <strong className="text-sm">Grader feedback</strong>
            <strong className={`text-sm ${NUMERALS}`}>
              {result.score === null ? "Not scored" : `${result.score}/10`}
            </strong>
          </div>
          <div className="px-4 py-4">
            <Prose source={result.correction} className={PROSE} />
          </div>
        </div>
      )}
      {failure && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {failure}
        </p>
      )}
      {open && question.expected ? (
        <Prose source={question.expected} className={PAPER} />
      ) : !question.expected ? (
        <p className="text-muted-foreground text-xs">
          No reference answer was published with this question.
        </p>
      ) : null}
    </div>
  );
}

export default function QuestionsTab({
  payload,
  error,
  deck,
  onDeckChange,
  onMistake,
  events,
  onEvent,
  ended,
  onEndedChange,
  onClearSession,
}: {
  payload: PracticePayload | null;
  error: string | null;
  deck: Set<string>;
  onDeckChange: (id: string) => void;
  onMistake: () => void;
  events: QuestionEvent[];
  onEvent: (event: QuestionEvent) => void;
  ended: boolean;
  onEndedChange: (ended: boolean) => void;
  onClearSession: () => void;
}) {
  const [courseId, setCourseId] = useState("all");
  const [chapterKey, setChapterKey] = useState("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [focus, setFocus] = useState<PracticeQuestion[] | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  const all = useMemo(() => payload?.questions ?? [], [payload]);
  const courses = useMemo(() => courseFacets(all), [all]);
  const chapters = useMemo(() => chapterFacets(all, courseId), [all, courseId]);
  const types = useMemo(() => typeFacets(all), [all]);
  const filtered = useMemo(
    () => filterQuestions(all, { courseId, chapterKey, type, query }),
    [all, courseId, chapterKey, type, query],
  );
  const visible = focus ?? filtered;
  const current = visible[currentIndex] ?? null;
  const summary = useMemo(() => summariseSession(events), [events]);
  const selectedCourse = courses.find((course) => course.id === courseId);
  const selectedChapter = chapters.find(
    (chapter) => chapter.key === chapterKey,
  );
  const selectedType =
    type === "all" ? "All types" : (typeLabel(type) ?? "All types");

  useEffect(() => {
    setCurrentIndex(0);
  }, [courseId, chapterKey, type, query, focus]);

  useEffect(() => {
    if (events.length > 0) setSetupOpen(false);
  }, [events.length]);

  if (error) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>The question bank could not be read</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!payload) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-20 w-full motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (ended) {
    return (
      <SessionLedger
        title="That is this session recorded"
        note="Every answer you had graded this session, by course. Nothing here is scheduled — take the misses again now, or leave them for the flashcard queue."
        unit="Answered"
        summary={summary}
        onRetryMissed={() => {
          setFocus(
            summary.missed
              .map((event) => event.item)
              .filter(Boolean) as PracticeQuestion[],
          );
          onEndedChange(false);
        }}
        onDone={() => {
          setFocus(null);
          onClearSession();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {focus ? (
        <div className="bg-background flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-5 py-4">
          <p className="text-sm">
            <span className={`font-semibold ${NUMERALS}`}>{focus.length}</span>{" "}
            missed {focus.length === 1 ? "question" : "questions"} from this
            session.
          </p>
          <Button variant="outline" size="sm" onClick={() => setFocus(null)}>
            Back to the full bank
          </Button>
        </div>
      ) : (
        <Collapsible
          open={setupOpen}
          onOpenChange={setSetupOpen}
          className="bg-background overflow-hidden rounded-[14px] border"
        >
          <div className="sm:hidden">
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  className="flex h-auto min-h-16 w-full items-center justify-between rounded-none px-4 py-3 text-left"
                />
              }
            >
              <span className="min-w-0">
                <span className="text-muted-foreground block text-[10px] font-semibold tracking-[0.1em] uppercase">
                  Session setup
                </span>
                <span className="mt-0.5 block truncate text-sm font-medium">
                  {selectedCourse?.code ?? "All courses"} ·{" "}
                  {selectedChapter
                    ? `Ch ${selectedChapter.chapterId}`
                    : "All chapters"}{" "}
                  · {selectedType}
                </span>
              </span>
              <span className="ml-4 flex shrink-0 items-center gap-2 text-sm font-semibold">
                <span className={NUMERALS}>{filtered.length}</span>
                <SlidersHorizontalIcon className="size-4" />
              </span>
            </CollapsibleTrigger>
          </div>
          <div className="hidden min-w-0 sm:grid sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid min-w-0 grid-cols-5">
              <SessionDatum
                label="Course"
                value={selectedCourse?.code ?? "All courses"}
                className="border-r"
              />
              <SessionDatum
                label="Chapter"
                value={
                  selectedChapter
                    ? `Ch ${selectedChapter.chapterId} · ${selectedChapter.chapterName}`
                    : "All chapters"
                }
                className="border-r"
              />
              <SessionDatum
                label="Type"
                value={selectedType}
                className="border-r"
              />
              <SessionDatum
                label="Search"
                value={query.trim() || "None"}
                className="border-r"
              />
              <SessionDatum label="Questions" value={`${filtered.length}`} />
            </div>
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  className="h-auto min-h-12 rounded-none border-t px-5 sm:border-t-0 sm:border-l"
                />
              }
            >
              <SlidersHorizontalIcon data-icon="inline-start" />
              {setupOpen ? "Close setup" : "Adjust setup"}
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2 border-t px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-[minmax(13rem,1fr)_13rem_15rem_11rem]">
              <div className="relative min-w-0">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search questions"
                  className="w-full pl-9"
                  aria-label="Search questions"
                />
              </div>

              <Select
                value={courseId}
                onValueChange={(value) => {
                  setCourseId(value ?? "all");
                  setChapterKey("all");
                }}
              >
                <SelectTrigger className="w-full" aria-label="Course">
                  <SelectValue>
                    {(value) => {
                      const course = courses.find(
                        (entry) => entry.id === value,
                      );
                      return course
                        ? `${course.code} · ${course.name || `${course.count} questions`}`
                        : `All courses · ${all.length}`;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">
                      All courses · {all.length}
                    </SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.code} ·{" "}
                        {course.name || `${course.count} questions`}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={chapterKey}
                onValueChange={(value) => setChapterKey(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Chapter">
                  <SelectValue>
                    {(value) => {
                      const chapter = chapters.find(
                        (entry) => entry.key === value,
                      );
                      return chapter
                        ? `Ch ${chapter.chapterId} · ${chapter.chapterName}`
                        : "All chapters";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All chapters</SelectItem>
                    {chapters.map((chapter) => (
                      <SelectItem key={chapter.key} value={chapter.key}>
                        {courseId === "all" ? `${chapter.courseCode} · ` : ""}Ch{" "}
                        {chapter.chapterId} · {chapter.chapterName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={type}
                onValueChange={(value) => setType(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Question type">
                  <SelectValue>
                    {(value) =>
                      value === "all"
                        ? "All types"
                        : (typeLabel(value) ?? "All types")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All types</SelectItem>
                    {types.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {!visible.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nothing matches</EmptyTitle>
            <EmptyDescription>
              {all.length} published questions sit outside this filter. Widen
              the course, chapter or type.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        current && (
          <section className="bg-background mx-auto flex w-full min-w-0 flex-col overflow-hidden rounded-[14px] border md:min-h-[calc(100dvh-282px)]">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-5 py-4 sm:px-8">
              <div className="min-w-0">
                <p className="font-data text-sm font-semibold tabular-nums">
                  {current.courseCode} · Chapter {current.chapterId}
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {current.chapterName}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={`/app/courses/${encodeURIComponent(current.courseId)}/${encodeURIComponent(String(current.chapterId))}`}
                  />
                }
              >
                Open chapter
              </Button>
            </div>

            <div className="flex-1 px-5 py-5 sm:px-8 sm:py-7 lg:px-12 lg:py-9">
              <QuestionCard
                key={questionKey(current)}
                question={current}
                inDeck={deck.has(current.id)}
                onDeckChange={onDeckChange}
                onMistake={onMistake}
                onEvent={onEvent}
              />
            </div>

            <div className="bg-background/95 z-10 flex flex-col gap-3 border-t px-5 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-8 md:sticky md:bottom-0">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentIndex((index) => Math.max(0, index - 1))
                  }
                  disabled={currentIndex === 0}
                >
                  <ChevronLeftIcon data-icon="inline-start" />
                  Previous
                </Button>
                <span className={`text-sm font-semibold ${NUMERALS}`}>
                  {currentIndex + 1} / {visible.length}
                </span>
                <Button
                  size="sm"
                  onClick={() =>
                    setCurrentIndex((index) =>
                      Math.min(visible.length - 1, index + 1),
                    )
                  }
                  disabled={currentIndex === visible.length - 1}
                >
                  Next
                  <ChevronRightIcon data-icon="inline-end" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCurrentIndex(Math.floor(Math.random() * visible.length))
                  }
                  disabled={visible.length < 2}
                >
                  <ShuffleIcon data-icon="inline-start" />
                  Shuffle
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEndedChange(true)}
                  disabled={!events.length}
                  title={
                    events.length
                      ? undefined
                      : "Nothing has been graded this session yet."
                  }
                >
                  End session
                </Button>
              </div>
            </div>
          </section>
        )
      )}
    </div>
  );
}
