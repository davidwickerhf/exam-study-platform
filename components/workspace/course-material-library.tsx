"use client";

import { useFeedback } from "@/components/feedback/feedback";
import dynamic from "next/dynamic";
import {
  cleanMaterialName,
  fileKind,
  fileExtension,
} from "@/lib/course-file-types.mjs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DownloadIcon,
  FileIcon,
  FileCodeIcon,
  FileSpreadsheetIcon,
  FolderArchiveIcon,
  NotebookIcon,
  PresentationIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  MoreHorizontalIcon,
  MessageSquareIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
const CoursePdfViewer = dynamic(() => import('./course-pdf-viewer'), { ssr: false });
const CoursePresentationViewer = dynamic(() => import('./course-presentation-viewer'), { ssr: false });
const CourseFileViewer = dynamic(() => import("./course-file-viewer"), { ssr: false });
const iconFor = (kind: string) =>
  ({
    notebook: NotebookIcon,
    code: FileCodeIcon,
    spreadsheet: FileSpreadsheetIcon,
    archive: FolderArchiveIcon,
    slides: PresentationIcon,
    video: PlayIcon,
  })[kind] || FileIcon;

export function CourseMaterialLibrary({
  courseCode,
  courseCodes = [],
  academicYear,
  revision = 0,
}: {
  courseCode: string;
  courseCodes?: string[];
  academicYear?: string;
  revision?: number;
}) {
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState("all");
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const giveFeedback = useFeedback();
  const [preview, setPreview] = useState<Material | null>(null);

  const [reload, setReload] = useState(0);
  const codeKey = JSON.stringify(
    [
      ...new Set(
        [courseCode, ...courseCodes]
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean),
      ),
    ].sort(),
  );
  const load = () => setReload((value) => value + 1);

  useEffect(() => {
    setYear(academicYear || "all");
    setKind("all");
    setPreview(null);
  }, [codeKey, academicYear]);

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    setError(null);
    setMaterials(null);
    Promise.all(
      (JSON.parse(codeKey) as string[]).map((code) =>
        fetch(
          `/api/corpus/materials?courseCode=${encodeURIComponent(code)}${academicYear && !["all", "undated"].includes(academicYear) ? `&academicYear=${encodeURIComponent(academicYear)}` : ""}`,
          {
            headers: { accept: "application/json" },
            signal: controller.signal,
          },
        ).then(async (response) => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok)
            throw new Error(
              body.error || "Stored material could not be loaded.",
            );
          return (body.materials || []) as Material[];
        }),
      ),
    )
      .then((groups) => {
        if (!live) return;
        const unique = new Map(
          groups
            .flat()
            .map((item) => [
              item.snapshotId ||
                JSON.stringify([
                  item.assetId,
                  item.sourcePath,
                  item.academicYear,
                  item.period,
                ]),
              item,
            ]),
        );
        setMaterials(
          [...unique.values()].sort(
            (a, b) =>
              (b.academicYear || "").localeCompare(a.academicYear || "") ||
              a.filename.localeCompare(b.filename),
          ),
        );
        setPreview(current => current && ![...unique.values()].some(item => item.assetId === current.assetId) ? null : current);
      })
      .catch((cause: Error) => {
        if (live)
          setError(
            cause.name === "AbortError"
              ? "Loading material timed out. Try refreshing the list."
              : cause.message,
          );
      })
      .finally(() => clearTimeout(timer));
    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [codeKey, reload, academicYear, revision]);
  const years = useMemo(
    () =>
      [
        ...new Set(
          (materials || []).map((item) => item.academicYear || "undated"),
        ),
      ]
        .sort()
        .reverse(),
    [materials],
  );
  const kinds = useMemo(
    () =>
      [
        ...new Set(
          (materials || []).map((item) =>
            fileKind(item.filename, item.mediaType),
          ),
        ),
      ].sort(),
    [materials],
  );
  const shown = (materials || []).filter(
    (item) =>
      (year === "all" || (item.academicYear || "undated") === year) &&
      (kind === "all" || fileKind(item.filename, item.mediaType) === kind) &&
      (!query ||
        `${cleanMaterialName(item.filename)} ${item.sourcePath}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-2">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            Course material
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {academicYear && academicYear !== "all"
              ? `Original documents and recordings · ${academicYear === "undated" ? "year not recorded" : academicYear}`
              : "Original documents and recordings, across all course editions."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!!materials?.length && (
            <>
              {!academicYear && (
                <Select
                  value={year}
                  onValueChange={(value) => setYear(value || "all")}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue>
                      {year === "all" ? "All years" : year}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {years.map((entry) => (
                      <SelectItem key={entry} value={entry}>
                        {entry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select
                value={kind}
                onValueChange={(value) => setKind(value || "all")}
              >
                <SelectTrigger className="w-36">
                  <SelectValue>
                    {kind === "all"
                      ? "All material"
                      : `${kind[0]?.toUpperCase()}${kind.slice(1)}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All material</SelectItem>
                  {kinds.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry[0]?.toUpperCase()}
                      {entry.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={load}
            aria-label="Refresh material list"
            title="Refresh material list"
          >
            <RefreshCwIcon className="size-4" />
          </Button>
        </div>
      </div>

      {!!materials?.length && (
        <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
          <SearchIcon className="size-4 text-muted-foreground" />
          <span className="sr-only">Search course material</span>
          <input
            className="w-full bg-transparent text-sm outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search material by name or folder…"
          />
        </label>
      )}

      {error ? (
        <p role="alert" className="text-sm font-medium">
          {error}
        </p>
      ) : !materials ? (
        <div className="grid gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : !materials.length ? (
        // Nothing stored is still a row of the register, not a box inside a
        // box: one line of what is missing with its action beside it, held
        // between the same hairlines the material rows would have used.
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-y py-3">
          <p className="text-muted-foreground min-w-0 text-sm">
            No stored material for this selection. Collect an available Canvas
            edition above, or switch academic years.
          </p>
          <Link
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href="/app/settings?tab=connections"
          >
            Open Canvas settings
          </Link>
        </div>
      ) : !shown.length ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No material matches these filters.
        </p>
      ) : (
        <ul className="border-t">
          {shown.map((item) => {
            const format = fileKind(item.filename, item.mediaType),
              Icon = iconFor(format),
              title = cleanMaterialName(item.filename);
            return (
              <li
                key={
                  item.snapshotId ||
                  JSON.stringify([
                    item.assetId,
                    item.sourcePath,
                    item.academicYear,
                    item.period,
                  ])
                }
                className="group flex min-w-0 items-center gap-3 border-b py-4 hover:bg-muted/20"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted/60 text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <button
                  className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={() => setPreview(item)}
                >
                  <span
                    className="block truncate text-sm font-medium group-hover:text-primary"
                    title={title}
                  >
                    {title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {[
                      fileExtension(item.filename).toUpperCase(),
                      size(item.byteSize),
                      !academicYear || academicYear === "all"
                        ? item.academicYear
                        : null,
                      !item.current ? "Earlier snapshot" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
                <a
                  className={buttonVariants({
                    variant: "ghost",
                    size: "icon-sm",
                  })}
                  href={item.downloadUrl}
                  aria-label={`Download ${title}`}
                  title="Download original"
                >
                  <DownloadIcon className="size-4" />
                </a>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`More options for ${title}`}
                      />
                    }
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        giveFeedback({
                          subject: {
                            kind: "material",
                            assetId: item.assetId,
                            courseCode,
                            academicYear: item.academicYear || undefined,
                          },
                        })
                      }
                    >
                      <MessageSquareIcon className="size-4" />
                      Report an issue
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="flex h-[88dvh] w-[94vw] max-w-[1100px] flex-col sm:max-w-[1100px]">
          <DialogHeader>
            <DialogTitle className="pr-8 text-xl">
              {preview ? cleanMaterialName(preview.filename) : "Material"}
            </DialogTitle>
            <DialogDescription>
              {[
                preview?.academicYear,
                preview?.period ? `Period ${preview.period.replace(/^P/i, "")}` : null,
                preview ? size(preview.byteSize) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </DialogDescription>
          </DialogHeader>
          {preview?.mediaType.startsWith("video/") ? (
            <video
              className="min-h-0 flex-1 bg-black object-contain"
              src={preview.url}
              controls
            />
          ) : preview?.mediaType.startsWith("audio/") ? (
            <audio className="w-full" src={preview.url} controls />
          ) : preview?.mediaType.startsWith("image/") ? (
            <img
              className="min-h-0 flex-1 object-contain"
              src={preview.url}
              alt={preview.filename}
            />
          ) : preview && (preview.mediaType === "application/pdf" || fileExtension(preview.filename) === "pdf") ? (
            <CoursePdfViewer url={preview.url} title={preview.filename} />
          ) : preview && ["ppt", "pptx"].includes(fileExtension(preview.filename)) ? (
            <CoursePresentationViewer assetId={preview.assetId} title={preview.filename} />
          ) : preview ? (
            <CourseFileViewer assetId={preview.assetId} />
          ) : null}
          {preview && (
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <p
                className="min-w-0 truncate text-xs text-muted-foreground"
                title={preview.filename}
              >
                {preview.filename}
              </p>
              <a
                className={buttonVariants({ variant: "outline", size: "sm" })}
                href={preview.downloadUrl}
              >
                <DownloadIcon className="size-4" />
                Original
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
