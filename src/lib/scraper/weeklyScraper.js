import { fetchFacultyProfiles } from "./scrape.js";
import {
  addFaculty,
  getAllEmployeeIds,
  getFacultyIndexByEmployeeId,
  updateFacultyPhotoByRowId
} from "../appwrite/facultyRepo.js";
import { photoFileExists, uploadPhotoFromUrl } from "../appwrite/storageRepo.js";

function normalizeEmployeeId(employeeId) {
  if (employeeId === null || employeeId === undefined) return null;
  const normalized = Number(employeeId);
  return Number.isFinite(normalized) ? normalized : null;
}

async function syncExistingFacultyPhoto(faculty, employeeId, facultyIndex) {
  const existing = facultyIndex.get(employeeId);
  if (!existing || !faculty.photoUrl) return false;

  const hasPhotoId = Boolean(existing.photoFileId);
  const hasStorageFile = hasPhotoId ? await photoFileExists(existing.photoFileId) : false;
  const needsPhotoSync = !hasPhotoId || !hasStorageFile;

  if (!needsPhotoSync) return false;

  const uploadedPhotoId = await uploadPhotoFromUrl(employeeId.toString(), faculty.photoUrl, {
    forceReplace: hasPhotoId
  });
  if (!uploadedPhotoId) return false;

  await updateFacultyPhotoByRowId(existing.rowId, uploadedPhotoId);
  existing.photoFileId = uploadedPhotoId;
  return true;
}

export async function weeklyScrape() {
  console.log("Weekly faculty sync started");

  try {
    const shouldSyncExistingPhotos = String(process.env.SCRAPER_SYNC_EXISTING_PHOTOS || "").toLowerCase() === "true";
    const scraped = await fetchFacultyProfiles();
    const existingIds = await getAllEmployeeIds();
    const facultyIndex = await getFacultyIndexByEmployeeId();

    console.log(`Scraped ${scraped.length} faculty profiles`);
    console.log(`Existing faculty count: ${existingIds.size}`);
    console.log(`Existing photo sync: ${shouldSyncExistingPhotos ? "enabled" : "disabled"}`);

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
          console.log(`Photo synced for ${faculty.name} (${employeeId})`);
        }
        continue;
      }

      try {
        let photoFileId = null;
        if (faculty.photoUrl) {
          photoFileId = await uploadPhotoFromUrl(employeeId.toString(), faculty.photoUrl);
          if (photoFileId) photosUploaded++;
        }

        const created = await addFaculty({
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
          facultyIndex.set(employeeId, { rowId: created.$id, photoFileId });
        }
      } catch (error) {
        if (error?.code !== 409) {
          console.log(`Error adding ${faculty.name}: ${error.message}`);
        }
      }
    }

    console.log("Sync completed");
    console.log(`Faculty added: ${added}`);
    console.log(`Photos uploaded: ${photosUploaded}`);
  } catch (error) {
    console.log("Error in scraper:", error.message);
    throw error;
  }
}
