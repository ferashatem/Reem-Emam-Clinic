import { useLang } from "../context/LangContext";
import logo from "../assets/logo.webp";
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
              href="https://www.facebook.com/profile.php?id=61593237171100"
              target="_blank"
              rel="noreferrer"
              className="foot__s"
              aria-label="Facebook"
            >
              <FacebookIcon />
            </a>
            <a
              href="https://www.instagram.com/dr_reememam"
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
              <a href={`mailto:${tr.booking.contacts.instagram.value}`}>
                <span className="ico">
                  <AtIcon />
                </span>
                {tr.booking.contacts.instagram.value}
              </a>
            </li>
            <li>
              <span className="foot__contact foot__contact--address">
                <span className="ico">
                  <MapPinIcon />
                </span>
                {/* The address is Arabic in both languages, so the text carries
                    its own direction — the row keeps the page's, or the pin
                    would swap sides and break rank with the rows above it. */}
                <span dir="rtl">{tr.booking.contacts.location.value}</span>
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
