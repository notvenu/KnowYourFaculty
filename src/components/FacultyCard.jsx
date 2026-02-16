import { Link } from "react-router-dom";
import publicFacultyService from "../services/publicFacultyService.js";

function formatDeptShort(dept) {
  if (!dept || typeof dept !== "string") return "—";
  return dept.replace(/^School of\s+/i, "").replace(/\s*\([^)]*\)\s*$/, "").trim() || dept;
}

export default function FacultyCard({ faculty, overallRating }) {
  const photoUrl = publicFacultyService.getFacultyPhotoUrl(faculty.photoFileId);
  const placeholderUrl = publicFacultyService.getPlaceholderPhoto();
  const overall = overallRating != null && Number.isFinite(overallRating) ? overallRating : null;
  const research = faculty.researchArea ? String(faculty.researchArea).trim() : null;

  return (
    <Link
      to={`/faculty/${faculty.employeeId}`}
      data-card
      className="group block overflow-hidden rounded-(--radius-lg) border-b border-(--line) sm:border sm:border-(--line) hover:border-(--primary)/40 min-w-0"
    >
      <div className="aspect-[4/3] overflow-hidden rounded-t-(--radius-lg) bg-(--panel)">
        <img
          src={photoUrl}
          alt={faculty.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = placeholderUrl;
          }}
        />
      </div>
      <div className="space-y-2 p-3 sm:space-y-3 sm:p-4 md:p-5">
        <h2 className="line-clamp-2 text-base font-bold text-(--text) sm:text-lg">{faculty.name}</h2>
        <p className="line-clamp-1 text-xs text-(--muted) sm:text-sm">{faculty.designation || "—"}</p>
        <p className="line-clamp-1 text-xs text-(--muted) sm:text-sm">{formatDeptShort(faculty.department)}</p>
        {research ? (
          <p className="line-clamp-2 text-xs text-(--muted)" title={research}>
            <span className="font-medium text-(--text)">Research:</span> {research}
          </p>
        ) : null}
        <div className="flex items-center gap-2 border-t border-(--line) pt-3 sm:pt-4">
          <span className="text-base font-bold text-(--primary) sm:text-lg">
            {overall != null ? overall.toFixed(1) : "—"}
          </span>
          <span className="text-xs text-(--muted) sm:text-sm">/ 5</span>
          {overall != null && (
            <span className="text-xs text-(--muted)">overall</span>
          )}
        </div>
      </div>
    </Link>
  );
}

