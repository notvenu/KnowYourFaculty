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

export async function getAllEmployeeIdsAdmin() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from(FACULTY_COLLECTION)
    .select("employeeId")
    .limit(5000);
  throwIfSupabaseError(error, "Failed to load faculty ids.");

  return new Set(
    (data || []).map((row) => getEmployeeIdKey(row.employeeId)).filter(Boolean),
  );
}

export async function getFacultyIndexByEmployeeIdAdmin() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from(FACULTY_COLLECTION)
    .select("id, employeeId, photoFileId")
    .limit(5000);
  throwIfSupabaseError(error, "Failed to load faculty index.");

  const index = new Map();
  normalizeRows(data || []).forEach((row) => {
    const employeeId = getEmployeeIdKey(row.employeeId);
    if (!employeeId) return;
    index.set(employeeId, {
      $id: row.$id,
      photoFileId: row.photoFileId || null,
    });
  });
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
  updateFacultyPhotoByDocIdAdmin,
  uploadPhotoFromUrlAdmin,
  photoFileExistsAdmin,
};
