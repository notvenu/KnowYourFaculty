import { Client, Databases, ID, Query, TablesDB } from "appwrite";
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
  client = new Client();
  databases;
  tablesDB;
  initialized = false;
  initError = null;
  allCoursesCache = null;
  allCoursesCacheExpiry = 0;
  allCoursesInflight = null;
  courseByIdCache = new Map();
  CACHE_TTL_MS = 5 * 60 * 1000;

  constructor() {
    // Validate required configuration
    if (!clientConfig.appwriteUrl || !clientConfig.appwriteProjectId) {
      this.initError = `Missing Appwrite configuration. URL: ${!!clientConfig.appwriteUrl}, ProjectID: ${!!clientConfig.appwriteProjectId}`;
      console.error("CourseService initialization failed:", this.initError);
      return;
    }

    try {
      this.client
        .setEndpoint(clientConfig.appwriteUrl)
        .setProject(clientConfig.appwriteProjectId);

      this.databases = new Databases(this.client);
      this.tablesDB = new TablesDB(this.client);
      this.initialized = true;
    } catch (error) {
      this.initError = error?.message || "Failed to initialize Appwrite client";
      console.error("CourseService initialization error:", error);
    }
  }

  get coursesTableId() {
    return clientConfig.appwriteCoursesTableId || "courses";
  }

  async listRows(queries = []) {
    if (!this.initialized || !this.tablesDB) {
      throw new Error(this.initError || "Appwrite service not initialized");
    }
    try {
      return await this.tablesDB.listRows(
        clientConfig.appwriteDBId,
        this.coursesTableId,
        queries,
      );
    } catch {
      if (!this.databases) {
        throw new Error(
          this.initError || "Appwrite databases service not initialized",
        );
      }
      const response = await this.databases.listDocuments(
        clientConfig.appwriteDBId,
        this.coursesTableId,
        queries,
      );
      return {
        rows: response.documents || [],
        total: response.total || 0,
      };
    }
  }

  async createRow(data) {
    try {
      const created = await this.tablesDB.createRow(
        clientConfig.appwriteDBId,
        this.coursesTableId,
        ID.unique(),
        data,
      );
      this.clearCourseCache();
      return created;
    } catch {
      const created = await this.databases.createDocument(
        clientConfig.appwriteDBId,
        this.coursesTableId,
        ID.unique(),
        data,
      );
      this.clearCourseCache();
      return created;
    }
  }

  async updateRow(rowId, data) {
    try {
      const updated = await this.tablesDB.updateRow(
        clientConfig.appwriteDBId,
        this.coursesTableId,
        rowId,
        data,
      );
      this.clearCourseCache();
      return updated;
    } catch {
      const updated = await this.databases.updateDocument(
        clientConfig.appwriteDBId,
        this.coursesTableId,
        rowId,
        data,
      );
      this.clearCourseCache();
      return updated;
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

    if (this.courseByIdCache.has(id)) {
      return this.courseByIdCache.get(id);
    }

    try {
      const row = await this.tablesDB.getRow(
        clientConfig.appwriteDBId,
        this.coursesTableId,
        id,
      );
      this.courseByIdCache.set(id, row);
      return row;
    } catch {
      try {
        const row = await this.databases.getDocument(
          clientConfig.appwriteDBId,
          this.coursesTableId,
          id,
        );
        this.courseByIdCache.set(id, row);
        return row;
      } catch {
        return null;
      }
    }
  }

  async getCourseByCode(courseCode) {
    const normalizedCode = normalizeCourseCode(courseCode);
    if (!normalizedCode) return null;

    const response = await this.listRows([
      Query.equal("courseCode", normalizedCode),
      Query.limit(1),
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

  async getAllCourses(limit = 5000) {
    if (
      this.allCoursesCache &&
      this.allCoursesCacheExpiry > Date.now() &&
      this.allCoursesCacheLimit === limit
    ) {
      return this.allCoursesCache;
    }

    if (this.allCoursesInflight && this.allCoursesCacheLimit === limit) {
      return this.allCoursesInflight;
    }

    this.allCoursesCacheLimit = limit;
    this.allCoursesInflight = (async () => {
      const response = await this.listRows([
        Query.orderAsc("courseCode"),
        Query.limit(limit),
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
