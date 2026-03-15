import serverConfig from "../../config/server.js";
import getSupabaseServiceClient from "../supabase/server.js";
import {
  normalizeRow,
  normalizeRows,
  throwIfSupabaseError,
} from "../supabase/helpers.js";

const FACULTY_COLLECTION = serverConfig.supabaseFacultyTable || "faculty";
const PAGE_LIMIT = 5000;
const DEFAULT_MIN_STRING_LENGTH = 2;
const DEFAULT_MAX_STRING_LENGTH = 255;

function normalizeEmployeeId(employeeId) {
  const normalized = String(employeeId ?? "").trim();
  if (!normalized) return null;
  const digitsOnly = normalized.replace(/\D/g, "");
  if (digitsOnly) return digitsOnly;

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  return String(numeric).replace(/\D/g, "") || null;
}

function getMinStringLength() {
  const raw = Number(process.env.SUPABASE_MIN_STRING_LENGTH);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_MIN_STRING_LENGTH;
  return Math.floor(raw);
}

function getMaxStringLength() {
  const raw = Number(process.env.SUPABASE_MAX_STRING_LENGTH);
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

function getClient() {
  return getSupabaseServiceClient();
}

export async function getAllEmployeeIds() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(FACULTY_COLLECTION)
    .select("employeeId")
    .limit(PAGE_LIMIT);
  throwIfSupabaseError(error, "Failed to load faculty ids.");
  return new Set(
    (data || [])
      .map((row) => normalizeEmployeeId(row.employeeId))
      .filter((value) => value !== null),
  );
}

export async function getFacultyIndexByEmployeeId() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(FACULTY_COLLECTION)
    .select("id, employeeId, photoFileId")
    .limit(PAGE_LIMIT);
  throwIfSupabaseError(error, "Failed to load faculty index.");

  const index = new Map();
  normalizeRows(data || []).forEach((row) => {
    const normalized = normalizeEmployeeId(row.employeeId);
    if (normalized === null) return;
    index.set(normalized, {
      docId: row.$id,
      photoFileId: row.photoFileId || null,
    });
  });
  return index;
}

export async function addFaculty(data) {
  const supabase = getClient();
  const sanitizedData = sanitizeRowData(data || {});
  const timestamp = new Date().toISOString();
  const { data: created, error } = await supabase
    .from(FACULTY_COLLECTION)
    .insert({
      ...sanitizedData,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .select("*")
    .single();
  throwIfSupabaseError(error, "Failed to add faculty.");
  return normalizeRow(created);
}

export async function updateFacultyPhotoByDocId(docId, photoFileId) {
  const supabase = getClient();
  const { error } = await supabase
    .from(FACULTY_COLLECTION)
    .update({
      photoFileId,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", docId);
  throwIfSupabaseError(error, "Failed to update faculty photo.");
}

export async function getAllFaculty(
  limitVal = 100,
  offsetVal = 0,
  searchQuery = null,
  department = null,
) {
  const supabase = getClient();
  let query = supabase
    .from(FACULTY_COLLECTION)
    .select("*", { count: "exact" })
    .order("updatedAt", { ascending: false })
    .range(offsetVal, offsetVal + limitVal - 1);

  if (department && department !== "all") {
    query = query.eq("department", department);
  }
  if (searchQuery) {
    query = query.ilike("name", `%${searchQuery}%`);
  }

  const { data, error, count } = await query;
  throwIfSupabaseError(error, "Failed to load faculty.");

  return {
    faculty: normalizeRows(data || []),
    total: Number(count || 0),
    hasMore: offsetVal + limitVal < Number(count || 0),
  };
}

export async function getFacultyById(employeeId) {
  const supabase = getClient();
  const normalizedEmployeeId = Number(normalizeEmployeeId(employeeId));
  if (!Number.isFinite(normalizedEmployeeId)) return null;
  const { data, error } = await supabase
    .from(FACULTY_COLLECTION)
    .select("*")
    .eq("employeeId", normalizedEmployeeId)
    .limit(1)
    .maybeSingle();
  throwIfSupabaseError(error, "Failed to load faculty.");
  return data ? normalizeRow(data) : null;
}

export async function getDepartments() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(FACULTY_COLLECTION)
    .select("department")
    .limit(PAGE_LIMIT);
  throwIfSupabaseError(error, "Failed to load departments.");

  const departments = new Set();
  (data || []).forEach((row) => {
    if (row.department) departments.add(row.department);
  });
  return Array.from(departments).sort();
}

export async function getFacultyStats() {
  const supabase = getClient();
  const { data, error, count } = await supabase
    .from(FACULTY_COLLECTION)
    .select("department, designation", { count: "exact" })
    .limit(PAGE_LIMIT);
  throwIfSupabaseError(error, "Failed to load faculty stats.");

  const stats = {
    total: Number(count || 0),
    byDepartment: {},
    byDesignation: {},
    lastUpdated: new Date().toISOString(),
  };

  (data || []).forEach((row) => {
    if (row.department) {
      stats.byDepartment[row.department] =
        (stats.byDepartment[row.department] || 0) + 1;
    }
    if (row.designation) {
      stats.byDesignation[row.designation] =
        (stats.byDesignation[row.designation] || 0) + 1;
    }
  });

  return stats;
}

export async function updateFaculty(employeeId, updateData) {
  const existing = await getFacultyById(employeeId);
  if (!existing) {
    throw new Error(`Faculty with ID ${employeeId} not found`);
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from(FACULTY_COLLECTION)
    .update({
      ...sanitizeRowData(updateData || {}),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", existing.$id)
    .select("*")
    .single();
  throwIfSupabaseError(error, "Failed to update faculty.");
  return normalizeRow(data);
}
