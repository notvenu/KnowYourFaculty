// eslint-disable tailwindcss/no-custom-classname
// eslint-disable no-irregular-whitespace
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import publicFacultyService from "../services/publicFacultyService.js";
import facultyFeedbackService from "../services/facultyFeedbackService.js";
import courseService from "../services/courseService.js";

const RATING_FIELDS = [
  { key: "theoryTeaching", label: "Theory Teaching Experience" },
  { key: "theoryAttendance", label: "Attendance Strictness" },
  { key: "labClass", label: "Lab Class Support" },
  { key: "theoryCorrection", label: "Correction Fairness" },
  { key: "ecsCapstoneSDP", label: "ECS / Capstone Support" },
  { key: "labCorrection", label: "Lab Correction" }
];

const RATING_EMOJIS = {
  1: "💀",
  2: "😭",
  3: "😃",
  4: "🔥",
  5: "🙇"
};

const EMOJI_ORDER = [1, 2, 3, 4, 5];
const THEORY_NOTE_OPTIONS = ["No", "Yes"];
const LAB_NOTE_OPTIONS = [
  { value: "None", label: "None" },
  { value: "Soft", label: "Soft" },
  { value: "Hard", label: "Hard" },
  { value: "Both", label: "Both" }
];

const INITIAL_FEEDBACK_FORM = {
  courseId: "",
  review: "",
  theoryNotes: false,
  theoryTeaching: 3,
  theoryAttendance: 3,
  theoryClass: 3,
  theoryCorrection: 3,
  labClass: 3,
  labCorrection: 3,
  labAttendance: 3,
  ecsCapstoneSDP: 3,
  labNotes: "None"
};

function parseRatingInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) return 3;
  return n;
}

