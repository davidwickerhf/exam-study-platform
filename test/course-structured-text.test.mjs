import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extracted } from '../lib/canvas-corpus-worker.mjs'
const exec=promisify(execFile)
test('notebooks retain code and saved plain output without executing cells',async()=>{
  const source=Buffer.from(JSON.stringify({cells:[{cell_type:'markdown',source:['# Lab']},{cell_type:'code',source:['raise Exception("must never execute")'],outputs:[{data:{'text/plain':['Saved result: 42'],'image/png':'ignored'}}]}]}))
  const result=await extracted(source,'tutorial.ipynb')
  assert.equal(result.status,'complete');assert.match(result.text,/must never execute/);assert.match(result.text,/Saved result: 42/);assert.doesNotMatch(result.text,/image\/png/)
})
test('workbooks read sheets/shared strings and archives preserve readable member context',async()=>{
  const root=await mkdtemp(join(tmpdir(),'queue-extract-test-'))
  try {
    await exec('python3',['-c',`import zipfile,sys,os
root=sys.argv[1]
with zipfile.ZipFile(os.path.join(root,'book.xlsx'),'w') as z:
 z.writestr('xl/workbook.xml','<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Patients" r:id="rId1"/></sheets></workbook>')
 z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
 z.writestr('xl/sharedStrings.xml','<sst><si><t>Age</t></si></sst>')
 z.writestr('xl/worksheets/sheet1.xml','<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="A2"><v>42</v></c></row></sheetData></worksheet>')
with zipfile.ZipFile(os.path.join(root,'lab.zip'),'w') as z:
 z.writestr('instructions.txt','Complete exercises 1 and 2.')
 z.writestr('image.png',b'\\x89PNG\\0')
with zipfile.ZipFile(os.path.join(root,'unsafe.zip'),'w') as z: z.writestr('../outside.txt','unsafe')`,root])
    const workbook=await extracted(await readFile(join(root,'book.xlsx')),'book.xlsx')
    assert.equal(workbook.status,'complete');assert.match(workbook.text,/Sheet: Patients/);assert.match(workbook.text,/A1: Age/);assert.match(workbook.text,/A2: 42/)
    const archive=await extracted(await readFile(join(root,'lab.zip')),'lab.zip')
    assert.equal(archive.status,'complete');assert.match(archive.text,/Complete exercises/);assert.match(archive.text,/Binary member retained/)
    const unsafe=await extracted(await readFile(join(root,'unsafe.zip')),'unsafe.zip')
    assert.equal(unsafe.status,'failed');assert.match(unsafe.error,/original preserved/)
  } finally {await rm(root,{recursive:true,force:true})}
})
