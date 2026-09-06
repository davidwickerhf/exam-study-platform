"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeftIcon,
  FileCodeIcon,
  FolderIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
type Preview = {
  kind: string;
  text?: string;
  notice?: string;
  limited?: boolean;
  language?: string;
  cells?: {
    type: string;
    source: string;
    outputs: string[];
    images?: string[];
  }[];
  sheets?: { name: string; rows: string[][] }[];
  pages?: string[];
  entries?: {
    name: string;
    size: number;
    directory: boolean;
    readable: boolean;
  }[];
  total?: number;
};
export default function CourseFileViewer({ assetId }: { assetId: string }) {
  const [data, setData] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [member, setMember] = useState(""),
    [sheet, setSheet] = useState(0),
    [search, setSearch] = useState("");
  const cache = useRef(new Map<string, Preview>());
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const key = assetId + ":" + member;
    let active = true;
    const controller = new AbortController();
    setError("");
    setSheet(0);
    const cached = cache.current.get(key);
    if (cached) {
      setData(cached);
      return;
    }
    setData(null);
    const timer = setTimeout(() => controller.abort(), 40000);
    fetch(
      `/api/corpus/assets/${encodeURIComponent(assetId)}/preview${member ? `?member=${encodeURIComponent(member)}` : ""}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Preview unavailable.");
        return body as Preview;
      })
      .then((body) => {
        if (!active) return;
        if (cache.current.size >= 8)
          cache.current.delete(cache.current.keys().next().value!);
        cache.current.set(key, body);
        setData(body);
      })
      .catch((error) => {
        if (active)
          setError(
            controller.signal.aborted
              ? "The preview took too long. Try again or download the original."
              : error.message,
          );
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [assetId, member, retry]);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {member && (
        <div className="mb-3 flex min-w-0 items-center gap-3">
          <Button size="sm" variant="ghost" onClick={() => setMember("")}>
            <ArrowLeftIcon className="size-4" />
            Archive
          </Button>
          <span
            className="truncate text-xs text-muted-foreground"
            title={member}
          >
            {member}
          </span>
        </div>
      )}
      {error ? (
        <div className="p-5">
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      ) : !data ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"
        >
          <LoaderCircleIcon className="size-4 animate-spin" />
          Preparing preview…
        </div>
      ) : (
        <>
          {(data.notice || data.limited) && (
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              {data.notice}{" "}
              {data.limited &&
                "Showing a limited preview. Download the original for the full content."}
            </p>
          )}
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
            {data.kind === "notebook" ? (
              <div className="divide-y">
                {data.cells?.map((cell, index) => (
                  <section key={index} className="p-5">
                    <p className="mb-3 text-xs text-muted-foreground">
                      Cell {index + 1} · {cell.type}
                      {cell.type === "code" && data.language
                        ? ` · ${data.language}`
                        : ""}
                    </p>
                    {cell.type === "markdown" ? (
                      <div className="prose max-w-none text-sm leading-7 [&_h1]:text-xl [&_h2]:text-lg [&_p]:my-2 [&_a]:text-primary">
                        <ReactMarkdown
                          components={{
                            img: () => (
                              <span className="text-muted-foreground">
                                [Image in original notebook]
                              </span>
                            ),
                          }}
                        >
                          {cell.source}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <Code text={cell.source} />
                    )}
                    {cell.outputs.map((output, i) => (
                      <div key={i} className="mt-3 border-t pt-3">
                        <p className="mb-2 text-xs text-muted-foreground">
                          Saved output
                        </p>
                        <Code text={output} />
                      </div>
                    ))}
                    {cell.images?.map((image, i) => (
                      <img
                        key={i}
                        src={image}
                        alt={`Saved output for cell ${index + 1}`}
                        className="mt-3 max-h-96 max-w-full object-contain"
                      />
                    ))}
                  </section>
                ))}
              </div>
            ) : data.kind === "spreadsheet" ? (
              <>
                <div
                  className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b bg-card p-2"
                  aria-label="Worksheets"
                >
                  {data.sheets?.map((item, index) => (
                    <Button
                      key={index}
                      size="sm"
                      variant={index === sheet ? "secondary" : "ghost"}
                      aria-pressed={index === sheet}
                      onClick={() => setSheet(index)}
                    >
                      {item.name}
                    </Button>
                  ))}
                </div>
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="p-3 text-left text-muted-foreground">
                    {data.sheets?.[sheet]?.name} · Up to 100 rows and 40
                    columns. Saved values only.
                  </caption>
                  <thead>
                    <tr>
                      <th className="border-b bg-muted p-2" aria-label="Row" />
                      {Array.from(
                        {
                          length: Math.max(
                            0,
                            ...(data.sheets?.[sheet]?.rows.map(
                              (row) => row.length,
                            ) || []),
                          ),
                        },
                        (_, i) => (
                          <th
                            key={i}
                            scope="col"
                            className="border-b border-r bg-muted px-3 py-2 font-normal text-muted-foreground"
                          >
                            {i < 26
                              ? String.fromCharCode(65 + i)
                              : "A" + String.fromCharCode(65 + i - 26)}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.sheets?.[sheet]?.rows.map((row, i) => (
                      <tr key={i} className="border-b">
                        <th
                          scope="row"
                          className="sticky left-0 w-10 border-r bg-muted px-3 py-2 font-normal text-muted-foreground"
                        >
                          {i + 1}
                        </th>
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="min-w-28 max-w-80 whitespace-pre-wrap break-words border-r px-3 py-2 align-top"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : data.kind === "archive" ? (
              <>
                <div className="sticky top-0 border-b bg-card p-3">
                  <label className="sr-only" htmlFor="archive-search">
                    Find a file in this archive
                  </label>
                  <input
                    id="archive-search"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="Find a file in this archive…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <ul className="divide-y">
                  {data.entries
                    ?.filter((entry) =>
                      entry.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((entry, i) => (
                      <li
                        key={i}
                        className="flex min-w-0 items-center gap-3 px-4 py-3 text-sm"
                      >
                        {entry.directory ? (
                          <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <FileCodeIcon className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 break-all">
                          {entry.name}
                        </span>
                        {entry.readable ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setMember(entry.name)}
                          >
                            View
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {entry.directory ? "Folder" : "In original"}
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
                <p className="p-4 text-xs text-muted-foreground">
                  {data.total} archive entries. Files are inspected without
                  running code or extracting to your device.
                </p>
              </>
            ) : data.kind === "slides" ? (
              <div className="divide-y">
                {data.pages?.map((page, i) => (
                  <section key={i} className="p-6">
                    <h3 className="mb-4 text-xs font-semibold text-muted-foreground">
                      Slide {i + 1}
                    </h3>
                    <p className="whitespace-pre-wrap text-sm leading-7">
                      {page ||
                        "No text on this slide. See the original for its graphics."}
                    </p>
                  </section>
                ))}
              </div>
            ) : (
              <div className="p-5">
                <Code text={data.text || "No text available."} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
function Code({ text }: { text: string }) {
  return (
    <pre className="overflow-x-auto whitespace-pre text-xs leading-6 [tab-size:4]">
      <code>{text}</code>
    </pre>
  );
}
