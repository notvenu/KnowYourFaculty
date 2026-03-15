import clientConfig from "../config/client.js";
import { fuzzyScoreAny } from "../lib/fuzzySearch.js";
import { supabase } from "../lib/supabase/client.js";
import {
  applyInChunks,
  normalizeRow,
  normalizeRows,
  throwIfSupabaseError,
} from "../lib/supabase/helpers.js";

const COURSE_COLUMNS = ["id", "courseCode", "courseName", "createdAt", "updatedAt"].join(", ");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeCourseCode(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

function normalizeSearchText(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeSearchCompact(value) {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, "");
}

function mergeCoursesByCode(courses = []) {
  const merged = new Map();

  for (const item of courses) {
    const courseCode = normalizeCourseCode(item?.courseCode);
    const courseName = normalizeText(item?.courseName);
    if (!courseCode || !courseName) continue;

    const existing = merged.get(courseCode);
    if (!existing || courseName.length > existing.courseName.length) {
      merged.set(courseCode, { courseCode, courseName });
    }
  }

  return [...merged.values()];
}

class CourseService {
  coursesCollection = clientConfig.supabaseCoursesTable;
  allCoursesCache = null;
  allCoursesCacheExpiry = 0;
  allCoursesCacheLimit = 0;
  allCoursesInflight = null;
  courseByIdCache = new Map();
  courseByIdCacheExpiry = new Map();
  courseByIdInflight = new Map();
  CACHE_TTL_MS = 50 * 60 * 1000;
  PERSISTENT_CACHE_PREFIX = "kyf.courses.v2";
  PERSISTENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  constructor() {
    this.hydrateAllCoursesFromPersistentCache();
  }

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
    } catch {
    }
  }

  removePersistentCache(suffix) {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.removeItem(this.getPersistentKey(suffix));
    } catch {
    }
  }

  hydrateAllCoursesFromPersistentCache() {
    const persisted = this.readPersistentCache("allCourses:v2");
    if (!Array.isArray(persisted) || persisted.length === 0) return;
    this.allCoursesCache = persisted;
    this.allCoursesCacheLimit = persisted.length;
    this.allCoursesCacheExpiry = Date.now() + this.CACHE_TTL_MS;
    for (const row of persisted) {
      const rowId = normalizeText(row?.$id);
      if (!rowId) continue;
      this.courseByIdCache.set(rowId, row);
      this.courseByIdCacheExpiry.set(rowId, Date.now() + this.CACHE_TTL_MS);
    }
  }

  async createRow(data) {
    const timestamp = new Date().toISOString();
    const payload = {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const { data: created, error } = await supabase
      .from(this.coursesCollection)
      .insert(payload)
      .select("*")
      .single();
    throwIfSupabaseError(error, "Failed to create course.");
    this.clearCourseCache();
    return normalizeRow(created);
  }

  async updateRow(docId, data) {
    const payload = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const { data: updated, error } = await supabase
      .from(this.coursesCollection)
      .update(payload)
      .eq("id", docId)
      .select("*")
      .single();
    throwIfSupabaseError(error, "Failed to update course.");
    this.clearCourseCache();
    return normalizeRow(updated);
  }

  clearCourseCache() {
    this.allCoursesCache = null;
    this.allCoursesCacheExpiry = 0;
    this.allCoursesCacheLimit = 0;
    this.allCoursesInflight = null;
    this.courseByIdCache.clear();
    this.courseByIdCacheExpiry.clear();
    this.courseByIdInflight.clear();
    this.removePersistentCache("allCourses:v2");
  }

  async getCourseById(courseId) {
    const id = normalizeText(courseId);
    if (!id) return null;

    if (this.allCoursesCache && this.allCoursesCacheExpiry > Date.now()) {
      const row =
        (this.allCoursesCache || []).find((course) => String(course?.$id || "") === id) ||
        null;
      this.courseByIdCache.set(id, row);
      this.courseByIdCacheExpiry.set(id, Date.now() + this.CACHE_TTL_MS);
      return row;
    }

    if (this.courseByIdCache.has(id)) {
      const expiry = this.courseByIdCacheExpiry.get(id);
      if (expiry && expiry > Date.now()) {
        return this.courseByIdCache.get(id);
      }
      this.courseByIdCache.delete(id);
      this.courseByIdCacheExpiry.delete(id);
    }

    if (this.courseByIdInflight.has(id)) {
      return this.courseByIdInflight.get(id);
    }

    const fetchPromise = (async () => {
      const { data, error } = await supabase
        .from(this.coursesCollection)
        .select(COURSE_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      throwIfSupabaseError(error, "Failed to load course.");
      const row = data ? normalizeRow(data) : null;
      this.courseByIdCache.set(id, row);
      this.courseByIdCacheExpiry.set(id, Date.now() + this.CACHE_TTL_MS);
      return row;
    })();

    this.courseByIdInflight.set(id, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this.courseByIdInflight.delete(id);
    }
  }

  async getCourseByIdBatch(courseIds = []) {
    const sanitized = Array.from(
      new Set((courseIds || []).map((id) => normalizeText(id)).filter(Boolean)),
    );
    if (sanitized.length === 0) return {};

    const result = {};
    const uncached = [];
    for (const id of sanitized) {
      if (this.courseByIdCache.has(id)) {
        const expiry = this.courseByIdCacheExpiry.get(id);
        if (expiry && expiry > Date.now()) {
          result[id] = this.courseByIdCache.get(id);
          continue;
        }
        this.courseByIdCache.delete(id);
        this.courseByIdCacheExpiry.delete(id);
      }
      uncached.push(id);
    }

    if (uncached.length === 0) return result;

    if (this.allCoursesCache && this.allCoursesCacheExpiry > Date.now()) {
      const allById = new Map(
        (this.allCoursesCache || []).map((row) => [String(row?.$id || ""), row]),
      );
      for (const id of uncached) {
        const row = allById.get(id) || null;
        result[id] = row;
        this.courseByIdCache.set(id, row);
        this.courseByIdCacheExpiry.set(id, Date.now() + this.CACHE_TTL_MS);
      }
      return result;
    }

    for (const chunk of applyInChunks(uncached, 100)) {
      const { data, error } = await supabase
        .from(this.coursesCollection)
        .select(COURSE_COLUMNS)
        .in("id", chunk);
      throwIfSupabaseError(error, "Failed to load courses.");
      const rows = normalizeRows(data || []);
      const rowMap = new Map(rows.map((row) => [String(row.$id), row]));
      for (const id of chunk) {
        const row = rowMap.get(id) || null;
        result[id] = row;
        this.courseByIdCache.set(id, row);
        this.courseByIdCacheExpiry.set(id, Date.now() + this.CACHE_TTL_MS);
      }
    }

    return result;
  }

  async getCourseByCode(courseCode) {
    const normalizedCode = normalizeCourseCode(courseCode);
    if (!normalizedCode) return null;

    const { data, error } = await supabase
      .from(this.coursesCollection)
      .select(COURSE_COLUMNS)
      .eq("courseCode", normalizedCode)
      .limit(1)
      .maybeSingle();
    throwIfSupabaseError(error, "Failed to load course by code.");
    return data ? normalizeRow(data) : null;
  }

  async createOrUpdateCourse({ courseCode, courseName }) {
    const normalizedCode = normalizeCourseCode(courseCode);
    const normalizedName = normalizeText(courseName);

    if (!normalizedCode || !normalizedName) {
      throw new Error("Course code and course name are required.");
    }

    const payload = {
      courseCode: normalizedCode,
      courseName: normalizedName,
    };

    const existing = await this.getCourseByCode(normalizedCode);
    if (existing?.$id) {
      return this.updateRow(existing.$id, payload);
    }
    return this.createRow(payload);
  }

  async getAllCourses(limitNum = 5000) {
    if (
      this.allCoursesCache &&
      this.allCoursesCacheExpiry > Date.now() &&
      this.allCoursesCacheLimit === limitNum
    ) {
      return this.allCoursesCache;
    }

    if (this.allCoursesInflight && this.allCoursesCacheLimit === limitNum) {
      return this.allCoursesInflight;
    }

    this.allCoursesCacheLimit = limitNum;
    this.allCoursesInflight = (async () => {
      const { data, error } = await supabase
        .from(this.coursesCollection)
        .select(COURSE_COLUMNS)
        .order("courseCode", { ascending: true })
        .limit(limitNum);
      throwIfSupabaseError(error, "Failed to load courses.");
      const rows = normalizeRows(data || []);
      this.allCoursesCache = rows;
      this.allCoursesCacheExpiry = Date.now() + this.CACHE_TTL_MS;
      this.writePersistentCache("allCourses:v2", rows);
      for (const row of rows) {
        const rowId = normalizeText(row?.$id);
        if (!rowId) continue;
        this.courseByIdCache.set(rowId, row);
        this.courseByIdCacheExpiry.set(rowId, Date.now() + this.CACHE_TTL_MS);
      }
      return rows;
    })();

    try {
      return await this.allCoursesInflight;
    } finally {
      this.allCoursesInflight = null;
    }
  }

  async searchCourses(query, limit = 10) {
    const normalized = normalizeText(query);
    const normalizedLower = normalizeSearchText(query);
    const normalizedCompact = normalizeSearchCompact(query);
    const courses = await this.getAllCourses();
    const filtered = normalized
      ? courses
          .map((course) => {
            const code = normalizeText(course.courseCode);
            const name = normalizeText(course.courseName);
            const codeLower = normalizeSearchText(code);
            const nameLower = normalizeSearchText(name);
            const codeCompact = normalizeSearchCompact(code);
            const nameCompact = normalizeSearchCompact(name);
            let score = 0;

            if (normalizedLower && codeLower === normalizedLower) score += 1200;
            if (normalizedLower && nameLower === normalizedLower) score += 1100;
            if (normalizedLower && codeLower.startsWith(normalizedLower)) score += 1000;
            if (normalizedLower && nameLower.startsWith(normalizedLower)) score += 900;
            if (normalizedLower && codeLower.includes(normalizedLower)) score += 700;
            if (normalizedLower && nameLower.includes(normalizedLower)) score += 650;
            if (normalizedCompact && codeCompact.includes(normalizedCompact)) score += 400;
            if (normalizedCompact && nameCompact.includes(normalizedCompact)) score += 350;

            if (score <= 0) {
              score = fuzzyScoreAny([code, name], normalized);
            }

            return { course, score };
          })
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.course)
      : courses;

    return filtered.slice(0, limit);
  }

  async upsertCoursesFromPdf({ courses }) {
    const mergedCourses = mergeCoursesByCode(courses);
    if (mergedCourses.length === 0) {
      throw new Error("No valid courses found in the uploaded PDF.");
    }

    const existingCourses = await this.getAllCourses(5000);
    const existingByCode = new Map(
      (existingCourses || [])
        .map((row) => [normalizeCourseCode(row.courseCode), row])
        .filter(([code]) => code),
    );

    let created = 0;
    let updated = 0;

    for (const course of mergedCourses) {
      const existing = existingByCode.get(course.courseCode);
      const payload = {
        courseCode: course.courseCode,
        courseName: course.courseName,
      };

      if (existing?.$id) {
        await this.updateRow(existing.$id, payload);
        updated += 1;
      } else {
        await this.createRow(payload);
        created += 1;
      }
    }

    return {
      parsedCount: Array.isArray(courses) ? courses.length : 0,
      mergedCount: mergedCourses.length,
      created,
      updated,
    };
  }
}

const courseService = new CourseService();
export default courseService;
