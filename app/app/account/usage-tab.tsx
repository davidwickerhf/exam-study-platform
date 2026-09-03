"use client";

/** AI usage: what the allowance is, and what has been spent against it. */

import { useMemo } from "react";
import { RotateCcwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useJson } from "@/components/workspace/use-json";
import {
  type AiUsage,
  AI_FEATURE_LABEL,
  allowanceMeters,
  formatCount,
  requestTokens,
} from "@/lib/workspace/account.mjs";
import { Failed, NUMERALS, Section, clockOrDate, relative } from "./shared";

export function UsageTab() {
  const usage = useJson<AiUsage>("/api/ai/usage");
  const meters = useMemo(() => allowanceMeters(usage.data), [usage.data]);
  const resetsAt = usage.data?.resetsAt ?? null;

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Allowance"
        note="AI is used for the source-grounded tutor, extra exercises you ask for, and academic documents you explicitly ask to organise."
        action={
          <Button variant="secondary" size="sm" onClick={usage.reload}>
            <RotateCcwIcon data-icon="inline-start" />
            Refresh
          </Button>
        }
      >
        {usage.error ? (
          <Failed
            what="Your allowance could not be read"
            message={usage.error}
          />
        ) : !usage.data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="flex flex-col">
            {meters.map((meter) => (
              <div
                key={meter.id}
                className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] items-center gap-6 border-b py-3"
              >
                <span className="flex flex-col gap-0.5">
                  <strong className="text-[15px] font-medium">
                    {meter.label}
                  </strong>
                  <small
                    className={`text-muted-foreground text-xs ${NUMERALS}`}
                  >
                    {formatCount(meter.used)} of{" "}
                    {meter.limit === null
                      ? "no configured limit"
                      : formatCount(meter.limit)}
                  </small>
                </span>
                {/* An unknown limit gets no bar rather than a full one. */}
                {meter.percent === null ? (
                  <span className="text-muted-foreground text-sm">
                    Not limited on this server
                  </span>
                ) : (
                  <Progress value={meter.percent} />
                )}
                <small
                  className={`text-muted-foreground text-right text-xs ${NUMERALS}`}
                >
                  {meter.remaining === null
                    ? "—"
                    : `${formatCount(meter.remaining)} left`}
                  {" · resets "}
                  {meter.resets === "day"
                    ? clockOrDate(resetsAt?.day, "time")
                    : clockOrDate(resetsAt?.month, "date")}
                </small>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Recent requests"
        note="Every AI request this month, newest first. A pending request reserves its maximum output so concurrent calls cannot exceed your limit."
      >
        {!usage.data ? null : !usage.data.recent.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No AI requests yet this month</EmptyTitle>
              <EmptyDescription>
                The tutor, extra exercises and plan imports all appear here once
                used.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Input</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usage.data.recent.map((event) => {
                const tokens = requestTokens(event);
                return (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      {AI_FEATURE_LABEL[event.feature] ?? event.feature}
                    </TableCell>
                    <TableCell>
                      {event.status === "completed" ? (
                        <span className="text-muted-foreground text-sm">
                          Completed
                        </span>
                      ) : (
                        <Badge
                          variant={
                            event.status === "failed" ? "default" : "secondary"
                          }
                        >
                          {event.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={`text-right ${NUMERALS}`}>
                      {formatCount(tokens.input)}
                      {tokens.estimated && (
                        <small className="text-muted-foreground"> est.</small>
                      )}
                    </TableCell>
                    <TableCell className={`text-right ${NUMERALS}`}>
                      {formatCount(tokens.output)}
                      {event.status === "pending" && (
                        <small className="text-muted-foreground">
                          {" "}
                          reserved
                        </small>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-muted-foreground text-right ${NUMERALS}`}
                    >
                      {relative(event.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <p className="text-muted-foreground text-sm">
          Direct API calls use provider-reported token totals; local CLI
          providers use a conservative estimate.
        </p>
      </Section>
    </div>
  );
}
