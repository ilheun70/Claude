type Child = Node | string | null | undefined | false

/** Minimal element builder: h('p', { class: 'x' }, 'text', child). Text is never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | EventListener> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v)
    else if (v === true) el.setAttribute(k, '')
    else if (v !== false) el.setAttribute(k, v)
  }
  for (const c of children) if (c) el.append(c)
  return el
}
