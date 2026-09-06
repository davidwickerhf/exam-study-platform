import formats from "./course-file-formats.json" with { type: "json" };
export const fileExtension = (name) =>
  String(name || "")
    .split("/")
    .at(-1)
    .split(".")
    .at(-1)
    .toLowerCase();
export const isCodeFile = (name) =>
  formats.code.includes(fileExtension(name)) ||
  /(?:^|\/)(?:makefile|dockerfile)$/i.test(name);
export const isTextFile = (name) =>
  isCodeFile(name) || formats.text.includes(fileExtension(name));
export const supportsTextExtraction = (name) =>
  isTextFile(name) ||
  formats.structured.includes(fileExtension(name)) ||
  fileExtension(name) === "pdf";
export function fileKind(name, mediaType = "") {
  const ext = fileExtension(name);
  if (ext === "ipynb") return "notebook";
  if (["xlsx", "xls", "csv", "tsv"].includes(ext)) return "spreadsheet";
  if (ext === "zip") return "archive";
  if (["pptx", "ppt"].includes(ext)) return "slides";
  if (isCodeFile(name)) return "code";
  if (mediaType.startsWith("video/")) return "video";
  if (mediaType.startsWith("audio/")) return "audio";
  if (mediaType.startsWith("image/")) return "image";
  return "document";
}
export function cleanMaterialName(name) {
  return (
    String(name || "Course material")
      .split("/")
      .at(-1)
      .replace(/^\d{3,}\s+/, "")
      .replace(
        /--(?:links-)?(?:file|course|assignment|discussion|quiz|page|module)-[\w-]+(?=\.[^.]+$)/i,
        "",
      )
      .replace(/\.[a-z\d]{1,10}$/i, "")
      .replace(/_/g, " ")
      .trim() || "Course material"
  );
}
export function courseFileMediaType(name) {
  const ext = fileExtension(name);
  if (ext === "ipynb") return "application/x-ipynb+json";
  if (ext === "zip") return "application/zip";
  if (ext === "tsv") return "text/tab-separated-values; charset=utf-8";
  if (
    isCodeFile(name) ||
    (isTextFile(name) && !["html", "htm", "md"].includes(ext))
  )
    return "text/plain; charset=utf-8";
  return null;
}

export function needsExtractionUpgrade(name, asset) {
  const ext = fileExtension(name);
  return (
    supportsTextExtraction(name) &&
    (asset.extraction_status === "unsupported" ||
      (["zip", "pptx"].includes(ext) && asset.metadata?.fileFormatVersion !== 3))
  );
}
