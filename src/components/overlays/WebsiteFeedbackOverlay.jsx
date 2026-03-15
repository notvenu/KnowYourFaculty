import { useMemo, useState } from "react";
import Overlay from "./Overlay.jsx";

const RATING_OPTIONS = [1, 2, 3, 4, 5];

export default function WebsiteFeedbackOverlay({
  open,
  onClose,
  onSubmit,
  userName,
}) {
  const [rating, setRating] = useState(0);
  const [suggestions, setSuggestions] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const titleName = useMemo(() => {
    const safe = String(userName || "").trim();
    return safe || "there";
  }, [userName]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!rating) {
      setMessage("Please select a rating before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit?.({ rating, suggestions: suggestions.trim() });
      setMessage("");
      setRating(0);
      setSuggestions("");
    } catch (error) {
      setMessage(
        error?.message || "Failed to submit feedback. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay open={open} onClose={onClose}>
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-(--text)">
          Quick feedback, {titleName}
        </h2>
        <p className="mt-2 text-sm text-(--muted)">
          You have been using KnowYourFaculty for a while. Please share a quick
          review and suggestions.
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <p className="mb-2 text-sm font-medium text-(--text)">Rating</p>
            <div
              className="flex items-center gap-1"
              role="radiogroup"
              aria-label="Website rating"
            >
              {RATING_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={`text-2xl leading-none transition-transform hover:scale-110 ${
                    value <= rating ? "text-yellow-500" : "text-(--muted)"
                  }`}
                  aria-pressed={rating === value}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 text-xs text-(--muted)">
                {rating ? `${rating}/5` : "Select rating"}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="website-feedback-suggestions"
              className="mb-2 block text-sm font-medium text-(--text)"
            >
              Suggestions (optional)
            </label>
            <textarea
              id="website-feedback-suggestions"
              value={suggestions}
              onChange={(event) => setSuggestions(event.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Tell us what to improve..."
              className="w-full rounded-lg border border-(--line) bg-(--panel) px-3 py-2 text-sm outline-none focus:border-(--primary)"
            />
            <p className="mt-1 text-xs text-(--muted)">
              {suggestions.length}/500
            </p>
          </div>

          {message ? <p className="text-sm text-red-500">{message}</p> : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-(--line) bg-(--panel) px-4 py-2 text-sm font-medium text-(--text)"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-(--primary) px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}
