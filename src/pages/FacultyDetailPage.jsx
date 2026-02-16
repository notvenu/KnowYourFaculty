// eslint-disable tailwindcss/no-custom-classname
// eslint-disable no-irregular-whitespace
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import publicFacultyService from "../services/publicFacultyService.js";
import facultyFeedbackService from "../services/facultyFeedbackService.js";
import courseService from "../services/courseService.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import FacultyProfileCard from "../components/FacultyProfileCard.jsx";
import FacultyRatingsCard from "../components/FacultyRatingsCard.jsx";
import FeedbackList from "../components/FeedbackList.jsx";
import RatingSlider from "../components/RatingSlider.jsx";
import ConfirmOverlay from "../components/ConfirmOverlay.jsx";
import { RATING_FIELDS, THEORY_FIELDS, LAB_FIELDS, ECS_FIELDS, THEORY_NOTE_OPTIONS, LAB_NOTE_OPTIONS } from "../lib/ratingConfig.js";
import { stripEmoji, containsDisallowed } from "../lib/reviewFilter.js";

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
  const [feedbackList, setFeedbackList] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
  const [expandedSections, setExpandedSections] = useState({
    theory: true,
    lab: false,
    ecs: false
  });
  const [editingReviewOnly, setEditingReviewOnly] = useState(false);

  const hasUser = Boolean(currentUser?.$id);
  const facultyName = faculty?.name || "Faculty";
  const sectionAverages = useMemo(
    () => ({
      theory: ratingSummary.sectionAverages?.theory ?? null,
      lab: ratingSummary.sectionAverages?.lab ?? null,
      ecs: ratingSummary.sectionAverages?.ecs ?? null
    }),
    [ratingSummary.sectionAverages]
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
      setFeedbackList(response.ratings || []);
      setRatingSummary(
        response.ratingSummary || { totalRatings: 0, overallAverage: null, sectionAverages: {}, averages: {} }
      );
      await loadCourseLookup((response.reviews || []).map((row) => row.courseId));

      if (hasUser) {
        const existing = await facultyFeedbackService.getUserFacultyFeedback(currentUser.$id, facultyId);
        if (existing) {
          setAlreadySubmitted(true);
          setIsEditing(false);
          
          // Determine which sections have ratings
          const hasTheoryRatings = existing.theoryTeaching || existing.theoryAttendance || 
                                    existing.theoryClass || existing.theoryCorrection;
          const hasLabRatings = existing.labClass || existing.labCorrection || existing.labAttendance;
          const hasEcsRatings = existing.ecsCapstoneSDP;
          
          setExpandedSections({
            theory: Boolean(hasTheoryRatings),
            lab: Boolean(hasLabRatings),
            ecs: Boolean(hasEcsRatings)
          });
          
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
    
    // If editing review only, skip rating validation
    if (!editingReviewOnly) {
      // Check if at least one section is expanded
      if (!expandedSections.theory && !expandedSections.lab && !expandedSections.ecs) {
        setError("Please rate at least one section (Theory, Lab, or ECS)");
        return;
      }
    }
    
    const reviewText = stripEmoji(feedbackForm.review).trim();
    if (reviewText) {
      const disallowed = containsDisallowed(reviewText);
      if (disallowed.blocked) {
        setError(`Review contains content that isn't allowed.`);
        return;
      }
    }
    try {
      setSaving(true);
      setError(null);
      
      // Build payload
      const payload = {
        userId: currentUser.$id,
        facultyId,
        courseId: feedbackForm.courseId,
      };
      
      // Only include review if not empty
      if (reviewText) {
        payload.review = reviewText;
      }
      
      // If editing review only, don't include ratings
      if (!editingReviewOnly) {
        // Include ratings only from expanded sections
        if (expandedSections.theory) {
          payload.theoryTeaching = feedbackForm.theoryTeaching;
          payload.theoryAttendance = feedbackForm.theoryAttendance;
          payload.theoryClass = feedbackForm.theoryClass;
          payload.theoryCorrection = feedbackForm.theoryCorrection;
          payload.theoryNotes = feedbackForm.theoryNotes;
        }
        
        if (expandedSections.lab) {
          payload.labClass = feedbackForm.labClass;
          payload.labCorrection = feedbackForm.labCorrection;
          payload.labAttendance = feedbackForm.labAttendance;
          payload.labNotes = feedbackForm.labNotes;
        }
        
        if (expandedSections.ecs) {
          payload.ecsCapstoneSDP = feedbackForm.ecsCapstoneSDP;
        }
      }
      
      await facultyFeedbackService.submitFeedback(payload);
      setAlreadySubmitted(true);
      setIsEditing(false);
      setEditingReviewOnly(false);
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
    try {
      setDeleting(true);
      setError(null);
      await facultyFeedbackService.deleteUserFacultyFeedback(currentUser.$id, facultyId);
      setAlreadySubmitted(false);
      setIsEditing(true);
      setShowFeedbackForm(false);
      setFeedbackForm(INITIAL_FEEDBACK_FORM);
      setCourseQuery("");
      setExpandedSections({
        theory: true,
        lab: false,
        ecs: false
      });
      setShowDeleteConfirm(false);
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

      {/* Main Layout: Left Side (Faculty Info) + Right Side (Ratings or Feedback Form) */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--bg-elev)] shadow-[var(--shadow-card)]">
          <FacultyProfileCard faculty={faculty} />
        </div>
        {!showFeedbackForm ? (
          <div className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--bg-elev)] shadow-[var(--shadow-card)]">
            <FacultyRatingsCard
              ratingSummary={ratingSummary}
              sectionAverages={sectionAverages}
              averages={ratingSummary.averages || {}}
              hasUser={hasUser}
              alreadySubmitted={alreadySubmitted}
              onShareFeedback={() => {
                setShowFeedbackForm(true);
                setIsEditing(true);
              }}
              onDeleteFeedback={() => setShowDeleteConfirm(true)}
              deleting={deleting}
            />
          </div>
        ) : hasUser && isEditing ? (
          <div className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--bg-elev)] p-4 sm:p-6 shadow-[var(--shadow-card)]">
            <form onSubmit={submitFeedback} className="space-y-4 sm:space-y-6">
              <div>
                <h2 className="mb-1 text-xl sm:text-2xl font-bold text-[var(--text)]">
                  {editingReviewOnly ? "Edit Your Review" : "Share Your Experience"}
                </h2>
                <p className="text-xs sm:text-sm text-[var(--muted)]">
                  {editingReviewOnly 
                    ? "Update your review text. Ratings will remain unchanged."
                    : `Help fellow students by rating your time with ${facultyName}`}
                </p>
              </div>

              {!editingReviewOnly && (
                <>
                  {/* Theory Section */}
                  <div className="rounded-xl border border-[var(--line)] overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSections((prev) => ({ ...prev, theory: !prev.theory }))
                  }
                  className="flex w-full items-center justify-between bg-[var(--panel)] px-4 py-3 transition-colors hover:bg-[var(--bg-elev)]"
                >
                  <span className="font-semibold text-[var(--text)]">Theory</span>
                  <span className="text-[var(--muted)] inline-flex items-center">
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className={`h-3 w-3 transition-transform duration-200 ease-in-out ${
                        expandedSections.theory ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </span>
                </button>
                {expandedSections.theory && (
                  <div className="bg-[var(--bg-elev)] p-3 sm:p-4 space-y-3 sm:space-y-4">
                    {THEORY_FIELDS.map((field) => (
                      <RatingSlider
                        key={field.key}
                        label={field.label}
                        value={feedbackForm[field.key] ?? 3}
                        onChange={(value) =>
                          setFeedbackForm((prev) => ({ ...prev, [field.key]: value }))
                        }
                        name={field.key}
                      />
                    ))}
                    <div>
                      <p className="mb-2 sm:mb-3 text-xs sm:text-sm font-semibold text-[var(--text)]">
                        Theory Notes Provided?
                      </p>
                      <div className="relative flex h-12 sm:h-14 items-center rounded-xl sm:rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-1.5 sm:px-2 py-0.5 sm:py-1">
                        <div
                          className="absolute h-8 sm:h-10 w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-1rem)/2)] rounded-lg sm:rounded-xl border-2 border-[var(--bg-elev)] bg-[var(--primary)] shadow-md transition-[left] duration-200 ease-out rating-slider-indicator"
                          style={{
                            '--slider-position': feedbackForm.theoryNotes ? 0.5 : 0
                          }}
                        />
                        <div className="relative z-[2] grid h-full flex-1 grid-cols-2 items-center gap-0">
                          {THEORY_NOTE_OPTIONS.map((label, idx) => (
                            <span
                              key={label}
                              className={`select-none text-center text-[10px] sm:text-xs font-semibold transition-opacity duration-150 ${
                                (feedbackForm.theoryNotes ? 1 : 0) === idx
                                  ? "opacity-100 text-[var(--text)]"
                                  : "opacity-50 text-[var(--muted)]"
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
                              theoryNotes: Number(e.target.value) === 1,
                            }))
                          }
                          className="absolute inset-0 z-[3] m-0 w-full cursor-pointer opacity-0"
                          aria-label="Theory notes provided"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Lab Section */}
              <div className="rounded-xl border border-[var(--line)] overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSections((prev) => ({ ...prev, lab: !prev.lab }))
                  }
                  className="flex w-full items-center justify-between bg-[var(--panel)] px-4 py-3 transition-colors hover:bg-[var(--bg-elev)]"
                >
                  <span className="font-semibold text-[var(--text)]">Lab</span>
                  <span className="text-[var(--muted)] inline-flex items-center">
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className={`h-3 w-3 transition-transform duration-200 ease-in-out ${
                        expandedSections.lab ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </span>
                </button>
                {expandedSections.lab && (
                  <div className="bg-[var(--bg-elev)] p-3 sm:p-4 space-y-3 sm:space-y-4">
                    {LAB_FIELDS.map((field) => (
                      <RatingSlider
                        key={field.key}
                        label={field.label}
                        value={feedbackForm[field.key] ?? 3}
                        onChange={(value) =>
                          setFeedbackForm((prev) => ({ ...prev, [field.key]: value }))
                        }
                        name={field.key}
                      />
                    ))}
                    <div>
                      <p className="mb-2 sm:mb-3 text-xs sm:text-sm font-semibold text-[var(--text)]">
                        Lab Materials Provided?
                      </p>
                      <div className="relative flex h-12 sm:h-14 items-center rounded-xl sm:rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-1.5 sm:px-2 py-0.5 sm:py-1">
                        <div
                          className="absolute h-8 sm:h-10 w-[calc((100%-0.75rem)/4)] sm:w-[calc((100%-1rem)/4)] rounded-lg sm:rounded-xl border-2 border-[var(--bg-elev)] bg-[var(--primary)] shadow-md transition-[left] duration-200 ease-out rating-slider-indicator"
                          style={{
                            '--slider-position': Math.max(
                              0,
                              LAB_NOTE_OPTIONS.findIndex(
                                (opt) => opt.value === feedbackForm.labNotes,
                              ),
                            ) / 4
                          }}
                        />
                        <div className="relative z-[2] grid h-full flex-1 grid-cols-4 items-center gap-0">
                          {LAB_NOTE_OPTIONS.map((opt, idx) => (
                            <span
                              key={opt.value}
                              className={`select-none text-center text-[10px] sm:text-xs font-semibold transition-opacity duration-150 ${
                                Math.max(
                                  0,
                                  LAB_NOTE_OPTIONS.findIndex(
                                    (item) => item.value === feedbackForm.labNotes,
                                  ),
                                ) === idx
                                  ? "opacity-100 text-[var(--text)]"
                                  : "opacity-50 text-[var(--muted)]"
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
                          value={Math.max(
                            0,
                            LAB_NOTE_OPTIONS.findIndex(
                              (opt) => opt.value === feedbackForm.labNotes,
                            ),
                          )}
                          onChange={(e) =>
                            setFeedbackForm((prev) => ({
                              ...prev,
                              labNotes:
                                LAB_NOTE_OPTIONS[Number(e.target.value)]?.value ||
                                "None",
                            }))
                          }
                          className="absolute inset-0 z-[3] m-0 w-full cursor-pointer opacity-0"
                          aria-label="Lab materials provided"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ECS Section */}
              <div className="rounded-xl border border-[var(--line)] overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSections((prev) => ({ ...prev, ecs: !prev.ecs }))
                  }
                  className="flex w-full items-center justify-between bg-[var(--panel)] px-4 py-3 transition-colors hover:bg-[var(--bg-elev)]"
                >
                  <span className="font-semibold text-[var(--text)]">
                    ECS / Capstone
                  </span>
                  <span className="text-[var(--muted)] inline-flex items-center">
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className={`h-3 w-3 transition-transform duration-200 ease-in-out ${
                        expandedSections.ecs ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </span>
                </button>
                {expandedSections.ecs && (
                  <div className="bg-[var(--bg-elev)] p-3 sm:p-4 space-y-3 sm:space-y-4">
                    {ECS_FIELDS.map((field) => (
                      <RatingSlider
                        key={field.key}
                        label={field.label}
                        value={feedbackForm[field.key] ?? 3}
                        onChange={(value) =>
                          setFeedbackForm((prev) => ({ ...prev, [field.key]: value }))
                        }
                        name={field.key}
                      />
                    ))}
                    </div>
                  )}
                </div>
                </>
              )}

              <div className="relative border-t border-[var(--line)] pt-4 sm:pt-6">
              <label className="mb-2 block text-xs sm:text-sm font-semibold text-[var(--text)]">Which Course?</label>
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
                className="w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm outline-none"
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
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs sm:text-sm font-semibold text-[var(--text)]">Your Review</label>
                <span className="text-[10px] sm:text-xs text-[var(--muted)]">
                  {feedbackForm.review.length}/500
                </span>
              </div>
              <textarea
                value={feedbackForm.review}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 500) {
                    setFeedbackForm((prev) => ({ ...prev, review: value }));
                  }
                }}
                rows={4}
                maxLength={500}
                placeholder={`Tell us about ${facultyName}: teaching style, grading fairness, and accessibility.`}
                className="w-full rounded-xl sm:rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[var(--text)] outline-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 border-t border-[var(--line)] pt-4 sm:pt-6">
              <button
                type="button"
                onClick={() => setShowFeedbackForm(false)}
                className="w-full sm:w-auto rounded-full border border-[var(--line)] px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-[var(--text)] hover:bg-[var(--panel)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto rounded-full bg-[var(--primary)] px-6 sm:px-8 py-2 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-lg disabled:opacity-60"
              >
                {saving ? "Saving..." : editingReviewOnly ? "Update Review" : "Save Feedback"}
              </button>
            </div>
          </form>
        </div>
        ) : null}
      </div>

      {/* What students say */}
      {!showFeedbackForm && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--bg-elev)] shadow-[var(--shadow-card)]">
          <FeedbackList
            feedbackList={feedbackList}
            courseLookup={courseLookup}
            maxItems={20}
            currentUser={currentUser}
            onDeleteFeedback={() => setShowDeleteConfirm(true)}
            onEditReviewOnly={(reviewData) => {
              setEditingReviewOnly(true);
              setShowFeedbackForm(true);
              setIsEditing(true);
              // Only set review text, keep existing ratings
              setFeedbackForm((prev) => ({
                ...prev,
                review: reviewData?.review || "",
                courseId: reviewData?.courseId || "",
              }));
              if (reviewData?.courseId && courseLookup[reviewData.courseId]) {
                const course = courseLookup[reviewData.courseId];
                setCourseQuery(`${course.courseCode} - ${course.courseName}`);
              }
            }}
            onEditReview={() => {
              setEditingReviewOnly(false);
              setShowFeedbackForm(true);
              setIsEditing(true);
            }}
            deleting={deleting}
          />
        </div>
      )}

      <ConfirmOverlay
        open={showDeleteConfirm}
        title="Delete your feedback"
        message="Are you sure you want to remove your feedback for this faculty? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => deleteFeedback()}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleting}
        danger
      />
    </div>
  );
}

export default FacultyDetailPage;
