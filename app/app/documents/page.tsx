"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  CalendarDaysIcon,
  ExternalLinkIcon,
  FileClockIcon,
  FileImageIcon,
  FileTextIcon,
  GraduationCapIcon,
  LockKeyholeIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlanningDocuments } from "@/components/workspace/planning-documents";
import { readJson, useJson } from "@/components/workspace/use-json";
import { Confirm, NUMERALS } from "@/app/app/account/shared";
import type { Workspace } from "@/lib/workspace/academics.mjs";
import { readTutorFile } from "@/lib/workspace/tutor-files";

type WorkSummary = {
  earnedEcts: number;
  passedCourses: number;
  failedAttempts: number;
  currentCourses: number;
  weightedAverage: number | null;
};

type WorkCourse = {
  academicYear?: string | null;
  periodCode?: string | null;
  code: string;
  name?: string | null;
  status?: string | null;
  grade?: number | null;
  creditsEarned?: number | null;
  creditsTotal?: number | null;
};

type WorkVersion = {
  id: string;
  kind: string;
  sourceLabel: string | null;
  printedOn: string | null;
  createdAt: string;
  summary: WorkSummary | null;
  courses?: WorkCourse[];
};

type WorkRecord = {
  snapshots: WorkVersion[];
  latest: WorkVersion | null;
  series: {
    at: string;
    printedOn: string | null;
    earnedEcts: number;
    passedCourses: number;
    weightedAverage: number | null;
  }[];
};

type SupportingVersion = {
  id: string;
  sourceLabel: string;
  sources: { name: string; type: string | null; size: number | null }[];
  impact: { applied?: number; proposed?: number; selected?: number; warnings?: number } | null;
  createdAt: string;
};

type SupportingRecord = {
  id: string;
  kind: string;
  label: string;
  versions: SupportingVersion[];
};

type DocumentGroup =
  | { id: "academic-work"; label: string; kind: "academic-work"; versions: WorkVersion[] }
  | { id: string; label: string; kind: string; versions: SupportingVersion[] };

type TutorAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  status: string;
  courseCode?: string | null;
  courseName?: string | null;
  chapterName?: string | null;
  conversationId?: string | null;
  createdAt: string;
  updatedAt: string;
  private: boolean;
  origin?: "tutor" | "documents";
};

const KIND_LABELS: Record<string, string> = {
  transcript: "Transcript",
  "academic-work": "Academic Work",
  "academic-overview": "Academic overview",
  "academic-calendar": "Academic calendar",
  "exam-schedule": "Exam schedule",
  timetable: "Timetable file",
  curriculum: "Curriculum or handbook",
  other: "Supporting document",
};

