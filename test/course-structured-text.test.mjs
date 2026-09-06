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

test('large numeric text chunks in bounded time and large CSV indexes an explicit profile',async()=>{
  const {stdout}=await exec(process.execPath,['--input-type=module','-e',`import {retrievalRecords} from './lib/canvas-corpus-worker.mjs'; const rows=retrievalRecords({text:'0123456789,'.repeat(3_700_000)}); console.log(rows.length);`],{timeout:8000,maxBuffer:1024})
  assert.ok(Number(stdout)>25000)
  const csv=Buffer.from('age,value\r'+'42,123456789\r'.repeat(100000))
  const result=await extracted(csv,'measurements.csv')
  assert.equal(result.status,'complete');assert.match(result.text,/100001 rows/)
  assert.match(result.text,/sample, not the full dataset/);assert.match(result.text,/age \| value/)
  assert.ok(result.text.length<12000)
})

test('large worksheets are streamed into a labelled profile, retaining late row counts',async()=>{
  const root=await mkdtemp(join(tmpdir(),'queue-large-sheet-'))
  try {
    await exec('python3',['-c',`import zipfile,sys
with zipfile.ZipFile(sys.argv[1],'w') as z:
 z.writestr('xl/workbook.xml','<workbook xmlns:r="urn:r"><sheets><sheet name="Measurements" r:id="r1"/></sheets></workbook>')
 z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>')
 with z.open('xl/worksheets/sheet1.xml','w') as f:
  f.write(b'<worksheet><sheetData>')
  for i in range(50000): f.write(('<row><c r="A'+str(i+1)+'"><v>'+str(i)+'</v></c></row>').encode())
  f.write(b'</sheetData></worksheet>')`,join(root,'large.xlsx')])
    const result=await extracted(await readFile(join(root,'large.xlsx')),'large.xlsx')
    assert.equal(result.status,'complete');assert.match(result.text,/50000 rows/)
    assert.match(result.text,/sample, not the full dataset/);assert.ok(result.text.length<12000)
  } finally {await rm(root,{recursive:true,force:true})}
})

test('image archives retain a searchable inventory without expanding binary members',async()=>{
  const root=await mkdtemp(join(tmpdir(),'queue-binary-archive-'))
  try {
    await exec('python3',['-c',`import zipfile,sys
with zipfile.ZipFile(sys.argv[1],'w',compression=zipfile.ZIP_DEFLATED) as z:
 with z.open('large-image.png','w') as f:
  for i in range(129): f.write(b'0'*(1024*1024))
 z.writestr('instructions.txt','Classify the images.')`,join(root,'images.zip')])
    const result=await extracted(await readFile(join(root,'images.zip')),'images.zip')
    assert.equal(result.status,'complete');assert.match(result.text,/Binary member retained/)
    assert.match(result.text,/Classify the images/)
  } finally {await rm(root,{recursive:true,force:true})}
})

test('large image collections use a bounded filename profile while retaining all readable instructions',async()=>{
  const root=await mkdtemp(join(tmpdir(),'queue-image-inventory-'))
  try {
    await exec('python3',['-c',`import zipfile,sys
with zipfile.ZipFile(sys.argv[1],'w') as z:
 for i in range(3000): z.writestr('images/dog-'+str(i)+'.jpg',b'not expanded')
 z.writestr('instructions.txt','Use all 3000 images for classification.')
with zipfile.ZipFile(sys.argv[2],'w') as z:
 for i in range(2001): z.writestr(str(i)+'.txt','a')`,join(root,'images.zip'),join(root,'too-many-texts.zip')])
    const result=await extracted(await readFile(join(root,'images.zip')),'images.zip')
    assert.equal(result.status,'complete');assert.match(result.text,/3000 binary members/)
    assert.match(result.text,/2800 names omitted/);assert.match(result.text,/not a complete file listing/)
    assert.match(result.text,/Use all 3000 images/);assert.ok(result.text.length<50000)
    const limited=await extracted(await readFile(join(root,'too-many-texts.zip')),'too-many-texts.zip')
    assert.equal(limited.status,'failed');assert.match(limited.error,/safe expansion limits/)
  } finally {await rm(root,{recursive:true,force:true})}
})
