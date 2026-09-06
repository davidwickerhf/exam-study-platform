# Wicker Study — contributor handoff

When implementation work on a feature branch is ready for review:

1. Run `npm run verify` and record the result. Do not hide skipped or
   unverified behavior.
2. Commit the in-scope work, push the branch, and open a non-draft pull
   request targeting `main` without waiting for separate authorization.
3. Never merge the pull request unless the user explicitly asks.
4. Put the exact routes to inspect, validation performed, and known gaps in
   the pull-request body.
5. Wait for the Vercel preview deployment, open the changed route, and verify
   that it renders before handing it off. Return both the clickable GitHub PR
   and the direct preview URL. A deployment dashboard link alone is not an
   inspectable preview.

Preserve unrelated work already present in a shared worktree. If the branch
contains recovered work from another agent, describe that scope honestly in
the pull request rather than silently dropping or splitting it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
