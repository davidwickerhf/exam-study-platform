"use client";

/** Browse every question, then focus on one answer without losing working state. */

import './question-session.css'
import { useStudyDesk } from '@/components/workspace/study-desk'
import { useCourseTutorContext, useTutorSelection } from '@/components/workspace/course-tutor-entry'
import { gradeStudyQuestion, StudyQuestionSource } from "@/components/workspace/practice-study-question"
import { FeedbackButton } from '@/components/feedback/feedback'
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  ShuffleIcon,
  MessageCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type PracticePayload,
  type PracticeQuestion,
  answerWasCorrect,
  chapterFacets,
  courseFacets,
  filterQuestions,
  gradeRequest,
  questionKey,
  summariseSession,
  typeFacets,
  typeLabel,
} from "@/lib/workspace/practice.mjs";
import {
  AnswerControl,
  NUMERALS,
  PAPER,
  PROSE,
  Prose,
  type SessionEvent,
  TypeLine,
  api,
} from "./shared";
import { SessionLedger } from "./session-ledger";

type QuestionEvent = SessionEvent<PracticeQuestion>;

function QuestionCard({
  question,
  inDeck,
  onDeckChange,
  onMistake,
  onEvent,
  draft,
  cachedResult,
  onResultChange,
  onDraftChange,
  onBusyChange,
}: {
  question: PracticeQuestion;
  draft: string;
  cachedResult: { correction: string; score: number | null } | null;
  onResultChange: (value: { correction: string; score: number | null } | null) => void;
  onDraftChange: (value: string) => void;
  onBusyChange: (busy: boolean) => void;
  inDeck: boolean;
  onDeckChange: (id: string) => void;
  onMistake: () => void;
  onEvent: (event: QuestionEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const attempt = draft;
  const setAttempt = onDraftChange;
  const desk = useStudyDesk();
  const result = cachedResult;
  const setResult = onResultChange;
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false) }, [busy, onBusyChange]);

  const grade = async () => {
    if (!attempt.trim() || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const data = question.study ? await gradeStudyQuestion(question, attempt) : await api<{
        correction: string;
        score: number | null;
        savedAsMistake?: string | null;
      }>("/api/grade", {
        method: "POST",
        body: JSON.stringify(
          gradeRequest(
            question,
            attempt,
            question.courseCode ?? question.courseId,
            question.chapterName ?? "Practice",
          ),
        ),
      });
      setResult(data);
      onEvent({
        key: questionKey(question),
        courseId: question.courseId,
        courseCode: question.courseCode ?? question.courseId,
        correct: answerWasCorrect(data.score),
        item: question,
      });
      if (data.savedAsMistake) onMistake();
      if (!question.study) onDeckChange(question.id);
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await api("/api/sr/add", {
        method: "POST",
        body: JSON.stringify({ questionId: question.id }),
      });
      onDeckChange(question.id);
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-study-task={question.id} className="mx-auto flex w-full min-w-0 max-w-[900px] flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-2 sm:gap-3">
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Question details</summary><div className="mt-2 flex flex-wrap justify-between gap-2"><TypeLine question={question} /><FeedbackButton subject={{kind:"practice",courseId:question.courseId,questionId:question.id}} excerpt={question.question}>Report question</FeedbackButton></div></details>
        <Prose
          source={question.question}
          className={`${PROSE} !text-lg leading-relaxed font-medium`}
        />
      </div>
      {desk && <div><Button size="sm" variant="ghost" onClick={()=>desk.openCourseTutor()}><MessageCircleIcon/>Work through this with tutor</Button></div>}
      <div className="flex flex-col gap-4">
        <AnswerControl
          question={question}
          value={attempt}
          onChange={(value) => {
            setAttempt(value);
            setResult(null);
            setFailure(null);
          }}
          disabled={busy}
          actions={
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => void grade()}
                disabled={busy || !attempt.trim()}
              >
                {busy ? "Checking…" : "Check answer"}
              </Button>
              {!question.study && <Button
                size="sm"
                variant="outline"
                className="w-full bg-background sm:w-auto"
                onClick={() => void add()}
                disabled={busy || inDeck}
              >
                {inDeck ? (
                  <CheckIcon data-icon="inline-start" />
                ) : (
                  <PlusIcon data-icon="inline-start" />
                )}
                {inDeck ? "In flashcards" : "Add to flashcards"}
              </Button>}
              <Button
                size="sm"
                variant="ghost"
                className="w-full sm:ml-auto sm:w-auto"
                onClick={() => {
                  setAttempt("");
                  setResult(null);
                  setFailure(null);
                }}
                disabled={!attempt && !result}
              >
                Clear answer
              </Button>
              {question.expected && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full sm:w-auto"
                  onClick={() => setOpen((shown) => !shown)}
                >
                  <ChevronDownIcon
                    data-icon="inline-start"
                    className={open ? "rotate-180" : ""}
                  />
                  {open ? "Hide reference" : "Reference answer"}
                </Button>
              )}
            </div>
          }
        />
      </div>
      {question.study && <StudyQuestionSource question={question} />}
      {result && (
        <div className="bg-card overflow-hidden rounded-[10px] border">
          <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
            <strong className="text-sm">Grader feedback</strong>
            <strong className={`text-sm ${NUMERALS}`}>
              {result.score === null ? "Not scored" : `${result.score}/10`}
            </strong>
          </div>
          <div className="px-4 py-4">
            <Prose source={result.correction} className={PROSE} />
          </div>
        </div>
      )}
      {failure && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {failure}
        </p>
      )}
      {open && question.expected ? (
        <Prose source={question.expected} className={PAPER} />
      ) : !question.expected ? (
        <p className="text-muted-foreground text-xs">
          No reference answer was published with this question.
        </p>
      ) : null}
    </div>
  );
}

