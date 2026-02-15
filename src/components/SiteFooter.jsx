import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_95%,black)]">
      <div className="flex flex-col gap-4 px-4 py-6 text-sm text-[var(--muted)] sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
          <span>Anonymous & safe</span>
          <span className="text-[var(--line)]">·</span>
          <span>Verified students</span>
          <span className="text-[var(--line)]">·</span>
          <span>© 2026 KnowYourFaculty</span>
        </p>
        <nav className="flex flex-wrap items-center gap-6">
          <Link to="/privacy-policy" className="font-medium hover:text-[var(--text)]">
            Privacy
          </Link>
          <Link to="/terms-and-conditions" className="font-medium hover:text-[var(--text)]">
            Terms
          </Link>
          <Link to="/contact" className="font-medium hover:text-[var(--text)]">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
