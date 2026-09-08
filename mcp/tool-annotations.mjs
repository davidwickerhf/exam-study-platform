// Transport-independent MCP behavior hints. Confirmation policy is separate:
// drafting, local downloads and generation continuations can write without
// requiring a new confirmation on every step. Never infer reads from that policy.
const reads = new Set(`
whoami wicker_status wicker_guidance
list_courses get_course get_chapter get_course_outline list_materials search_course
search_regulations list_regulation_sources canvas_corpus_status
list_questions get_practice_queue get_progress list_flashcards list_due_cards
list_mistakes list_mock_sessions get_mock_session get_academic_plan get_planning_context
list_known_programmes get_calendar get_activity get_account_summary get_study_briefing
canvas_updates preview_calendar study_generation_contract study_generation_sources
read_course_source read_original_chunk canvas_course_materials
canvas_groups canvas_assignment_detail canvas_sync_logs tutor_history tutor_conversation
tutor_sources get_study_work get_attendance get_course_obligations get_study_readiness
get_weekly_review canvas_search_announcements get_study_diagnostic feedback_list feedback_read
canvas_course_requirements canvas_list_remote_courses canvas_list_remote_course_modules
admin_status admin_inventory_course_folder admin_list_canvas_courses
admin_list_canvas_course_modules admin_list_editorial_workspace admin_estimate_course_generation
admin_list_members admin_list_materials admin_list_flashcards admin_list_questions admin_list_programmes
`.trim().split(/\s+/))

const externalReads = new Set(`get_calendar get_study_briefing canvas_updates preview_calendar
canvas_groups canvas_assignment_detail canvas_course_requirements canvas_list_remote_courses
canvas_list_remote_course_modules admin_list_canvas_courses admin_list_canvas_course_modules`.split(/\s+/))
const additiveWrites = new Set(`feedback_prepare feedback_submit feedback_reply
study_generation_start study_generation_add_notes tutor_prepare_context tutor_prepare_attendance_update
tutor_add_source create_flashcard record_chapter_read download_course_original prepare_original_download`.split(/\s+/))

export function toolAnnotations(name) {
  if (reads.has(name)) return { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: externalReads.has(name) }
  // Unclassified additions retain MCP's conservative mutation defaults.
  return { readOnlyHint: false, destructiveHint: !additiveWrites.has(name), idempotentHint: false, openWorldHint: true }
}
