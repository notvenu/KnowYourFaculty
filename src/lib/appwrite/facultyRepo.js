import { tablesDB } from "./client.js";
import { ID, Query } from "node-appwrite";
import serverConfig from "../../config/server.js";

const DB_ID = serverConfig.appwriteDBId;
const TABLE_ID = serverConfig.appwriteTableId;
const PAGE_LIMIT = 5000;
const DEFAULT_MIN_STRING_LENGTH = 2;
const DEFAULT_MAX_STRING_LENGTH = 255;

function normalizeEmployeeId(employeeId) {
  if (employeeId === null || employeeId === undefined) return null;
  const normalized = Number(employeeId);
  return Number.isFinite(normalized) ? normalized : null;
}

function employeeIdToRowId(employeeId) {
  const normalized = normalizeEmployeeId(employeeId);
  if (normalized === null) return null;
  const canonical = normalized.toString().replace(/\./g, "_").replace(/-/g, "n");
  return `emp_${canonical}`;
}

function getMinStringLength() {
  const raw = Number(process.env.APPWRITE_MIN_STRING_LENGTH);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_MIN_STRING_LENGTH;
  return Math.floor(raw);
}

function getMaxStringLength() {
  const raw = Number(process.env.APPWRITE_MAX_STRING_LENGTH);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_MAX_STRING_LENGTH;
  return Math.floor(raw);
}

function sanitizeStringValue(value, minLength, maxLength) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length < minLength) return null;
  if (trimmed.length > maxLength) return trimmed.slice(0, maxLength);
  return trimmed;
}

function sanitizeRowData(data) {
  const minLength = getMinStringLength();
  const maxLength = getMaxStringLength();
  const sanitized = { ...data };

  for (const [key, value] of Object.entries(sanitized)) {
    sanitized[key] = sanitizeStringValue(value, minLength, maxLength);
  }

  return sanitized;
}

export async function getAllEmployeeIds() {
  const ids = new Set();
  let offset = 0;

  while (true) {
    const res = await tablesDB.listRows(DB_ID, TABLE_ID, [
      Query.select(["employeeId"]),
      Query.limit(PAGE_LIMIT),
      Query.offset(offset)
    ]);

    for (const row of res.rows) {
      const normalized = normalizeEmployeeId(row.employeeId);
      if (normalized !== null) ids.add(normalized);
    }

    if (res.rows.length < PAGE_LIMIT) break;
    offset += res.rows.length;
  }

  return ids;
}

export async function getFacultyIndexByEmployeeId() {
  const index = new Map();
  let offset = 0;

  while (true) {
    const res = await tablesDB.listRows(DB_ID, TABLE_ID, [
      Query.select(["$id", "employeeId", "photoFileId"]),
      Query.limit(PAGE_LIMIT),
      Query.offset(offset)
    ]);

    for (const row of res.rows) {
      const normalized = normalizeEmployeeId(row.employeeId);
      if (normalized === null) continue;
      index.set(normalized, {
        rowId: row.$id,
        photoFileId: row.photoFileId || null
      });
    }

    if (res.rows.length < PAGE_LIMIT) break;
    offset += res.rows.length;
  }

  return index;
}

export async function addFaculty(data) {
  const sanitizedData = sanitizeRowData(data || {});
  const rowId = employeeIdToRowId(sanitizedData?.employeeId) || ID.unique();
  return tablesDB.createRow(DB_ID, TABLE_ID, rowId, sanitizedData);
}

export async function updateFacultyPhotoByRowId(rowId, photoFileId) {
  return tablesDB.updateRow(DB_ID, TABLE_ID, rowId, { photoFileId });
}

export async function getAllFaculty(limit = 100, offset = 0, searchQuery = null, department = null) {
  try {
    const queries = [Query.limit(limit), Query.offset(offset), Query.orderDesc("$updatedAt")];

    if (searchQuery) queries.push(Query.search("name", searchQuery));
    if (department && department !== "all") queries.push(Query.equal("department", department));

    const res = await tablesDB.listRows(DB_ID, TABLE_ID, queries);
    return {
      faculty: res.rows,
      total: res.total,
      hasMore: offset + limit < res.total
    };
  } catch (error) {
    console.error("Error fetching faculty:", error);
    throw error;
  }
}

export async function getFacultyById(employeeId) {
  try {
    const res = await tablesDB.listRows(DB_ID, TABLE_ID, [Query.equal("employeeId", employeeId)]);
    return res.rows.length > 0 ? res.rows[0] : null;
  } catch (error) {
    console.error("Error fetching faculty by ID:", error);
    throw error;
  }
}

export async function getDepartments() {
  try {
    const res = await tablesDB.listRows(DB_ID, TABLE_ID, [
      Query.select(["department"]),
      Query.limit(PAGE_LIMIT)
    ]);
    return [...new Set(res.rows.map((row) => row.department).filter(Boolean))].sort();
  } catch (error) {
    console.error("Error fetching departments:", error);
    throw error;
  }
}

export async function getFacultyStats() {
  try {
    const res = await tablesDB.listRows(DB_ID, TABLE_ID, [
      Query.select(["department", "designation"]),
      Query.limit(PAGE_LIMIT)
    ]);

    const stats = {
      total: res.total,
      byDepartment: {},
      byDesignation: {},
      lastUpdated: new Date().toISOString()
    };

    for (const faculty of res.rows) {
      if (faculty.department) {
        stats.byDepartment[faculty.department] = (stats.byDepartment[faculty.department] || 0) + 1;
      }
      if (faculty.designation) {
        stats.byDesignation[faculty.designation] = (stats.byDesignation[faculty.designation] || 0) + 1;
      }
    }

    return stats;
  } catch (error) {
    console.error("Error fetching faculty stats:", error);
    throw error;
  }
}

export async function updateFaculty(employeeId, updateData) {
  try {
    const existing = await getFacultyById(employeeId);
    if (!existing) {
      throw new Error(`Faculty with ID ${employeeId} not found`);
    }
    return tablesDB.updateRow(DB_ID, TABLE_ID, existing.$id, sanitizeRowData(updateData || {}));
  } catch (error) {
    console.error("Error updating faculty:", error);
    throw error;
  }
}
