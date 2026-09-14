// This scanner only identifies duplicate object keys; JSON.parse remains the
// grammar authority. Escaped key spellings are compared after decoding.
export function parseUniqueJson(text) {
  const tokens=text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) || []
  const stack=[]
  for(let i=0;i<tokens.length;i++) {
    const token=tokens[i]
    if(token==='{' || token==='[')stack.push(token==='{'?new Set():null)
    else if(token==='}' || token===']')stack.pop()
    else if(token.startsWith('"') && tokens[i+1]===':' && stack.at(-1) instanceof Set) {
      const key=JSON.parse(token)
      if(stack.at(-1).has(key))throw new Error('duplicate JSON object key')
      stack.at(-1).add(key)
    }
  }
  return JSON.parse(text)
}
export function renderingPreflight(chapter) {
  const issues=[]
  const visit=(value,path)=>{
    if(typeof value==='string') {
      if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value))issues.push(`${path}: invisible control character; reconstruct the affected notation from its source.`)
      if(/\t(?:imes|ext\{|heta\b)|\r(?:ight|ho)\b|\n(?:abla|eq)\b|\\\\(?:frac|times|text|mathcal|rightarrow|sum|qquad)\b/.test(value))issues.push(`${path}: malformed LaTeX escape; verify the decoded command and its operands.`)
    } else if(Array.isArray(value))value.forEach((v,i)=>visit(v,`${path}[${i}]`))
    else if(value && typeof value==='object')for(const [key,item] of Object.entries(value))if(!['factualAudit','evidenceReview','pedagogyAudit','pedagogicalReview'].includes(key))visit(item,`${path}.${key}`)
  }
  visit(chapter,'chapter')
  for(const [field,key] of [['questions','key'],['sections','id']]) {
    const seen=new Set()
    for(const [i,item] of (chapter[field]||[]).entries()) {
      if(seen.has(item[key]))issues.push(`chapter.${field}[${i}].${key}: duplicate identity.`)
      seen.add(item[key])
    }
  }
  return issues
}
