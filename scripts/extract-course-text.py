#!/usr/bin/env python3
"""Read course notebooks/spreadsheets/archives without executing their content."""
import io, json, pathlib, sys, zipfile, xml.etree.ElementTree as ET, subprocess
MAX_BYTES = 128 * 1024 * 1024
MAX_ENTRIES = 2000
used = 0
entries = 0

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
    if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise ValueError('XML entities are not allowed; original preserved.')
    return ET.fromstring(data)

def read_text(data, name, depth=0):
    if depth > 3: raise ValueError('Nested archive limit exceeded; original preserved.')
    ext = pathlib.PurePosixPath(name).suffix.lower()
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
                    for row in xml(member(target)).iter():
                        if row.tag.split('}')[-1] != 'row': continue
                        cells = []
                        for cell in row:
                            value = next((n.text or '' for n in cell if n.tag.split('}')[-1] == 'v'), '')
                            formula = next((n.text or '' for n in cell if n.tag.split('}')[-1] == 'f'), '')
                            if cell.attrib.get('t') == 's': value = strings[int(value)]
                            elif cell.attrib.get('t') == 'inlineStr': value = ''.join(cell.itertext())
                            if formula: value += ' [formula: ' + formula + '; saved value, not recalculated]'
                            if value: cells.append(cell.attrib.get('r', '') + ': ' + value)
                        if cells: parts.append(' | '.join(cells))
                return '\n'.join(parts)
            parts = []
            for info in z.infolist():
                if info.is_dir(): continue
                if '..' in pathlib.PurePosixPath(info.filename).parts or info.filename.startswith('/'):
                    raise ValueError('Invalid archive member path; original preserved.')
                if ext == '.docx' and info.filename != 'word/document.xml': continue
                if ext == '.pptx' and not (info.filename.startswith('ppt/slides/slide') and info.filename.endswith('.xml')): continue
                contents = read_member(z, info)
                text = ' '.join(xml(contents).itertext()) if ext in ('.docx', '.pptx') else read_text(contents, info.filename, depth+1)
                parts.append(f'File: {info.filename}\n{text or "[Binary member retained in original archive]"}')
            return '\n\n'.join(parts)
    if ext == '.pdf':
        result = subprocess.run(['pdftotext', '-', '-'], input=data, capture_output=True, timeout=45, check=True)
        return result.stdout.decode('utf-8', errors='replace')
    if ext in ('.txt','.md','.csv','.tsv','.py','.r','.m','.tex','.json','.html','.htm','.js','.ts','.java','.c','.cpp','.h') and b'\0' not in data:
        return data.decode('utf-8', errors='replace')
    return ''

try:
    data = pathlib.Path(sys.argv[1]).read_bytes()
    text = read_text(data, sys.argv[2])
    print(json.dumps({'text': text, 'pages': None, 'status': 'complete' if text else 'unsupported', 'error': None}))
except Exception as error:
    print(json.dumps({'text': None, 'pages': None, 'status': 'failed', 'error': str(error)[:500]}))
