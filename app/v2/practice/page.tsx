"use client";

/**
 * Practice, migrated.
 *
 * The vanilla surface was four pages behind one tab bar, and only one of them
 * — the question queue — was ever really finished. What has moved here is what
 * can move honestly: browsing and filtering the published bank with its
 * reference answers, and the flashcard review loop, which is a complete
 * feature on its own. The mistake bank lists; the mock log lists.
 *
 * What has not moved is stated on the tab rather than implied by an empty
 * list. Writing an attempt and having it graded is a five-endpoint pipeline
 * with per-question local attempt state, and the timed mock runner is a
 * stateful clock over a batch submission; both still run in the previous
 * workspace, unchanged, and are linked from where they used to be.
 *
 * Question and reference answer are course material, not chat: they are dense
 * with LaTeX, so they go through the same remark/rehype pipeline the chapter
 * reader uses, and a revealed answer is laid on the board as a punched paper
 * window like every other thing that is read rather than scanned.
 */

import "katex/dist/katex.min.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  ShuffleIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OnboardingResume } from "@/components/v2/onboarding-resume";
import {
  type Mistake,
  type MockSession,
  type PracticePayload,
  type PracticeQuestion,
  type SrDue,
  type SrPayload,
  SR_QUALITIES,
  agoLabel,
  buildMockSession,
  cardLine,
  chapterFacets,
  courseFacets,
  difficultyLabel,
  filterQuestions,
  gradeRequest,
  groupMistakes,
  mockMinutes,
  mockPercent,
  mockRemaining,
  mockTimeLabel,
  questionKey,
  practiceLocation,
  sampleQuestions,
  typeFacets,
  typeLabel,
  usableOptions,
} from "@/lib/v2/practice.mjs";
import type { StudyCourse } from "@/lib/v2/courses.mjs";

const NUMERALS = "font-data tabular-nums";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const data = (await response.json().catch(() => null)) as
    (T & { error?: string }) | null;
  if (!response.ok)
    throw new Error(data?.error || `That request answered ${response.status}.`);
  return data as T;
}

/** Prose on the board: a question, an attempt, a correction. */
const PROSE = [
  "text-[15px] leading-[1.7]",
  "[&>*+*]:mt-3",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1",
  "[&_strong]:font-semibold",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:bg-card [&_code]:rounded-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px]",
  "[&_pre]:bg-card [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:p-3 [&_pre]:text-[13px]",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:w-full [&_table]:text-sm",
  "[&_th]:border-b [&_th]:py-1.5 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border-b [&_td]:py-1.5 [&_td]:pr-4 [&_td]:align-top",
  "[&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1",
].join(" ");

/** The punched paper window — the one place the ink inverts. */
const PAPER = [
  "bg-paper text-paper-ink rounded-sm px-5 py-4 shadow-lg",
  "text-[14.5px] leading-relaxed",
  "[&>*+*]:mt-3",
  "[&_a]:text-paper-link [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:bg-paper-subtle [&_code]:rounded-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px]",
  "[&_pre]:bg-paper-subtle [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:p-3 [&_pre]:text-[13px]",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1",
  "[&_strong]:font-semibold",
  "[&_table]:w-full [&_table]:text-sm",
  "[&_th]:border-paper-subtle [&_th]:border-b [&_th]:py-1.5 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border-paper-subtle [&_td]:border-b [&_td]:py-1.5 [&_td]:pr-4 [&_td]:align-top",
  "[&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1",
].join(" ");

function Prose({
  source,
  className,
  inline,
}: {
  source?: string | null;
  className?: string;
  inline?: boolean;
}) {
  if (!source) return null;
  return (
    <div className={className}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        // A multiple-choice option is one line inside a list item, so it keeps
        // the maths and the emphasis but not the paragraph around them.
        components={
          inline ? { p: ({ children }) => <>{children}</> } : undefined
        }
      >
        {source}
      </Markdown>
    </div>
  );
}

function SectionHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {meta && (
        <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
          {meta}
        </span>
      )}
    </div>
  );
}

