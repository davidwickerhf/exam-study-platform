-- Promote already-indexed, byte-identical Project 3-1 copies during deploy.
-- Future Canvas scans perform the same reviewed-hash promotion in the worker.
WITH reviewed (sha256, title, document_kind, authority, filename) AS (
  VALUES
    ('f644141aeee56c27c73773ee5fc902c124dd8c288318439c9dd10bf44552c609', 'Education and Examination Regulations 2026–2027', 'education-examination-regulations', 'Faculty Board, Faculty of Science and Engineering', 'EER Bachelor FSE-DACS 2026-2027.pdf'),
    ('e4f48de50e1c0c1425686ca44b0146ed2094fb5176c859ef58f6f35605efca31', 'Rules and Regulations BSc DSAI and CS 2026–2027', 'rules-regulations', 'Board of Examiners, Department of Advanced Computing Sciences', 'RR BSc DSAI CS 2026 2027.pdf')
)
INSERT INTO programme_policy_sources
  (id, asset_id, title, document_kind, institution, academic_year, authority, visibility, rights_basis, original_downloadable, status, metadata, created_by)
SELECT 'policy-' || left(reviewed.sha256, 24), asset.id, reviewed.title, reviewed.document_kind,
  'Maastricht University · Faculty of Science and Engineering', '2026-2027', reviewed.authority,
  'university', 'institution-member-reference', false, 'draft',
  jsonb_build_object('filename', reviewed.filename, 'sha256', reviewed.sha256, 'provenance', jsonb_build_object(
    'kind', 'canvas-course', 'courseCode', 'BCS3300', 'courseName', 'Project 3-1', 'courseEdition', '2026-2027-002-BCS3300'
  )), 'reviewed-canvas-policy'
FROM reviewed JOIN editorial_source_assets asset ON asset.sha256=reviewed.sha256
ON CONFLICT (id) DO UPDATE SET asset_id=excluded.asset_id, title=excluded.title, document_kind=excluded.document_kind,
  institution=excluded.institution, academic_year=excluded.academic_year, authority=excluded.authority,
  visibility=excluded.visibility, rights_basis=excluded.rights_basis, original_downloadable=false,
  metadata=excluded.metadata, updated_at=now();

WITH programmes (programme_id) AS (
  VALUES
    ('maastricht-university-bsc-computer-science'),
    ('maastricht-university-bsc-data-science-and-artificial-intelligence')
)
INSERT INTO programme_policy_source_programmes (source_id, programme_id)
SELECT source.id, programmes.programme_id
FROM programme_policy_sources source CROSS JOIN programmes
WHERE source.id IN (
  'policy-f644141aeee56c27c73773ee',
  'policy-e4f48de50e1c0c1425686ca'
)
ON CONFLICT DO NOTHING;

INSERT INTO programme_policy_retrieval_chunks
  (source_id, asset_id, page_number, chunk_index, content, metadata, embedding, embedding_model, embedded_at)
SELECT DISTINCT ON (source.id, chunk.page_number, chunk.chunk_index)
  source.id, chunk.asset_id, chunk.page_number, chunk.chunk_index, chunk.content,
  jsonb_build_object('title', source.title, 'provenance', source.metadata->'provenance'),
  chunk.embedding, chunk.embedding_model, chunk.embedded_at
FROM programme_policy_sources source
JOIN editorial_source_retrieval_chunks chunk ON chunk.asset_id=source.asset_id
WHERE source.id IN (
  'policy-f644141aeee56c27c73773ee',
  'policy-e4f48de50e1c0c1425686ca'
)
ORDER BY source.id, chunk.page_number, chunk.chunk_index, chunk.edition_id
ON CONFLICT (source_id, page_number, chunk_index) DO UPDATE SET content=excluded.content,
  metadata=excluded.metadata, embedding=excluded.embedding, embedding_model=excluded.embedding_model, embedded_at=excluded.embedded_at;

UPDATE programme_policy_sources source SET status='indexed', updated_at=now()
WHERE source.id IN (
  'policy-f644141aeee56c27c73773ee',
  'policy-e4f48de50e1c0c1425686ca'
)
AND EXISTS (SELECT 1 FROM programme_policy_retrieval_chunks chunk WHERE chunk.source_id=source.id);
