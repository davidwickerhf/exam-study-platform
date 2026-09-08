---
name: wicker-study
description: Use Wicker Study to read course materials, deadlines and attendance, plan study work, practice, generate a course guide, or maintain approved private context. Use for study.wicker.life or a connected Wicker Study MCP server.
---

# Wicker Study

The connected MCP server supplies the current workflow guide. At the start of a Wicker Study session, call `wicker_status` and `wicker_guidance` before choosing tools. Read guidance once per connection/version; fetch it again after an MCP update. Follow current tool schemas and the student’s instructions.

The guide covers source-backed answers, complete original downloads, proactive context updates, attendance, practice and local generation. Do not copy those workflows into this file: they update with MCP. Use `wicker_guidance` rather than asking the student to download another skill.

If the connected server lacks `wicker_guidance`, update to MCP 2.13.0 or newer and restart the connection. Do not pretend the guide was read. Never request credentials in chat; use `wicker_authorize` when not connected. Preserve approval requirements for actual writes.
