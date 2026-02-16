import publicFacultyService from "../services/publicFacultyService.js";

function DetailRow({value }) {
  if (value == null || String(value).trim() === "") return null;
  return (
    <p>
      <span className="font-semibold text-(--text)"></span>{" "}
      {String(value).trim()}
    </p>
  );
}

export default function FacultyProfileCard({ faculty }) {
  if (!faculty) return null;
  const photoUrl = publicFacultyService.getFacultyPhotoUrl(faculty.photoFileId);
  const placeholderUrl = publicFacultyService.getPlaceholderPhoto();
  const researchArea = faculty.researchArea
    ? String(faculty.researchArea).trim()
    : null;

  return (
    <div className="flex flex-col p-3 sm:p-4 md:p-5">
      <div className="aspect-[4/3] w-full max-w-sm mx-auto overflow-hidden rounded-lg bg-(--panel)">
        <img
          src={photoUrl}
          alt={faculty.name}
          className="w-full h-full object-cover"
          onError={(e) => {
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

