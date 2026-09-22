export const course = {
  courseCode: 'CS101',
  courseName: 'Foundations',
  academicYear: '2026-2027',
  period: '1'
}
const paragraph =
  'Addition combines quantities into a total. Start from the first value, then count forward by the second value. For an illustrative example, two items combined with three items give five items. Check the calculation by reversing the operation: subtract the second amount from the total to recover the first amount. This reasoning assumes the quantities use the same unit and refer to disjoint groups. Counting an item twice is a common mistake. A negative quantity instead represents a change in the opposite direction. Explain the operation and its assumptions before applying a formula to a new situation.'
const goals = ['Combine disjoint quantities with matching units using $T=A+B$.', 'Diagnose double counting and unit errors.', 'Check a total using subtraction.']
export function teachingPlan(ids) {
  return { objectives: goals.map((goal, i) => ({ id: `objective-${i + 1}`, goal, complexity: 'difficult', basis: 'course', sourceIds: ids,
    prerequisites: [{ text: 'Recognize which items belong to each group and use matching units.', basis: 'background', sourceIds: ids }],
    demonstration: 'Explain the assumptions, compute a total, diagnose overlap and check by subtraction.',
    teachingApproach: 'Explain disjoint groups, work an addition and inverse check, then change overlap and units.' })), exclusions: [], gaps: [] }
}
export function pedagogicalReview(chapter, { shallow = false } = {}) {
  return { objectives: chapter.teachingPlan.objectives.map(o => {
    const path = chapter.objectiveCoverage.find(c => c.objectiveId === o.id)
    const explanation = chapter.sections.find(s => s.id === path.explanationSectionIds[0])
    const worked = chapter.sections.find(s => s.id === path.workedExampleSectionIds[0])
    return { objectiveId: o.id, adequate: !shallow,
      explanation: { sectionId: explanation.id, quote: explanation.text.split('. ')[0] },
      workedExample: shallow ? null : { sectionId: worked.id, quote: worked.text.split('. ')[0] },
      guidedQuestionKey: path.guidedQuestionKeys[0], independentQuestionKey: path.independentQuestionKeys[0],
      rationale: 'Scripted plumbing fixture, not a live pedagogical judgment.',
      missingReasoning: shallow ? ['The definition does not teach the event trace required by its assessment.'] : [] }
  }), transferChecks:chapter.questions.filter(q=>q.practiceStage==='transfer').map(q=>({questionKey:q.key,closestExampleSectionId:chapter.sections[0].id,changedCondition:'Scripted fixture changes the conditions.',variation:'diagnosis',rationale:'Scripted plumbing fixture.'})), followUpChecks:chapter.questions.filter(q=>q.misconceptions?.length).map(q=>({questionKey:q.key,useful:true,rationale:'Scripted plumbing fixture.'})), issues: [] }
}
export function teachingResponse(prompt, ids, {reviewIssues=[]}={}) {
  if(prompt.includes('INDEPENDENT QUESTION SOLVING') || prompt.includes('ANSWER COMPARISON REVIEW') || prompt.includes('ITEM-BY-ITEM CONTENT REVIEW')) {
    const payload=JSON.parse(prompt.split('Review payload: ').at(-1))
    if(prompt.includes('INDEPENDENT QUESTION SOLVING'))return {items:Object.fromEntries(payload.map(q=>[q.key,{answer:'Scripted independent solution for plumbing tests.',assumptions:[],calculations:[]}]))}
    const failing=reviewIssues.some(i=>i.severity==='error')
    const answers=prompt.includes('ANSWER COMPARISON REVIEW')
    // The content review scopes each finding; the answers review does not.
    return {items:Object.fromEntries(payload.map(item=>[item.key,{correct:!failing,rationale:'Scripted review for plumbing tests.',issues:reviewIssues.map(({detail,severity,scope})=>({detail,severity,...(answers?{}:{scope:scope==='chapter'?'chapter':'item'})})),...(answers?{fault:failing?'authored':'none'}:{})}]))}
  }
  if(prompt.includes('REPAIR PRACTICE LINKS')) {
    const payload=JSON.parse(prompt.split('Review payload: ').at(-1))
    return {links:Object.fromEntries(payload.invalid.map(row=>[row.key,{followUpKey:row.candidates[0],changedCondition:'Scripted related follow-up.'}]))}
  }
  if (prompt.includes('PLAN THE TEACHING')) return teachingPlan(ids)
  if (prompt.includes('INDEPENDENT PEDAGOGICAL REVIEW')) return pedagogicalReview(JSON.parse(prompt.split('Chapter: ').at(-1)))
  return null
}
export function lesson(ids, { wrong = false } = {}) {
  return {
    title: 'Addition',
    teachingPlan: teachingPlan(ids),
    formatVersion: 3,
    objectiveCoverage: teachingPlan(ids).objectives.map(o => ({ objectiveId: o.id, explanationSectionIds: ['section-1'], workedExampleSectionIds: ['section-3'], guidedQuestionKeys: ['question-1'], independentQuestionKeys: ['question-3'], transferQuestionKeys: ['question-7'] })),
    learningGoals: ['Combine disjoint quantities with matching units using $T=A+B$.', 'Diagnose double counting and unit errors.', 'Check a total using subtraction.'],
    sections: [
      'Definition',
      'Reasoning',
      'Worked example',
      'Limits and self-check'
    ].map((title, i) => ({
      id: `section-${i + 1}`, objectiveIds: ['objective-1', 'objective-2', 'objective-3'],
      title,
      text: paragraph,
      callouts: title === 'Definition' ? [{kind:'definition',title:'Adding disjoint groups',text:'Addition combines quantities with matching units. Count each item once. An overlap is written A \\cap B. For the illustrative groups:\n\n$$2+3=5$$',sourceIds:ids}] : [],
      takeaway: 'Count each quantity once and verify the result.',
      detail: title === 'Reasoning' ? 'Subtraction gives an independent check: after combining two disjoint groups, remove one group from the total. The remainder should match the group that was present before addition. This works only when each object is counted once and the groups use matching units.' : null,
      visual: title === 'Worked example' ? { title: 'Combine, then check', caption: 'Follow $T=A+B$ forward, then reverse the calculation to check it.', basis: 'illustrative', sourceIds: ids, diagram: {kind:'process',nodes:[{id:'start',label:'$2$ items',description:'Begin with the first disjoint group.'},{id:'add',label:'Add 3',description:'Combine the second group, counting every item once.'},{id:'total',label:'5 items',description:'The total combines both groups; subtract three to recover two.'}],edges:[{from:'start',to:'add',label:'Combine'},{from:'add',to:'total',label:'Total'},{from:'total',to:'start',label:'Subtract 3 to check'}]} } : null,
      sourceIds: ids
    })),
    summary: [
      {
        text: 'Addition combines disjoint quantities into one total, preserving their matching units.',
        sourceIds: ids
      },
      {
        text: 'Subtracting one quantity from the total checks the result.',
        sourceIds: ids
      },
      {text:'Use matching units before adding quantities; incompatible units do not describe a meaningful total.',sourceIds:ids},
      {text:'If groups overlap, first remove the shared members so that every item is counted once.',sourceIds:ids},
      {text:'A worked calculation states its assumptions, combines the terms, then checks the result with the inverse operation.',sourceIds:ids}
    ],
    questions: [
      {
        question:
          'An illustrative group has two items and another has three. Find the total.',
        answer: `Add the separate groups to obtain $2+3=${wrong ? '6' : '5'}$. Subtract three to verify the original two items.`,
        kind: 'application',
        sourceIds: ids
      },
      {
        question: 'Why must the groups be disjoint?',
        answer:
          'Overlapping groups would count some items twice, so exclude the overlap before calculating the total.',
        kind: 'recall',
        sourceIds: ids
      },
      {
        question: 'How can you check the result?',
        answer:
          'Subtract one group from the proposed total and compare the remainder with the other group.',
        kind: 'exam-style',
        sourceIds: ids
      }
    ,
      {question:'A group of four includes one of the three items in another group. Diagnose the proposed total of seven.',answer:'The groups overlap, so seven counts the shared item twice. Count the distinct items once by excluding the repeated member before checking the combined total.',kind:'application'},
      {question:'An illustrative total of nine contains a group of four. How can you verify the other group?',answer:'Subtract the known four items from the total of nine to recover five. Recombine those five with four and check that the result returns to nine.',kind:'application'},
      {question:'A student adds metres to centimetres without conversion. Explain the error and repair the method.',answer:'The numerical terms use incompatible units, so their direct sum lacks a consistent meaning. Convert to a common unit first, combine the terms, and preserve that unit.',kind:'application'},
      {question:'Design a test that distinguishes an incorrect total from a double-counted input.',answer:'First verify which objects belong to each group and identify any shared members. Then count distinct objects once and reverse the proposed operation to check the total.',kind:'exam-style'},
      {question:'Transfer the counting method to two inventories when some products belong to both lists.',answer:'Match product identities across the inventories before adding counts. Count shared products once rather than twice, then check the result by reconstructing the separate and shared groups.',kind:'exam-style'}
    ].map((q,i) => ({...q, key: `question-${i + 1}`, objectiveIds: ['objective-1', 'objective-2', 'objective-3'], practiceStage: i < 2 ? 'guided' : i >= 6 ? 'transfer' : 'independent', hints: ['Identify each group and its units.', 'Check for shared items before adding; subtract one group to check.'], misconceptions: [{mistake:'Counting an overlapping item twice.',explanation:'Identify shared members and count each only once before applying the inverse check.',followUpKey:i === 3 ? 'question-8' : 'question-4'}], answer:q.answer+' State the disjoint-group and matching-unit assumptions explicitly so the calculation can be checked independently.', sourceIds:ids, objective:['Combine disjoint quantities with matching units using $T=A+B$.','Diagnose double counting and unit errors.','Check a total using subtraction.'][i%3], skill:['apply','compare','recall','diagnose','apply','diagnose','transfer','transfer'][i], difficulty:i>=6?'challenge':i<2?'foundation':'standard',hint:'Check which items and units are being combined before calculating.'})),
    flashcards: [
      ['What does addition combine?', 'Quantities expressed in matching units.', 'definition'],
      ['Why require disjoint groups?', 'Otherwise shared items are counted twice.', 'misconception'],
      ['What operation checks addition?', 'Subtraction: undo one term and recover the other.', 'contrast'],
      ['Two apples plus three apples?', 'Five apples, assuming the groups are disjoint.', 'application'],
      ['Two metres plus three centimetres: first step?', 'Convert both quantities into the same unit.', 'application'],
      ['What is an overlapping group?', 'A group sharing one or more items with another.', 'definition'],
      ['Does addition change an item’s unit?', 'No. Adding counts preserves the common unit.', 'misconception'],
      ['Total versus change?', 'A total describes the combined quantity; a change describes an increase or decrease.', 'contrast'],
      ['Five items minus the three just added?', 'Two items: the starting quantity is recovered.', 'application'],
      ['What makes a negative quantity useful?', 'It represents a change in the opposite direction.', 'definition'],
      ['Is a plausible-looking total a verification?', 'No. Check assumptions and reverse the operation.', 'misconception'],
      ['What should precede calculation?', 'State what is counted, the units, and any overlap.', 'application']
    ].map(([front,back,kind]) => ({front,back,kind,sourceIds:ids})),
    walkthrough: {
      title: 'Follow the calculation',
      steps: [
        { text: 'Begin with two illustrative items.', sourceIds: ids },
        { text: 'Add three items, giving five.', sourceIds: ids }
      ]
    },
    caveats: []
  }
}

