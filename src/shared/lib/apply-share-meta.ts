import { shareCardText, type ShareCard } from './share-preview'

/** Point the open page at this product. Crawlers never run this; the worker does. */
export function applyShareCard(card: ShareCard) {
  const previousTitle = document.title
  document.title = card.title
  const description = shareCardText(card) || card.siteName
  const restore = [
    setMeta('name', 'description', description),
    setMeta('property', 'og:type', 'product'),
    setMeta('property', 'og:title', card.title),
    setMeta('property', 'og:description', description),
    setMeta('property', 'og:url', card.url),
    setMeta('property', 'og:site_name', card.siteName),
    card.image ? setMeta('property', 'og:image', card.image) : null,
  ]
  return () => {
    document.title = previousTitle
    for (const undo of restore) undo?.()
  }
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`
  let element = document.head.querySelector(selector)
  const created = !element
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, key)
    document.head.append(element)
  }
  const previous = element.getAttribute('content')
  element.setAttribute('content', content)
  return () => {
    if (created) element?.remove()
    else if (previous == null) element?.removeAttribute('content')
    else element?.setAttribute('content', previous)
  }
}
