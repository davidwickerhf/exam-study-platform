"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DownloadIcon, FileIcon, PlayIcon, RefreshCwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Material = {
  snapshotId?: string;
  assetId: string;
  filename: string;
  sourcePath: string;
  sourceType: string;
  mediaType: string;
  byteSize: number;
  academicYear: string;
  period: string;
  current: boolean;
  url: string;
  downloadUrl: string;
};

const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
const canPreview = (type: string) => /^(application\/pdf|video\/|audio\/|image\/|text\/)/.test(type);

export function CourseMaterialLibrary({ courseCode, courseCodes = [], academicYear, revision = 0 }: { courseCode: string; courseCodes?: string[]; academicYear?: string; revision?: number }) {
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState("all");
  const [kind, setKind] = useState("all");
  const [preview, setPreview] = useState<Material | null>(null);

  const [reload, setReload] = useState(0);
  const codeKey = JSON.stringify([...new Set([courseCode, ...courseCodes].map(code => code.trim().toUpperCase()).filter(Boolean))].sort());
  const load = () => setReload(value => value + 1);

  useEffect(() => { setYear(academicYear || "all"); setKind("all"); }, [codeKey, academicYear]);

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    setError(null); setMaterials(null); setPreview(null);
    Promise.all((JSON.parse(codeKey) as string[]).map(code =>
      fetch(`/api/corpus/materials?courseCode=${encodeURIComponent(code)}${academicYear && !['all', 'undated'].includes(academicYear) ? `&academicYear=${encodeURIComponent(academicYear)}` : ''}`, { headers: { accept: "application/json" }, signal: controller.signal })
        .then(async response => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error || "Stored material could not be loaded.");
          return (body.materials || []) as Material[];
        })
    )).then(groups => {
      if (!live) return;
      const unique = new Map(groups.flat().map(item => [(item.snapshotId || JSON.stringify([item.assetId, item.sourcePath, item.academicYear, item.period])), item]));
      setMaterials([...unique.values()].sort((a, b) => (b.academicYear || "").localeCompare(a.academicYear || "") || a.filename.localeCompare(b.filename)));
    }).catch((cause: Error) => {
      if (live) setError(cause.name === "AbortError" ? "Loading material timed out. Try refreshing the list." : cause.message);
    }).finally(() => clearTimeout(timer));
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [codeKey, reload, academicYear, revision]);
  const years = useMemo(() => [...new Set((materials || []).map((item) => item.academicYear || "undated"))].sort().reverse(), [materials]);
  const kinds = useMemo(() => [...new Set((materials || []).map((item) => item.sourceType))].sort(), [materials]);
  const shown = (materials || []).filter((item) => (year === "all" || (item.academicYear || "undated") === year) && (kind === "all" || item.sourceType === kind));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-2">
        <div>
          <h2 className="text-sm font-semibold">Course material</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">{academicYear && academicYear !== 'all' ? `Original documents and recordings · ${academicYear === 'undated' ? 'year not recorded' : academicYear}` : 'Original documents and recordings, across all course editions.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!!materials?.length && <>
            {!academicYear && <Select value={year} onValueChange={(value) => setYear(value || "all")}><SelectTrigger className="w-36"><SelectValue>{year === "all" ? "All years" : year}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All years</SelectItem>{years.map((entry) => <SelectItem key={entry} value={entry}>{entry}</SelectItem>)}</SelectContent></Select>}
            <Select value={kind} onValueChange={(value) => setKind(value || "all")}><SelectTrigger className="w-36"><SelectValue>{kind === "all" ? "All material" : `${kind[0]?.toUpperCase()}${kind.slice(1)}`}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All material</SelectItem>{kinds.map((entry) => <SelectItem key={entry} value={entry}>{entry[0]?.toUpperCase()}{entry.slice(1)}</SelectItem>)}</SelectContent></Select>
          </>}
          <Button variant="outline" size="sm" onClick={load}><RefreshCwIcon /> Refresh list</Button>
        </div>
      </div>

      {error ? <p role="alert" className="text-sm font-medium">{error}</p> : !materials ? <div className="grid gap-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : !materials.length ? (
        // Nothing stored is still a row of the register, not a box inside a
        // box: one line of what is missing with its action beside it, held
        // between the same hairlines the material rows would have used.
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-y py-3">
          <p className="text-muted-foreground min-w-0 text-sm">
            No stored material for this selection. Collect an available Canvas edition above, or switch academic years.
          </p>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/app/settings?tab=connections">Open Canvas settings</Link>
        </div>
      ) : !shown.length ? <p className="text-muted-foreground py-8 text-center text-sm">No material matches these filters.</p> : (
        <ul className="border-t">
          {shown.map((item) => (
            <li key={(item.snapshotId || JSON.stringify([item.assetId, item.sourcePath, item.academicYear, item.period]))} className="hover:bg-card grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b py-3 sm:grid-cols-[2rem_minmax(0,1fr)_8rem_5rem_auto]">
              <span className="text-muted-foreground grid size-8 place-items-center">{item.mediaType.startsWith("video/") ? <PlayIcon className="size-4" /> : <FileIcon className="size-4" />}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={item.filename}>{item.filename}</p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs sm:hidden">{[item.academicYear, item.period ? `P${item.period}` : null, item.sourceType, size(item.byteSize)].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="text-muted-foreground hidden text-xs tabular-nums sm:block">{item.academicYear || "Undated"}{item.period ? ` · P${item.period}` : ""}</span>
              <span className="text-muted-foreground hidden text-right text-xs tabular-nums sm:block">{size(item.byteSize)}</span>
              <span className="col-span-3 flex items-center justify-end gap-1 sm:col-span-1">
                {!item.current && <Badge variant="outline">Older</Badge>}
                {canPreview(item.mediaType) && <Button variant="ghost" size="sm" onClick={() => setPreview(item)}>Open</Button>}
                <a className={buttonVariants({ variant: "ghost", size: "icon-sm" })} href={item.downloadUrl} title="Download original" aria-label={`Download ${item.filename}`}><DownloadIcon /></a>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="flex h-[88vh] max-w-[min(1100px,94vw)] flex-col">
          <DialogHeader><DialogTitle>{preview?.filename}</DialogTitle><DialogDescription>{[preview?.academicYear, preview?.period ? `Period ${preview.period}` : null, preview ? size(preview.byteSize) : null].filter(Boolean).join(" · ")}</DialogDescription></DialogHeader>
          {preview?.mediaType.startsWith("video/") ? <video className="min-h-0 flex-1 bg-black object-contain" src={preview.url} controls /> : preview?.mediaType.startsWith("audio/") ? <audio className="w-full" src={preview.url} controls /> : preview?.mediaType.startsWith("image/") ? <img className="min-h-0 flex-1 object-contain" src={preview.url} alt={preview.filename} /> : preview ? <iframe className="min-h-0 flex-1 border" src={preview.url} title={preview.filename} /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
