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

test('slides keep formatting runs, percentages, table columns, speaker notes, visual gaps and presentation order', async () => {
  const root = await mkdtemp(join(tmpdir(), 'slide-evidence-'))
  try {
    await exec('python3', ['-c', `import zipfile,sys,pathlib
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(root/'evidence.pptx','w') as z:
 z.writestr('ppt/presentation.xml','<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="22" r:id="second"/><p:sldId id="11" r:id="first"/></p:sldIdLst></p:presentation>')
 z.writestr('ppt/_rels/presentation.xml.rels','<Relationships><Relationship Id="first" Target="slides/slide1.xml"/><Relationship Id="second" Target="slides/slide2.xml"/></Relationships>')
 z.writestr('ppt/slides/slide1.xml','<p:sld xmlns:p="p" xmlns:a="a"><p:sp><a:p><a:r><a:t>Second in presentation</a:t></a:r></a:p></p:sp></p:sld>')
 z.writestr('ppt/slides/slide2.xml','<p:sld xmlns:p="p" xmlns:a="a"><p:sp><a:p><a:r><a:t>C</a:t></a:r><a:r><a:t>ourse material</a:t></a:r></a:p><a:p><a:r><a:t>Written exam: 6</a:t></a:r><a:r><a:t>0%</a:t></a:r></a:p></p:sp><a:tbl><a:tr><a:tc><a:p><a:r><a:t>Task</a:t></a:r></a:p></a:tc><a:tc><a:p><a:r><a:t>Observable</a:t></a:r></a:p></a:tc></a:tr><a:tr><a:tc><a:p><a:r><a:t>Chess</a:t></a:r></a:p></a:tc><a:tc><a:p><a:r><a:t>Fully</a:t></a:r></a:p></a:tc></a:tr></a:tbl><p:pic><p:cNvPr descr="Agent environment diagram"/></p:pic></p:sld>')
 z.writestr('ppt/slides/_rels/slide2.xml.rels','<Relationships><Relationship Id="notes" Target="../notesSlides/notesSlide1.xml" Type="http://example/notesSlide"/></Relationships>')
 z.writestr('ppt/notesSlides/notesSlide1.xml','<p:notes xmlns:p="p" xmlns:a="a"><p:sp><p:ph type="body"/><a:p><a:r><a:t>This background section is not on the exam.</a:t></a:r></a:p></p:sp><p:sp><p:ph type="sldNum"/><a:p><a:r><a:t>9876</a:t></a:r></a:p></p:sp></p:notes>')`, root])
    const bytes = await readFile(join(root, 'evidence.pptx'))
    const preview = await previewCourseBytes(bytes, 'evidence.pptx'), retrieval = await extracted(bytes, 'evidence.pptx')
    assert.equal(retrieval.status, 'complete')
    assert.equal(retrieval.pages[0].page, 1)
    assert.equal(preview.pages[0], retrieval.pages[0].text)
    assert.match(preview.pages[0], /Course material\nWritten exam: 60%/)
    assert.match(preview.pages[0], /Task \| Observable\nChess \| Fully/)
    assert.match(preview.pages[0], /Speaker notes from original:\nThis background section is not on the exam/)
    assert.doesNotMatch(preview.pages[0], /9876/)
    assert.match(preview.pages[0], /visual meaning has not been analyzed/)
    assert.equal(preview.visualCoverage[0].images, 1)
    assert.equal(preview.pages[1], 'Second in presentation')
    assert.equal(needsExtractionUpgrade('deck.pptx', { extraction_status:'complete', metadata:{fileFormatVersion:2} }), true)
    assert.equal(needsExtractionUpgrade('deck.pptx', { extraction_status:'complete', metadata:{fileFormatVersion:3} }), false)
  } finally { await rm(root, { recursive:true, force:true }) }
})

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
      metadata: { fileFormatVersion: 3 },
    }),
    false,
  );
  assert.equal(
    needsExtractionUpgrade("image.png", { extraction_status: "unsupported" }),
    false,
  );
});
