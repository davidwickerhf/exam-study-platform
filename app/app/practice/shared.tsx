"use client";

/**
 * The grammar every Practice tab shares: how a question is set, how a read
 * answer is laid on paper, and how the page talks to the API.
 *
 * The markdown/KaTeX renderer sits behind `dynamic()` here rather than being
 * imported at the top of a tab, so the formula pipeline arrives with the first
 * question on screen instead of with the page.
 */

import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type PracticeQuestion,
  difficultyLabel,
  typeLabel,
  usableOptions,
} from "@/lib/workspace/practice.mjs";

export const NUMERALS = "font-data tabular-nums";

export type SessionEvent<TItem = unknown> = {
  key: string;
  courseId: string | null;
  courseCode: string;
  correct: boolean;
  item?: TItem;
};

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok)
    throw new Error(data?.error || `That request answered ${response.status}.`);
  return data as T;
}

/** Prose on the board: a question, an attempt, a correction. */
export const PROSE = [
  "text-[15px] leading-[1.7]",
  "[&>*+*]:mt-3",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1",
  "[&_strong]:font-semibold",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:bg-card [&_code]:rounded-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13.5px]",
  "[&_pre]:bg-card [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:p-3 [&_pre]:text-[13.5px]",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:w-full [&_table]:text-sm",
  "[&_th]:border-b [&_th]:py-1.5 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border-b [&_td]:py-1.5 [&_td]:pr-4 [&_td]:align-top",
  "[&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1",
].join(" ");

/** The punched paper window — the one place the ink inverts. */
export const PAPER = [
  "bg-paper text-paper-ink rounded-sm px-5 py-4 shadow-lg",
  "text-[14.5px] leading-relaxed",
  "[&>*+*]:mt-3",
  "[&_a]:text-paper-link [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:bg-paper-subtle [&_code]:rounded-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13.5px]",
  "[&_pre]:bg-paper-subtle [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:p-3 [&_pre]:text-[13.5px]",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1",
  "[&_strong]:font-semibold",
  "[&_table]:w-full [&_table]:text-sm",
  "[&_th]:border-paper-subtle [&_th]:border-b [&_th]:py-1.5 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border-paper-subtle [&_td]:border-b [&_td]:py-1.5 [&_td]:pr-4 [&_td]:align-top",
  "[&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1",
].join(" ");

const ProseBody = dynamic(() => import("./prose"), {
  ssr: false,
  loading: () => (
    <Skeleton
      className="h-4 w-full max-w-[36ch] motion-reduce:animate-none"
      aria-hidden="true"
    />
  ),
});

export function Prose({
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
      <ProseBody source={source} inline={inline} />
    </div>
  );
}

/** A section inside a destination: 18px, no rule of its own. */
export function SectionHead({ title, meta }: { title: string; meta?: string }) {
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

export function TypeLine({ question }: { question: PracticeQuestion }) {
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

export function Choices({ question }: { question: PracticeQuestion }) {
  const options = usableOptions(question);
  if (!options.length) return null;
  return (
    <ol className="flex list-[lower-alpha] flex-col gap-1 pl-5 text-[15px] leading-snug">
      {options.map((option, index) => (
        <li key={`${index}-${option}`}>
          <Prose
            source={option}
            inline
            className="[&_code]:bg-card [&_code]:rounded-xs [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13.5px]"
          />
        </li>
      ))}
    </ol>
  );
}

/** The column header voice: a label on a table, never a kicker over a heading. */
export const COLUMN_LABEL =
  "text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase";
