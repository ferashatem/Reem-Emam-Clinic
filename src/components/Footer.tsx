import { useLang } from "../context/LangContext";
import logo from "../assets/logo.png";
import {
  AtIcon,
  FacebookIcon,
  InstagramIcon,
  MapPinIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "./brand/SocialIcons";

export default function Footer() {
  const { tr, lang } = useLang();
  const f = tr.footer;

  return (
    <footer className="foot">
      <div className="foot__watermark" aria-hidden>
        Dr Reem Emam
      </div>

      <div className="foot__grid">
        <div className="foot__col">
          <div className="foot__brand">
            <img src={logo} alt="" className="brand-logo" />
            <span className="foot__brand-text">
              <b>{lang === "ar" ? "ريم غلو هاوس" : "Dr Reem Emam"}</b>
              <em>Believe in your Glow ♡</em>
            </span>
          </div>
          <p className="foot__tag">{f.tag}</p>
          <a href="#booking" className="btn btn--gold btn--sm">
            <span>{f.getStarted}</span>
          </a>
          <div className="foot__socials">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noreferrer"
              className="foot__s"
              aria-label="Facebook"
            >
              <FacebookIcon />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="foot__s"
              aria-label="Instagram"
            >
              <InstagramIcon />
            </a>
            <a
              href="https://wa.me/201019191995"
              target="_blank"
              rel="noreferrer"
              className="foot__s"
              aria-label="WhatsApp"
            >
              <WhatsAppIcon />
            </a>
          </div>
        </div>

        <div className="foot__col">
          <h4>{f.contactTitle}</h4>
          <ul className="foot__contacts">
            <li>
              <a href="tel:+201019191995">
                <span className="ico">
                  <PhoneIcon />
                </span>
                {tr.booking.contacts.phone.value}
              </a>
            </li>
            <li>
              <a href="https://instagram.com" target="_blank" rel="noreferrer">
                <span className="ico">
                  <AtIcon />
                </span>
                {tr.booking.contacts.instagram.value}
              </a>
            </li>
            <li>
              {/* the address is Arabic in both languages, so it carries its own dir */}
              <span className="foot__contact" dir="rtl">
                <span className="ico">
                  <MapPinIcon />
                </span>
                {tr.booking.contacts.location.value}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="foot__copy">
        <span>{f.copy}</span>
      </div>
    </footer>
  );
}
