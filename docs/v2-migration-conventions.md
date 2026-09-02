# React workspace conventions

The workspace runs on Next.js App Router, React, and shadcn/ui. `/app` exists
only as a translator for historical hash links; product surfaces live at
`/v2/*`. This is what a workspace surface has to look like.

## The world — Dienstregeling

Documented in `DESIGN.md`. Three rules govern everything:

1. **One colour.** A saturated signal blue (`--primary`) marks what is live and
   is never spent on decoration. There is no success green, warning amber or
   danger red anywhere in the product. `--destructive` deliberately resolves to
   the type colour.
2. **State is a mark, not a hue.** Recorded, missing, overdue, done are carried
   by marks, weight and position, so every status survives greyscale.
3. **One ruling axis.** The teaching period governs the product.

Ink ground, paper-white type, orthogonal (2px radii), no soft shadows on the
board. Anything read at length — a tutor's answer, a chapter — is laid on the
board as a **punched paper window** (`bg-paper text-paper-ink`), the only place
the ink inverts and the only element that casts a shadow.

Archivo carries interface type. **Archivo Narrow carries every numeral, course
code, date and countdown, always tabular** — use `className="font-data
tabular-nums"`.

Banned, and the detector will catch them: eyebrows/kickers above headings,
same-size cards as page structure, cards inside cards, gradient text, a colour
per course.

## Conventions

- Route files live at `app/v2/<surface>/page.tsx`, `'use client'` at the top.
- **Domain rules go in `lib/v2/<name>.mjs` with a `<name>.d.mts` beside it** —
  plain ESM, not `.ts`. This project's TypeScript is the native 7.x build with
  no `transpileModule`, so `node:test` must import the module the page uses.
  A second hand-maintained copy is how rules drift.
- **Every rule module gets a test** in `test/v2-<name>.test.mjs`. Test the
  arithmetic and the edge cases that look right and are quietly wrong, not the
  rendering.
- Use shadcn components from `@/components/ui/*`. Add missing ones with
  `npx shadcn@latest add <name> --yes`. Never hand-roll a control that exists.
- `className` is for layout, not for overriding component colour or type.
- Use `gap-*`, never `space-y-*`. Use `size-*` when width and height match.
- Semantic tokens only: `bg-background`, `text-muted-foreground`, `border`.
  Never raw hex or `bg-blue-500`.
- Icons come from `lucide-react`; inside a `Button` use `data-icon="inline-start"`
  and no sizing class.
- Empty states use `Empty`; loading uses `Skeleton`; never a custom
  `animate-pulse` div.

## Data

Every `/api/*` route is served by `server.mjs` and is already authenticated —
`app/v2/layout.tsx` attaches the Clerk bearer token, so a page calls plain
`fetch('/api/…', { headers: { accept: 'application/json' } })`.

Fetch in a `useEffect` with a `live` flag so a unmounted component does not set
state. Surface failures in the UI with the real message; never swallow them.

## Honesty rules

These matter more than the visuals.

- **Never invent a number.** If the vanilla version showed a metric computed
  from client caches you cannot faithfully reproduce, report what you *can*
  source and name it accurately rather than publishing a different number under
  the same label.
- **Say what is missing.** If a source is not connected, name it — "Canvas is
  not connected, so hand-ins are not shown" — rather than rendering an empty
  list that reads as "nothing due".
- **Absent is not zero.** A course with no topics set up has unknown mastery,
  not 0%.
- If a sub-feature cannot be implemented faithfully, keep it unavailable and
  say exactly why. Do not publish a partial write path or imply it works.

## Browser study state

Chapter read-state lives in `localStorage` under
`chapter-read:<courseId>/<chapterId>` — use `readKey` from
`lib/v2/courses.mjs`. Hosted sessions back this state up through the browser-state API.

## Before you are done

```
npm run typecheck     # must be clean
npm run build         # must compile
DATABASE_URL= npm test    # must pass
```

Do not commit; report what you changed.
