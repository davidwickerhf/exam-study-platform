// Invented teaching inputs, never official quiz questions or measurements.
// Positive/negative pairs let a live reviewer be evaluated on learnability,
// separately from deterministic structural integrity.
export const iotTeachingCases = [
  {
    id: 'polling', goal: 'Trace detection delay and identify a pulse missed between polls.',
    source: 'Polling samples input at intervals. A pulse entirely between successive samples may not be observed.',
    shallow: 'Polling checks an input periodically. Short pulses can be missed.',
    teaching: 'A poll only observes the value at the instant it runs; it does not recover every change since the previous check. Assume instantaneous samples at 0, 100 and 200 ms and no hardware event latch. A button pressed at 30 ms is first seen pressed at 100 ms, a 70 ms detection delay. Its release at 170 ms is seen at 200 ms, a separate 30 ms delay. A different press from 30 to 70 ms begins and ends between the 0 and 100 ms samples, so both samples read released. The software cannot infer that this pulse occurred from those samples alone. Decreasing the interval reduces delay but cannot guarantee detection of arbitrarily short pulses.',
    guided: ['With samples at 0, 100 and 200 ms, trace a press at 30 ms and release at 170 ms. What are the two detection delays?', 'List the input value at each sample. The pressed state first appears at 100 ms, so its delay is 100 minus 30, or 70 ms. The released state appears at 200 ms, so its delay is 200 minus 170, or 30 ms. These are separate observations.'],
    independent: ['Change only the release to 70 ms. Is the press observed?', 'No. The button is released at the 0 ms sample and again at the 100 ms sample. Its entire pressed interval lies between those checks, so no sampled state records the pulse under the stated no-latch assumption.'],
    transfer: ['A log contains only two released-state samples, one at 0 ms and one at 100 ms. An engineer concludes that no button press occurred. Give two different input histories consistent with the log and decide whether the conclusion is justified under the no-latch assumption.', 'One compatible history has the button released throughout. Another has a press at 30 ms and release at 70 ms. Both produce exactly the recorded samples, so the log cannot distinguish the histories and does not prove that no press occurred. This is an information limit: reconstructing unseen events requires additional observations or an explicitly stated recording mechanism.'],
    mistake: 'Treating polling as a continuous record of input changes.',
    correction: 'Write the value at each actual sample. An input transition between samples leaves no record unless another mechanism stores it.',
  },
  {
    id: 'interrupt-time', goal: 'Account for ISR processor time and distinguish immediate from deferred work.',
    source: 'An interrupt saves context, runs its handler and resumes interrupted work. Deferred work runs later outside the handler.',
    shallow: 'An ISR interrupts the main program and then the program resumes. Handlers should be short.',
    teaching: 'On one core, ISR instructions use processor time that the interrupted calculation cannot use simultaneously. Assume the main calculation needs 100 ms of CPU time, starts at time 0, and an interrupt arrives at 30 ms. At that instant the calculation has completed 30 ms and needs another 70 ms. An 8 ms ISR occupies times 30 through 38 ms. Resuming the remaining 70 ms at 38 ms gives completion at 108 ms, ignoring other overhead and work. Saving context preserves progress; it does not execute the remaining calculation during the handler. A direct output change inside the ISR can occur during that handler, whereas setting up a task to do work later adds a separate scheduling decision after the ISR returns.',
    guided: ['A 100 ms calculation is interrupted at 30 ms by an 8 ms ISR. Fill in remaining main work, ISR return time, and main completion time.', 'Thirty milliseconds of calculation ran before the interrupt, leaving 70 ms. The ISR returns at 38 ms. The remaining 70 ms then runs until 108 ms. Context restoration resumes the calculation where it stopped; no main-work CPU time elapses while the ISR occupies the single core.'],
    independent: ['Under the same assumptions, the ISR instead takes 3 ms. When does the calculation finish?', 'The main calculation still requires 100 ms of CPU time. The 3 ms handler delays it by three milliseconds, so completion is at 103 ms. The arrival time determines which part is interrupted but does not remove any of the required computation.'],
    transfer: ['An ISR sets an output at time 34 ms and queues a task that can run only at 50 ms. When did each action become possible?', 'The immediate output action occurred inside the handler at 34 ms. The queued task becoming eligible does not execute its body at that same instant: under the stated scheduling condition its deferred work starts no earlier than 50 ms. Interrupt response and completion of deferred work are distinct timings.'],
    mistake: 'Assuming the main computation continues while the ISR runs on the same core.',
    correction: 'Separate CPU work from wall-clock time and draw non-overlapping intervals for the main computation and ISR.',
  },
  {
    id: 'notification', goal: 'Distinguish an ordinary variable write from notifying a blocked task.',
    source: 'A task blocked on a kernel notification waits for that notification or a configured timeout. Writing ordinary memory does not notify the kernel object.',
    shallow: 'Blocked tasks wait for an event. A notification can wake them.',
    teaching: 'The kernel tracks waits on its own objects; it does not continuously inspect every ordinary variable for a value change. Assume a button task is blocked indefinitely on a task notification. An ISR writes buttonPressed=true in ordinary memory but never sends the notification. The memory value has changed, but the kernel wait condition has not, so the task remains Blocked. This is different from a task that repeatedly polls that flag while Running. If the ISR uses the appropriate notification API, the kernel can release the wait and make the task Ready. Ready means eligible for scheduling, not already executing. A finite timeout could also release a wait, but it must be specified rather than assumed. Memory visibility and correct ISR-safe APIs are additional requirements, not substitutes for signalling the wait object.',
    guided: ['The task waits indefinitely on a notification. The ISR only sets an ordinary flag. State what changes in memory and what happens to the task state.', 'The ordinary flag changes value in memory. No notification has been sent to the object on which the task is blocked, so the kernel does not release that wait. Under the explicit no-timeout assumption the task remains Blocked rather than becoming Ready.'],
    independent: ['Change one condition: the ISR sends the task notification after writing the flag. What state transition is enabled?', 'The notification signals the kernel object that owns the wait, allowing the Blocked task to become Ready. That does not guarantee immediate CPU execution; scheduling policy and other eligible work still determine when it becomes Running.'],
    transfer: ['A consumer waits on an empty queue. A producer writes a separate shared counter but does not enqueue anything. Should the consumer wake because the counter changed?', 'No. The queue wait is satisfied by the queue operation, not by an unrelated memory write. With no timeout or other wake-up mechanism specified, changing the shared counter leaves the queue empty and the consumer Blocked on it.'],
    mistake: 'Assuming the RTOS automatically detects ordinary variables changing.',
    correction: 'Name the exact kernel object being waited on and identify the operation that signals it. A memory store alone does not satisfy a notification or queue wait.',
  },
  {
    id: 'ready-running', goal: 'Separate becoming Ready from obtaining CPU time under priority preemption.',
    source: 'In a single-core priority-preemptive scheduler, the highest-priority Ready task runs. A notified lower-priority task may remain Ready while a higher-priority task runs.',
    shallow: 'Ready tasks can run. Priority scheduling chooses the highest-priority Ready task.',
    teaching: 'Ready is eligibility, while Running means owning the CPU. Assume a single core with priority preemption, a button task blocked on a notification, and a higher-priority logger with 70 ms of CPU work still remaining when an interrupt arrives at 30 ms. The ISR lasts 8 ms and sends the button notification. The button becomes Ready during the ISR, but cannot run while the ISR occupies the CPU. At 38 ms the ISR returns; the logger remains the higher-priority Ready task, so it runs its remaining 70 ms through 108 ms. Only then can the button task run. If only the button priority is raised above the logger priority, it can run at ISR return, 38 ms. These calculations assume no other work or overhead and treat 70 ms as remaining work at interrupt arrival, not as the logger original total.',
    guided: ['Using these assumptions, label the button state after notification and calculate its earliest start time when the logger has higher priority.', 'The notification releases the wait, making the button task Ready. The ISR returns at 38 ms. The higher-priority logger then consumes its remaining 70 ms, completing at 108 ms. The button can start then; notification did not give it the CPU immediately.'],
    independent: ['Change only the priority so that the button is higher than the logger. When can the button run?', 'It can run when the ISR returns at 38 ms, assuming the notification has been sent and no other higher-priority work exists. The newly Ready button outranks the logger and therefore obtains the core before the logger finishes its remaining calculation.'],
    transfer: ['A trace shows a high-priority logger occupying the CPU until 108 ms and a lower-priority button task first running at 108 ms. A colleague infers that the notification must have been sent at 108 ms. Is the task start time sufficient to infer notification time? Give two compatible notification times assuming no ISR or other work.', 'No. A notification at 38 ms could make the button task Ready while the higher-priority logger continues until 108 ms. A notification at 90 ms would also leave it Ready waiting behind the logger and produce the same start time. Running at 108 ms therefore does not identify when it became Ready; the trace needs a notification or state-transition timestamp to distinguish those cases.'],
    mistake: 'Equating a notification or Ready state with immediate execution.',
    correction: 'After releasing a wait, separately compare eligible task priorities and account for ISR and higher-priority CPU work.',
  },
  {
    id: 'cooperative', goal: 'Explain why priority alone cannot stop a running cooperative task.',
    source: 'In cooperative scheduling, the running task retains control until it yields, blocks or completes. Priority selects among eligible tasks at a scheduling opportunity.',
    shallow: 'Cooperative tasks yield voluntarily. Preemptive schedulers can interrupt tasks.',
    teaching: 'In a cooperative scheduler, selecting the highest-priority task happens at a scheduling opportunity; changing priority does not create preemption. Assume a logger starts a 20 ms uninterrupted CPU burst at time 0 and an urgent motor-stop task becomes Ready at time 5 ms. The logger never yields or blocks during its burst. The stop task waits until time 20 ms, a 15 ms scheduling delay, even if it has the highest priority. Raising its priority changes the next selection, not the logger ability to keep running. If the logger yields at time 8 ms instead, the Ready high-priority stop task can be selected then, reducing delay to 3 ms. This reasoning describes task scheduling, not a claim that hardware interrupts are disabled in every cooperative system; an immediate action inside an ISR is a different mechanism.',
    guided: ['A cooperative logger runs from 0 to 20 ms without yielding. The highest-priority stop task becomes Ready at 5 ms. Calculate when it can start and its scheduling delay.', 'Its priority cannot preempt the running cooperative logger. The next stated scheduling opportunity is the logger completing at 20 ms, so the stop task can start then. Its delay since becoming Ready is 20 minus 5, or 15 ms.'],
    independent: ['Change only the logger behavior: it yields at 8 ms. When can the highest-priority Ready stop task start?', 'The yield creates a scheduling opportunity at 8 ms. Because the stop task is Ready and has the highest priority, it can be selected then under the stated assumptions. Its waiting delay is now three milliseconds rather than fifteen.'],
    transfer: ['A cooperative task busy-waits for a shared flag that another Ready task must set. Why might increasing the setter priority fail to fix the wait?', 'Busy-waiting keeps the first task Running without yielding or blocking. In a cooperative scheduler, the Ready setter cannot obtain the CPU merely because its priority rises. The running task must provide a scheduling opportunity or use an appropriate blocking/scheduling mechanism.'],
    mistake: 'Assuming higher priority automatically creates preemption in a cooperative scheduler.',
    correction: 'First identify when scheduling can happen. Only then apply priority to choose among Ready tasks.',
  },
]

