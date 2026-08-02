import { useState, useEffect } from "react";
import { useLang } from "../context/LangContext";
import logo from "../assets/logo.png";

interface Props {
  /** True on the landing page, where the bar floats over the dark hero photo. */
  onDark?: boolean;
}

export default function Navbar({ onDark = false }: Props) {
  const { tr, lang, toggle } = useLang();
  const [scrolled, setScrolled] = useState(false);

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
      <a href="#hero" className="nav__brand" aria-label={tr.nav.brand}>
        <img src={logo} alt="" className="brand-logo" />
        <span className="nav__brand-text">
          <b>{lang === "ar" ? "ريم غلو هاوس" : "Dr Reem Emam"}</b>
          {/* the signage wordmark is English on the wall, in both languages */}
          <em>Beauty &amp; Glow Clinic</em>
        </span>
      </a>

      {/* Nothing left to collapse behind a burger — the booking CTA is the
          whole menu now, so it sits out in the open on every screen. */}
      <div className="nav__end">
        <button className="lang" onClick={toggle} aria-label="Switch language">
          {lang === "ar" ? "EN" : "عر"}
        </button>
        <a href="#booking" className="btn btn--primary btn--sm nav__book">
          <span>{tr.nav.cta}</span>
        </a>
      </div>
    </nav>
  );
}
