import clientConfig from "../config/client.js";
import { validateReviewText } from "../lib/reviewFilter.js";
import { supabase } from "../lib/supabase/client.js";
import {
  normalizeRow,
  normalizeRows,
  throwIfSupabaseError,
} from "../lib/supabase/helpers.js";

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

const REVIEW_BASE_COLUMNS = [
  "id",
  "userId",
  "facultyId",
  "courseId",
  "review",
  "theoryNotes",
  "labNotes",
  "theoryTeaching",
  "theoryAttendance",
  "theoryClass",
  "theoryCorrection",
  "labClass",
  "labCorrection",
  "labAttendance",
  "ecsCapstoneSDPReview",
  "ecsCapstoneSDPCorrection",
  "createdAt",
  "updatedAt",
].join(", ");

function clampRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 5) return null;
  return Math.round(n);
}

class FacultyFeedbackService {
  reviewCollection = clientConfig.supabaseReviewTable;
  feedbackCache = new Map();
  inflightRequests = new Map();
  FEEDBACK_CACHE_TTL_MS = 10 * 60 * 1000;
  FACULTY_ROWS_FETCH_LIMIT = 300;
  feedbackTotalCountCache = null;
  feedbackTotalCountExpiry = 0;
  PERSISTENT_CACHE_PREFIX = "kyf.feedback.v2";
  PERSISTENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  RATINGS_SUMMARY_BG_REFRESH_MS = 30 * 60 * 1000;
  ratingsSummaryRefreshInflight = new Map();

