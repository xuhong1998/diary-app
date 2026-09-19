/**
 * 感悟富文本的工具层。
 * reflections.text 自本次改造起存受限 HTML（p / ul / li / blockquote / b / strong / i / em / br）。
 * 所有「写入 UI / 渲染」都先过 sanitize；旧纯文本数据自动包成 <p> 兼容。
 */

const ALLOWED = new Set(['P', 'UL', 'LI', 'BLOCKQUOTE', 'B', 'STRONG', 'I', 'EM', 'BR'])

/** 白名单过滤：只留允许的标签，剥掉全部属性，其余标签解包保留文字 */
export function sanitizeRichText(html: string): string {
  const box = document.createElement('div')
  box.innerHTML = html

  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element
        walk(el)
        if (!ALLOWED.has(el.tagName)) {
          // 不允许的标签：解包（文字留下），脚本/样式等内容直接丢弃
          if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH'].includes(el.tagName)) {
            el.remove()
          } else {
            el.replaceWith(...el.childNodes)
          }
        } else {
          for (const attr of [...el.attributes]) el.removeAttribute(attr.name)
        }
      } else if (child.nodeType !== Node.TEXT_NODE) {
        child.remove()
      }
    }
  }
  walk(box)
  return box.innerHTML
}

/** 纯文本兜底：旧数据 / 无标签内容包成段落 */
export function ensureRichText(text: string): string {
  const raw = (text || '').trim()
  if (!raw) return ''
  if (/<[a-z][\s\S]*>/i.test(raw)) return sanitizeRichText(raw)
  return `<p>${raw
    .split(/\n+/)
    .map(escapeHtml)
    .join('</p><p>')}</p>`
}

/** 块拍平成一行一段的纯文本预览（line-clamp 对多块内容不生效，卡片的截断用它） */
export function previewOf(html: string): string {
  const box = document.createElement('div')
  box.innerHTML = html
  return [...box.querySelectorAll('p, li, blockquote')]
    .map(el => el.textContent.trim())
    .filter(Boolean)
    .join('<br>')
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c)
}
