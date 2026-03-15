import clientConfig from "../config/client.js";
import {
  getCloudinaryImageUrl,
  isCloudinaryUrl,
} from "../lib/cloudinary/shared.js";
import { fuzzyMatchAny } from "../lib/fuzzySearch.js";
import { supabase, isSupabaseConfigured } from "../lib/supabase/client.js";
import {
  applyInChunks,
  normalizeRow,
  normalizeRows,
  throwIfSupabaseError,
} from "../lib/supabase/helpers.js";

const FACULTY_LIST_COLUMNS = [
  "id",
  "employeeId",
  "name",
  "designation",
  "department",
  "subDepartment",
  "educationUG",
  "educationPG",
  "educationPhD",
  "educationOther",
  "researchArea",
  "photoFileId",
  "createdAt",
  "updatedAt",
].join(", ");

const FACULTY_SUGGESTION_COLUMNS = [
  "id",
  "employeeId",
  "name",
  "department",
  "photoFileId",
].join(", ");

class PublicFacultyService {
  initialized = false;
  initError = null;
  queryCache = new Map();
  inflightRequests = new Map();
  CACHE_TTL_MS = 50 * 60 * 1000;
  FACULTY_CACHE_TTL_MS = 50 * 60 * 1000;
  facultyByIdCache = new Map();
  facultySuggestionCache = new Map();
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
  PERSISTENT_CACHE_PREFIX = "kyf.publicFaculty.v2";
  PERSISTENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  FULL_FACULTY_LIMIT = 5000;

  constructor() {
    if (!isSupabaseConfigured || !supabase) {
      this.initError = "Missing Supabase configuration.";
      return;
    }
    this.initialized = true;
    this.hydrateFullFacultyFromPersistentCache();
  }

  get facultyTable() {
    return clientConfig.supabaseFacultyTable;
  }

