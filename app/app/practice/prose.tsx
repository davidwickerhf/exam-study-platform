"use client";

/**
 * The maths typesetter, on its own chunk.
 *
 * react-markdown, remark-math, rehype-katex and KaTeX's stylesheet are the
 * heaviest thing Practice loads, and nothing on the page needs them until a
 * question is actually on screen. Keeping them here — behind the `dynamic()`
 * boundary in `shared.tsx` — is what stops the mistake bank and the mock log
 * from shipping a formula renderer they never call.
 */

import "katex/dist/katex.min.css";

import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

export default function ProseBody({
  source,
  inline,
}: {
  source: string;
  inline?: boolean;
}) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
      // A multiple-choice option is one line inside a list item, so it keeps
      // the maths and the emphasis but not the paragraph around them.
      components={inline ? { p: ({ children }) => <>{children}</> } : undefined}
    >
      {source}
    </Markdown>
  );
}
