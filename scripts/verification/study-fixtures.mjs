export const course = {
  courseCode: 'CS101',
  courseName: 'Foundations',
  academicYear: '2026-2027',
  period: '1'
}
const paragraph =
  'Addition combines quantities into a total. Start from the first value, then count forward by the second value. For an illustrative example, two items combined with three items give five items. Check the calculation by reversing the operation: subtract the second amount from the total to recover the first amount. This reasoning assumes the quantities use the same unit and refer to disjoint groups. Counting an item twice is a common mistake. A negative quantity instead represents a change in the opposite direction. Explain the operation and its assumptions before applying a formula to a new situation.'
export function lesson(ids, { wrong = false } = {}) {
  return {
    title: 'Addition',
    formatVersion: 2,
    learningGoals: ['Combine disjoint quantities with matching units.', 'Diagnose double counting and unit errors.', 'Check a total using subtraction.'],
    sections: [
      'Definition',
      'Reasoning',
      'Worked example',
      'Limits and self-check'
    ].map((title) => ({
      title,
      text: paragraph,
      callouts: title === 'Definition' ? [{kind:'definition',title:'Adding disjoint groups',text:'Addition combines quantities with matching units. Count each item once. An overlap is written A \\cap B. For the illustrative groups:\n\n$$2+3=5$$',sourceIds:ids}] : [],
      takeaway: 'Count each quantity once and verify the result.',
      detail: title === 'Reasoning' ? 'Subtraction gives an independent check: after combining two disjoint groups, remove one group from the total. The remainder should match the group that was present before addition. This works only when each object is counted once and the groups use matching units.' : null,
      visual: title === 'Worked example' ? { title: 'Combine, then check', caption: 'Follow the illustrative total forward, then reverse the calculation to check it.', basis: 'illustrative', sourceIds: ids, diagram: {kind:'process',nodes:[{id:'start',label:'2 items',description:'Begin with the first disjoint group.'},{id:'add',label:'Add 3',description:'Combine the second group, counting every item once.'},{id:'total',label:'5 items',description:'The total combines both groups; subtract three to recover two.'}],edges:[{from:'start',to:'add',label:'Combine'},{from:'add',to:'total',label:'Total'},{from:'total',to:'start',label:'Subtract 3 to check'}]} } : null,
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
    ].map((q,i) => ({...q, answer:q.answer+' State the disjoint-group and matching-unit assumptions explicitly so the calculation can be checked independently.', sourceIds:ids, objective:['Combine disjoint quantities with matching units.','Diagnose double counting and unit errors.','Check a total using subtraction.'][i%3], skill:['apply','compare','recall','diagnose','apply','diagnose','transfer','transfer'][i], difficulty:i>=6?'challenge':i<2?'foundation':'standard',hint:'Check which items and units are being combined before calculating.'})),
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
