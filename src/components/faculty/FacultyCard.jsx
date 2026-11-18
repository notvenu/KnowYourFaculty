import { Link } from "react-router-dom";
import { memo, useMemo, useState } from "react";
import publicFacultyService from "../../services/publicFacultyService.js";
import {
  TIER_SYSTEM,
  getTierColor,
  getTierFromRating,
} from "../../lib/ratingConfig.js";

const TIER_KEYS = ["D", "C", "B", "A", "S"];

// Cards show a ~300px photo: ask Cloudinary for a resized, modern-format copy instead of the original.
const CLOUDINARY_UPLOAD = "/image/upload/";
function sizeForCard(url) {
  if (!/res\.cloudinary\.com\//.test(url) || !url.includes(CLOUDINARY_UPLOAD)) return url;
  return url.replace(CLOUDINARY_UPLOAD, CLOUDINARY_UPLOAD + "f_auto,q_auto,w_640,c_limit/");
}

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

function FacultyCard({ faculty, overallRating, ratingCount = 0, priority = false }) {
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
  const imageSrc = sizeForCard(
    photoCandidates[photoIndex] || photoUrl || placeholderUrl,
  );

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
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-(--line) bg-(--bg-elev) hover:border-(--muted)"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-(--panel)">
        <img
          src={imageSrc}
          alt={facultyName}
          className="h-full w-full object-cover object-[50%_20%]"
          width="640"
          height="480"
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onError={(e) => {
            if (photoIndex < photoCandidates.length - 1) {
              setImageState({ key: photoFileId, index: photoIndex + 1 });
              return;
            }
            e.currentTarget.src = placeholderUrl;
          }}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h2 className="truncate text-base font-medium leading-tight text-(--text)">
          {facultyName}
        </h2>
        <p className="line-clamp-1 text-sm text-(--muted)">
          {faculty.designation || "—"}
        </p>
        <p className="truncate text-sm text-(--muted)">{departmentLine}</p>
        <div className="min-h-3 flex-1" />
        <div className="flex items-center justify-between border-t border-(--line) pt-3">
          <span className="flex flex-col gap-1.5">
            <span aria-hidden="true" className="flex gap-0.5">
              {TIER_KEYS.map((key) => (
                <span
                  key={key}
                  className="h-1 w-4 rounded-[1px]"
                  style={{
                    background: TIER_SYSTEM[key].color,
                    opacity: hasRating && key === tier ? 1 : 0.22,
                  }}
                />
              ))}
            </span>
            <span className="font-mono text-sm tabular-nums text-(--text)">
              {hasRating ? TIER_SYSTEM[tier].label : "Not rated yet"}
              {hasRating ? (
                <span className="text-(--muted)"> · {overall.toFixed(1)}</span>
              ) : null}
            </span>
          </span>
          <span className="font-mono text-xs tabular-nums text-(--muted)">
            {ratingCount} {ratingCount === 1 ? "rating" : "ratings"}
          </span>
        </div>
      </div>
      {hasRating ? (
        <span
          aria-hidden="true"
          className="card-needle"
          style={{ width: `${(overall / 5) * 100}%`, background: tierColor }}
        />
      ) : null}
    </Link>
  );
}

export default memo(FacultyCard);
