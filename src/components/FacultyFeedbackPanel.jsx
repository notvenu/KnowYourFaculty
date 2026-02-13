import { useEffect, useMemo, useState } from "react";
import facultyFeedbackService from "../services/facultyFeedbackService.js";

const RATING_FIELDS = [
  { key: "theoryTeaching", label: "Theory Teaching" },
  { key: "theoryAttendance", label: "Theory Attendance" },
  { key: "theoryClass", label: "Theory Class" },
  { key: "theoryCorrection", label: "Theory Correction" },
  { key: "labClass", label: "Lab Class" },
  { key: "labCorrection", label: "Lab Correction" },
  { key: "labAttendance", label: "Lab Attendance" }
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
  labNotes: "None"
};

function FacultyFeedbackPanel({ facultyId, currentUser }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [ratingSummary, setRatingSummary] = useState({
    totalRatings: 0,
    overallAverage: null,
    averages: {}
  });
  const [publicNotes, setPublicNotes] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState(INITIAL_FEEDBACK_FORM);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const hasUser = Boolean(currentUser?.$id);

  const averageRows = useMemo(
    () =>
      RATING_FIELDS.map((field) => ({
        ...field,
        value: ratingSummary.averages?.[field.key] ?? null
      })),
    [ratingSummary]
  );

  const loadFeedback = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await facultyFeedbackService.getFacultyFeedback(facultyId);
      setReviews(response.reviews || []);
      setRatingSummary(response.ratingSummary || { totalRatings: 0, overallAverage: null, averages: {} });
      const latestWithNotes = (response.ratings || []).find(
        (row) =>
          Object.prototype.hasOwnProperty.call(row || {}, "theoryNotes") ||
          Object.prototype.hasOwnProperty.call(row || {}, "labNotes")
      );
      setPublicNotes(
        latestWithNotes
          ? {
              theoryNotes: Boolean(latestWithNotes.theoryNotes),
              labNotes: latestWithNotes.labNotes || "None"
            }
          : null
      );

      if (hasUser) {
        const existing = await facultyFeedbackService.getUserFacultyFeedback(currentUser.$id, facultyId);
        if (existing) {
          setAlreadySubmitted(true);
          setIsEditing(false);
          setFeedbackForm({
            courseId: existing.courseId || "",
            review: existing.review || "",
            theoryNotes: Boolean(existing.theoryNotes),
            theoryTeaching: Number(existing.theoryTeaching || 3),
            theoryAttendance: Number(existing.theoryAttendance || 3),
            theoryClass: Number(existing.theoryClass || 3),
            theoryCorrection: Number(existing.theoryCorrection || 3),
            labClass: Number(existing.labClass || 3),
            labCorrection: Number(existing.labCorrection || 3),
            labAttendance: Number(existing.labAttendance || 3),
            labNotes: existing.labNotes || "None"
          });
        } else {
          setAlreadySubmitted(false);
          setIsEditing(true);
          setFeedbackForm(INITIAL_FEEDBACK_FORM);
        }
      } else {
        setAlreadySubmitted(false);
        setIsEditing(false);
      }
    } catch (loadError) {
      const code = Number(loadError?.code || 0);
      const message = String(loadError?.message || "");
      const unauthorized = code === 401 || message.toLowerCase().includes("not authorized");
      if (unauthorized && !hasUser) {
        setError(null);
      } else {
        setError(loadError?.message || "Failed to load feedback");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, [facultyId, hasUser, currentUser?.$id]);

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!hasUser) return;

    try {
      setSaving(true);
      setError(null);
      await facultyFeedbackService.submitFeedback({
        userId: currentUser.$id,
        facultyId,
        ...feedbackForm
      });
      setAlreadySubmitted(true);
      setIsEditing(false);
      await loadFeedback();
    } catch (submitError) {
      setError(submitError?.message || "Failed to save feedback");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 border-t border-gray-200 pt-3 space-y-3">
      {loading ? <p className="text-xs text-gray-500">Loading feedback...</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="bg-gray-50 rounded-md p-2">
        <p className="text-xs font-semibold text-gray-700">
          Overall: {ratingSummary.overallAverage ?? "-"} / 5 ({ratingSummary.totalRatings} ratings)
        </p>
        <div className="mt-1 grid grid-cols-1 gap-1">
          {averageRows.map((row) => (
            <p key={row.key} className="text-xs text-gray-600">
              {row.label}: {row.value ?? "-"}
            </p>
          ))}
        </div>
        {publicNotes ? (
          <div className="mt-2 border-t border-gray-200 pt-2 space-y-1">
            <p className="text-xs text-gray-700">
              Theory Notes: {publicNotes.theoryNotes ? "Yes" : "No"}
            </p>
            <p className="text-xs text-gray-700">Lab Notes: {publicNotes.labNotes || "None"}</p>
          </div>
        ) : null}
      </div>

      {!hasUser ? (
        <p className="text-xs text-gray-500">Login with your VIT-AP account to add ratings and reviews.</p>
      ) : alreadySubmitted && !isEditing ? (
        <div className="space-y-2">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            You already submitted feedback for this faculty.
          </p>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit Feedback
          </button>
        </div>
      ) : (
        <form onSubmit={submitFeedback} className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Your Feedback (single record per user)</p>

          <input
            type="text"
            placeholder="Course ID (optional)"
            value={feedbackForm.courseId}
            onChange={(e) => setFeedbackForm((prev) => ({ ...prev, courseId: e.target.value }))}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          />

          <textarea
            value={feedbackForm.review}
            onChange={(e) => setFeedbackForm((prev) => ({ ...prev, review: e.target.value }))}
            rows={3}
            placeholder="Write your review"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          />

          <div className="grid grid-cols-2 gap-2">
            {RATING_FIELDS.map((field) => (
              <label key={field.key} className="text-xs text-gray-600">
                {field.label}
                <select
                  value={feedbackForm[field.key]}
                  onChange={(e) =>
                    setFeedbackForm((prev) => ({
                      ...prev,
                      [field.key]: Number(e.target.value)
                    }))
                  }
                  className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </label>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={feedbackForm.theoryNotes}
              onChange={(e) => setFeedbackForm((prev) => ({ ...prev, theoryNotes: e.target.checked }))}
            />
            Theory Notes
          </label>

          <label className="text-xs text-gray-600 block">
            Lab Notes
            <select
              value={feedbackForm.labNotes}
              onChange={(e) =>
                setFeedbackForm((prev) => ({
                  ...prev,
                  labNotes: e.target.value
                }))
              }
              className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded"
            >
              <option value="Soft">Soft</option>
              <option value="Hard">Hard</option>
              <option value="Both">Both</option>
              <option value="None">None</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Feedback"}
          </button>
          {alreadySubmitted ? (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="ml-2 px-2 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          ) : null}
        </form>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1">Recent Reviews</p>
        {reviews.length === 0 ? (
          <p className="text-xs text-gray-500">No reviews yet.</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-auto pr-1">
            {reviews.map((review) => (
              <div key={review.$id} className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-700">{review.review || "(No text review)"}</p>
                <p className="text-[11px] text-gray-500 mt-1">Course: {review.courseId || "-"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FacultyFeedbackPanel;
