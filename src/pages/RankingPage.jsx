// eslint-disable tailwindcss/no-custom-classname
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import publicFacultyService from "../services/publicFacultyService.js";
import facultyFeedbackService from "../services/facultyFeedbackService.js";
import courseService from "../services/courseService.js";
import { addToast } from "../store/uiSlice.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrophy,
  faMedal,
  faAward,
  faFilter,
  faShareAlt,
  faChevronDown,
  faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import {
  getTierFromRating,
  getTierLabel,
  getTierColor,
} from "../lib/ratingConfig.js";
import { PAGINATION_LIMITS } from "../config/pagination.js";

const RANKINGS_PER_PAGE = PAGINATION_LIMITS.rankingsPerPage;

function RankIcon({ rank }) {
  if (rank === 1) {
    return (
      <FontAwesomeIcon
        icon={faTrophy}
        className="text-2xl text-yellow-500"
        title="1st Place"
      />
    );
  }
  if (rank === 2) {
    return (
      <FontAwesomeIcon
        icon={faMedal}
        className="text-2xl text-gray-400"
        title="2nd Place"
      />
    );
  }
  if (rank === 3) {
    return (
      <FontAwesomeIcon
        icon={faAward}
        className="text-2xl text-orange-600"
        title="3rd Place"
      />
    );
  }
  return <span className="text-2xl font-bold text-(--muted)">#{rank}</span>;
}

