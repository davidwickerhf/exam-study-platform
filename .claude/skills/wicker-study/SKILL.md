---
name: wicker-study
description: Use Wicker Study to read course materials, deadlines and attendance, plan study work, practice, generate a course guide, or maintain approved private context. Use for study.wicker.life or a connected Wicker Study MCP server.
---

# Wicker Study

The connected MCP server supplies the current workflow guide. At the start of a Wicker Study session, call `wicker_status` and `wicker_guidance` before choosing tools. Read guidance once per connection/version; fetch it again after an MCP update. Follow current tool schemas and the student’s instructions.

The guide covers source-backed answers, complete original downloads, proactive context updates, attendance, practice and local generation. Do not copy those workflows into this file: they update with MCP. Use `wicker_guidance` rather than asking the student to download another skill.

Keep these habits even before loading the detailed guide:

- Preserve the exact course and academic year, original filenames and page references. Professors’ explicit syllabus, lesson-plan and announcement rules take priority over generic timetable labels. Report missing or conflicting evidence rather than inventing a requirement.
- Notice lasting preferences, availability, project roles and decisions during conversation. Read existing context, prepare the exact update, and seek the required approval; do not wait for the student to remind you. A proposal is not saved memory: verify the successful receipt.
- Read before changing records. Show each concrete write and obtain its required confirmation. A student-requested local generation run authorises its successive next/submit steps, not sharing or unrelated changes. Inspect saved state before retrying an uncertain write.
- Use the agent’s own file and processing tools when available. Prefer `prepare_original_download` for complete originals, keep its temporary file capability out of chat/logs, and verify size/hash. Never ask for account or Canvas credentials in chat. Use only tools advertised by this connection.

If guidance cannot be read, say so and resolve the connection before relying on remembered workflow details. For hosted MCP, reconnect and use the client’s OAuth sign-in flow. For the optional local package, use `wicker_authorize` only if advertised; update the package if it lacks guidance. The full guide is served by MCP so pipeline changes do not require another skill download.
