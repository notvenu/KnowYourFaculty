import { useEffect, useMemo, useState } from "react";
import { Query } from "appwrite";
import publicFacultyService from "../services/publicFacultyService.js";
import facultyFeedbackService from "../services/facultyFeedbackService.js";
import courseService from "../services/courseService.js";

function buildFacultyLookup(facultyRows) {
  const lookup = {};
  for (const row of facultyRows || []) {
    lookup[String(row.employeeId)] = row.name || `Faculty ${row.employeeId}`;
  }
  return lookup;
}

function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [topFaculty, setTopFaculty] = useState([]);
  const [courses, setCourses] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [courseForm, setCourseForm] = useState({ file: null });

  const statsCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Total Faculty", value: stats.totalFaculty },
      { label: "Total Reviews", value: stats.totalReviews },
      { label: "Users Submitted", value: stats.usersSubmitted },
      { label: "Courses", value: stats.totalCourses },
    ];
  }, [stats]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [facultyListResponse, feedbackResponse, courseRows] = await Promise.all([
        publicFacultyService.getFacultyList({ page: 1, limit: 5000 }),
        facultyFeedbackService.listRows(facultyFeedbackService.feedbackTableId, [Query.limit(5000)]),
        courseService.getAllCourses(5000),
      ]);

      const facultyRows = facultyListResponse.faculty || [];
      const feedbackRows = feedbackResponse.rows || [];
      const facultyLookup = buildFacultyLookup(facultyRows);

      const uniqueUsers = new Set();
      const reviewRows = feedbackRows.filter((row) => String(row.review || "").trim());
      const facultyCounts = {};

      for (const row of feedbackRows) {
        if (row.userId) uniqueUsers.add(String(row.userId));
        const facultyId = String(row.facultyId || "");
        if (!facultyId) continue;
        facultyCounts[facultyId] = (facultyCounts[facultyId] || 0) + 1;
      }

      const rankedFaculty = Object.entries(facultyCounts)
        .map(([facultyId, count]) => ({
          facultyId,
          count,
          facultyName: facultyLookup[facultyId] || `Faculty ${facultyId}`,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setStats({
        totalFaculty: facultyRows.length,
        totalReviews: reviewRows.length,
        usersSubmitted: uniqueUsers.size,
        totalCourses: courseRows.length,
      });
      setTopFaculty(rankedFaculty);
      setCourses(courseRows.slice(0, 30));
    } catch (loadError) {
      setError(loadError?.message || "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleSubmitCourse = async (event) => {
    event.preventDefault();
    try {
      if (!courseForm.file) {
        throw new Error("Please choose a PDF file.");
      }
      setUploading(true);
      setUploadMessage(null);

      const { extractCoursesFromPdf } = await import("../lib/parsers/coursePdfParser.js");
      const parsed = await extractCoursesFromPdf(courseForm.file);
      const result = await courseService.upsertCoursesFromPdf({
        courses: parsed.courses,
      });

      setUploadMessage(
        `Processed ${parsed.linesScanned} lines. Extracted ${result.parsedCount}, merged to ${result.mergedCount}, created ${result.created}, updated ${result.updated}.`
      );
      setCourseForm({ file: null });
      await loadAdminData();
    } catch (submitError) {
      setUploadMessage(submitError?.message || "Unable to save course.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-(--text)">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-(--muted)">
          Manage course uploads and view faculty feedback stats.
        </p>
      </div>

      {loading ? (
        <p className="text-sm font-medium text-(--muted)">Loading…</p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-500/10 p-4 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((card) => (
            <div
              key={card.label}
              className="rounded-(--radius-lg) border border-(--line) bg-(--bg-elev) p-5 shadow-(--shadow)"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-(--muted)">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-(--text)">{card.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-(--radius-lg) border border-(--line) bg-(--bg-elev) p-6 shadow-(--shadow)">
          <h2 className="mb-4 text-lg font-bold text-(--text)">
            Upload course PDF
          </h2>
          <form onSubmit={handleSubmitCourse} className="space-y-4">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) =>
                setCourseForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))
              }
              className="w-full rounded-xl border border-(--line) bg-(--panel) px-4 py-2.5 text-sm text-(--text) file:mr-3 file:rounded-lg file:border-0 file:bg-(--primary) file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              required
            />
            <button
              type="submit"
              disabled={uploading}
              className="rounded-xl bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white shadow-(--shadow) disabled:opacity-60"
            >
              {uploading ? "Parsing…" : "Parse PDF and save courses"}
            </button>
            {uploadMessage ? (
              <p className="text-sm text-(--muted)">{uploadMessage}</p>
            ) : null}
          </form>
        </div>

        <div className="rounded-(--radius-lg) border border-(--line) bg-(--bg-elev) p-6 shadow-(--shadow)">
          <h2 className="mb-4 text-lg font-bold text-(--text)">
            Top faculty by feedback count
          </h2>
          {topFaculty.length === 0 ? (
            <p className="text-sm text-(--muted)">No feedback yet.</p>
          ) : (
            <div className="space-y-3">
              {topFaculty.map((item) => (
                <div
                  key={item.facultyId}
                  className="flex items-center justify-between rounded-xl border border-(--line) bg-(--panel) px-4 py-2.5"
                >
                  <span className="text-sm font-medium text-(--text) truncate">
                    {item.facultyName}
                  </span>
                  <span className="text-sm font-bold text-(--primary)">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-(--radius-lg) border border-(--line) bg-(--bg-elev) p-6 shadow-(--shadow)">
        <h2 className="mb-4 text-lg font-bold text-(--text)">Recent courses</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-(--muted)">No courses.</p>
        ) : (
          <div className="space-y-2">
            {courses.map((course) => (
              <div
                key={course.$id}
                className="flex items-center justify-between gap-2 rounded-xl border border-(--line) bg-(--panel) px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-(--text) truncate">
                  {course.courseCode} – {course.courseName}
                </span>
                <span className="text-xs text-(--muted)">Course</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;

