#!/usr/bin/env python3
"""Read course notebooks/spreadsheets/archives without executing their content."""
import csv, io, json, pathlib, sys, zipfile, xml.etree.ElementTree as ET, subprocess, re, posixpath
FORMATS = json.loads((pathlib.Path(__file__).resolve().parent.parent / 'lib/course-file-formats.json').read_text())
TEXT_EXTENSIONS = tuple('.'+e for e in FORMATS['code']+FORMATS['text']+['csv','tsv'])
MAX_BYTES = 128 * 1024 * 1024
MAX_ENTRIES = 2000
MAX_INVENTORY_ENTRIES = 50000
BINARY_SAMPLE = 200
used = 0
entries = 0
inventory_entries = 0

def read_member(z, info):
    global used, entries
    entries += 1
    used += info.file_size
    if entries > MAX_ENTRIES or used > MAX_BYTES or info.file_size > MAX_BYTES:
        raise ValueError('Archive exceeds safe expansion limits; original preserved.')
    if info.flag_bits & 1:
        raise ValueError('Encrypted archive member cannot be read; original preserved.')
    if info.file_size > 1024 * 1024 and info.file_size > max(1, info.compress_size) * 300:
        raise ValueError('Archive expansion ratio is unsafe; original preserved.')
    return z.read(info)

def xml(data):
    if b'<!DOCTYPE' in data.replace(b'\0', b'').upper() or b'<!ENTITY' in data.replace(b'\0', b'').upper():
        raise ValueError('XML entities are not allowed; original preserved.')
    return ET.fromstring(data)

def office_text(node):
    """Formatting runs are adjacent text, not words or paragraphs."""
    paragraphs = [p for p in node.iter() if p.tag.split('}')[-1] == 'p']
    if not paragraphs:
        return ''.join(n.text or '' for n in node.iter() if n.tag.split('}')[-1] == 't')
    def tokens(n):
        tag = n.tag.split('}')[-1]
        if tag in ('oMath', 'oMathPara'): return '[Equation: inspect the rendered slide for its notation.]'
        if tag == 't': return n.text or ''
        if tag == 'br': return '\n'
        if tag == 'tab': return '\t'
        return ''.join(tokens(child) for child in n)
    return '\n'.join(tokens(p).strip() for p in paragraphs).strip()

