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

/*
 * The CMS Employee_Id is a decimal such as 11.70279. The part before the dot changes over time,
 * so stripping the dot (what we store: 1170279) gives the same person a new id on a later crawl,
 * and an id-only match inserts a duplicate. The digits after the dot (70279) are the stable id.
 * Stored ids keep the old composite form, so match on "stored id ends with the stable id and
 * has at most two extra leading digits".
 */
function getStableKey(rawEmployeeId) {
  const text = String(rawEmployeeId ?? "").trim();
  const dot = text.indexOf(".");
  return dot >= 0 && dot < text.length - 1 ? text.slice(dot + 1) : null;
}

function normalizeName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/\b(dr|prof|mr|mrs|ms)\b\.?/g, "")
    .replace(/[^a-z]/g, "");
}

function buildSuffixIndex(facultyIndex) {
  const suffixIndex = new Map();
  for (const id of facultyIndex.keys()) {
    for (let cut = 0; cut <= 2; cut++) {
      const key = id.slice(cut);
      if (key.length < 4) continue;
      if (!suffixIndex.has(key)) suffixIndex.set(key, []);
      suffixIndex.get(key).push(id);
    }
  }
  return suffixIndex;
}

/** Returns the stored id key of the same person, or null if this faculty is new. */
function findExistingKey(rawEmployeeId, employeeId, facultyIndex, suffixIndex) {
  if (facultyIndex.has(employeeId)) return employeeId;
  const stable = getStableKey(rawEmployeeId);
  const hits = stable ? suffixIndex.get(stable) || [] : [];
  if (hits.length > 1) {
    console.warn(
      `Ambiguous match for ${rawEmployeeId}: ${hits.join(", ")}; treating as existing`,
    );
  }
  return hits[0] ?? null;
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

export async function weeklyScrape({ dryRun = false } = {}) {
  try {
    const shouldSyncExistingPhotos =
      String(process.env.SCRAPER_SYNC_EXISTING_PHOTOS || "").toLowerCase() ===
      "true";
    const scraped = await fetchFacultyProfiles();
    const { index: facultyIndex, stats: facultyIndexStats } =
      await getFacultyIndexByEmployeeIdAdminWithStats();

    const suffixIndex = buildSuffixIndex(facultyIndex);
    // Safety net: the CMS can list one person under two profiles. A new id with an
    // already-stored name is skipped, not inserted as a duplicate.
    const storedNames = new Set(
      [...facultyIndex.values()]
        .map((row) => normalizeName(row.name))
        .filter(Boolean),
    );
    const skippedSameName = [];
    const wouldAdd = [];
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

      const existingKey = findExistingKey(
        faculty.employeeid,
        employeeId,
        facultyIndex,
        suffixIndex,
      );
      if (existingKey) {
        if (!shouldSyncExistingPhotos || dryRun) continue;
        const synced = await syncExistingFacultyPhoto(
          faculty,
          existingKey,
          facultyIndex,
        );
        if (synced) {
          photosUploaded++;
          updatedPhotos++;
        }
        continue;
      }

      const nameKey = normalizeName(faculty.name);
      if (nameKey && storedNames.has(nameKey)) {
        skippedSameName.push({ employeeId, name: faculty.name });
        continue;
      }

      if (dryRun) {
        wouldAdd.push({ employeeId, name: faculty.name });
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
        if (nameKey) storedNames.add(nameKey);
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
      mode: dryRun ? "dry-run" : "live",
      added,
      wouldAdd: dryRun ? wouldAdd : undefined,
      photosUploaded,
      updatedPhotos,
      skipped,
      skippedSameName,
      failed,
    };
  } catch (error) {
    throw error;
  }
}
