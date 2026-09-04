"use client";

/**
 * The grammar every Practice tab shares: how a question is set, how a read
 * answer is laid on paper, and how the page talks to the API.
 *
 * The markdown/KaTeX renderer sits behind `dynamic()` here rather than being
 * imported at the top of a tab, so the formula pipeline arrives with the first
 * question on screen instead of with the page.
 */

import { type ReactNode, useId } from "react";
import dynamic from "next/dynamic";
import { CheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  type PracticeQuestion,
  difficultyLabel,
  formatChoiceAttempt,
  questionAnswerMode,
  typeLabel,
  usableOptions,
} from "@/lib/workspace/practice.mjs";
import { cn } from "@/lib/utils";

export const NUMERALS = "font-data tabular-nums";

export type SessionEvent<TItem = unknown> = {
  key: string;
  courseId: string | null;
  courseCode: string;
  correct: boolean;
  item?: TItem;
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
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

const OPTION_ROW =
  "group relative flex min-h-14 cursor-pointer items-start gap-3 px-4 py-3.5 outline-none transition-colors hover:bg-card has-[:checked]:bg-primary/[0.06] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55";

function OptionMark({
  checked,
  label,
  multiple,
}: {
  checked: boolean;
  label: string;
  multiple?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "font-data mt-0.5 grid size-7 shrink-0 place-items-center border text-xs font-semibold tabular-nums transition-colors",
        multiple ? "rounded-[5px]" : "rounded-full",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground",
      )}
    >
      {checked && multiple ? <CheckIcon className="size-4" /> : label}
    </span>
  );
}

/**
 * The question-native response instrument shared by untimed questions, mock
 * sittings and retries. Its value remains a string because that is the stable
 * grading envelope; closed controls only make producing that string safer.
 */
export function AnswerControl({
  question,
  value,
  onChange,
  disabled,
  label = "Your answer",
  actions,
}: {
  question: PracticeQuestion;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  actions?: ReactNode;
}) {
  const id = useId();
  const mode = questionAnswerMode(question);
  const options = usableOptions(question);
  const selected = new Set(value.split("\n").filter(Boolean));

  if (mode === "written") {
    const isCode = question.type === "pseudocode";
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <div className="bg-primary/[0.035] focus-within:ring-primary/30 overflow-hidden rounded-[10px] ring-1 ring-primary/15 ring-inset transition-shadow focus-within:ring-3">
          <Textarea
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={
              isCode
                ? "Write your pseudocode…"
                : question.type === "calc"
                  ? "Show your calculation and final answer…"
                  : "Explain your answer in your own words…"
            }
            disabled={disabled}
            className={cn(
              "min-h-20 resize-y rounded-none border-0 bg-transparent px-5 py-4 text-[15px] leading-relaxed shadow-none focus-visible:ring-0 sm:min-h-32",
              isCode && "font-mono text-[13.5px]",
            )}
          />
          <div className="text-muted-foreground flex items-center justify-between gap-4 border-t px-4 py-2 text-xs">
            <span>
              {question.type === "calc"
                ? "Include the working the grader should check."
                : isCode
                  ? "Plain text is fine. Indentation is preserved."
                  : "A concise explanation is enough."}
            </span>
            <span className={`${NUMERALS} shrink-0`}>{value.length} chars</span>
          </div>
          {actions && (
            <div className="border-t bg-background/70 px-4 py-3">{actions}</div>
          )}
        </div>
      </div>
    );
  }

  if (mode === "true-false") {
    const values = ["True", "False"];
    return (
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-semibold">{label}</legend>
        <div className="grid grid-cols-2 overflow-hidden rounded-[10px] border">
          {values.map((option, index) => {
            const checked = value === option;
            return (
              <label
                key={option}
                className={cn(
                  OPTION_ROW,
                  "items-center border-l first:border-l-0",
                )}
              >
                <input
                  type="radio"
                  name={`${id}-true-false`}
                  value={option}
                  checked={checked}
                  onChange={() => onChange(option)}
                  disabled={disabled}
                  className="peer sr-only"
                />
                <span className="peer-focus-visible:ring-ring absolute inset-1 rounded-md peer-focus-visible:ring-3" />
                <OptionMark checked={checked} label={index === 0 ? "T" : "F"} />
                <span className="relative pt-0.5 text-[15px] font-semibold">
                  {option}
                </span>
              </label>
            );
          })}
          {actions && (
            <div className="col-span-2 border-t bg-background/70 px-4 py-3">
              {actions}
            </div>
          )}
        </div>
      </fieldset>
    );
  }

  const multiple = mode === "multiple-choice";
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span aria-hidden="true" className="text-sm font-semibold">
          {label}
        </span>
        <span className="text-muted-foreground text-xs">
          {multiple
            ? `${selected.size} selected · choose every answer that applies`
            : "Choose the best answer"}
        </span>
      </div>
      <div className="overflow-hidden rounded-[10px] border">
        {options.map((option, index) => {
          const checked = multiple ? selected.has(option) : value === option;
          return (
            <label
              key={`${index}-${option}`}
              className={`${OPTION_ROW} border-b last:border-b-0`}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={multiple ? `${id}-${index}` : `${id}-choice`}
                value={option}
                checked={checked}
                onChange={() => {
                  if (!multiple) {
                    onChange(option);
                    return;
                  }
                  const next = new Set(selected);
                  if (checked) next.delete(option);
                  else next.add(option);
                  onChange(formatChoiceAttempt(options, [...next]));
                }}
                disabled={disabled}
                className="peer sr-only"
              />
              <span className="peer-focus-visible:ring-ring absolute inset-1 rounded-md peer-focus-visible:ring-3" />
              <OptionMark
                checked={checked}
                label={String.fromCharCode(65 + index)}
                multiple={multiple}
              />
              <span className="relative min-w-0 flex-1 pt-0.5 text-[15px] leading-relaxed">
                <Prose
                  source={option}
                  inline
                  className="[&_code]:bg-background [&_code]:rounded-xs [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13.5px]"
                />
              </span>
            </label>
          );
        })}
        {actions && (
          <div className="border-t bg-background/70 px-4 py-3">{actions}</div>
        )}
      </div>
    </fieldset>
  );
}

/** The column header voice: a label on a table, never a kicker over a heading. */
export const COLUMN_LABEL =
  "text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase";
