import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  documentId,
  addDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase/client.js";
import clientConfig from "../config/client.js";
import { fuzzyScoreAny } from "../lib/fuzzySearch.js";

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

function toFriendlyCourseWriteError(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "");
  const lowerMessage = message.toLowerCase();
  if (
    code.includes("permission-denied") ||
    lowerMessage.includes("missing or insufficient permissions")
  ) {
    return new Error(
      "Missing Firestore write permission for courses. Ensure your account is listed in VITE_ADMIN_EMAILS and Firebase rules allow admin writes to the courses collection.",
    );
  }
  return error;
}

function mergeCoursesByCode(courses = []) {
  const merged = new Map();

  for (const item of courses) {
    const courseCode = normalizeCourseCode(item?.courseCode);
    const courseName = normalizeText(item?.courseName);
    if (!courseCode || !courseName) continue;

    const existing = merged.get(courseCode);
    if (!existing) {
      merged.set(courseCode, { courseCode, courseName });
      continue;
    }

    // Keep the richer name when duplicates exist.
    if (courseName.length > existing.courseName.length) {
      merged.set(courseCode, { courseCode, courseName });
    }
  }

  return [...merged.values()];
}

class CourseService {
  coursesCollection = clientConfig.firebaseCoursesCollection;
  allCoursesCache = null;
  allCoursesCacheExpiry = 0;
  allCoursesCacheLimit = 0;
  allCoursesInflight = null;
  courseByIdCache = new Map();
  courseByIdCacheExpiry = new Map();
  courseByIdInflight = new Map();
  CACHE_TTL_MS = 50 * 60 * 1000;  // Courses rarely change, cache for 50 min
  PERSISTENT_CACHE_PREFIX = "kyf.courses";
  PERSISTENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  constructor() {
    this.hydrateAllCoursesFromPersistentCache();
  }

