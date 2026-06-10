import { fetchFacultyProfiles } from "./scrape.js";
import {
  addFacultyAdmin,
  getFacultyIndexByEmployeeIdAdminWithStats,
  updateFacultyPhotoByDocIdAdmin,
  uploadPhotoFromUrlAdmin,
  photoFileExistsAdmin,
} from "../firebase/adminRepo.js";

function normalizeEmployeeId(employeeId) {
  const normalized = String(employeeId ?? "").trim();
  if (!normalized) return null;
  const digitsOnly = normalized.replace(/\D/g, "");
  if (digitsOnly) return digitsOnly;

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  return String(numeric).replace(/\D/g, "") || null;
}

async function syncExistingFacultyPhoto(faculty, employeeId, facultyIndex) {
  const existing = facultyIndex.get(employeeId);
  if (!existing || !faculty.photoUrl) return false;

  const hasPhotoId = Boolean(existing.photoFileId);
  const hasStorageFile = hasPhotoId
    ? await photoFileExistsAdmin(existing.photoFileId)
    : false;
  const needsPhotoSync = !hasPhotoId || !hasStorageFile;

  if (!needsPhotoSync) return false;

  const uploadedPhotoId = await uploadPhotoFromUrlAdmin(
    employeeId,
    faculty.photoUrl,
    {
      forceReplace: hasPhotoId,
    },
  );
  if (!uploadedPhotoId) return false;

  await updateFacultyPhotoByDocIdAdmin(existing.$id, uploadedPhotoId);
  existing.photoFileId = uploadedPhotoId;
  return true;
}

export async function weeklyScrape() {
  try {
    const shouldSyncExistingPhotos =
      String(process.env.SCRAPER_SYNC_EXISTING_PHOTOS || "").toLowerCase() ===
      "true";
    const scraped = await fetchFacultyProfiles();
    const { index: facultyIndex, stats: facultyIndexStats } =
      await getFacultyIndexByEmployeeIdAdminWithStats();

    let added = 0;
    let photosUploaded = 0;
    let updatedPhotos = 0;
    let skipped = 0;
    let failed = 0;

    for (const faculty of scraped) {
      const employeeId = normalizeEmployeeId(faculty.employeeid);
      if (!employeeId || !Number.isFinite(Number(employeeId))) {
        skipped++;
        continue;
      }

      if (facultyIndex.has(employeeId)) {
        if (!shouldSyncExistingPhotos) continue;
        const synced = await syncExistingFacultyPhoto(
          faculty,
          employeeId,
          facultyIndex,
        );
        if (synced) {
          photosUploaded++;
          updatedPhotos++;
        }
        continue;
      }

      try {
        let photoFileId = null;
        if (faculty.photoUrl) {
          photoFileId = await uploadPhotoFromUrlAdmin(
            employeeId,
            faculty.photoUrl,
          );
          if (photoFileId) photosUploaded++;
        }

        const created = await addFacultyAdmin({
          employeeId: Number(employeeId),
          name: faculty.name || "Unknown",
          designation: faculty.designation || "Unknown",
          department: faculty.department || "Unknown",
          subDepartment: faculty.subDepartment || null,
          educationUG: faculty.educationUG || null,
          educationPG: faculty.educationPG || null,
          educationPhD: faculty.educationPhD || null,
          educationOther: faculty.educationOther || null,
          researchArea: faculty.researchArea || null,
          photoFileId,
        });

        added++;
        if (created?.$id) {
          facultyIndex.set(employeeId, { $id: created.$id, photoFileId });
        } else {
          facultyIndex.set(employeeId, { $id: "", photoFileId });
        }
      } catch (error) {
        if (error?.code === "23505" || error?.code === 409) {
          facultyIndex.set(employeeId, { $id: "", photoFileId: null });
        } else {
          failed++;
          console.error(
            `Failed to add faculty ${employeeId}:`,
            error?.message ?? error,
          );
          if (error?.details) console.error("Details:", error.details);
          if (error?.hint) console.error("Hint:", error.hint);
        }
      }
    }

    return {
      ok: failed === 0,
      scanned: scraped.length,
      facultyTable: facultyIndexStats.table,
      indexSourceColumn: facultyIndexStats.sourceColumn,
      existingRowsScanned: facultyIndexStats.totalRows,
      existingIndexed: facultyIndexStats.indexedCount,
      existingMissingEmployeeId: facultyIndexStats.missingEmployeeId,
      added,
      photosUploaded,
      updatedPhotos,
      skipped,
      failed,
    };
  } catch (error) {
    throw error;
  }
}
