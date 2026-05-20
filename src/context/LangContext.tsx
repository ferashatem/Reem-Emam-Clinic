import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { t, type Lang } from '../lang'

type Translation = typeof t.ar | typeof t.en

interface LangCtx {
  lang: Lang
  tr: Translation
  toggle: () => void
}

const LangContext = createContext<LangCtx | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('ar')

  useEffect(() => {
    const tr = t[lang]
    document.documentElement.lang = lang
    document.documentElement.dir = tr.dir
  }, [lang])

  const toggle = () => setLang(l => (l === 'ar' ? 'en' : 'ar'))

  return (
    <LangContext.Provider value={{ lang, tr: t[lang], toggle }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside LangProvider')
  return ctx
}
