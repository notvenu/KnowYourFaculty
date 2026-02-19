import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { addToast } from "../store/uiSlice.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartBar,
  faPlus,
  faPoll,
  faVoteYea,
  faCheckCircle,
  faClock,
  faUser,
  faBook,
  faToggleOn,
  faToggleOff,
  faTrash,
  faEdit,
} from "@fortawesome/free-solid-svg-icons";
import pollService from "../services/pollService.js";
import publicFacultyService from "../services/publicFacultyService.js";
import courseService from "../services/courseService.js";
import CreatePollOverlay from "../components/overlays/CreatePollOverlay.jsx";
import ConfirmOverlay from "../components/overlays/ConfirmOverlay.jsx";

const POLL_OPTIONS = {
  3: [
    { value: 1, label: "Rod", color: "red" },
    { value: 2, label: "Moderate", color: "yellow" },
    { value: 3, label: "Loose", color: "green" },
  ],
  5: [
    { value: 1, label: "Rod-God", color: "red" },
    { value: 2, label: "Rod", color: "orange" },
    { value: 3, label: "Moderate", color: "yellow" },
    { value: 4, label: "Loose", color: "lime" },
    { value: 5, label: "Loose-God", color: "green" },
  ],
};

const COURSE_TYPES = ["Theory", "Lab", "ECS"];

