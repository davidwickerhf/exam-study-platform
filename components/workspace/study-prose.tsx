'use client'
import 'katex/dist/katex.min.css'
import Markdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
export function StudyProse({ children }: { children: string }) {
  return (
    <div className="text-sm leading-7 break-words [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_code]:font-mono [&_code]:text-xs [&_h3]:my-4 [&_h3]:font-semibold [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_.katex-display]:overflow-x-auto">
      <Markdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [rehypeKatex, { throwOnError: false, strict: false, trust: false }]
        ]}
        components={{ img: () => null, a: ({ children }) => <>{children}</> }}
      >
        {children}
      </Markdown>
    </div>
  )
}
