"use client";

/**
 * The end of a sitting, as a ledger.
 *
 * Anki, Duolingo and Quizlet all close a session with a settled account of what
 * was done and one obvious way back into what went wrong. This is that, in the
 * board's own voice: a ruled table of the sitting split by course, and two
 * actions — take the misses again, or stop. No celebration, no score card, no
 * second colour; the figures carry it.
 */

import { Button } from "@/components/ui/button";
import { COLUMN_LABEL, NUMERALS } from "./shared";
import type { SessionSummary } from "@/lib/workspace/practice.mjs";

const figure = (value: number) => (value ? String(value) : "—");

export function SessionLedger({
  title,
  note,
  unit,
  summary,
  onRetryMissed,
  onDone,
  doneLabel = "Done",
}: {
  title: string;
  note: string;
  /** What one row of this sitting was: an answer, or a card review. */
  unit: "Answered" | "Reviewed";
  summary: SessionSummary;
  onRetryMissed: () => void;
  onDone: () => void;
  doneLabel?: string;
}) {
  const missed = summary.missed.length;
  return (
    <section className="flex w-full max-w-[74ch] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground max-w-[74ch] text-sm">{note}</p>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[19rem]">
          <thead>
            <tr className={COLUMN_LABEL}>
              <th className="py-2 pr-4 text-left font-semibold">Course</th>
              <th className="w-[4.5rem] py-2 pr-4 text-right font-semibold sm:w-[6rem]">
                {unit}
              </th>
              <th className="w-[4.5rem] py-2 pr-4 text-right font-semibold sm:w-[6rem]">
                Correct
              </th>
              <th className="w-[4.5rem] py-2 text-right font-semibold sm:w-[6rem]">
                Missed
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.courses.map((row) => (
              <tr key={row.courseId ?? row.code} className="border-b">
                <td className={`py-2 pr-4 text-[15px] font-semibold ${NUMERALS}`}>
                  {row.code}
                </td>
                <td className={`py-2 pr-4 text-right text-sm ${NUMERALS}`}>
                  {row.answered}
                </td>
                <td className={`py-2 pr-4 text-right text-sm ${NUMERALS}`}>
                  {figure(row.correct)}
                </td>
                <td className={`py-2 text-right text-sm ${NUMERALS}`}>
                  {figure(row.missed)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-b-2">
              <td className="py-2 pr-4 text-[15px] font-semibold">
                All courses
              </td>
              <td
                className={`py-2 pr-4 text-right text-sm font-semibold ${NUMERALS}`}
              >
                {summary.answered}
              </td>
              <td
                className={`py-2 pr-4 text-right text-sm font-semibold ${NUMERALS}`}
              >
                {figure(summary.correct)}
              </td>
              <td
                className={`py-2 text-right text-sm font-semibold ${NUMERALS}`}
              >
                {figure(summary.incorrect)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        <Button
          className="w-full sm:w-auto"
          onClick={onRetryMissed}
          disabled={!missed}
          title={
            missed
              ? undefined
              : "Nothing was missed in this sitting."
          }
        >
          Review the ones you missed
          {missed > 0 && (
            <span className={`text-primary-foreground/70 ${NUMERALS}`}>
              {missed}
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={onDone}
        >
          {doneLabel}
        </Button>
      </div>
    </section>
  );
}