  getStorage() {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage || null;
    } catch {
      return null;
    }
  }

  getPersistentKey(suffix) {
    return `${this.PERSISTENT_CACHE_PREFIX}:${suffix}`;
  }

  readPersistentCache(suffix) {
    const storage = this.getStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(this.getPersistentKey(suffix));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.expiresAt <= Date.now()) {
        storage.removeItem(this.getPersistentKey(suffix));
        return null;
      }
      return parsed.value;
    } catch {
      return null;
    }
  }

  writePersistentCache(suffix, value, ttlMs = this.PERSISTENT_CACHE_TTL_MS) {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(
        this.getPersistentKey(suffix),
        JSON.stringify({
          value,
          expiresAt: Date.now() + ttlMs,
        }),
      );
    } catch {}
  }

  clearPersistentRatingsSummaryCache() {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const prefix = `${this.PERSISTENT_CACHE_PREFIX}:ratingsSummary_`;
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => storage.removeItem(key));
    } catch {}
  }

  toTimeMs(value) {
    if (!value) return 0;
    const date = new Date(value);
    const time = date.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  sortRowsByFieldDesc(rows, field) {
    return [...(rows || [])].sort(
      (a, b) => this.toTimeMs(b?.[field]) - this.toTimeMs(a?.[field]),
    );
  }

  getCachedValue(cacheKey) {
    const cached = this.feedbackCache.get(cacheKey);
    if (!cached) return undefined;
    if (cached.expiresAt > Date.now()) return cached.value;
    this.feedbackCache.delete(cacheKey);
    return undefined;
  }

  setCachedValue(cacheKey, value, ttlMs = this.FEEDBACK_CACHE_TTL_MS) {
    this.feedbackCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async getOrCreateInflight(cacheKey, loader) {
    if (this.inflightRequests.has(cacheKey)) {
      return this.inflightRequests.get(cacheKey);
    }
    const promise = (async () => {
      try {
        return await loader();
      } finally {
        this.inflightRequests.delete(cacheKey);
      }
    })();
    this.inflightRequests.set(cacheKey, promise);
    return promise;
  }

  async listRows({
    filters = [],
    limitNum = 1000,
    orderBy = null,
    ascending = false,
    count = false,
    columns = REVIEW_BASE_COLUMNS,
  } = {}) {
    let query = supabase
      .from(this.reviewCollection)
      .select(columns, count ? { count: "exact" } : undefined);

    for (const filter of filters) {
      if (!filter?.field) continue;
      if (filter.operator === "in") {
        query = query.in(filter.field, filter.value || []);
      } else {
        query = query.eq(filter.field, filter.value);
      }
    }

    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }
    if (Number.isFinite(limitNum) && limitNum > 0) {
      query = query.limit(limitNum);
    }

    const { data, error, count: totalCount } = await query;
    throwIfSupabaseError(error, "Failed to load feedback.");
    return {
      rows: normalizeRows(data || []),
      total: Number.isFinite(totalCount) ? totalCount : (data || []).length,
    };
  }

  async createRow(data) {
    const timestamp = new Date().toISOString();
    const payload = {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const { data: created, error } = await supabase
      .from(this.reviewCollection)
      .insert(payload)
      .select("*")
      .single();
    throwIfSupabaseError(error, "Failed to create feedback.");
    return normalizeRow(created);
  }

  async updateRow(docId, data) {
    const payload = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from(this.reviewCollection)
      .update(payload)
      .eq("id", docId)
      .select("*")
      .single();
    throwIfSupabaseError(error, "Failed to update feedback.");
    return normalizeRow(updated);
  }

  async getFacultyReviews(facultyId, limitNum = 20) {
    const rows = await this.getFacultyRows(facultyId);
    return rows
      .filter((row) => String(row?.review || "").trim().length > 0)
      .slice(0, limitNum);
  }

  async getFacultyRatings(facultyId, limitNum = 200) {
    const rows = await this.getFacultyRows(facultyId);
    return rows.slice(0, limitNum);
  }

  async getAllRatings(limitNum = 10000) {
    const cacheKey = `allRatings_${limitNum}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== undefined) return cached;

    return this.getOrCreateInflight(cacheKey, async () => {
      const actualLimit = Math.min(limitNum, 5000);
      const response = await this.listRows({
        limitNum: actualLimit,
      });
      const result = this.sortRowsByFieldDesc(
        response.rows || [],
        "createdAt",
      ).slice(0, limitNum);
      this.setCachedValue(cacheKey, result);
      return result;
    });
  }

  async getFeedbackTotalCount() {
    if (
      Number.isFinite(this.feedbackTotalCountCache) &&
      this.feedbackTotalCountExpiry > Date.now()
    ) {
      return this.feedbackTotalCountCache;
    }

    return this.getOrCreateInflight("feedbackTotalCount", async () => {
      const { count, error } = await supabase
        .from(this.reviewCollection)
        .select("id", { count: "exact", head: true });
      throwIfSupabaseError(error, "Failed to count feedback.");
      const total = Number(count || 0);
      this.feedbackTotalCountCache = total;
      this.feedbackTotalCountExpiry = Date.now() + this.FEEDBACK_CACHE_TTL_MS;
      return total;
    });
  }

  async getRecentFeedbackEntries(limitNum = 200) {
    const cacheKey = `recentFeedback_${limitNum}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== undefined) return cached;

    return this.getOrCreateInflight(cacheKey, async () => {
      const response = await this.listRows({
        orderBy: "updatedAt",
        ascending: false,
        limitNum,
      });
      const rows = response.rows || [];
      this.setCachedValue(cacheKey, rows);
      return rows;
    });
  }

  async getFacultyRows(facultyId, limitNum = this.FACULTY_ROWS_FETCH_LIMIT) {
    const id = String(facultyId || "").trim();
    if (!id) return [];

    const cacheKey = `facultyRows_${id}_${limitNum}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== undefined) return cached;

    return this.getOrCreateInflight(cacheKey, async () => {
      const response = await this.listRows({
        filters: [{ field: "facultyId", value: id }],
        limitNum,
      });
      const rows = this.sortRowsByFieldDesc(response.rows || [], "createdAt");
      this.setCachedValue(cacheKey, rows);
      return rows;
    });
  }

  async buildRatingsSummarySnapshot(actualLimit = 5000) {
    const response = await this.listRows({
      limitNum: actualLimit,
    });
    const ratingAgg = {};
    const byFacultyTypeAgg = {};
    const byFacultyCourseAgg = {};
    const byFacultyCourseTypeAgg = {};
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

    const extractSectionStats = (row) => {
      const stats = {};
      for (const [sectionKey, fields] of Object.entries(SECTION_FIELDS)) {
        let scoreSum = 0;
        let scoreCount = 0;
        for (const field of fields) {
          const value = Number(row?.[field]);
          if (Number.isFinite(value) && value >= 1 && value <= 5) {
            scoreSum += value;
            scoreCount += 1;
          }
        }
        stats[sectionKey] = { scoreSum, scoreCount };
      }
      return stats;
    };

    for (const row of response.rows || []) {
      const facultyId = String(row.facultyId || "").trim();
      if (row.userId) userSet.add(String(row.userId));
      if (facultyId) {
        facultyCounts[facultyId] = (facultyCounts[facultyId] || 0) + 1;
      }
      if (!facultyId) continue;

      const { scoreSum, scoreCount } = extractRatingStats(row);
      const sectionStats = extractSectionStats(row);
      if (scoreCount > 0) {
        if (!ratingAgg[facultyId]) {
          ratingAgg[facultyId] = { scoreSum: 0, scoreCount: 0, rowCount: 0 };
        }
        ratingAgg[facultyId].scoreSum += scoreSum;
        ratingAgg[facultyId].scoreCount += scoreCount;
        ratingAgg[facultyId].rowCount += 1;
      }

      for (const [sectionKey, stats] of Object.entries(sectionStats)) {
        if (stats.scoreCount <= 0) continue;
        if (!byFacultyTypeAgg[facultyId]) byFacultyTypeAgg[facultyId] = {};
        if (!byFacultyTypeAgg[facultyId][sectionKey]) {
          byFacultyTypeAgg[facultyId][sectionKey] = {
            scoreSum: 0,
            scoreCount: 0,
            rowCount: 0,
          };
        }
        byFacultyTypeAgg[facultyId][sectionKey].scoreSum += stats.scoreSum;
        byFacultyTypeAgg[facultyId][sectionKey].scoreCount += stats.scoreCount;
        byFacultyTypeAgg[facultyId][sectionKey].rowCount += 1;
      }

      const courseId = String(row.courseId || "").trim();
      if (courseId) {
        if (!courseLookup[courseId]) courseLookup[courseId] = new Set();
        courseLookup[courseId].add(facultyId);

        if (scoreCount > 0) {
          if (!byFacultyCourseAgg[facultyId])
            byFacultyCourseAgg[facultyId] = {};
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

        for (const [sectionKey, stats] of Object.entries(sectionStats)) {
          if (stats.scoreCount <= 0) continue;
          if (!byFacultyCourseTypeAgg[facultyId])
            byFacultyCourseTypeAgg[facultyId] = {};
          if (!byFacultyCourseTypeAgg[facultyId][courseId]) {
            byFacultyCourseTypeAgg[facultyId][courseId] = {};
          }
          if (!byFacultyCourseTypeAgg[facultyId][courseId][sectionKey]) {
            byFacultyCourseTypeAgg[facultyId][courseId][sectionKey] = {
              scoreSum: 0,
              scoreCount: 0,
              rowCount: 0,
            };
          }
          byFacultyCourseTypeAgg[facultyId][courseId][sectionKey].scoreSum +=
            stats.scoreSum;
          byFacultyCourseTypeAgg[facultyId][courseId][sectionKey].scoreCount +=
            stats.scoreCount;
          byFacultyCourseTypeAgg[facultyId][courseId][sectionKey].rowCount += 1;
        }
      }
    }

    const ratings = {};
    const counts = {};
    const byFacultyCourse = {};
    const byFacultyType = {};
    const byFacultyCourseType = {};

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

    for (const [fid, sectionMap] of Object.entries(byFacultyTypeAgg)) {
      byFacultyType[fid] = {};
      for (const [sectionKey, item] of Object.entries(sectionMap)) {
        byFacultyType[fid][sectionKey] = {
          average:
            item.scoreCount > 0
              ? Number((item.scoreSum / item.scoreCount).toFixed(2))
              : null,
          rowCount: item.rowCount || 0,
        };
      }
    }

    for (const [fid, courseMap] of Object.entries(byFacultyCourseTypeAgg)) {
      byFacultyCourseType[fid] = {};
      for (const [courseId, sectionMap] of Object.entries(courseMap)) {
        byFacultyCourseType[fid][courseId] = {};
        for (const [sectionKey, item] of Object.entries(sectionMap)) {
          byFacultyCourseType[fid][courseId][sectionKey] = {
            average:
              item.scoreCount > 0
                ? Number((item.scoreSum / item.scoreCount).toFixed(2))
                : null,
            rowCount: item.rowCount || 0,
          };
        }
      }
    }

    return {
      ratings,
      counts,
      byFacultyType,
      byFacultyCourse,
      byFacultyCourseType,
      courseLookup,
      facultyCounts,
      totalReviews: (response.rows || []).length,
      uniqueUserCount: userSet.size,
    };
  }

  normalizeRatingsSummaryPayload(payload) {
    if (!payload) return null;
    if (payload.summary && typeof payload.summary === "object") {
      return {
        ...payload,
        summary: this.normalizeRatingsSummary(payload.summary),
      };
    }
    return {
      summary: this.normalizeRatingsSummary(payload),
      refreshedAt: 0,
    };
  }

  normalizeRatingsSummary(summary) {
    if (!summary || typeof summary !== "object") return null;

    const normalizedCourseLookup = {};
    for (const [courseId, facultyIds] of Object.entries(
      summary.courseLookup || {},
    )) {
      if (facultyIds instanceof Set) {
        normalizedCourseLookup[courseId] = facultyIds;
        continue;
      }

      if (Array.isArray(facultyIds)) {
        normalizedCourseLookup[courseId] = new Set(
          facultyIds.map((value) => String(value || "").trim()).filter(Boolean),
        );
        continue;
      }

      if (facultyIds && typeof facultyIds === "object") {
        normalizedCourseLookup[courseId] = new Set(
          Object.keys(facultyIds)
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        );
        continue;
      }

      normalizedCourseLookup[courseId] = new Set();
    }

    return {
      ratings: summary.ratings || {},
      counts: summary.counts || {},
      byFacultyType: summary.byFacultyType || {},
      byFacultyCourse: summary.byFacultyCourse || {},
      byFacultyCourseType: summary.byFacultyCourseType || {},
      courseLookup: normalizedCourseLookup,
      facultyCounts: summary.facultyCounts || {},
      totalReviews: Number(summary.totalReviews || 0),
      uniqueUserCount: Number(summary.uniqueUserCount || 0),
    };
  }

  isEmptyRatingsSummary(summary) {
    if (!summary || typeof summary !== "object") return true;
    if (Number(summary.totalReviews || 0) > 0) return false;
    if (Object.keys(summary.ratings || {}).length > 0) return false;
    if (Object.keys(summary.counts || {}).length > 0) return false;
    if (Object.keys(summary.byFacultyType || {}).length > 0) return false;
    if (Object.keys(summary.byFacultyCourse || {}).length > 0) return false;
    if (Object.keys(summary.byFacultyCourseType || {}).length > 0) return false;
    return true;
  }

  hasTypeBreakdown(summary) {
    return Boolean(
      summary &&
      typeof summary === "object" &&
      summary.byFacultyType &&
      summary.byFacultyCourseType,
    );
  }

  refreshRatingsSummaryInBackground(cacheKey, actualLimit) {
    if (this.ratingsSummaryRefreshInflight.has(cacheKey)) return;
    const refreshPromise = (async () => {
      try {
        const summary = await this.buildRatingsSummarySnapshot(actualLimit);
        this.feedbackCache.set(cacheKey, {
          value: summary,
          expiresAt: Date.now() + this.FEEDBACK_CACHE_TTL_MS,
        });
        this.writePersistentCache(cacheKey, {
          summary,
          refreshedAt: Date.now(),
        });
      } catch {
      } finally {
        this.ratingsSummaryRefreshInflight.delete(cacheKey);
      }
    })();
    this.ratingsSummaryRefreshInflight.set(cacheKey, refreshPromise);
  }

  async refreshRatingsSummary(limitNum = 10000) {
    const actualLimit = Math.min(limitNum, 5000);
    const cacheKey = `ratingsSummary_${actualLimit}`;
    const summary = await this.buildRatingsSummarySnapshot(actualLimit);
    this.feedbackCache.set(cacheKey, {
      value: summary,
      expiresAt: Date.now() + this.FEEDBACK_CACHE_TTL_MS,
    });
    this.writePersistentCache(cacheKey, {
      summary,
      refreshedAt: Date.now(),
    });
    return summary;
  }

  async getRatingsSummary(limitNum = 10000) {
    const actualLimit = Math.min(limitNum, 5000);
    const cacheKey = `ratingsSummary_${actualLimit}`;
    const cached = this.feedbackCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      if (
        !this.hasTypeBreakdown(cached.value) ||
        this.isEmptyRatingsSummary(cached.value)
      ) {
        return this.refreshRatingsSummary(actualLimit);
      }
      return cached.value;
    }

    const persistedPayload = this.normalizeRatingsSummaryPayload(
      this.readPersistentCache(cacheKey),
    );
    if (persistedPayload?.summary) {
      const summary = persistedPayload.summary;
      if (
        !this.hasTypeBreakdown(summary) ||
        this.isEmptyRatingsSummary(summary)
      ) {
        return this.refreshRatingsSummary(actualLimit);
      }
      this.feedbackCache.set(cacheKey, {
        value: summary,
        expiresAt: Date.now() + this.FEEDBACK_CACHE_TTL_MS,
      });

      const refreshedAt = Number(persistedPayload.refreshedAt || 0);
      if (Date.now() - refreshedAt > this.RATINGS_SUMMARY_BG_REFRESH_MS) {
        this.refreshRatingsSummaryInBackground(cacheKey, actualLimit);
      }
      return summary;
    }

    return this.refreshRatingsSummary(actualLimit);
  }

  buildRatingSummary(ratings) {
    const totals = {};
    const counts = {};

    for (const field of RATING_FIELDS) {
      totals[field] = 0;
      counts[field] = 0;
    }

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

      if (row.theoryNotes === true || row.theoryNotes === 1) {
        theoryNotesCount += 1;
      }
      totalTheoryNotes += 1;

      if (row.labNotes && typeof row.labNotes === "string") {
        const noteType = row.labNotes.trim();
        if (Object.hasOwn(labNotesCounts, noteType)) {
          labNotesCounts[noteType] += 1;
        }
        totalLabNotes += 1;
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

    const notesSummary = {};
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

    if (totalLabNotes > 0) {
      const labNotesData = {};
      for (const [noteType, count] of Object.entries(labNotesCounts)) {
        if (noteType === "None" || count <= 0) continue;
        const percentage = Math.round((count / totalLabNotes) * 100);
        if (percentage >= 50) {
          labNotesData[noteType] = {
            count,
            total: totalLabNotes,
            percentage,
          };
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
    const normalizedUserId = String(userId || "").trim();
    const normalizedFacultyId = String(facultyId || "").trim();
    if (!normalizedUserId || !normalizedFacultyId) return null;

    const cacheKey = `userFaculty_${normalizedUserId}_${normalizedFacultyId}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== undefined) return cached;

    return this.getOrCreateInflight(cacheKey, async () => {
      const response = await this.listRows({
        filters: [
          { field: "userId", value: normalizedUserId },
          { field: "facultyId", value: normalizedFacultyId },
        ],
        limitNum: 1,
      });
      const value =
        this.sortRowsByFieldDesc(response.rows || [], "createdAt")[0] || null;
      this.setCachedValue(cacheKey, value);
      return value;
    });
  }

  async getUserFeedbackEntries(userId, limitNum = 200) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) return [];
    const cacheKey = `userFeedbackEntries_${normalizedUserId}_${limitNum}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== undefined) return cached;

    return this.getOrCreateInflight(cacheKey, async () => {
      const response = await this.listRows({
        filters: [{ field: "userId", value: normalizedUserId }],
        limitNum,
      });
      const rows = this.sortRowsByFieldDesc(
        response.rows || [],
        "updatedAt",
      ).slice(0, limitNum);
      const seenFacultyIds = new Set();
      for (const row of rows) {
        const fid = String(row?.facultyId || "").trim();
        if (!fid || seenFacultyIds.has(fid)) continue;
        seenFacultyIds.add(fid);
        this.setCachedValue(`userFaculty_${normalizedUserId}_${fid}`, row);
      }
      this.setCachedValue(cacheKey, rows);
      return rows;
    });
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
    if (typeof review === "string") {
      const reviewValidation = validateReviewText(review);
      if (!reviewValidation.valid) {
        throw new Error(reviewValidation.message || "Invalid review text.");
      }
      payload.review = reviewValidation.text;
    }
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
    const result = existing?.$id
      ? await this.updateRow(existing.$id, payload)
      : await this.createRow(payload);

    const normalizedUserId = String(userId || "").trim();
    const normalizedFacultyId = String(facultyId || "").trim();
    this.feedbackCache.clear();
    this.inflightRequests.clear();
    if (normalizedUserId && normalizedFacultyId) {
      this.setCachedValue(
        `userFaculty_${normalizedUserId}_${normalizedFacultyId}`,
        result,
      );
    }
    this.feedbackTotalCountCache = null;
    this.feedbackTotalCountExpiry = 0;
    this.clearPersistentRatingsSummaryCache();
    return result;
  }

  async submitRating(args) {
    return this.submitFeedback(args);
  }

  async submitReview(args) {
    return this.submitFeedback(args);
  }

  async deleteUserFacultyFeedback(userId, facultyId) {
    if (!String(userId || "").trim()) {
      throw new Error("You must be logged in to delete feedback.");
    }
    const existing = await this.getUserFacultyFeedback(userId, facultyId);
    if (!existing?.$id) return null;

    const { error } = await supabase
      .from(this.reviewCollection)
      .delete()
      .eq("id", existing.$id);
    throwIfSupabaseError(error, "Failed to delete feedback.");

    const normalizedUserId = String(userId || "").trim();
    const normalizedFacultyId = String(facultyId || "").trim();
    this.feedbackCache.clear();
    this.inflightRequests.clear();
    if (normalizedUserId && normalizedFacultyId) {
      this.setCachedValue(
        `userFaculty_${normalizedUserId}_${normalizedFacultyId}`,
        null,
      );
    }
    this.feedbackTotalCountCache = null;
    this.feedbackTotalCountExpiry = 0;
    this.clearPersistentRatingsSummaryCache();
    return existing;
  }

  async deleteFeedbackById(rowId) {
    if (!String(rowId || "").trim()) return null;
    const { error } = await supabase
      .from(this.reviewCollection)
      .delete()
      .eq("id", rowId);
    throwIfSupabaseError(error, "Failed to delete feedback.");
    this.feedbackCache.clear();
    this.inflightRequests.clear();
    this.feedbackTotalCountCache = null;
    this.feedbackTotalCountExpiry = 0;
    this.clearPersistentRatingsSummaryCache();
    return { $id: rowId };
  }

  async deleteAllUserFeedback(userId) {
    const rows = await this.getUserFeedbackEntries(userId, 5000);
    if (!rows.length) return 0;
    const { error } = await supabase
      .from(this.reviewCollection)
      .delete()
      .eq("userId", String(userId || "").trim());
    throwIfSupabaseError(error, "Failed to delete user feedback.");
    this.feedbackCache.clear();
    this.inflightRequests.clear();
    this.feedbackTotalCountCache = null;
    this.feedbackTotalCountExpiry = 0;
    this.clearPersistentRatingsSummaryCache();
    return rows.length;
  }
}

const facultyFeedbackService = new FacultyFeedbackService();
export default facultyFeedbackService;
