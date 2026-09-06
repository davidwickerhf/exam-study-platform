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
    sections: [
      'Definition',
      'Reasoning',
      'Worked example',
      'Limits and self-check'
    ].map((title) => ({
      title,
      text: paragraph + ' ' + paragraph,
      sourceIds: ids
    })),
    summary: [
      {
        text: 'Addition combines disjoint quantities with matching units.',
        sourceIds: ids
      },
      {
        text: 'Subtracting one quantity from the total checks the result.',
        sourceIds: ids
      }
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
    ],
    flashcards: [
      {
        front: 'What does addition do?',
        back: 'It combines quantities into a total.',
        sourceIds: ids
      },
      {
        front: 'What checks addition?',
        back: 'Subtract one term from the total.',
        sourceIds: ids
      },
      {
        front: 'What causes double counting?',
        back: 'Counting overlapping items as if the groups were disjoint.',
        sourceIds: ids
      }
    ],
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