  getEmployeeIdKey(value) {
    const normalized = String(value ?? "").trim();
    if (!normalized) return "";
    const digitsOnly = normalized.replace(/\D/g, "");
    if (digitsOnly) return digitsOnly;

    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return "";
    return String(numeric).replace(/\D/g, "");
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
    } catch {}
  }

  hydrateFullFacultyFromPersistentCache() {
    const persisted = this.readPersistentCache("fullFaculty:v3");
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
      const employeeId = this.getEmployeeIdKey(row?.employeeId);
      if (employeeId) {
        this.facultyByIdCache.set(employeeId, {
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
      const { data, error } = await supabase
        .from(this.facultyTable)
        .select(FACULTY_LIST_COLUMNS)
        .order("name", { ascending: true })
        .limit(this.FULL_FACULTY_LIMIT);
      throwIfSupabaseError(error, "Failed to load faculty.");

      const records = normalizeRows(data || []);
      this.fullFacultyCache = records;
      this.fullFacultyCacheExpiry = Date.now() + this.CACHE_TTL_MS;
      this.writePersistentCache("fullFaculty:v3", records);

      records.forEach((row) => {
        if (row?.$id) {
          this.facultyByDocIdCache.set(String(row.$id), {
            value: row,
            expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
          });
        }
        const employeeId = this.getEmployeeIdKey(row?.employeeId);
        if (employeeId) {
          this.facultyByIdCache.set(employeeId, {
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

      if (
        normalizedSortField === "updatedAt" ||
        normalizedSortField === "createdAt"
      ) {
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
      filteredRows = filteredRows.filter(
        (item) => item?.department === department,
      );
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

  async getFacultyList({
    page = 1,
    limit: pageSize = 20,
    search = "",
    department = "all",
    sortBy = "updatedAt",
    sortOrder = "desc",
  } = {}) {
    try {
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
    } catch {
      return this.getSampleFacultyData(page, pageSize, search, department);
    }
  }

  async ping() {
    if (!this.initialized) {
      throw new Error(this.initError || "Supabase service not initialized");
    }
    const { error } = await supabase
      .from(this.facultyTable)
      .select("id")
      .limit(1);
    throwIfSupabaseError(error, "Failed to reach Supabase.");
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

  async getFacultyById(employeeId) {
    const cacheKey = this.getEmployeeIdKey(employeeId);
    if (!cacheKey) return null;
    const cached = this.facultyByIdCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const fullSnapshot =
        this.fullFacultyCache || this.readPersistentCache("fullFaculty:v3");
      if (Array.isArray(fullSnapshot) && fullSnapshot.length > 0) {
        const match =
          fullSnapshot.find(
            (row) => this.getEmployeeIdKey(row?.employeeId) === cacheKey,
          ) || null;
        if (match) {
          this.facultyByIdCache.set(cacheKey, {
            value: match,
            expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
          });
          return match;
        }
      }

      const { data, error } = await supabase
        .from(this.facultyTable)
        .select(FACULTY_LIST_COLUMNS)
        .eq("employeeId", Number(cacheKey))
        .limit(1)
        .maybeSingle();
      throwIfSupabaseError(error, "Failed to load faculty.");
      const result = data ? normalizeRow(data) : null;
      this.facultyByIdCache.set(cacheKey, {
        value: result,
        expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
      });
      return result;
    } catch {
      const sampleData = this.getSampleFacultyData(1, 10);
      return (
        sampleData.faculty.find(
          (f) => this.getEmployeeIdKey(f.employeeId) === cacheKey,
        ) || null
      );
    }
  }

  async getFacultyByIdBatch(employeeIds = []) {
    const sanitized = Array.from(
      new Set(
        (employeeIds || [])
          .map((id) => this.getEmployeeIdKey(id))
          .filter(Boolean),
      ),
    );
    if (sanitized.length === 0) return {};

    const result = {};
    const uncached = [];

    for (const id of sanitized) {
      const cached = this.facultyByIdCache.get(id);
      if (cached && cached.expiresAt > Date.now()) {
        result[id] = cached.value;
      } else {
        uncached.push(id);
      }
    }

    if (uncached.length === 0) return result;

    const fullSnapshot =
      this.fullFacultyCache || this.readPersistentCache("fullFaculty:v3");
    if (Array.isArray(fullSnapshot) && fullSnapshot.length > 0) {
      const byEmployeeId = new Map();
      fullSnapshot.forEach((row) => {
        const employeeId = this.getEmployeeIdKey(row?.employeeId);
        if (employeeId) byEmployeeId.set(employeeId, row);
      });
      const unresolved = [];
      for (const id of uncached) {
        const row = byEmployeeId.get(id) || null;
        if (row) {
          result[id] = row;
          this.facultyByIdCache.set(id, {
            value: row,
            expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
          });
        } else {
          unresolved.push(id);
        }
      }

      if (unresolved.length === 0) {
        return result;
      }

      for (const chunk of applyInChunks(unresolved, 100)) {
        const numericChunk = chunk
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id));
        if (numericChunk.length === 0) continue;
        const { data, error } = await supabase
          .from(this.facultyTable)
          .select(FACULTY_LIST_COLUMNS)
          .in("employeeId", numericChunk);
        throwIfSupabaseError(error, "Failed to load faculty batch.");
        const rows = normalizeRows(data || []);
        const rowMap = new Map(
          rows.map((row) => [this.getEmployeeIdKey(row.employeeId), row]),
        );
        for (const id of chunk) {
          const row = rowMap.get(id) || null;
          result[id] = row;
          this.facultyByIdCache.set(id, {
            value: row,
            expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
          });
        }
      }

      return result;
    }

    for (const chunk of applyInChunks(uncached, 100)) {
      const numericChunk = chunk
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
      if (numericChunk.length === 0) continue;
      const { data, error } = await supabase
        .from(this.facultyTable)
        .select(FACULTY_LIST_COLUMNS)
        .in("employeeId", numericChunk);
      throwIfSupabaseError(error, "Failed to load faculty batch.");
      const rows = normalizeRows(data || []);
      const rowMap = new Map(
        rows.map((row) => [this.getEmployeeIdKey(row.employeeId), row]),
      );
      for (const id of chunk) {
        const row = rowMap.get(id) || null;
        result[id] = row;
        this.facultyByIdCache.set(id, {
          value: row,
          expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
        });
      }
    }

    return result;
  }

  async getFacultyByDocIdBatch(docIds = []) {
    const sanitized = Array.from(
      new Set(
        (docIds || []).map((id) => String(id || "").trim()).filter(Boolean),
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

    const fullSnapshot =
      this.fullFacultyCache || this.readPersistentCache("fullFaculty:v3");
    if (Array.isArray(fullSnapshot) && fullSnapshot.length > 0) {
      const byDocId = new Map(
        fullSnapshot.map((row) => [String(row?.$id || ""), row]),
      );
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

    for (const chunk of applyInChunks(uncached, 100)) {
      const { data, error } = await supabase
        .from(this.facultyTable)
        .select(FACULTY_LIST_COLUMNS)
        .in("id", chunk);
      throwIfSupabaseError(error, "Failed to load faculty batch.");
      const rows = normalizeRows(data || []);
      const rowMap = new Map(rows.map((row) => [String(row.$id), row]));
      for (const id of chunk) {
        const row = rowMap.get(id) || null;
        result[id] = row;
        this.facultyByDocIdCache.set(id, {
          value: row,
          expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
        });
      }
    }

    return result;
  }

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
    } catch {
      return this.getSampleDepartments();
    }
  }

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
        if (faculty.department) {
          stats.byDepartment[faculty.department] =
            (stats.byDepartment[faculty.department] || 0) + 1;
        }
        if (faculty.designation) {
          stats.byDesignation[faculty.designation] =
            (stats.byDesignation[faculty.designation] || 0) + 1;
        }
      });

      this.statsCache = stats;
      this.statsCacheExpiry = Date.now() + this.FACULTY_CACHE_TTL_MS;
      return stats;
    } catch {
      return this.getSampleStats();
    }
  }

  async searchFaculty(query, filters = {}) {
    const searchOptions = {
      search: query,
      limit: filters.limit || 50,
      page: 1,
      department: filters.department || "all",
    };
    return this.getFacultyList(searchOptions);
  }

  async searchFacultySuggestions(query, limitNum = 20) {
    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) return [];

    const cacheKey = `facultySuggestions_${normalizedQuery.toLowerCase()}_${limitNum}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== undefined) return cached;

    return this.getOrCreateInflight(cacheKey, async () => {
      try {
        const { data, error } = await supabase
          .from(this.facultyTable)
          .select(FACULTY_SUGGESTION_COLUMNS)
          .ilike("name", `%${normalizedQuery}%`)
          .order("name", { ascending: true })
          .limit(limitNum);
        throwIfSupabaseError(error, "Failed to load faculty suggestions.");
        const rows = normalizeRows(data || []);
        this.setCachedValue(cacheKey, rows, 10 * 60 * 1000);
        rows.forEach((row) => {
          if (row?.$id) {
            this.facultyByDocIdCache.set(String(row.$id), {
              value: row,
              expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
            });
          }
          const employeeId = this.getEmployeeIdKey(row?.employeeId);
          if (employeeId) {
            this.facultyByIdCache.set(employeeId, {
              value: row,
              expiresAt: Date.now() + this.FACULTY_CACHE_TTL_MS,
            });
          }
        });
        return rows;
      } catch {
        const snapshot = await this.getFullFacultySnapshot();
        const rows = (snapshot || [])
          .filter((item) =>
            fuzzyMatchAny([item.name, item.department], normalizedQuery),
          )
          .slice(0, limitNum);
        this.setCachedValue(cacheKey, rows, 10 * 60 * 1000);
        return rows;
      }
    });
  }

  getFacultyPhotoCandidates(photoFileId) {
    const placeholder = this.getPlaceholderPhoto();
    if (!photoFileId) return [placeholder];

    try {
      const rawPhotoValue = String(photoFileId || "").trim();
      if (!rawPhotoValue) return [placeholder];

      if (/^https?:\/\//i.test(rawPhotoValue)) {
        if (isCloudinaryUrl(rawPhotoValue)) return [rawPhotoValue];
        return [rawPhotoValue];
      }

      if (rawPhotoValue.startsWith("sample_")) {
        return [placeholder];
      }

      const cloudinaryUrl = getCloudinaryImageUrl(rawPhotoValue);
      return cloudinaryUrl ? [cloudinaryUrl] : [placeholder];
    } catch {
      return [placeholder];
    }
  }

  getFacultyPhotoUrl(photoFileId) {
    return (
      this.getFacultyPhotoCandidates(photoFileId)[0] ||
      this.getPlaceholderPhoto()
    );
  }

  getPlaceholderPhoto() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Cg transform='translate(100 100)'%3E%3Ccircle r='30' fill='%23d1d5db'/%3E%3Cpath d='M-15,-10 Q0,-25 15,-10 Q25,0 15,15 L-15,15 Q-25,0 -15,-10 Z' fill='%23d1d5db'/%3E%3C/g%3E%3Ctext x='100' y='160' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%236b7280'%3EFaculty Photo%3C/text%3E%3C/svg%3E";
  }

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
    } catch {
      return {
        isFresh: false,
        error: "Unable to check data freshness",
      };
    }
  }

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
    } catch {
      return [];
    }
  }

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

    let filteredFaculty = sampleFaculty;
    if (search && search.trim()) {
      const searchTerm = search.trim();
      filteredFaculty = sampleFaculty.filter((faculty) =>
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

const publicFacultyService = new PublicFacultyService();
export default publicFacultyService;
