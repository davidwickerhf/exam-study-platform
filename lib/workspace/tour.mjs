export const TOUR_STEPS = Object.freeze([
  { id: 'today', route: '/app', target: 'today', title: 'Start with your study day', body: 'Home brings your next class, exam and study priorities together. Follow the main action to pick up your next task, or open Full calendar to see what is ahead.', hint: 'We’ll visit the main pages together. Use Next and Back, or leave the tour whenever you like.' },
  { id: 'courses', route: '/app/courses', target: 'courses', title: 'Find your course workspace', body: 'Choose a course to open its chapters, notes and available study material. Your course list brings together your programme, academic record and connected sources.', hint: 'Missing an elective? Use Update electives. Open study plan shows how your courses fit into your degree.' },
  { id: 'practice', route: '/app/practice', target: 'practice-modes', title: 'Choose how to practise', body: 'Questions let you test a topic, while Flashcards help you recall it later. Mistakes keeps missed questions together so you can revisit them; Mocks is for a longer exam-style session.', hint: 'Start with a course and a short question session. Available practice depends on the material in your workspace.' },
  { id: 'calendar', route: '/app/calendar', target: 'calendar-controls', title: 'Make room for study', body: 'Switch calendar views to see your day, week or month. Select an event for its details, use Today to return to the present, and Create to add your own study time.', hint: 'Connected timetables and calendars appear alongside your own events. You can choose which calendars are visible.' },
  { id: 'planning', route: '/app/planning', target: 'planning-modes', title: 'See the bigger picture', body: 'Overview tracks your degree progress. Courses is where you review your course choices and results, and Planner helps you organise the work ahead.', hint: 'Use these tabs when your electives, exam plans or study priorities change.' },
  { id: 'documents', route: '/app/documents', target: 'document-upload', title: 'Keep your sources current', body: 'Upload document lets you add an academic record or a private source for Tutor. Academic imports can be reviewed before they update your study information.', hint: 'Return here to inspect versions, add a newer document or remove a source you no longer want to use.' },
  { id: 'tutor', route: '/app/tutor', target: 'tutor-composer', fallback: 'tutor', title: 'Work through it with Tutor', body: 'Ask for an explanation, help with a study decision or a next step. Tutor uses the information available in your workspace, and proposes changes for your approval before acting.', hint: 'Try “Help me understand this topic.” The paperclip adds a private file or picture to your conversation.', mobileHint: 'Tutor needs an available AI connection. You can review your connections in Settings.' },
  { id: 'updates', route: '/app/updates', target: 'updates', title: 'Catch up on your courses', body: 'Updates collects announcements, assignments and course material from Canvas. Open an item to read the details and see what needs your attention.', hint: 'If Canvas is not connected yet, you can connect it here or return to it later in Settings.' },
  { id: 'settings', route: '/app/settings', target: 'settings', title: 'Stay in control', body: 'Connections manages your linked services. AI usage shows your usage, and Data & privacy contains your data controls. API access is available if you want to connect other tools.', hint: 'Your profile lives in the account menu. You can revisit skipped setup sources through Connections.' },
  { id: 'search', route: '/app', target: 'search', fallback: 'menu', title: 'Your desk is ready', body: 'Search helps you find study material across your courses. Use the sidebar to move between pages, or the bottom navigation and menu on a smaller screen.', hint: 'Search: ⌘K on Mac or Ctrl+K on Windows. Replay this walkthrough with Take a tour on Home.', mobileHint: 'Open the menu for all your pages. You can replay this walkthrough with Take a tour on Home.' }
])

// Keep the coachmark in view and outside its target whenever there is room.
export function tourPosition(anchor, panel, viewport) {
  const margin = 16
  const gap = 16
  const width = Math.min(panel.width, viewport.width - margin * 2)
  const height = Math.min(panel.height, viewport.height - margin * 2)
  const clamp = (n, min, max) => Math.max(min, Math.min(n, max))
  let left = (viewport.width - width) / 2
  let top = (viewport.height - height) / 2
  if (anchor) {
    if (anchor.right + gap + width <= viewport.width - margin) {
      left = anchor.right + gap; top = anchor.top
    } else if (anchor.left - gap - width >= margin) {
      left = anchor.left - gap - width; top = anchor.top
    } else if (anchor.bottom + gap + height <= viewport.height - margin) {
      left = anchor.left; top = anchor.bottom + gap
    } else {
      left = anchor.left; top = anchor.top - gap - height
    }
  }
  return { left: clamp(left, margin, viewport.width - width - margin), top: clamp(top, margin, viewport.height - height - margin), width }
}
