import { fetchFacultyProfiles } from "./scrape.js";
import {
  addFacultyAdmin,
  getAllEmployeeIdsAdmin,
  getFacultyIndexByEmployeeIdAdmin,
  updateFacultyPhotoByDocIdAdmin,
  uploadPhotoFromUrlAdmin,
  photoFileExistsAdmin,
} from "../firebase/adminRepo.js";

function normalizeEmployeeId(employeeId) {
  if (employeeId === null || employeeId === undefined) return null;
  const normalized = Number(employeeId);
  return Number.isFinite(normalized) ? normalized : null;
}

async function syncExistingFacultyPhoto(faculty, employeeId, facultyIndex) {
  const existing = facultyIndex.get(employeeId);
  if (!existing || !faculty.photoUrl) return false;

  const hasPhotoId = Boolean(existing.photoFileId);
  const hasStorageFile = hasPhotoId ? await photoFileExistsAdmin(existing.photoFileId) : false;
  const needsPhotoSync = !hasPhotoId || !hasStorageFile;

  if (!needsPhotoSync) return false;

  const uploadedPhotoId = await uploadPhotoFromUrlAdmin(employeeId.toString(), faculty.photoUrl, {
    forceReplace: hasPhotoId
  });
  if (!uploadedPhotoId) return false;

  await updateFacultyPhotoByDocIdAdmin(existing.$id, uploadedPhotoId);
  existing.photoFileId = uploadedPhotoId;
  return true;
}

export async function weeklyScrape() {

  try {
    const shouldSyncExistingPhotos = String(process.env.SCRAPER_SYNC_EXISTING_PHOTOS || "").toLowerCase() === "true";
    const scraped = await fetchFacultyProfiles();
    const existingIds = await getAllEmployeeIdsAdmin();
    const facultyIndex = await getFacultyIndexByEmployeeIdAdmin();

    let added = 0;
    let photosUploaded = 0;

    for (const faculty of scraped) {
      const employeeId = normalizeEmployeeId(faculty.employeeid);
      if (!employeeId) continue;

      if (existingIds.has(employeeId)) {
        if (!shouldSyncExistingPhotos) continue;
        const synced = await syncExistingFacultyPhoto(faculty, employeeId, facultyIndex);
        if (synced) {
          photosUploaded++;
        }
        continue;
      }

      try {
        let photoFileId = null;
        if (faculty.photoUrl) {
          photoFileId = await uploadPhotoFromUrlAdmin(employeeId.toString(), faculty.photoUrl);
          if (photoFileId) photosUploaded++;
        }

        const created = await addFacultyAdmin({
          employeeId,
          name: faculty.name || "Unknown",
          designation: faculty.designation || "Unknown",
          department: faculty.department || "Unknown",
          subDepartment: faculty.subDepartment || null,
          educationUG: faculty.educationUG || null,
          educationPG: faculty.educationPG || null,
          educationPhD: faculty.educationPhD || null,
          educationOther: faculty.educationOther || null,
          researchArea: faculty.researchArea || null,
          photoFileId
        });

        added++;
        existingIds.add(employeeId);
        if (created?.$id) {
          facultyIndex.set(employeeId, { $id: created.$id, photoFileId });
        }
      } catch (error) {
        if (error?.code !== 409) {
        }
      }
    }
  } catch (error) {
    throw error;
  }
}
