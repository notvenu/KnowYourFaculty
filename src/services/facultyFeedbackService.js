import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase/client.js";
import clientConfig from "../config/client.js";

const RATING_FIELDS = [
  "theoryTeaching",
  "theoryAttendance",
  "theoryClass",
  "theoryCorrection",
  "labClass",
  "labCorrection",
  "labAttendance",
  "ecsCapstoneSDPReview",
  "ecsCapstoneSDPCorrection",
];

const SECTION_FIELDS = {
  theory: [
    "theoryTeaching",
    "theoryAttendance",
    "theoryClass",
    "theoryCorrection",
  ],
  lab: ["labClass", "labCorrection", "labAttendance"],
  ecs: ["ecsCapstoneSDPReview", "ecsCapstoneSDPCorrection"],
};

function clampRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 5) return null;
  return Math.round(n);
}

class FacultyFeedbackService {
  reviewCollection = clientConfig.firebaseReviewCollection;
  feedbackCache = new Map();
  FEEDBACK_CACHE_TTL_MS = 10 * 60 * 1000;  // Reviews change more often, 10 min cache
  FACULTY_ROWS_FETCH_LIMIT = 300;
  feedbackTotalCountCache = null;
  feedbackTotalCountExpiry = 0;

  constructor() {}

  get feedbackTableId() {
    return this.reviewCollection;
  }

  toTimeMs(value) {
    if (!value) return 0;
    if (typeof value?.toDate === "function") {
      const date = value.toDate();
      return Number.isFinite(date?.getTime?.()) ? date.getTime() : 0;
    }
    const date = new Date(value);
    const time = date.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  sortRowsByFieldDesc(rows, field) {
    return [...(rows || [])].sort(
      (a, b) => this.toTimeMs(b?.[field]) - this.toTimeMs(a?.[field]),
    );
  }

  /**
   * Helper method for backward compatibility with Query-based calls
   * Converts constraint array to Firestore query
   */
  async listRows(collectionName, constraints = []) {
    try {
      // Add any constraints
      // OPTIMIZATION: Default to 1000 instead of 5000 for efficiency
      let constraints_copy = [...(constraints || [])];
      if (!constraints_copy.some((c) => c.type === "limit")) {
        constraints_copy.push(limit(1000));
      }

      const q = query(collection(db, collectionName), ...constraints_copy);
      const snapshot = await getDocs(q);

      return {
        rows: snapshot.docs.map((doc) => ({
          $id: doc.id,
          ...doc.data(),
        })),
        total: snapshot.docs.length,
      };
    } catch (error) {
      throw error;
    }
  }

  async createRow(collectionName, data, permissions = undefined) {
    try {
      const payload = {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, collectionName), payload);
      return {
        $id: docRef.id,
        ...payload,
      };
    } catch (error) {
      throw error;
    }
  }

