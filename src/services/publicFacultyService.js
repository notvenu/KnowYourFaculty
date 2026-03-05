import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  documentId,
  Query as FirestoreQuery,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "../lib/firebase/client.js";
import clientConfig from "../config/client.js";
import { fuzzyMatchAny } from "../lib/fuzzySearch.js";

/**
 * 🌐 PUBLIC FACULTY SERVICE
 * Provides public access to faculty data without authentication
 * Uses client-side Firebase SDK for frontend applications
 */

class PublicFacultyService {
  initialized = false;
  initError = null;
  queryCache = new Map();
  inflightRequests = new Map();
  CACHE_TTL_MS = 50 * 60 * 1000;  // Faculty/dept data rarely changes; use 50min cache
  FACULTY_CACHE_TTL_MS = 50 * 60 * 1000;  // Faculty cache 50 minutes
  facultyByIdCache = new Map();
  facultyByIdCacheExpiry = new Map();
  departmentsCache = null;
  departmentsCacheExpiry = 0;
  statsCache = null;
  statsCacheExpiry = 0;
  trendingCache = null;
  trendingCacheExpiry = 0;
  trendingCacheLimit = null;
  fullFacultyCache = null;
  fullFacultyCacheExpiry = 0;
  fullFacultyInflight = null;
  facultyByDocIdCache = new Map();
  PERSISTENT_CACHE_PREFIX = "kyf.publicFaculty";
  PERSISTENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  FULL_FACULTY_LIMIT = 5000;
  PAGINATION_PREFETCH_BUFFER = 5;

