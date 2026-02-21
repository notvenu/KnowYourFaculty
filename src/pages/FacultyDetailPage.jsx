﻿﻿// eslint-disable tailwindcss/no-custom-classname
// eslint-disable no-irregular-whitespace
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import publicFacultyService from "../services/publicFacultyService.js";
import facultyFeedbackService from "../services/facultyFeedbackService.js";
import courseService from "../services/courseService.js";
import { addToast } from "../store/uiSlice.js";
import { setShowLoginOverlay } from "../store/authSlice.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAngleLeft,
  faChevronDown,
  faShareAlt,
} from "@fortawesome/free-solid-svg-icons";
import FacultyProfileCard from "../components/faculty/FacultyProfileCard.jsx";
import FacultyRatingsCard from "../components/faculty/FacultyRatingsCard.jsx";
import FeedbackList from "../components/feedback/FeedbackList.jsx";
import RatingSlider from "../components/feedback/RatingSlider.jsx";
import ConfirmOverlay from "../components/overlays/ConfirmOverlay.jsx";
import {
  RATING_FIELDS,
  THEORY_FIELDS,
  LAB_FIELDS,
  ECS_FIELDS,
  THEORY_NOTE_OPTIONS,
  LAB_NOTE_OPTIONS,
  getTierFromRating,
} from "../lib/ratingConfig.js";
import { stripEmoji, containsDisallowed } from "../lib/reviewFilter.js";

const byPrefixAndName = {
  fas: {
    "angle-left": faAngleLeft,
  },
};

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
  ecsCapstoneSDPReview: 3,
  ecsCapstoneSDPCorrection: 3,
  labNotes: "None",
};

const INITIAL_EXPANDED_SECTIONS = {
  theory: false,
  lab: false,
  ecs: false,
};

function parseRatingInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) return 3;
  return n;
}

