import serverConfig from "../../config/server.js";
import getSupabaseServiceClient from "../supabase/server.js";
import { photoFileExists, uploadPhotoFromUrl } from "./storageRepo.js";
import {
  normalizeRow,
  normalizeRows,
  throwIfSupabaseError,
} from "../supabase/helpers.js";

const FACULTY_COLLECTION = serverConfig.supabaseFacultyTable || "faculty";

function getAdminClient() {
  return getSupabaseServiceClient();
}

function getEmployeeIdKey(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const digitsOnly = normalized.replace(/\D/g, "");
  if (digitsOnly) return digitsOnly;

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  return String(numeric).replace(/\D/g, "") || null;
}

export async function addFacultyAdmin(facultyData) {
  const supabase = getAdminClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from(FACULTY_COLLECTION)
    .insert({
      ...facultyData,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .select("*")
    .single();
  throwIfSupabaseError(error, "Failed to add faculty.");
  return normalizeRow(data);
}

function buildFacultyIndex(rows = [], sourceColumn = "employeeId") {
  const index = new Map();
  let missingEmployeeId = 0;

  normalizeRows(rows || []).forEach((row) => {
    const rawEmployeeId =
      sourceColumn === "employeeid" ? row.employeeid : row.employeeId;
    const employeeId = getEmployeeIdKey(rawEmployeeId);
    if (!employeeId) {
      missingEmployeeId++;
      return;
    }

    index.set(employeeId, {
      $id: row.$id,
      photoFileId: row.photoFileId || null,
    });
  });

  return {
    index,
    stats: {
      table: FACULTY_COLLECTION,
      sourceColumn,
      totalRows: rows?.length || 0,
      indexedCount: index.size,
      missingEmployeeId,
    },
  };
}

export async function getAllEmployeeIdsAdmin() {
  const { index } = await getFacultyIndexByEmployeeIdAdminWithStats();
  return new Set(index.keys());
}

export async function getFacultyIndexByEmployeeIdAdminWithStats() {
  const supabase = getAdminClient();
  const primary = await supabase
    .from(FACULTY_COLLECTION)
    .select("id, employeeId, photoFileId")
    .limit(5000);

  if (primary.error) {
    const fallback = await supabase
      .from(FACULTY_COLLECTION)
      .select("id, employeeid, photoFileId")
      .limit(5000);

    if (fallback.error) {
      throw new Error(
        `Failed to load faculty index from ${FACULTY_COLLECTION}: ${primary.error.message}; fallback failed: ${fallback.error.message}`,
      );
    }

    return buildFacultyIndex(fallback.data || [], "employeeid");
  }

  const primaryResult = buildFacultyIndex(primary.data || [], "employeeId");
  if (
    primaryResult.stats.indexedCount > 0 ||
    primaryResult.stats.totalRows === 0
  ) {
    return primaryResult;
  }

  const legacyFallback = await supabase
    .from(FACULTY_COLLECTION)
    .select("id, employeeid, photoFileId")
    .limit(5000);

  if (legacyFallback.error) {
    return primaryResult;
  }

  const fallbackResult = buildFacultyIndex(
    legacyFallback.data || [],
    "employeeid",
  );
  if (fallbackResult.stats.indexedCount > 0) {
    return fallbackResult;
  }

  return primaryResult;
}

export async function getFacultyIndexByEmployeeIdAdmin() {
  const { index } = await getFacultyIndexByEmployeeIdAdminWithStats();
  return index;
}

export async function updateFacultyPhotoByDocIdAdmin(docId, photoFileId) {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from(FACULTY_COLLECTION)
    .update({
      photoFileId,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", docId);
  throwIfSupabaseError(error, "Failed to update faculty photo.");
  return { success: true };
}

export async function uploadPhotoFromUrlAdmin(
  employeeId,
  photoUrl,
  options = {},
) {
  try {
    return await uploadPhotoFromUrl(employeeId, photoUrl, options);
  } catch (uploadError) {
    console.error(
      `Failed to upload photo for employee ${employeeId}:`,
      uploadError?.message,
    );
    return null;
  }
}

export async function photoFileExistsAdmin(photoFileId) {
  return photoFileExists(photoFileId);
}

export default {
  addFacultyAdmin,
  getAllEmployeeIdsAdmin,
  getFacultyIndexByEmployeeIdAdmin,
  getFacultyIndexByEmployeeIdAdminWithStats,
  updateFacultyPhotoByDocIdAdmin,
  uploadPhotoFromUrlAdmin,
  photoFileExistsAdmin,
};
