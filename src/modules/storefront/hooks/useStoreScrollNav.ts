import { useEffect, useState } from 'react'

type ScrollSection = {
  id: string
  el: HTMLElement | null
}

/** Sync header nav highlight with scroll position on storefront home. */
export function useStoreScrollNav(getSections: () => ScrollSection[], deps: unknown[]) {
  const [activeNav, setActiveNav] = useState('home')

  useEffect(() => {
    function pickActiveSection() {
      const sections = getSections().filter((section): section is { id: string; el: HTMLElement } =>
        Boolean(section.el),
      )
      if (!sections.length) return

      const probe = window.scrollY + 96
      let current = sections[0]?.id ?? 'home'
      for (const section of sections) {
        if (section.el.offsetTop <= probe) current = section.id
      }
      setActiveNav(current)
    }

    pickActiveSection()
    window.addEventListener('scroll', pickActiveSection, { passive: true })
    window.addEventListener('resize', pickActiveSection)
    return () => {
      window.removeEventListener('scroll', pickActiveSection)
      window.removeEventListener('resize', pickActiveSection)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies stable deps (e.g. store.id)
  }, deps)

  return activeNav
}
