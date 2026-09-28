# Shared exam papers

Each course has a stable link at `/share/courses/{COURSE_CODE}/exam-papers`.
The page lists released paper and solution PDFs by academic year before sign-in.
Original bytes require a verified Maastricht University account (or a global
administrator reviewing the release). The link survives sign-in and sign-up,
and this page does not require programme selection or workspace onboarding.

Canvas **Share with community** consent creates potential contributions. It
does not release originals. The global administration page links to **Exam
originals review**, which suggests likely papers and solutions. Enable **Show
all PDFs** to find files whose names do not identify them as exams, such as
`F14-t1.pdf`, and classify them manually. To release one:

1. Review and accept the contribution in the existing editorial rights review.
2. Inspect the exact original, classify it as a paper or solutions, and record the basis for sharing that original
   with all verified Maastricht members.
3. Approve the original in `/app/admin/exam-papers`.

The public index and the file endpoint both recheck the approved decision,
current snapshot, community sharing mode, collection permission, accepted
contribution and complete stored asset on every request. Withholding a file,
retiring its snapshot, withdrawing contribution consent, or switching the
connection back to private removes access immediately. The original endpoint
supports range requests for browser PDF readers and sends `private, no-store`.

The first release covers exam and solution PDFs. General course materials,
non-PDF exam resources and personal practice sets remain in their existing
access paths until a separate original-sharing review is defined for them.
