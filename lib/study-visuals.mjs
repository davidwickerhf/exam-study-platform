import { z } from 'zod'
const label = z.string().trim().min(1).max(100)
const description = z.string().trim().min(1).max(500)
const id = z.string().regex(/^[a-z0-9-]{1,40}$/)
export const studyVisualSchema = z.object({
  title: label,
  caption: description,
  basis: z.enum(['source', 'illustrative']),
  sourceIds: z.array(z.string().min(1).max(120)).min(1).max(120),
  diagram: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('process'), nodes: z.array(z.object({ id, label, description })).min(2).max(8),
      edges: z.array(z.object({ from: id, to: id, label: z.string().max(70) })).min(1).max(12) }),
    z.object({ kind: z.literal('comparison'), columns: z.array(label).min(2).max(4).describe('Data column headings only. The row-label column is rendered separately; do not include its heading here.'),
      rows: z.array(z.object({ label, cells: z.array(z.string().min(1).max(250)).min(2).max(4).describe('Exactly one cell for each entry in columns, in the same order. Exclude the row label.') })).min(2).max(8) }),
    z.object({ kind: z.literal('plot'), style: z.enum(['bar', 'line']), xLabel: label, yLabel: label,
      points: z.array(z.object({ label, x: z.number().finite(), y: z.number().finite() })).min(2).max(24) }),
    z.object({ kind: z.literal('sets'), aLabel: label, bLabel: label,
      universe: z.array(label).min(2).max(24).describe('Concrete distinct sample-space elements, e.g. die faces 1 through 6. Never region labels such as A only, overlap or outcome space.'), a: z.array(label).max(24), b: z.array(label).max(24) })
  ])
})
export function studyVisualIssues(visual) {
  const parsed = studyVisualSchema.safeParse(visual)
  if (!parsed.success) return ['A visual has an invalid or incomplete specification.']
  const d = parsed.data.diagram, issues = []
  if (d.kind === 'process') {
    const ids = new Set(d.nodes.map(n => n.id))
    if (ids.size !== d.nodes.length) issues.push('Diagram nodes need unique identities.')
    if (d.edges.some(e => !ids.has(e.from) || !ids.has(e.to))) issues.push('Diagram arrows must connect existing nodes.')
    if (d.nodes.some(n => !d.edges.some(e => e.from === n.id || e.to === n.id))) issues.push('Explain or connect every node in the process diagram.')
  }
  if (d.kind === 'comparison' && d.rows.some(r => r.cells.length !== d.columns.length)) issues.push('Every comparison row must match its column headings.')
  if (d.kind === 'plot' && d.style === 'line' && new Set(d.points.map(p => p.x)).size !== d.points.length) issues.push('A line plot needs distinct x coordinates.')
  if (d.kind === 'sets') {
    const universe = new Set(d.universe)
    if (universe.size !== d.universe.length || [d.a, d.b].some(s => new Set(s).size !== s.length || s.some(v => !universe.has(v)))) issues.push('Set membership must use unique items from the stated universe.')
  }
  if (/data:|<\/?(?:script|iframe|svg|img)|https?:\/\//i.test(JSON.stringify(visual))) issues.push('Visuals must use validated data, not embedded images, links or executable markup.')
  return issues
}
