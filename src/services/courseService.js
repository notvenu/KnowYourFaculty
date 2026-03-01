import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase/client.js";
import clientConfig from "../config/client.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeCourseCode(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[\s-]+/g, "");
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
  allCoursesInflight = null;
  courseByIdCache = new Map();
  courseByIdCacheExpiry = new Map();
  CACHE_TTL_MS = 50 * 60 * 1000;  // Courses rarely change, cache for 50 min

  constructor() {}

  get coursesTableId() {
    return this.coursesCollection;
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
      throw error;
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
      throw error;
    }
  }

  clearCourseCache() {
    this.allCoursesCache = null;
    this.allCoursesCacheExpiry = 0;
    this.allCoursesInflight = null;
    this.courseByIdCache.clear();
  }

  async getCourseById(courseId) {
    const id = normalizeText(courseId);
    if (!id) return null;

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

    try {
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
    } catch (error) {
      return null;
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

    // Batch-fetch in 30-item chunks using 'in' operator
    const chunks = [];
    for (let i = 0; i < uncached.length; i += 30) {
      chunks.push(uncached.slice(i, i + 30));
    }

    for (const chunk of chunks) {
      try {
        // Note: Firestore requires doc IDs to be queried via a query on collection,
        // not via 'in' operator on __name__. We'll need to read them individually or
        // store course code as a field and index by that instead. For now, use individual gets.
        const promises = chunk.map((id) =>
          getDoc(doc(db, this.coursesCollection, id))
            .then((snap) => ({ id, snap }))
            .catch(() => ({ id, snap: null }))
        );

        const results = await Promise.all(promises);
        for (const { id, snap } of results) {
          if (snap && snap.exists()) {
            const row = {
              $id: snap.id,
              ...snap.data(),
            };
            result[id] = row;
            this.courseByIdCache.set(id, row);
            this.courseByIdCacheExpiry.set(id, Date.now() + this.CACHE_TTL_MS);
          } else {
            result[id] = null;
            this.courseByIdCache.set(id, null);
            this.courseByIdCacheExpiry.set(id, Date.now() + this.CACHE_TTL_MS);
          }
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
      for (const row of rows) {
        const rowId = normalizeText(row?.$id);
        if (rowId) this.courseByIdCache.set(rowId, row);
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
    const normalized = normalizeText(query).toLowerCase();
    const courses = await this.getAllCourses();
    const filtered = normalized
      ? courses.filter((course) => {
          const code = normalizeText(course.courseCode).toLowerCase();
          const name = normalizeText(course.courseName).toLowerCase();
          return code.includes(normalized) || name.includes(normalized);
        })
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
