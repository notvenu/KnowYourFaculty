import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const CMS_BASE_URL = "https://cms.vitap.ac.in";
const FACULTY_ENDPOINT =
  "/api/faculty-profiles" +
  "?fields[0]=Name" +
  "&fields[1]=Employee_Id" +
  "&fields[2]=Designation" +
  "&fields[3]=Department" +
  "&fields[4]=sub_department" +
  "&fields[5]=Education_UG" +
  "&fields[6]=Education_PG" +
  "&fields[7]=Education_PHD" +
  "&fields[8]=Education_other" +
  "&fields[9]=Research_area_of_specialization" +
  "&populate[Photo][fields][0]=url";

type FacultyRecord = {
  employeeId: number | null;
  name: string;
  designation: string;
  department: string;
  subDepartment: string | null;
  educationUG: string | null;
  educationPG: string | null;
  educationPhD: string | null;
  educationOther: string | null;
  researchArea: string | null;
  photoUrl: string | null;
};

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = Deno.env.get(key)?.trim();
    if (value) return value;
  }
  return "";
}

function getRequiredEnv(key: string) {
  const aliases: Record<string, string[]> = {
    AUTH_TOKEN: ["AUTH_TOKEN", "VITE_AUTH_TOKEN"],
    DB_URL: [
      "DB_URL",
      "SUPABASE_URL",
      "VITE_SUPABASE_URL",
      "SB_URL",
      "PROJECT_URL",
    ],
    DB_SERVICE_ROLE_KEY: [
      "DB_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SERVICE_ROLE_KEY",
      "SB_SERVICE_ROLE_KEY",
    ],
    DB_FACULTY_TABLE: [
      "DB_FACULTY_TABLE",
      "SUPABASE_FACULTY_TABLE",
      "VITE_SUPABASE_FACULTY_TABLE",
    ],
    CLOUDINARY_CLOUD_NAME: [
      "CLOUDINARY_CLOUD_NAME",
      "VITE_CLOUDINARY_CLOUD_NAME",
    ],
    CLOUDINARY_API_KEY: ["CLOUDINARY_API_KEY"],
    CLOUDINARY_API_SECRET: ["CLOUDINARY_API_SECRET"],
    CLOUDINARY_UPLOAD_PRESET: [
      "CLOUDINARY_UPLOAD_PRESET",
      "VITE_CLOUDINARY_UPLOAD_PRESET",
    ],
    CLOUDINARY_FOLDER: ["CLOUDINARY_FOLDER", "VITE_CLOUDINARY_FOLDER"],
    SCRAPER_SYNC_EXISTING_PHOTOS: ["SCRAPER_SYNC_EXISTING_PHOTOS"],
    DB_CRON_SECRET: ["DB_CRON_SECRET", "SUPABASE_CRON_SECRET"],
  };

  return readEnv(...(aliases[key] || [key]));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function getFacultyTable() {
  return getRequiredEnv("DB_FACULTY_TABLE") || "faculty";
}

type FacultyIndexStats = {
  table: string;
  sourceColumn: "employeeId" | "employeeid";
  totalRows: number;
  indexedCount: number;
  missingEmployeeId: number;
};

function getCloudinaryFolder() {
  return String(
    getRequiredEnv("CLOUDINARY_FOLDER") || "faculty_photos",
  ).replace(/\/+$/, "");
}

function buildCloudinaryPublicId(fileId: string) {
  const normalized = String(fileId || "")
    .trim()
    .replace(/^\/+/, "");
  if (!normalized) return "";
  if (normalized.includes("/")) return normalized;
  const folder = getCloudinaryFolder();
  return folder ? `${folder}/${normalized}` : normalized;
}

function getEmployeeIdKey(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const digitsOnly = normalized.replace(/\D/g, "");
  if (digitsOnly) return digitsOnly;

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  return String(numeric).replace(/\D/g, "") || null;
}

function normalizeEmployeeId(value: unknown) {
  const normalized = getEmployeeIdKey(value);
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeFaculty(payload: any): FacultyRecord[] {
  return (payload?.data || []).map(({ attributes = {} }) => {
    const rawPhotoUrl = attributes.Photo?.data?.attributes?.url || null;
    const photoUrl =
      rawPhotoUrl && rawPhotoUrl.startsWith("/")
        ? `${CMS_BASE_URL}${rawPhotoUrl}`
        : rawPhotoUrl;

    return {
      employeeId: normalizeEmployeeId(attributes.Employee_Id),
      name: attributes.Name || "Unknown",
      designation: attributes.Designation || "Unknown",
      department: attributes.Department || "Unknown",
      subDepartment: attributes.sub_department || null,
      educationUG: attributes.Education_UG || null,
      educationPG: attributes.Education_PG || null,
      educationPhD: attributes.Education_PHD || null,
      educationOther: attributes.Education_other || null,
      researchArea: attributes.Research_area_of_specialization || null,
      photoUrl,
    };
  });
}

async function sha1Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createCloudinaryUploadSignature(
  params: Record<string, string | number>,
) {
  const apiSecret = getRequiredEnv("CLOUDINARY_API_SECRET");
  const payload = Object.entries(params || {})
    .filter(
      ([, value]) =>
        value !== undefined && value !== null && String(value) !== "",
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return sha1Hex(`${payload}${apiSecret}`);
}

async function scrapeFacultyProfiles() {
  const response = await fetch(`${CMS_BASE_URL}${FACULTY_ENDPOINT}`, {
    headers: {
      Authorization: `Bearer ${getRequiredEnv("AUTH_TOKEN")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`CMS scrape failed with status ${response.status}`);
  }

  return normalizeFaculty(await response.json());
}

function getSupabaseClient() {
  return createClient(
    getRequiredEnv("DB_URL"),
    getRequiredEnv("DB_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

async function getFacultyIndex() {
  const supabase = getSupabaseClient();
  const table = getFacultyTable();
  const index = new Map<string, { id: string; photoFileId: string | null }>();

  const buildIndex = (
    rows: Array<{
      id: string | number;
      employeeId?: unknown;
      employeeid?: unknown;
      photoFileId?: string | null;
    }>,
    sourceColumn: "employeeId" | "employeeid",
  ) => {
    let missingEmployeeId = 0;
    for (const row of rows || []) {
      const rawEmployeeId =
        sourceColumn === "employeeid" ? row.employeeid : row.employeeId;
      const employeeId = getEmployeeIdKey(rawEmployeeId);
      if (!employeeId) {
        missingEmployeeId += 1;
        continue;
      }
      index.set(employeeId, {
        id: String(row.id),
        photoFileId: row.photoFileId || null,
      });
    }

    const stats: FacultyIndexStats = {
      table,
      sourceColumn,
      totalRows: rows?.length || 0,
      indexedCount: index.size,
      missingEmployeeId,
    };

    return stats;
  };

  const primary = await supabase
    .from(table)
    .select("id, employeeId, photoFileId")
    .limit(5000);

  if (primary.error) {
    const fallback = await supabase
      .from(table)
      .select("id, employeeid, photoFileId")
      .limit(5000);

    if (fallback.error) {
      throw new Error(
        `Failed to load faculty index from ${table}: ${primary.error.message}; fallback failed: ${fallback.error.message}`,
      );
    }

    return {
      index,
      stats: buildIndex(fallback.data || [], "employeeid"),
    };
  }

  const primaryStats = buildIndex(primary.data || [], "employeeId");
  if (primaryStats.indexedCount > 0 || primaryStats.totalRows === 0) {
    return { index, stats: primaryStats };
  }

  // Some datasets may still carry legacy "employeeid" values while "employeeId" is null.
  const legacyFallback = await supabase
    .from(table)
    .select("id, employeeid, photoFileId")
    .limit(5000);

  if (legacyFallback.error) {
    return { index, stats: primaryStats };
  }

  index.clear();
  const fallbackStats = buildIndex(legacyFallback.data || [], "employeeid");
  if (fallbackStats.indexedCount > 0) {
    return { index, stats: fallbackStats };
  }

  return { index, stats: primaryStats };
}

function getCloudinaryImageUrl(fileId: string) {
  const cloudName = getRequiredEnv("CLOUDINARY_CLOUD_NAME");
  const publicId = buildCloudinaryPublicId(fileId);
  if (!cloudName || !publicId) return null;
  const extensionMatch = publicId.match(/\.([a-z0-9]+)$/i);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : "";
  return `https://res.cloudinary.com/${cloudName}/image/upload/${encodeURI(publicId)}${extension}`;
}

async function photoFileExists(photoFileId: string) {
  const url = getCloudinaryImageUrl(photoFileId);
  if (!url) return false;
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function uploadPhotoFromUrl(
  employeeId: number,
  photoUrl: string,
  options: { forceReplace?: boolean } = {},
) {
  const response = await fetch(photoUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "image/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Image fetch failed for ${employeeId}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const publicId = buildCloudinaryPublicId(`${employeeId}.jpg`);
  const timestamp = Math.floor(Date.now() / 1000);
  const overwrite = options.forceReplace ? "true" : "false";
  const uploadPreset = getRequiredEnv("CLOUDINARY_UPLOAD_PRESET");

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([await response.arrayBuffer()], { type: contentType }),
    `${employeeId}.jpg`,
  );
  formData.append("public_id", publicId);
  formData.append("format", "jpg");
  formData.append("overwrite", overwrite);
  formData.append("timestamp", String(timestamp));

  if (uploadPreset) {
    formData.append("upload_preset", uploadPreset);
  }

  formData.append("api_key", getRequiredEnv("CLOUDINARY_API_KEY"));
  formData.append(
    "signature",
    await createCloudinaryUploadSignature({
      format: "jpg",
      overwrite,
      public_id: publicId,
      timestamp,
      ...(uploadPreset ? { upload_preset: uploadPreset } : {}),
    }),
  );

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${getRequiredEnv("CLOUDINARY_CLOUD_NAME")}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!uploadResponse.ok) {
    throw new Error(`Cloudinary upload failed: ${await uploadResponse.text()}`);
  }

  const payload = await uploadResponse.json();
  return payload.public_id || publicId;
}

async function insertFaculty(
  faculty: FacultyRecord,
  photoFileId: string | null,
) {
  const supabase = getSupabaseClient();
  const timestamp = new Date().toISOString();
  const { error } = await supabase.from(getFacultyTable()).insert({
    employeeId: faculty.employeeId,
    name: faculty.name,
    designation: faculty.designation,
    department: faculty.department,
    subDepartment: faculty.subDepartment,
    educationUG: faculty.educationUG,
    educationPG: faculty.educationPG,
    educationPhD: faculty.educationPhD,
    educationOther: faculty.educationOther,
    researchArea: faculty.researchArea,
    photoFileId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  if (error) {
    throw new Error(
      `Failed to insert faculty ${faculty.employeeId}: ${error.message}`,
    );
  }
}

async function updateFacultyPhoto(rowId: string, photoFileId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(getFacultyTable())
    .update({
      photoFileId,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", rowId);

  if (error) {
    throw new Error(`Failed to update faculty photo: ${error.message}`);
  }
}

Deno.serve(async (request) => {
  try {
    const cronSecret = getRequiredEnv("DB_CRON_SECRET");
    if (cronSecret) {
      const provided =
        request.headers.get("x-cron-secret") ||
        request.headers
          .get("authorization")
          ?.replace(/^Bearer\s+/i, "")
          .trim() ||
        "";
      if (provided !== cronSecret) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const syncExistingPhotos =
      String(getRequiredEnv("SCRAPER_SYNC_EXISTING_PHOTOS")).toLowerCase() ===
      "true";
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";

    const [scrapedFaculty, facultyIndexResult] = await Promise.all([
      scrapeFacultyProfiles(),
      getFacultyIndex(),
    ]);
    const { index: facultyIndex, stats: facultyIndexStats } =
      facultyIndexResult;

    let added = 0;
    let wouldAdd = 0;
    let photosUploaded = 0;
    let updatedPhotos = 0;
    let wouldUpdatePhotos = 0;
    let skipped = 0;

    for (const faculty of scrapedFaculty) {
      const employeeKey = getEmployeeIdKey(faculty.employeeId);
      if (!employeeKey || !Number.isFinite(Number(faculty.employeeId))) {
        skipped += 1;
        continue;
      }

      const existing = facultyIndex.get(employeeKey);
      if (existing) {
        if (!syncExistingPhotos || !faculty.photoUrl) continue;

        const needsPhotoSync =
          !existing.photoFileId ||
          !(await photoFileExists(existing.photoFileId));
        if (!needsPhotoSync) continue;

        if (dryRun) {
          wouldUpdatePhotos += 1;
          continue;
        }

        const photoFileId = await uploadPhotoFromUrl(
          Number(faculty.employeeId),
          faculty.photoUrl,
          { forceReplace: Boolean(existing.photoFileId) },
        );
        await updateFacultyPhoto(existing.id, photoFileId);
        existing.photoFileId = photoFileId;
        photosUploaded += 1;
        updatedPhotos += 1;
        continue;
      }

      if (dryRun) {
        wouldAdd += 1;
        facultyIndex.set(employeeKey, { id: "", photoFileId: null });
        continue;
      }

      let photoFileId: string | null = null;
      if (faculty.photoUrl) {
        photoFileId = await uploadPhotoFromUrl(
          Number(faculty.employeeId),
          faculty.photoUrl,
        );
        if (photoFileId) photosUploaded += 1;
      }

      await insertFaculty(faculty, photoFileId);
      facultyIndex.set(employeeKey, { id: "", photoFileId });
      added += 1;
    }

    return json({
      ok: true,
      mode: dryRun ? "dry-run" : "live",
      scanned: scrapedFaculty.length,
      facultyTable: facultyIndexStats.table,
      indexSourceColumn: facultyIndexStats.sourceColumn,
      existingRowsScanned: facultyIndexStats.totalRows,
      existingIndexed: facultyIndexStats.indexedCount,
      existingMissingEmployeeId: facultyIndexStats.missingEmployeeId,
      added,
      wouldAdd,
      photosUploaded,
      updatedPhotos,
      wouldUpdatePhotos,
      skipped,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
