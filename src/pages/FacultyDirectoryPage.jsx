// eslint-disable tailwindcss/no-custom-classname
import { useEffect, useMemo, useState } from "react";
import { Query } from "appwrite";
import publicFacultyService from "../services/publicFacultyService.js";
import facultyFeedbackService from "../services/facultyFeedbackService.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import courseService from "../services/courseService.js";
import FacultyCard from "../components/FacultyCard.jsx";

const FACULTY_PER_PAGE = 40;

const RATING_FIELDS = [
  "theoryTeaching",
  "theoryAttendance",
  "theoryClass",
  "theoryCorrection",
  "labClass",
  "labCorrection",
  "labAttendance",
  "ecsCapstoneSDP",
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
    topRated: false,
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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
      const [facultyResponse, departmentRows, feedbackRows] = await Promise.all(
        [
          publicFacultyService.getFacultyList({
            page: 1,
            limit: 5000,
            sortBy: "name",
            sortOrder: "asc",
          }),
          publicFacultyService.getDepartments(),
          facultyFeedbackService.listRows(
            facultyFeedbackService.feedbackTableId,
            [Query.limit(5000)],
          ),
        ],
      );

      const allFaculty = facultyResponse.faculty || [];
      const allFeedback = feedbackRows.rows || [];

      const ratingAgg = {};
      const courseLookup = {};
      for (const row of allFeedback) {
        const facultyId = String(row.facultyId || "").trim();
        if (!facultyId) continue;
        const overall = getRowOverall(row);
        if (overall !== null) {
          if (!ratingAgg[facultyId])
            ratingAgg[facultyId] = { total: 0, count: 0 };
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
    const keyword = String(filters.search || "")
      .trim()
      .toLowerCase();

    let rows = faculty.filter((item) => {
      const facultyId = String(item.employeeId || "").trim();
      const name = String(item.name || "").toLowerCase();
      const dept = String(item.department || "").toLowerCase();
      const designation = String(item.designation || "").toLowerCase();
      const research = String(item.researchArea || "").toLowerCase();

      const matchesText =
        !keyword ||
        name.includes(keyword) ||
        dept.includes(keyword) ||
        designation.includes(keyword) ||
        research.includes(keyword);
      const matchesDepartment =
        filters.department === "all" || item.department === filters.department;
      const matchesTopRated =
        !filters.topRated || (ratingLookup[facultyId] || 0) >= 4;
      const matchesCourse =
        !selectedCourse ||
        Boolean(
          courseFacultyLookup[selectedCourse.$id] &&
          courseFacultyLookup[selectedCourse.$id].has(facultyId),
        );

      return (
        matchesText && matchesDepartment && matchesTopRated && matchesCourse
      );
    });

    if (filters.alpha === "az") {
      rows = [...rows].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || "")),
      );
    } else if (filters.alpha === "za") {
      rows = [...rows].sort((a, b) =>
        String(b.name || "").localeCompare(String(a.name || "")),
      );
    }

    return rows;
  }, [faculty, filters, ratingLookup, selectedCourse, courseFacultyLookup]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    filters.search,
    filters.department,
    filters.alpha,
    filters.topRated,
    selectedCourse,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredFaculty.length / FACULTY_PER_PAGE),
  );
  const paginatedFaculty = useMemo(() => {
    const start = (currentPage - 1) * FACULTY_PER_PAGE;
    return filteredFaculty.slice(start, start + FACULTY_PER_PAGE);
  }, [filteredFaculty, currentPage]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.department !== "all") n += 1;
    if (filters.alpha !== "all") n += 1;
    if (filters.topRated) n += 1;
    if (selectedCourse) n += 1;
    if (String(filters.search || "").trim()) n += 1;
    return n;
  }, [filters, selectedCourse]);

  return (
    <div className="space-y-8">
      <section className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--bg-elev)] p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
          Find faculty
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
          Filter by department, course, or top ratings. Search by name, role, or
          research area.
        </p>
      </section>

      <section className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--bg-elev)] p-4 shadow-[var(--shadow-card)] sm:p-6">
        {/* Search Bar and Filter Toggle */}
        <div className="mb-4 flex flex-wrap items-stretch gap-3">
          <input
            type="text"
            placeholder="Search name, department, role, research"
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
            className="min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm outline-none focus:border-[var(--primary)]"
          />
          <button
            type="button"
            onClick={() => setShowFilterPanel((prev) => !prev)}
            className="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
          >
            <span aria-hidden>
              <FontAwesomeIcon icon={faChevronDown} />
            </span>
            Filters
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>

        {showFilterPanel ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <select
              value={filters.department}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, department: e.target.value }))
              }
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
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, alpha: e.target.value }))
              }
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
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    topRated: e.target.checked,
                  }))
                }
              />
              Top Rated Only (4.0+)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by course"
                value={
                  selectedCourse
                    ? `${selectedCourse.courseCode} - ${selectedCourse.courseName}`
                    : courseQuery
                }
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
        ) : null}

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

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      ) : null}
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading faculty...</p>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          {filteredFaculty.length} faculty found
          {totalPages > 1 ? ` · Page ${currentPage} of ${totalPages}` : ""}
        </p>
      )}

      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {paginatedFaculty.map((item) => {
          const facultyId = String(item.employeeId || "");
          const overall = ratingLookup[facultyId];
          return (
            <FacultyCard
              key={item.$id}
              faculty={item}
              overallRating={overall}
            />
          );
        })}
      </section>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-8">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 hover:border-[var(--primary)]"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm font-medium text-[var(--muted)]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 hover:border-[var(--primary)]"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default FacultyDirectoryPage;
