import { Link } from "react-router-dom";
import { memo } from "react";
import { useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGithub,
  faLinkedin,
  faInstagram,
} from "@fortawesome/free-brands-svg-icons";

function SiteFooter() {
  const currentUser = useSelector((state) => state.auth.currentUser);
  return (
    <footer className="mt-auto border-t border-(--line)">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 text-sm text-(--muted) sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1 text-center md:text-left">
          <p className="font-medium text-(--secondary-text)">
            © 2026 KnowYourFaculty
          </p>
          <p>
            {currentUser ? "Made for students by " : "Made for VIT-AP students"}
            {currentUser ? (
              <>
                <a
                  href="https://github.com/notvenu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-(--secondary-text) underline-offset-4 hover:underline"
                >
                  Venu K
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col gap-3 items-center md:items-end">
          <nav className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/privacy-policy"
              className="py-2 font-medium hover:text-(--text)"
            >
              Privacy
            </Link>
            <Link
              to="/terms-and-conditions"
              className="py-2 font-medium hover:text-(--text)"
            >
              Terms
            </Link>
            <Link to="/contact" className="py-2 font-medium hover:text-(--text)">
              Contact
            </Link>
          </nav>
          {currentUser && (
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/notvenu"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="text-base text-(--muted) transition-colors hover:text-(--text)!"
              >
                <FontAwesomeIcon icon={faGithub} />
              </a>
              <a
                href="https://linkedin.com/in/venu-kasibhatla"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="text-base text-(--muted) transition-colors hover:text-(--text)!"
              >
                <FontAwesomeIcon icon={faLinkedin} />
              </a>
              <a
                href="https://instagram.com/veeennnuuu"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-base text-(--muted) transition-colors hover:text-(--text)!"
              >
                <FontAwesomeIcon icon={faInstagram} />
              </a>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

export default memo(SiteFooter);
