import { useLang } from '../context/LangContext'

export default function Footer() {
  const { tr } = useLang()
  const f = tr.footer

  return (
    <footer className="footer">
      <div className="f-logo">{f.brand}</div>
      <div className="f-tag">{f.tag}</div>
      <div className="f-socials">
        <a href="#" className="f-s" title="Instagram" aria-label="Instagram">📸</a>
        <a href="#" className="f-s" title="TikTok"    aria-label="TikTok">🎵</a>
        <a href="#" className="f-s" title="WhatsApp"  aria-label="WhatsApp">💬</a>
        <a href="#" className="f-s" title="Snapchat"  aria-label="Snapchat">👻</a>
      </div>
      <div className="f-copy">{f.copy}</div>
    </footer>
  )
}