function FacultyDetailPage({ currentUser }) {
  const { facultyId } = useParams();
  const [faculty, setFaculty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [ratingSummary, setRatingSummary] = useState({
    totalRatings: 0,
    overallAverage: null,
    sectionAverages: {},
    averages: {}
  });
  const [feedbackForm, setFeedbackForm] = useState(INITIAL_FEEDBACK_FORM);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [courseQuery, setCourseQuery] = useState("");
  const [courseSuggestions, setCourseSuggestions] = useState([]);
  const [courseLookup, setCourseLookup] = useState({});

  const hasUser = Boolean(currentUser?.$id);
  const facultyName = faculty?.name || "Faculty";

  const averageRows = useMemo(
    () =>
      RATING_FIELDS.map((field) => ({
        ...field,
        value: ratingSummary.averages?.[field.key] ?? null
      })),
    [ratingSummary]
  );

  useEffect(() => {
    loadFaculty();
  }, [facultyId]);

  useEffect(() => {
    loadFeedback();
  }, [facultyId, hasUser, currentUser?.$id]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const query = String(courseQuery || "").trim();
      if (!isEditing || !query) {
        setCourseSuggestions([]);
        return;
      }
      try {
        const courses = await courseService.searchCourses(query, 8);
        if (!active) return;
        setCourseSuggestions(courses);
        setCourseLookup((prev) => {
          const merged = { ...prev };
          for (const course of courses) {
            if (course?.$id) merged[course.$id] = course;
          }
          return merged;
        });
      } catch {
        if (active) setCourseSuggestions([]);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [courseQuery, isEditing]);

  const loadFaculty = async () => {
    try {
      setLoading(true);
      setError(null);
      const row = await publicFacultyService.getFacultyById(facultyId);
      if (!row) {
        setError("Faculty profile not found.");
      } else {
        setFaculty(row);
      }
    } catch (loadError) {
      setError(loadError?.message || "Failed to load faculty profile.");
    } finally {
      setLoading(false);
    }
  };

  const loadCourseLookup = async (courseIds = []) => {
    const uniqueIds = [...new Set(courseIds.map((id) => String(id || "").trim()).filter(Boolean))];
    if (uniqueIds.length === 0) return;
    const entries = await Promise.all(
      uniqueIds.map(async (courseId) => {
        const course = await courseService.getCourseById(courseId);
        return [courseId, course];
      })
    );
    setCourseLookup((prev) => {
      const merged = { ...prev };
      for (const [courseId, course] of entries) {
        if (course) merged[courseId] = course;
      }
      return merged;
    });
  };

  const loadFeedback = async () => {
    try {
      const response = await facultyFeedbackService.getFacultyFeedback(facultyId);
      setReviews(response.reviews || []);
      setRatingSummary(
        response.ratingSummary || { totalRatings: 0, overallAverage: null, sectionAverages: {}, averages: {} }
      );
      await loadCourseLookup((response.reviews || []).map((row) => row.courseId));

      if (hasUser) {
        const existing = await facultyFeedbackService.getUserFacultyFeedback(currentUser.$id, facultyId);
        if (existing) {
          setAlreadySubmitted(true);
          setIsEditing(false);
          setFeedbackForm({
            courseId: existing.courseId || "",
            review: existing.review || "",
            theoryNotes: Boolean(existing.theoryNotes),
            theoryTeaching: parseRatingInput(existing.theoryTeaching),
            theoryAttendance: parseRatingInput(existing.theoryAttendance),
            theoryClass: parseRatingInput(existing.theoryClass),
            theoryCorrection: parseRatingInput(existing.theoryCorrection),
            labClass: parseRatingInput(existing.labClass),
            labCorrection: parseRatingInput(existing.labCorrection),
            labAttendance: parseRatingInput(existing.labAttendance),
            ecsCapstoneSDP: parseRatingInput(existing.ecsCapstoneSDP),
            labNotes: existing.labNotes || "None"
          });
          if (existing.courseId) {
            const course = await courseService.getCourseById(existing.courseId);
            if (course) {
              setCourseQuery(`${course.courseCode} - ${course.courseName}`);
              setCourseLookup((prev) => ({ ...prev, [course.$id]: course }));
            } else {
              setCourseQuery(existing.courseId);
            }
          } else {
            setCourseQuery("");
          }
        } else {
          setAlreadySubmitted(false);
          setIsEditing(true);
          setShowFeedbackForm(false);
          setFeedbackForm(INITIAL_FEEDBACK_FORM);
          setCourseQuery("");
        }
      } else {
        setAlreadySubmitted(false);
        setIsEditing(false);
        setShowFeedbackForm(false);
        setCourseQuery("");
      }
    } catch (loadError) {
      const code = Number(loadError?.code || 0);
      const unauthorized = code === 401 || String(loadError?.message || "").toLowerCase().includes("not authorized");
      if (!unauthorized || hasUser) {
        setError(loadError?.message || "Failed to load feedback");
      }
    }
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!hasUser) return;
    try {
      setSaving(true);
      setError(null);
      await facultyFeedbackService.submitFeedback({
        userId: currentUser.$id,
        facultyId,
        courseId: feedbackForm.courseId,
        review: feedbackForm.review,
        theoryTeaching: feedbackForm.theoryTeaching,
        theoryAttendance: feedbackForm.theoryAttendance,
        theoryClass: feedbackForm.theoryClass,
        theoryCorrection: feedbackForm.theoryCorrection,
        labClass: feedbackForm.labClass,
        labCorrection: feedbackForm.labCorrection,
        labAttendance: feedbackForm.labAttendance,
        ecsCapstoneSDP: feedbackForm.ecsCapstoneSDP,
        theoryNotes: feedbackForm.theoryNotes,
        labNotes: feedbackForm.labNotes
      });
      setAlreadySubmitted(true);
      setIsEditing(false);
      setShowFeedbackForm(false);
      await loadFeedback();
    } catch (submitError) {
      setError(submitError?.message || "Failed to save feedback");
    } finally {
      setSaving(false);
    }
  };

  const deleteFeedback = async () => {
    if (!hasUser) return;
    const confirmed = window.confirm("Delete your feedback for this faculty?");
    if (!confirmed) return;
    try {
      setDeleting(true);
      setError(null);
      await facultyFeedbackService.deleteUserFacultyFeedback(currentUser.$id, facultyId);
      setAlreadySubmitted(false);
      setIsEditing(true);
      setShowFeedbackForm(false);
      setFeedbackForm(INITIAL_FEEDBACK_FORM);
      setCourseQuery("");
      await loadFeedback();
    } catch (deleteError) {
      setError(deleteError?.message || "Failed to delete feedback");
    } finally {
      setDeleting(false);
    }
  };

  const selectCourse = (course) => {
    setFeedbackForm((prev) => ({ ...prev, courseId: course.$id }));
    setCourseQuery(`${course.courseCode} - ${course.courseName}`);
    setCourseSuggestions([]);
    setCourseLookup((prev) => ({ ...prev, [course.$id]: course }));
  };

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading faculty profile...</p>;
  if (!faculty) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{error || "Faculty not found."}</p>;

  return (
    <div className="space-y-6">
      <Link to="/faculty" className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--text)]">
        {"<- Back to Faculty Search"}
      </Link>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>
      ) : null}

      {/* Main Layout: Left Side (Faculty Info) + Right Side (Ratings) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        
        {/* LEFT: Faculty Info Card */}
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-6">
          <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
            <img
              src={publicFacultyService.getFacultyPhotoUrl(faculty.photoFileId)}
              alt={faculty.name}
              className="h-80 w-full object-cover"
              onError={(e) => {
                e.currentTarget.src = publicFacultyService.getPlaceholderPhoto();
              }}
            />
          </div>

          <div className="mt-6">
            <h1 className="text-3xl font-black leading-tight">{faculty.name}</h1>
            <p className="mt-2 text-sm font-semibold text-[var(--primary)]">{faculty.designation || "Not specified"}</p>
            
            <div className="mt-6 space-y-2 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
              <p>
                <span className="font-semibold text-[var(--text)]">Department:</span> {faculty.department || "Not specified"}
              </p>
              <p>
                <span className="font-semibold text-[var(--text)]">PhD in:</span> {faculty.educationPhD || "Not specified"}
              </p>
              <p>
                <span className="font-semibold text-[var(--text)]">Employee ID:</span> {faculty.employeeId}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: Ratings Card */}
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Ratings</h2>
            {hasUser && !showFeedbackForm && (
              <button
                onClick={() => {
                  setShowFeedbackForm(true);
                  setIsEditing(true);
                }}
                className="rounded-full bg-[var(--primary)] px-3 py-1 text-xs font-bold text-[#04222b] hover:opacity-90"
              >
                {alreadySubmitted ? "✏️ Edit" : "💬 Share"}
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 text-center">
            <div className="text-5xl font-black text-[var(--primary)]">
              {ratingSummary.overallAverage?.toFixed(1) ?? "-"}
            </div>
            <div className="mt-2 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-lg transition-opacity ${star <= Math.round(ratingSummary.overallAverage || 0) ? "opacity-100" : "opacity-30"}`}
                >
                  ★
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {ratingSummary.totalRatings} {ratingSummary.totalRatings === 1 ? "rating" : "ratings"}
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {averageRows.map((row) => (
              <div key={row.key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text)]">{row.label}</span>
                  <span className="text-xs font-bold text-[var(--primary)]">{row.value?.toFixed(1) ?? "-"}</span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <div
                      key={star}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        star <= Math.round(row.value || 0)
                          ? "bg-[var(--primary)]"
                          : "bg-[var(--line)]"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Ratings Section */}
      {!showFeedbackForm && (
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-6">
          <h2 className="mb-6 text-2xl font-bold">Detailed Ratings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {averageRows.map((row) => (
              <div key={row.key} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <p className="mb-3 text-sm font-semibold text-[var(--text)]">{row.label}</p>
                {row.value ? (
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-bold text-[var(--primary)]">{row.value.toFixed(1)}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-lg transition-opacity ${star <= Math.round(row.value) ? "opacity-100" : "opacity-30"}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">Not rated yet</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Reviews */}
      {!showFeedbackForm && reviews.length > 0 && (
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-6">
          <h2 className="mb-4 text-2xl font-bold">What Students Say</h2>
          <div className="space-y-3">
            {reviews.slice(0, 5).map((review) => {
              const avgRating = Math.round(
                (review.theoryTeaching + review.theoryAttendance + review.theoryCorrection + review.labClass + review.labCorrection) / 5
              );
              return (
                <div key={review.$id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[var(--text)]">Anonymous</p>
                        {review.courseId && courseLookup[review.courseId] && (
                          <span className="rounded-full bg-[var(--primary)]/20 px-2 py-1 text-xs font-medium text-[var(--primary)]">{courseLookup[review.courseId].courseCode}</span>
                        )}
                      </div>
                      {review.review && (
                        <p className="mt-2 text-sm text-[var(--muted)]">"{review.review.substring(0, 100)}{review.review.length > 100 ? "..." : ""}"</p>
                      )}
                    </div>
                    <div className="text-2xl">
                      {RATING_EMOJIS[avgRating]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback Form */}
      {showFeedbackForm && hasUser && isEditing ? (
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-6">
          <form onSubmit={submitFeedback} className="space-y-6">
            <div>
              <h2 className="mb-1 text-2xl font-bold">Share Your Experience</h2>
              <p className="text-sm text-[var(--muted)]">Help fellow students by rating your time with {facultyName}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {RATING_FIELDS.map((field) => {
                const value = feedbackForm[field.key];
                return (
                  <div key={field.key}>
                    <p className="mb-3 text-sm font-semibold">{field.label}</p>
                    <div className="relative h-[80px] overflow-hidden rounded-3xl border border-[var(--line)] bg-gradient-to-b from-[var(--panel)] to-[color-mix(in_srgb,var(--panel)_30%,#071923)] px-4 shadow-inner">
                      <div
                        className="pointer-events-none absolute top-1 z-[1] h-[68px] rounded-full bg-gradient-to-b from-[var(--primary)]/90 to-[var(--primary)]/60 shadow-[0_0_30px_color-mix(in_srgb,var(--primary)_75%,transparent)] transition-transform duration-200"
                        style={{
                          width: "calc((100% - 2rem) / 5)",
                          left: "1rem",
                          transform: `translateX(${(value - 1) * 100}%)`
                        }}
                        aria-hidden
                      />
                      <div className="pointer-events-none relative z-[2] grid h-full grid-cols-5 items-center">
                        {EMOJI_ORDER.map((rating) => (
                          <span
                            key={`${field.key}-${rating}`}
                            className={`text-center text-2xl transition-all duration-150 ${
                              rating === value ? "scale-125 opacity-100 drop-shadow-md" : "opacity-50"
                            }`}
                          >
                            {RATING_EMOJIS[rating]}
                          </span>
                        ))}
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={value}
                        onChange={(e) =>
                          setFeedbackForm((prev) => ({
                            ...prev,
                            [field.key]: Number(e.target.value)
                          }))
                        }
                        className="absolute inset-0 z-[3] m-0 w-full cursor-pointer opacity-0"
                        aria-label={`${field.label} rating`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 border-t border-[var(--line)] pt-6 md:grid-cols-2">
              <div>
                <p className="mb-3 text-sm font-semibold">Theory Notes Provided?</p>
                <div className="relative h-[56px] overflow-hidden rounded-3xl border border-[var(--line)] bg-gradient-to-b from-[var(--panel)] to-[color-mix(in_srgb,var(--panel)_30%,#071923)] px-3 shadow-inner">
                  <div
                    className="pointer-events-none absolute top-1 z-[1] h-[44px] rounded-full bg-gradient-to-b from-[var(--primary)]/90 to-[var(--primary)]/60 shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_60%,transparent)] transition-transform duration-200"
                    style={{
                      width: "calc((100% - 1.5rem) / 2)",
                      left: "0.75rem",
                      transform: `translateX(${feedbackForm.theoryNotes ? 100 : 0}%)`
                    }}
                  />
                  <div className="pointer-events-none relative z-[2] grid h-full grid-cols-2 items-center">
                    {THEORY_NOTE_OPTIONS.map((label, idx) => (
                      <span
                        key={label}
                        className={`text-center text-sm font-semibold transition-all duration-150 ${
                          (feedbackForm.theoryNotes ? 1 : 0) === idx ? "opacity-100" : "opacity-60"
                        }`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={1}
                    value={feedbackForm.theoryNotes ? 1 : 0}
                    onChange={(e) =>
                      setFeedbackForm((prev) => ({
                        ...prev,
                        theoryNotes: Number(e.target.value) === 1
                      }))
                    }
                    className="absolute inset-0 z-[3] m-0 w-full cursor-pointer opacity-0"
                    aria-label="Theory notes provided"
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold">Lab Materials Provided?</p>
                <div className="relative h-[56px] overflow-hidden rounded-3xl border border-[var(--line)] bg-gradient-to-b from-[var(--panel)] to-[color-mix(in_srgb,var(--panel)_30%,#071923)] px-3 shadow-inner">
                  <div
                    className="pointer-events-none absolute top-1 z-[1] h-[44px] rounded-full bg-gradient-to-b from-[var(--primary)]/90 to-[var(--primary)]/60 shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_60%,transparent)] transition-transform duration-200"
                    style={{
                      width: "calc((100% - 1.5rem) / 4)",
                      left: "0.75rem",
                      transform: `translateX(${
                        Math.max(0, LAB_NOTE_OPTIONS.findIndex((opt) => opt.value === feedbackForm.labNotes)) * 100
                      }%)`
                    }}
                  />
                  <div className="pointer-events-none relative z-[2] grid h-full grid-cols-4 items-center">
                    {LAB_NOTE_OPTIONS.map((opt, idx) => (
                      <span
                        key={opt.value}
                        className={`text-center text-sm font-semibold transition-all duration-150 ${
                          Math.max(0, LAB_NOTE_OPTIONS.findIndex((item) => item.value === feedbackForm.labNotes)) ===
                          idx
                            ? "opacity-100"
                            : "opacity-60"
                        }`}
                      >
                        {opt.label}
                      </span>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={1}
                    value={Math.max(0, LAB_NOTE_OPTIONS.findIndex((opt) => opt.value === feedbackForm.labNotes))}
                    onChange={(e) =>
                      setFeedbackForm((prev) => ({
                        ...prev,
                        labNotes: LAB_NOTE_OPTIONS[Number(e.target.value)]?.value || "None"
                      }))
                    }
                    className="absolute inset-0 z-[3] m-0 w-full cursor-pointer opacity-0"
                    aria-label="Lab materials provided"
                  />
                </div>
              </div>
            </div>

            <div className="relative">
              <label className="mb-2 block text-sm font-semibold">Which Course?</label>
              <input
                type="text"
                placeholder="Type to search courses..."
                value={courseQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setCourseQuery(value);
                  if (!String(value || "").trim()) {
                    setFeedbackForm((prev) => ({ ...prev, courseId: "" }));
                  }
                }}
                className="w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm outline-none"
              />
              {courseSuggestions.length > 0 ? (
                <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--bg)] shadow-lg">
                  {courseSuggestions.map((course) => (
                    <button
                      key={course.$id}
                      type="button"
                      onClick={() => selectCourse(course)}
                      className="block w-full border-b border-[var(--line)] px-4 py-2 text-left text-xs hover:bg-[var(--panel)] last:border-b-0"
                    >
                      {course.courseCode} - {course.courseName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Your Review</label>
              <textarea
                value={feedbackForm.review}
                onChange={(e) => setFeedbackForm((prev) => ({ ...prev, review: e.target.value }))}
                rows={4}
                placeholder={`Tell us about ${facultyName}: teaching style, grading fairness, and accessibility.`}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-6">
              <button
                type="button"
                onClick={() => setShowFeedbackForm(false)}
                className="rounded-full border border-[var(--line)] px-6 py-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--panel)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[var(--primary)] px-8 py-3 text-sm font-bold text-[#04222b] shadow-lg disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Feedback"}
              </button>
            </div>

            {alreadySubmitted && (
              <button
                type="button"
                onClick={deleteFeedback}
                disabled={deleting}
                className="w-full rounded-full border border-red-500 px-6 py-3 text-sm text-red-400 hover:bg-red-50/30 disabled:opacity-60"
              >
                {deleting ? "Removing..." : "Remove Your Feedback"}
              </button>
            )}
          </form>
        </div>
      ) : !hasUser && !showFeedbackForm ? (
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-6">
          <p className="text-sm text-[var(--muted)]">Sign in with your VIT-AP account to submit feedback.</p>
        </div>
      ) : null}
    </div>
  );
}

export default FacultyDetailPage;
