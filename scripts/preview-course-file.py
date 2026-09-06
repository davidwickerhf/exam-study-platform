#!/usr/bin/env python3
"""Bounded, non-executing previews of saved course originals."""
import base64, csv, io, itertools, json, pathlib, re, sys, zipfile
from importlib.util import spec_from_file_location, module_from_spec
sys.dont_write_bytecode = True
spec=spec_from_file_location('extract', pathlib.Path(__file__).with_name('extract-course-text.py'))
extract=module_from_spec(spec); spec.loader.exec_module(extract)
MAX_TEXT=180000

def content(value):
    return ''.join(value) if isinstance(value,list) else str(value or '')

def preview(data,name,member=None):
    ext=pathlib.PurePosixPath(name).suffix.lower()
    if ext == '.zip':
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            infos=z.infolist()
            if len(infos)>extract.MAX_INVENTORY_ENTRIES: raise ValueError('This archive has too many entries to preview.')
            safe=lambda name: not (name.startswith(('/', '\\')) or '..' in pathlib.PurePosixPath(name.replace('\\','/')).parts)
            if member:
                if not safe(member): raise ValueError('Invalid archive member path.')
                info=z.getinfo(member)
                if pathlib.PurePosixPath(member).suffix.lower()=='.zip': return {'kind':'text','text':'Download the original to inspect this nested archive.','limited':True}
                return preview(extract.read_member(z,info),member)
            entries=[{'name':i.filename,'size':i.file_size,'directory':i.is_dir(),'readable':safe(i.filename) and not i.is_dir() and (pathlib.PurePosixPath(i.filename).suffix.lower() in extract.TEXT_EXTENSIONS+('.ipynb','.xlsx','.xls','.docx','.pptx','.csv','.tsv') or pathlib.PurePosixPath(i.filename).name.lower() in ('makefile','dockerfile'))} for i in infos[:1000]]
            return {'kind':'archive','entries':entries,'total':len(infos),'limited':len(infos)>1000}
    if ext=='.ipynb':
        notebook=json.loads(data); cells=[]; used=0; image_bytes=0; limited=False
        for cell in notebook.get('cells',[])[:150]:
            source=content(cell.get('source'))[:20000]; outputs=[]; images=[]
            limited=limited or len(content(cell.get('source')))>20000 or len(cell.get('outputs',[]))>10
            for output in cell.get('outputs',[])[:10]:
                text=content(output.get('text') or output.get('data',{}).get('text/plain') or output.get('traceback'))[:10000]
                if text: outputs.append(text)
                raw=output.get('data',{}).get('image/png','')
                if isinstance(raw,str) and len(raw)<550000:
                    try:
                        image=base64.b64decode(raw,validate=True)
                        if image.startswith(b'\x89PNG\r\n\x1a\n') and len(image)>24 and max(int.from_bytes(image[16:20],'big'),int.from_bytes(image[20:24],'big'))<=4096 and image_bytes+len(raw)<700000:
                            images.append('data:image/png;base64,'+raw); image_bytes+=len(raw)
                    except (ValueError,TypeError): pass
            used+=len(source)+sum(map(len,outputs))
            if used>MAX_TEXT: break
            cells.append({'type':cell.get('cell_type','raw'),'source':source,'outputs':outputs,'images':images})
        return {'kind':'notebook','cells':cells,'language':notebook.get('metadata',{}).get('language_info',{}).get('name',''),'limited':limited or len(cells)<len(notebook.get('cells',[])) or used>MAX_TEXT,'notice':'Saved cells, text outputs and PNG plots. Code is never executed; interactive outputs are available in the original notebook.'}
    if ext in ('.csv','.tsv'):
        csv.field_size_limit(8*1024*1024)
        rows=list(itertools.islice(csv.reader(io.StringIO(data.decode('utf-8-sig',errors='replace'),newline=''),delimiter='\t' if ext=='.tsv' else ','),101))
        return {'kind':'spreadsheet','sheets':[{'name':name,'rows':[[str(c)[:500] for c in row[:40]] for row in rows[:100]]}],'limited':len(rows)>100 or any(len(r)>40 or any(len(c)>500 for c in r) for r in rows)}
    if ext=='.xlsx':
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            def member(n): return extract.read_member(z,z.getinfo(n))
            strings=[''.join(node.itertext()) for node in extract.xml(member('xl/sharedStrings.xml'))] if 'xl/sharedStrings.xml' in z.namelist() else []
            relationships={n.attrib['Id']:n.attrib['Target'] for n in extract.xml(member('xl/_rels/workbook.xml.rels'))}
            sheets=[]; limited=False; used=0
            all_sheets=[n for n in extract.xml(member('xl/workbook.xml')).iter() if n.tag.split('}')[-1]=='sheet']
            for sheet in all_sheets[:12]:
                rid=next((v for k,v in sheet.attrib.items() if k.endswith('}id')),None); target=relationships.get(rid,'')
                target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
                if '..' in pathlib.PurePosixPath(target).parts: raise ValueError('Invalid workbook relationship.')
                source=list(itertools.islice(extract.workbook_rows(z,target,strings),101)); rows=[]
                for row in source[:100]:
                    result=[]
                    for cell in row:
                        match=re.match(r'^([A-Z]+)\d+: (.*)$',cell,re.S)
                        if not match: continue
                        col=0
                        for ch in match[1]: col=col*26+ord(ch)-64
                        if col>40: limited=True; continue
                        while len(result)<col: result.append('')
                        result[col-1]=match[2][:500]
                        if len(match[2])>500: limited=True
                    used+=sum(map(len,result))
                    if used>MAX_TEXT: limited=True; break
                    rows.append(result)
                limited=limited or len(source)>100
                if used>MAX_TEXT: break
                sheets.append({'name':sheet.attrib.get('name','Sheet'),'rows':rows})
            return {'kind':'spreadsheet','sheets':sheets,'limited':limited or len(all_sheets)>12,'notice':'Saved cell values and formulas; formulas are not recalculated.'}
    if ext=='.xls':
        import xlrd
        book=xlrd.open_workbook(file_contents=data,on_demand=True)
        try:
            sheets=[{'name':s.name,'rows':[[str(c)[:500] for c in s.row_values(i)[:40]] for i in range(min(s.nrows,100))]} for s in book.sheets()[:12]]
            return {'kind':'spreadsheet','sheets':sheets,'limited':book.nsheets>12 or any(s.nrows>100 or s.ncols>40 for s in book.sheets()),'notice':'Saved cell values; formulas are not recalculated.'}
        finally: book.release_resources()
    if ext=='.pptx':
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            slides=extract.presentation_slides(z)
            pages=[]; used=0
            for info in slides[:100]:
                text=extract.slide_text(extract.read_member(z,info))[:16000]
                used+=len(text)
                if used>MAX_TEXT: break
                pages.append(text)
            return {'kind':'slides','pages':pages,'limited':len(pages)<len(slides),'notice':'Slide text preview. Download the original for diagrams, animation and exact slide layout.'}
    text=extract.read_text(data,name)
    if not text: return {'kind':'unsupported','text':'This file has no readable text preview. Download the original to open it in its application.'}
    return {'kind':'text','text':text[:MAX_TEXT],'limited':len(text)>MAX_TEXT}

if __name__=='__main__':
    try:
        data=pathlib.Path(sys.argv[1]).read_bytes()
        if len(data)>64*1024*1024: raise ValueError('This original is too large for an interactive preview. Download it to view the full file.')
        result=preview(data,sys.argv[2],sys.argv[3] if len(sys.argv)>3 else None)
        encoded=json.dumps(result)
        if len(encoded)>2500000: result={'kind':'unsupported','text':'This file has too much content for an interactive preview. Download the original to inspect it.'}
        print(json.dumps(result))
    except Exception as error:
        print(json.dumps({'kind':'unsupported','text':str(error)[:300]}))
