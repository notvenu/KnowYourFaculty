import publicFacultyService from "../../services/publicFacultyService.js";
import { useMemo, useState } from "react";

function DetailRow({ label, value }) {
  if (value == null || String(value).trim() === "") return null;
  return (
    <p>
      <span className="font-semibold text-(--text)">{label}:</span>{" "}
      {String(value).trim()}
    </p>
  );
}

export default function FacultyProfileCard({ faculty }) {
  const photoFileId = faculty?.photoFileId;
  const photoUrl = publicFacultyService.getFacultyPhotoUrl(photoFileId);
  const photoCandidates = useMemo(
    () => publicFacultyService.getFacultyPhotoCandidates(photoFileId),
    [photoFileId],
  );
  const placeholderUrl = publicFacultyService.getPlaceholderPhoto();
  const [imageState, setImageState] = useState({ key: "", index: 0 });
  const photoIndex = imageState.key === photoFileId ? imageState.index : 0;
  const imageSrc = photoCandidates[photoIndex] || photoUrl || placeholderUrl;
  if (!faculty) return null;
  const researchArea = faculty.researchArea
    ? String(faculty.researchArea).trim()
    : null;

  return (
    <div className="flex flex-col rounded-xl border border-(--line) bg-(--bg-elev) p-3 shadow-lg sm:p-4 md:p-5 pb-6">
      <div className="aspect-4/3 w-full max-w-sm mx-auto overflow-hidden rounded-lg bg-(--bg-elev)">
        <img
          src={imageSrc}
          alt={faculty.name}
          className="w-full h-full object-cover object-[50%_10%]"
          onError={(e) => {
            if (photoIndex < photoCandidates.length - 1) {
              setImageState({ key: photoFileId, index: photoIndex + 1 });
              return;
            }
            e.currentTarget.src = placeholderUrl;
          }}
        />
      </div>
      <div className="mt-4 min-w-0 space-y-1">
        <h1 className="text-lg font-extrabold leading-tight tracking-tight text-(--text) sm:text-xl">
          {faculty.name}
        </h1>
        <p className="text-xs font-semibold text-(--primary) sm:text-sm">
          {faculty.designation || "—"}
        </p>
        <div className="space-y-0.5 text-xs text-(--muted)">
          <DetailRow label="Department" value={faculty.department} />
        </div>
        {faculty.subDepartment ? (
          <p className="text-xs text-(--muted)">
            <span className="font-semibold text-(--muted)">Area - </span>{" "}
            {faculty.subDepartment}
          </p>
        ) : null}
        {researchArea ? (
          <div className="text-xs text-(--muted)">
            <div className="mt-2 flex flex-wrap gap-1.5">
              {researchArea
                .split(/[,;]|\band\b/i)
                .map((area) => area.trim())
                .filter((area) => area.length > 0)
                .map((area, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-full bg-(--primary-soft) px-2.5 py-1 text-xs font-medium text-(--primary)"
                  >
                    {area}
                  </span>
                ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
