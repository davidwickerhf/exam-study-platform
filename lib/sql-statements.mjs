// Split trusted migration files without treating semicolons inside comments,
// quoted strings, identifiers, or Postgres dollar-quoted blocks as boundaries.
export function splitSqlStatements(source) {
  const statements = []
  let current = ''
  let quote = null
  let lineComment = false
  let blockComment = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]
    if (lineComment) {
      if (char === '\n') { lineComment = false; current += '\n' }
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index += 1 }
      continue
    }
    if (quote) {
      current += char
      if ((quote === "'" || quote === '"') && char === quote) {
        if (next === quote) { current += next; index += 1 }
        else quote = null
      } else if (quote.startsWith('$') && source.startsWith(quote, index)) {
        current += source.slice(index + 1, index + quote.length)
        index += quote.length - 1
        quote = null
      }
      continue
    }
    if (char === '-' && next === '-') { lineComment = true; index += 1; continue }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue }
    if (char === "'" || char === '"') { quote = char; current += char; continue }
    if (char === '$') {
      const marker = source.slice(index).match(/^\$[A-Za-z0-9_]*\$/)?.[0]
      if (marker) { quote = marker; current += marker; index += marker.length - 1; continue }
    }
    if (char === ';') {
      if (current.trim()) statements.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (quote || blockComment) throw new Error('Migration contains an unterminated quote or comment.')
  if (current.trim()) statements.push(current.trim())
  return statements
}
