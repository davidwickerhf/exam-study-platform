"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckIcon, FileIcon, ShieldIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/workspace/account.mjs";
import { localIsoDate } from "@/lib/workspace/home.mjs";
import { currentRequest, REQUEST_CHUNK_BYTES, REQUEST_STATUS_LABEL, requestPayload, stageState, validateRequestFiles } from "@/lib/workspace/course-request.mjs";

type Course = { id: string; code?: string; name: string; period?: string; inferredFromTimetable?: boolean };
type Request = { id: string; status: string; pipelineStage: string; updatedAt: string; contributionConsent: boolean };
type Option = [string, string];
type Stage = { id: string; label: string; detail?: string };
type StudyCourse = { id: string; code?: string; name: string };

const NUMERALS = "font-data tabular-nums";

async function json(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { accept: "application/json", ...init?.headers } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `${path} returned ${response.status}`);
  return data;
}

function normalCode(value?: string) { return String(value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase(); }
function bufferAsBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer); let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 8192, bytes.length)));
  return btoa(binary);
}
async function uploadFile(requestId: string, file: File, report: (value: string) => void) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const totalChunks = Math.ceil(file.size / REQUEST_CHUNK_BYTES);
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    report(`${Math.round((chunkIndex / totalChunks) * 100)}%`);
    const start = chunkIndex * REQUEST_CHUNK_BYTES;
    await json(`/api/course-content-requests/${encodeURIComponent(requestId)}/files`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileId: sha256, name: file.name, type: file.type, size: file.size, sha256, chunkIndex, totalChunks, base64: bufferAsBase64(await file.slice(start, Math.min(start + REQUEST_CHUNK_BYTES, file.size)).arrayBuffer()) }) });
  }
}