export default function RankingPage({ currentUser }) {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [facultyList, setFacultyList] = useState([]);
  const [ratingsSummary, setRatingsSummary] = useState({
    ratings: {},
    counts: {},
    byFacultyType: {},
    byFacultyCourse: {},
    byFacultyCourseType: {},
    courseLookup: {},
  });
  const [courseLookup, setCourseLookup] = useState({});
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedDesignation, setSelectedDesignation] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [minRatings, setMinRatings] = useState(1); // Minimum number of ratings to be ranked
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const filterDropdownRef = useRef(null);

  const hasUser = Boolean(currentUser?.$id);

  // Close dropdown when clicking outside on large screens
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target) &&
        window.innerWidth >= 1024
      ) {
        setShowFilters(false);
      }
    };

    if (showFilters) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFilters]);

  const handleShareRankingPage = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const sharePayload = {
      title: "KnowYourFaculty Rankings",
      text: "Check faculty rankings based on student feedback.",
      url: shareUrl,
    };

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(sharePayload);
      } else if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        throw new Error("Sharing is not supported in this browser");
      }
      dispatch(
        addToast({ message: "Ranking page link shared", type: "success" }),
      );
    } catch (error) {
      if (error?.name === "AbortError") return;
      dispatch(
        addToast({
          message: error?.message || "Unable to share this page",
          type: "error",
        }),
      );
    }
  };

  useEffect(() => {
    if (hasUser) {
      loadData();
    }
  }, [hasUser]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all faculty and courses
      const [facultyResponse, courses] = await Promise.all([
        publicFacultyService.getFacultyList({ limit: 5000, page: 1 }),
        courseService.getAllCourses(5000),
      ]);

      const faculty = facultyResponse.faculty || [];
      setFacultyList(faculty);

      // Build course lookup
      const lookup = {};
      for (const course of courses) {
        if (course?.$id) {
          lookup[course.$id] = course;
        }
      }
      setCourseLookup(lookup);

      const summary = await facultyFeedbackService.getRatingsSummary(10000);
      setRatingsSummary(
        summary || {
          ratings: {},
          counts: {},
          byFacultyType: {},
          byFacultyCourse: {},
          byFacultyCourseType: {},
          courseLookup: {},
        },
      );
    } catch (err) {
      setError(err?.message || "Failed to load ranking data.");
    } finally {
      setLoading(false);
    }
  };

  // Get available departments, designations, and courses
  const departments = useMemo(() => {
    const depts = new Set();
    facultyList.forEach((f) => {
      if (f.department) depts.add(f.department);
    });
    return Array.from(depts).sort();
  }, [facultyList]);

  const designations = useMemo(() => {
    const desigs = new Set();
    facultyList.forEach((f) => {
      if (f.designation) desigs.add(f.designation);
    });
    return Array.from(desigs).sort();
  }, [facultyList]);

  const courses = useMemo(() => {
    const courseIds = Object.keys(ratingsSummary?.courseLookup || {});
    return courseIds
      .map((id) => ({ id, name: courseLookup[id]?.courseCode || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ratingsSummary, courseLookup]);

  // Calculate rankings with filters
  const rankedFaculty = useMemo(() => {
    let filtered = facultyList;

    // Filter by department
    if (selectedDepartment !== "all") {
      filtered = filtered.filter((f) => f.department === selectedDepartment);
    }

    // Filter by designation
    if (selectedDesignation !== "all") {
      filtered = filtered.filter((f) => f.designation === selectedDesignation);
    }

    // Calculate ratings and filter by minimum ratings count
    const withRatings = filtered
      .map((f) => {
        let overallRating = null;
        let totalRatings = 0;
        if (selectedCourse === "all" && selectedType === "all") {
          overallRating = ratingsSummary?.ratings?.[f.employeeId] ?? null;
          totalRatings = Number(ratingsSummary?.counts?.[f.employeeId] || 0);
        } else if (selectedCourse === "all" && selectedType !== "all") {
          const typeStats =
            ratingsSummary?.byFacultyType?.[f.employeeId]?.[selectedType] ||
            null;
          overallRating = typeStats?.average ?? null;
          totalRatings = Number(typeStats?.rowCount || 0);
        } else if (selectedCourse !== "all" && selectedType === "all") {
          const courseStats =
            ratingsSummary?.byFacultyCourse?.[f.employeeId]?.[selectedCourse] ||
            null;
          overallRating = courseStats?.average ?? null;
          totalRatings = Number(courseStats?.rowCount || 0);
        } else {
          const courseTypeStats =
            ratingsSummary?.byFacultyCourseType?.[f.employeeId]?.[
              selectedCourse
            ]?.[selectedType] || null;
          overallRating = courseTypeStats?.average ?? null;
          totalRatings = Number(courseTypeStats?.rowCount || 0);
        }

        return {
          ...f,
          overallRating,
          totalRatings,
        };
      })
      .filter((f) => f.totalRatings >= minRatings && f.overallRating !== null);

    // Sort by rating (descending), then by total ratings (descending)
    withRatings.sort((a, b) => {
      if (b.overallRating !== a.overallRating) {
        return b.overallRating - a.overallRating;
      }
      return b.totalRatings - a.totalRatings;
    });

    return withRatings;
  }, [
    facultyList,
    ratingsSummary,
    selectedDepartment,
    selectedDesignation,
    selectedCourse,
    selectedType,
    minRatings,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedDepartment,
    selectedDesignation,
    selectedCourse,
    selectedType,
    minRatings,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(rankedFaculty.length / RANKINGS_PER_PAGE),
  );
  const paginatedRankedFaculty = useMemo(() => {
    const start = (currentPage - 1) * RANKINGS_PER_PAGE;
    return rankedFaculty.slice(start, start + RANKINGS_PER_PAGE);
  }, [rankedFaculty, currentPage]);

  // Redirect if not logged in
  if (!hasUser) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-(--primary) border-r-transparent"></div>
            <p className="text-lg text-(--muted)">Loading rankings...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="rounded-xl border border-(--line) bg-(--bg-elev) p-6 text-center">
          <p className="text-lg text-red-500">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 rounded-lg bg-(--primary) px-6 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="mb-1 sm:mb-2 text-2xl sm:text-3xl lg:text-4xl font-bold text-(--text) flex items-center gap-2 sm:gap-3">
            <FontAwesomeIcon
              icon={faTrophy}
              className="text-xl sm:text-2xl text-(--primary)"
            />
            <span>Faculty Rankings</span>
          </h1>
          <button
            type="button"
            onClick={handleShareRankingPage}
            className="inline-flex items-center gap-2 rounded-lg border border-(--line) bg-(--panel) px-3 py-2 text-xs sm:text-sm font-semibold text-(--text) hover:bg-(--bg-elev)"
          >
            <FontAwesomeIcon icon={faShareAlt} />
            Share Page
          </button>
        </div>
        <p className="text-sm sm:text-base text-(--muted)">
          Rankings based on overall ratings from student feedback
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 relative" ref={filterDropdownRef}>
        {/* Desktop Dropdown Button */}
        <div className="hidden lg:flex justify-end mb-3">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-lg border border-(--line) bg-(--bg-elev) px-4 py-2.5 text-sm font-semibold text-(--text) hover:bg-(--panel) shadow-sm transition-colors"
          >
            <FontAwesomeIcon icon={faFilter} />
            Filters
            {(selectedDepartment !== "all" ||
              selectedDesignation !== "all" ||
              selectedCourse !== "all" ||
              selectedType !== "all" ||
              minRatings !== 3) && (
              <span className="ml-1 rounded-full bg-(--primary) px-2 py-0.5 text-xs text-white">
                Active
              </span>
            )}
            <FontAwesomeIcon
              icon={showFilters ? faChevronUp : faChevronDown}
              className="text-xs ml-1"
            />
          </button>
        </div>

        {/* Mobile/Tablet Filter Header */}
        <div className="lg:hidden mb-3 sm:mb-4 rounded-lg sm:rounded-xl border border-(--line) bg-(--bg-elev) shadow-lg">
          <div className="flex items-center justify-between px-3 py-3 sm:px-4 sm:py-3.5">
            <h3 className="text-base sm:text-lg font-bold text-(--text)">
              <FontAwesomeIcon
                icon={faFilter}
                className="mr-1.5 sm:mr-2 text-sm sm:text-base"
              />
              Filters
            </h3>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="text-xs sm:text-sm font-semibold text-(--primary) hover:underline"
            >
              {showFilters ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Filter Content */}
        <div
          className={`${
            showFilters ? "block" : "hidden"
          } rounded-lg sm:rounded-xl border border-(--line) bg-(--bg-elev) shadow-lg lg:absolute lg:right-0 lg:z-10 lg:w-125 xl:w-150`}
        >
          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 lg:p-5">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 sm:mb-2 block text-xs font-semibold text-(--muted)">
                  Department
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-(--text) outline-none focus:ring-2 focus:ring-(--primary)"
                >
                  <option value="all" className="bg-(--bg-elev) text-(--text)">
                    All Departments
                  </option>
                  {departments.map((dept) => (
                    <option
                      key={dept}
                      value={dept}
                      className="bg-(--bg-elev) text-(--text)"
                    >
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 sm:mb-2 block text-xs font-semibold text-(--muted)">
                  Designation
                </label>
                <select
                  value={selectedDesignation}
                  onChange={(e) => setSelectedDesignation(e.target.value)}
                  className="w-full rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-(--text) outline-none focus:ring-2 focus:ring-(--primary)"
                >
                  <option value="all" className="bg-(--bg-elev) text-(--text)">
                    All Designations
                  </option>
                  {designations.map((desig) => (
                    <option
                      key={desig}
                      value={desig}
                      className="bg-(--bg-elev) text-(--text)"
                    >
                      {desig}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 sm:mb-2 block text-xs font-semibold text-(--muted)">
                  Course
                </label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-(--text) outline-none focus:ring-2 focus:ring-(--primary)"
                >
                  <option value="all" className="bg-(--bg-elev) text-(--text)">
                    All Courses
                  </option>
                  {courses.map((course) => (
                    <option
                      key={course.id}
                      value={course.id}
                      className="bg-(--bg-elev) text-(--text)"
                    >
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 sm:mb-2 block text-xs font-semibold text-(--muted)">
                  Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-(--text) outline-none focus:ring-2 focus:ring-(--primary)"
                >
                  <option value="all" className="bg-(--bg-elev) text-(--text)">
                    All Types
                  </option>
                  <option value="theory" className="bg-(--bg-elev) text-(--text)">
                    Theory
                  </option>
                  <option value="lab" className="bg-(--bg-elev) text-(--text)">
                    Lab
                  </option>
                  <option value="ecs" className="bg-(--bg-elev) text-(--text)">
                    ECS / Capstone / SDP
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 sm:mb-2 block text-xs font-semibold text-(--muted)">
                  Min. Ratings Required
                </label>
                <select
                  value={minRatings}
                  onChange={(e) => setMinRatings(Number(e.target.value))}
                  className="w-full rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-(--text) outline-none focus:ring-2 focus:ring-(--primary)"
                >
                  <option value="1" className="bg-(--bg-elev) text-(--text)">
                    1+
                  </option>
                  <option value="3" className="bg-(--bg-elev) text-(--text)">
                    3+
                  </option>
                  <option value="5" className="bg-(--bg-elev) text-(--text)">
                    5+
                  </option>
                  <option value="10" className="bg-(--bg-elev) text-(--text)">
                    10+
                  </option>
                  <option value="20" className="bg-(--bg-elev) text-(--text)">
                    20+
                  </option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDepartment("all");
                  setSelectedDesignation("all");
                  setSelectedCourse("all");
                  setSelectedType("all");
                  setMinRatings(3);
                }}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs sm:text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4 sm:mb-6 text-center">
        <p className="text-xs sm:text-sm text-(--muted)">
          Showing{" "}
          <span className="font-semibold text-(--text)">
            {rankedFaculty.length}
          </span>{" "}
          ranked faculty members
          {rankedFaculty.length > 0 ? ` · Page ${currentPage} of ${totalPages}` : ""}
        </p>
      </div>
      {rankedFaculty.length > 0 && totalPages > 1 ? (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded-lg border border-(--line) bg-(--panel) px-4 py-2 text-xs sm:text-sm font-medium text-(--text) disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs sm:text-sm text-(--muted)">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-lg border border-(--line) bg-(--panel) px-4 py-2 text-xs sm:text-sm font-medium text-(--text) disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}

      {/* Rankings Display */}
      {rankedFaculty.length === 0 ? (
        <div className="rounded-xl border border-(--line) bg-(--bg-elev) p-8 text-center">
          <p className="text-lg text-(--muted)">
            No faculty members match the current filters.
          </p>
          <p className="mt-2 text-sm text-(--muted)">
            Try adjusting your filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginatedRankedFaculty.map((faculty, index) => {
            const rank = (currentPage - 1) * RANKINGS_PER_PAGE + index + 1;
            const tier = getTierFromRating(faculty.overallRating);
            const tierLabel = getTierLabel(tier);
            const tierColor = getTierColor(tier);

            return (
              <Link
                key={faculty.employeeId}
                to={`/faculty/${faculty.employeeId}`}
                className="block cursor-pointer rounded-lg border border-(--line) bg-(--bg-elev) p-3 shadow-sm transition-all hover:border-(--primary) hover:shadow-md sm:p-4"
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="flex w-12 shrink-0 items-center justify-center">
                    {rank <= 3 ? (
                      <RankIcon rank={rank} />
                    ) : (
                      <span className="text-lg font-bold text-(--muted)">
                        #{rank}
                      </span>
                    )}
                  </div>

                  {/* Faculty Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="mb-0.5 text-base font-bold text-(--text) truncate sm:text-lg">
                      {faculty.name}
                    </h3>
                    <p className="text-xs text-(--muted) truncate">
                      {faculty.designation || "Faculty"}
                      {faculty.department && <> • {faculty.department}</>}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-(--muted)">
                        {faculty.totalRatings} rating
                        {faculty.totalRatings !== 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* Rating Badge */}
                    <div className="flex flex-col items-center">
                      <div
                        className="flex min-h-10 w-20 items-center justify-center rounded-lg px-2 text-[10px] font-bold text-white shadow-sm sm:min-h-12 sm:w-24 sm:text-xs"
                        style={{ backgroundColor: tierColor }}
                      >
                        {tierLabel}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold text-(--text)">
                        {faculty.overallRating.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {rankedFaculty.length > 0 && totalPages > 1 ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded-lg border border-(--line) bg-(--panel) px-4 py-2 text-xs sm:text-sm font-medium text-(--text) disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs sm:text-sm text-(--muted)">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-lg border border-(--line) bg-(--panel) px-4 py-2 text-xs sm:text-sm font-medium text-(--text) disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
