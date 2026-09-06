import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { canvasCorpusAssetChunks } from "./course-corpus.mjs";
const exec = promisify(execFile);
export async function previewCourseBytes(bytes, filename, member = "") {
  if (bytes.length > 64 * 1024 * 1024)
    return {
      kind: "unsupported",
      text: "This original is too large for an interactive preview. Download it to view the full file.",
    };
  const directory = await mkdtemp(join(tmpdir(), "course-preview-"));
  try {
    const path = join(directory, "original");
    await writeFile(path, bytes);
    const { stdout } = await exec(
      "python3",
      [
        new URL("../scripts/preview-course-file.py", import.meta.url).pathname,
        path,
        filename,
        ...(member ? [member] : []),
      ],
      { timeout: 20000, maxBuffer: 3 * 1024 * 1024 },
    );
    return JSON.parse(stdout);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
export async function previewCourseAsset(asset, member = "") {
  if (asset.byteSize > 64 * 1024 * 1024)
    return {
      kind: "unsupported",
      text: "This original is too large for an interactive preview. Download it to view the full file.",
    };
  let bytes;
  if (asset.localObjectKey) {
    const root = resolve(
        process.env.CANVAS_CORPUS_ASSET_DIR || "data/corpus-assets",
      ),
      path = resolve(root, asset.localObjectKey);
    if (!path.startsWith(root + sep)) throw new Error("Invalid original path.");
    bytes = await readFile(path);
  } else {
    const chunks = [];
    let size = 0;
    for (let first = 0; first < asset.expectedChunks; first += 16) {
      const rows = await canvasCorpusAssetChunks({
        assetId: asset.id,
        first,
        last: Math.min(asset.expectedChunks - 1, first + 15),
      });
      for (const row of rows) {
        if (Number(row.chunk_index) !== chunks.length)
          throw new Error(
            "The original is incomplete. Retry this course sync.",
          );
        size += row.data.length;
        if (size > asset.byteSize || size > 64 * 1024 * 1024)
          throw new Error("Original size does not match its saved metadata.");
        chunks.push(Buffer.from(row.data));
      }
    }
    bytes = Buffer.concat(chunks);
  }
  if (bytes.length !== asset.byteSize)
    throw new Error("The original is incomplete. Retry this course sync.");
  return previewCourseBytes(bytes, asset.filename, member);
}
