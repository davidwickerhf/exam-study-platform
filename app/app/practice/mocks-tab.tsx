"use client";

/**
 * Timed mocks: set one up, sit it against a clock, then read the log.
 *
 * Grading is `gradeMockAnswers` in lib/workspace/practice.mjs — three answers
 * in flight at a time instead of a serial walk, with the same per-question
 * policy (an unanswered question is never sent and scores zero; a failed
 * request scores zero and says so, rather than losing the sitting). The count
 * it reports is on screen while it runs, because a twenty-question sitting is
 * not an instant.
 */

import { useEffect, useState } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  type MockSession,
  type PracticeQuestion,
  buildMockSession,
  chapterFacets,
  courseFacets,
  gradeMockAnswers,
  gradeRequest,
  mockMinutes,
  mockPercent,
  mockRemaining,
  mockTimeLabel,
  sampleQuestions,
} from "@/lib/workspace/practice.mjs";
import type { StudyCourse } from "@/lib/workspace/courses.mjs";
import {
  COLUMN_LABEL,
  Choices,
  NUMERALS,
  PAPER,
  PROSE,
  Prose,
  SectionHead,
  TypeLine,
  api,
} from "./shared";

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

export default function MocksTab({
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
  const [courseId, setCourseId] = useState("");
  const [chapterKey, setChapterKey] = useState("");
  const [count, setCount] = useState("5");
  const [minutes, setMinutes] = useState("15");
  const [run, setRun] = useState<Run | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
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
    setProgress({ completed: 0, total: active.questions.length });
    setFailure(null);
    const course = courses.find((item) => item.id === active.courseId);
    const chapter = course?.chapters?.find(
      (item) => item.id === active.chapterId,
    );
    try {
      const graded = await gradeMockAnswers(
        active.questions,
        active.answers,
        (question, attempt) =>
          api<{ correction: string; score: number | null }>("/api/grade", {
            method: "POST",
            body: JSON.stringify(
              gradeRequest(
                question,
                attempt,
                course?.code ?? active.courseId,
                chapter?.name ?? "Mock",
              ),
            ),
          }),
        { onProgress: setProgress },
      );
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
    } finally {
      setProgress(null);
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
      history.replaceState(
        null,
        "",
        `/app/practice?tab=mocks&session=${encodeURIComponent(session.id)}`,
      );
    } catch (cause) {
      setFailure((cause as Error).message);
    }
  };

  useEffect(() => {
    if (!initialSessionId || selected || !sessions) return;
    void openReview(
      (sessions.find((session) => session.id === initialSessionId) ?? {
        id: initialSessionId,
      }) as MockSession,
    );
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

  if (!sessions)
    return <Skeleton className="h-48 w-full motion-reduce:animate-none" />;

  if (run) {
    const question = run.questions[run.index];
    const grading = run.phase === "grading";
    return (
      <div className="flex w-full max-w-[74ch] flex-col gap-5">
        <div className="flex items-center justify-between gap-3 border-b pb-3">
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
          aria-label="Your answer"
          disabled={grading}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={run.index === 0 || grading}
              onClick={() => setRun({ ...run, index: run.index - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={run.index === run.questions.length - 1 || grading}
              onClick={() => setRun({ ...run, index: run.index + 1 })}
            >
              Next
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1 sm:flex-none"
              disabled={grading}
              onClick={() => {
                if (window.confirm("Abandon this mock? Answers will be lost."))
                  setRun(null);
              }}
            >
              Abandon
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              disabled={grading}
              onClick={() => {
                if (window.confirm("Submit your mock for grading?"))
                  void submit(run);
              }}
            >
              {grading ? "Grading…" : "Submit mock"}
            </Button>
          </div>
        </div>
        {grading && (
          <p
            role="status"
            aria-live="polite"
            className={`text-muted-foreground border-t pt-3 text-sm ${NUMERALS}`}
          >
            Graded {progress?.completed ?? 0} of{" "}
            {progress?.total ?? run.questions.length} answers.
          </p>
        )}
        {failure && (
          <p role="alert" className="text-destructive text-sm font-medium">
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
          size="sm"
          className="self-start"
          onClick={() => {
            setSelected(null);
            history.replaceState(null, "", "/app/practice?tab=mocks");
          }}
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
              className="flex min-w-0 max-w-[80ch] flex-col gap-3 border-b py-4"
            >
              <strong className={NUMERALS}>
                Question {index + 1} · {question.score ?? "—"}/10
              </strong>
              <Prose source={question.question} className={PROSE} />
              <div className="flex flex-col gap-1.5">
                <span className={COLUMN_LABEL}>Your answer</span>
                <pre className="bg-card overflow-x-auto rounded-sm p-3 text-[13.5px] whitespace-pre-wrap">
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
      <section className="grid gap-3 border-b pb-6 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <Select
          value={courseId}
          onValueChange={(value) => {
            setCourseId(value ?? "");
            setChapterKey("");
          }}
        >
          <SelectTrigger className="w-full" aria-label="Mock course">
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
          <SelectTrigger className="w-full" aria-label="Mock chapter">
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
        <Button
          onClick={start}
          disabled={!chapterKey}
          title={chapterKey ? undefined : "Choose a course and chapter first."}
        >
          Start timed mock
        </Button>
      </section>
      {failure && (
        <p role="alert" className="text-destructive text-sm font-medium">
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
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[44rem]">
            <thead>
              <tr className={COLUMN_LABEL}>
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
                const length = mockMinutes(session.duration);
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
                        <span className="text-muted-foreground">
                          Not scored
                        </span>
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
                      {length === null ? (
                        <span className="text-muted-foreground">Not timed</span>
                      ) : (
                        `${length} min`
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
        </div>
      )}
    </div>
  );
}