  get coursesTableId() {
    return this.coursesCollection;
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
      // ignore storage write issues
    }
  }

  removePersistentCache(suffix) {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.removeItem(this.getPersistentKey(suffix));
    } catch {
      // ignore storage cleanup issues
    }
  }

  hydrateAllCoursesFromPersistentCache() {
    const persisted = this.readPersistentCache("allCourses:v1");
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

  async listRows(constraints = []) {
    try {
      // Add default limit if not specified
      // OPTIMIZATION: Default to 1000 instead of 5000 for efficiency
      let constraints_copy = [...(constraints || [])];
      if (!constraints_copy.some((c) => c.type === "limit")) {
        constraints_copy.push(limit(1000));
      }

      const q = query(collection(db, this.coursesCollection), ...constraints_copy);
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

  async createRow(data) {
    try {
      const payload = {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, this.coursesCollection), payload);
      this.clearCourseCache();
      return {
        $id: docRef.id,
        ...payload,
      };
    } catch (error) {
      throw toFriendlyCourseWriteError(error);
    }
  }

  async updateRow(docId, data) {
    try {
      const docRef = doc(db, this.coursesCollection, docId);
      const payload = {
        ...data,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(docRef, payload);
      this.clearCourseCache();

      // OPTIMIZATION: Return optimistic update instead of extra getDoc()
      return {
        $id: docId,
        ...payload,
      };
    } catch (error) {
      throw toFriendlyCourseWriteError(error);
    }
  }

  clearCourseCache() {
    this.allCoursesCache = null;
    this.allCoursesCacheExpiry = 0;
    this.allCoursesCacheLimit = 0;
    this.allCoursesInflight = null;
    this.courseByIdCache.clear();
    this.courseByIdCacheExpiry.clear();
    this.courseByIdInflight.clear();
    this.removePersistentCache("allCourses:v1");
  }

  async getCourseById(courseId) {
    const id = normalizeText(courseId);
    if (!id) return null;

    if (this.allCoursesCache && this.allCoursesCacheExpiry > Date.now()) {
      const row = (this.allCoursesCache || []).find(
        (course) => String(course?.$id || "") === id,
      );
      const value = row || null;
      this.courseByIdCache.set(id, value);
      this.courseByIdCacheExpiry.set(id, Date.now() + this.CACHE_TTL_MS);
      return value;
    }

    // Check cache with expiry
    if (this.courseByIdCache.has(id)) {
      const expiry = this.courseByIdCacheExpiry.get(id);
      if (expiry && expiry > Date.now()) {
        return this.courseByIdCache.get(id);
      }
      // Expired, remove it
      this.courseByIdCache.delete(id);
      this.courseByIdCacheExpiry.delete(id);
    }

    if (this.courseByIdInflight.has(id)) {
      return this.courseByIdInflight.get(id);
    }

    try {
      const fetchPromise = (async () => {
        const docRef = doc(db, this.coursesCollection, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          this.courseByIdCache.set(id, null);
          this.courseByIdCacheExpiry.set(id, Date.now() + this.CACHE_TTL_MS);
          return null;
        }

        const row = {
          $id: docSnap.id,
          ...docSnap.data(),
        };
        this.courseByIdCache.set(id, row);
        this.courseByIdCacheExpiry.set(id, Date.now() + this.CACHE_TTL_MS);
        return row;
      })();
      this.courseByIdInflight.set(id, fetchPromise);
      return await fetchPromise;
    } catch (error) {
      return null;
    } finally {
      this.courseByIdInflight.delete(id);
    }
  }

  /**
   * Batch-fetch courses by multiple IDs to avoid N+1 queries
   * Returns { [courseId]: course_object or null }
   */
  async getCourseByIdBatch(courseIds = []) {
    const sanitized = Array.from(
      new Set(
        (courseIds || [])
          .map((id) => normalizeText(id))
          .filter(Boolean)
      )
    );
    if (sanitized.length === 0) return {};

    const result = {};
    const uncached = [];

    // Check what's already cached
    for (const id of sanitized) {
      if (this.courseByIdCache.has(id)) {
        const expiry = this.courseByIdCacheExpiry.get(id);
        if (expiry && expiry > Date.now()) {
          result[id] = this.courseByIdCache.get(id);
        } else {
          this.courseByIdCache.delete(id);
          this.courseByIdCacheExpiry.delete(id);
          uncached.push(id);
        }
      } else {
        uncached.push(id);
      }
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

    // Batch-fetch in 30-item chunks using 'in' operator
    const chunks = [];
    for (let i = 0; i < uncached.length; i += 30) {
      chunks.push(uncached.slice(i, i + 30));
    }

    for (const chunk of chunks) {
      try {
        const q = query(
          collection(db, this.coursesCollection),
          where(documentId(), "in", chunk),
        );
        const snapshot = await getDocs(q);
        const foundIds = new Set();
        snapshot.docs.forEach((docSnapshot) => {
          const row = { $id: docSnapshot.id, ...docSnapshot.data() };
          const id = String(row?.$id || "");
          if (!id) return;
          foundIds.add(id);
          result[id] = row;
          this.courseByIdCache.set(id, row);
          this.courseByIdCacheExpiry.set(id, Date.now() + this.CACHE_TTL_MS);
        });
        for (const id of chunk) {
          if (foundIds.has(id)) continue;
          result[id] = null;
          this.courseByIdCache.set(id, null);
          this.courseByIdCacheExpiry.set(id, Date.now() + this.CACHE_TTL_MS);
        }
      } catch (error) {
        for (const id of chunk) {
          result[id] = null;
        }
      }
    }

    return result;
  }

  async getCourseByCode(courseCode) {
    const normalizedCode = normalizeCourseCode(courseCode);
    if (!normalizedCode) return null;

    const response = await this.listRows([
      where("courseCode", "==", normalizedCode),
      limit(1),
    ]);
    return response.rows?.[0] || null;
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

  async getAllCourses(limit_num = 5000) {
    if (
      this.allCoursesCache &&
      this.allCoursesCacheExpiry > Date.now() &&
      this.allCoursesCacheLimit === limit_num
    ) {
      return this.allCoursesCache;
    }

    if (this.allCoursesInflight && this.allCoursesCacheLimit === limit_num) {
      return this.allCoursesInflight;
    }

    this.allCoursesCacheLimit = limit_num;
    this.allCoursesInflight = (async () => {
      const response = await this.listRows([
        orderBy("courseCode", "asc"),
        limit(limit_num),
      ]);
      const rows = response.rows || [];
      this.allCoursesCache = rows;
      this.allCoursesCacheExpiry = Date.now() + this.CACHE_TTL_MS;
      this.writePersistentCache("allCourses:v1", rows);
      for (const row of rows) {
        const rowId = normalizeText(row?.$id);
        if (rowId) {
          this.courseByIdCache.set(rowId, row);
          this.courseByIdCacheExpiry.set(rowId, Date.now() + this.CACHE_TTL_MS);
        }
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

            // Deterministic contains/prefix matching first.
            if (normalizedLower && codeLower === normalizedLower) score += 1200;
            if (normalizedLower && nameLower === normalizedLower) score += 1100;
            if (normalizedLower && codeLower.startsWith(normalizedLower)) score += 1000;
            if (normalizedLower && nameLower.startsWith(normalizedLower)) score += 900;
            if (normalizedLower && codeLower.includes(normalizedLower)) score += 700;
            if (normalizedLower && nameLower.includes(normalizedLower)) score += 650;
            if (normalizedCompact && codeCompact.includes(normalizedCompact)) score += 400;
            if (normalizedCompact && nameCompact.includes(normalizedCompact)) score += 350;

            // Fuzzy only as fallback signal.
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