export function iotPedagogyFixture({ shallow = false } = {}) {
  const refs = id => [`e-${id}`]
  const plan = { objectives: iotTeachingCases.map(c => ({ id: c.id, goal: c.goal, complexity: 'difficult', basis: 'course', sourceIds: refs(c.id), prerequisites: [{ text: 'Distinguish CPU time, elapsed time, and the task states Running, Ready and Blocked.', basis: 'background', sourceIds: refs(c.id) }], demonstration: c.independent[0], teachingApproach: 'Explain the mechanism, trace an explicit example, guide an attempt, vary one condition, and test transfer.' })), exclusions: ['These illustrative inputs are not official quiz questions or measurements.'], gaps: [] }
  const questions = iotTeachingCases.flatMap(c => ['guided', 'independent', 'transfer'].map((stage, i) => ({
    id: `${c.id}-${stage}`, key: `${c.id}-${stage}`, objectiveIds: [c.id], objective: c.goal, practiceStage: stage,
    question: c[stage][0], answer: c[stage][1], type: 'written', options: [], correctOptions: [], marks: null,
    kind: 'application', skill: i === 2 ? 'transfer' : 'apply', difficulty: i === 2 ? 'challenge' : 'standard',
    hint: 'State the assumptions and trace each event in time order.', hints: ['State the assumptions and trace each event in time order.', c.correction],
    misconceptions: [{ mistake: c.mistake, explanation: c.correction, followUpKey: `${c.id}-${stage === 'independent' ? 'transfer' : 'independent'}` }], sourceIds: refs(c.id),
  })))
  return {
    course: { courseCode: 'IOT-FIXTURE', courseName: 'IoT teaching regression', academicYear: '2026-2027', period: '1' },
    sources: [{ key: 'iot-fixture', title: 'Synthetic mechanism reference', kind: 'notes' }],
    chunks: iotTeachingCases.map(c => ({ id: `e-${c.id}`, sourceKey: 'iot-fixture', text: c.source, page: null })),
    chapter: { id: 'iot-mechanisms', title: 'Events, execution and scheduling', formatVersion: 3, teachingPlan: plan,
      learningGoals: plan.objectives.map(o => o.goal),
      sections: iotTeachingCases.map(c => ({ id: c.id, title: c.goal, objectiveIds: [c.id], text: shallow ? c.shallow : c.teaching, takeaway: c.correction, detail: null, callouts: [], visual: null, sourceIds: refs(c.id) })),
      questions, summary: iotTeachingCases.map(c => ({ text: c.correction, sourceIds: refs(c.id) })), flashcards: [], walkthrough: null, caveats: plan.exclusions,
      objectiveCoverage: iotTeachingCases.map(c => ({ objectiveId: c.id, explanationSectionIds: [c.id], workedExampleSectionIds: [c.id], guidedQuestionKeys: [`${c.id}-guided`], independentQuestionKeys: [`${c.id}-independent`], transferQuestionKeys: [`${c.id}-transfer`] })),
    },
  }
}
