// Block-level ADF nodes that should end with a line break once their
// children have been rendered.
const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'tableRow',
  'panel',
])

function renderNode(node: unknown): string {
  if (typeof node !== 'object' || node === null) return ''
  const record = node as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type : ''
  const attrs = (
    typeof record.attrs === 'object' && record.attrs !== null ? record.attrs : {}
  ) as Record<string, unknown>

  switch (type) {
    case 'text':
      return typeof record.text === 'string' ? record.text : ''
    case 'hardBreak':
      return '\n'
    case 'mention':
    case 'status':
      return typeof attrs.text === 'string' ? attrs.text : ''
    case 'emoji':
      return typeof attrs.shortName === 'string' ? attrs.shortName : ''
    case 'inlineCard':
      return typeof attrs.url === 'string' ? attrs.url : ''
    case 'rule':
      return '---\n'
    default:
      break
  }

  let out = ''
  if (Array.isArray(record.content)) {
    for (const child of record.content) {
      out += renderNode(child)
    }
  }
  if (BLOCK_TYPES.has(type)) out += '\n'
  return out
}

/**
 * Renders a Jira description as plain text. Jira Server/DC (API v2) returns
 * plain strings; Jira Cloud (API v3) returns an Atlassian Document Format
 * node tree, which is walked recursively.
 */
export function descriptionToText(description: unknown): string {
  if (description === null || description === undefined) return ''
  if (typeof description === 'string') return description
  return renderNode(description)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