// A practice blueprint satisfying the chapter contract for teachingPlan(ids):
// guided, independent and transfer rows for every difficult objective, each
// diagnosed with a follow-up inside its own objective.
export function practiceBlueprint(plan) {
  const skills = ['apply', 'compare', 'diagnose', 'transfer']
  return plan.objectives.flatMap((objective, o) => ['guided', 'independent', 'transfer'].map((stage, s) => ({
    key: `${objective.id}-${stage}`, objectiveId: objective.id, stage, skill: skills[(o + s) % 4],
    difficulty: s === 2 ? 'challenge' : 'standard', kind: 'application',
    misconception: {mistake: 'Counting an item twice.', followUpKey: `${objective.id}-${['independent', 'transfer', 'guided'][s]}`, changedCondition: 'The groups now overlap.'}
  })))
}
// lesson(ids) split across one simple objective (sections 1-2, questions 1-4)
// and one difficult objective (sections 3-4, questions 5-8) with complete
// guided, independent and transfer practice and diagnosed follow-ups.
export function twoObjectiveLesson(ids) {
  const base = lesson(ids)
  const plan = {objectives: [
    {id: 'obj-a', goal: 'Combine disjoint quantities.', complexity: 'simple', basis: 'course', sourceIds: ids, prerequisites: [], demonstration: 'Add two groups.', teachingApproach: 'Explain and practise.'},
    {id: 'obj-b', goal: 'Diagnose double counting.', complexity: 'difficult', basis: 'course', sourceIds: ids, prerequisites: [], demonstration: 'Diagnose an overlap.', teachingApproach: 'Work a case, then vary it.'}
  ], exclusions: [], gaps: []}
  const stages = ['guided', 'independent', 'independent', 'independent', 'guided', 'independent', 'transfer', 'transfer']
  const questions = base.questions.map((q, i) => ({...q, objectiveIds: [i < 4 ? 'obj-a' : 'obj-b'], practiceStage: stages[i], hints: ['Count each group.', 'Remove the overlap first.'],
    misconceptions: i < 4 ? [] : [{mistake: 'Counting shared items twice.', explanation: 'Shared items belong to both groups.', followUpKey: base.questions[i === 7 ? 6 : 7].key}]}))
  const sections = base.sections.map((s, i) => ({...s, objectiveIds: [i < 2 ? 'obj-a' : 'obj-b']}))
  const {teachingPlan: _plan, ...content} = base
  return {plan, draft: {...content, sections, questions, objectiveCoverage: [
    {objectiveId: 'obj-a', explanationSectionIds: ['section-1'], workedExampleSectionIds: ['section-1'], guidedQuestionKeys: ['question-1'], independentQuestionKeys: ['question-2'], transferQuestionKeys: []},
    {objectiveId: 'obj-b', explanationSectionIds: ['section-3'], workedExampleSectionIds: ['section-3'], guidedQuestionKeys: ['question-5'], independentQuestionKeys: ['question-6'], transferQuestionKeys: ['question-7']}
  ]}}
}
