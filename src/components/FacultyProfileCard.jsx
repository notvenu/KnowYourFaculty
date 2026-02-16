import publicFacultyService from "../services/publicFacultyService.js";

function DetailRow({ label, value }) {
  if (value == null || String(value).trim() === "") return null;
  return (
    <p>
      <span className="font-semibold text-[var(--text)]">{label}</span> {String(value).trim()}
    </p>
  );
}

export default function FacultyProfileCard({ faculty }) {
  if (!faculty) return null;
  const photoUrl = publicFacultyService.getFacultyPhotoUrl(faculty.photoFileId);
  const placeholderUrl = publicFacultyService.getPlaceholderPhoto();
  const researchArea = faculty.researchArea ? String(faculty.researchArea).trim() : null;

  return (
    <div className="flex flex-col p-3 sm:p-4 md:p-5">
      <div className="aspect-[4/3] w-full max-w-sm mx-auto overflow-hidden rounded-lg bg-[var(--panel)]">
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
        <h1 className="text-lg font-extrabold leading-tight tracking-tight text-[var(--text)] sm:text-xl">
          {faculty.name}
        </h1>
        <p className="text-xs font-semibold text-[var(--primary)] sm:text-sm">
          {faculty.designation || "—"}
        </p>
        {faculty.subDepartment ? (
          <p className="text-xs text-[var(--muted)]">
            <span className="font-semibold text-[var(--text)]">Area</span> {faculty.subDepartment}
          </p>
        ) : null}
        <div className="space-y-0.5 pt-2 border-t border-[var(--line)] text-xs text-[var(--muted)]">
          <DetailRow label="Department" value={faculty.department} />
          <DetailRow label="ID" value={faculty.employeeId} />
        </div>
        {researchArea ? (
          <div className="pt-2 border-t border-[var(--line)] text-xs text-[var(--muted)]">
            <span className="font-bold text-[var(--text)] uppercase tracking-wider">Research</span>
            <p className="mt-0.5 leading-relaxed line-clamp-2">{researchArea}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