export default function QuestionsTab({
  payload,
  error,
  deck,
  onDeckChange,
  onMistake,
  events,
  onEvent,
  ended,
  onEndedChange,
  onClearSession,
  lockedCourseId,
  initialChapterId,
}: {
  lockedCourseId?: string;
  initialChapterId?: string;
  payload: PracticePayload | null;
  error: string | null;
  deck: Set<string>;
  onDeckChange: (id: string) => void;
  onMistake: () => void;
  events: QuestionEvent[];
  onEvent: (event: QuestionEvent) => void;
  ended: boolean;
  onEndedChange: (ended: boolean) => void;
  onClearSession: () => void;
}) {
  const [courseId, setCourseId] = useState(lockedCourseId || "all");
  const [chapterKey, setChapterKey] = useState(initialChapterId ? `${lockedCourseId}/${initialChapterId}` : "all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [focus, setFocus] = useState<PracticeQuestion[] | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [sessionSize, setSessionSize] = useState('all');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [grading, setGrading] = useState(false);
  const [results, setResults] = useState<Record<string, {correction:string;score:number|null} | null>>({});
  const [sessionOffset, setSessionOffset] = useState(0);
  const [origin, setOrigin] = useState('all');
  const [guideId, setGuideId] = useState('all');
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [browsing, setBrowsing] = useState(true);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const wasBrowsing = useRef(true);
  useEffect(() => {
    if (wasBrowsing.current === browsing) return;
    wasBrowsing.current = browsing;
    workspaceRef.current?.focus({ preventScroll: true });
    workspaceRef.current?.scrollIntoView({ block: "start" });
  }, [browsing]);

  const all = useMemo(() => payload?.questions ?? [], [payload]);
  useEffect(()=>{
    setDrafts(old=>{const next={...old};for(const q of all) if(q.savedAttempt && !(questionKey(q) in next)) next[questionKey(q)]=q.savedAttempt.answer;return next});
    setResults(old=>{const next={...old};for(const q of all) if(q.savedAttempt?.result && !(questionKey(q) in next)) next[questionKey(q)]=q.savedAttempt.result;return next});
  },[all]);
  const courses = useMemo(() => courseFacets(all), [all]);
  const chapters = useMemo(() => chapterFacets(all, courseId), [all, courseId]);
  const types = useMemo(() => typeFacets(all), [all]);
  const filtered = useMemo(
    () => filterQuestions(all.filter(q=>(origin==='all' || (q.practiceOrigin || (q.study ? 'generated' : 'editorial'))===origin) && (guideId==='all' || q.study?.versionId===guideId)), { courseId, chapterKey, type, query }),
    [all, courseId, chapterKey, type, query, origin, guideId],
  );
  const visible = focus ?? (sessionSize === "all" ? filtered : filtered.slice(sessionOffset, sessionOffset + Number(sessionSize)));
  const current = visible[currentIndex] ?? null;
  const groups = new Map<string, {title: string; chapter: string; questions: {question: PracticeQuestion; index: number}[]}>();
  visible.forEach((question,index)=>{
    const key = `${question.study?.setId || question.study?.versionId || question.courseId}/${question.chapterId || ''}`;
    if (!groups.has(key)) groups.set(key,{title:question.guideTitle || question.courseName || question.courseCode || 'Course questions',chapter:question.chapterName || '',questions:[]});
    groups.get(key)!.questions.push({question,index});
  });
  const guides = [...new Map(all.filter(q=>q.study && q.practiceOrigin!=='paper' && (courseId==='all'||q.courseId===courseId)).map(q=>[q.study!.versionId,q.guideTitle || q.source || 'Study guide'])).entries()];
  useCourseTutorContext({ courseId: current?.courseId, courseCode: current?.courseCode, chapterId: current?.study?.topicId, chapterName: current?.chapterName, courseTab: 'exercises', courseTabLabel: 'Practice questions', studyVersionId: current?.study?.versionId, studyRevisionId: current?.study?.revisionId })
  useTutorSelection('exercises',current ? {kind:'question',title:current.chapterName || 'Course exercise',text:current.question} : undefined)
  const summary = useMemo(() => summariseSession(events), [events]);
  const selectedCourse = courses.find((course) => course.id === courseId);
  const selectedChapter = chapters.find(
    (chapter) => chapter.key === chapterKey,
  );
  const selectedType =
    type === "all" ? "All types" : (typeLabel(type) ?? "All types");

  useEffect(() => {
    setCurrentIndex(0);
    setSessionOffset(0);
  }, [courseId, chapterKey, type, query, focus, sessionSize, origin, guideId]);

  useEffect(() => {
    if (events.length > 0) setSetupOpen(false);
  }, [events.length]);

  if (error) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>The question bank could not be read</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!payload) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-20 w-full motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (ended) {
    return (
      <SessionLedger
        title="That is this session recorded"
        note="Every answer you had graded this session, by course. Nothing here is scheduled — take the misses again now, or leave them for the flashcard queue."
        unit="Answered"
        summary={summary}
        onRetryMissed={() => {
          setFocus(
            summary.missed
              .map((event) => event.item)
              .filter(Boolean) as PracticeQuestion[],
          );
          onEndedChange(false);
        }}
        onDone={() => {
          setFocus(null);
          setBrowsing(true);
          onClearSession();
        }}
      />
    );
  }

  return (
    <div ref={workspaceRef} tabIndex={-1} className="practice-question-workspace flex flex-col gap-5 outline-none">
      {!browsing && <div className="flex flex-wrap items-center justify-between gap-3"><Button size="sm" variant="ghost" disabled={grading} onClick={()=>setBrowsing(true)}><ChevronLeftIcon/>Back to question bank</Button></div>}
      {browsing && <div className="question-origin-tabs" role="group" aria-label="Question source">{[['all','All questions'],['paper','From course papers'],['generated','Guide practice'],['editorial','Editorial practice']].filter(([value])=>value!=='editorial'||all.some(q=>!q.study)).map(([value,label])=><Button key={value} size="sm" disabled={grading} variant={origin===value?'default':'ghost'} aria-pressed={origin===value} onClick={()=>{setOrigin(value);setGuideId('all');setFocus(null)}}>{label}<span className="ml-1 text-xs opacity-75">{all.filter(q=>(courseId==='all'||q.courseId===courseId) && (value==='all'||(q.practiceOrigin||(q.study?'generated':'editorial'))===value)).length}</span></Button>)}</div>}
      {browsing && (focus ? (
        <div className="bg-background flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-5 py-4">
          <p className="text-sm">
            <span className={`font-semibold ${NUMERALS}`}>{focus.length}</span>{" "}
            missed {focus.length === 1 ? "question" : "questions"} from this
            session.
          </p>
          <Button variant="outline" size="sm" onClick={() => setFocus(null)}>
            Back to the full bank
          </Button>
        </div>
      ) : (
        <Collapsible
          open={setupOpen}
          onOpenChange={setSetupOpen}
          className="bg-background overflow-hidden rounded-[14px] border"
        >
          <div className="question-session-toolbar">
            <div><h3 className="text-sm font-semibold">Question bank</h3><p className="mt-1 text-xs text-muted-foreground">{selectedChapter?.chapterName || selectedCourse?.name || 'All courses'} · {filtered.length} questions available</p></div>
            <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs text-muted-foreground">Practice scope<select aria-label="Practice scope" value={sessionSize} disabled={grading} onChange={e=>setSessionSize(e.target.value)} className="h-9 rounded-md border bg-card px-2 text-sm text-foreground"><option value="10">10 questions</option><option value="20">20 questions</option><option value="all">Full question bank</option></select></label><CollapsibleTrigger render={<Button size="sm" variant="outline" disabled={grading}/> }><SlidersHorizontalIcon/>{setupOpen ? 'Close setup' : 'Adjust setup'}</CollapsibleTrigger></div>
          </div>
          <CollapsibleContent>
            {guides.length > 0 && <label className="flex flex-wrap items-center gap-3 border-t px-5 pt-4 text-sm">Study guide<select aria-label="Practice study guide" className="h-10 max-w-full rounded-md border bg-card px-3" value={guideId} disabled={grading} onChange={e=>{setGuideId(e.target.value);setChapterKey('all')}}><option value="all">All guides</option>{guides.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>}
            <fieldset disabled={grading} className="question-session-filters">
              <div className="relative min-w-0">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search questions"
                  className="w-full pl-9"
                  aria-label="Search questions"
                />
              </div>

              <Select
                disabled={Boolean(lockedCourseId)}
                value={courseId}
                onValueChange={(value) => {
                  setCourseId(value ?? "all");
                  setChapterKey("all");
                }}
              >
                <SelectTrigger className="w-full" aria-label="Course">
                  <SelectValue>
                    {(value) => {
                      const course = courses.find(
                        (entry) => entry.id === value,
                      );
                      return course
                        ? `${course.code} · ${course.name || `${course.count} questions`}`
                        : `All courses · ${all.length}`;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">
                      All courses · {all.length}
                    </SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.code} ·{" "}
                        {course.name || `${course.count} questions`}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={chapterKey}
                onValueChange={(value) => setChapterKey(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Chapter">
                  <SelectValue>
                    {(value) => {
                      const chapter = chapters.find(
                        (entry) => entry.key === value,
                      );
                      return chapter
                        ? chapter.chapterName || String(chapter.chapterId)
                        : "All chapters";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All chapters</SelectItem>
                    {chapters.map((chapter) => (
                      <SelectItem key={chapter.key} value={chapter.key}>
                        {courseId === "all" ? `${chapter.courseCode} · ` : ""}Ch{" "}
                        {chapter.chapterName || chapter.chapterId}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={type}
                onValueChange={(value) => setType(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Question type">
                  <SelectValue>
                    {(value) =>
                      value === "all"
                        ? "All types"
                        : (typeLabel(value) ?? "All types")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All types</SelectItem>
                    {types.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </fieldset>
          </CollapsibleContent>
        </Collapsible>
      ))}

      {browsing && !!visible.length && <section className="question-overview" aria-label="Question overview">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Choose any question</h3><p className="mt-1 text-xs text-muted-foreground">{visible.filter(q=>results[questionKey(q)]).length} checked · {visible.filter(q=>drafts[questionKey(q)] && !results[questionKey(q)]).length} drafts · {visible.length} questions</p></div><Button size="sm" variant="ghost" aria-expanded={overviewOpen} onClick={()=>setOverviewOpen(!overviewOpen)}>{overviewOpen ? 'Hide overview' : 'Show overview'}</Button></div>
        {overviewOpen && <div className="question-overview-groups">{[...groups.entries()].map(([key,group])=><div key={key} className="question-overview-group"><h4 className="text-sm font-medium">{group.title}</h4>{group.chapter && group.chapter!==group.title && <p className="mt-1 text-xs text-muted-foreground">{group.chapter}</p>}<div className="question-session-map" role="group" aria-label={group.chapter || group.title}>{group.questions.map(({question:q,index})=>{const saved=results[questionKey(q)],drafted=Boolean(drafts[questionKey(q)]);return <button key={questionKey(q)} disabled={grading} aria-label={`Question ${index+1}: ${q.question.slice(0,100)}${saved ? ', checked' : drafted ? ', answer drafted' : ''}`} aria-current={index===currentIndex?'step':undefined} data-worked={saved ? 'checked' : drafted ? 'draft' : undefined} title={`${q.question}${saved?.score!=null ? ` · ${saved.score}/10` : drafted ? ' · Draft answer' : ''}`} onClick={()=>{setCurrentIndex(index);setBrowsing(false)}}>{q.paperLabel || index+1}{saved ? <CheckIcon className="size-3"/> : drafted ? <span className="size-1 rounded-full bg-current"/> : null}</button>})}</div></div>)}</div>}
      </section>}
      {!visible.length ? (
        <Empty>
          <EmptyHeader>
<EmptyTitle>{all.length ? "Nothing matches" : "No exercises yet"}</EmptyTitle>
            <EmptyDescription>
              {all.length ? `${all.length} questions sit outside this filter. Widen the chapter or type.` : "Generate a study guide to add practice questions, or open Mock papers to practise from an original exam."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        !browsing && current && (
          <section className="question-session-card">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-5 py-4 sm:px-8">
              <div className="min-w-0">
                <p className="font-data text-sm font-semibold tabular-nums">
                  Question {currentIndex + 1} of {visible.length} · {current.courseCode}
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {current.chapterName}
                </p>
              </div>
              {current.practiceOrigin !== 'paper' && <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={current.study ? `/app/study/${current.study.versionId}?chapter=${current.study.topicId}&revision=${current.study.revisionId}` : `/app/courses/${encodeURIComponent(current.courseId)}/${encodeURIComponent(String(current.chapterId))}`}
                  />
                }
              >
                Open chapter
              </Button>}
            </div>

            <div className="practice-question-footer flex flex-col gap-3 border-b px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentIndex((index) => Math.max(0, index - 1))
                  }
                  disabled={grading || currentIndex === 0}
                >
                  <ChevronLeftIcon data-icon="inline-start" />
                  Previous
                </Button>
                <span className={`whitespace-nowrap text-sm font-semibold ${NUMERALS}`}>
                  {currentIndex + 1} / {visible.length}
                </span>
                <Button
                  size="sm"
                  onClick={() =>
                    setCurrentIndex((index) =>
                      Math.min(visible.length - 1, index + 1),
                    )
                  }
                  disabled={grading || currentIndex === visible.length - 1}
                >
                  Next
                  <ChevronRightIcon data-icon="inline-end" />
                </Button>
              </div>
              <details className="relative text-xs"><summary className="cursor-pointer">Session options</summary><div className="absolute right-0 z-20 mt-2 flex w-48 flex-col gap-2 rounded-md border bg-card p-2 shadow-lg">
                {sessionSize !== 'all' && filtered.length > Number(sessionSize) && <Button size="sm" variant="outline" disabled={grading} onClick={()=>{setSessionOffset(offset=>offset + Number(sessionSize) >= filtered.length ? 0 : offset + Number(sessionSize));setCurrentIndex(0)}}>New questions</Button>}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCurrentIndex(index => (index + 1 + Math.floor(Math.random() * (visible.length - 1))) % visible.length)
                  }
                  disabled={grading || visible.length < 2}
                >
                  <ShuffleIcon data-icon="inline-start" />
                  Shuffle
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEndedChange(true)}
                  disabled={grading || !events.length}
                  title={
                    events.length
                      ? undefined
                      : "Nothing has been graded this session yet."
                  }
                >
                  End session
                </Button>
              </div></details>
            </div>
            <div className="question-session-body">
              <QuestionCard
                key={questionKey(current)}
                question={current}
                draft={drafts[questionKey(current)] || ''}
                cachedResult={results[questionKey(current)] || null}
                onResultChange={value=>setResults(old=>({...old,[questionKey(current)]:value}))}
                onDraftChange={value=>setDrafts(old=>({...old,[questionKey(current)]:value}))}
                onBusyChange={setGrading}
                inDeck={deck.has(current.id)}
                onDeckChange={onDeckChange}
                onMistake={onMistake}
                onEvent={onEvent}
              />
            </div>

          </section>
        )
      )}
    </div>
  );
}
