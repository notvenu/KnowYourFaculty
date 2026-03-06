import axios from "axios";
import admin from "firebase-admin";
import { config as loadDotenv } from "dotenv";

// Support local execution by reading env from both functions/.env and repo .env.
loadDotenv();
loadDotenv({ path: "../.env" });

const REQUIRED_ENV_KEYS = [
  "AUTH_TOKEN",
];

const parseFirebaseConfig = () => {
  try {
    const raw = String(process.env.FIREBASE_CONFIG || "").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const toEnv = (key) => {
  const aliases = {
    KYF_PROJECT_ID: ["KYF_PROJECT_ID", "FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID"],
    KYF_CLIENT_EMAIL: ["KYF_CLIENT_EMAIL", "FIREBASE_CLIENT_EMAIL", "VITE_FIREBASE_CLIENT_EMAIL"],
    KYF_PRIVATE_KEY: ["KYF_PRIVATE_KEY", "FIREBASE_PRIVATE_KEY", "VITE_FIREBASE_PRIVATE_KEY"],
    KYF_STORAGE_BUCKET: [
      "KYF_STORAGE_BUCKET",
      "FIREBASE_STORAGE_BUCKET",
      "VITE_FIREBASE_STORAGE_BUCKET",
    ],
    KYF_FACULTY_COLLECTION: [
      "KYF_FACULTY_COLLECTION",
      "FIREBASE_FACULTY_COLLECTION",
      "VITE_FIREBASE_FACULTY_COLLECTION",
    ],
    AUTH_TOKEN: ["AUTH_TOKEN", "VITE_AUTH_TOKEN"],
    SCRAPER_SYNC_EXISTING_PHOTOS: ["SCRAPER_SYNC_EXISTING_PHOTOS"],
    KYF_DRY_RUN: ["KYF_DRY_RUN"],
    KYF_TEST_FIREBASE_ONLY: ["KYF_TEST_FIREBASE_ONLY"],
  };

  const keys = aliases[key] || [key];
  for (const envKey of keys) {
    const value = String(process.env[envKey] || "").trim();
    if (value) return value;
  }
  return "";
};

const sanitizeBucketName = (bucketName) =>
  String(bucketName || "").trim().replace(/^gs:\/\//, "");

const resolveProjectId = () =>
  toEnv("KYF_PROJECT_ID") ||
  String(process.env.GCLOUD_PROJECT || "").trim() ||
  String(process.env.GCP_PROJECT || "").trim() ||
  String(parseFirebaseConfig().projectId || "").trim();

const resolveStorageBucket = () => {
  const explicit = sanitizeBucketName(toEnv("KYF_STORAGE_BUCKET"));
  if (explicit) return explicit;

  const firebaseConfigBucket = sanitizeBucketName(
    parseFirebaseConfig().storageBucket,
  );
  if (firebaseConfigBucket) return firebaseConfigBucket;

  const projectId = resolveProjectId();
  return projectId ? `${projectId}.firebasestorage.app` : "";
};

const validateEnv = () => {
  const firebaseOnlyTest =
    String(toEnv("KYF_TEST_FIREBASE_ONLY")).toLowerCase() === "true";
  if (firebaseOnlyTest) return;

  const missing = REQUIRED_ENV_KEYS.filter((key) => !toEnv(key));
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
};

const initAdmin = () => {
  if (admin.apps.length > 0) return admin;
  const projectId = resolveProjectId();
  const clientEmail = toEnv("KYF_CLIENT_EMAIL");
  const privateKey = toEnv("KYF_PRIVATE_KEY");
  const storageBucket = resolveStorageBucket();
  const hasExplicitCreds = Boolean(projectId && clientEmail && privateKey);

  if (hasExplicitCreds) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
      ...(storageBucket ? { storageBucket } : {}),
    });
  } else {
    // Cloud Functions runtime credentials (ADC).
    admin.initializeApp({
      ...(storageBucket ? { storageBucket } : {}),
    });
  }
  return admin;
};