def presentation_slides(z):
    """Use the presentation's relationship order, never ZIP or filename order."""
    if 'ppt/presentation.xml' not in z.namelist():
        # Some minimal/legacy exports lack the presentation manifest.
        return sorted((i for i in z.infolist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', i.filename)), key=lambda i: int(re.search(r'slide(\d+)', i.filename)[1]))
    relationships = {r.attrib.get('Id'): r for r in xml(read_member(z, z.getinfo('ppt/_rels/presentation.xml.rels')))}
    root = xml(read_member(z, z.getinfo('ppt/presentation.xml')))
    ordered = []
    for node in root.iter():
        if node.tag.split('}')[-1] != 'sldId': continue
        rid = next((v for k,v in node.attrib.items() if k.endswith('}id')), None)
        relation = relationships.get(rid)
        if relation is None or relation.attrib.get('TargetMode') == 'External':
            raise ValueError('Presentation slide reference is unavailable; original preserved.')
        target = relation.attrib.get('Target', '')
        path = posixpath.normpath(target.lstrip('/') if target.startswith('/') else 'ppt/' + target)
        if not path.startswith('ppt/slides/') or '\\' in path or not path.endswith('.xml'):
            raise ValueError('Invalid presentation slide reference; original preserved.')
        ordered.append(z.getinfo(path))
    return ordered

def slide_pages(data):
    """Preserve slide order, table cells, notes and explicit visual coverage gaps."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = set(z.namelist())
        def member(name): return xml(read_member(z, z.getinfo(name)))
        def relationships(name):
            rel = posixpath.join(posixpath.dirname(name), '_rels', posixpath.basename(name)+'.rels')
            if rel not in names: return {}
            result = {}
            for n in member(rel):
                if n.attrib.get('TargetMode') == 'External': continue
                target = n.attrib.get('Target','')
                target = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(name), target))
                if target.startswith('../') or target not in names: continue
                result[n.attrib.get('Id')] = (target, n.attrib.get('Type',''))
            return result
        order = [info.filename for info in presentation_slides(z)]
        pages = []
        for index, name in enumerate(order):
            root = member(name); parts = []; visuals = {'images':0,'charts':0,'diagrams':0,'equations':sum(n.tag.split('}')[-1]=='oMath' for n in root.iter())}
            def walk(node):
                tag = node.tag.split('}')[-1]
                if tag == 'tbl':
                    rows = []
                    for row in node:
                        if row.tag.split('}')[-1] == 'tr': rows.append(' | '.join(office_text(cell).replace('\n',' / ') for cell in row if cell.tag.split('}')[-1] == 'tc'))
                    parts.append('\n'.join(rows)); return
                if tag == 'p':
                    value = office_text(node)
                    if value: parts.append(value)
                    return
                if tag == 'pic': visuals['images'] += 1
                if tag == 'chart': visuals['charts'] += 1
                if tag in ('relIds','cxnSp','custGeom'): visuals['diagrams'] += 1
                if tag == 'cNvPr' and node.attrib.get('descr'):
                    description = node.attrib['descr'].strip()
                    # Some slide editors put a complete image data URI in alt
                    # text. It is image bytes, not a human-authored caption.
                    description = re.sub(r'data:[^\s<>"\']+', '[Embedded image data omitted.]', description, flags=re.I)
                    if re.fullmatch(r'[A-Za-z0-9+/=]{256,}', description):
                        description = '[Embedded image data omitted.]'
                    if description: parts.append('Visual description supplied in original: '+description)
                for child in node: walk(child)
            walk(root)
            if not parts and office_text(root): parts.append(office_text(root))
            notes = []
            for target, relation in relationships(name).values():
                if relation.endswith('/notesSlide'):
                    for shape in member(target).iter():
                        if shape.tag.split('}')[-1] != 'sp': continue
                        placeholders = [n.attrib.get('type') for n in shape.iter() if n.tag.split('}')[-1]=='ph']
                        if any(t in ('sldNum','sldImg','dt','hdr','ftr') for t in placeholders): continue
                        value = office_text(shape)
                        if value: notes.append(value)
            if notes: parts.append('Speaker notes from original:\n'+'\n'.join(notes))
            if any(visuals.values()): parts.append('[Visual coverage: this slide contains images, charts or diagrams. Their visual meaning has not been analyzed; inspect the rendered slide. Do not infer plotted values or relationships from text alone.]')
            pages.append({'page':index+1, 'text':'\n'.join(parts), 'visualCoverage':{'status':'not-analyzed' if any(visuals.values()) else 'text-extracted', **visuals}})
        return pages

# Large datasets are indexed by structure and explicit samples; the complete
# original remains downloadable. Do not embed millions of numeric cells.
DATASET_THRESHOLD = 1024 * 1024
SAMPLE_ROWS = 20
SAMPLE_COLUMNS = 40
STREAM_LIMIT = 1024 * 1024 * 1024
streamed_bytes = 0

class SafeXMLStream:
    def __init__(self, source):
        self.source, self.count, self.tail = source, 0, b''
    def read(self, size=-1):
        global streamed_bytes
        block = self.source.read(min(size if size >= 0 else 65536, 65536))
        self.count += len(block)
        streamed_bytes += len(block)
        if streamed_bytes > STREAM_LIMIT: raise ValueError('Workbook exceeds streaming expansion limit; original preserved.')
        check = (self.tail + block).replace(b'\0', b'').upper()
        if b'<!DOCTYPE' in check or b'<!ENTITY' in check: raise ValueError('XML entities are not allowed; original preserved.')
        self.tail = block[-64:]
        return block

def dataset_profile(rows, label):
    samples, count, columns = [], 0, 0
    for row in rows:
        count += 1
        columns = max(columns, len(row))
        if count <= SAMPLE_ROWS:
            samples.append('Row ' + str(count) + ': ' + ' | '.join(str(v)[:200] for v in row[:SAMPLE_COLUMNS]))
    return (f'Dataset: {label}\n{count} rows (including any header); up to {columns} columns.\n'
            f'Search index contains structure and the first {min(count,SAMPLE_ROWS)} rows, '
            f'up to {SAMPLE_COLUMNS} columns and 200 characters per cell. '
            'This is a sample, not the full dataset. Download the preserved original for all rows and exact analysis.\n'
            + '\n'.join(samples))

def workbook_rows(z, target, strings):
    info = z.getinfo(target)
    if info.flag_bits & 1: raise ValueError('Encrypted workbook cannot be read; original preserved.')
    if info.file_size > STREAM_LIMIT or info.file_size > max(1, info.compress_size)*300:
        raise ValueError('Workbook exceeds safe streaming expansion limits; original preserved.')
    with z.open(info) as source:
        stack = []
        for event, row in ET.iterparse(SafeXMLStream(source), events=('start','end')):
            if event == 'start':
                stack.append(row)
                continue
            if row.tag.split('}')[-1] != 'row':
                stack.pop()
                continue
            cells = []
            for cell in row:
                value = next((n.text or '' for n in cell if n.tag.split('}')[-1] == 'v'), '')
                formula = next((n.text or '' for n in cell if n.tag.split('}')[-1] == 'f'), '')
                if cell.attrib.get('t') == 's': value = strings[int(value)]
                elif cell.attrib.get('t') == 'inlineStr': value = ''.join(cell.itertext())
                if formula: value += ' [formula: ' + formula + '; saved value, not recalculated]'
                cells.append(cell.attrib.get('r', '') + ': ' + value)
            yield cells
            row.clear()
            if len(stack) > 1: stack[-2].remove(row)
            stack.pop()

def read_text(data, name, depth=0):
    global inventory_entries
    if depth > 3: raise ValueError('Nested archive limit exceeded; original preserved.')
    if pathlib.PurePosixPath(name).suffix.lower() == '.pptx':
        return '\n\n'.join(f"Slide {p['page']}\n{p['text']}" for p in slide_pages(data))
    ext = pathlib.PurePosixPath(name).suffix.lower()
    if ext in ('.csv', '.tsv') and len(data) > DATASET_THRESHOLD:
        csv.field_size_limit(8 * 1024 * 1024)
        return dataset_profile(csv.reader(io.StringIO(data.decode('utf-8-sig', errors='replace'), newline=''), delimiter='\t' if ext == '.tsv' else ','), name)
    if ext == '.xls':
        import xlrd
        book = xlrd.open_workbook(file_contents=data, on_demand=True)
        parts = []
        try:
            for sheet in book.sheets():
                parts.append('Sheet: ' + sheet.name)
                rows = (sheet.row_values(i) for i in range(sheet.nrows))
                if len(data) > DATASET_THRESHOLD: parts.append(dataset_profile(rows, sheet.name))
                else: parts.extend(' | '.join(map(str, row)) for row in rows)
        finally: book.release_resources()
        return '\n'.join(parts)
    if ext == '.ipynb':
        notebook = json.loads(data)
        parts = []
        for i, cell in enumerate(notebook.get('cells', []), 1):
            source = cell.get('source', '')
            parts.append(f"Cell {i} ({cell.get('cell_type', 'unknown')})\n" + (''.join(source) if isinstance(source, list) else str(source)))
            for output in cell.get('outputs', []):
                value = output.get('text', output.get('data', {}).get('text/plain', ''))
                if value: parts.append('Saved output: ' + (''.join(value) if isinstance(value, list) else str(value)))
        return '\n\n'.join(parts)
    if ext in ('.xlsx', '.docx', '.pptx', '.zip'):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            infos = z.infolist()
            inventory_entries += len(infos)
            if inventory_entries > MAX_INVENTORY_ENTRIES:
                raise ValueError('Archive inventory entry limit exceeded; original preserved.')
            if ext == '.xlsx':
                def member(name): return read_member(z, z.getinfo(name))
                strings = []
                if 'xl/sharedStrings.xml' in z.namelist():
                    strings = [''.join(node.itertext()) for node in xml(member('xl/sharedStrings.xml'))]
                relationships = {n.attrib['Id']: n.attrib['Target'] for n in xml(member('xl/_rels/workbook.xml.rels'))}
                parts = []
                for sheet in xml(member('xl/workbook.xml')).iter():
                    if sheet.tag.split('}')[-1] != 'sheet': continue
                    rid = next((v for k,v in sheet.attrib.items() if k.endswith('}id')), None)
                    target = relationships.get(rid, '')
                    target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
                    if '..' in pathlib.PurePosixPath(target).parts: raise ValueError('Invalid workbook relationship.')
                    parts.append('Sheet: ' + sheet.attrib.get('name', target))
                    rows = workbook_rows(z, target, strings)
                    if len(data) > DATASET_THRESHOLD:
                        parts.append(dataset_profile(rows, sheet.attrib.get('name', target)))
                    else:
                        parts.extend(' | '.join(row) for row in rows if row)
                return '\n'.join(parts)
            parts = []
            binary_count = 0
            for info in infos:
                if info.is_dir(): continue
                if '..' in pathlib.PurePosixPath(info.filename).parts or info.filename.startswith('/'):
                    raise ValueError('Invalid archive member path; original preserved.')
                # Finder adds AppleDouble resource forks beside the real files.
                # Their extensions mirror Office files, but their bytes are not
                # Office archives. Keep them in the original, not study evidence.
                member_path = pathlib.PurePosixPath(info.filename)
                if ext == '.zip' and ('__MACOSX' in member_path.parts or member_path.name.startswith('._') or member_path.name == '.DS_Store'):
                    continue
                if ext == '.docx' and info.filename != 'word/document.xml': continue
                if ext == '.pptx' and not (info.filename.startswith('ppt/slides/slide') and info.filename.endswith('.xml')): continue
                if ext == '.zip' and pathlib.PurePosixPath(info.filename).name.lower() not in ('makefile','dockerfile') and pathlib.PurePosixPath(info.filename).suffix.lower() not in tuple('.'+e for e in FORMATS['structured']+['pdf']) + TEXT_EXTENSIONS:
                    binary_count += 1
                    if binary_count <= BINARY_SAMPLE:
                        parts.append(f'File: {info.filename[:240]}\n[Binary member retained in original archive; {info.file_size} bytes. No text extraction required.]')
                    continue
                contents = read_member(z, info)
                text = office_text(xml(contents)) if ext in ('.docx', '.pptx') else read_text(contents, info.filename, depth+1)
                parts.append(f'File: {info.filename}\n{text or "[Binary member retained in original archive]"}')
            if binary_count > BINARY_SAMPLE:
                parts.insert(0, f'Archive profile: {binary_count} binary members. Filename sample shows the first {BINARY_SAMPLE}; {binary_count - BINARY_SAMPLE} names omitted. This is not a complete file listing. All original bytes remain in the archive; binary members were not expanded.')
            return '\n\n'.join(parts)
    if ext == '.pdf':
        result = subprocess.run(['pdftotext', '-', '-'], input=data, capture_output=True, timeout=45, check=True)
        return result.stdout.decode('utf-8', errors='replace')
    if (ext in TEXT_EXTENSIONS or pathlib.PurePosixPath(name).name.lower() in ('makefile','dockerfile')) and b'\0' not in data:
        return data.decode('utf-8', errors='replace')
    return ''

if __name__ == "__main__":
    try:
        data = pathlib.Path(sys.argv[1]).read_bytes()
        pages = slide_pages(data) if pathlib.PurePosixPath(sys.argv[2]).suffix.lower() == '.pptx' else None
        text = '\n\n'.join(p['text'] for p in pages) if pages is not None else read_text(data, sys.argv[2])
        print(json.dumps({'text': text, 'pages': pages, 'status': 'complete' if text else 'unsupported', 'error': None}))
    except Exception as error:
        print(json.dumps({'text': None, 'pages': None, 'status': 'failed', 'error': str(error)[:500]}))