function TypeLine({ question }: { question: PracticeQuestion }) {
  const type = typeLabel(question.type);
  const rest = [difficultyLabel(question), question.source]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {type && <Badge variant="secondary">{type}</Badge>}
      {rest && <span className="text-muted-foreground text-xs">{rest}</span>}
    </div>
  );
}

function Choices({ question }: { question: PracticeQuestion }) {
  const options = usableOptions(question);
  if (!options.length) return null;
  return (
    <ol className="flex list-[lower-alpha] flex-col gap-1 pl-5 text-[15px] leading-snug">
      {options.map((option, index) => (
        <li key={`${index}-${option}`}>
          <Prose
            source={option}
            inline
            className="[&_code]:bg-card [&_code]:rounded-xs [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]"
          />
        </li>
      ))}
    </ol>
  );
}

/* ── Questions ─────────────────────────────────────────────────────────── */

function QuestionRow({
  question,
  position,
  inDeck,
  onDeckChange,
  onMistake,
  onAnswered,
}: {
  question: PracticeQuestion;
  position: number;
  inDeck: boolean;
  onDeckChange: (id: string) => void;
  onMistake: () => void;
  onAnswered: () => void;
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
      onAnswered();
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
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-4 border-b py-4">
      <span
        className={`text-muted-foreground pt-0.5 text-sm font-semibold ${NUMERALS}`}
      >
        {position}
      </span>
      {/* Measure, not width: a reference answer is read, so it stops at a line length. */}
      <div className="flex min-w-0 max-w-[80ch] flex-col gap-3">
        <TypeLine question={question} />
        <Prose source={question.question} className={PROSE} />
        <Choices question={question} />
        <div className="flex flex-col gap-2">
          <Textarea
            value={attempt}
            onChange={(event) => setAttempt(event.target.value)}
            placeholder="Write your answer…"
            aria-label="Your answer"
            disabled={busy}
          />
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              size="sm"
              onClick={() => void grade()}
              disabled={busy || !attempt.trim()}
            >
              {busy ? "Checking…" : "Check answer"}
            </Button>
            <Button
              size="sm"
              variant="outline"
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
              className="ml-auto"
              onClick={() => {
                setAttempt("");
                setResult(null);
                setFailure(null);
              }}
              disabled={!attempt && !result}
            >
              Clear answer
            </Button>
          </div>
        </div>
        {result && (
          <div className="flex flex-col gap-2">
            <strong className={`text-sm ${NUMERALS}`}>
              {result.score === null ? "Not scored" : `${result.score}/10`}
            </strong>
            <Prose source={result.correction} className={PAPER} />
          </div>
        )}
        {failure && (
          <p role="alert" className="text-destructive text-sm font-medium">
            {failure}
          </p>
        )}
        {question.expected ? (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
              <ChevronDownIcon
                data-icon="inline-start"
                className={open ? "rotate-180" : ""}
              />
              {open ? "Hide reference answer" : "Reference answer"}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              {open && <Prose source={question.expected} className={PAPER} />}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p className="text-muted-foreground text-xs">
            No reference answer was published with this question.
          </p>
        )}
      </div>
    </li>
  );
}

