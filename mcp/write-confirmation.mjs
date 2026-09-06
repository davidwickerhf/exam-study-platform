import { AsyncLocalStorage } from 'node:async_hooks'
export const toolRequestContext = new AsyncLocalStorage()
const writes = new Set('feedback_withdraw_contact feedback_submit feedback_reply feedback_withdraw_evidence feedback_react wicker_sign_out join_programme canvas_corpus_sync submit_answer set_mastery review_card add_to_deck create_flashcard review_flashcard resolve_mistake record_chapter_read save_academic_plan update_planning_objective set_course_visibility apply_changes save_calendar_link sync_calendar_link remove_calendar_link canvas_import_remote_course canvas_import_remote_course_set canvas_sync_control canvas_sync_course tutor_ask tutor_approve_action tutor_delete_conversation tutor_add_source tutor_remove_source tutor_forget_context tutor_confirm_update answer_study_diagnostic'.split(' '))
export function requiresWriteConfirmation(name) {
  return writes.has(name) || name.startsWith('admin_') && !/^(admin_status|admin_inventory_|admin_list_|admin_estimate_)/.test(name)
}
export function installWriteConfirmation(server, z) {
  const register = server.tool.bind(server)
  server.tool = (name, description, schema, handler) => {
    const handle = handler
    handler = (args, extra) => toolRequestContext.run({ tool: name, confirmed: args.confirmed === true }, () => handle(args, extra))
    if (!requiresWriteConfirmation(name)) return register(name, description, schema, handler)
    const dryRun = name === 'admin_sync_course_folder'
    return register(name, `${description} Requires explicit student confirmation for this individual write; prior approvals do not authorise later writes.`, { ...schema, confirmed: dryRun ? z.literal(true).optional() : z.literal(true) }, (args, extra) => {
      if (!(dryRun && args.dryRun !== false) && args.confirmed !== true) return { isError: true, content: [{ type: 'text', text: 'Show the exact change and obtain explicit confirmation before this write.' }] }
      return handler(args, extra)
    })
  }
}