export default function CourseRequestPage() {
  const { academicCourseId } = useParams<{ academicCourseId: string }>();
  const [course, setCourse] = useState<Course | null | undefined>();
  const [editorial, setEditorial] = useState<StudyCourse | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [licenses, setLicenses] = useState<Option[]>([]);
  const [academicYear, setAcademicYear] = useState("");
  const [period, setPeriod] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [urls, setUrls] = useState(""); const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]); const [consent, setConsent] = useState(false); const [license, setLicense] = useState("own-notes");
  const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState("");

  const loadRequests = async (id: string) => {
    const data = await json(`/api/course-content-requests?courseId=${encodeURIComponent(id)}`);
    setRequests(data.requests ?? []); setStages(data.stages ?? []); setCategories(data.categories ?? []); setLicenses(data.contributionLicenses ?? []);
  };
  useEffect(() => {
    let live = true;
    Promise.all([json("/api/academics"), json(`/api/calendar/events?date=${localIsoDate()}`).catch(() => ({})), json("/api/state")])
      .then(async ([academic, calendar, state]) => {
        if (!live) return;
        let found: Course | undefined = academic.workspace?.courses?.find((item: Course) => item.id === academicCourseId);
        if (!found && academicCourseId.startsWith("inferred:")) {
          const evidence = calendar.periodCourses?.find((item: { code: string; name?: string; teaching?: boolean }) => item.teaching && normalCode(item.code) === normalCode(academicCourseId.slice(9)));
          if (evidence) found = { id: academicCourseId, code: evidence.code, name: evidence.name || evidence.code, period: calendar.academicContext?.period || "", inferredFromTimetable: true };
        }
        setCourse(found ?? null); setAcademicYear(calendar.academicContext?.academicYear || academic.workspace?.profile?.academicYear || ""); setPeriod(calendar.academicContext?.period || found?.period || "");
        setEditorial((state.courses ?? []).find((item: StudyCourse) => normalCode(item.code) === normalCode(found?.code)) ?? null);
        if (found) await loadRequests(found.id);
      }).catch((cause: Error) => { if (live) { setError(cause.message); setCourse(null); } });
    return () => { live = false; };
  }, [academicCourseId]);
  const latest = useMemo(() => currentRequest(requests), [requests]);

  const addFiles = (list: FileList | null) => { try { setFiles(validateRequestFiles(files, [...(list ?? [])])); setError(null); } catch (cause) { setError((cause as Error).message); } };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!course || busy) return; setBusy(true); setError(null); setNotice(null); setProgress("Sending request…");
    try {
      const payload = requestPayload({ course, academicYear, period, categories: selected, urls, notes, consent, license, files });
      const result = await json("/api/course-content-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      for (let index = 0; index < files.length; index += 1) await uploadFile(result.request.id, files[index], (value) => setProgress(`Uploading ${index + 1} of ${files.length} · ${value}`));
      await loadRequests(course.id); setFiles([]); setSelected([]); setUrls(""); setNotes(""); setConsent(false); setLicense("own-notes"); setNotice(`Request received with ${files.length} source file${files.length === 1 ? "" : "s"}.`); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); setProgress(""); }
  };
  const withdraw = async () => {
    if (!latest || !confirm("Withdraw shared-use permission? The private request remains open.")) return;
    setBusy(true); setError(null); try { await json(`/api/course-content-requests/${encodeURIComponent(latest.id)}/contribution`, { method: "DELETE" }); await loadRequests(course!.id); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };

  if (course === undefined) return <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 p-5 sm:p-8"><Skeleton className="h-12 w-96"/><Skeleton className="h-5 w-72"/><Skeleton className="h-80 w-full"/></div>;
  if (!course) return <div className="mx-auto w-full max-w-[1180px] p-5 sm:p-8"><Empty><EmptyHeader><EmptyTitle>Course not found</EmptyTitle><EmptyDescription>{error ?? "This course is no longer in your academic record or timetable."}</EmptyDescription></EmptyHeader><Link className={buttonVariants({ variant: "secondary" })} href="/app/planning?tab=courses">Review courses</Link></Empty></div>;
  if (editorial) return <div className="mx-auto w-full max-w-[1180px] p-5 sm:p-8"><Empty><EmptyHeader><CheckIcon/><EmptyTitle>Material is available for {course.code || course.name}</EmptyTitle><EmptyDescription>This course now has maintained study content.</EmptyDescription></EmptyHeader><Link className={buttonVariants()} href={`/app/courses/${encodeURIComponent(editorial.id)}`}>Open course</Link></Empty></div>;

  return <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 p-5 sm:p-8">
    <header className="flex flex-col gap-2 border-b pb-6"><Link className="text-muted-foreground w-fit text-sm" href="/app/planning?tab=courses">← Courses</Link><h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">{course.code ? `${course.code} · ` : ""}{course.name}</h1><p className="text-muted-foreground max-w-3xl">{course.inferredFromTimetable ? "Your live timetable identifies this as a current teaching course. " : "This course is in your academic record. "}Maintained study content is not available yet.</p></header>
    {notice && <Alert><CheckIcon/><AlertTitle>Request received</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>}
    {latest && <section className="flex flex-col gap-5 border-b pb-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">{REQUEST_STATUS_LABEL[latest.status] ?? latest.status}</h2><p className={`text-muted-foreground text-sm ${NUMERALS}`}>Request {latest.id.slice(0, 8)} · Updated {new Date(latest.updatedAt).toLocaleDateString()}</p><p className="text-muted-foreground mt-2 max-w-2xl text-sm">{latest.contributionConsent ? "You offered these sources for shared editorial review; originals remain restricted to authorised administrators." : "Your sources are private to this request and cannot be used for a shared course without your permission."}</p></div>{latest.contributionConsent && <Button variant="secondary" disabled={busy} onClick={() => void withdraw()}>Withdraw shared-use permission</Button>}</div><ol className="grid gap-3 md:grid-cols-4" aria-label="Course ingestion progress">{stageState(stages, latest).map((stage, index) => <li key={stage.id} className="flex gap-3 border-t pt-3"><span className={`flex size-6 shrink-0 items-center justify-center border text-xs ${NUMERALS}`}>{stage.state === "complete" ? <CheckIcon className="size-3"/> : index + 1}</span><span><strong className="text-sm">{stage.label}</strong>{stage.detail && <small className="text-muted-foreground block">{stage.detail}</small>}</span></li>)}</ol></section>}
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]"><main><form className="flex flex-col gap-6" onSubmit={(event) => void submit(event)}><div><h2 className="text-2xl font-semibold">{latest ? "Add more course evidence" : "Request this course"}</h2><p className="text-muted-foreground text-sm">Source material helps the team align the course with your real assessment.</p></div>
      <fieldset className="flex flex-col gap-3"><legend className="mb-3 font-semibold">What can you provide?</legend><div className="grid gap-3 sm:grid-cols-2">{categories.map(([id,label]) => <label key={id} className="flex items-center gap-3 border p-3"><Checkbox checked={selected.includes(id)} onCheckedChange={(checked) => setSelected((value) => checked ? [...new Set([...value,id])] : value.filter((item) => item !== id))}/><span>{label}</span></label>)}</div></fieldset>
      <div className="flex flex-col gap-2"><Label htmlFor="request-urls">Source links <span className="text-muted-foreground font-normal">(one URL per line)</span></Label><Textarea id="request-urls" rows={3} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="Course page, syllabus, public reading list, shared folder…"/></div>
      <div className="flex flex-col gap-3"><Label htmlFor="request-files">Files</Label>{files.map((file,index) => <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 border-b pb-2"><FileIcon className="size-4"/><span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span><small className={`text-muted-foreground ${NUMERALS}`}>{formatBytes(file.size)}</small><Button type="button" size="icon" variant="ghost" aria-label={`Remove ${file.name}`} onClick={() => setFiles((value) => value.filter((_,i) => i !== index))}><Trash2Icon/></Button></div>)}<label className="flex cursor-pointer items-center gap-4 border border-dashed p-5" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}><UploadIcon/><span className="flex-1"><strong className="block">{files.length ? "Add or drop more files" : "Choose or drop course materials"}</strong><small className="text-muted-foreground">10 MB each, 30 MB total</small></span><Input id="request-files" className="sr-only" type="file" multiple accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp" disabled={busy} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}/></label>{files.length > 0 && <small className={`text-muted-foreground ${NUMERALS}`}>{formatBytes(files.reduce((sum,file) => sum + file.size, 0))} selected</small>}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="request-notes">What would make this course useful?</Label><Textarea id="request-notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Exam format, difficult topics, missing context, or curriculum edition…"/></div>
      <fieldset className="flex flex-col gap-4 border-y py-5"><legend className="px-2 font-semibold">Shared course contribution</legend><label className="flex items-start gap-3"><Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)}/><span><strong className="block text-sm">Let the editorial team consider these sources for the shared course</strong><small className="text-muted-foreground">Nothing is published automatically. Originals remain restricted to authorised administrators.</small></span></label>{consent ? <div className="flex flex-col gap-2"><Label>Why may we use them?</Label><Select value={license} onValueChange={(value) => value && setLicense(value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{licenses.map(([id,label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div> : <p className="text-muted-foreground text-sm">You can still send a private request. Its sources cannot be promoted into the shared library.</p>}</fieldset>
      {error && <Alert><AlertTitle>Request could not be sent</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}<div className="flex flex-wrap items-center justify-between gap-4"><p className="text-muted-foreground flex items-center gap-2 text-sm"><ShieldIcon className="size-4"/>{consent ? "You confirm you may provide these sources for this purpose." : "Files stay private to your request."}</p><Button disabled={busy} type="submit">{busy ? progress : latest ? "Add to request" : "Send request"}</Button></div>
    </form></main><aside className="flex flex-col gap-4 border-l pl-6"><h2 className="font-semibold">What the team builds</h2><ol className="text-muted-foreground flex list-decimal flex-col gap-3 pl-5 text-sm"><li>Source-grounded study pages</li><li>Worked examples and topic connections</li><li>Progressive exercises and practice sheets</li><li>Flashcards and representative mock exams</li><li>A reviewed, versioned course</li></ol></aside></div>
  </div>;
}
