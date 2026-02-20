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
  RATING_FIELDS,
} from "../lib/ratingConfig.js";

// Calculate overall rating from feedback list
function calculateOverallRating(feedbackList) {
  if (!feedbackList || feedbackList.length === 0) return null;

  let totalSum = 0;
  let totalCount = 0;

  for (const row of feedbackList) {
    for (const field of RATING_FIELDS) {
      const value = Number(row?.[field.key || field]);
      if (Number.isFinite(value) && value >= 1 && value <= 5) {
        totalSum += value;
        totalCount += 1;
      }
    }
  }

  return totalCount > 0 ? Number((totalSum / totalCount).toFixed(2)) : null;
}

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
  const [feedbackByFaculty, setFeedbackByFaculty] = useState({});
  const [courseLookup, setCourseLookup] = useState({});
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedDesignation, setSelectedDesignation] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [minRatings, setMinRatings] = useState(1); // Minimum number of ratings to be ranked
  const [showFilters, setShowFilters] = useState(false);
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

      // Load all ratings at once and group by faculty
      const allRatings = await facultyFeedbackService.getAllRatings(10000);
      const feedbackMap = {};

      // Initialize empty arrays for all faculty
      for (const f of faculty) {
        feedbackMap[f.employeeId] = [];
      }

      // Group ratings by facultyId
      for (const rating of allRatings) {
        const facultyId = rating.facultyId;
        if (feedbackMap[facultyId]) {
          feedbackMap[facultyId].push(rating);
        }
      }

      setFeedbackByFaculty(feedbackMap);
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
    const courseIds = new Set();
    Object.values(feedbackByFaculty).forEach((feedbackList) => {
      feedbackList.forEach((feedback) => {
        if (feedback.courseId) courseIds.add(feedback.courseId);
      });
    });
    return Array.from(courseIds)
      .map((id) => ({ id, name: courseLookup[id]?.courseCode || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [feedbackByFaculty, courseLookup]);

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
        let feedback = feedbackByFaculty[f.employeeId] || [];

        // Filter by course if selected
        if (selectedCourse !== "all") {
          feedback = feedback.filter((fb) => fb.courseId === selectedCourse);
        }

        const overallRating = calculateOverallRating(feedback);
        return {
          ...f,
          overallRating,
          totalRatings: feedback.length,
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
    feedbackByFaculty,
    selectedDepartment,
    selectedDesignation,
    selectedCourse,
    minRatings,
  ]);

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
          <div className="flex items-center justify-between p-3 sm:p-4 pb-0 sm:pb-0">
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
        </p>
      </div>

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
          {rankedFaculty.map((faculty, index) => {
            const rank = index + 1;
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
    </div>
  );
}