  async updateRow(collectionName, docId, data, permissions = undefined) {
    try {
      const docRef = doc(db, collectionName, docId);
      const payload = {
        ...data,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(docRef, payload);
      
      // OPTIMIZATION: Return optimistic update instead of extra getDoc()
      // This saves a read operation and is acceptable since we just wrote it
      return {
        $id: docId,
        ...payload,
      };
    } catch (error) {
      throw error;
    }
  }

  async getFacultyReviews(facultyId, limit_num = 20) {
    const rows = await this.getFacultyRows(facultyId);
    return rows
      .filter((row) => String(row?.review || "").trim().length > 0)
      .slice(0, limit_num);
  }

  async getFacultyRatings(facultyId, limit_num = 200) {
    const rows = await this.getFacultyRows(facultyId);
    return rows.slice(0, limit_num);
  }

  async getAllRatings(limit_num = 10000) {
    const cacheKey = `allRatings_${limit_num}`;
    const cached = this.feedbackCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // OPTIMIZATION: Cap the fetch limit to reduce read size
    const actualLimit = Math.min(limit_num, 5000);
    const response = await this.listRows(this.feedbackTableId, [
      limit(actualLimit),
    ]);
    const result = this.sortRowsByFieldDesc(response.rows || [], "createdAt").slice(
      0,
      limit_num,
    );
    this.feedbackCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + this.FEEDBACK_CACHE_TTL_MS,
    });
    return result;
  }

  async getFeedbackTotalCount() {
    if (
      Number.isFinite(this.feedbackTotalCountCache) &&
      this.feedbackTotalCountExpiry > Date.now()
    ) {
      return this.feedbackTotalCountCache;
    }

    const snapshot = await getCountFromServer(
      query(collection(db, this.feedbackTableId)),
    );
    const count = Number(snapshot?.data()?.count || 0);
    this.feedbackTotalCountCache = count;
    this.feedbackTotalCountExpiry = Date.now() + this.FEEDBACK_CACHE_TTL_MS;
    return count;
  }

  async getRecentFeedbackEntries(limit_num = 200) {
    const cacheKey = `recentFeedback_${limit_num}`;
    const cached = this.feedbackCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const response = await this.listRows(this.feedbackTableId, [
      orderBy("updatedAt", "desc"),
      limit(limit_num),
    ]);
    const rows = response.rows || [];
    this.feedbackCache.set(cacheKey, {
      value: rows,
      expiresAt: Date.now() + this.FEEDBACK_CACHE_TTL_MS,
    });
    return rows;
  }

  async getFacultyRows(facultyId, limit_num = this.FACULTY_ROWS_FETCH_LIMIT) {
    const id = String(facultyId || "").trim();
    if (!id) return [];

    const cacheKey = `facultyRows_${id}_${limit_num}`;
    const cached = this.feedbackCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const response = await this.listRows(this.feedbackTableId, [
      where("facultyId", "==", id),
      limit(limit_num),
    ]);
    const rows = this.sortRowsByFieldDesc(response.rows || [], "createdAt");
    this.feedbackCache.set(cacheKey, {
      value: rows,
      expiresAt: Date.now() + this.FEEDBACK_CACHE_TTL_MS,
    });
    return rows;
  }

  /**
   * 📈 Aggregate ratings by faculty and build lightweight lookup objects.
   *
   * This method is intended for pages such as the directory where the full
   * review rows are not needed.  Instead of returning every document we only
   * compute an overall score and count for each faculty and build a course
   *→ faculty map.  The result is cached for a short duration to avoid
   * repeated scans of the reviews collection, which was the primary cause of
   * slow page loads when the database grew.
   *
   * @param {number} limit_num maximum number of review rows to examine
   * @returns {{ratings:Object,counts:Object,courseLookup:Map<string,Set<string>>}}
   */
  async getRatingsSummary(limit_num = 10000) {
    const cacheKey = `ratingsSummary_${limit_num}`;
    const cached = this.feedbackCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // OPTIMIZATION: Cap the fetch limit to reduce read size - 5000 is plenty
    const actualLimit = Math.min(limit_num, 5000);
    const response = await this.listRows(this.feedbackTableId, [limit(actualLimit)]);
    const ratingAgg = {};
    const byFacultyCourseAgg = {};
    const courseLookup = {};
    const facultyCounts = {};
    const userSet = new Set();

    const extractRatingStats = (row) => {
      let scoreSum = 0;
      let scoreCount = 0;
      for (const field of RATING_FIELDS) {
        const value = Number(row?.[field]);
        if (Number.isFinite(value) && value >= 1 && value <= 5) {
          scoreSum += value;
          scoreCount += 1;
        }
      }
      return { scoreSum, scoreCount };
    };

    for (const row of response.rows || []) {
      const facultyId = String(row.facultyId || "").trim();
      if (row.userId) userSet.add(String(row.userId));
      if (facultyId) {
        facultyCounts[facultyId] = (facultyCounts[facultyId] || 0) + 1;
      }
      if (!facultyId) continue;

      const { scoreSum, scoreCount } = extractRatingStats(row);
      if (scoreCount > 0) {
        if (!ratingAgg[facultyId]) {
          ratingAgg[facultyId] = { scoreSum: 0, scoreCount: 0, rowCount: 0 };
        }
        ratingAgg[facultyId].scoreSum += scoreSum;
        ratingAgg[facultyId].scoreCount += scoreCount;
        ratingAgg[facultyId].rowCount += 1;
      }

      const courseId = String(row.courseId || "").trim();
      if (courseId) {
        if (!courseLookup[courseId]) courseLookup[courseId] = new Set();
        courseLookup[courseId].add(facultyId);

        if (scoreCount > 0) {
          if (!byFacultyCourseAgg[facultyId]) byFacultyCourseAgg[facultyId] = {};
          if (!byFacultyCourseAgg[facultyId][courseId]) {
            byFacultyCourseAgg[facultyId][courseId] = {
              scoreSum: 0,
              scoreCount: 0,
              rowCount: 0,
            };
          }
          byFacultyCourseAgg[facultyId][courseId].scoreSum += scoreSum;
          byFacultyCourseAgg[facultyId][courseId].scoreCount += scoreCount;
          byFacultyCourseAgg[facultyId][courseId].rowCount += 1;
        }
      }
    }

    const ratings = {};
    const counts = {};
    const byFacultyCourse = {};

    for (const [fid, item] of Object.entries(ratingAgg)) {
      ratings[fid] =
        item.scoreCount > 0
          ? Number((item.scoreSum / item.scoreCount).toFixed(2))
          : null;
      counts[fid] = item.rowCount || 0;
    }

    for (const [fid, courseMap] of Object.entries(byFacultyCourseAgg)) {
      byFacultyCourse[fid] = {};
      for (const [courseId, item] of Object.entries(courseMap)) {
        byFacultyCourse[fid][courseId] = {
          average:
            item.scoreCount > 0
              ? Number((item.scoreSum / item.scoreCount).toFixed(2))
              : null,
          rowCount: item.rowCount || 0,
        };
      }
    }

    const result = {
      ratings,
      counts,
      byFacultyCourse,
      courseLookup,
      facultyCounts,
      totalReviews: (response.rows || []).length,
      uniqueUserCount: userSet.size,
    };
    this.feedbackCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + this.FEEDBACK_CACHE_TTL_MS,
    });
    return result;
  }

  buildRatingSummary(ratings) {
    const totals = {};
    const counts = {};

    for (const field of RATING_FIELDS) {
      totals[field] = 0;
      counts[field] = 0;
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

    for (const row of ratings || []) {
      for (const field of RATING_FIELDS) {
        const value = clampRating(row?.[field]);
        if (value === null) continue;
        totals[field] += value;
        counts[field] += 1;
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
      const count = counts[field];
      averages[field] =
        count > 0 ? Number((totals[field] / count).toFixed(2)) : null;
      if (count > 0) {
        weightedTotal += totals[field];
        weightedCount += count;
      }
    }

    const sectionAverages = {};
    for (const [sectionKey, fields] of Object.entries(SECTION_FIELDS)) {
      let sectionTotal = 0;
      let sectionCount = 0;
      for (const field of fields) {
        sectionTotal += totals[field];
        sectionCount += counts[field];
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
      totalRatings: ratings?.length || 0,
      overallAverage:
        weightedCount > 0
          ? Number((weightedTotal / weightedCount).toFixed(2))
          : null,
      sectionAverages,
      averages,
      notesSummary: Object.keys(notesSummary).length > 0 ? notesSummary : null,
    };
  }

  async getFacultyFeedback(facultyId) {
    const cacheKey = String(facultyId);
    const cached = this.feedbackCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const ratings = await this.getFacultyRows(facultyId);
    const reviews = ratings
      .filter((row) => String(row?.review || "").trim().length > 0)
      .slice(0, 20);

    const result = {
      reviews,
      ratings,
      ratingSummary: this.buildRatingSummary(ratings),
    };
    this.feedbackCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + this.FEEDBACK_CACHE_TTL_MS,
    });
    return result;
  }

  async getUserFacultyFeedback(userId, facultyId) {
    const response = await this.listRows(this.feedbackTableId, [
      where("userId", "==", String(userId)),
      where("facultyId", "==", String(facultyId)),
      limit(1),
    ]);
    return this.sortRowsByFieldDesc(response.rows || [], "createdAt")[0] || null;
  }

  async getUserFeedbackEntries(userId, limit_num = 200) {
    if (!String(userId || "").trim()) return [];
    const response = await this.listRows(this.feedbackTableId, [
      where("userId", "==", String(userId)),
      limit(limit_num),
    ]);
    return this.sortRowsByFieldDesc(response.rows || [], "updatedAt").slice(
      0,
      limit_num,
    );
  }

  async submitFeedback({
    userId,
    facultyId,
    courseId,
    review,
    theoryNotes = false,
    theoryTeaching,
    theoryAttendance,
    theoryClass,
    theoryCorrection,
    labClass,
    labCorrection,
    labAttendance,
    ecsCapstoneSDPReview,
    ecsCapstoneSDPCorrection,
    labNotes = "None",
  }) {
    if (!String(userId || "").trim()) {
      throw new Error("You must be logged in to submit feedback.");
    }

    const allowedLabNotes = new Set(["Soft", "Hard", "Both", "None"]);
    const normalizedLabNotes = String(labNotes || "None");
    const payload = {
      userId: String(userId),
      facultyId: String(facultyId),
    };

    if (courseId) payload.courseId = String(courseId).trim();
    if (typeof review === "string") payload.review = review.trim();
    if (Boolean(theoryNotes)) payload.theoryNotes = true;
    if (
      allowedLabNotes.has(normalizedLabNotes) &&
      normalizedLabNotes !== "None"
    ) {
      payload.labNotes = normalizedLabNotes;
    }

    for (const [field, rawValue] of Object.entries({
      theoryTeaching,
      theoryAttendance,
      theoryClass,
      theoryCorrection,
      labClass,
      labCorrection,
      labAttendance,
      ecsCapstoneSDPReview,
      ecsCapstoneSDPCorrection,
    })) {
      const value = clampRating(rawValue);
      if (value !== null) payload[field] = value;
    }

    const existing = await this.getUserFacultyFeedback(userId, facultyId);
    let result;
    if (existing?.$id) {
      result = await this.updateRow(this.feedbackTableId, existing.$id, payload);
    } else {
      result = await this.createRow(this.feedbackTableId, payload);
    }
    this.feedbackCache.clear();
    this.feedbackTotalCountCache = null;
    this.feedbackTotalCountExpiry = 0;
    return result;
  }

  async submitRating({
    userId,
    facultyId,
    courseId,
    theoryTeaching,
    theoryAttendance,
    theoryClass,
    theoryCorrection,
    labClass,
    labCorrection,
    labAttendance,
    ecsCapstoneSDPReview,
    ecsCapstoneSDPCorrection,
    labNotes = "None",
  }) {
    return this.submitFeedback({
      userId,
      facultyId,
      courseId,
      theoryTeaching,
      theoryAttendance,
      theoryClass,
      theoryCorrection,
      labClass,
      labCorrection,
      labAttendance,
      ecsCapstoneSDPReview,
      ecsCapstoneSDPCorrection,
      labNotes,
    });
  }

  async submitReview({
    userId,
    facultyId,
    courseId,
    review,
    theoryNotes = false,
  }) {
    return this.submitFeedback({
      userId,
      facultyId,
      courseId,
      review,
      theoryNotes,
    });
  }

  async deleteUserFacultyFeedback(userId, facultyId) {
    if (!String(userId || "").trim()) {
      throw new Error("You must be logged in to delete feedback.");
    }
    const existing = await this.getUserFacultyFeedback(userId, facultyId);
    if (!existing?.$id) return null;
    try {
      await deleteDoc(doc(db, this.feedbackTableId, existing.$id));
      this.feedbackCache.clear();
      this.feedbackTotalCountCache = null;
      this.feedbackTotalCountExpiry = 0;
      return existing;
    } catch (error) {
      throw error;
    }
  }

  async deleteFeedbackById(rowId) {
    if (!String(rowId || "").trim()) return null;
    try {
      await deleteDoc(doc(db, this.feedbackTableId, rowId));
      this.feedbackCache.clear();
      this.feedbackTotalCountCache = null;
      this.feedbackTotalCountExpiry = 0;
      return { $id: rowId };
    } catch (error) {
      throw error;
    }
  }

  async deleteAllUserFeedback(userId) {
    const rows = await this.getUserFeedbackEntries(userId, 5000);
    if (!rows.length) return 0;
    await Promise.all(rows.map((row) => this.deleteFeedbackById(row.$id)));
    return rows.length;
  }
}

const facultyFeedbackService = new FacultyFeedbackService();
export default facultyFeedbackService;