const normalizeFaculty = (payload, baseUrl = "") =>
  (payload?.data || []).map(({ attributes = {} }) => {
    const rawUrl = attributes.Photo?.data?.attributes?.url || null;
    const photoUrl =
      rawUrl && rawUrl.startsWith("/") ? `${baseUrl}${rawUrl}` : rawUrl;
    return {
      employeeId: Number(attributes.Employee_Id) || null,
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

const scrapeFaculty = async () => {
  const baseUrl = "https://cms.vitap.ac.in";
  const endpoint =
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

  const response = await axios.get(`${baseUrl}${endpoint}`, {
    headers: { Authorization: `Bearer ${toEnv("AUTH_TOKEN")}` },
    timeout: 30000,
  });
  return normalizeFaculty(response.data, baseUrl);
};

const listExistingEmployeeIds = async (db, collectionName) => {
  const snapshot = await db.collection(collectionName).select("employeeId").get();
  return new Set(
    snapshot.docs
      .map((doc) => doc.data()?.employeeId)
      .filter((value) => Number.isFinite(Number(value))),
  );
};

const uploadPhoto = async (storage, storageBucket, employeeId, photoUrl) => {
  if (!photoUrl) return null;
  if (!storageBucket) {
    console.error(`Failed to upload photo for employee ${employeeId}: storage bucket is not configured.`);
    return null;
  }
  try {
    const photoResponse = await fetch(photoUrl);
    if (!photoResponse.ok) return null;
    const buffer = Buffer.from(await photoResponse.arrayBuffer());
    const filename = `${employeeId}.jpg`;
    const file = storage.bucket(storageBucket).file(`faculty_photos/${filename}`);
    await file.save(buffer, {
      metadata: { contentType: "image/jpeg", cacheControl: "public, max-age=86400" },
    });
    return filename;
  } catch (uploadError) {
    console.error(`Failed to upload photo for employee ${employeeId} (url: ${photoUrl}): ${uploadError?.message}`);
    return null;
  }
};

export async function runWeeklyScrape(logger = console) {
  validateEnv();
  const adminSdk = initAdmin();
  const db = adminSdk.firestore();
  const collectionName = toEnv("KYF_FACULTY_COLLECTION") || "faculty";
  const firebaseOnlyTest =
    String(toEnv("KYF_TEST_FIREBASE_ONLY")).toLowerCase() === "true";
  const dryRun = String(toEnv("KYF_DRY_RUN")).toLowerCase() === "true";

  const existingIds = await listExistingEmployeeIds(db, collectionName);

  if (firebaseOnlyTest) {
    const probe = {
      mode: "firebase-only-test",
      collectionName,
      existingFacultyCount: existingIds.size,
      timestamp: new Date().toISOString(),
    };
    logger.log?.(`Firebase connectivity test completed: ${JSON.stringify(probe)}`);
    return probe;
  }

  const storage = adminSdk.storage();
  const storageBucket = resolveStorageBucket();
  const syncExistingPhotos =
    String(toEnv("SCRAPER_SYNC_EXISTING_PHOTOS")).toLowerCase() === "true";

  logger.log?.(`Scrape started${dryRun ? " (dry-run)" : ""}`);
  const scrapedFaculty = await scrapeFaculty();

  let added = 0;
  let wouldAdd = 0;
  let photosUploaded = 0;
  let updatedPhotos = 0;
  let wouldUpdatePhotos = 0;

  for (const faculty of scrapedFaculty) {
    const employeeId = Number(faculty.employeeId);
    if (!Number.isFinite(employeeId)) continue;

    if (existingIds.has(employeeId)) {
      if (!syncExistingPhotos || !faculty.photoUrl) continue;
      if (dryRun) {
        wouldUpdatePhotos += 1;
        continue;
      }
      const uploaded = await uploadPhoto(storage, storageBucket, employeeId, faculty.photoUrl);
      if (!uploaded) continue;
      const row = await db
        .collection(collectionName)
        .where("employeeId", "==", employeeId)
        .limit(1)
        .get();
      if (!row.empty) {
        await row.docs[0].ref.update({
          photoFileId: uploaded,
          updatedAt: adminSdk.firestore.Timestamp.now(),
        });
        updatedPhotos += 1;
        photosUploaded += 1;
      }
      continue;
    }

    if (dryRun) {
      wouldAdd += 1;
      existingIds.add(employeeId);
      continue;
    }

    let photoFileId = null;
    if (faculty.photoUrl) {
      photoFileId = await uploadPhoto(storage, storageBucket, employeeId, faculty.photoUrl);
      if (photoFileId) photosUploaded += 1;
    }

    await db.collection(collectionName).add({
      employeeId,
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
      createdAt: adminSdk.firestore.Timestamp.now(),
      updatedAt: adminSdk.firestore.Timestamp.now(),
    });

    added += 1;
    existingIds.add(employeeId);
  }

  const summary = {
    mode: dryRun ? "dry-run" : "live",
    scanned: scrapedFaculty.length,
    added,
    wouldAdd,
    photosUploaded,
    updatedPhotos,
    wouldUpdatePhotos,
  };
  logger.log?.(`Scrape completed: ${JSON.stringify(summary)}`);
  return summary;
}
