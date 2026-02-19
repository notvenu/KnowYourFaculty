import { Link } from "react-router-dom";
import { memo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGithub,
  faLinkedin,
  faInstagram,
} from "@fortawesome/free-brands-svg-icons";

function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-(--line) bg-(--bg-elev)">
      <div className="flex flex-col gap-5 px-4 py-6 text-sm text-(--muted) sm:px-6 md:px-8 lg:px-12 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 text-center md:text-left">
          <p className="font-medium">© 2026 KnowYourFaculty</p>
          <p className="flex items-center justify-center gap-2 text-sm md:justify-start">
            <span>Built with ❤️ by</span>
            <a
              href="https://github.com/notvenu"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-(--primary) hover:underline"
            >
              Venu K
            </a>
          </p>
        </div>
        <div className="flex flex-col gap-3 items-center md:items-end">
          <nav className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/privacy-policy"
              className="font-medium hover:text-(--text)"
            >
              Privacy
            </Link>
            <Link
              to="/terms-and-conditions"
              className="font-medium hover:text-(--text)"
            >
              Terms
            </Link>
            <Link to="/contact" className="font-medium hover:text-(--text)">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/notvenu"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-xl text-(--muted) transition-colors hover:text-(--text)!"
            >
              <FontAwesomeIcon icon={faGithub} />
            </a>
            <a
              href="https://linkedin.com/in/venu-kasibhatla"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-xl text-(--muted) transition-colors hover:text-[#0077B5]!"
            >
              <FontAwesomeIcon icon={faLinkedin} />
            </a>
            <a
              href="https://instagram.com/veeennnuuu"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-xl text-(--muted) transition-colors hover:text-[#E4405F]!"
            >
              <FontAwesomeIcon icon={faInstagram} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default memo(SiteFooter);
