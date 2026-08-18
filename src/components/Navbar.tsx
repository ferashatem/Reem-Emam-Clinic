import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLang } from "../context/LangContext";
import logo from "../assets/logo.webp";

interface Props {
  /** True on the landing page, where the bar floats over the dark hero photo. */
  onDark?: boolean;
}

export default function Navbar({ onDark = false }: Props) {
  const { tr, lang, toggle } = useLang();
  const [scrolled, setScrolled] = useState(false);
  /**
   * The bar is shared with pages that have no sections of their own, where a
   * bare `#hero` / `#booking` jump lands nowhere. Off the landing page both
   * become routes back to it, so the logo is always the way home.
   */
  const onLanding = useLocation().pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`nav${scrolled ? " scrolled" : ""}${onDark ? " nav--onDark" : ""}`}
    >
      {onLanding ? (
        <a href="#hero" className="nav__brand" aria-label={tr.nav.brand}>
          <BrandMark lang={lang} />
        </a>
      ) : (
        <Link to="/" className="nav__brand" aria-label={tr.nav.brand}>
          <BrandMark lang={lang} />
        </Link>
      )}

      {/* Nothing left to collapse behind a burger — the booking CTA is the
          whole menu now, so it sits out in the open on every screen. */}
      <div className="nav__end">
        {/* Off the landing page there's nowhere to go "back" to in the bar
            itself, so the way home gets its own button next to the logo. */}
        {!onLanding && (
          <Link to="/" className="btn btn--outline-gold btn--sm nav__back">
            <span>{lang === "ar" ? "الرئيسية" : "Home"}</span>
          </Link>
        )}
        <button className="lang" onClick={toggle} aria-label="Switch language">
          {lang === "ar" ? "EN" : "عر"}
        </button>
        {onLanding ? (
          <a href="#booking" className="btn btn--primary btn--sm nav__book">
            <span>{tr.nav.cta}</span>
          </a>
        ) : (
          <Link to="/#booking" className="btn btn--primary btn--sm nav__book">
            <span>{tr.nav.cta}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

function BrandMark({ lang }: { lang: string }) {
  return (
    <>
      <img src={logo} alt="" className="brand-logo" />
      <span className="nav__brand-text">
        <b>{lang === "ar" ? "ريم غلو هاوس" : "Dr Reem Emam"}</b>
        {/* the signage wordmark is English on the wall, in both languages */}
        <em>Beauty &amp; Glow Clinic</em>
      </span>
    </>
  );
}
