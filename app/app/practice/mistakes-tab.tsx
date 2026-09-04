"use client";

/**
 * The mistake bank: everything a grader scored below 7 out of 10, grouped by
 * the chapter it came from and re-answerable in place.
 */

import { useMemo, useState } from "react";
import { CheckIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type Mistake,
  type PracticeQuestion,
  agoLabel,
  difficultyLabel,
  gradeRequest,
  groupMistakes,
  typeLabel,
} from "@/lib/workspace/practice.mjs";
import type { StudyCourse } from "@/lib/workspace/courses.mjs";
import {
  AnswerControl,
  COLUMN_LABEL,
  NUMERALS,
  PAPER,
  PROSE,
  Prose,
  SectionHead,
  api,
} from "./shared";

export default function MistakesTab({
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

  if (!mistakes)
    return <Skeleton className="h-48 w-full motion-reduce:animate-none" />;

  if (!mistakes.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No open mistakes</EmptyTitle>
          <EmptyDescription>
            An attempt is filed here when a grader scores it below 7 out of 10.
            Answer a question in the Questions tab, or sit a mock, and anything
            that goes wrong will be waiting here.
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
                  className="flex min-w-0 max-w-[80ch] flex-col gap-3 border-b py-4"
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
                      <span className={COLUMN_LABEL}>What you wrote</span>
                      <pre className="bg-card overflow-x-auto rounded-sm p-3 text-[13.5px] whitespace-pre-wrap">
                        {mistake.attempt}
                      </pre>
                    </div>
                  )}
                  {mistake.correction && (
                    <Prose source={mistake.correction} className={PAPER} />
                  )}
                  <div className="flex flex-col gap-2 border-t pt-3">
                    <AnswerControl
                      question={mistake as unknown as PracticeQuestion}
                      value={drafts[mistake.id] ?? ""}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          [mistake.id]: value,
                        }))
                      }
                      label="Try again"
                      disabled={retrying === mistake.id}
                      actions={
                        <Button
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => void retry(mistake)}
                          disabled={
                            retrying === mistake.id ||
                            !drafts[mistake.id]?.trim()
                          }
                        >
                          {retrying === mistake.id
                            ? "Checking…"
                            : "Check retry"}
                        </Button>
                      }
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => void remove(mistake, true)}
                        disabled={retrying === mistake.id}
                      >
                        <CheckIcon data-icon="inline-start" />
                        Mark resolved
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full sm:w-auto"
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
