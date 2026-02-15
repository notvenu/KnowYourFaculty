// eslint-disable tailwindcss/no-custom-classname
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
    hasPrev: false
  });

  const [filters, setFilters] = useState({
    search: "",
    department: "all",
    sortBy: "$updatedAt",
    sortOrder: "desc"
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
        sortOrder: filters.sortOrder
      });

      setFacultyData((prev) => ({
        ...prev,
        ...response,
        loading: false
      }));
    } catch (error) {
      setFacultyData((prev) => ({
        ...prev,
        loading: false,
        error: error.message
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
          <p className="text-[var(--muted)]">🔍 Finding amazing professors for you...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 animate-fadeIn">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-[var(--text)] mb-4">
          <span>🎓</span> Find Your Professor
        </h1>
        {stats && (
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-1 bg-[color-mix(in_srgb,var(--primary)_20%,var(--panel))] text-[var(--primary)] px-4 py-2 rounded-full font-semibold">
              <span>👥</span> {stats.total} Professors
            </span>
            <span className="flex items-center gap-1 bg-[color-mix(in_srgb,var(--primary)_20%,var(--panel))] text-[var(--primary)] px-4 py-2 rounded-full font-semibold">
              <span>🏛️</span> {Object.keys(stats.byDepartment).length} Departments
            </span>
            <span className="flex items-center gap-1 bg-[color-mix(in_srgb,var(--primary)_20%,var(--panel))] text-[var(--primary)] px-4 py-2 rounded-full font-semibold">
              <span>🎯</span> {Object.keys(stats.byDesignation).length} Roles
            </span>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-6 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="mb-2 flex items-center gap-1 text-sm font-medium text-[var(--text)]">  
              <span>🔍</span> Search
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
              <span>🏛️</span> Department
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
              <span>📊</span> Sort By
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
              <span>⇅</span> Order
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
          <strong>⚠️ Error:</strong> {facultyData.error}
          <button onClick={() => loadFaculty()} className="ml-4 font-semibold underline hover:no-underline">
            🔄 Try Again
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
          <p className="text-2xl mb-3">🔍</p>
          <p className="text-[var(--muted)] text-lg mb-4">No professors found matching your search.</p>
          {filters.search || filters.department !== "all" ? (
            <button
              onClick={() => {
                setFilters({ search: "", department: "all", sortBy: "$updatedAt", sortOrder: "desc" });
              }}
              className="rounded-full bg-[var(--primary)] px-6 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg"
            >
              🔄 Clear All Filters
            </button>
          ) : (
            <p className="text-[var(--muted)]">Try again later or contact support.</p>
          )}
        </div>
      )}

      {facultyData.loading && facultyData.faculty.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="animate-fadeIn rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-6 shadow-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto mb-2"></div>
            <p className="text-[var(--muted)]">⏳ Loading...</p>
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
      style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', pointerEvents: 'auto' }}
      className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] shadow-md overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 h-full"
    >
      <div className="h-40 bg-[var(--panel)] flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ pointerEvents: 'none' }}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={faculty.name}
            className="h-full w-full object-cover transition-transform hover:scale-105"
            loading="lazy"
            decoding="async"
            onError={handleImageError}
            style={{ pointerEvents: 'none' }}
          />
        ) : (
          <div className="text-[var(--muted)] text-center">
            <div className="text-3xl mb-1">👤</div>
            <div className="text-xs">No photo</div>
          </div>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col" style={{ pointerEvents: 'none' }}>
        <h3 className="font-semibold text-base text-[var(--text)] mb-2 line-clamp-2 min-h-[2.5rem]">
          {faculty.name || "Unknown"}
        </h3>

        <div className="space-y-1.5 text-xs text-[var(--muted)] flex-1">
          <div className="flex items-start">
            <span className="font-medium w-16 shrink-0">🎯 Role:</span>
            <span className="line-clamp-2 text-[var(--text)]">{faculty.designation || "Not specified"}</span>
          </div>

          <div className="flex items-start">
            <span className="font-medium w-16 shrink-0">🏛️ Dept:</span>
            <span className="line-clamp-2 text-[var(--text)]">
              {faculty.department
                ? faculty.department.replace("School of ", "").replace(" (", " (")
                : "Not specified"}
            </span>
          </div>

          {faculty.researchArea && (
            <div className="flex items-start">
              <span className="font-medium w-16 shrink-0">🔬 Focus:</span>
              <span className="line-clamp-2 text-[var(--text)]">{faculty.researchArea}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--line)]">
          <span className="text-xs text-[var(--muted)]">ID: {faculty.employeeId}</span>
        </div>
      </div>
    </Link>
  );
}

function Pagination({ currentPage, totalPages, hasNext, hasPrev, onPageChange, totalItems }) {
  const maxVisiblePages = 5;
  const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - maxVisiblePages + 1));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-[var(--muted)]">
        📊 Page {currentPage} of {totalPages} ({totalItems.toLocaleString()} professors)
      </div>

      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev}
          className="rounded-full border border-[var(--line)] bg-[var(--bg-elev)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--panel)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
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
          Next →
        </button>
      </div>
    </div>
  );
}

export default FacultyList;
