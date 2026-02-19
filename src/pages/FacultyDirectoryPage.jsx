// eslint-disable tailwindcss/no-custom-classname
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Query } from "appwrite";
import publicFacultyService from "../services/publicFacultyService.js";
import facultyFeedbackService from "../services/facultyFeedbackService.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faXmark,
  faSort,
  faSortAmountDown,
  faSortAmountUp,
} from "@fortawesome/free-solid-svg-icons";
import courseService from "../services/courseService.js";
import FacultyCard from "../components/FacultyCard.jsx";
import { getTierFromRating, TIER_SYSTEM } from "../lib/ratingConfig.js";

const FACULTY_PER_PAGE = 40;

const RATING_FIELDS = [
  "theoryTeaching",
  "theoryAttendance",
  "theoryClass",
  "theoryCorrection",
  "labClass",
  "labCorrection",
  "labAttendance",
  "ecsCapstoneSDPReview",
  "ecsCapstoneSDPCorrection",
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
  const [ratingCountLookup, setRatingCountLookup] = useState({});
  const [courseFacultyLookup, setCourseFacultyLookup] = useState({});
  const [courseQuery, setCourseQuery] = useState("");
  const [courseSuggestions, setCourseSuggestions] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    department: "all",
    alpha: "all",
    topRated: false,
    tier: "all",
    sortBy: "none", // none, rating-high, rating-low
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearch = useDeferredValue(filters.search);

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
            [
              Query.select(["facultyId", "courseId", ...RATING_FIELDS]),
              Query.limit(5000),
            ],
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
      const mappedRatingCounts = {};
      for (const [facultyId, item] of Object.entries(ratingAgg)) {
        mappedRatings[facultyId] = Number((item.total / item.count).toFixed(2));
        mappedRatingCounts[facultyId] = item.count;
      }

      setFaculty(allFaculty);
      setDepartments(departmentRows || []);
      setRatingLookup(mappedRatings);
      setRatingCountLookup(mappedRatingCounts);
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

    const deferredKeyword = String(deferredSearch || "")
      .trim()
      .toLowerCase();

    let rows = faculty.filter((item) => {
      const facultyId = String(item.employeeId || "").trim();
      const name = String(item.name || "").toLowerCase();
      const dept = String(item.department || "").toLowerCase();
      const designation = String(item.designation || "").toLowerCase();
      const research = String(item.researchArea || "").toLowerCase();
      const rating = ratingLookup[facultyId] || 0;
      const tier = getTierFromRating(rating);

      const matchesText =
        !deferredKeyword ||
        name.includes(deferredKeyword) ||
        dept.includes(deferredKeyword) ||
        designation.includes(deferredKeyword) ||
        research.includes(deferredKeyword);
      const matchesDepartment =
        filters.department === "all" || item.department === filters.department;
      const matchesTopRated = !filters.topRated || rating >= 4;
      const matchesTier = filters.tier === "all" || tier === filters.tier;
      const matchesCourse =
        !selectedCourse ||
        Boolean(
          courseFacultyLookup[selectedCourse.$id] &&
          courseFacultyLookup[selectedCourse.$id].has(facultyId),
        );

      return (
        matchesText &&
        matchesDepartment &&
        matchesTopRated &&
        matchesTier &&
        matchesCourse
      );
    });

    // Apply sorting
    if (filters.sortBy === "rating-high") {
      rows = [...rows].sort((a, b) => {
        const ratingA = ratingLookup[String(a.employeeId || "")] || 0;
        const ratingB = ratingLookup[String(b.employeeId || "")] || 0;
        return ratingB - ratingA;
      });
    } else if (filters.sortBy === "rating-low") {
      rows = [...rows].sort((a, b) => {
        const ratingA = ratingLookup[String(a.employeeId || "")] || 0;
        const ratingB = ratingLookup[String(b.employeeId || "")] || 0;
        return ratingA - ratingB;
      });
    } else if (filters.alpha === "az") {
      rows = [...rows].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || "")),
      );
    } else if (filters.alpha === "za") {
      rows = [...rows].sort((a, b) =>
        String(b.name || "").localeCompare(String(a.name || "")),
      );
    }

    return rows;
  }, [
    faculty,
    filters,
    deferredSearch,
    ratingLookup,
    selectedCourse,
    courseFacultyLookup,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    filters.search,
    filters.department,
    filters.alpha,
    filters.topRated,
    filters.tier,
    filters.sortBy,
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
    if (filters.tier !== "all") n += 1;
    if (filters.sortBy !== "none") n += 1;
    if (selectedCourse) n += 1;
    return n;
  }, [filters, selectedCourse]);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-(--line) bg-(--bg-elev) p-6 shadow-(--shadow-card) sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-(--text) sm:text-4xl">
          Find faculty
        </h1>
        <p className="mt-2 text-sm text-(--muted) sm:text-base">
          Filter by department, course, or top ratings. Search by name, role, or
          research area.
        </p>
      </section>

      <section className="rounded-xl border border-(--line) bg-(--bg-elev) p-3 sm:p-4 md:p-5 shadow-(--shadow-card)">
        {/* Search Bar and Filter Toggle */}
        <div className="flex flex-row items-center gap-2 sm:gap-3">
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              placeholder="Search name, department, role, research"
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="w-full rounded-(--radius) border border-(--line) bg-(--panel) px-3 sm:px-4 py-2 sm:py-3 pr-10 text-sm outline-none focus:border-(--primary)"
            />
            {String(filters.search || "").trim() ? (
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, search: "" }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-(--muted) hover:text-(--text)"
                aria-label="Clear search"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShowFilterPanel((prev) => !prev)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-(--radius) border border-(--line) bg-(--panel) px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-(--text) transition hover:border-(--primary) hover:bg-(--primary-soft)"
          >
            <span aria-hidden className="inline-flex items-center">
              <FontAwesomeIcon icon={faFilter} className="text-xs sm:text-sm" />
            </span>
            <span className="hidden lg:inline">Filters</span>
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-(--primary) px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>

        {showFilterPanel ? (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setShowFilterPanel(false)}
            />
            <div className="fixed left-1/2 top-1/2 z-50 w-11/12 max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-(--line) bg-(--bg-elev) p-4 shadow-2xl sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-(--text)">Filters</h3>
                <button
                  type="button"
                  onClick={() => setShowFilterPanel(false)}
                  className="text-xl text-(--muted) hover:text-(--text)"
                  aria-label="Close filters"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
                <select
                  value={filters.department}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      department: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-(--line) bg-(--panel) px-3 py-2.5 text-sm outline-none focus:border-(--primary)"
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.tier}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, tier: e.target.value }))
                  }
                  className="w-full rounded-xl border border-(--line) bg-(--panel) px-3 py-2.5 text-sm outline-none focus:border-(--primary)"
                >
                  <option value="all">All Tiers</option>
                  {Object.entries(TIER_SYSTEM).map(([tier, info]) => (
                    <option key={tier} value={tier}>
                      Tier {tier} - {info.description}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, sortBy: e.target.value }))
                  }
                  className="w-full rounded-xl border border-(--line) bg-(--panel) px-3 py-2.5 text-sm outline-none focus:border-(--primary)"
                >
                  <option value="none">No Sort</option>
                  <option value="rating-high">Rating: High to Low</option>
                  <option value="rating-low">Rating: Low to High</option>
                  <option value="az">Name: A to Z</option>
                  <option value="za">Name: Z to A</option>
                </select>

                <label className="flex items-center gap-2 rounded-xl border border-(--line) bg-(--panel) px-3 py-2.5 text-sm cursor-pointer hover:bg-(--bg-elev) transition-colors">
                  <input
                    type="checkbox"
                    checked={filters.topRated}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        topRated: e.target.checked,
                      }))
                    }
                    className="cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm">
                    Top Rated Only (A+)
                  </span>
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
                    className="w-full rounded-xl border border-(--line) bg-(--panel) px-3 py-2.5 pr-10 text-sm outline-none focus:border-(--primary)"
                  />
                  {String(courseQuery || "").trim() || selectedCourse ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCourse(null);
                        setCourseQuery("");
                        setCourseSuggestions([]);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-(--muted) hover:text-(--text)"
                      aria-label="Clear course search"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  ) : null}
                  {courseSuggestions.length > 0 ? (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-(--line) bg-(--bg) shadow-xl">
                      {courseSuggestions.map((course) => (
                        <button
                          key={course.$id}
                          type="button"
                          onClick={() => {
                            setSelectedCourse(course);
                            setCourseQuery("");
                            setCourseSuggestions([]);
                          }}
                          className="block w-full border-b border-(--line) px-3 py-2 text-left text-xs hover:bg-(--panel) last:border-b-0"
                        >
                          {course.courseCode} - {course.courseName}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFilterPanel(false)}
                className="mt-5 w-full rounded-lg bg-(--primary) px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                Apply Filters
              </button>
            </div>
          </>
        ) : null}

        {selectedCourse ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-(--muted)">
            <span className="rounded-full border border-(--line) bg-(--panel) px-3 py-1">
              Course: {selectedCourse.courseCode}
            </span>
            <button
              type="button"
              onClick={() => setSelectedCourse(null)}
              className="rounded-full border border-(--line) px-3 py-1 hover:border-(--primary)"
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
        <p className="text-sm text-(--muted)">Loading faculty...</p>
      ) : (
        <p className="text-sm text-(--muted)">
          {filteredFaculty.length} faculty found
          {totalPages > 1 ? ` · Page ${currentPage} of ${totalPages}` : ""}
        </p>
      )}

      <section className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {paginatedFaculty.map((item) => {
          const facultyId = String(item.employeeId || "");
          const overall = ratingLookup[facultyId];
          const ratingCount = ratingCountLookup[facultyId] || 0;
          return (
            <FacultyCard
              key={item.$id}
              faculty={item}
              overallRating={overall}
              ratingCount={ratingCount}
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
            className="rounded-(--radius) border border-(--line) bg-(--panel) px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 hover:border-(--primary)"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm font-medium text-(--muted)">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-(--radius) border border-(--line) bg-(--panel) px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 hover:border-(--primary)"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default FacultyDirectoryPage;
