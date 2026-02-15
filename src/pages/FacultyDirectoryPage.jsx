// eslint-disable tailwindcss/no-custom-classname
import { useEffect, useMemo, useState } from "react";
import { Query } from "appwrite";
import { Link } from "react-router-dom";
import publicFacultyService from "../services/publicFacultyService.js";
import facultyFeedbackService from "../services/facultyFeedbackService.js";
import courseService from "../services/courseService.js";

const RATING_FIELDS = [
  "theoryTeaching",
  "theoryAttendance",
  "theoryClass",
  "theoryCorrection",
  "labClass",
  "labCorrection",
  "labAttendance",
  "ecsCapstoneSDP"
];

function getRowOverall(row) {
  let total = 0;
  let count = 0;
  for (const field of RATING_FIELDS) {
    const value = Number(row?.[field]);
    if (Number.isFinite(value) && value >= 1 && value <= 5) {
      total += value;
      count += 1;
    }
  }
  if (count === 0) return null;
  return total / count;
}

function FacultyDirectoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [faculty, setFaculty] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [ratingLookup, setRatingLookup] = useState({});
  const [courseFacultyLookup, setCourseFacultyLookup] = useState({});
  const [courseQuery, setCourseQuery] = useState("");
  const [courseSuggestions, setCourseSuggestions] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    department: "all",
    alpha: "all",
    topRated: false
  });

  useEffect(() => {
    loadDirectory();
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const query = String(courseQuery || "").trim();
      if (!query || selectedCourse) {
        setCourseSuggestions([]);
        return;
      }
      try {
        const courses = await courseService.searchCourses(query, 8);
        if (!active) return;
        setCourseSuggestions(courses);
      } catch {
        if (active) setCourseSuggestions([]);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [courseQuery, selectedCourse]);

  const loadDirectory = async () => {
    try {
      setLoading(true);
      setError(null);
      const [facultyResponse, departmentRows, feedbackRows] = await Promise.all([
        publicFacultyService.getFacultyList({ page: 1, limit: 5000, sortBy: "name", sortOrder: "asc" }),
        publicFacultyService.getDepartments(),
        facultyFeedbackService.listRows(facultyFeedbackService.feedbackTableId, [Query.limit(5000)])
      ]);

      const allFaculty = facultyResponse.faculty || [];
      const allFeedback = feedbackRows.rows || [];

      const ratingAgg = {};
      const courseLookup = {};
      for (const row of allFeedback) {
        const facultyId = String(row.facultyId || "").trim();
        if (!facultyId) continue;
        const overall = getRowOverall(row);
        if (overall !== null) {
          if (!ratingAgg[facultyId]) ratingAgg[facultyId] = { total: 0, count: 0 };
          ratingAgg[facultyId].total += overall;
          ratingAgg[facultyId].count += 1;
        }

        const courseId = String(row.courseId || "").trim();
        if (courseId) {
          if (!courseLookup[courseId]) courseLookup[courseId] = new Set();
          courseLookup[courseId].add(facultyId);
        }
      }

      const mappedRatings = {};
      for (const [facultyId, item] of Object.entries(ratingAgg)) {
        mappedRatings[facultyId] = Number((item.total / item.count).toFixed(2));
      }

      setFaculty(allFaculty);
      setDepartments(departmentRows || []);
      setRatingLookup(mappedRatings);
      setCourseFacultyLookup(courseLookup);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load faculty directory.");
    } finally {
      setLoading(false);
    }
  };

  const filteredFaculty = useMemo(() => {
    const keyword = String(filters.search || "").trim().toLowerCase();

    let rows = faculty.filter((item) => {
      const facultyId = String(item.employeeId || "").trim();
      const name = String(item.name || "").toLowerCase();
      const dept = String(item.department || "").toLowerCase();
      const designation = String(item.designation || "").toLowerCase();

      const matchesText = !keyword || name.includes(keyword) || dept.includes(keyword) || designation.includes(keyword);
      const matchesDepartment = filters.department === "all" || item.department === filters.department;
      const matchesTopRated = !filters.topRated || (ratingLookup[facultyId] || 0) >= 4;
      const matchesCourse =
        !selectedCourse ||
        Boolean(courseFacultyLookup[selectedCourse.$id] && courseFacultyLookup[selectedCourse.$id].has(facultyId));

      return matchesText && matchesDepartment && matchesTopRated && matchesCourse;
    });

    if (filters.alpha === "az") {
      rows = [...rows].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    } else if (filters.alpha === "za") {
      rows = [...rows].sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")));
    }

    return rows;
  }, [faculty, filters, ratingLookup, selectedCourse, courseFacultyLookup]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-6 sm:p-8">
        <h1 className="text-3xl font-black tracking-tight">Faculty Search</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Discover faculty by department, alphabetical order, course feedback history, and top-rated performance.
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <input
            type="text"
            placeholder="Search name, department, role"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />

          <select
            value={filters.department}
            onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <select
            value={filters.alpha}
            onChange={(e) => setFilters((prev) => ({ ...prev, alpha: e.target.value }))}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="all">No Alphabetic Sort</option>
            <option value="az">A to Z</option>
            <option value="za">Z to A</option>
          </select>

          <label className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={filters.topRated}
              onChange={(e) => setFilters((prev) => ({ ...prev, topRated: e.target.checked }))}
            />
            Top Rated Only (4.0+)
          </label>

          <div className="relative">
            <input
              type="text"
              placeholder="Filter by course"
              value={selectedCourse ? `${selectedCourse.courseCode} - ${selectedCourse.courseName}` : courseQuery}
              onChange={(e) => {
                setSelectedCourse(null);
                setCourseQuery(e.target.value);
              }}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
            {courseSuggestions.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-[var(--line)] bg-[var(--bg)] shadow-xl">
                {courseSuggestions.map((course) => (
                  <button
                    key={course.$id}
                    type="button"
                    onClick={() => {
                      setSelectedCourse(course);
                      setCourseQuery("");
                      setCourseSuggestions([]);
                    }}
                    className="block w-full border-b border-[var(--line)] px-3 py-2 text-left text-xs hover:bg-[var(--panel)] last:border-b-0"
                  >
                    {course.courseCode} - {course.courseName}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {selectedCourse ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
            <span className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1">
              Course: {selectedCourse.courseCode}
            </span>
            <button
              type="button"
              onClick={() => setSelectedCourse(null)}
              className="rounded-full border border-[var(--line)] px-3 py-1 hover:border-[var(--primary)]"
            >
              Clear Course
            </button>
          </div>
        ) : null}
      </section>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading faculty...</p>
      ) : (
        <p className="text-sm text-[var(--muted)]">{filteredFaculty.length} faculty found.</p>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredFaculty.map((item) => {
          const photoUrl = publicFacultyService.getFacultyPhotoUrl(item.photoFileId);
          const facultyId = String(item.employeeId || "");
          const overall = ratingLookup[facultyId];
          return (
            <Link
              key={item.$id}
              to={`/faculty/${item.employeeId}`}
              className="group block overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="h-44 bg-[var(--panel)]">
                <img
                  src={photoUrl}
                  alt={item.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = publicFacultyService.getPlaceholderPhoto();
                  }}
                />
              </div>
              <div className="space-y-3 p-4">
                <h2 className="line-clamp-2 text-lg font-semibold">{item.name}</h2>
                <p className="line-clamp-2 text-sm text-[var(--muted)]">{item.designation || "Not specified"}</p>
                <p className="line-clamp-2 text-sm text-[var(--muted)]">{item.department || "Not specified"}</p>
                <div className="border-t border-[var(--line)] pt-3 text-sm">
                  <span className="font-medium">
                    Overall: {Number.isFinite(overall) ? `${overall}/5` : "Not rated"}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

export default FacultyDirectoryPage;