export default function PollPage() {
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.auth.currentUser);
  const [activeTab, setActiveTab] = useState("active"); // active, my-polls
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [facultyList, setFacultyList] = useState([]);
  const [courseList, setCourseList] = useState([]);

  // Poll results state
  const [pollResults, setPollResults] = useState({});
  const [userVotes, setUserVotes] = useState({});

  // My polls state
  const [myPolls, setMyPolls] = useState([]);
  const [myPollResults, setMyPollResults] = useState({});
  const [myPollFilter, setMyPollFilter] = useState("all"); // all, active, ended

  // Overlay states
  const [showCreateOverlay, setShowCreateOverlay] = useState(false);
  const [showEditOverlay, setShowEditOverlay] = useState(false);
  const [editingPoll, setEditingPoll] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingPoll, setDeletingPoll] = useState(null);

  const hasUser = Boolean(currentUser?.$id);

  useEffect(() => {
    if (hasUser) {
      loadInitialData();
    }
  }, [hasUser, activeTab]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load faculty and courses
      const [faculty, courses] = await Promise.all([
        publicFacultyService.getFacultyList({ limit: 1000, page: 1 }),
        courseService.getAllCourses(1000),
      ]);
      setFacultyList(faculty.faculty || []);
      setCourseList(courses || []);

      if (activeTab === "active") {
        const activePolls = await pollService.getActivePolls();

        // Auto-deactivate ended polls
        const now = new Date();
        for (const poll of activePolls) {
          if (poll.isActive) {
            const endTime = new Date(poll.pollEndTime);
            if (now >= endTime) {
              try {
                await pollService.updatePollStatus(poll.$id, false);
                poll.isActive = false;
              } catch (err) {
                console.error("Error auto-deactivating poll:", err);
              }
            }
          }
        }

        setPolls(activePolls);

        // Load results and user votes for each poll
        const resultsPromises = activePolls.map((poll) =>
          pollService.getPollResults(poll.$id),
        );
        const votesPromises = activePolls.map((poll) =>
          pollService.getUserVote(currentUser.$id, poll.$id),
        );

        const [results, votes] = await Promise.all([
          Promise.all(resultsPromises),
          Promise.all(votesPromises),
        ]);

        const resultsMap = {};
        const votesMap = {};
        activePolls.forEach((poll, index) => {
          resultsMap[poll.$id] = results[index];
          votesMap[poll.$id] = votes[index];
        });

        setPollResults(resultsMap);
        setUserVotes(votesMap);
      } else if (activeTab === "my-polls") {
        const userPolls = await pollService.getUserPolls(currentUser.$id);

        // Auto-deactivate ended polls
        const now = new Date();
        for (const poll of userPolls) {
          if (poll.isActive) {
            const endTime = new Date(poll.pollEndTime);
            if (now >= endTime) {
              try {
                await pollService.updatePollStatus(poll.$id, false);
                poll.isActive = false;
              } catch (err) {
                console.error("Error auto-deactivating poll:", err);
              }
            }
          }
        }

        setMyPolls(userPolls);

        // Load results for user's polls
        const resultsPromises = userPolls.map((poll) =>
          pollService.getPollResults(poll.$id),
        );
        const results = await Promise.all(resultsPromises);

        const resultsMap = {};
        userPolls.forEach((poll, index) => {
          resultsMap[poll.$id] = results[index];
        });

        setMyPollResults(resultsMap);
      }
    } catch (err) {
      console.error("Error loading poll data:", err);
      dispatch(addToast({ message: "Failed to load polls", type: "error" }));
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (pollId, vote) => {
    try {
      await pollService.submitVote({
        userId: currentUser.$id,
        pollId,
        vote,
      });

      // Reload results and user vote
      const [results, userVote] = await Promise.all([
        pollService.getPollResults(pollId),
        pollService.getUserVote(currentUser.$id, pollId),
      ]);

      setPollResults((prev) => ({ ...prev, [pollId]: results }));
      setUserVotes((prev) => ({ ...prev, [pollId]: userVote }));
      dispatch(
        addToast({ message: "Vote submitted successfully!", type: "success" }),
      );
    } catch (err) {
      console.error("Error submitting vote:", err);
      dispatch(
        addToast({
          message: err.message || "Failed to submit vote",
          type: "error",
        }),
      );
    }
  };

  const handleTogglePollStatus = async (pollId, currentStatus, poll) => {
    try {
      // Check if poll has ended
      const now = new Date();
      const endTime = new Date(poll.pollEndTime);

      // Prevent activating an ended poll
      if (!currentStatus && now >= endTime) {
        dispatch(
          addToast({
            message:
              "Cannot activate a poll that has already ended. Please edit the end time first.",
            type: "warning",
            duration: 5000,
          }),
        );
        return;
      }

      await pollService.updatePollStatus(pollId, !currentStatus);
      dispatch(
        addToast({
          message: !currentStatus ? "Poll activated" : "Poll deactivated",
          type: "success",
        }),
      );

      // Reload polls to reflect the change
      await loadInitialData();
    } catch (err) {
      console.error("Error toggling poll status:", err);
      dispatch(
        addToast({
          message: err.message || "Failed to toggle poll status",
          type: "error",
        }),
      );
    }
  };

  const handleDeletePoll = async () => {
    if (!deletingPoll) return;

    try {
      await pollService.deletePoll(deletingPoll.$id);
      setShowDeleteConfirm(false);
      setDeletingPoll(null);
      dispatch(
        addToast({ message: "Poll deleted successfully", type: "success" }),
      );

      // Reload polls
      await loadInitialData();
    } catch (err) {
      console.error("Error deleting poll:", err);
      dispatch(
        addToast({
          message: err.message || "Failed to delete poll",
          type: "error",
        }),
      );
    }
  };

  const handleEditPoll = (poll) => {
    setEditingPoll(poll);
    setShowEditOverlay(true);
  };

  const handlePollCreatedOrUpdated = async () => {
    dispatch(addToast({ message: "Poll saved successfully", type: "success" }));
    await loadInitialData();
  };

  const handleConfirmDelete = (poll) => {
    setDeletingPoll(poll);
    setShowDeleteConfirm(true);
  };

  const handleCancelDelete = () => {
    setDeletingPoll(null);
    setShowDeleteConfirm(false);
  };

  const getFacultyName = (facultyId) => {
    const faculty = facultyList.find((f) => f.$id === facultyId);
    return faculty ? faculty.name : "Unknown Faculty";
  };

  const getFacultyEmployeeId = (facultyId) => {
    const faculty = facultyList.find((f) => f.$id === facultyId);
    return faculty?.employeeId || facultyId;
  };

  const getCourseName = (courseId) => {
    const course = courseList.find((c) => c.$id === courseId);
    return course
      ? `${course.courseCode} - ${course.courseName}`
      : "Unknown Course";
  };

  const isPollActive = (poll) => {
    // Check database isActive status first
    if (poll.isActive === false) return false;

    const now = new Date();
    const endTime = new Date(poll.pollEndTime);
    const startTime = poll.pollStartTime ? new Date(poll.pollStartTime) : null;

    if (startTime && now < startTime) return false;
    return now < endTime;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    // Use user's local timezone automatically
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const renderPollCard = (poll) => {
    const results = pollResults[poll.$id];
    const userVote = userVotes[poll.$id];
    const options = POLL_OPTIONS[poll.pollType];
    const isActive = isPollActive(poll);

    return (
      <div
        key={poll.$id}
        className="bg-(--card) rounded-lg shadow-md p-4 sm:p-6 border border-(--border)"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <FontAwesomeIcon
                icon={poll.facultyId ? faUser : faBook}
                className="text-(--primary) text-sm sm:text-base"
              />
              <h3 className="text-base sm:text-lg font-semibold text-(--text)">
                {poll.facultyId
                  ? getFacultyName(poll.facultyId)
                  : getCourseName(poll.courseId)}
              </h3>
              {poll.courseType && (
                <span className="inline-block px-2 py-1 text-xs rounded bg-(--secondary) text-(--secondary-text)">
                  {poll.courseType}
                </span>
              )}
            </div>
            {poll.facultyId && poll.courseId && (
              <p className="text-xs sm:text-sm text-(--muted) mb-1">
                {getCourseName(poll.courseId)}
              </p>
            )}
            {poll.facultyId && (
              <Link
                to={`/faculty/${getFacultyEmployeeId(poll.facultyId)}`}
                className="text-xs sm:text-sm text-(--primary) hover:underline"
              >
                View Faculty Profile
              </Link>
            )}
          </div>
          <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-2 self-start">
            {isActive ? (
              <span
                className="px-2 sm:px-3 py-1 rounded-full text-white text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2 whitespace-nowrap"
                style={{ backgroundColor: "#10b981" }}
              >
                <FontAwesomeIcon icon={faVoteYea} className="text-xs" />
                Active
              </span>
            ) : (
              <span
                className="px-2 sm:px-3 py-1 rounded-full text-white text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2 whitespace-nowrap"
                style={{ backgroundColor: "#6b7280" }}
              >
                <FontAwesomeIcon icon={faClock} className="text-xs" />
                Ended
              </span>
            )}
            <span className="text-xs text-(--muted) whitespace-nowrap">
              {formatDate(poll.pollEndTime)}
            </span>
          </div>
        </div>

        {/* Voting Options */}
        <div className="space-y-3 mb-4">
          {options.map((option) => {
            const voteCount = results?.voteCounts?.[option.value] || 0;
            const totalVotes = results?.totalVotes || 0;
            const percentage =
              totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
            const isUserVote = userVote?.vote === option.value;

            return (
              <button
                key={option.value}
                onClick={() => isActive && handleVote(poll.$id, option.value)}
                disabled={!isActive}
                className={`w-full relative overflow-hidden rounded-lg border-2 transition-all ${
                  isUserVote
                    ? "border-(--primary) bg-(--primary-soft)"
                    : "border-(--border) hover:border-(--primary)"
                } ${!isActive ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div
                  className="absolute inset-0 bg-(--primary) opacity-10 transition-all"
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {isUserVote && (
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        className="text-(--primary) text-sm sm:text-base"
                      />
                    )}
                    <span className="font-medium text-(--text) text-sm sm:text-base">
                      {option.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xs sm:text-sm text-(--muted)">
                      {voteCount} votes ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-xs sm:text-sm text-(--muted) flex items-center justify-between gap-2 pt-3 border-t border-(--border)">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <FontAwesomeIcon icon={faChartBar} className="text-xs sm:text-sm" />
            <span>Total votes: {results?.totalVotes || 0}</span>
          </div>

          {/* Poll Management Buttons (only for poll creator) */}
          {poll.userId === currentUser.$id && (
            <button
              onClick={() =>
                handleTogglePollStatus(poll.$id, poll.isActive, poll)
              }
              className="px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs font-medium transition-colors hover:bg-(--secondary) flex items-center gap-1 sm:gap-2 shrink-0"
              title={poll.isActive ? "Deactivate poll" : "Activate poll"}
            >
              <FontAwesomeIcon
                icon={poll.isActive ? faToggleOn : faToggleOff}
                className={`text-xs sm:text-sm ${
                  poll.isActive ? "text-(--success)" : "text-(--muted)"
                }`}
              />
              <span className="hidden sm:inline">
                {poll.isActive ? "Active" : "Inactive"}
              </span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderMyPollCard = (poll) => {
    const results = myPollResults[poll.$id];
    const options = POLL_OPTIONS[poll.pollType];
    const isActive = isPollActive(poll);

    return (
      <div
        key={poll.$id}
        className="bg-(--card) rounded-lg shadow-md p-4 sm:p-6 border border-(--border)"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <FontAwesomeIcon
                icon={poll.facultyId ? faUser : faBook}
                className="text-(--primary) text-sm sm:text-base"
              />
              <h3 className="text-base sm:text-lg font-semibold text-(--text)">
                {poll.facultyId
                  ? getFacultyName(poll.facultyId)
                  : getCourseName(poll.courseId)}
              </h3>
              {poll.courseType && (
                <span className="inline-block px-2 py-1 text-xs rounded bg-(--secondary) text-(--secondary-text)">
                  {poll.courseType}
                </span>
              )}
            </div>
            {poll.facultyId && poll.courseId && (
              <p className="text-xs sm:text-sm text-(--muted) mb-1">
                {getCourseName(poll.courseId)}
              </p>
            )}
            {poll.facultyId && (
              <Link
                to={`/faculty/${getFacultyEmployeeId(poll.facultyId)}`}
                className="text-xs sm:text-sm text-(--primary) hover:underline"
              >
                View Faculty Profile
              </Link>
            )}
          </div>
          <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-2 self-start">
            {isActive ? (
              <span
                className="px-2 sm:px-3 py-1 rounded-full text-white text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2 whitespace-nowrap"
                style={{ backgroundColor: "#10b981" }}
              >
                <FontAwesomeIcon icon={faVoteYea} className="text-xs" />
                Active
              </span>
            ) : (
              <span
                className="px-2 sm:px-3 py-1 rounded-full text-white text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2 whitespace-nowrap"
                style={{ backgroundColor: "#6b7280" }}
              >
                <FontAwesomeIcon icon={faClock} className="text-xs" />
                Ended
              </span>
            )}
            <span className="text-xs text-(--muted) whitespace-nowrap">
              {formatDate(poll.pollEndTime)}
            </span>
          </div>
        </div>

        {/* Poll Results (non-interactive) */}
        <div className="space-y-3 mb-4">
          {options.map((option) => {
            const voteCount = results?.voteCounts?.[option.value] || 0;
            const totalVotes = results?.totalVotes || 0;
            const percentage =
              totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

            return (
              <div
                key={option.value}
                className="w-full relative overflow-hidden rounded-lg border border-(--border)"
              >
                <div
                  className="absolute inset-0 bg-(--primary) opacity-10 transition-all"
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3">
                  <span className="font-medium text-(--text) text-sm sm:text-base">
                    {option.label}
                  </span>
                  <span className="text-xs sm:text-sm text-(--muted)">
                    {voteCount} votes ({percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Poll Management Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 sm:gap-0 pt-3 border-t border-(--border)">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-(--muted)">
            <FontAwesomeIcon icon={faChartBar} className="text-xs sm:text-sm" />
            <span>Total votes: {results?.totalVotes || 0}</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
            {/* Toggle Active Status */}
            <button
              onClick={() =>
                handleTogglePollStatus(poll.$id, poll.isActive, poll)
              }
              className={`px-2.5 sm:px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial justify-center ${
                poll.isActive
                  ? "bg-(--success-light) text-(--success) hover:bg-(--success-lighter)"
                  : "bg-(--secondary) text-(--text) hover:opacity-80"
              }`}
              title={poll.isActive ? "Deactivate poll" : "Activate poll"}
            >
              <FontAwesomeIcon
                icon={poll.isActive ? faToggleOn : faToggleOff}
                className="text-xs sm:text-sm"
              />
              <span className="hidden sm:inline">
                {poll.isActive ? "Active" : "Inactive"}
              </span>
            </button>

            {/* Edit Button */}
            <button
              onClick={() => handleEditPoll(poll)}
              className="px-2.5 sm:px-3 py-1.5 rounded text-xs font-medium transition-colors text-white hover:opacity-90 flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial justify-center"
              style={{ backgroundColor: "#3b82f6" }}
              title="Edit poll"
            >
              <FontAwesomeIcon icon={faEdit} className="text-xs sm:text-sm" />
              <span className="hidden sm:inline">Edit</span>
            </button>

            {/* Delete Button */}
            <button
              onClick={() => handleConfirmDelete(poll)}
              className="px-2.5 sm:px-3 py-1.5 rounded text-xs font-medium transition-colors text-white hover:opacity-90 flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial justify-center"
              style={{ backgroundColor: "#ef4444" }}
              title="Delete poll"
            >
              <FontAwesomeIcon icon={faTrash} className="text-xs sm:text-sm" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!hasUser) {
    return (
      <div className="min-h-screen bg-(--background) flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-(--text) mb-4">
            Login Required
          </h2>
          <p className="text-(--muted)">
            Please log in to view and participate in polls.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--background) py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-(--text) mb-1 sm:mb-2 flex items-center gap-2 sm:gap-3">
              <FontAwesomeIcon icon={faPoll} className="text-xl sm:text-2xl" />
              <span>Faculty & Course Polls</span>
            </h1>
            <p className="text-sm sm:text-base text-(--muted)">
              Vote on faculty strictness and course difficulty
            </p>
          </div>
          <button
            onClick={() => setShowCreateOverlay(true)}
            className="w-full sm:w-auto px-4 py-2 bg-(--primary) text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <FontAwesomeIcon icon={faPlus} />
            Create Poll
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-(--border) overflow-x-auto">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 sm:px-6 py-2 sm:py-3 font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
              activeTab === "active"
                ? "text-(--primary) border-b-2 border-(--primary)"
                : "text-(--muted) hover:text-(--text)"
            }`}
          >
            <FontAwesomeIcon icon={faVoteYea} className="mr-1.5 sm:mr-2" />
            <span>Active Polls</span>
          </button>
          <button
            onClick={() => setActiveTab("my-polls")}
            className={`px-4 sm:px-6 py-2 sm:py-3 font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
              activeTab === "my-polls"
                ? "text-(--primary) border-b-2 border-(--primary)"
                : "text-(--muted) hover:text-(--text)"
            }`}
          >
            <FontAwesomeIcon icon={faUser} className="mr-1.5 sm:mr-2" />
            <span>My Polls</span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-(--primary)"></div>
            <p className="mt-4 text-(--muted)">Loading...</p>
          </div>
        ) : (
          <>
            {/* Active Polls Tab */}
            {activeTab === "active" && (
              <div className="space-y-6">
                {polls.length === 0 ? (
                  <div className="text-center py-12 bg-(--card) rounded-lg border border-(--border)">
                    <FontAwesomeIcon
                      icon={faPoll}
                      className="text-6xl text-(--muted) mb-4"
                    />
                    <p className="text-(--muted)">No active polls available.</p>
                    <button
                      onClick={() => setShowCreateOverlay(true)}
                      className="mt-4 px-6 py-2 bg-(--primary) text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Create First Poll
                    </button>
                  </div>
                ) : (
                  polls.map(renderPollCard)
                )}
              </div>
            )}

            {/* My Polls Tab */}
            {activeTab === "my-polls" && (
              <div className="space-y-6">
                {myPolls.length === 0 ? (
                  <div className="text-center py-12 bg-(--card) rounded-lg border border-(--border)">
                    <FontAwesomeIcon
                      icon={faPoll}
                      className="text-6xl text-(--muted) mb-4"
                    />
                    <p className="text-(--muted)">
                      You haven't created any polls yet.
                    </p>
                    <button
                      onClick={() => setShowCreateOverlay(true)}
                      className="mt-4 px-6 py-2 bg-(--primary) text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Create Your First Poll
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Filter Tabs */}
                    <div className="flex gap-1 sm:gap-2 mb-4 border-b border-(--border) overflow-x-auto">
                      <button
                        onClick={() => setMyPollFilter("all")}
                        className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                          myPollFilter === "all"
                            ? "border-(--primary) text-(--primary)"
                            : "border-transparent text-(--muted) hover:text-(--text)"
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setMyPollFilter("active")}
                        className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                          myPollFilter === "active"
                            ? "border-(--primary) text-(--primary)"
                            : "border-transparent text-(--muted) hover:text-(--text)"
                        }`}
                      >
                        Active
                      </button>
                      <button
                        onClick={() => setMyPollFilter("ended")}
                        className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                          myPollFilter === "ended"
                            ? "border-(--primary) text-(--primary)"
                            : "border-transparent text-(--muted) hover:text-(--text)"
                        }`}
                      >
                        Ended
                      </button>
                    </div>

                    {(() => {
                      const filteredPolls = myPolls.filter((poll) => {
                        if (myPollFilter === "all") return true;
                        const isActive = isPollActive(poll);
                        if (myPollFilter === "active") return isActive;
                        if (myPollFilter === "ended") return !isActive;
                        return true;
                      });

                      if (filteredPolls.length === 0) {
                        return (
                          <div className="text-center py-12 bg-(--card) rounded-lg border border-(--border)">
                            <p className="text-(--muted)">
                              No {myPollFilter} polls found.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-6">
                          {filteredPolls.map(renderMyPollCard)}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Create Poll Overlay */}
        <CreatePollOverlay
          open={showCreateOverlay}
          onClose={() => setShowCreateOverlay(false)}
          currentUser={currentUser}
          onPollCreated={handlePollCreatedOrUpdated}
        />

        {/* Edit Poll Overlay */}
        <CreatePollOverlay
          open={showEditOverlay}
          onClose={() => {
            setShowEditOverlay(false);
            setEditingPoll(null);
          }}
          currentUser={currentUser}
          onPollCreated={handlePollCreatedOrUpdated}
          editMode={true}
          existingPoll={editingPoll}
        />

        {/* Delete Confirmation Overlay */}
        <ConfirmOverlay
          open={showDeleteConfirm}
          onConfirm={handleDeletePoll}
          onCancel={handleCancelDelete}
          message={`Are you sure you want to delete this poll? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
        />
      </div>
    </div>
  );
}
