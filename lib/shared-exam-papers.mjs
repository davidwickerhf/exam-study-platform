import { publishedCourseMaterials, reviewSharedCourseMaterials, sharedCourseMaterialAsset, sharedMaterialReviewQueue } from './shared-course-materials.mjs'

export { examMaterialKind, sharedExamCourseCode } from './shared-exam-policy.mjs'

export async function publishedExamPapers(courseCode) {
  const result = await publishedCourseMaterials(courseCode, { examsOnly: true })
  return { courseCode: result.courseCode, courseName: result.courseName,
    papers: result.materials.map(({ category, ...item }) => ({ ...item, kind: category })) }
}

export const sharedExamAsset = assetId => sharedCourseMaterialAsset(assetId, { examsOnly: true })

export async function examPaperReviewQueue(options = {}) {
  const rows = await sharedMaterialReviewQueue(options)
  return rows.filter(row => /\.pdf$/i.test(row.filename)).map(row => ({ ...row,
    kind: row.category === 'material' ? null : row.category }))
}

export async function reviewExamPaper({ snapshotId, status, reviewerId, note = '', kind = '' }) {
  if (status === 'approved' && !['paper', 'solutions'].includes(kind))
    throw Object.assign(new Error('Classify this PDF as a paper or solutions before approving it.'), { status: 400 })
  return reviewSharedCourseMaterials({ items: [{ snapshotId, category: kind }], status,
    reviewerId, note, acceptContributions: false })
}
