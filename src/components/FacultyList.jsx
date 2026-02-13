import { useState, useEffect } from "react";
import publicFacultyService from "../services/publicFacultyService.js";
import FacultyFeedbackPanel from "./FacultyFeedbackPanel.jsx";

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading faculty data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Faculty Directory</h1>
        {stats && (
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span className="bg-blue-100 px-3 py-1 rounded-full">Total: {stats.total} faculty members</span>
            <span className="bg-green-100 px-3 py-1 rounded-full">
              {Object.keys(stats.byDepartment).length} departments
            </span>
            <span className="bg-indigo-100 px-3 py-1 rounded-full">
              {Object.keys(stats.byDesignation).length} designations
            </span>
          </div>
        )}
      </div>

      <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Faculty</label>
            <input
              type="text"
              placeholder="Search by name..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={filters.department}
              onChange={(e) => handleFilterChange("department", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange("sortBy", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="$updatedAt">Last Updated</option>
              <option value="name">Name</option>
              <option value="department">Department</option>
              <option value="designation">Designation</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
            <select
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange("sortOrder", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      </div>

      {facultyData.error && (
        <div className="mb-6 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {facultyData.error}
          <button onClick={() => loadFaculty()} className="ml-4 underline hover:no-underline">
            Try Again
          </button>
        </div>
      )}

      {facultyData.faculty.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            {facultyData.faculty.map((faculty) => (
              <FacultyCard key={faculty.$id} faculty={faculty} currentUser={currentUser} />
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
          <p className="text-gray-600 text-lg mb-4">No faculty members found.</p>
          {filters.search || filters.department !== "all" ? (
            <button
              onClick={() => {
                setFilters({ search: "", department: "all", sortBy: "$updatedAt", sortOrder: "desc" });
              }}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Clear filters to show all faculty
            </button>
          ) : (
            <p className="text-gray-500">Try again later or contact support.</p>
          )}
        </div>
      )}

      {facultyData.loading && facultyData.faculty.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p>Loading...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FacultyCard({ faculty, currentUser }) {
  const [showFeedback, setShowFeedback] = useState(false);
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
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
      <div className="h-40 bg-gray-200 flex items-center justify-center flex-shrink-0">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={faculty.name}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={handleImageError}
          />
        ) : (
          <div className="text-gray-500 text-center">
            <div className="text-3xl mb-1">No photo</div>
          </div>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-semibold text-base text-gray-800 mb-2 line-clamp-2 min-h-[2.5rem]">
          {faculty.name || "Unknown"}
        </h3>

        <div className="space-y-1.5 text-xs text-gray-600 flex-1">
          <div className="flex items-start">
            <span className="font-medium w-16 shrink-0 text-gray-500">Role:</span>
            <span className="line-clamp-2 text-gray-700">{faculty.designation || "Not specified"}</span>
          </div>

          <div className="flex items-start">
            <span className="font-medium w-16 shrink-0 text-gray-500">Dept:</span>
            <span className="line-clamp-2 text-gray-700">
              {faculty.department
                ? faculty.department.replace("School of ", "").replace(" (", " (")
                : "Not specified"}
            </span>
          </div>

          {faculty.researchArea && (
            <div className="flex items-start">
              <span className="font-medium w-16 shrink-0 text-gray-500">Research:</span>
              <span className="line-clamp-2 text-gray-700">{faculty.researchArea}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200">
          <span className="text-xs text-gray-400">ID: {faculty.employeeId}</span>
          <button
            onClick={() => setShowFeedback((prev) => !prev)}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            {showFeedback ? "Hide Reviews" : "Rate and Review"}
          </button>
        </div>

        {showFeedback ? (
          <FacultyFeedbackPanel facultyId={faculty.employeeId} currentUser={currentUser} />
        ) : null}
      </div>
    </div>
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
      <div className="text-sm text-gray-600">
        Showing page {currentPage} of {totalPages} ({totalItems.toLocaleString()} total)
      </div>

      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-2 text-sm font-medium rounded-md ${
              page === currentPage
                ? "text-white bg-blue-600 border border-blue-600"
                : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default FacultyList;