function QuestionsTab({
  payload,
  error,
  deck,
  onDeckChange,
  onMistake,
}: {
  payload: PracticePayload | null;
  error: string | null;
  deck: Set<string>;
  onDeckChange: (id: string) => void;
  onMistake: () => void;
}) {
  const [courseId, setCourseId] = useState("all");
  const [chapterKey, setChapterKey] = useState("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answered, setAnswered] = useState(0);

  const all = payload?.questions ?? [];
  const courses = useMemo(() => courseFacets(all), [all]);
  const chapters = useMemo(() => chapterFacets(all, courseId), [all, courseId]);
  const types = useMemo(() => typeFacets(all), [all]);
  const visible = useMemo(
    () => filterQuestions(all, { courseId, chapterKey, type, query }),
    [all, courseId, chapterKey, type, query],
  );
  const current = visible[currentIndex] ?? null;

  useEffect(() => {
    setCurrentIndex(0);
  }, [courseId, chapterKey, type, query]);

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
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-8 border-b pb-8 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-end">
        <div>
          <h2 className="font-heading text-5xl leading-none tracking-tighter sm:text-6xl">One queue. Every active course.</h2>
          <p className="text-muted-foreground mt-3 max-w-[72ch] text-sm leading-relaxed">Choose a course or work through the complete question bank. Your filters stay in place as you move through the queue.</p>
        </div>
        <div className="border-l pl-6">
          <strong className={`block text-3xl ${NUMERALS}`}>{answered}</strong>
          <span className="text-muted-foreground text-sm">answered this session</span>
          <span className={`text-muted-foreground mt-2 block text-sm ${NUMERALS}`}>{visible.length} available</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            value={[courseId]}
            onValueChange={(value) => {
              const next = value.at(-1);
              if (next) {
                setCourseId(next);
                setChapterKey("all");
              }
            }}
            variant="outline"
          >
            <ToggleGroupItem value="all" className="gap-1.5">
              All
              <span className={`text-muted-foreground ${NUMERALS}`}>
                {all.length}
              </span>
            </ToggleGroupItem>
            {courses.map((course) => (
              <ToggleGroupItem
                key={course.id}
                value={course.id}
                className="gap-1.5"
                aria-label={course.name}
              >
                <span className="size-2 rounded-full bg-primary/70" aria-hidden="true" />
                <span className={NUMERALS}>{course.code}</span>
                <span className={`text-muted-foreground ${NUMERALS}`}>
                  {course.count}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Select
            value={chapterKey}
            onValueChange={(value) => setChapterKey(value ?? "all")}
          >
            <SelectTrigger className="w-[260px]" aria-label="Chapter">
              <SelectValue>
                {(value) => {
                  const chapter = chapters.find((entry) => entry.key === value);
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
            <SelectTrigger className="w-[150px]" aria-label="Question type">
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

          <div className="relative min-w-[200px] flex-1">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search questions"
              className="pl-9"
              aria-label="Search questions"
            />
          </div>
        </div>
      </div>

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
          <section className="mx-auto flex w-full max-w-[980px] flex-col overflow-hidden rounded-sm border bg-card">
            <div className="flex flex-col gap-3 border-b bg-muted/35 px-5 py-4 sm:px-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-data text-sm font-semibold tabular-nums">
                    {current.courseCode} · Chapter {current.chapterId}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {current.chapterName}
                  </p>
                </div>
                <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/v2/courses/${encodeURIComponent(current.courseId)}/${encodeURIComponent(String(current.chapterId))}`} />}>
                  Open chapter
                </Button>
                <span className={`text-sm font-semibold ${NUMERALS}`}>
                  {currentIndex + 1} / {visible.length}
                </span>
              </div>
              <Progress value={((currentIndex + 1) / visible.length) * 100} className="h-1" />
            </div>

            <ol className="px-5 sm:px-7 [&>li]:border-b-0 [&>li]:py-7">
              <QuestionRow
                key={questionKey(current)}
                question={current}
                position={currentIndex + 1}
                inDeck={deck.has(current.id)}
                onDeckChange={onDeckChange}
                onMistake={onMistake}
                onAnswered={() => setAnswered((count) => count + 1)}
              />
            </ol>

            <div className="flex items-center justify-between gap-3 border-t bg-muted/35 px-5 py-4 sm:px-7">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeftIcon data-icon="inline-start" />
                Previous
              </Button>
              <div className="flex items-center gap-3">
                <span className={`text-muted-foreground hidden text-sm sm:inline ${NUMERALS}`}>{currentIndex + 1} / {visible.length}</span>
                <Button variant="outline" onClick={() => setCurrentIndex(Math.floor(Math.random() * visible.length))}>
                  <ShuffleIcon data-icon="inline-start" />
                  Shuffle
                </Button>
              </div>
              <Button
                onClick={() => setCurrentIndex((index) => Math.min(visible.length - 1, index + 1))}
                disabled={currentIndex === visible.length - 1}
              >
                Next
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </section>
        )
      )}
    </div>
  );
}

/* ── Flashcards ────────────────────────────────────────────────────────── */

function FlashcardsTab({
  payload,
  error,
  codeOf,
  onReviewed,
  onRemoved,
}: {
  payload: SrPayload | null;
  error: string | null;
  codeOf: (courseId: string) => string;
  onReviewed: () => void;
  onRemoved: (id: string) => void;
}) {
  const [queue, setQueue] = useState<SrDue[]>([]);
  const [reveal, setReveal] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    setQueue(payload?.due ?? []);
    setReveal(false);
    setReviewed(0);
  }, [payload]);

  const current = queue[0] ?? null;

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
      setQueue((rest) => rest.slice(1));
      setReviewed((count) => count + 1);
      setReveal(false);
      onReviewed();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    setQueue((rest) => (rest.length > 1 ? [...rest.slice(1), rest[0]] : rest));
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
      setQueue((rest) => rest.slice(1));
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

  if (!payload) return <Skeleton className="h-64 w-full" />;

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
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            {reviewed
              ? "That is the queue cleared"
              : "Nothing is due right now"}
          </EmptyTitle>
          <EmptyDescription>
            {reviewed
              ? `${reviewed} card${reviewed === 1 ? "" : "s"} reviewed. SM-2 has scheduled each one; ${payload.totalCards} card${payload.totalCards === 1 ? "" : "s"} remain in the deck.`
              : `${payload.totalCards} card${payload.totalCards === 1 ? "" : "s"} in the deck, none of them due.`}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex max-w-[74ch] flex-col gap-5">
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

      <TypeLine question={current.question} />
      <Prose source={current.question.question} className={PROSE} />
      <Choices question={current.question} />

      {reveal ? (
        <>
          <Prose source={current.question.expected} className={PAPER} />
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">
              How well did you recall it?
            </p>
            <div className="flex flex-wrap gap-2">
              {SR_QUALITIES.map((quality) => (
                <Button
                  key={quality.value}
                  variant="outline"
                  size="lg"
                  disabled={busy}
                  onClick={() => rate(quality.value)}
                  title={quality.hint}
                >
                  <span className={`font-semibold ${NUMERALS}`}>
                    {quality.value}
                  </span>
                  <span className="text-muted-foreground">{quality.label}</span>
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
        <div className="flex items-center gap-2">
          <Button onClick={() => setReveal(true)}>Show answer</Button>
          <Button variant="ghost" onClick={skip} disabled={queue.length < 2}>
            Skip for now
          </Button>
        </div>
      )}

      {failure && (
        <p className="text-destructive text-sm font-medium">{failure}</p>
      )}
    </div>
  );
}

/* ── Mistakes ──────────────────────────────────────────────────────────── */

function MistakesTab({
  mistakes,
  error,
  courses,
  onChanged,
  onDeckChange,
}: {
  mistakes: Mistake[] | null;
  error: string | null;
  courses: StudyCourse[];
  onChanged: (mistakes: Mistake[]) => void;
  onDeckChange: (id: string) => void;
}) {
  const groups = useMemo(() => groupMistakes(mistakes ?? []), [mistakes]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [results, setResults] = useState<
    Record<string, { correction: string; score: number | null }>
  >({});
  const [failure, setFailure] = useState<string | null>(null);

  const remove = async (mistake: Mistake, resolve: boolean) => {
    if (!mistakes) return;
    if (!resolve && !window.confirm("Delete this mistake from the bank?"))
      return;
    setRetrying(mistake.id);
    setFailure(null);
    try {
      await api(
        `/api/mistakes/${encodeURIComponent(mistake.id)}${resolve ? "/resolve" : ""}`,
        { method: resolve ? "POST" : "DELETE" },
      );
      onChanged(mistakes.filter((item) => item.id !== mistake.id));
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setRetrying(null);
    }
  };

  const retry = async (mistake: Mistake) => {
    const attempt = drafts[mistake.id]?.trim();
    if (!attempt) return;
    const course = courses.find((entry) => entry.id === mistake.courseId);
    const chapter = course?.chapters?.find(
      (entry) => entry.id === mistake.chapterId,
    );
    setRetrying(mistake.id);
    setFailure(null);
    try {
      const data = await api<{ correction: string; score: number | null }>(
        "/api/grade",
        {
          method: "POST",
          body: JSON.stringify(
            gradeRequest(
              mistake as PracticeQuestion,
              attempt,
              course?.code ?? mistake.courseId ?? "",
              chapter?.name ?? "Practice",
            ),
          ),
        },
      );
      setResults((current) => ({ ...current, [mistake.id]: data }));
      if (mistake.questionId) onDeckChange(mistake.questionId);
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setRetrying(null);
    }
  };

  if (error) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>The mistake bank could not be read</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!mistakes) return <Skeleton className="h-48 w-full" />;

  if (!mistakes.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No open mistakes</EmptyTitle>
          <EmptyDescription>
            An attempt filed here is one that a grader scored below 7 out of 10.
            Grading has not moved to this workspace yet, so nothing new will
            land here until it does — and anything you resolve over there
            disappears from this list too.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {failure && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {failure}
        </p>
      )}
      {groups.map((group) => {
        const course = courses.find((entry) => entry.id === group.courseId);
        const chapter = course?.chapters?.find(
          (entry) => entry.id === group.chapterId,
        );
        const title = [
          course?.code ?? group.courseId ?? "Unknown course",
          chapter
            ? `Ch ${chapter.id} · ${chapter.name}`
            : group.chapterId
              ? `Ch ${group.chapterId}`
              : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <section key={group.key} className="flex flex-col gap-1">
            <SectionHead title={title} meta={`${group.items.length}`} />
            <ul className="flex flex-col">
              {group.items.map((mistake) => (
                <li
                  key={mistake.id}
                  className="flex max-w-[80ch] flex-col gap-3 border-b py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {typeLabel(mistake.type) && (
                      <Badge variant="secondary">
                        {typeLabel(mistake.type)}
                      </Badge>
                    )}
                    <span className={`text-sm font-semibold ${NUMERALS}`}>
                      {mistake.score ?? "—"}
                      <small className="text-muted-foreground">/10</small>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {[
                        difficultyLabel(mistake),
                        mistake.source,
                        agoLabel(mistake.createdAt),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <Prose source={mistake.question} className={PROSE} />
                  {mistake.attempt && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">
                        What you wrote
                      </span>
                      <pre className="bg-card overflow-x-auto rounded-sm p-3 text-[13px] whitespace-pre-wrap">
                        {mistake.attempt}
                      </pre>
                    </div>
                  )}
                  {mistake.correction && (
                    <Prose source={mistake.correction} className={PAPER} />
                  )}
                  <div className="flex flex-col gap-2 border-t pt-3">
                    <Textarea
                      value={drafts[mistake.id] ?? ""}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [mistake.id]: event.target.value,
                        }))
                      }
                      placeholder="Retry this question…"
                      aria-label="Retry answer"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void retry(mistake)}
                        disabled={
                          retrying === mistake.id || !drafts[mistake.id]?.trim()
                        }
                      >
                        Check retry
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void remove(mistake, true)}
                        disabled={retrying === mistake.id}
                      >
                        <CheckIcon data-icon="inline-start" />
                        Mark resolved
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void remove(mistake, false)}
                        disabled={retrying === mistake.id}
                      >
                        <Trash2Icon data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                    {results[mistake.id] && (
                      <>
                        <strong className={`text-sm ${NUMERALS}`}>
                          {results[mistake.id].score ?? "—"}/10
                        </strong>
                        <Prose
                          source={results[mistake.id].correction}
                          className={PAPER}
                        />
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ── Mocks ─────────────────────────────────────────────────────────────── */

function MocksTab({
  sessions,
  error,
  courses,
  bank,
  onChanged,
  initialSessionId,
}: {
  sessions: MockSession[] | null;
  error: string | null;
  courses: StudyCourse[];
  bank: PracticeQuestion[];
  onChanged: (sessions: MockSession[]) => void;
  initialSessionId: string | null;
}) {
  type Run = {
    courseId: string;
    chapterId: string;
    questions: PracticeQuestion[];
    answers: Record<string, string>;
    index: number;
    startedAt: number;
    minutes: number;
    token: string;
    phase: "taking" | "grading";
  };
  const [courseId, setCourseId] = useState("");
  const [chapterKey, setChapterKey] = useState("");
  const [count, setCount] = useState("5");
  const [minutes, setMinutes] = useState("15");
  const [run, setRun] = useState<Run | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [selected, setSelected] = useState<MockSession | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const availableCourses = courseFacets(bank);
  const availableChapters = chapterFacets(bank, courseId || "all");

  useEffect(() => {
    if (!run || run.phase !== "taking") return;
    const tick = () => setRemaining(mockRemaining(run.startedAt, run.minutes));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [run]);

  const submit = async (active: Run) => {
    if (active.phase === "grading") return;
    setRun({ ...active, phase: "grading" });
    setFailure(null);
    const course = courses.find((item) => item.id === active.courseId);
    const chapter = course?.chapters?.find(
      (item) => item.id === active.chapterId,
    );
    try {
      const graded = [];
      for (const question of active.questions) {
        const attempt = active.answers[question.id]?.trim() ?? "";
        if (!attempt) {
          graded.push({
            ...question,
            attempt: "",
            correction: "_No answer provided._",
            score: 0,
          });
          continue;
        }
        try {
          const result = await api<{
            correction: string;
            score: number | null;
          }>("/api/grade", {
            method: "POST",
            body: JSON.stringify(
              gradeRequest(
                question,
                attempt,
                course?.code ?? active.courseId,
                chapter?.name ?? "Mock",
              ),
            ),
          });
          graded.push({
            ...question,
            attempt,
            correction: result.correction,
            score: result.score ?? 0,
          });
        } catch (cause) {
          graded.push({
            ...question,
            attempt,
            correction: `_Grading failed: ${(cause as Error).message}_`,
            score: 0,
          });
        }
      }
      const session = buildMockSession(
        active,
        graded,
      ) as unknown as MockSession;
      const saved = await api<MockSession>("/api/mocks", {
        method: "POST",
        body: JSON.stringify(session),
      });
      onChanged([saved, ...(sessions ?? [])]);
      setSelected(saved);
      setRun(null);
    } catch (cause) {
      setFailure((cause as Error).message);
      setRun({ ...active, phase: "taking" });
    }
  };

  useEffect(() => {
    if (run?.phase === "taking" && remaining === 0) void submit(run);
    // Submission is triggered only by the countdown edge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const start = () => {
    const [selectedCourse, selectedChapter] = chapterKey.split("/");
    const questions = bank.filter(
      (question) =>
        question.courseId === selectedCourse &&
        question.chapterId === selectedChapter,
    );
    if (!questions.length) return;
    const next: Run = {
      courseId: selectedCourse,
      chapterId: selectedChapter,
      questions: sampleQuestions(questions, Number(count)),
      answers: {},
      index: 0,
      startedAt: Date.now(),
      minutes: Math.max(1, Number(minutes) || 15),
      token: Math.random().toString(36).slice(2, 8),
      phase: "taking",
    };
    setRemaining(mockRemaining(next.startedAt, next.minutes));
    setRun(next);
    setSelected(null);
  };

  const openReview = async (session: MockSession) => {
    setFailure(null);
    try {
      setSelected(
        await api<MockSession>(`/api/mocks/${encodeURIComponent(session.id)}`),
      );
      history.replaceState(null, "", `/v2/practice?tab=mocks&session=${encodeURIComponent(session.id)}`);
    } catch (cause) {
      setFailure((cause as Error).message);
    }
  };

  useEffect(() => {
    if (!initialSessionId || selected || !sessions) return;
    void openReview((sessions.find((session) => session.id === initialSessionId) ?? { id: initialSessionId }) as MockSession);
    // Open the URL-addressed review once the session log is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId, sessions]);

  if (error) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Your mock log could not be read</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!sessions) return <Skeleton className="h-48 w-full" />;

  if (run) {
    const question = run.questions[run.index];
    return (
      <div className="flex max-w-[74ch] flex-col gap-5">
        <div className="flex items-center justify-between border-b pb-3">
          <strong className={NUMERALS}>
            Question {run.index + 1} / {run.questions.length}
          </strong>
          <strong className={`text-2xl ${NUMERALS}`}>
            {mockTimeLabel(remaining)}
          </strong>
        </div>
        <TypeLine question={question} />
        <Prose source={question.question} className={PROSE} />
        <Choices question={question} />
        <Textarea
          value={run.answers[question.id] ?? ""}
          onChange={(event) =>
            setRun((current) =>
              current
                ? {
                    ...current,
                    answers: {
                      ...current.answers,
                      [question.id]: event.target.value,
                    },
                  }
                : current,
            )
          }
          placeholder="Write your answer…"
          disabled={run.phase === "grading"}
        />
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={run.index === 0 || run.phase === "grading"}
              onClick={() => setRun({ ...run, index: run.index - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={
                run.index === run.questions.length - 1 ||
                run.phase === "grading"
              }
              onClick={() => setRun({ ...run, index: run.index + 1 })}
            >
              Next
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={run.phase === "grading"}
              onClick={() => {
                if (window.confirm("Abandon this mock? Answers will be lost."))
                  setRun(null);
              }}
            >
              Abandon
            </Button>
            <Button
              disabled={run.phase === "grading"}
              onClick={() => {
                if (window.confirm("Submit your mock for grading?"))
                  void submit(run);
              }}
            >
              {run.phase === "grading" ? "Grading…" : "Submit mock"}
            </Button>
          </div>
        </div>
        {failure && (
          <p role="alert" className="text-destructive text-sm">
            {failure}
          </p>
        )}
      </div>
    );
  }

  if (selected?.questions) {
    return (
      <div className="flex flex-col gap-5">
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => { setSelected(null); history.replaceState(null, "", "/v2/practice?tab=mocks"); }}
        >
          Back to mock log
        </Button>
        <SectionHead
          title={`${courses.find((item) => item.id === selected.courseId)?.code ?? selected.courseId} · Mock review`}
          meta={
            mockPercent(selected) === null
              ? "Not scored"
              : `${mockPercent(selected)}%`
          }
        />
        <ol className="flex flex-col">
          {selected.questions.map((question, index) => (
            <li
              key={`${question.id}-${index}`}
              className="flex max-w-[80ch] flex-col gap-3 border-b py-4"
            >
              <strong className={NUMERALS}>
                Question {index + 1} · {question.score ?? "—"}/10
              </strong>
              <Prose source={question.question} className={PROSE} />
              <div>
                <span className="text-muted-foreground text-xs font-semibold">
                  Your answer
                </span>
                <pre className="bg-card mt-1 whitespace-pre-wrap p-3 text-sm">
                  {question.attempt || "No answer provided."}
                </pre>
              </div>
              <Prose source={question.correction} className={PAPER} />
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-card grid gap-3 rounded-sm border p-4 sm:grid-cols-4 sm:items-end">
        <Select
          value={courseId}
          onValueChange={(value) => {
            setCourseId(value ?? "");
            setChapterKey("");
          }}
        >
          <SelectTrigger aria-label="Mock course">
            <SelectValue>
              {(value) =>
                availableCourses.find((item) => item.id === value)?.code ??
                "Course"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {availableCourses.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.code}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={chapterKey}
          onValueChange={(value) => setChapterKey(value ?? "")}
        >
          <SelectTrigger aria-label="Mock chapter">
            <SelectValue>
              {(value) => {
                const item = availableChapters.find(
                  (entry) => entry.key === value,
                );
                return item
                  ? `Ch ${item.chapterId} · ${item.chapterName}`
                  : "Chapter";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {availableChapters.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  Ch {item.chapterId} · {item.chapterName}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Questions
            <Input
              aria-label="Question count"
              type="number"
              min="1"
              max="30"
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Minutes
            <Input
              aria-label="Minutes"
              type="number"
              min="1"
              max="180"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </label>
        </div>
        <Button onClick={start} disabled={!chapterKey}>
          Start timed mock
        </Button>
      </section>
      {failure && (
        <p role="alert" className="text-destructive text-sm">
          {failure}
        </p>
      )}
      {!sessions.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No sessions yet</EmptyTitle>
            <EmptyDescription>
              Choose a course and chapter above to sit a timed mock from its
              published questions.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">
              <th className="w-[10rem] py-2 pr-4 text-left font-semibold">
                Sat
              </th>
              <th className="py-2 pr-6 text-left font-semibold">Course</th>
              <th className="w-[5rem] py-2 pr-4 text-right font-semibold">
                Qs
              </th>
              <th className="w-[8rem] py-2 pr-4 text-right font-semibold">
                Score
              </th>
              <th className="w-[6rem] py-2 pr-4 text-right font-semibold">
                Length
              </th>
              <th className="w-[5rem] py-2 text-left font-semibold" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => {
              const course = courses.find(
                (entry) => entry.id === session.courseId,
              );
              const chapter = course?.chapters?.find(
                (entry) => entry.id === session.chapterId,
              );
              const percent = mockPercent(session);
              const minutes = mockMinutes(session.duration);
              return (
                <tr key={session.id} className="hover:bg-card border-b">
                  <td className={`py-2 pr-4 text-sm ${NUMERALS}`}>
                    {session.submittedAt
                      ? new Intl.DateTimeFormat("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hourCycle: "h23",
                        }).format(new Date(session.submittedAt))
                      : "Not submitted"}
                  </td>
                  <td className="py-2 pr-6 text-[15px]">
                    <strong className={`font-semibold ${NUMERALS}`}>
                      {course?.code ?? session.courseId}
                    </strong>
                    {chapter && (
                      <span className="text-muted-foreground">
                        {" "}
                        · Ch {chapter.id} · {chapter.name}
                      </span>
                    )}
                  </td>
                  <td className={`py-2 pr-4 text-right text-sm ${NUMERALS}`}>
                    {session.count}
                  </td>
                  <td className={`py-2 pr-4 text-right text-sm ${NUMERALS}`}>
                    {percent === null ? (
                      <span className="text-muted-foreground">Not scored</span>
                    ) : (
                      <>
                        <strong className="font-semibold">{percent}%</strong>
                        <small className="text-muted-foreground ml-1.5">
                          {session.totalScore}/{session.totalMax}
                        </small>
                      </>
                    )}
                  </td>
                  <td className={`py-2 pr-4 text-right text-sm ${NUMERALS}`}>
                    {minutes === null ? (
                      <span className="text-muted-foreground">Not timed</span>
                    ) : (
                      `${minutes} min`
                    )}
                  </td>
                  <td className="py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void openReview(session)}
                    >
                      Review
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

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

  useEffect(() => {
    let live = true;
    const search = new URLSearchParams(window.location.search);
    const location = practiceLocation(`/practice/${search.get("tab") ?? "questions"}${search.get("session") ? `/${encodeURIComponent(search.get("session")!)}` : ""}`);
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

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-6 sm:p-8">
      <header className="flex flex-col gap-1 border-b pb-4">
        <h1 className="font-heading text-5xl leading-none tracking-tight">
          Practice
        </h1>
        <p className="text-muted-foreground text-sm">Choose a question, answer it, then move on.</p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          history.replaceState(null, "", `/v2/practice?tab=${value}`);
        }}
        className="gap-6"
      >
        <TabsList
          variant="line"
          className="max-w-full justify-start overflow-x-auto"
        >
          <TabsTrigger value="questions">
            Questions
            {practice && (
              <span className={`text-muted-foreground ${NUMERALS}`}>
                {practice.questions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="flashcards">
            Flashcards
            {dueCount > 0 && (
              <span className={`text-muted-foreground ${NUMERALS}`}>
                {dueCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="mistakes">
            Mistakes
            {openMistakes > 0 && (
              <span className={`text-muted-foreground ${NUMERALS}`}>
                {openMistakes}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="mocks">Mocks</TabsTrigger>
        </TabsList>

        <TabsContent value="questions">
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
          />
        </TabsContent>

        <TabsContent value="flashcards">
          <FlashcardsTab
            payload={sr}
            error={srError}
            codeOf={codeOf}
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

        <TabsContent value="mistakes">
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

        <TabsContent value="mocks">
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