function FacultyDetailPage({ currentUser }) {
  const dispatch = useDispatch();
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
    averages: {},
  });
  const [feedbackForm, setFeedbackForm] = useState(INITIAL_FEEDBACK_FORM);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [courseQuery, setCourseQuery] = useState("");
  const [courseSuggestions, setCourseSuggestions] = useState([]);
  const [courseLookup, setCourseLookup] = useState({});
  const [expandedSections, setExpandedSections] = useState(
    INITIAL_EXPANDED_SECTIONS,
  );
  const [editingReviewOnly, setEditingReviewOnly] = useState(false);
  const [reviewOnlyMode, setReviewOnlyMode] = useState("edit");
  const [editingRatingsOnly, setEditingRatingsOnly] = useState(false);
  const [currentEditingReviewId, setCurrentEditingReviewId] = useState(null);
  const [deletingRatingsOnly, setDeletingRatingsOnly] = useState(false);
  const [deletingReviewOnly, setDeletingReviewOnly] = useState(false);
  const [ratingsTimeFilter, setRatingsTimeFilter] = useState("all");
  const [ratingsCourseFilter, setRatingsCourseFilter] = useState("");
  const [reviewsCourseFilter, setReviewsCourseFilter] = useState("");
  const [reviewsTimeFilter, setReviewsTimeFilter] = useState("all");
  const [reviewsRatingBandFilter, setReviewsRatingBandFilter] = useState("all");

  const ratingsCourseOptions = useMemo(
    () =>
      [
        ...new Set(
          feedbackList.filter((row) => row.courseId).map((row) => row.courseId),
        ),
      ].map((courseId) => ({
        value: courseId,
        label: courseLookup[courseId]?.courseCode || courseId,
      })),
    [feedbackList, courseLookup],
  );

  const hasUser = Boolean(currentUser?.$id);
  const facultyName = faculty?.name || "Faculty";
  const sectionAverages = useMemo(
    () => ({
      theory: ratingSummary.sectionAverages?.theory ?? null,
      lab: ratingSummary.sectionAverages?.lab ?? null,
      ecs: ratingSummary.sectionAverages?.ecs ?? null,
    }),
    [ratingSummary.sectionAverages],
  );

  const userFeedback = useMemo(
    () =>
      feedbackList.find(
        (row) =>
          String(row?.userId || "").trim() === String(currentUser?.$id || ""),
      ) || null,
    [feedbackList, currentUser?.$id],
  );

  const userHasReview = String(userFeedback?.review || "").trim().length > 0;

  // Compute filtered ratings for ratings card based on active filters
  const filteredRatingSummary = useMemo(() => {
    let filtered = feedbackList;

    // Apply time filter
    if (ratingsTimeFilter !== "all") {
      const now = new Date();
      const cutoffTime = new Date();

      if (ratingsTimeFilter === "1week") {
        cutoffTime.setDate(now.getDate() - 7);
      } else if (ratingsTimeFilter === "1month") {
        cutoffTime.setMonth(now.getMonth() - 1);
      }

      filtered = filtered.filter((row) => {
        const createdDate = row.$createdAt ? new Date(row.$createdAt) : null;
        return createdDate && createdDate >= cutoffTime;
      });
    }

    // Apply course filter
    if (ratingsCourseFilter && ratingsCourseFilter !== "") {
      filtered = filtered.filter((row) => row.courseId === ratingsCourseFilter);
    }

    // Build summary for filtered ratings
    const totals = {};
    const counts = {};

    for (const field of RATING_FIELDS) {
      totals[field.key] = 0;
      counts[field.key] = 0;
    }

    // For notes calculation
    let theoryNotesCount = 0;
    let totalTheoryNotes = 0;
    const labNotesCounts = {
      Soft: 0,
      Hard: 0,
      Both: 0,
      None: 0,
    };
    let totalLabNotes = 0;

    for (const row of filtered || []) {
      for (const field of RATING_FIELDS) {
        const value = Number(row?.[field.key]);
        if (!Number.isFinite(value) || value < 1 || value > 5) continue;
        totals[field.key] += value;
        counts[field.key] += 1;
      }

      // Count theory notes (majority-based: >= 50%)
      if (row.theoryNotes === true || row.theoryNotes === 1) {
        theoryNotesCount++;
      }
      totalTheoryNotes++;

      // Count lab notes
      if (row.labNotes && typeof row.labNotes === "string") {
        const noteType = row.labNotes.trim();
        if (labNotesCounts.hasOwnProperty(noteType)) {
          labNotesCounts[noteType]++;
        }
        totalLabNotes++;
      }
    }

    const averages = {};
    let weightedTotal = 0;
    let weightedCount = 0;

    for (const field of RATING_FIELDS) {
      const count = counts[field.key];
      averages[field.key] =
        count > 0 ? Number((totals[field.key] / count).toFixed(2)) : null;
      if (count > 0) {
        weightedTotal += totals[field.key];
        weightedCount += count;
      }
    }

    const sectionAverages = {};
    const sectionFields = {
      theory: [
        "theoryTeaching",
        "theoryAttendance",
        "theoryClass",
        "theoryCorrection",
      ],
      lab: ["labClass", "labCorrection", "labAttendance"],
      ecs: ["ecsCapstoneSDPReview", "ecsCapstoneSDPCorrection"],
    };

    for (const [sectionKey, fieldNames] of Object.entries(sectionFields)) {
      let sectionTotal = 0;
      let sectionCount = 0;
      for (const fieldName of fieldNames) {
        sectionTotal += totals[fieldName] || 0;
        sectionCount += counts[fieldName] || 0;
      }
      sectionAverages[sectionKey] =
        sectionCount > 0
          ? Number((sectionTotal / sectionCount).toFixed(2))
          : null;
    }

    // Calculate notes summary with majority-based logic (>=50%)
    const notesSummary = {};

    // Theory notes: show if >= 50% voted yes
    if (totalTheoryNotes > 0) {
      const percentage = Math.round(
        (theoryNotesCount / totalTheoryNotes) * 100,
      );
      if (percentage >= 50) {
        notesSummary.theoryNotes = {
          count: theoryNotesCount,
          total: totalTheoryNotes,
          percentage,
        };
      }
    }

    // Lab notes: show each type that has >= 50% (excluding "None")
    if (totalLabNotes > 0) {
      const labNotesData = {};
      for (const [noteType, count] of Object.entries(labNotesCounts)) {
        if (noteType !== "None" && count > 0) {
          const percentage = Math.round((count / totalLabNotes) * 100);
          if (percentage >= 50) {
            labNotesData[noteType] = {
              count,
              total: totalLabNotes,
              percentage,
            };
          }
        }
      }
      if (Object.keys(labNotesData).length > 0) {
        notesSummary.labNotes = labNotesData;
      }
    }

    return {
      totalRatings: filtered?.length || 0,
      overallAverage:
        weightedCount > 0
          ? Number((weightedTotal / weightedCount).toFixed(2))
          : null,
      sectionAverages,
      averages,
      notesSummary: Object.keys(notesSummary).length > 0 ? notesSummary : null,
    };
  }, [feedbackList, ratingsTimeFilter, ratingsCourseFilter]);

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
    const uniqueIds = [
      ...new Set(
        courseIds.map((id) => String(id || "").trim()).filter(Boolean),
      ),
    ];
    if (uniqueIds.length === 0) return;
    const entries = await Promise.all(
      uniqueIds.map(async (courseId) => {
        const course = await courseService.getCourseById(courseId);
        return [courseId, course];
      }),
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
      const response =
        await facultyFeedbackService.getFacultyFeedback(facultyId);
      setReviews(response.reviews || []);
      setFeedbackList(response.ratings || []);
      setRatingSummary(
        response.ratingSummary || {
          totalRatings: 0,
          overallAverage: null,
          sectionAverages: {},
          averages: {},
        },
      );
      await loadCourseLookup(
        (response.reviews || []).map((row) => row.courseId),
      );

      if (hasUser) {
        const existing = (response.ratings || []).find(
          (row) =>
            String(row?.userId || "").trim() ===
            String(currentUser?.$id || "").trim(),
        );
        if (existing) {
          setAlreadySubmitted(true);
          setIsEditing(false);

          // Determine which sections have ratings
          const hasTheoryRatings =
            existing.theoryTeaching ||
            existing.theoryAttendance ||
            existing.theoryClass ||
            existing.theoryCorrection;
          const hasLabRatings =
            existing.labClass ||
            existing.labCorrection ||
            existing.labAttendance;
          const hasEcsRatings =
            existing.ecsCapstoneSDPReview || existing.ecsCapstoneSDPCorrection;

          setExpandedSections({
            theory: Boolean(hasTheoryRatings),
            lab: Boolean(hasLabRatings),
            ecs: Boolean(hasEcsRatings),
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
            ecsCapstoneSDPReview: parseRatingInput(
              existing.ecsCapstoneSDPReview,
            ),
            ecsCapstoneSDPCorrection: parseRatingInput(
              existing.ecsCapstoneSDPCorrection,
            ),
            labNotes: existing.labNotes || "None",
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
          setExpandedSections(INITIAL_EXPANDED_SECTIONS);
          setCourseQuery("");
        }
      } else {
        setAlreadySubmitted(false);
        setIsEditing(false);
        setShowFeedbackForm(false);
        setExpandedSections(INITIAL_EXPANDED_SECTIONS);
        setCourseQuery("");
      }
    } catch (loadError) {
      const code = Number(loadError?.code || 0);
      const unauthorized =
        code === 401 ||
        String(loadError?.message || "")
          .toLowerCase()
          .includes("not authorized");
      if (!unauthorized || hasUser) {
        setError(loadError?.message || "Failed to load feedback");
      }
    }
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!hasUser) return;

    // Check if at least one section is expanded
    if (
      !expandedSections.theory &&
      !expandedSections.lab &&
      !expandedSections.ecs
    ) {
      setError("Please rate at least one section (Theory, Lab, or ECS)");
      return;
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

      // Build payload with only expanded sections
      const payload = {
        userId: currentUser.$id,
        facultyId,
        courseId: feedbackForm.courseId,
      };

      // Only include review if not empty
      if (reviewText) {
        payload.review = reviewText;
      }

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
        payload.ecsCapstoneSDPReview = feedbackForm.ecsCapstoneSDPReview;
        payload.ecsCapstoneSDPCorrection =
          feedbackForm.ecsCapstoneSDPCorrection;
      }

      await facultyFeedbackService.submitFeedback(payload);
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

  const deleteReviewOnly = async (reviewId) => {
    if (!hasUser) return;
    try {
      setDeleting(true);
      setError(null);
      const existingFeedback =
        await facultyFeedbackService.getUserFacultyFeedback(
          currentUser.$id,
          facultyId,
        );
      if (existingFeedback) {
        await facultyFeedbackService.submitFeedback({
          ...existingFeedback,
          userId: currentUser.$id,
          facultyId,
          review: "",
        });
      }
      setShowDeleteConfirm(false);
      setEditingReviewOnly(false);
      setCurrentEditingReviewId(null);
      setShowFeedbackForm(false);
      await loadFeedback();
    } catch (deleteError) {
      setError(deleteError?.message || "Failed to delete review");
    } finally {
      setDeleting(false);
    }
  };

  const editReviewOnly = async (reviewId) => {
    if (!hasUser) return;
    try {
      const existingFeedback =
        await facultyFeedbackService.getUserFacultyFeedback(
          currentUser.$id,
          facultyId,
        );
      if (existingFeedback) {
        setCurrentEditingReviewId(reviewId);
        setEditingReviewOnly(true);
        setReviewOnlyMode(
          String(existingFeedback.review || "").trim() ? "edit" : "add",
        );
        setFeedbackForm((prev) => ({
          ...prev,
          review: existingFeedback.review || "",
        }));
      }
    } catch (error) {
      setError(error?.message || "Failed to load review");
    }
  };

  const submitReviewOnly = async (event) => {
    event.preventDefault();
    if (!hasUser || !currentEditingReviewId) return;

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

      const existingFeedback =
        await facultyFeedbackService.getUserFacultyFeedback(
          currentUser.$id,
          facultyId,
        );
      if (existingFeedback) {
        const isFirstReviewAdd =
          !String(existingFeedback.review || "").trim() &&
          String(reviewText || "").trim().length > 0;

        if (isFirstReviewAdd) {
          await facultyFeedbackService.deleteUserFacultyFeedback(
            currentUser.$id,
            facultyId,
          );
        }

        await facultyFeedbackService.submitFeedback({
          ...existingFeedback,
          userId: currentUser.$id,
          facultyId,
          review: reviewText,
        });
      }

      setEditingReviewOnly(false);
      setReviewOnlyMode("edit");
      setCurrentEditingReviewId(null);
      setShowFeedbackForm(false);
      await loadFeedback();
    } catch (submitError) {
      setError(submitError?.message || "Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  const editRatingsOnly = async (reviewId) => {
    if (!hasUser) return;
    try {
      const existingFeedback =
        await facultyFeedbackService.getUserFacultyFeedback(
          currentUser.$id,
          facultyId,
        );
      if (existingFeedback) {
        const hasTheoryRatings =
          existingFeedback.theoryTeaching ||
          existingFeedback.theoryAttendance ||
          existingFeedback.theoryClass ||
          existingFeedback.theoryCorrection;
        const hasLabRatings =
          existingFeedback.labClass ||
          existingFeedback.labCorrection ||
          existingFeedback.labAttendance;
        const hasEcsRatings =
          existingFeedback.ecsCapstoneSDPReview ||
          existingFeedback.ecsCapstoneSDPCorrection;

        setCurrentEditingReviewId(reviewId);
        setEditingRatingsOnly(true);
        setExpandedSections({
          theory: Boolean(hasTheoryRatings),
          lab: Boolean(hasLabRatings),
          ecs: Boolean(hasEcsRatings),
        });
        setFeedbackForm({
          courseId: existingFeedback.courseId || "",
          review: existingFeedback.review || "",
          theoryNotes: existingFeedback.theoryNotes ?? false,
          theoryTeaching: parseRatingInput(existingFeedback.theoryTeaching),
          theoryAttendance: parseRatingInput(existingFeedback.theoryAttendance),
          theoryClass: parseRatingInput(existingFeedback.theoryClass),
          theoryCorrection: parseRatingInput(existingFeedback.theoryCorrection),
          labClass: parseRatingInput(existingFeedback.labClass),
          labCorrection: parseRatingInput(existingFeedback.labCorrection),
          labAttendance: parseRatingInput(existingFeedback.labAttendance),
          ecsCapstoneSDPReview: parseRatingInput(
            existingFeedback.ecsCapstoneSDPReview,
          ),
          ecsCapstoneSDPCorrection: parseRatingInput(
            existingFeedback.ecsCapstoneSDPCorrection,
          ),
          labNotes: existingFeedback.labNotes || "None",
        });
        const course = await courseService.getCourseById(
          existingFeedback.courseId,
        );
        if (course) {
          setCourseQuery(course.courseCode);
        }
      }
    } catch (error) {
      setError(error?.message || "Failed to load ratings");
    }
  };

  const submitRatingsOnly = async (event) => {
    event.preventDefault();
    if (!hasUser || !currentEditingReviewId) return;

    try {
      setSaving(true);
      setError(null);

      const existingFeedback =
        await facultyFeedbackService.getUserFacultyFeedback(
          currentUser.$id,
          facultyId,
        );
      if (existingFeedback) {
        const payload = {
          userId: currentUser.$id,
          facultyId,
          courseId: feedbackForm.courseId,
        };

        if (expandedSections.theory) {
          payload.theoryNotes = feedbackForm.theoryNotes;
          payload.theoryTeaching = feedbackForm.theoryTeaching;
          payload.theoryAttendance = feedbackForm.theoryAttendance;
          payload.theoryClass = feedbackForm.theoryClass;
          payload.theoryCorrection = feedbackForm.theoryCorrection;
        }

        if (expandedSections.lab) {
          payload.labClass = feedbackForm.labClass;
          payload.labCorrection = feedbackForm.labCorrection;
          payload.labAttendance = feedbackForm.labAttendance;
          payload.labNotes = feedbackForm.labNotes;
        }

        if (expandedSections.ecs) {
          payload.ecsCapstoneSDPReview = feedbackForm.ecsCapstoneSDPReview;
          payload.ecsCapstoneSDPCorrection =
            feedbackForm.ecsCapstoneSDPCorrection;
        }

        await facultyFeedbackService.submitFeedback(payload);
      }

      setEditingRatingsOnly(false);
      setCurrentEditingReviewId(null);
      setShowFeedbackForm(false);
      await loadFeedback();
    } catch (submitError) {
      setError(submitError?.message || "Failed to save ratings");
    } finally {
      setSaving(false);
    }
  };

  const deleteRatingsOnly = async () => {
    if (!hasUser) return;
    try {
      setDeleting(true);
      setError(null);
      const existingFeedback =
        await facultyFeedbackService.getUserFacultyFeedback(
          currentUser.$id,
          facultyId,
        );

      if (existingFeedback) {
        // Delete the entire feedback row (ratings + review)
        await facultyFeedbackService.deleteUserFacultyFeedback(
          currentUser.$id,
          facultyId,
        );
      }
      setShowDeleteConfirm(false);
      setShowFeedbackForm(false);
      setIsEditing(false);
      await loadFeedback();
    } catch (deleteError) {
      setError(deleteError?.message || "Failed to delete ratings");
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

  const handleShareFacultyPage = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const sharePayload = {
      title: `${facultyName} | KnowYourFaculty`,
      text: `Check ratings and student reviews for ${facultyName}.`,
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
        addToast({ message: "Faculty page link shared", type: "success" }),
      );
    } catch (shareError) {
      if (shareError?.name === "AbortError") return;
      dispatch(
        addToast({
          message: shareError?.message || "Unable to share this page",
          type: "error",
        }),
      );
    }
  };

  const handleShareFeedbackClick = () => {
    if (!hasUser) {
      dispatch(setShowLoginOverlay(true));
      dispatch(
        addToast({
          message: "Please sign in to share feedback.",
          type: "info",
        }),
      );
      return;
    }

    setShowFeedbackForm(true);
    setIsEditing(true);
    setEditingReviewOnly(false);
    setEditingRatingsOnly(false);
    setCurrentEditingReviewId(null);
    setExpandedSections(INITIAL_EXPANDED_SECTIONS);
    setFeedbackForm(INITIAL_FEEDBACK_FORM);
    setCourseQuery("");
  };

  if (loading)
    return <p className="text-sm text-(--muted)">Loading faculty profile...</p>;
  if (!faculty)
    return (
      <p className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
        {error || "Faculty not found."}
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/faculty"
          className="inline-flex items-center gap-1 text-xs text-(--muted) hover:text-(--text)"
        >
          <FontAwesomeIcon icon={byPrefixAndName.fas["angle-left"]} />
          <span>Back to Faculty Search</span>
        </Link>
        <button
          type="button"
          onClick={handleShareFacultyPage}
          className="inline-flex items-center gap-2 rounded-lg border border-(--line) bg-(--panel) px-3 py-2 text-xs font-semibold text-(--text) hover:bg-(--bg-elev)"
        >
          <FontAwesomeIcon icon={faShareAlt} />
          Share Page
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">
          {error}
        </p>
      ) : null}

      {/* Main Layout: Fixed Grid Layout */}
      <div className="mb-3 lg:hidden">
        <FacultyProfileCard faculty={faculty} />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="order-2 space-y-3 lg:order-1">
          <div className="hidden lg:block">
            <FacultyProfileCard faculty={faculty} />
          </div>

          {/* What students say */}
          {!showFeedbackForm &&
            feedbackList.some(
              (row) => String(row.review || "").trim().length > 0,
            ) && (
              <FeedbackList
                feedbackList={feedbackList}
                courseLookup={courseLookup}
                maxItems={20}
                hasUser={hasUser}
                currentUser={currentUser}
                courseFilter={reviewsCourseFilter}
                setCourseFilter={setReviewsCourseFilter}
                timeFilter={reviewsTimeFilter}
                setTimeFilter={setReviewsTimeFilter}
                ratingFilter={reviewsRatingBandFilter}
                setRatingFilter={setReviewsRatingBandFilter}
                onDeleteReview={(reviewId) => {
                  setCurrentEditingReviewId(reviewId);
                  setShowDeleteConfirm(true);
                  setDeletingReviewOnly(true);
                  setDeletingRatingsOnly(false);
                }}
                onEditReview={(reviewId) => {
                  editReviewOnly(reviewId);
                  setShowFeedbackForm(true);
                }}
                deleting={deleting}
              />
            )}
        </div>

        <div className="order-1 lg:order-2">
          {!showFeedbackForm ? (
            <div className="mb-0 lg:mb-8">
              <FacultyRatingsCard
                ratingSummary={filteredRatingSummary}
                sectionAverages={{
                  theory: filteredRatingSummary.sectionAverages?.theory ?? null,
                  lab: filteredRatingSummary.sectionAverages?.lab ?? null,
                  ecs: filteredRatingSummary.sectionAverages?.ecs ?? null,
                }}
                averages={filteredRatingSummary.averages || {}}
                notesSummary={filteredRatingSummary.notesSummary || null}
                timeFilter={ratingsTimeFilter}
                setTimeFilter={setRatingsTimeFilter}
                courseFilter={ratingsCourseFilter}
                setCourseFilter={setRatingsCourseFilter}
                courseOptions={ratingsCourseOptions}
                hasUser={hasUser}
                alreadySubmitted={alreadySubmitted}
                canAddReview={Boolean(
                  hasUser && alreadySubmitted && !userHasReview,
                )}
                onAddReview={() => {
                  if (userFeedback?.$id) {
                    editReviewOnly(userFeedback.$id);
                    setShowFeedbackForm(true);
                  }
                }}
                onShareFeedback={handleShareFeedbackClick}
                onEditRating={() => {
                  if (userFeedback?.$id) {
                    editRatingsOnly(userFeedback.$id);
                    setShowFeedbackForm(true);
                  }
                }}
                onDeleteRating={() => {
                  setShowDeleteConfirm(true);
                  setDeletingRatingsOnly(true);
                  setEditingReviewOnly(false);
                }}
                deleting={deleting}
              />
            </div>
          ) : null}
          {showFeedbackForm && editingReviewOnly && hasUser ? (
            <div className="mb-8 rounded-xl border border-(--line) bg-(--bg-elev) p-4 shadow-lg sm:p-5 md:p-6">
              <form onSubmit={submitReviewOnly} className="space-y-6">
                <div className="border-b-2 border-(--line) pb-3">
                  <h2 className="mb-1 text-2xl font-bold text-(--text)">
                    {reviewOnlyMode === "add"
                      ? "Add Review"
                      : "Edit Your Review"}
                  </h2>
                  <p className="text-sm text-(--muted)">
                    {reviewOnlyMode === "add"
                      ? `Share your feedback for ${facultyName}`
                      : `Update your feedback for ${facultyName}`}
                  </p>
                  <div className="mt-2 rounded-lg border border-(--line) bg-(--panel) px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-(--text)">
                      Note
                    </p>
                    <p className="mt-1 text-xs text-(--muted)">
                      Ratings are optional. Share only the sections
                      (Theory/Lab/ECS) you have actually experienced.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-semibold text-(--text)">
                      Your Review
                    </label>
                    <span className="text-xs text-(--muted)">
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
                    className="w-full rounded-2xl border border-(--line) bg-(--panel) px-4 py-3 text-sm text-(--text) outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-(--line) pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingReviewOnly(false);
                      setReviewOnlyMode("edit");
                      setCurrentEditingReviewId(null);
                      setShowFeedbackForm(false);
                    }}
                    className="rounded-full border border-(--line) px-6 py-3 text-sm font-semibold text-(--text) hover:bg-(--panel)"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-full bg-(--primary) px-8 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                  >
                    {saving
                      ? "Saving..."
                      : reviewOnlyMode === "add"
                        ? "Add Review"
                        : "Save Review"}
                  </button>
                </div>
              </form>
            </div>
          ) : editingRatingsOnly && hasUser ? (
            <div className="mb-8 rounded-xl border border-(--line) bg-(--bg-elev) p-4 shadow-lg sm:p-5 md:p-6">
              <form onSubmit={submitRatingsOnly} className="space-y-6">
                <div className="border-b-2 border-(--line) pb-3">
                  <h2 className="mb-1 text-2xl font-bold text-(--text)">
                    Edit Your Ratings
                  </h2>
                  <p className="text-sm text-(--muted)">
                    Update your ratings for {facultyName}
                  </p>
                  <div className="mt-2 rounded-lg border border-(--line) bg-(--panel) px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-(--text)">
                      Note
                    </p>
                    <p className="mt-1 text-xs text-(--muted)">
                      Ratings are optional. Share only the sections
                      (Theory/Lab/ECS) you have actually experienced.
                    </p>
                  </div>
                </div>

                {/* Theory Section */}
                <div className="rounded-xl border border-(--line) overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        theory: !prev.theory,
                      }))
                    }
                    className="flex w-full items-center justify-between bg-(--panel) px-4 py-3 transition-colors hover:bg-(--bg-elev)"
                  >
                    <span className="font-semibold text-(--text)">Theory</span>
                    <span className="text-(--muted)">
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className={`h-3 w-3 transition-transform duration-200 ${
                          expandedSections.theory ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </span>
                  </button>
                  {expandedSections.theory && (
                    <div className="bg-(--bg-elev) p-4 space-y-4">
                      {THEORY_FIELDS.map((field) => (
                        <RatingSlider
                          key={field.key}
                          label={field.label}
                          value={feedbackForm[field.key] ?? 3}
                          onChange={(value) =>
                            setFeedbackForm((prev) => ({
                              ...prev,
                              [field.key]: value,
                            }))
                          }
                          name={field.key}
                        />
                      ))}
                      <div>
                        <p className="mb-3 text-sm font-semibold text-(--text)">
                          Theory Notes Required?
                        </p>
                        <div className="relative flex h-14 items-center rounded-2xl border border-(--line) bg-(--panel) px-2 py-1">
                          <div
                            className="absolute h-10 rounded-xl border-2 border-(--bg-elev) bg-(--primary) shadow-md transition-[left] duration-200 ease-out"
                            style={{
                              width: "calc((100% - 1rem) / 2)",
                              left: `calc(0.5rem + (100% - 1rem) * ${
                                feedbackForm.theoryNotes ? 0.5 : 0
                              })`,
                            }}
                          />
                          <div className="relative z-2 grid h-full flex-1 grid-cols-2 items-center gap-0">
                            {THEORY_NOTE_OPTIONS.map((label, idx) => (
                              <span
                                key={label}
                                className={`select-none text-center text-xs font-semibold transition-all duration-150 ${
                                  (feedbackForm.theoryNotes ? 1 : 0) === idx
                                    ? "opacity-100 text-(--text)"
                                    : "opacity-50 text-(--muted)"
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
                            className="absolute inset-0 z-3 m-0 w-full cursor-pointer opacity-0"
                            aria-label="Theory notes required"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lab Section */}
                <div className="rounded-xl border border-(--line) overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        lab: !prev.lab,
                      }))
                    }
                    className="flex w-full items-center justify-between bg-(--panel) px-4 py-3 transition-colors hover:bg-(--bg-elev)"
                  >
                    <span className="font-semibold text-(--text)">Lab</span>
                    <span className="text-(--muted)">
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className={`h-3 w-3 transition-transform duration-200 ${
                          expandedSections.lab ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </span>
                  </button>
                  {expandedSections.lab && (
                    <div className="bg-(--bg-elev) p-4 space-y-4">
                      {LAB_FIELDS.map((field) => (
                        <RatingSlider
                          key={field.key}
                          label={field.label}
                          value={feedbackForm[field.key] ?? 3}
                          onChange={(value) =>
                            setFeedbackForm((prev) => ({
                              ...prev,
                              [field.key]: value,
                            }))
                          }
                          name={field.key}
                        />
                      ))}
                      <div>
                        <p className="mb-3 text-sm font-semibold text-(--text)">
                          Lab Obervation/Notes Type?
                        </p>
                        <div className="relative flex h-14 items-center rounded-2xl border border-(--line) bg-(--panel) px-2 py-1">
                          <div
                            className="absolute h-10 rounded-xl border-2 border-(--bg-elev) bg-(--primary) shadow-md transition-[left] duration-200 ease-out"
                            style={{
                              width: "calc((100% - 1rem) / 4)",
                              left: `calc(0.5rem + (100% - 1rem) * ${
                                Math.max(
                                  0,
                                  LAB_NOTE_OPTIONS.findIndex(
                                    (opt) =>
                                      opt.value === feedbackForm.labNotes,
                                  ),
                                ) / 4
                              })`,
                            }}
                          />
                          <div className="relative z-2 grid h-full flex-1 grid-cols-4 items-center gap-0">
                            {LAB_NOTE_OPTIONS.map((opt, idx) => (
                              <span
                                key={opt.value}
                                className={`select-none text-center text-xs font-semibold transition-all duration-150 ${
                                  Math.max(
                                    0,
                                    LAB_NOTE_OPTIONS.findIndex(
                                      (item) =>
                                        item.value === feedbackForm.labNotes,
                                    ),
                                  ) === idx
                                    ? "opacity-100 text-(--text)"
                                    : "opacity-50 text-(--muted)"
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
                                  LAB_NOTE_OPTIONS[Number(e.target.value)]
                                    ?.value || "None",
                              }))
                            }
                            className="absolute inset-0 z-3 m-0 w-full cursor-pointer opacity-0"
                            aria-label="Lab Observation/Notes Type"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ECS Section */}
                <div className="rounded-xl border border-(--line) overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        ecs: !prev.ecs,
                      }))
                    }
                    className="flex w-full items-center justify-between bg-(--panel) px-4 py-3 transition-colors hover:bg-(--bg-elev)"
                  >
                    <span className="font-semibold text-(--text)">
                      ECS / Capstone
                    </span>
                    <span className="text-(--muted)">
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className={`h-3 w-3 transition-transform duration-200 ${
                          expandedSections.ecs ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </span>
                  </button>
                  {expandedSections.ecs && (
                    <div className="bg-(--bg-elev) p-4 space-y-4">
                      {ECS_FIELDS.map((field) => (
                        <RatingSlider
                          key={field.key}
                          label={field.label}
                          value={feedbackForm[field.key] ?? 3}
                          onChange={(value) =>
                            setFeedbackForm((prev) => ({
                              ...prev,
                              [field.key]: value,
                            }))
                          }
                          name={field.key}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative border-t border-(--line) pt-6">
                  <label className="mb-2 block text-sm font-semibold text-(--text)">
                    Which Course? (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Type to search and select a course (optional)..."
                    value={courseQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCourseQuery(value);
                      setFeedbackForm((prev) => ({ ...prev, courseId: "" }));
                    }}
                    className="w-full rounded-full border border-(--line) bg-(--panel) px-4 py-3 pr-10 text-sm outline-none"
                  />
                  {String(courseQuery || "").trim() || feedbackForm.courseId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCourseQuery("");
                        setFeedbackForm((prev) => ({ ...prev, courseId: "" }));
                        setCourseSuggestions([]);
                      }}
                      className="absolute right-2 top-15 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-(--muted) hover:text-(--text)"
                      aria-label="Clear course search"
                    >
                      ×
                    </button>
                  ) : null}
                  {courseSuggestions.length > 0 ? (
                    <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-2xl border border-(--line) bg-(--bg) shadow-lg">
                      {courseSuggestions.map((course) => (
                        <button
                          key={course.$id}
                          type="button"
                          onClick={() => selectCourse(course)}
                          className="block w-full border-b border-(--line) px-4 py-2 text-left text-xs hover:bg-(--panel) last:border-b-0"
                        >
                          {course.courseCode} - {course.courseName}
                        </button>
                      ))}
                    </div>
                  ) : courseQuery.trim() && !feedbackForm.courseId ? (
                    <div className="absolute z-10 mt-1 w-full rounded-2xl border border-(--line) bg-(--bg) p-3 shadow-lg">
                      <p className="text-xs text-(--muted)">
                        No courses found. Keep typing to search...
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end gap-3 border-t border-(--line) pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRatingsOnly(false);
                      setCurrentEditingReviewId(null);
                      setShowFeedbackForm(false);
                    }}
                    className="rounded-full border border-(--line) px-6 py-3 text-sm font-semibold text-(--text) hover:bg-(--panel)"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-full bg-(--primary) px-8 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Ratings"}
                  </button>
                </div>
              </form>
            </div>
          ) : hasUser && isEditing && showFeedbackForm ? (
            <div className="mb-8 rounded-xl border border-(--line) bg-(--bg-elev) p-4 shadow-lg sm:p-5 md:p-6">
              <form onSubmit={submitFeedback} className="space-y-6">
                <div className="border-b-2 border-(--line) pb-3">
                  <h2 className="mb-1 text-2xl font-bold text-(--text)">
                    Share Your Experience
                  </h2>
                  <p className="text-sm text-(--muted)">
                    Help fellow students by rating your time with {facultyName}
                  </p>
                  <div className="mt-2 rounded-lg border border-(--line) bg-(--panel) px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-(--text)">
                      Note
                    </p>
                    <p className="mt-1 text-xs text-(--muted)">
                      Ratings are optional. Share only the sections
                      (Theory/Lab/ECS) you have actually experienced.
                    </p>
                  </div>
                </div>

                {/* Theory Section */}
                <div className="rounded-xl border border-(--line) overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        theory: !prev.theory,
                      }))
                    }
                    className="flex w-full items-center justify-between bg-(--panel) px-4 py-3 transition-colors hover:bg-(--bg-elev)"
                  >
                    <span className="font-semibold text-(--text)">Theory</span>
                    <span className="text-(--muted)">
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className={`h-3 w-3 transition-transform duration-200 ${
                          expandedSections.theory ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </span>
                  </button>
                  {expandedSections.theory && (
                    <div className="bg-(--bg-elev) p-4 space-y-4">
                      {THEORY_FIELDS.map((field) => (
                        <RatingSlider
                          key={field.key}
                          label={field.label}
                          value={feedbackForm[field.key] ?? 3}
                          onChange={(value) =>
                            setFeedbackForm((prev) => ({
                              ...prev,
                              [field.key]: value,
                            }))
                          }
                          name={field.key}
                        />
                      ))}
                      <div>
                        <p className="mb-3 text-sm font-semibold text-(--text)">
                          Theory Notes Provided?
                        </p>
                        <div className="relative flex h-14 items-center rounded-2xl border border-(--line) bg-(--panel) px-2 py-1">
                          <div
                            className="absolute h-10 rounded-xl border-2 border-(--bg-elev) bg-(--primary) shadow-md transition-[left] duration-200 ease-out"
                            style={{
                              width: "calc((100% - 1rem) / 2)",
                              left: `calc(0.5rem + (100% - 1rem) * ${
                                feedbackForm.theoryNotes ? 0.5 : 0
                              })`,
                            }}
                          />
                          <div className="relative z-2 grid h-full flex-1 grid-cols-2 items-center gap-0">
                            {THEORY_NOTE_OPTIONS.map((label, idx) => (
                              <span
                                key={label}
                                className={`select-none text-center text-xs font-semibold transition-all duration-150 ${
                                  (feedbackForm.theoryNotes ? 1 : 0) === idx
                                    ? "opacity-100 text-(--text)"
                                    : "opacity-50 text-(--muted)"
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
                            className="absolute inset-0 z-3 m-0 w-full cursor-pointer opacity-0"
                            aria-label="Theory notes provided"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lab Section */}
                <div className="rounded-xl border border-(--line) overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        lab: !prev.lab,
                      }))
                    }
                    className="flex w-full items-center justify-between bg-(--panel) px-4 py-3 transition-colors hover:bg-(--bg-elev)"
                  >
                    <span className="font-semibold text-(--text)">Lab</span>
                    <span className="text-(--muted)">
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className={`h-3 w-3 transition-transform duration-200 ${
                          expandedSections.lab ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </span>
                  </button>
                  {expandedSections.lab && (
                    <div className="bg-(--bg-elev) p-4 space-y-4">
                      {LAB_FIELDS.map((field) => (
                        <RatingSlider
                          key={field.key}
                          label={field.label}
                          value={feedbackForm[field.key] ?? 3}
                          onChange={(value) =>
                            setFeedbackForm((prev) => ({
                              ...prev,
                              [field.key]: value,
                            }))
                          }
                          name={field.key}
                        />
                      ))}
                      <div>
                        <p className="mb-3 text-sm font-semibold text-(--text)">
                          Lab Observation/Notes Type?
                        </p>
                        <div className="relative flex h-14 items-center rounded-2xl border border-(--line) bg-(--panel) px-2 py-1">
                          <div
                            className="absolute h-10 rounded-xl border-2 border-(--bg-elev) bg-(--primary) shadow-md transition-[left] duration-200 ease-out"
                            style={{
                              width: "calc((100% - 1rem) / 4)",
                              left: `calc(0.5rem + (100% - 1rem) * ${
                                Math.max(
                                  0,
                                  LAB_NOTE_OPTIONS.findIndex(
                                    (opt) =>
                                      opt.value === feedbackForm.labNotes,
                                  ),
                                ) / 4
                              })`,
                            }}
                          />
                          <div className="relative z-2 grid h-full flex-1 grid-cols-4 items-center gap-0">
                            {LAB_NOTE_OPTIONS.map((opt, idx) => (
                              <span
                                key={opt.value}
                                className={`select-none text-center text-xs font-semibold transition-all duration-150 ${
                                  Math.max(
                                    0,
                                    LAB_NOTE_OPTIONS.findIndex(
                                      (item) =>
                                        item.value === feedbackForm.labNotes,
                                    ),
                                  ) === idx
                                    ? "opacity-100 text-(--text)"
                                    : "opacity-50 text-(--muted)"
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
                                  LAB_NOTE_OPTIONS[Number(e.target.value)]
                                    ?.value || "None",
                              }))
                            }
                            className="absolute inset-0 z-3 m-0 w-full cursor-pointer opacity-0"
                            aria-label="Lab materials provided"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ECS Section */}
                <div className="rounded-xl border border-(--line) overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        ecs: !prev.ecs,
                      }))
                    }
                    className="flex w-full items-center justify-between bg-(--panel) px-4 py-3 transition-colors hover:bg-(--bg-elev)"
                  >
                    <span className="font-semibold text-(--text)">
                      ECS / Capstone
                    </span>
                    <span className="text-(--muted)">
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className={`h-3 w-3 transition-transform duration-200 ${
                          expandedSections.ecs ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </span>
                  </button>
                  {expandedSections.ecs && (
                    <div className="bg-(--bg-elev) p-4 space-y-4">
                      {ECS_FIELDS.map((field) => (
                        <RatingSlider
                          key={field.key}
                          label={field.label}
                          value={feedbackForm[field.key] ?? 3}
                          onChange={(value) =>
                            setFeedbackForm((prev) => ({
                              ...prev,
                              [field.key]: value,
                            }))
                          }
                          name={field.key}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative border-t border-(--line) pt-6">
                  <label className="mb-2 block text-sm font-semibold text-(--text)">
                    Which Course? (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Type to search and select a course (optional)..."
                    value={courseQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCourseQuery(value);
                      setFeedbackForm((prev) => ({ ...prev, courseId: "" }));
                    }}
                    className="w-full rounded-full border border-(--line) bg-(--panel) px-4 py-3 pr-10 text-sm outline-none"
                  />
                  {String(courseQuery || "").trim() || feedbackForm.courseId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCourseQuery("");
                        setFeedbackForm((prev) => ({ ...prev, courseId: "" }));
                        setCourseSuggestions([]);
                      }}
                      className="absolute right-2 top-15 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-(--muted) hover:text-(--text)"
                      aria-label="Clear course search"
                    >
                      ×
                    </button>
                  ) : null}
                  {courseSuggestions.length > 0 ? (
                    <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-2xl border border-(--line) bg-(--bg) shadow-lg">
                      {courseSuggestions.map((course) => (
                        <button
                          key={course.$id}
                          type="button"
                          onClick={() => selectCourse(course)}
                          className="block w-full border-b border-(--line) px-4 py-2 text-left text-xs hover:bg-(--panel) last:border-b-0"
                        >
                          {course.courseCode} - {course.courseName}
                        </button>
                      ))}
                    </div>
                  ) : courseQuery.trim() && !feedbackForm.courseId ? (
                    <div className="absolute z-10 mt-1 w-full rounded-2xl border border-(--line) bg-(--bg) p-3 shadow-lg">
                      <p className="text-xs text-(--muted)">
                        No courses found. Keep typing to search...
                      </p>
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-semibold text-(--text)">
                      Your Review
                    </label>
                    <span className="text-xs text-(--muted)">
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
                    className="w-full rounded-2xl border border-(--line) bg-(--panel) px-4 py-3 text-sm text-(--text) outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-(--line) pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFeedbackForm(false);
                      setIsEditing(false);
                    }}
                    className="rounded-full border border-(--line) px-6 py-3 text-sm font-semibold text-(--text) hover:bg-(--panel)"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-full bg-(--primary) px-8 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Feedback"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmOverlay
        open={showDeleteConfirm}
        title={
          deletingRatingsOnly
            ? "Delete your feedback"
            : deletingReviewOnly
              ? "Delete your review"
              : "Delete your feedback"
        }
        message={
          deletingRatingsOnly
            ? "Are you sure you want to remove your ratings? Your review will also be removed."
            : deletingReviewOnly
              ? "Are you sure you want to remove your review? Your ratings will be kept."
              : "Are you sure you want to remove your feedback for this faculty? This cannot be undone."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (deletingRatingsOnly) {
            deleteRatingsOnly();
            setDeletingRatingsOnly(false);
          } else if (deletingReviewOnly && currentEditingReviewId) {
            deleteReviewOnly(currentEditingReviewId);
            setDeletingReviewOnly(false);
          }
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setCurrentEditingReviewId(null);
          setDeletingRatingsOnly(false);
          setDeletingReviewOnly(false);
        }}
        loading={deleting}
        danger
      />
    </div>
  );
}

export default FacultyDetailPage;
