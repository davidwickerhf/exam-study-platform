'use client'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function DocumentMarkdown({children}:{children:string}) {
  return <article className="document-prose mx-auto w-full max-w-4xl p-6 sm:p-10 text-base leading-7 break-words [overflow-wrap:anywhere] [&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:mb-6 [&_h2]:my-6 [&_h3]:my-4 [&_p]:my-4 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:my-2 [&_a]:text-primary [&_a]:underline [&_pre]:overflow-auto [&_pre]:bg-muted [&_pre]:p-4 [&_code]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_table]:block [&_table]:overflow-auto [&_th]:border [&_th]:p-3 [&_td]:border [&_td]:p-3 [&_hr]:my-6">
    <Markdown skipHtml remarkPlugins={[remarkGfm]} urlTransform={url=> /^(https?:\/\/|mailto:)/i.test(url) ? url : ''} components={{
      a:({href,children})=>href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
      img:({alt})=><span className="text-muted-foreground">[Image{alt ? `: ${alt}` : ' available in the original'}]</span>,
    }}>{children}</Markdown>
  </article>
}

export function HtmlDocument({html}:{html:string}) {
  // The API supplies allowlisted markup. The sandbox and CSP are independent
  // barriers: no script execution, origin access, forms or automatic requests.
  const document = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>
    *{box-sizing:border-box}body{margin:0;background:#fff;color:#20263a;font:16px/1.75 system-ui,sans-serif;overflow-wrap:anywhere}body>main{max-width:896px;margin:auto;padding:40px}h1,h2,h3,h4{line-height:1.25;letter-spacing:-.02em;margin:1.5em 0 .7em}h1{font-size:30px}main>h1:first-child,article>header:first-child>h1:first-child{margin-top:0}h2{font-size:24px}h3{font-size:20px}p{margin:1em 0}a[href]{color:#484be5;text-decoration:underline}pre{overflow:auto;background:#f3f4f7;padding:16px;white-space:pre-wrap}code{font-size:14px}blockquote{border-left:2px solid #b9bed0;margin:24px 0;padding-left:20px}table{display:block;overflow:auto;border-collapse:collapse;max-width:100%}th,td{border:1px solid #ddd;padding:10px;text-align:left}hr{border:0;border-top:1px solid #ddd;margin:24px 0}li{margin:6px 0}summary{cursor:pointer}@media(max-width:540px){body>main{padding:24px}h1{font-size:26px}}
  </style></head><body><main>${html}</main></body></html>`
  return <iframe title="HTML document" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={document} className="block h-full min-h-80 w-full border-0 bg-white" />
}
