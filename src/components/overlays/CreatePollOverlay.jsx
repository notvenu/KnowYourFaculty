import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faTimes } from "@fortawesome/free-solid-svg-icons";
import Overlay from "./Overlay.jsx";
import pollService from "../../services/pollService.js";
import publicFacultyService from "../../services/publicFacultyService.js";
import courseService from "../../services/courseService.js";

const COURSE_TYPES = ["Theory", "Lab", "ECS"];

export default function CreatePollOverlay({
  open,
  onClose,
  currentUser,
  onPollCreated,
  editMode = false,
  existingPoll = null,
}) {
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

  // Load initial data when overlay opens
  useEffect(() => {
    if (open) {
      loadInitialData();
    }
  }, [open]);

  // Convert UTC datetime to local datetime-local format
  const convertUTCToLocal = (utcDateString) => {
    if (!utcDateString) return "";
    const date = new Date(utcDateString);
    // Format as datetime-local expects: YYYY-MM-DDTHH:MM
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Convert local datetime-local to ISO string (UTC)
  const convertLocalToUTC = (localDateString) => {
    if (!localDateString) return "";
    const date = new Date(localDateString);
    return date.toISOString();
  };

  // Initialize form with existing poll data in edit mode
  useEffect(() => {
    if (editMode && existingPoll && open) {
      setCreateForm({
        facultyId: existingPoll.facultyId || "",
        courseId: existingPoll.courseId || "",
        courseType: existingPoll.courseType || "",
        pollType: existingPoll.pollType || 3,
        pollStartTime: convertUTCToLocal(existingPoll.pollStartTime),
        pollEndTime: convertUTCToLocal(existingPoll.pollEndTime),
      });

      // Set selected faculty and course
      if (existingPoll.facultyId && facultyList.length > 0) {
        const faculty = facultyList.find(
          (f) => f.$id === existingPoll.facultyId,
        );
        if (faculty) {
          setSelectedFaculty(faculty);
          setFacultySearch(faculty.name);
        }
      }

      if (existingPoll.courseId && courseList.length > 0) {
        const course = courseList.find((c) => c.$id === existingPoll.courseId);
        if (course) {
          setSelectedCourse(course);
          const displayText = course.courseCode
            ? `${course.courseCode}${course.courseName ? ` - ${course.courseName}` : ""}`
            : course.courseName || course.$id;
          setCourseSearch(displayText);
        }
      }
    } else if (!editMode) {
      // Reset form for create mode
      resetForm();
    }
  }, [editMode, existingPoll, open, facultyList, courseList]);

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

      const [faculty, courses] = await Promise.all([
        publicFacultyService.getFacultyList({ limit: 1000, page: 1 }),
        courseService.getAllCourses(1000),
      ]);
      setFacultyList(faculty.faculty || []);
      setCourseList(courses || []);
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
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
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      if (!createForm.facultyId) {
        throw new Error("Please select a faculty for the poll.");
      }

      if (!createForm.pollEndTime) {
        throw new Error("Please set an end time for the poll.");
      }

      if (editMode && existingPoll) {
        // Update existing poll
        const updates = {
          pollEndTime: convertLocalToUTC(createForm.pollEndTime),
          pollStartTime: createForm.pollStartTime
            ? convertLocalToUTC(createForm.pollStartTime)
            : "",
          courseType: createForm.courseType,
        };

        await pollService.updatePoll(existingPoll.$id, updates);
      } else {
        // Create new poll
        const payload = {
          userId: currentUser.$id,
          pollType: createForm.pollType,
          pollEndTime: convertLocalToUTC(createForm.pollEndTime),
          facultyId: createForm.facultyId,
        };

        if (createForm.pollStartTime) {
          payload.pollStartTime = convertLocalToUTC(createForm.pollStartTime);
        }

        if (createForm.courseId) {
          payload.courseId = createForm.courseId;
          if (createForm.courseType) {
            payload.courseType = createForm.courseType;
          }
        }

        await pollService.createPoll(payload);
      }

      resetForm();
      onPollCreated?.();
      onClose();
    } catch (err) {
      console.error("Error saving poll:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Overlay open={open} onClose={handleClose}>
      <div className="p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-(--text) sm:text-2xl mb-6">
          {editMode ? "Edit Poll" : "Create New Poll"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-(--danger-light) border border-(--danger) rounded-lg text-(--danger) text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Faculty Selection - Required, disabled in edit mode */}
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
                  onFocus={() => !editMode && setShowFacultyDropdown(true)}
                  placeholder="Search faculty by name or department..."
                  className="w-full pl-10 pr-10 py-2 border border-(--border) rounded-lg bg-(--background) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--primary) disabled:opacity-50 disabled:cursor-not-allowed"
                  required={!selectedFaculty}
                  disabled={editMode}
                />
                {selectedFaculty && !editMode && (
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
                !editMode &&
                facultyList.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-(--bg-elev) border border-(--border) rounded-lg shadow-xl">
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
            </div>
          </div>

          {/* Course Selection - Optional, disabled in edit mode */}
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
                  onFocus={() => !editMode && setShowCourseDropdown(true)}
                  placeholder="Search course by code or name..."
                  className="w-full pl-10 pr-10 py-2 border border-(--border) rounded-lg bg-(--background) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--primary) disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={editMode}
                />
                {selectedCourse && !editMode && (
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
                !editMode &&
                courseList.length > 0 && (
                  <div className="absolute z-40 w-full mt-1 max-h-60 overflow-y-auto bg-(--bg-elev) border border-(--border) rounded-lg shadow-xl">
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
            </div>
          </div>

          {/* Course Type - Only show if course is selected */}
          {(selectedCourse || createForm.courseId) && (
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
                className="w-full px-4 py-2 border border-(--border) rounded-lg bg-(--bg-elev) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--primary)"
              >
                <option value="" className="bg-(--bg-elev) text-(--text)">
                  -- Select Type --
                </option>
                {COURSE_TYPES.map((type) => (
                  <option
                    key={type}
                    value={type}
                    className="bg-(--bg-elev) text-(--text)"
                  >
                    {type}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Poll Type - disabled in edit mode */}
          {!editMode && (
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
          )}

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
            <p className="mt-1 text-xs text-(--muted)">
              Time is in your local timezone
            </p>
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
            <p className="mt-1 text-xs text-(--muted)">
              Time is in your local timezone
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-(--primary) text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : editMode ? "Update Poll" : "Create Poll"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-6 py-3 border border-(--border) rounded-lg font-medium text-(--text) hover:bg-(--secondary) transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}
