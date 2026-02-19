import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
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
  faSearch,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import pollService from "../services/pollService.js";
import publicFacultyService from "../services/publicFacultyService.js";
import courseService from "../services/courseService.js";

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
  const currentUser = useSelector((state) => state.auth.currentUser);
  const [activeTab, setActiveTab] = useState("active"); // active, create, my-polls
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [facultyList, setFacultyList] = useState([]);
  const [courseList, setCourseList] = useState([]);

  // Create poll form state
  const [createForm, setCreateForm] = useState({
    facultyId: "",
    courseId: "",
    courseType: "",
    pollType: 3,
    pollStartTime: "",
    pollEndTime: "",
  });

  // Search states
  const [facultySearch, setFacultySearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [showFacultyDropdown, setShowFacultyDropdown] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);

  // Poll results state
  const [pollResults, setPollResults] = useState({});
  const [userVotes, setUserVotes] = useState({});

  const hasUser = Boolean(currentUser?.$id);

  useEffect(() => {
    if (hasUser) {
      loadInitialData();
    }
  }, [hasUser, activeTab]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".faculty-search-container")) {
        setShowFacultyDropdown(false);
      }
      if (!e.target.closest(".course-search-container")) {
        setShowCourseDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === "active") {
        const activePolls = await pollService.getActivePolls();
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
      }

      // Load faculty and courses for create form
      if (activeTab === "create" || activeTab === "active") {
        const [faculty, courses] = await Promise.all([
          publicFacultyService.getFacultyList({ limit: 1000, page: 1 }),
          courseService.getAllCourses(1000),
        ]);
        setFacultyList(faculty.faculty || []);
        setCourseList(courses || []);
        console.log("Loaded courses:", courses?.slice(0, 3)); // Debug: show first 3 courses
      }
    } catch (err) {
      console.error("Error loading poll data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const payload = {
        userId: currentUser.$id,
        pollType: createForm.pollType,
        pollEndTime: createForm.pollEndTime,
      };

      if (createForm.pollStartTime) {
        payload.pollStartTime = createForm.pollStartTime;
      }

      if (!createForm.facultyId) {
        throw new Error("Please select a faculty for the poll.");
      }

      payload.facultyId = createForm.facultyId;

      // Optionally add course
      if (createForm.courseId) {
        payload.courseId = createForm.courseId;
        if (createForm.courseType) {
          payload.courseType = createForm.courseType;
        }
      }

      if (!createForm.pollEndTime) {
        throw new Error("Please set an end time for the poll.");
      }

      await pollService.createPoll(payload);

      // Reset form
      setCreateForm({
        facultyId: "",
        courseId: "",
        courseType: "",
        pollType: 3,
        pollStartTime: "",
        pollEndTime: "",
      });
      setFacultySearch("");
      setCourseSearch("");
      setSelectedFaculty(null);
      setSelectedCourse(null);

      // Switch to active polls tab
      setActiveTab("active");
      await loadInitialData();
    } catch (err) {
      console.error("Error creating poll:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (pollId, vote) => {
    try {
      setError(null);
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
    } catch (err) {
      console.error("Error submitting vote:", err);
      setError(err.message);
    }
  };

  const handleTogglePollStatus = async (pollId, currentStatus) => {
    try {
      setError(null);
      await pollService.updatePollStatus(pollId, !currentStatus);

      // Reload polls to reflect the change
      await loadInitialData();
    } catch (err) {
      console.error("Error toggling poll status:", err);
      setError(err.message);
    }
  };

  const getFacultyName = (facultyId) => {
    const faculty = facultyList.find((f) => f.$id === facultyId);
    return faculty ? faculty.name : "Unknown Faculty";
  };

  const getCourseName = (courseId) => {
    const course = courseList.find((c) => c.$id === courseId);
    return course ? `${course.code} - ${course.name}` : "Unknown Course";
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
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
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
        className="bg-(--card) rounded-lg shadow-md p-6 border border-(--border)"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <FontAwesomeIcon
                icon={poll.facultyId ? faUser : faBook}
                className="text-(--primary)"
              />
              <h3 className="text-lg font-semibold text-(--text)">
                {poll.facultyId
                  ? getFacultyName(poll.facultyId)
                  : getCourseName(poll.courseId)}
              </h3>
            </div>
            {poll.courseType && (
              <span className="inline-block px-2 py-1 text-xs rounded bg-(--secondary) text-(--secondary-text) mb-2">
                {poll.courseType}
              </span>
            )}
            {poll.facultyId && (
              <Link
                to={`/faculty/${poll.facultyId}`}
                className="text-sm text-(--primary) hover:underline"
              >
                View Faculty Profile
              </Link>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {isActive ? (
              <span className="px-3 py-1 rounded-full bg-green-500 text-white text-sm font-medium flex items-center gap-2">
                <FontAwesomeIcon icon={faVoteYea} />
                Active
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-gray-500 text-white text-sm font-medium flex items-center gap-2">
                <FontAwesomeIcon icon={faClock} />
                Ended
              </span>
            )}
            <span className="text-xs text-(--muted)">
              Ends: {formatDate(poll.pollEndTime)}
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
                    ? "border-(--primary) bg-(--primary) bg-opacity-10"
                    : "border-(--border) hover:border-(--primary)"
                } ${!isActive ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div
                  className="absolute inset-0 bg-(--primary) opacity-10 transition-all"
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {isUserVote && (
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        className="text-(--primary)"
                      />
                    )}
                    <span className="font-medium text-(--text)">
                      {option.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-(--muted)">
                      {voteCount} votes ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-sm text-(--muted) flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faChartBar} />
            <span>Total votes: {results?.totalVotes || 0}</span>
          </div>

          {/* Poll Management Buttons (only for poll creator) */}
          {poll.userId === currentUser.$id && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTogglePollStatus(poll.$id, poll.isActive)}
                className="px-3 py-1 rounded text-xs font-medium transition-colors hover:bg-(--secondary) flex items-center gap-2"
                title={poll.isActive ? "Deactivate poll" : "Activate poll"}
              >
                <FontAwesomeIcon
                  icon={poll.isActive ? faToggleOn : faToggleOff}
                  className={poll.isActive ? "text-green-500" : "text-gray-500"}
                />
                {poll.isActive ? "Active" : "Inactive"}
              </button>
            </div>
          )}
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
    <div className="min-h-screen bg-(--background) py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-(--text) mb-2 flex items-center gap-3">
            <FontAwesomeIcon icon={faPoll} />
            Faculty & Course Polls
          </h1>
          <p className="text-(--muted)">
            Vote on faculty strictness and course difficulty
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-(--border)">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "active"
                ? "text-(--primary) border-b-2 border-(--primary)"
                : "text-(--muted) hover:text-(--text)"
            }`}
          >
            <FontAwesomeIcon icon={faVoteYea} className="mr-2" />
            Active Polls
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "create"
                ? "text-(--primary) border-b-2 border-(--primary)"
                : "text-(--muted) hover:text-(--text)"
            }`}
          >
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            Create Poll
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
                      onClick={() => setActiveTab("create")}
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

            {/* Create Poll Tab */}
            {activeTab === "create" && (
              <div className="bg-(--card) rounded-lg shadow-md p-6 border border-(--border)">
                <h2 className="text-xl font-bold text-(--text) mb-6">
                  Create New Poll
                </h2>
                <form onSubmit={handleCreatePoll} className="space-y-6">
                  {/* Faculty Selection - Required */}
                  <div className="faculty-search-container">
                    <label className="block text-sm font-medium text-(--text) mb-2">
                      Select Faculty *
                    </label>
                    <div className="relative">
                      <div className="relative">
                        <FontAwesomeIcon
                          icon={faSearch}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-(--muted)"
                        />
                        <input
                          type="text"
                          value={facultySearch}
                          onChange={(e) => {
                            setFacultySearch(e.target.value);
                            setShowFacultyDropdown(true);
                          }}
                          onFocus={() => setShowFacultyDropdown(true)}
                          placeholder="Search faculty by name or department..."
                          className="w-full pl-10 pr-10 py-2 border border-(--border) rounded-lg bg-(--background) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--primary)"
                          required={!selectedFaculty}
                        />
                        {selectedFaculty && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFaculty(null);
                              setFacultySearch("");
                              setCreateForm({ ...createForm, facultyId: "" });
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-(--muted) hover:text-(--text)"
                          >
                            <FontAwesomeIcon icon={faTimes} />
                          </button>
                        )}
                      </div>
                      {selectedFaculty && (
                        <div className="mt-2 px-3 py-2 bg-(--secondary) rounded border border-(--border)">
                          <span className="text-sm font-medium text-(--text)">
                            {selectedFaculty.name}
                          </span>
                          <span className="text-sm text-(--muted) ml-2">
                            ({selectedFaculty.department})
                          </span>
                        </div>
                      )}
                      {showFacultyDropdown &&
                        !selectedFaculty &&
                        facultyList.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-(--border) rounded-lg shadow-xl">
                            {facultyList.filter(
                              (faculty) =>
                                facultySearch === "" ||
                                faculty.name
                                  .toLowerCase()
                                  .includes(facultySearch.toLowerCase()) ||
                                faculty.department
                                  ?.toLowerCase()
                                  .includes(facultySearch.toLowerCase()),
                            ).length > 0 ? (
                              facultyList
                                .filter(
                                  (faculty) =>
                                    facultySearch === "" ||
                                    faculty.name
                                      .toLowerCase()
                                      .includes(facultySearch.toLowerCase()) ||
                                    faculty.department
                                      ?.toLowerCase()
                                      .includes(facultySearch.toLowerCase()),
                                )
                                .map((faculty) => (
                                  <button
                                    key={faculty.$id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedFaculty(faculty);
                                      setFacultySearch(faculty.name);
                                      setCreateForm({
                                        ...createForm,
                                        facultyId: faculty.$id,
                                      });
                                      setShowFacultyDropdown(false);
                                    }}
                                    className="w-full px-4 py-2 text-left hover:bg-(--secondary) transition-colors"
                                  >
                                    <div className="font-medium text-(--text)">
                                      {faculty.name}
                                    </div>
                                    {faculty.department && (
                                      <div className="text-sm text-(--muted)">
                                        {faculty.department}
                                      </div>
                                    )}
                                  </button>
                                ))
                            ) : (
                              <div className="px-4 py-3 text-center text-(--muted)">
                                No faculty found
                              </div>
                            )}
                          </div>
                        )}
                      {showFacultyDropdown &&
                        !selectedFaculty &&
                        facultyList.length === 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-(--border) rounded-lg shadow-xl px-4 py-3 text-center text-(--muted)">
                            Loading faculty...
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Course Selection - Optional */}
                  <div className="course-search-container">
                    <label className="block text-sm font-medium text-(--text) mb-2">
                      Select Course (Optional)
                    </label>
                    <div className="relative">
                      <div className="relative">
                        <FontAwesomeIcon
                          icon={faSearch}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-(--muted)"
                        />
                        <input
                          type="text"
                          value={courseSearch}
                          onChange={(e) => {
                            setCourseSearch(e.target.value);
                            setShowCourseDropdown(true);
                          }}
                          onFocus={() => setShowCourseDropdown(true)}
                          placeholder="Search course by code or name..."
                          className="w-full pl-10 pr-10 py-2 border border-(--border) rounded-lg bg-(--background) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--primary)"
                        />
                        {selectedCourse && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCourse(null);
                              setCourseSearch("");
                              setCreateForm({
                                ...createForm,
                                courseId: "",
                                courseType: "",
                              });
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-(--muted) hover:text-(--text)"
                          >
                            <FontAwesomeIcon icon={faTimes} />
                          </button>
                        )}
                      </div>
                      {selectedCourse && (
                        <div className="mt-2 px-3 py-2 bg-(--secondary) rounded border border-(--border)">
                          <span className="text-sm font-medium text-(--text)">
                            {selectedCourse.courseCode || selectedCourse.$id}
                          </span>
                          {selectedCourse.courseName && (
                            <span className="text-sm text-(--muted) ml-2">
                              {selectedCourse.courseName}
                            </span>
                          )}
                        </div>
                      )}
                      {showCourseDropdown &&
                        !selectedCourse &&
                        courseList.length > 0 && (
                          <div className="absolute z-40 w-full mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-(--border) rounded-lg shadow-xl">
                            {courseList.filter(
                              (course) =>
                                courseSearch === "" ||
                                course.courseCode
                                  ?.toLowerCase()
                                  .includes(courseSearch.toLowerCase()) ||
                                course.courseName
                                  ?.toLowerCase()
                                  .includes(courseSearch.toLowerCase()),
                            ).length > 0 ? (
                              courseList
                                .filter(
                                  (course) =>
                                    courseSearch === "" ||
                                    course.courseCode
                                      ?.toLowerCase()
                                      .includes(courseSearch.toLowerCase()) ||
                                    course.courseName
                                      ?.toLowerCase()
                                      .includes(courseSearch.toLowerCase()),
                                )
                                .map((course) => (
                                  <button
                                    key={course.$id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCourse(course);
                                      const displayText = course.courseCode
                                        ? `${course.courseCode}${course.courseName ? ` - ${course.courseName}` : ""}`
                                        : course.courseName || course.$id;
                                      setCourseSearch(displayText);
                                      setCreateForm({
                                        ...createForm,
                                        courseId: course.$id,
                                      });
                                      setShowCourseDropdown(false);
                                    }}
                                    className="w-full px-4 py-2 text-left hover:bg-(--secondary) transition-colors"
                                  >
                                    <div className="font-medium text-(--text)">
                                      {course.courseCode || course.$id}
                                    </div>
                                    {course.courseName && (
                                      <div className="text-sm text-(--muted)">
                                        {course.courseName}
                                      </div>
                                    )}
                                  </button>
                                ))
                            ) : (
                              <div className="px-4 py-3 text-center text-(--muted)">
                                No courses found
                              </div>
                            )}
                          </div>
                        )}
                      {showCourseDropdown &&
                        !selectedCourse &&
                        courseList.length === 0 && (
                          <div className="absolute z-40 w-full mt-1 bg-white dark:bg-gray-800 border border-(--border) rounded-lg shadow-xl px-4 py-3 text-center text-(--muted)">
                            No courses available
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Course Type - Only show if course is selected */}
                  {selectedCourse && (
                    <div>
                      <label className="block text-sm font-medium text-(--text) mb-2">
                        Course Type (Optional)
                      </label>
                      <select
                        value={createForm.courseType}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            courseType: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-(--border) rounded-lg bg-(--background) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--primary)"
                      >
                        <option value="">-- Select Type --</option>
                        {COURSE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Poll Type */}
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-2">
                      Poll Type *
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value={3}
                          checked={createForm.pollType === 3}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              pollType: Number(e.target.value),
                            })
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-(--text)">
                          3 Options (Rod, Moderate, Loose)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value={5}
                          checked={createForm.pollType === 5}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              pollType: Number(e.target.value),
                            })
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-(--text)">
                          5 Options (Rod-God → Loose-God)
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Poll Start Time */}
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-2">
                      Start Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={createForm.pollStartTime}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          pollStartTime: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-(--border) rounded-lg bg-(--background) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--primary)"
                    />
                  </div>

                  {/* Poll End Time */}
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-2">
                      End Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={createForm.pollEndTime}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          pollEndTime: e.target.value,
                        })
                      }
                      required
                      className="w-full px-4 py-2 border border-(--border) rounded-lg bg-(--background) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--primary)"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-6 py-3 bg-(--primary) text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Creating..." : "Create Poll"}
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
