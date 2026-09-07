# Attendance extraction and timetable matching

Attendance is extracted from the current Canvas edition's saved syllabus/course manual, announcements and introductory material. Evidence includes adjacent chunks so conditions and amendments are not separated from their rules. Generated link inventories and software-library code are excluded from this focused pass. Timetable `Type:` labels in descriptions take precedence over generic course titles when matching a rule to a session.

The attendance pass runs before general deadline/assessment extraction. Explicit amendments must cite the announcement and affected source; merely newer material does not automatically override a syllabus. Required, optional and assessed participation are distinct. Silence does not establish optional attendance. A rule restricted to a named activity must not make every course session compulsory.

Each scan retains a separate attendance check. An unrelated assessment failure cannot suppress a successfully checked attendance rule; actual attendance conflicts still block the affected evidence. Original asset IDs and page references are retained. The overall scan continues to report incomplete assessment coverage.

The model-call budget bounds each run, not the total source coverage. Successful batches are cached and subsequent runs continue with unfinished batches; the old permanent 100-passage cutoff is removed. Extraction version changes invalidate old results and schedule a rules-only refresh for eligible active connections. Partially indexed courses can be scanned without waiting for every file to succeed, while collection permissions, paused connections and contributor isolation remain enforced.

Regression coverage includes generic timetable titles with description activity labels, lecture/tutorial isolation, explicit optionality, provider failures, amended attendance thresholds presented in the same request, source-code exclusion, and queue processing after an unrelated resource failure. `npm run verify` and the PostgreSQL Canvas queue fixture exercise the pipeline. Model output remains source dependent; live semantic extraction must be checked separately from mocked provider regressions.

## Project steps and final reconciliation

Extraction version 7 also retains `assessment.actions`: an imperative title, parent project, kind, exact deadline when established, original relative timing, prerequisite, notes and original chunk/asset/page references. Team formation, topic selection, staff approval, pitches, slide uploads and individual deliverables stay separate. Internal exercise commands, conduct rules and grading targets stay out of the task list. Missing dates remain unknown rather than becoming source conflicts or invented midnight deadlines.

A GPT-5.4 attendance pass reads the complete course manual alongside announcements and introductory material. A final GPT-5.4 pass reconciles the cheaper obligation batches against the original passages, merges duplicate steps and applies explicit amendments. Graded participation is distinct from compulsory presence; numbered sessions retain their scope and schedule dates. Literal recovery must not collapse separately dated rules.

Production saves after one model call per scan, within the queue's 150-second step lifetime. An unfinished scan resumes automatically after a minute using the private, versioned batch cache, including cached semantic conflicts and the final reconciliation. Pending work is labelled as checking course rules, rather than an error. Other provider failures keep the existing longer retry interval. Background calls use platform billing, actual model prices, a $0.50 ceiling per evidence revision for capped accounts, and the existing account/platform spending limits. No personal API key is charged automatically.

Home and `/app/priorities` display source-linked project steps even with relative timing. Completed Canvas submissions suppress the matching derived deliverable; a completed report does not hide a separate presentation. UTC assignment dates are compared in Europe/Amsterdam. A past source-only deadline says “Check completion” because source documents do not establish whether a student has already completed the work.

## Live validation, 7 September 2026

The real provider was exercised against saved, contributor-scoped 2026–2027 source passages (private source exports and model outputs stayed outside the repository). Verified examples include the amended Blockchains eight-session requirement and 4 October 23:59 CEST project deadline; the five dated graded Operating Systems labs; the assessed AI ethics debate; and IoT paper selection, idea preparation, approval, revised submission, and relative pre-presentation deadlines. Automated fixtures separately cover provider failures, resumable one-call scans, scope preservation, source references, completed submissions and the PDF viewer.

A source collection that contains no attendance statement cannot establish optional attendance. Named or group-specific sessions that cannot be safely matched remain visible as cited course rules, rather than being applied to every timetable event.
