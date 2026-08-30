# Course ingestion playbook

This is the default process for turning an unsupported academic course into a
maintained Wicker Study course. A student request and its attachments are
private intake evidence, not publishable content.

## 1. Collect and verify

- Confirm the university, course code and title, academic year, period, and
  curriculum edition. Keep older editions distinct when a course has been
  renamed, rearranged, merged, or taught under another programme structure.
- Inventory the syllabus/course manual, learning outcomes, weekly slides,
  readings, tutorials, practice sheets, assessment rules, past or mock exams,
  and useful public URLs.
- Record gaps and verify that Wicker Study may store and redistribute each
  source. Private student uploads remain in the request inbox and must never be
  copied into the public editorial release without this review.

Exit: the course identity and edition are unambiguous, rights are recorded, and
the source inventory is sufficient or its gaps are explicit.

## 2. Extract and normalise

- Extract PDFs page by page; OCR image-only pages. Extract slides, office
  documents, images, code, tables, equations, and link targets without losing
  source filenames or page/slide numbers.
- De-duplicate identical files by digest. Preserve contradictory or superseded
  sources with dates instead of silently merging them.
- Separate instructions, examinable teaching content, solutions/answer keys,
  and administrative material.

Exit: every usable source has machine-readable text, stable provenance, a
content type, and an edition/date.

## 3. Map the course

- Build a coverage matrix from learning outcome → topic → prerequisite → source
  pages → teaching week → assessment evidence.
- Derive the chapter spine from that matrix, not from filenames alone. Map
  renamed or rearranged topics to the current course while retaining historical
  context.
- Record exam format, allowed aids, question styles, grading weights, and the
  expected depth for each outcome. Treat the syllabus/course manual and
  introductory deck as the normal authorities for pass requirements. Record
  every component (for example 70% exam and 30% project), minimum component
  grades, project/presentation deadlines, attendance rules, and resit rules
  with document/page evidence. Never resolve a contradiction by guessing.

Exit: each learning outcome and assessment skill has source coverage and an
explicit home in the proposed course structure; assessment weights total 100%
or a visible review warning explains why they do not.

## 4. Build the retrieval index

- Create bounded overlapping chunks for all approved sources. Scope every chunk
  to the course and curriculum edition; retain document, page/slide, heading,
  and material-type metadata.
- Index worked examples, diagrams, tables, and equations with the surrounding
  explanation. Keep answer keys tagged so the tutor does not reveal them in the
  wrong context.
- Run representative retrieval checks for every mapped outcome and several
  cross-topic questions. Unsupported answers must be declined.

Exit: retrieval returns relevant, citation-ready evidence for the entire
coverage matrix without leaking another course or edition.

## 5. Create useful study pages

- Write concise concept explanations, definitions, diagrams, worked examples,
  common misconceptions, prerequisite refreshers, and links between topics.
- Ground factual claims and course-specific rules in indexed sources. Clearly
  label editorial explanation or inference.
- Prefer a coherent learning path over a slide-by-slide transcription. Include
  source and curriculum-edition context where it matters.

Exit: every chapter is accurate, navigable, source-grounded, and useful without
having the original slides open beside it.

## 6. Create practice and assessment preparation

- Create recall, conceptual, calculation, proof, implementation, and synthesis
  exercises where appropriate, progressing from guided to exam-level work.
- Provide worked solutions or grading guidance with common failure modes. Build
  flashcards for durable knowledge, practice sheets for application, and mock
  exams matching the real coverage, style, duration, and difficulty.
- Never present generated questions as past university questions. Keep genuine
  past papers and their rights/provenance distinct.

Exit: every important outcome has enough varied practice and the mocks represent
the actual assessment rather than generic subject trivia.

## 7. Quality review

- Check factual accuracy, calculations, code, citations, retrieval coverage,
  curriculum edition, assessment alignment, difficulty distribution,
  accessibility, and mobile layout.
- Check that solutions do not leak into question views, private details are
  absent, source rights permit publication, and generated material is labelled
  where needed.
- Have a human reviewer sample every chapter and exercise family. Block
  publication for missing core outcomes, uncited course-specific claims, or
  unresolved rights.

Exit: the release checklist is signed off and remaining limitations are visible
to students.

## 8. Publish and maintain

- In hosted mode, approve the versioned course-profile, study-page, exercise,
  flashcard, and quality-report artifacts, then publish the course edition with
  explicit course-code confirmation. The workspace copies reviewed derivatives
  into the active release while keeping original contribution files private.
- For the bundled repository corpus, use `content:check`, `content:ingest`,
  `content:publish`, `content:extract`, and `content:index` as described in
  `docs/CONTENT_PIPELINE.md`.
- Verify the active release, material byte counts, PDF extraction, retrieval
  citations, question banks, flashcards, mocks, and the student-facing route.
- Mark the request published only after the production course is live. When a
  weekly deck, late mock exam, or corrected syllabus arrives, sync the updated
  manifest. Hashes retain unchanged artifacts and queue only the affected
  mapping, retrieval, authoring, practice, and QA stages.

Exit: the versioned course is live, observable, and has a named maintenance
path for future curriculum changes.

## Definition of done

- Course identity and curriculum edition are explicit.
- All approved sources are extracted, deduplicated, and traceable.
- Every learning outcome is represented in the coverage matrix and study pages.
- Retrieval is course-scoped and returns page/slide citations.
- Exercises cover recall through exam-level application, with reviewed answers.
- Mock exams reflect the actual assessment format and are not misrepresented.
- Rights, privacy, accuracy, accessibility, and responsive UI have been reviewed.
- A versioned release is live and the originating request is marked published.
