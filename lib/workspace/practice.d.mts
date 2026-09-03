/** Types for lib/app/practice.mjs. */

export type PracticeQuestion = {
  id: string
  source?: string | null
  type?: string | null
  difficulty?: string | null
  question: string
  expected?: string | null
  options?: string[] | null
  courseId: string
  courseCode?: string | null
  courseName?: string | null
  chapterId?: string | null
  chapterName?: string | null
  chapterQuestionIndex?: number
}

export type PracticePayload = {
  questions: PracticeQuestion[]
  courses: { id: string; code: string; name: string; questionCount: number }[]
  source: string
  generated: boolean
}

export type SrCard = {
  ease?: number
  interval?: number
  repetitions?: number
  lastReviewed?: string | null
  dueAt?: string | null
  history?: { at: string; quality: number }[]
}

export type SrDue = { id: string; card: SrCard; question: PracticeQuestion; courseId: string; chapterId: string }
export type SrPayload = { due: SrDue[]; totalCards: number; dueCount: number; allIds: string[] }

export type Mistake = {
  id: string
  courseId: string | null
  chapterId: string | null
  questionId: string | null
  type?: string | null
  difficulty?: string | null
  question: string
  options?: string[] | null
  expected?: string | null
  source?: string | null
  attempt?: string | null
  correction?: string | null
  score?: number | null
  createdAt: string
  resolvedAt: string | null
}

export type MockSession = {
  id: string
  courseId: string
  chapterId: string | null
  submittedAt: string | null
  totalScore: number | null
  totalMax: number | null
  count: number
  duration: number | null
  startedAt?: string | null
  questions?: (PracticeQuestion & { attempt?: string; correction?: string; score?: number | null })[]
}

export type GradeResult = { correction: string; score: number | null; savedAsMistake?: string | null }
export type MockRun = { courseId: string; chapterId: string | null; startedAt: number; token?: string }

export type CourseFacet = { id: string; code: string; name: string; count: number }
export type ChapterFacet = { key: string; courseId: string; courseCode: string; chapterId: string | null; chapterName: string; count: number }
export type TypeFacet = { id: string; label: string | null; count: number }
export type ChapterGroup = ChapterFacet & { questions: PracticeQuestion[] }
export type MistakeGroup = { key: string; courseId: string | null; chapterId: string | null; items: Mistake[] }
export type Quality = { value: number; label: string; hint: string }

export type QuestionFilter = { courseId?: string; chapterKey?: string; type?: string; query?: string }

export type SrQueueAction = 'rate' | 'skip' | 'remove'

export type GradedMockQuestion = PracticeQuestion & { attempt: string; correction: string; score: number }
export type GradeProgress = { completed: number; total: number }
export type GradeMockOptions = { concurrency?: number; onProgress?: (progress: GradeProgress) => void }

export type SessionEvent<TItem = unknown> = {
  key: string
  courseId: string | null
  courseCode: string
  correct: boolean
  item?: TItem
}
export type SessionCourseRow = { courseId: string | null; code: string; answered: number; correct: number; missed: number }
export type SessionSummary<TItem = unknown> = {
  answered: number
  correct: number
  incorrect: number
  courses: SessionCourseRow[]
  missed: SessionEvent<TItem>[]
}

export type PracticeTab = 'questions' | 'flashcards' | 'mistakes' | 'mocks'
export type PracticeHeadlineState = {
  tab?: string
  loaded?: boolean
  questionCount?: number
  courseCount?: number
  dueCount?: number
  totalCards?: number
  mistakeCount?: number
  mockCount?: number
}

export declare const QUESTION_TYPE_LABELS: Record<string, string>
export declare const DIFFICULTIES: string[]
export declare const CHOICE_TYPES: string[]
export declare const SR_PASS: number
export declare const SR_QUALITIES: Quality[]
export declare const SR_QUEUE_ACTIONS: SrQueueAction[]
export declare const MOCK_GRADE_CONCURRENCY: number
export declare const ANSWER_PASS_SCORE: number

export declare function advanceReviewQueue<T>(queue: T[] | null | undefined, action: SrQueueAction | string): T[]
export declare function canSkip(queue: unknown[] | null | undefined): boolean
export declare function gradeMockAnswers(
  questions: PracticeQuestion[],
  answers: Record<string, string> | null | undefined,
  gradeFn: (question: PracticeQuestion, attempt: string) => Promise<{ correction?: string; score?: number | null }>,
  options?: GradeMockOptions
): Promise<GradedMockQuestion[]>
export declare function answerWasCorrect(score: unknown): boolean
export declare function summariseSession<TItem>(events: SessionEvent<TItem>[] | null | undefined): SessionSummary<TItem>
export declare function practiceHeadline(state?: PracticeHeadlineState): string
export declare function sessionMeter(state?: { tab?: string; answered?: number; reviewed?: number }): string | null

export declare function typeLabel(type: unknown): string | null
export declare function difficultyLabel(question: { difficulty?: unknown } | null | undefined): string | null
export declare function usableOptions(question: { type?: unknown; options?: unknown } | null | undefined): string[]
export declare function questionKey(question: { courseId?: unknown; chapterId?: unknown; id?: unknown } | null | undefined): string
export declare function courseFacets(questions: PracticeQuestion[] | null | undefined): CourseFacet[]
export declare function chapterFacets(questions: PracticeQuestion[] | null | undefined, courseId?: string): ChapterFacet[]
export declare function typeFacets(questions: PracticeQuestion[] | null | undefined): TypeFacet[]
export declare function filterQuestions(questions: PracticeQuestion[] | null | undefined, filter?: QuestionFilter): PracticeQuestion[]
export declare function groupByChapter(questions: PracticeQuestion[] | null | undefined): ChapterGroup[]
export declare function passed(quality: number): boolean
export declare function cardLine(card: SrCard | null | undefined): string
export declare function mockPercent(session: { totalScore?: unknown; totalMax?: unknown } | null | undefined): number | null
export declare function mockMinutes(seconds: unknown): number | null
export declare function groupMistakes(mistakes: Mistake[] | null | undefined): MistakeGroup[]
export declare function queueLine(input?: { dueCount?: number; mistakeCount?: number; loaded?: boolean }): string
export declare function agoLabel(iso: string | null | undefined, now?: number): string | null
export declare function gradeRequest(question: PracticeQuestion, attempt: unknown, courseCode: string, chapterName: string): Record<string, unknown>
export declare function sampleQuestions(questions: PracticeQuestion[], count: number, random?: () => number): PracticeQuestion[]
export declare function mockRemaining(startedAt: number, minutes: number, now?: number): number
export declare function mockTimeLabel(seconds: number): string
export declare function buildMockSession(run: MockRun, graded: unknown[], submittedAt?: Date | string): Record<string, unknown>
export declare function practiceLocation(input: unknown): { tab: string; sessionId: string | null }
