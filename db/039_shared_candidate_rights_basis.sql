UPDATE editorial_contributions contribution
SET rights_basis = 'Student explicitly allowed community sharing; administrator rights review is still required.'
FROM canvas_source_snapshots snapshot
JOIN canvas_course_bindings binding ON binding.id = snapshot.binding_id
JOIN canvas_corpus_permissions permission
  ON permission.user_id = snapshot.contributor_user_id AND permission.origin = binding.origin
WHERE contribution.id = snapshot.contribution_id
  AND contribution.consent_status = 'candidate'
  AND contribution.rights_basis = 'Private Canvas corpus; usable only by the contributing account.'
  AND snapshot.sharing_mode = 'community'
  AND permission.collection_enabled = true
  AND permission.sharing_mode = 'community';
