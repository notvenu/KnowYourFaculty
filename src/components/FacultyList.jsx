// eslint-disable tailwindcss/no-custom-classname
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateRight,
  faBuildingColumns,
  faChartBar,
  faChevronLeft,
  faChevronRight,
  faExclamationTriangle,
  faFlask,
  faGraduationCap,
  faHourglassHalf,
  faMagnifyingGlass,
  faSort,
  faUser,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import publicFacultyService from "../services/publicFacultyService.js";

function FacultyList({ currentUser = null }) {
  const [facultyData, setFacultyData] = useState({
    faculty: [],
    loading: true,
    error: null,
    total: 0,
    page: 1,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  const [filters, setFilters] = useState({
    search: "",
    department: "all",
    sortBy: "$updatedAt",
    sortOrder: "desc",
  });

  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadFaculty();
    loadDepartments();
    loadStats();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadFaculty(1);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters.search, filters.department, filters.sortBy, filters.sortOrder]);

  const loadFaculty = async (page = facultyData.page) => {
    try {
      setFacultyData((prev) => ({ ...prev, loading: true, error: null }));

      const response = await publicFacultyService.getFacultyList({
        page,
        limit: 20,
        search: filters.search,
        department: filters.department,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });

      setFacultyData((prev) => ({
        ...prev,
        ...response,
        loading: false,
      }));
    } catch (error) {
      setFacultyData((prev) => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
    }
  };

  const loadDepartments = async () => {
    try {
      const depts = await publicFacultyService.getDepartments();
      setDepartments(depts);
    } catch (error) {
      console.error("Failed to load departments:", error);
    }
  };

  const loadStats = async () => {
    try {
      const facultyStats = await publicFacultyService.getFacultyStats();
      setStats(facultyStats);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handlePageChange = (newPage) => {
    loadFaculty(newPage);
  };

  if (facultyData.loading && facultyData.faculty.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-[var(--muted)] flex items-center justify-center gap-2">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="text-[var(--primary)]"
            />
            <span>Finding amazing professors for you...</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 animate-fadeIn">
        <h1 className="mb-4 flex items-center gap-2 text-3xl font-bold text-[var(--text)]">
          <FontAwesomeIcon
            icon={faGraduationCap}
            className="text-[var(--primary)]"
          />
          <span>Find Your Professor</span>
        </h1>
        {stats && (
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,var(--panel))] px-4 py-2 font-semibold text-[var(--primary)]">
              <FontAwesomeIcon icon={faUsers} />
              <span>{stats.total} Professors</span>
            </span>
            <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,var(--panel))] px-4 py-2 font-semibold text-[var(--primary)]">
              <FontAwesomeIcon icon={faBuildingColumns} />
              <span>{Object.keys(stats.byDepartment).length} Departments</span>
            </span>
            <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,var(--panel))] px-4 py-2 font-semibold text-[var(--primary)]">
              <FontAwesomeIcon icon={faChartBar} />
              <span>{Object.keys(stats.byDesignation).length} Roles</span>
            </span>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-6 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="mb-2 flex items-center gap-1 text-sm font-medium text-[var(--text)]">
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="text-[var(--primary)]"
              />
              <span>Search</span>
            </label>
            <input
              type="text"
              placeholder="Type a name..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-sm outline-none transition-all"
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1 text-sm font-medium text-[var(--text)]">
              <FontAwesomeIcon
                icon={faBuildingColumns}
                className="text-[var(--primary)]"
              />
              <span>Department</span>
            </label>
            <select
              value={filters.department}
              onChange={(e) => handleFilterChange("department", e.target.value)}
              className="w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-sm outline-none transition-all cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1 text-sm font-medium text-[var(--text)]">
              <FontAwesomeIcon
                icon={faChartBar}
                className="text-[var(--primary)]"
              />
              <span>Sort By</span>
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange("sortBy", e.target.value)}
              className="w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-sm outline-none transition-all cursor-pointer"
            >
              <option value="$updatedAt">Recently Updated</option>
              <option value="name">Name</option>
              <option value="department">Department</option>
              <option value="designation">Role</option>
            </select>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1 text-sm font-medium text-[var(--text)]">
              <FontAwesomeIcon
                icon={faSort}
                className="text-[var(--primary)]"
              />
              <span>Order</span>
            </label>
            <select
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange("sortOrder", e.target.value)}
              className="w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-sm outline-none transition-all cursor-pointer"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      </div>

      {facultyData.error && (
        <div className="animate-shake mb-6 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-red-700">
          <strong className="inline-flex items-center gap-2">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <span>Error:</span>
          </strong>{" "}
          {facultyData.error}
          <button
            onClick={() => loadFaculty()}
            className="ml-4 inline-flex items-center gap-2 font-semibold underline hover:no-underline"
          >
            <FontAwesomeIcon icon={faArrowRotateRight} />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {facultyData.faculty.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            {facultyData.faculty.map((faculty) => (
              <FacultyCard key={faculty.$id} faculty={faculty} />
            ))}
          </div>

          <Pagination
            currentPage={facultyData.page}
            totalPages={facultyData.totalPages}
            hasNext={facultyData.hasNext}
            hasPrev={facultyData.hasPrev}
            onPageChange={handlePageChange}
            totalItems={facultyData.total}
          />
        </>
      ) : (
        <div className="text-center py-12">
          <p className="mb-3 text-2xl text-[var(--primary)]">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </p>
          <p className="text-[var(--muted)] text-lg mb-4">
            No professors found matching your search.
          </p>
          {filters.search || filters.department !== "all" ? (
            <button
              onClick={() => {
                setFilters({
                  search: "",
                  department: "all",
                  sortBy: "$updatedAt",
                  sortOrder: "desc",
                });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg"
            >
              <FontAwesomeIcon icon={faArrowRotateRight} />
              <span>Clear All Filters</span>
            </button>
          ) : (
            <p className="text-[var(--muted)]">
              Try again later or contact support.
            </p>
          )}
        </div>
      )}

      {facultyData.loading && facultyData.faculty.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="animate-fadeIn rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-6 shadow-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto mb-2"></div>
            <p className="flex items-center justify-center gap-2 text-[var(--muted)]">
              <FontAwesomeIcon
                icon={faHourglassHalf}
                className="text-[var(--primary)]"
              />
              <span>Loading...</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FacultyCard({ faculty }) {
  const photoUrl = publicFacultyService.getFacultyPhotoUrl(faculty.photoFileId);
  const fallbackPhoto =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' font-family='sans-serif' font-size='14' fill='%236b7280'%3ENo Photo%3C/text%3E%3C/svg%3E";

  const handleImageError = (e) => {
    const img = e.currentTarget;
    const hasRetried = img.dataset.retryAttempted === "1";

    if (!hasRetried && photoUrl) {
      img.dataset.retryAttempted = "1";
      const separator = photoUrl.includes("?") ? "&" : "?";
      img.src = `${photoUrl}${separator}retry=${Date.now()}`;
      return;
    }

    img.src = fallbackPhoto;
  };

  return (
    <Link
      to={`/faculty/${faculty.employeeId}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        pointerEvents: "auto",
      }}
      className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] shadow-md overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 h-full"
    >
      <div
        className="h-40 bg-[var(--panel)] flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{ pointerEvents: "none" }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={faculty.name}
            className="h-full w-full object-cover transition-transform hover:scale-105"
            loading="lazy"
            decoding="async"
            onError={handleImageError}
            style={{ pointerEvents: "none" }}
          />
        ) : (
          <div className="text-center text-[var(--muted)]">
            <div className="mb-1 text-3xl text-[var(--primary)]">
              <FontAwesomeIcon icon={faUser} />
            </div>
            <div className="text-xs">No photo</div>
          </div>
        )}
      </div>

      <div
        className="p-3 flex-1 flex flex-col"
        style={{ pointerEvents: "none" }}
      >
        <h3 className="font-semibold text-base text-[var(--text)] mb-2 line-clamp-2 min-h-[2.5rem]">
          {faculty.name || "Unknown"}
        </h3>

        <div className="space-y-1.5 text-xs text-[var(--muted)] flex-1">
          <div className="flex items-start">
            <span className="inline-flex w-16 shrink-0 items-center gap-1 font-medium">
              <FontAwesomeIcon icon={faChartBar} />
              <span>Role:</span>
            </span>
            <span className="line-clamp-2 text-[var(--text)]">
              {faculty.designation || "Not specified"}
            </span>
          </div>

          <div className="flex items-start">
            <span className="inline-flex w-16 shrink-0 items-center gap-1 font-medium">
              <FontAwesomeIcon icon={faBuildingColumns} />
              <span>Dept:</span>
            </span>
            <span className="line-clamp-2 text-[var(--text)]">
              {faculty.department
                ? faculty.department
                    .replace("School of ", "")
                    .replace(" (", " (")
                : "Not specified"}
            </span>
          </div>

          {faculty.researchArea && (
            <div className="flex items-start">
              <span className="inline-flex w-16 shrink-0 items-center gap-1 font-medium">
                <FontAwesomeIcon icon={faFlask} />
                <span>Focus:</span>
              </span>
              <span className="line-clamp-2 text-[var(--text)]">
                {faculty.researchArea}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--line)]">
          <span className="text-xs text-[var(--muted)]">
            ID: {faculty.employeeId}
          </span>
        </div>
      </div>
    </Link>
  );
}

function Pagination({
  currentPage,
  totalPages,
  hasNext,
  hasPrev,
  onPageChange,
  totalItems,
}) {
  const maxVisiblePages = 5;
  const startPage = Math.max(
    1,
    Math.min(currentPage - 2, totalPages - maxVisiblePages + 1)
  );
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  const pages = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-[var(--muted)]">
        <span className="inline-flex items-center gap-2">
          <FontAwesomeIcon icon={faChartBar} />
          <span>
            Page {currentPage} of {totalPages} ({totalItems.toLocaleString()}{" "}
            professors)
          </span>
        </span>
      </div>

      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev}
          className="rounded-full border border-[var(--line)] bg-[var(--bg-elev)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="inline-flex items-center gap-2">
            <FontAwesomeIcon icon={faChevronLeft} />
            <span>Previous</span>
          </span>
        </button>

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              page === currentPage
                ? "bg-[var(--primary)] text-white shadow-lg scale-110"
                : "border border-[var(--line)] bg-[var(--bg-elev)] text-[var(--text)] hover:bg-[var(--panel)]"
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext}
          className="rounded-full border border-[var(--line)] bg-[var(--bg-elev)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="inline-flex items-center gap-2">
            <span>Next</span>
            <FontAwesomeIcon icon={faChevronRight} />
          </span>
        </button>
      </div>
    </div>
  );
}

export default FacultyList;