function dateLabel(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  const date = new Date(value.length > 10 ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function kindIcon(kind: string) {
  if (kind === "academic-work" || kind === "academic-overview") return GraduationCapIcon;
  if (kind === "academic-calendar" || kind === "exam-schedule" || kind === "timetable") return CalendarDaysIcon;
  return FileTextIcon;
}

function fileSize(value: number | null) {
  if (value == null) return "Size unavailable";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function privateSourceType(type: string) {
  if (type === "application/pdf") return "PDF";
  if (type.includes("wordprocessingml")) return "DOCX";
  if (type.startsWith("image/")) return "Image";
  if (type === "text/calendar") return "Calendar file";
  if (type === "text/markdown") return "Markdown";
  return "Text source";
}

function courseRowChanges(current: WorkCourse[] = [], previous: WorkCourse[] = []) {
  const key = (course: WorkCourse) => `${course.academicYear || ""}|${course.periodCode || ""}|${course.code}`;
  const before = new Map(previous.map((course) => [key(course), course]));
  const after = new Map(current.map((course) => [key(course), course]));
  const rows: { key: string; course: WorkCourse; state: string; detail: string }[] = [];
  for (const course of current) {
    const prior = before.get(key(course));
    if (!prior) {
      rows.push({ key: key(course), course, state: "New", detail: `${course.status || "Recorded"}${course.grade == null ? "" : ` · grade ${course.grade}`}` });
    } else if (prior.status !== course.status || prior.grade !== course.grade || prior.creditsEarned !== course.creditsEarned || prior.creditsTotal !== course.creditsTotal) {
      const oldCredits = prior.creditsEarned == null && prior.creditsTotal == null ? null : `${prior.creditsEarned ?? 0}/${prior.creditsTotal ?? "?"} ECTS`;
      const newCredits = course.creditsEarned == null && course.creditsTotal == null ? null : `${course.creditsEarned ?? 0}/${course.creditsTotal ?? "?"} ECTS`;
      const oldValue = [prior.status, prior.grade == null ? null : `grade ${prior.grade}`, oldCredits].filter(Boolean).join(" · ");
      const newValue = [course.status, course.grade == null ? null : `grade ${course.grade}`, newCredits].filter(Boolean).join(" · ");
      rows.push({ key: key(course), course, state: "Updated", detail: `${oldValue || "Earlier value"} → ${newValue || "Current value"}` });
    }
  }
  for (const course of previous) {
    if (!after.has(key(course))) rows.push({ key: key(course), course, state: "Removed", detail: "No longer listed in this version" });
  }
  return rows;
}

function ProgressPlot({ series }: { series: WorkRecord["series"] }) {
  const points = series.slice(-8);
  if (points.length < 2) {
    return (
      <p className="text-muted-foreground px-6 py-5 text-sm">
        Upload another Academic Work version to see progression here.
      </p>
    );
  }
  const maxCredits = Math.max(1, ...points.map((point) => point.earnedEcts));
  const maxPassed = Math.max(1, ...points.map((point) => point.passedCourses));
  const coordinates = (values: number[], max: number) =>
    values
      .map((value, index) => {
        const x = points.length === 1 ? 20 : 20 + (index / (points.length - 1)) * 260;
        const y = 84 - (value / max) * 64;
        return `${x},${y}`;
      })
      .join(" ");
  const credits = coordinates(points.map((point) => point.earnedEcts), maxCredits);
  const passed = coordinates(points.map((point) => point.passedCourses), maxPassed);

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-stretch">
      <div className="flex flex-col gap-3 px-6 py-5">
        <div className="flex flex-wrap gap-5 text-xs">
          <span className="flex items-center gap-2"><span className="bg-primary h-px w-5" />Credits earned</span>
          <span className="flex items-center gap-2"><span className="bg-foreground h-px w-5" />Courses passed</span>
        </div>
        <svg viewBox="0 0 300 100" role="img" aria-label="Credits earned and courses passed across saved record versions" className="h-28 w-full overflow-visible">
          {[20, 52, 84].map((y) => <line key={y} x1="20" y1={y} x2="280" y2={y} className="stroke-border" strokeWidth="1" />)}
          <polyline points={credits} fill="none" className="stroke-primary" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <polyline points={passed} fill="none" className="stroke-foreground" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          {points.map((point, index) => {
            const x = 20 + (index / (points.length - 1)) * 260;
            const creditY = 84 - (point.earnedEcts / maxCredits) * 64;
            return <circle key={point.at} cx={x} cy={creditY} r="3" className="fill-primary stroke-card" strokeWidth="1.5" />;
          })}
        </svg>
        <ol className="sr-only">
          {points.map((point) => (
            <li key={point.at}>
              {dateLabel(point.printedOn || point.at)}: {point.earnedEcts} credits earned, {point.passedCourses} courses passed{point.weightedAverage == null ? "" : `, ${point.weightedAverage} average`}.
            </li>
          ))}
        </ol>
      </div>
      <dl className="grid grid-cols-3 border-y lg:grid-cols-1 lg:border-y-0 lg:border-l">
        {[
          ["Credits", String(points.at(-1)?.earnedEcts ?? 0)],
          ["Courses passed", String(points.at(-1)?.passedCourses ?? 0)],
          ["Average", points.at(-1)?.weightedAverage == null ? "Not recorded" : String(points.at(-1)?.weightedAverage)],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 px-4 py-2.5 lg:border-b">
            <dt className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">{label}</dt>
            <dd className={`text-lg font-semibold ${NUMERALS}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function DocumentsPage() {
  const academics = useJson<{ workspace: Workspace }>("/api/academics");
  const work = useJson<WorkRecord>("/api/academics/work");
  const supporting = useJson<{ documents: SupportingRecord[] }>("/api/academics/document-records");
  const tutorUploads = useJson<{ attachments: TutorAttachment[] }>("/api/tutor/attachments");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ group: DocumentGroup; version: WorkVersion | SupportingVersion } | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadKind, setUploadKind] = useState<string | undefined>(undefined);
  const [uploadMode, setUploadMode] = useState<"choose" | "academic" | "private">("choose");
  const [privateUploading, setPrivateUploading] = useState(false);
  const [privateUploadError, setPrivateUploadError] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [removingTutor, setRemovingTutor] = useState<TutorAttachment | null>(null);

  const groups = useMemo<DocumentGroup[]>(() => {
    const result: DocumentGroup[] = [];
    const records = supporting.data?.documents ?? [];
    const fixed = [
      { kind: "transcript", label: "Transcript" },
      { kind: "academic-work", label: "Academic Work" },
      { kind: "academic-calendar", label: "Academic calendar" },
      { kind: "exam-schedule", label: "Exam schedule" },
    ];
    for (const item of fixed) {
      if (item.kind === "academic-work") {
        result.push({ id: "academic-work", label: item.label, kind: "academic-work", versions: work.data?.snapshots ?? [] });
        continue;
      }
      const record = records.find((entry) => entry.kind === item.kind);
      result.push(record
        ? { id: record.id, label: item.label, kind: record.kind, versions: record.versions }
        : { id: `empty:${item.kind}`, label: item.label, kind: item.kind, versions: [] });
    }
    for (const record of records.filter((entry) => !fixed.some((item) => item.kind === entry.kind))) {
      result.push({ id: record.id, label: KIND_LABELS[record.kind] ?? record.label, kind: record.kind, versions: record.versions });
    }
    return result;
  }, [work.data, supporting.data]);

  useEffect(() => {
    if (!groups.length) setSelectedId(null);
    else if (!groups.some((group) => group.id === selectedId) && !(tutorUploads.data?.attachments ?? []).some((source) => `tutor:${source.id}` === selectedId)) setSelectedId(groups[0].id);
  }, [groups, selectedId, tutorUploads.data]);

  const selected = groups.find((group) => group.id === selectedId) ?? null;
  const selectedTutor = tutorUploads.data?.attachments.find((source) => `tutor:${source.id}` === selectedId) ?? null;
  const reload = () => {
    work.reload();
    supporting.reload();
    tutorUploads.reload();
  };

  async function removeVersion() {
    if (!removing) return;
    setBusy(true);
    setRemoveError(null);
    try {
      const path = removing.group.kind === "academic-work"
        ? `/api/academics/work/${encodeURIComponent(removing.version.id)}`
        : `/api/academics/document-records/${encodeURIComponent(removing.group.kind)}/versions/${encodeURIComponent(removing.version.id)}`;
      await readJson(path, { method: "DELETE" });
      setRemoving(null);
      reload();
    } catch (cause) {
      setRemoveError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeTutorSource() {
    if (!removingTutor) return;
    setBusy(true);
    setRemoveError(null);
    try {
      await readJson(`/api/tutor/attachments/${encodeURIComponent(removingTutor.id)}`, { method: "DELETE" });
      setRemovingTutor(null);
      setSelectedId(groups[0]?.id ?? null);
      tutorUploads.reload();
    } catch (cause) {
      setRemoveError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadPrivateSources(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 8);
    event.target.value = "";
    if (!files.length) return;
    setPrivateUploading(true);
    setPrivateUploadError(null);
    try {
      let newest: TutorAttachment | null = null;
      for (const file of files) {
        const source = await readTutorFile(file);
        const result = await readJson<{ attachment: TutorAttachment }>("/api/tutor/attachments", {
          method: "POST",
          body: JSON.stringify({ ...source, origin: "documents" }),
        });
        newest = result.attachment;
      }
      await tutorUploads.reload();
      if (newest) setSelectedId(`tutor:${newest.id}`);
      setUploadOpen(false);
    } catch (cause) {
      setPrivateUploadError((cause as Error).message);
    } finally {
      setPrivateUploading(false);
    }
  }

  const openUpload = (kind?: string) => {
    setUploadKind(kind);
    setUploadMode(kind ? "academic" : "choose");
    setPrivateUploadError(null);
    setUploadOpen(true);
  };
  const loading = (!work.data && !work.error) || (!supporting.data && !supporting.error);
  const tutorLoading = !tutorUploads.data && !tutorUploads.error;
  const privateSources = tutorUploads.data?.attachments ?? [];
  const historyError = work.error || supporting.error;
  const historyNeedsSession = Boolean(historyError && /sign[ -]?in|unauthori[sz]ed|authenticat|session/i.test(historyError));
  const retryHistory = () => {
    work.reload();
    supporting.reload();
  };
  const uploadAction = (group: DocumentGroup) => {
    if (group.kind === "transcript") return group.versions.length ? "Re-import transcript" : "Import transcript";
    return group.versions.length ? "Add newer version" : "Add first version";
  };

  return (
    <div className="flex w-full flex-col">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b p-4 sm:p-6 lg:px-8">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">Documents</h1>
          <p className="text-muted-foreground max-w-[74ch] text-sm">
            Manage your academic records, keep every revision, and see what changed over time.
          </p>
        </div>
        <Button data-tour="document-upload" onClick={() => openUpload()}><UploadIcon data-icon="inline-start" />Upload document</Button>
      </header>

      <section className="grid border-b xl:min-h-[calc(100dvh-8.25rem)] xl:grid-cols-[minmax(0,1.9fr)_minmax(21rem,1fr)]">
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-4 border-b px-4 py-4 sm:px-6 xl:hidden">
              <h2 className="text-[18px] font-semibold">Your records</h2>
              {!loading && <span className={`text-muted-foreground text-sm ${NUMERALS}`}>{groups.filter((group) => group.versions.length).length + privateSources.length} active</span>}
            </div>
            <div className="text-muted-foreground hidden grid-cols-[minmax(12rem,1.5fr)_minmax(7rem,0.72fr)_5.5rem_7rem_5rem_1.5rem] gap-3 border-b px-6 py-3 text-[10.5px] font-semibold tracking-[0.11em] uppercase xl:grid">
              <span>Document</span><span>Type</span><span>Version</span><span>Uploaded</span><span>State</span><span />
            </div>
            {loading ? (
              <div className="flex flex-col gap-3 p-6"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
            ) : historyError ? (
              <Empty role="alert" className="min-h-[420px] border-0">
                <EmptyMedia variant="icon"><LockKeyholeIcon /></EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>{historyNeedsSession ? "Reconnect to view your documents" : "Document history is temporarily unavailable"}</EmptyTitle>
                  <EmptyDescription>
                    {historyNeedsSession
                      ? "We could not verify this request. Try again to reconnect your session. Your documents have not been changed."
                      : "We could not load the saved versions right now. Try again in a moment. Your documents have not been changed."}
                  </EmptyDescription>
                </EmptyHeader>
                <Button variant="outline" size="sm" onClick={retryHistory}><RotateCcwIcon data-icon="inline-start" />Try again</Button>
                <details className="text-muted-foreground max-w-xl text-xs"><summary className="cursor-pointer font-medium">Technical details</summary><p className="mt-2">{historyError}</p></details>
              </Empty>
            ) : (
              <ul>
                {groups.map((group) => {
                  const Icon = kindIcon(group.kind);
                  const current = group.versions[0];
                  const active = selected?.id === group.id;
                  return (
                    <li key={group.id} className="border-b last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setSelectedId(group.id)}
                        aria-current={active ? "true" : undefined}
                        className={`focus-visible:outline-ring flex w-full items-center gap-4 px-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:px-6 xl:grid xl:grid-cols-[minmax(12rem,1.5fr)_minmax(7rem,0.72fr)_5.5rem_7rem_5rem_1.5rem] xl:gap-3 ${active ? "bg-accent" : "hover:bg-muted/45"}`}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-3 xl:flex-none">
                          <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md"><Icon className="size-[17px]" /></span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <strong className="truncate text-sm font-semibold">{group.label}</strong>
                            <small className="text-muted-foreground truncate text-xs xl:hidden">{current?.sourceLabel || "No version uploaded"}</small>
                          </span>
                        </span>
                        <span className="text-muted-foreground hidden truncate text-xs xl:block">{KIND_LABELS[group.kind] ?? group.label}</span>
                        <span className={`text-muted-foreground hidden text-xs xl:block ${NUMERALS}`}>{group.versions.length ? `v${group.versions.length}` : "Not added"}</span>
                        <span className={`text-muted-foreground hidden text-xs xl:block ${NUMERALS}`}>{current ? dateLabel(current.createdAt) : "No date"}</span>
                        <span className="hidden items-center gap-2 text-xs xl:flex"><span className={`size-1.5 rounded-full ${group.versions.length ? "bg-foreground" : "bg-border-strong"}`} />{group.versions.length ? "Parsed" : "Missing"}</span>
                        <span className="text-primary ml-auto text-lg leading-none xl:ml-0">›</span>
                      </button>
                    </li>
                  );
                })}
                <li className="bg-muted/35 flex items-baseline justify-between gap-4 border-b px-4 py-2.5 sm:px-6">
                  <span className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">Other uploads</span>
                  <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{privateSources.length}</span>
                </li>
                {tutorLoading ? (
                  <li className="border-b px-6 py-4"><Skeleton className="h-10 w-full" /></li>
                ) : tutorUploads.error ? (
                  <li className="border-b px-6 py-4 text-sm" role="alert">Private sources are unavailable. {tutorUploads.error}</li>
                ) : privateSources.length ? privateSources.map((source) => {
                  const active = selectedTutor?.id === source.id;
                  const SourceIcon = source.type.startsWith("image/") ? FileImageIcon : FileTextIcon;
                  return (
                    <li key={source.id} className="border-b last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setSelectedId(`tutor:${source.id}`)}
                        aria-current={active ? "true" : undefined}
                        className={`focus-visible:outline-ring flex w-full items-center gap-4 px-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:px-6 xl:grid xl:grid-cols-[minmax(12rem,1.5fr)_minmax(7rem,0.72fr)_5.5rem_7rem_5rem_1.5rem] xl:gap-3 ${active ? "bg-accent" : "hover:bg-muted/45"}`}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-3 xl:flex-none">
                          <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md"><SourceIcon className="size-[17px]" /></span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <strong className="truncate text-sm font-semibold">{source.name}</strong>
                            <small className="text-muted-foreground truncate text-xs xl:hidden">{privateSourceType(source.type)} · {fileSize(source.size)}</small>
                          </span>
                        </span>
                        <span className="text-muted-foreground hidden truncate text-xs xl:block">{source.origin === "documents" ? "Private note" : "Tutor source"}</span>
                        <span className="text-muted-foreground hidden text-xs xl:block">Original</span>
                        <span className={`text-muted-foreground hidden text-xs xl:block ${NUMERALS}`}>{dateLabel(source.createdAt)}</span>
                        <span className="hidden items-center gap-2 text-xs capitalize xl:flex"><span className="bg-primary size-1.5 rounded-full" />{source.status}</span>
                        <span className="text-primary ml-auto text-lg leading-none xl:ml-0">›</span>
                      </button>
                    </li>
                  );
                }) : (
                  <li className="border-b px-6 py-5 text-sm">
                    <p className="font-medium">No private sources yet</p>
                    <p className="text-muted-foreground mt-1">Notes and files added here or in Tutor will appear in this register.</p>
                  </li>
                )}
              </ul>
            )}
          </div>

          <aside className="flex min-w-0 flex-col border-t xl:border-t-0 xl:border-l">
            {loading ? (
              <div className="flex flex-col gap-3 p-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-56 w-full" /></div>
            ) : selectedTutor ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-4">
                  <div className="min-w-0 flex flex-col gap-1">
                    <span className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">Other upload</span>
                    <h2 className="truncate text-[18px] font-semibold">{selectedTutor.name}</h2>
                    <p className="text-muted-foreground text-sm">Private, stored and available to Tutor</p>
                  </div>
                  <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/api/tutor/attachments/${selectedTutor.id}/file`} target="_blank" rel="noreferrer">Open file<ExternalLinkIcon data-icon="inline-end" /></a>
                </div>
                <dl className="text-sm">
                  {[
                    ["File type", privateSourceType(selectedTutor.type)],
                    ["Size", fileSize(selectedTutor.size)],
                    ["Added", dateLabel(selectedTutor.createdAt)],
                    ["Added from", selectedTutor.origin === "documents" ? "Documents" : "Tutor"],
                    ["Retrieval", selectedTutor.status === "indexed" ? "Indexed and searchable" : "Original stored"],
                    ["Course scope", selectedTutor.courseCode ? `${selectedTutor.courseCode}${selectedTutor.courseName ? ` · ${selectedTutor.courseName}` : ""}` : "Workspace-wide"],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 border-b px-6 py-4">
                      <dt className="text-muted-foreground">{label}</dt><dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-auto border-t px-6 py-4">
                  <Button variant="outline" size="sm" onClick={() => { setRemoveError(null); setRemovingTutor(selectedTutor); }}><Trash2Icon data-icon="inline-start" />Delete source</Button>
                </div>
              </>
            ) : historyError ? (
              <Empty className="min-h-[420px] border-0">
                <EmptyMedia variant="icon"><FileClockIcon /></EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Document details will appear here</EmptyTitle>
                  <EmptyDescription>Once history reconnects, choose a record to inspect its versions and progression.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : !selected ? (
              <div className="flex min-h-[420px] items-center justify-center p-8 text-center">
                <p className="text-muted-foreground max-w-sm text-sm">Choose a record to inspect its versions and progression.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-[18px] font-semibold">{selected.label}</h2>
                    <p className="text-muted-foreground text-sm">{selected.versions.length} saved version{selected.versions.length === 1 ? "" : "s"}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openUpload(selected.kind)}>{uploadAction(selected)}</Button>
                </div>

                {!selected.versions.length ? (
                  <Empty className="min-h-[330px] border-0">
                    <EmptyHeader>
                      <span className="bg-muted mx-auto flex size-12 items-center justify-center rounded-md"><FileClockIcon className="size-5" /></span>
                      <EmptyTitle>No {selected.label.toLowerCase()} versions yet</EmptyTitle>
                      <EmptyDescription>{selected.kind === "transcript"
                        ? "Import the current PDF to recover every dated result and repeated attempt. Wicker stores the derived record, not the original transcript."
                        : "Add the current document to create a dated baseline. The next reading will show what changed."}</EmptyDescription>
                    </EmptyHeader>
                    <Button onClick={() => openUpload(selected.kind)}><UploadIcon data-icon="inline-start" />{uploadAction(selected)}</Button>
                  </Empty>
                ) : <>
                {selected.kind === "academic-work" && <ProgressPlot series={work.data?.series ?? []} />}
                {selected.kind === "transcript" && (
                  <div className="flex items-start gap-3 border-b px-6 py-4 text-sm">
                    <RotateCcwIcon className="text-primary mt-0.5 size-4 shrink-0" />
                    <p><strong>Missing a course or attempt?</strong> <span className="text-muted-foreground">Re-import the latest transcript. Its derived rows are reconciled with the saved record, so existing attempts are not duplicated and the original PDF is not retained.</span></p>
                  </div>
                )}

                <div className="border-t first:border-t-0">
                  <div className="flex items-baseline justify-between gap-4 border-b px-6 py-3">
                    <h3 className="text-[16px] font-semibold">Version history</h3>
                    <span className="text-muted-foreground text-xs">Newest first</span>
                  </div>
                  <ol>
                    {selected.versions.map((version, index) => {
                      const summary = "summary" in version ? version.summary : null;
                      const impact = "impact" in version ? version.impact : null;
                      const previous = selected.versions[index + 1];
                      const previousSummary = previous && "summary" in previous ? previous.summary : null;
                      const rowChanges = summary ? courseRowChanges("courses" in version ? version.courses : [], previous && "courses" in previous ? previous.courses : []) : [];
                      const expanded = expandedVersionId === version.id;
                      return (
                        <li key={version.id} className="border-b last:border-b-0">
                          <div className="grid gap-3 px-6 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                            <span className="relative flex size-7 items-center justify-center">
                              {index < selected.versions.length - 1 && <span className="bg-border absolute top-6 h-8 w-px" aria-hidden="true" />}
                              <span className={`relative size-2.5 rounded-full border ${index === 0 ? "border-primary bg-primary" : "border-border-strong bg-card"}`} />
                            </span>
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="flex flex-wrap items-baseline gap-2">
                                <strong className={`text-sm ${NUMERALS}`}>v{selected.versions.length - index}</strong>
                                {index === 0 && <Badge variant="secondary">Latest saved</Badge>}
                                <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{dateLabel(version.createdAt)}</span>
                              </span>
                              <small className="text-muted-foreground truncate text-xs">{version.sourceLabel || "Source name unavailable"}</small>
                              {summary && <small className={`text-xs ${NUMERALS}`}>{summary.earnedEcts} ECTS · {summary.passedCourses} courses passed{summary.weightedAverage == null ? "" : ` · ${summary.weightedAverage} average`}</small>}
                              {impact && <small className={`text-xs ${NUMERALS}`}>{impact.applied ?? 0} changes applied · {impact.proposed ?? 0} reviewed</small>}
                            </span>
                            <span className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpandedVersionId(expanded ? null : version.id)}>{expanded ? "Hide details" : "View details"}</Button>
                              <Button variant="ghost" size="sm" onClick={() => setRemoving({ group: selected, version })}>Remove</Button>
                            </span>
                          </div>
                          {expanded && (
                            <div className="grid gap-4 border-t bg-muted/30 px-6 py-4 text-xs sm:grid-cols-2">
                              <div>
                                <h4 className="text-sm font-semibold">Version details</h4>
                                <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
                                  <dt className="text-muted-foreground">Saved</dt><dd>{dateLabel(version.createdAt)}</dd>
                                  <dt className="text-muted-foreground">Printed date</dt><dd>{"printedOn" in version ? dateLabel(version.printedOn) : "Not provided by this source"}</dd>
                                  <dt className="text-muted-foreground">Source</dt><dd>{version.sourceLabel || "Source name unavailable"}</dd>
                                </dl>
                                {"sources" in version && version.sources.length > 0 && (
                                  <ul className="mt-3 border-t pt-3">
                                    {version.sources.map((source, sourceIndex) => <li key={`${source.name}-${sourceIndex}`}>{source.name} · {source.type || "Unknown type"} · {fileSize(source.size)}</li>)}
                                  </ul>
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold">{summary ? (previous ? `Change from v${selected.versions.length - index - 1}` : "Baseline") : "This reading"}</h4>
                                {summary ? (
                                  <>
                                    <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
                                      <dt className="text-muted-foreground">Credits earned</dt><dd className={NUMERALS}>{previousSummary ? `${summary.earnedEcts - previousSummary.earnedEcts >= 0 ? "+" : ""}${summary.earnedEcts - previousSummary.earnedEcts}` : summary.earnedEcts}</dd>
                                      <dt className="text-muted-foreground">Courses passed</dt><dd className={NUMERALS}>{previousSummary ? `${summary.passedCourses - previousSummary.passedCourses >= 0 ? "+" : ""}${summary.passedCourses - previousSummary.passedCourses}` : summary.passedCourses}</dd>
                                      <dt className="text-muted-foreground">Weighted average</dt><dd className={NUMERALS}>{summary.weightedAverage ?? "Not recorded"}</dd>
                                    </dl>
                                    <div className="mt-4 border-t pt-3">
                                      <h5 className="font-semibold">Derived course rows</h5>
                                      {rowChanges.length ? (
                                        <ul className="mt-2 max-h-48 overflow-y-auto">
                                          {rowChanges.map((row) => <li key={`${row.state}-${row.key}`} className="grid grid-cols-[4.5rem_1fr] gap-2 border-t py-2 first:border-t-0"><span className="text-muted-foreground font-semibold">{row.state}</span><span><strong>{row.course.code}</strong>{row.course.name ? ` · ${row.course.name}` : ""}<small className="text-muted-foreground block">{row.detail}</small></span></li>)}
                                        </ul>
                                      ) : <p className="text-muted-foreground mt-2">No course row changed from the previous version.</p>}
                                    </div>
                                  </>
                                ) : impact ? (
                                  <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
                                    <dt className="text-muted-foreground">Changes applied</dt><dd className={NUMERALS}>{impact.applied ?? 0}</dd>
                                    <dt className="text-muted-foreground">Proposals reviewed</dt><dd className={NUMERALS}>{impact.proposed ?? 0}</dd>
                                    <dt className="text-muted-foreground">Proposals selected</dt><dd className={NUMERALS}>{impact.selected ?? impact.applied ?? 0}</dd>
                                    <dt className="text-muted-foreground">Reader warnings</dt><dd className={NUMERALS}>{impact.warnings ?? 0}</dd>
                                  </dl>
                                ) : <p className="text-muted-foreground mt-3">This version establishes the first dated reference point.</p>}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
                </>}
              </>
            )}
            {!selectedTutor && <div className="text-muted-foreground mt-auto flex items-start gap-3 border-t px-6 py-4 text-xs">
              <FileClockIcon className="mt-0.5 size-4 shrink-0" />
              <p>Versioned academic records retain the parsed reading and history. Private notes keep the original file so you can open or delete it here.</p>
            </div>}
          </aside>
      </section>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className={`max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 ${uploadMode === "academic" ? "sm:max-w-[56rem]" : "sm:max-w-[38rem]"}`} showCloseButton>
          <DialogHeader className="border-b px-6 py-5 pr-14">
            <DialogTitle className="text-[18px]">{uploadMode === "choose" ? "Upload a document" : uploadMode === "private" ? "Add a private source" : uploadKind ? `Add ${KIND_LABELS[uploadKind] ?? "document"} version` : "Add an academic record"}</DialogTitle>
            <DialogDescription>{uploadMode === "private" ? "Store a personal note or reference so Tutor can retrieve it in future conversations." : uploadMode === "choose" ? "Choose whether this updates your academic record or becomes a private Tutor source." : "Read a new source, review every proposed change, then decide what enters your plan."}</DialogDescription>
          </DialogHeader>
          {uploadMode === "choose" ? (
            <div>
              <button type="button" onClick={() => setUploadMode("academic")} className="hover:bg-muted/45 flex w-full items-start gap-4 border-b px-6 py-5 text-left">
                <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md"><FileClockIcon className="size-[18px]" /></span>
                <span><strong className="block text-sm">Academic record</strong><span className="text-muted-foreground mt-1 block text-sm">Transcript, Academic Work, calendar, exam schedule or timetable. Changes are reviewed and versioned.</span></span>
              </button>
              <button type="button" onClick={() => setUploadMode("private")} className="hover:bg-muted/45 flex w-full items-start gap-4 px-6 py-5 text-left">
                <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md"><LockKeyholeIcon className="size-[18px]" /></span>
                <span><strong className="block text-sm">Private study source</strong><span className="text-muted-foreground mt-1 block text-sm">Personal notes, handouts, screenshots or reference files. Stored privately and searchable by Tutor.</span></span>
              </button>
            </div>
          ) : uploadMode === "private" ? (
            <div>
              <label className="hover:bg-muted/45 flex cursor-pointer items-center gap-4 border-b px-6 py-5">
                <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-md"><UploadIcon className="size-[18px]" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm">Choose files</strong><span className="text-muted-foreground mt-1 block text-sm">PDF, DOCX, image, Markdown or text. Up to 12 MB each.</span></span>
                <input className="sr-only" type="file" multiple accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.gif,.heic,.txt,.md,.csv,.ics,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,text/*" disabled={privateUploading} onChange={uploadPrivateSources} />
              </label>
              <div className="flex items-start gap-3 px-6 py-4 text-xs text-muted-foreground">
                <LockKeyholeIcon className="mt-0.5 size-4 shrink-0" />
                <p>The original and its searchable index are tied to your account. Deleting the source, erasing your data or deleting your account removes both.</p>
              </div>
              {privateUploading && <p className="border-t px-6 py-4 text-sm">Reading and indexing your files…</p>}
              {privateUploadError && <p className="border-t px-6 py-4 text-sm" role="alert">{privateUploadError}</p>}
            </div>
          ) : <div className="px-6 pb-6">
            {academics.data?.workspace ? (
              <PlanningDocuments
                workspace={academics.data.workspace}
                onWorkspace={() => academics.reload()}
                showConnections={false}
                showAcademicRecord={true}
                showAcademicRecordSummary={false}
                focusedKind={uploadKind}
                onRecorded={reload}
              />
            ) : academics.error ? (
              <p role="alert" className="text-sm">Your academic record could not be loaded. {academics.error}</p>
            ) : (
              <Skeleton className="h-72 w-full" />
            )}
          </div>}
        </DialogContent>
      </Dialog>

      <Confirm
        open={Boolean(removing)}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Remove this document version?"
        description="The saved reading and its place in the progression history will be removed. Your current study plan will not be changed."
        word="REMOVE"
        action="Remove version"
        busy={busy}
        error={removeError}
        onConfirm={removeVersion}
      />
      <Confirm
        open={Boolean(removingTutor)}
        onOpenChange={(open) => { if (!open) setRemovingTutor(null); }}
        title="Delete this private source?"
        description="The original file and its searchable retrieval index will be removed. Tutor will no longer be able to cite it. Your existing conversations are not changed."
        word="REMOVE"
        action="Delete source"
        busy={busy}
        error={removeError}
        onConfirm={removeTutorSource}
      />
    </div>
  );
}
