import sanitizeHtml from 'sanitize-html'

// Imported originals are untrusted, even when Canvas has already filtered them.
// No source styles, embedded browsing contexts, forms, IDs or network resources.
export function sanitizeDocumentHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['article','section','header','footer','main','div','span','p','br','hr','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s','del','sub','sup','blockquote','pre','code','ul','ol','li','dl','dt','dd','table','caption','thead','tbody','tfoot','tr','th','td','a','details','summary'],
    allowedAttributes: { a: ['href','title','target','rel'], th: ['colspan','rowspan','scope'], td: ['colspan','rowspan'], ol: ['start'], li: ['value'] },
    allowedSchemes: ['https','http','mailto'],
    allowProtocolRelative: false,
    nonTextTags: ['head','script','style','textarea','option','iframe','object','embed','svg','math','template','noscript'],
    transformTags: {
      a: (_tag, attrs) => ({ tagName:'a', attribs: {
        ...( /^(https?:\/\/|mailto:)/i.test(attrs.href || '') ? {href:attrs.href} : {}),
        ...(attrs.title ? {title:attrs.title} : {}), target:'_blank', rel:'noopener noreferrer',
      }}),
      img: (_tag, attrs) => ({tagName:'span', attribs:{}, text:attrs.alt ? `[Image: ${attrs.alt}]` : '[Image available in the original]'}),
    },
  })
}
