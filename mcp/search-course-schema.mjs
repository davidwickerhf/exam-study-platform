import { z } from 'zod/v4'

const identifiers = ['courseId', 'courseCode', 'canonicalCourseId']
const identity = description => z.string().regex(/\S/, 'A course identifier must not be blank.').optional().describe(description)
// A refinement alone is not emitted into JSON Schema. Publish the matching
// anyOf alongside runtime validation so discovery and tools/call agree.
export const searchCourseSchema = z.object({
  courseId: identity('Exact published-course id returned by list_courses; not a Canvas numeric id or a course code.'),
  courseCode: identity('Stable course code, e.g. BCS1540. Preferred for Canvas material, even when list_courses has no entry.'),
  canonicalCourseId: identity('Stable corpus course identity returned by an earlier search.'),
  academicYear: z.string().optional().describe('Exact edition such as 2025-2026.'),
  sourceType: z.enum(['syllabus', 'requirements', 'slides', 'pages', 'assessments', 'activities', 'readings', 'materials']).optional(),
  includeHistorical: z.boolean().optional().describe('Search older editions when no exact year is requested; defaults to true.'),
  query: z.string().regex(/\S/, 'A search query must not be blank.'),
  limit: z.number().int().min(1).max(20).optional()
}).refine(args => identifiers.some(key => Boolean(args[key])), {
  message: 'Provide at least one of courseId, courseCode, or canonicalCourseId. Use courseCode for Canvas material.'
}).meta({ anyOf: identifiers.map(key => ({ required: [key] })) })
