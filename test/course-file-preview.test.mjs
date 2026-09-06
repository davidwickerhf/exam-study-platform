import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { previewCourseBytes } from "../lib/course-file-preview.mjs";
import { extracted } from "../lib/canvas-corpus-worker.mjs";
import {
  cleanMaterialName,
  courseFileMediaType,
  fileKind,
  needsExtractionUpgrade,
} from "../lib/course-file-types.mjs";
const exec = promisify(execFile);

test("notebook previews preserve cells and saved outputs without executing source or HTML", async () => {
  const result = await previewCourseBytes(
    Buffer.from(
      JSON.stringify({
        cells: [
          { cell_type: "markdown", source: ["# Lab"] },
          {
            cell_type: "code",
            source: ['raise Exception("never execute")'],
            outputs: [
              {
                data: {
                  "text/plain": ["42"],
                  "text/html": "<script>bad()</script>",
                },
              },
            ],
          },
        ],
      }),
    ),
    "lab.ipynb",
  );
  assert.equal(result.kind, "notebook");
  assert.equal(result.cells[1].outputs[0], "42");
  assert.match(result.cells[1].source, /never execute/);
  assert.doesNotMatch(JSON.stringify(result), /bad\(\)/);
  const limited = await previewCourseBytes(
    Buffer.from(
      JSON.stringify({
        cells: Array.from({ length: 151 }, () => ({ source: "hello" })),
      }),
    ),
    "lab.ipynb",
  );
  assert.equal(limited.cells.length, 150);
  assert.equal(limited.limited, true);
});

test("CSV previews preserve quoted cells and clearly disclose truncation", async () => {
  const result = await previewCourseBytes(
    Buffer.from('name,value\n"a,b",42\n' + "row,1\n".repeat(100)),
    "table.csv",
  );
  assert.equal(result.kind, "spreadsheet");
  assert.deepEqual(result.sheets[0].rows[1], ["a,b", "42"]);
  assert.equal(result.sheets[0].rows.length, 100);
  assert.equal(result.limited, true);
});

test("archive and Office previews retain structure, sparse columns and numeric slide order", async () => {
  const root = await mkdtemp(join(tmpdir(), "course-preview-test-"));
  try {
    await exec("python3", [
      "-c",
      `import zipfile,sys,os
root=sys.argv[1]
with zipfile.ZipFile(os.path.join(root,'lab.zip'),'w') as z:
 z.writestr('src/main.java','class Main { /* exercise */ }')
 z.writestr('../outside.py','bad')
 z.writestr('image.png',b'PNG')
with zipfile.ZipFile(os.path.join(root,'book.xlsx'),'w') as z:
 z.writestr('xl/workbook.xml','<workbook xmlns:r="urn:r"><sheets><sheet name="Scores" r:id="r1"/></sheets></workbook>')
 z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>')
 z.writestr('xl/worksheets/sheet1.xml','<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="C1"><v>42</v></c></row></sheetData></worksheet>')
with zipfile.ZipFile(os.path.join(root,'deck.pptx'),'w') as z:
 for n in [10,2,1]: z.writestr('ppt/slides/slide'+str(n)+'.xml','<slide><t>Slide '+str(n)+'</t></slide>')`,
      root,
    ]);
    const zip = await readFile(join(root, "lab.zip"));
    const inventory = await previewCourseBytes(zip, "lab.zip");
    assert.equal(inventory.kind, "archive");
    assert.equal(inventory.entries[0].readable, true);
    assert.equal(inventory.entries[1].readable, false);
    assert.match(
      (await previewCourseBytes(zip, "lab.zip", "src/main.java")).text,
      /class Main/,
    );
    assert.equal(
      (await previewCourseBytes(zip, "lab.zip", "../outside.py")).kind,
      "unsupported",
    );
    const workbook = await previewCourseBytes(
      await readFile(join(root, "book.xlsx")),
      "book.xlsx",
    );
    assert.deepEqual(workbook.sheets[0], {
      name: "Scores",
      rows: [["Name", "", "42"]],
    });
    const slides = await previewCourseBytes(
      await readFile(join(root, "deck.pptx")),
      "deck.pptx",
    );
    assert.deepEqual(slides.pages, ["Slide 1", "Slide 2", "Slide 10"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("code formats are indexed and recognizable; legacy unsupported assets are upgraded", async () => {
  for (const name of [
    "Main.java",
    "exercise.cpp",
    "analysis.jl",
    "app.ts",
    "Dockerfile",
  ]) {
    const result = await extracted(
      Buffer.from("Exercise: implement graph traversal."),
      name,
    );
    assert.equal(result.status, "complete", name);
    assert.equal(fileKind(name), "code");
    assert.match(courseFileMediaType(name), /^text\/plain/);
    assert.equal(
      needsExtractionUpgrade(name, { extraction_status: "unsupported" }),
      true,
    );
  }
  assert.equal(
    cleanMaterialName("004 Python_Basics--file-6587501.ipynb"),
    "Python Basics",
  );
  assert.equal(
    needsExtractionUpgrade("code.zip", {
      extraction_status: "complete",
      metadata: {},
    }),
    true,
  );
  assert.equal(
    needsExtractionUpgrade("code.zip", {
      extraction_status: "complete",
      metadata: { fileFormatVersion: 2 },
    }),
    false,
  );
  assert.equal(
    needsExtractionUpgrade("image.png", { extraction_status: "unsupported" }),
    false,
  );
});