  constructor() {
    // Validate required configuration
    if (!clientConfig.firebaseProjectId || !clientConfig.firebaseApiKey) {
      this.initError = `Missing Firebase configuration. ProjectID: ${!!clientConfig.firebaseProjectId}, ApiKey: ${!!clientConfig.firebaseApiKey}`;
      return;
    }

    try {
      this.initialized = true;
      this.hydrateFullFacultyFromPersistentCache();
    } catch (error) {
      this.initError = error?.message || "Failed to initialize Firebase client";
    }
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

  hydrateFullFacultyFromPersistentCache() {
    const persisted = this.readPersistentCache("fullFaculty:v2");
    if (!Array.isArray(persisted) || persisted.length === 0) return;
    this.fullFacultyCache = persisted;
    this.fullFacultyCacheExpiry = Date.now() + this.CACHE_TTL_MS;
    persisted.forEach((row) => {
      if (row?.$id) {
        this.facultyByDocIdCache.set(String(row.$id), {
          value: row,
          expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
        });
      }
      const employeeId = Number(row?.employeeId);
      if (Number.isFinite(employeeId)) {
        this.facultyByIdCache.set(String(employeeId), {
          value: row,
          expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
        });
      }
    });
  }

  async getFullFacultySnapshot() {
    if (this.fullFacultyCache && this.fullFacultyCacheExpiry > Date.now()) {
      return this.fullFacultyCache;
    }

    if (this.fullFacultyInflight) {
      return this.fullFacultyInflight;
    }

    this.fullFacultyInflight = (async () => {
      const q = query(
        collection(db, clientConfig.firebaseFacultyCollection),
        limit(this.FULL_FACULTY_LIMIT),
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map((docSnapshot) => ({
        $id: docSnapshot.id,
        ...docSnapshot.data(),
      }));

      this.fullFacultyCache = records;
      this.fullFacultyCacheExpiry = Date.now() + this.CACHE_TTL_MS;
      this.writePersistentCache("fullFaculty:v2", records);

      records.forEach((row) => {
        if (row?.$id) {
          this.facultyByDocIdCache.set(String(row.$id), {
            value: row,
            expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
          });
        }
        const employeeId = Number(row?.employeeId);
        if (Number.isFinite(employeeId)) {
          this.facultyByIdCache.set(String(employeeId), {
            value: row,
            expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
          });
        }
      });

      return records;
    })();

    try {
      return await this.fullFacultyInflight;
    } finally {
      this.fullFacultyInflight = null;
    }
  }

  toSortTime(value) {
    if (!value) return 0;
    if (typeof value?.toDate === "function") {
      const date = value.toDate();
      const time = date?.getTime?.();
      return Number.isFinite(time) ? time : 0;
    }
    const date = new Date(value);
    const time = date.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  sortFacultyRows(rows, sortBy = "updatedAt", sortOrder = "desc") {
    const normalizedSortField =
      sortBy === "$updatedAt" ? "updatedAt" : sortBy || "updatedAt";
    const isDesc = sortOrder === "desc";

    return [...(rows || [])].sort((a, b) => {
      const aValue = a?.[normalizedSortField];
      const bValue = b?.[normalizedSortField];

      if (normalizedSortField === "updatedAt" || normalizedSortField === "createdAt") {
        const diff = this.toSortTime(aValue) - this.toSortTime(bValue);
        return isDesc ? -diff : diff;
      }

      const aText = String(aValue ?? "").toLowerCase();
      const bText = String(bValue ?? "").toLowerCase();
      const compared = aText.localeCompare(bText);
      return isDesc ? -compared : compared;
    });
  }

  buildPaginatedFacultyResponse(rows, page, pageSize) {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedRows = rows.slice(startIndex, endIndex);
    return {
      faculty: paginatedRows,
      total: rows.length,
      page,
      limit: pageSize,
      totalPages: Math.ceil(rows.length / pageSize),
      hasNext: endIndex < rows.length,
      hasPrev: page > 1,
    };
  }

  buildFacultyListFromSnapshot({
    rows = [],
    page = 1,
    pageSize = 20,
    search = "",
    department = "all",
    sortBy = "updatedAt",
    sortOrder = "desc",
  }) {
    let filteredRows = [...rows];
    if (department && department !== "all") {
      filteredRows = filteredRows.filter((item) => item?.department === department);
    }
    const trimmedSearch = String(search || "").trim();
    if (trimmedSearch) {
      const normalizedSearch = trimmedSearch.toLowerCase();
      filteredRows = filteredRows.filter((item) =>
        this.matchesSearch(item, normalizedSearch),
      );
    }
    filteredRows = this.sortFacultyRows(filteredRows, sortBy, sortOrder);
    return this.buildPaginatedFacultyResponse(filteredRows, page, pageSize);
  }

  async listFacultyRecords(constraints = []) {
    if (!this.initialized) {
      throw new Error(this.initError || "Firebase service not initialized");
    }

    const cacheKey = JSON.stringify(constraints || []);
    const cached = this.queryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    if (this.inflightRequests.has(cacheKey)) {
      return this.inflightRequests.get(cacheKey);
    }

    const fetchPromise = (async () => {
      try {
        const q = query(
          collection(db, clientConfig.firebaseFacultyCollection),
          ...constraints,
        );

        const snapshot = await getDocs(q);
        const value = {
          records: snapshot.docs.map((docSnapshot) => ({
            $id: docSnapshot.id,
            ...docSnapshot.data(),
          })),
          total: snapshot.size,
        };

        this.queryCache.set(cacheKey, {
          value,
          expiresAt: Date.now() + this.CACHE_TTL_MS,
        });
        return value;
      } catch (error) {
        throw error;
      } finally {
        this.inflightRequests.delete(cacheKey);
      }
    })();

    this.inflightRequests.set(cacheKey, fetchPromise);

    try {
      return await fetchPromise;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 📋 Get paginated faculty list
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (1-based)
   * @param {number} options.limit - Items per page
   * @param {string} options.search - Search query
   * @param {string} options.department - Department filter
   * @param {string} options.sortBy - Sort field
   * @param {string} options.sortOrder - Sort order (asc/desc)
   */
  async getFacultyList({
    page = 1,
    limit: pageSize = 20,
    search = "",
    department = "all",
    sortBy = "updatedAt",
    sortOrder = "desc",
  } = {}) {
    try {
      const trimmedSearch = search.trim();

      // For search queries, always use the full snapshot so results are complete.
      // This avoids false "no results" caused by capped partial fetches.
      if (trimmedSearch) {
        const allRows = await this.getFullFacultySnapshot();
        return this.buildFacultyListFromSnapshot({
          rows: allRows,
          page,
          pageSize,
          search,
          department,
          sortBy,
          sortOrder,
        });
      }

      if (pageSize >= 1000) {
        const allRows = await this.getFullFacultySnapshot();
        return this.buildFacultyListFromSnapshot({
          rows: allRows,
          page,
          pageSize,
          department,
          sortBy,
          sortOrder,
        });
      }

      const constraints = [];

      // Add sorting
      if (sortBy !== "$updatedAt") {
        const sortField = sortBy.replace("$updatedAt", "updatedAt");
        constraints.push(
          orderBy(sortField, sortOrder === "desc" ? "desc" : "asc")
        );
      } else {
        constraints.push(orderBy("updatedAt", "desc"));
      }

      // Add department filter
      if (department && department !== "all") {
        constraints.push(where("department", "==", department));
      }

      // OPTIMIZATION: Fetch only what's needed for pagination
      // Calculate reasonable limit based on page and size
      const estimatedMaxNeeded =
        page * pageSize + Math.min(this.PAGINATION_PREFETCH_BUFFER, pageSize);
      constraints.push(limit(Math.min(estimatedMaxNeeded, 500)));

      const response = await this.listFacultyRecords(constraints);

      // Apply client-side pagination
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedRecords = response.records.slice(startIndex, endIndex);

      return {
        faculty: paginatedRecords,
        total: response.total,
        page,
        limit: pageSize,
        totalPages: Math.ceil(response.total / pageSize),
        hasNext: endIndex < response.total,
        hasPrev: page > 1,
      };
    } catch (error) {
      return this.getSampleFacultyData(page, pageSize, search, department);
    }
  }

  async getFacultyListWithClientSearch({
    page,
    limit: pageSize,
    search,
    department,
    sortBy,
    sortOrder,
  }) {
    try {
      const constraints = [];

      if (sortBy !== "$updatedAt") {
        const sortField = sortBy.replace("$updatedAt", "updatedAt");
        constraints.push(
          orderBy(sortField, sortOrder === "desc" ? "desc" : "asc")
        );
      } else {
        constraints.push(orderBy("updatedAt", "desc"));
      }

      if (department && department !== "all") {
        constraints.push(where("department", "==", department));
      }

      // OPTIMIZATION: Limit fetch to reasonable size, not all 5000
      const estimatedMaxNeeded =
        page * pageSize + Math.min(this.PAGINATION_PREFETCH_BUFFER, pageSize);
      constraints.push(limit(Math.min(estimatedMaxNeeded, 500)));

      const response = await this.listFacultyRecords(constraints);

      const normalizedSearch = search.toLowerCase();
      const filteredFaculty = (response.records || []).filter((faculty) =>
        this.matchesSearch(faculty, normalizedSearch),
      );

      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedFaculty = filteredFaculty.slice(startIndex, endIndex);

      return {
        faculty: paginatedFaculty,
        total: filteredFaculty.length,
        page,
        limit: pageSize,
        totalPages: Math.ceil(filteredFaculty.length / pageSize),
        hasNext: endIndex < filteredFaculty.length,
        hasPrev: page > 1,
      };
    } catch (error) {
      return this.getSampleFacultyData(page, pageSize, search, department);
    }
  }

  async ping() {
    if (!this.initialized) {
      throw new Error(this.initError || "Firebase service not initialized");
    }
    await this.listFacultyRecords([limit(1)]);
    return true;
  }

  matchesSearch(faculty, query) {
    const searchTerm = String(query || "").trim();
    if (!searchTerm) return true;

    return fuzzyMatchAny(
      [
        faculty.name,
        faculty.department,
        faculty.designation,
        faculty.researchArea,
        faculty.employeeId,
        faculty.employeeid,
      ].filter((value) => value !== null && value !== undefined),
      searchTerm,
    );
  }

  /**
   * 🎯 Get faculty member by Employee ID
   * @param {number|string} employeeId - Employee ID
   */
  async getFacultyById(employeeId) {
    const cacheKey = String(employeeId);
    const cached = this.facultyByIdCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const fullSnapshot = this.fullFacultyCache || this.readPersistentCache("fullFaculty:v2");
      if (Array.isArray(fullSnapshot) && fullSnapshot.length > 0) {
        const match =
          fullSnapshot.find(
            (row) => Number(row?.employeeId) === Number(employeeId),
          ) || null;
        this.facultyByIdCache.set(cacheKey, {
          value: match,
          expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
        });
        return match;
      }

      const response = await this.listFacultyRecords([
        where("employeeId", "==", Number(employeeId)),
      ]);

      const result =
        response.records && response.records.length > 0
          ? response.records[0]
          : null;
      this.facultyByIdCache.set(cacheKey, {
        value: result,
        expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
      });
      return result;
    } catch (error) {
      // Return sample faculty if database not accessible
      const sampleData = this.getSampleFacultyData(1, 10);
      return (
        sampleData.faculty.find((f) => f.employeeId === Number(employeeId)) ||
        null
      );
    }
  }

  /**
   * � Batch-fetch faculty by multiple IDs to avoid N+1 queries
   * Returns { [employeeId]: faculty_object or null }
   */
  async getFacultyByIdBatch(employeeIds = []) {
    const sanitized = Array.from(
      new Set(
        (employeeIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id))
      )
    );
    if (sanitized.length === 0) return {};

    const result = {};
    const uncached = [];

    // Check what's already cached
    for (const id of sanitized) {
      const key = String(id);
      const cached = this.facultyByIdCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        result[id] = cached.value;
      } else {
        uncached.push(id);
      }
    }

    if (uncached.length === 0) return result;

    const fullSnapshot = this.fullFacultyCache || this.readPersistentCache("fullFaculty:v2");
    if (Array.isArray(fullSnapshot) && fullSnapshot.length > 0) {
      const byEmployeeId = new Map();
      fullSnapshot.forEach((row) => {
        const employeeId = Number(row?.employeeId);
        if (Number.isFinite(employeeId)) {
          byEmployeeId.set(employeeId, row);
        }
      });
      for (const id of uncached) {
        const row = byEmployeeId.get(id) || null;
        result[id] = row;
        this.facultyByIdCache.set(String(id), {
          value: row,
          expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
        });
      }
      return result;
    }

    // Batch-fetch in 30-item chunks
    const chunks = [];
    for (let i = 0; i < uncached.length; i += 30) {
      chunks.push(uncached.slice(i, i + 30));
    }

    for (const chunk of chunks) {
      try {
        const q = query(
          collection(db, clientConfig.firebaseFacultyCollection),
          where("employeeId", "in", chunk)
        );
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((doc) => {
          const faculty = { $id: doc.id, ...doc.data() };
          const empId = Number(faculty?.employeeId);
          if (Number.isFinite(empId)) {
            result[empId] = faculty;
            const key = String(empId);
            this.facultyByIdCache.set(key, {
              value: faculty,
              expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
            });
          }
        });

        // Cache nulls for missing IDs
        for (const id of chunk) {
          if (!result[id]) {
            result[id] = null;
            const key = String(id);
            this.facultyByIdCache.set(key, {
              value: null,
              expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
            });
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

  /**
   * Batch fetch faculty by document IDs.
   * Returns { [docId]: faculty_object or null }.
   */
  async getFacultyByDocIdBatch(docIds = []) {
    const sanitized = Array.from(
      new Set(
        (docIds || [])
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ),
    );
    if (sanitized.length === 0) return {};

    const result = {};
    const uncached = [];
    for (const id of sanitized) {
      const cached = this.facultyByDocIdCache.get(id);
      if (cached && cached.expiresAt > Date.now()) {
        result[id] = cached.value;
      } else {
        uncached.push(id);
      }
    }

    if (uncached.length === 0) return result;

    const fullSnapshot = this.fullFacultyCache || this.readPersistentCache("fullFaculty:v2");
    if (Array.isArray(fullSnapshot) && fullSnapshot.length > 0) {
      const byDocId = new Map(fullSnapshot.map((row) => [String(row?.$id || ""), row]));
      for (const id of uncached) {
        const row = byDocId.get(id) || null;
        result[id] = row;
        this.facultyByDocIdCache.set(id, {
          value: row,
          expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
        });
      }
      return result;
    }

    const chunks = [];
    for (let i = 0; i < uncached.length; i += 30) {
      chunks.push(uncached.slice(i, i + 30));
    }

    for (const chunk of chunks) {
      try {
        const q = query(
          collection(db, clientConfig.firebaseFacultyCollection),
          where(documentId(), "in", chunk),
        );
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((docSnapshot) => {
          const row = { $id: docSnapshot.id, ...docSnapshot.data() };
          result[row.$id] = row;
          this.facultyByDocIdCache.set(row.$id, {
            value: row,
            expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
          });
        });
        for (const id of chunk) {
          if (!Object.prototype.hasOwnProperty.call(result, id)) {
            result[id] = null;
            this.facultyByDocIdCache.set(id, {
              value: null,
              expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
            });
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

  /**
   * �🏢 Get all departments
   */
  async getDepartments() {
    if (this.departmentsCache && this.departmentsCacheExpiry > Date.now()) {
      return this.departmentsCache;
    }

    try {
      const rows = await this.getFullFacultySnapshot();

      const departments = [
        ...new Set(
          (rows || [])
            .map((doc) => doc.department)
            .filter((dept) => dept && dept.trim()),
        ),
      ];

      const result = departments.sort();
      this.departmentsCache = result;
      this.departmentsCacheExpiry = Date.now() + this.FACULTY_CACHE_TTL_MS;
      return result;
    } catch (error) {
      // Silently return sample departments
      return this.getSampleDepartments();
    }
  }

  /**
   * 📊 Get faculty statistics
   */
  async getFacultyStats() {
    if (this.statsCache && this.statsCacheExpiry > Date.now()) {
      return this.statsCache;
    }

    try {
      const rows = await this.getFullFacultySnapshot();

      const stats = {
        total: rows.length || 0,
        byDepartment: {},
        byDesignation: {},
        lastUpdated: new Date().toISOString(),
      };

      (rows || []).forEach((faculty) => {
        // Count by department
        if (faculty.department) {
          stats.byDepartment[faculty.department] =
            (stats.byDepartment[faculty.department] || 0) + 1;
        }

        // Count by designation
        if (faculty.designation) {
          stats.byDesignation[faculty.designation] =
            (stats.byDesignation[faculty.designation] || 0) + 1;
        }
      });

      this.statsCache = stats;
      this.statsCacheExpiry = Date.now() + this.FACULTY_CACHE_TTL_MS;
      return stats;
    } catch (error) {
      // Silently return sample stats
      return this.getSampleStats();
    }
  }

  /**
   * 🔍 Search faculty members
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   */
  async searchFaculty(query, filters = {}) {
    try {
      const searchOptions = {
        search: query,
        limit: filters.limit || 50,
        page: 1,
        department: filters.department || "all",
      };

      return await this.getFacultyList(searchOptions);
    } catch (error) {
      throw new Error("Search failed. Please try again.");
    }
  }

  /**
   * 📸 Get faculty photo URL
   * @param {string} photoFileId - Photo file ID from Firebase Storage
   */
  getFacultyPhotoCandidates(photoFileId) {
    const placeholder = this.getPlaceholderPhoto();
    if (!photoFileId) return [placeholder];

    try {
      const rawPhotoValue = String(photoFileId || "").trim();
      if (!rawPhotoValue) return [placeholder];

      // If DB already stores a URL, normalize it before use.
      if (/^https?:\/\//i.test(rawPhotoValue)) {
        // Legacy Appwrite URLs are not valid for Firebase-backed photos.
        if (/cloud\.appwrite\.io/i.test(rawPhotoValue)) {
          return [placeholder];
        }

        // Tokenized Firebase URLs can break after re-upload (token rotation).
        // Remove token and force alt=media for stable access.
        if (/firebasestorage\.googleapis\.com/i.test(rawPhotoValue)) {
          try {
            const urlObj = new URL(rawPhotoValue);
            urlObj.searchParams.delete("token");
            if (!urlObj.searchParams.has("alt")) {
              urlObj.searchParams.set("alt", "media");
            }
            return [urlObj.toString()];
          } catch {
            return [placeholder];
          }
        }

        return [rawPhotoValue];
      }

      if (rawPhotoValue.startsWith("sample_")) {
        return [placeholder];
      }

      let normalizedPhotoId = rawPhotoValue;
      try {
        normalizedPhotoId = decodeURIComponent(normalizedPhotoId);
      } catch {
        // keep original when malformed encoding
      }
      normalizedPhotoId = normalizedPhotoId.replace(/^\/+/, "");
      normalizedPhotoId = normalizedPhotoId.replace(/^faculty_photos\//i, "");

      const configuredBucket = String(clientConfig.firebaseStorageBucket || "").trim();
      const projectId = String(clientConfig.firebaseProjectId || "").trim();
      const bucketCandidates = Array.from(
        new Set(
          [
            configuredBucket,
            projectId ? `${projectId}.firebasestorage.app` : "",
            projectId ? `${projectId}.appspot.com` : "",
            configuredBucket.endsWith(".firebasestorage.app")
              ? configuredBucket.replace(/\.firebasestorage\.app$/i, ".appspot.com")
              : "",
            configuredBucket.endsWith(".appspot.com")
              ? configuredBucket.replace(/\.appspot\.com$/i, ".firebasestorage.app")
              : "",
          ].filter(Boolean),
        ),
      );

      const encodedObjectPath = encodeURIComponent(
        `faculty_photos/${normalizedPhotoId}`,
      );

      const urls = [];
      for (const bucket of bucketCandidates) {
        urls.push(
          `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedObjectPath}?alt=media`,
        );
        urls.push(
          `https://storage.googleapis.com/${bucket}/faculty_photos/${encodeURIComponent(normalizedPhotoId)}`,
        );
      }

      return urls.length > 0 ? urls : [placeholder];
    } catch {
      return [placeholder];
    }
  }

  getFacultyPhotoUrl(photoFileId) {
    return this.getFacultyPhotoCandidates(photoFileId)[0] || this.getPlaceholderPhoto();
  }

  /**
   * Get placeholder photo URL
   */
  getPlaceholderPhoto() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Cg transform='translate(100 100)'%3E%3Ccircle r='30' fill='%23d1d5db'/%3E%3Cpath d='M-15,-10 Q0,-25 15,-10 Q25,0 15,15 L-15,15 Q-25,0 -15,-10 Z' fill='%23d1d5db'/%3E%3C/g%3E%3Ctext x='100' y='160' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%236b7280'%3EFaculty Photo%3C/text%3E%3C/svg%3E";
  }

  /**
   * 🔄 Check if data is fresh (less than 7 days old)
   */
  async isDataFresh() {
    try {
      const stats = await this.getFacultyStats();
      const lastUpdate = new Date(stats.lastUpdated);
      const daysSinceUpdate =
        (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

      return {
        isFresh: daysSinceUpdate < 7,
        daysSinceUpdate: Math.round(daysSinceUpdate),
        lastUpdate: stats.lastUpdated,
      };
    } catch (error) {
      return {
        isFresh: false,
        error: "Unable to check data freshness",
      };
    }
  }

  /**
   * 📈 Get trending research areas
   */
  async getTrendingResearch(pageSize = 10) {
    if (
      this.trendingCache &&
      this.trendingCacheExpiry > Date.now() &&
      this.trendingCacheLimit === pageSize
    ) {
      return this.trendingCache;
    }

    try {
      const rows = await this.getFullFacultySnapshot();

      const researchCounts = {};

      (rows || []).forEach((faculty) => {
        if (faculty.researchArea) {
          // Split research areas by common delimiters
          const areas = faculty.researchArea
            .split(/[,;|&\n]/)
            .map((area) => area.trim())
            .filter((area) => area.length > 0);

          areas.forEach((area) => {
            researchCounts[area] = (researchCounts[area] || 0) + 1;
          });
        }
      });

      const result = Object.entries(researchCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, pageSize)
        .map(([area, count]) => ({ area, count }));

      this.trendingCache = result;
      this.trendingCacheExpiry = Date.now() + this.CACHE_TTL_MS;
      this.trendingCacheLimit = pageSize;
      return result;
    } catch (error) {
      return [];
    }
  }

  /**
   * 🎭 Sample data methods for fallback when database is not accessible
   */
  getSampleFacultyData(page = 1, limit = 20, search = "", department = "all") {
    const sampleFaculty = [
      {
        $id: "sample1",
        employeeId: 70001,
        name: "Dr. Karthika Natarajan",
        designation: "Associate Professor Grade 1",
        department: "School of Computer Science and Engineering (SCOPE)",
        subDepartment: "Computer Vision & AI",
        researchArea:
          "Artificial Intelligence, Machine Learning, Deep Learning, Information Retrieval",
        educationUG: "B.Tech Computer Science",
        educationPG: "M.E Computer Science",
        educationPhD: "PhD Computer Science & Engineering",
        photoFileId: "sample_photo_1",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-02-11T00:00:00.000Z",
      },
      {
        $id: "sample2",
        employeeId: 70002,
        name: "Dr. Jagadish Chandra Mudiganti",
        designation: "Professor",
        department: "School of Electronics Engineering (SENSE)",
        subDepartment: "Signal Processing",
        researchArea:
          "IoT, Embedded Systems, Signal Processing, Wireless Communication",
        educationUG: "B.Tech Electronics & Communication",
        educationPG: "M.Tech Signal Processing",
        educationPhD: "PhD Electronics & Communication Engineering",
        photoFileId: "sample_photo_2",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-02-11T00:00:00.000Z",
      },
      {
        $id: "sample3",
        employeeId: 70003,
        name: "Dr. Prashanth Rajam",
        designation: "Associate Professor",
        department: "School of Computer Science and Engineering (SCOPE)",
        subDepartment: "Software Engineering",
        researchArea: "Software Engineering, Database Systems, Data Mining",
        educationUG: "B.E Computer Science",
        educationPG: "M.Tech Software Engineering",
        educationPhD: "PhD Computer Science",
        photoFileId: "sample_photo_3",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-02-11T00:00:00.000Z",
      },
      {
        $id: "sample4",
        employeeId: 70004,
        name: "Dr. Rajeev Sharma",
        designation: "Assistant Professor",
        department: "School of Mechanical Engineering (SME)",
        subDepartment: "Thermal Engineering",
        researchArea:
          "Thermal Analysis, Heat Transfer, Renewable Energy Systems",
        educationUG: "B.Tech Mechanical Engineering",
        educationPG: "M.Tech Thermal Engineering",
        educationPhD: "PhD Mechanical Engineering",
        photoFileId: "sample_photo_4",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-02-11T00:00:00.000Z",
      },
      {
        $id: "sample5",
        employeeId: 70005,
        name: "Dr. Shalini Subramani",
        designation: "Associate Professor Grade 2",
        department: "School of Civil Engineering (SCE)",
        subDepartment: "Structural Engineering",
        researchArea:
          "Structural Analysis, Earthquake Engineering, Smart Materials",
        educationUG: "B.Tech Civil Engineering",
        educationPG: "M.Tech Structural Engineering",
        educationPhD: "PhD Structural Engineering",
        photoFileId: "sample_photo_5",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-02-11T00:00:00.000Z",
      },
    ];

    // Apply search filter
    let filteredFaculty = sampleFaculty;
    if (search && search.trim()) {
      const searchTerm = search.trim();
      filteredFaculty = sampleFaculty.filter(
        (faculty) =>
          fuzzyMatchAny(
            [
              faculty.name,
              faculty.department,
              faculty.designation,
              faculty.researchArea,
              faculty.employeeId,
            ],
            searchTerm,
          ),
      );
    }

    // Apply department filter
    if (department && department !== "all") {
      filteredFaculty = filteredFaculty.filter(
        (faculty) => faculty.department === department,
      );
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    return {
      faculty: filteredFaculty.slice(startIndex, endIndex),
      total: filteredFaculty.length,
      page,
      limit,
      totalPages: Math.ceil(filteredFaculty.length / limit),
      hasNext: endIndex < filteredFaculty.length,
      hasPrev: page > 1,
    };
  }

  getSampleDepartments() {
    return [
      "School of Computer Science and Engineering (SCOPE)",
      "School of Electronics Engineering (SENSE)",
      "School of Mechanical Engineering (SME)",
      "School of Civil Engineering (SCE)",
      "School of Chemical Engineering",
      "School of Applied Sciences and Mathematics (SASMAT)",
    ];
  }

  getSampleStats() {
    return {
      total: 5,
      byDepartment: {
        "School of Computer Science and Engineering (SCOPE)": 2,
        "School of Electronics Engineering (SENSE)": 1,
        "School of Mechanical Engineering (SME)": 1,
        "School of Civil Engineering (SCE)": 1,
      },
      byDesignation: {
        Professor: 1,
        "Associate Professor Grade 1": 1,
        "Associate Professor": 1,
        "Associate Professor Grade 2": 1,
        "Assistant Professor": 1,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Create and export singleton instance
const publicFacultyService = new PublicFacultyService();
export default publicFacultyService;
