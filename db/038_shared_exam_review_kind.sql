ALTER TABLE shared_exam_paper_reviews
  ADD COLUMN IF NOT EXISTS kind text CHECK (kind IN ('paper', 'solutions'));
