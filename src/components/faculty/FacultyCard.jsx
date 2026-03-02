import { Link } from "react-router-dom";
import { memo, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import publicFacultyService from "../../services/publicFacultyService.js";
import { getTierColor, getTierFromRating } from "../../lib/ratingConfig.js";

function formatDeptShort(dept) {
  if (!dept || typeof dept !== "string") return "—";
  return (
    dept
      .replace(/^School of\s+/i, "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim() || dept
  );
}

function formatDepartmentLine(department, subDepartment) {
  const dept = formatDeptShort(department);
  const sub = String(subDepartment || "").trim();
  if (!sub || dept === "—") return dept;
  return `${dept} - ${sub}`;
}

function FacultyCard({ faculty, overallRating, ratingCount = 0 }) {
  const facultyName = String(faculty?.name || "").trim();
  const facultyEmployeeId = String(faculty?.employeeId || "").trim();
  const photoFileId = faculty?.photoFileId;
  const photoUrl = publicFacultyService.getFacultyPhotoUrl(photoFileId);
  const photoCandidates = useMemo(
    () => publicFacultyService.getFacultyPhotoCandidates(photoFileId),
    [photoFileId],
  );
  const placeholderUrl =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23d1d5db'/%3E%3Cg transform='translate(400 300)'%3E%3Ccircle r='95' fill='%23b7bcc4'/%3E%3C/g%3E%3C/svg%3E";
  const [imageState, setImageState] = useState({ key: "", index: 0 });
  const photoIndex = imageState.key === photoFileId ? imageState.index : 0;
  const imageSrc = photoCandidates[photoIndex] || photoUrl || placeholderUrl;

  if (!facultyName || !facultyEmployeeId) return null;
  const overall =
    overallRating != null && Number.isFinite(overallRating)
      ? overallRating
      : null;
  const hasRating = overall != null;
  const tier = overall != null ? getTierFromRating(overall) : "B";
  const tierColor = getTierColor(tier);
  const departmentLine = formatDepartmentLine(
    faculty.department,
    faculty.subDepartment || faculty.subdepartment,
  );

  return (
    <Link
      to={`/faculty/${facultyEmployeeId}`}
      data-card
      style={hasRating ? { "--tier-color": tierColor } : undefined}
      className={`group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border-b border-(--line) sm:border sm:border-(--line) ${
        hasRating
          ? "bg-(--bg-elev) border-[color-mix(in_srgb,var(--tier-color)_52%,var(--line))] shadow-[0_0_0_1px_color-mix(in_srgb,var(--tier-color)_28%,transparent)] hover:bg-linear-to-br hover:from-[color-mix(in_srgb,var(--tier-color)_42%,var(--bg-elev))] hover:via-[color-mix(in_srgb,var(--tier-color)_24%,var(--bg-elev))] hover:to-(--bg-elev) hover:border-2 hover:border-[color-mix(in_srgb,var(--tier-color)_85%,var(--line))]"
          : "bg-(--bg-elev) hover:border-(--primary)/40"
      }`}
    >
      <div className="aspect-4/3 overflow-hidden rounded-t-lg bg-(--panel) relative">
        <img
          src={imageSrc}
          alt={facultyName}
          className="h-full w-full object-cover object-[50%_20%] transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            if (photoIndex < photoCandidates.length - 1) {
              setImageState({ key: photoFileId, index: photoIndex + 1 });
              return;
            }
            e.currentTarget.src = placeholderUrl;
          }}
        />
      </div>
      <div className="flex flex-1 flex-col space-y-2 p-3 sm:space-y-2.5 sm:p-4 md:p-5">
        <h2 className="truncate text-base font-bold leading-tight text-(--text) sm:text-lg">
          {facultyName}
        </h2>
        <div className="space-y-0">
          <p className="line-clamp-1 text-xs text-(--muted) sm:text-sm">
            {faculty.designation || "—"}
          </p>
          <p className="truncate text-xs text-(--muted) sm:text-sm">
            {departmentLine}
          </p>
        </div>
        <div className="flex-1" />
        <div className="mt-auto flex items-center justify-between border-t border-(--line) pt-3 sm:pt-4">
          <div className="flex items-center gap-2">
            <span
              className={`text-base font-bold sm:text-lg ${
                hasRating ? "text-(--tier-color)" : "text-(--primary)"
              }`}
            >
              {overall != null ? overall.toFixed(1) : "—"}
            </span>
            <span className="text-xs text-(--muted) sm:text-sm">/ 5</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-(--muted)">
            <FontAwesomeIcon icon={faUser} className="h-3 w-3" />
            <span>{ratingCount}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default memo(FacultyCard);
