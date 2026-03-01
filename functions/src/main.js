import axios from "axios";
import admin from "firebase-admin";

const REQUIRED_ENV_KEYS = [
  "KYF_PROJECT_ID",
  "KYF_CLIENT_EMAIL",
  "KYF_PRIVATE_KEY",
  "KYF_STORAGE_BUCKET",
  "KYF_FACULTY_COLLECTION",
  "AUTH_TOKEN",
];

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
  };

  const keys = aliases[key] || [key];
  for (const envKey of keys) {
    const value = String(process.env[envKey] || "").trim();
    if (value) return value;
  }
  return "";
};

const validateEnv = () => {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !toEnv(key));
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
};

const initAdmin = () => {
  if (admin.apps.length > 0) return admin;
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: toEnv("KYF_PROJECT_ID"),
      clientEmail: toEnv("KYF_CLIENT_EMAIL"),
      privateKey: toEnv("KYF_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
    storageBucket: toEnv("KYF_STORAGE_BUCKET"),
  });
  return admin;
};

const normalizeFaculty = (payload) =>
  (payload?.data || []).map(({ attributes = {} }) => ({
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
    photoUrl: attributes.Photo?.data?.attributes?.url || null,
  }));

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
  return normalizeFaculty(response.data);
};

const listExistingEmployeeIds = async (db, collectionName) => {
  const snapshot = await db.collection(collectionName).select("employeeId").get();
  return new Set(
    snapshot.docs
      .map((doc) => doc.data()?.employeeId)
      .filter((value) => Number.isFinite(Number(value))),
  );
};

const uploadPhoto = async (storage, employeeId, photoUrl) => {
  if (!photoUrl) return null;
  const photoResponse = await fetch(photoUrl);
  if (!photoResponse.ok) return null;
  const buffer = Buffer.from(await photoResponse.arrayBuffer());
  const filename = `${employeeId}.jpg`;
  const file = storage.bucket().file(`faculty_photos/${filename}`);
  await file.save(buffer, {
    metadata: { contentType: "image/jpeg", cacheControl: "public, max-age=86400" },
  });
  return filename;
};

export async function runWeeklyScrape(logger = console) {
  validateEnv();
  const adminSdk = initAdmin();
  const db = adminSdk.firestore();
  const storage = adminSdk.storage();
  const collectionName = toEnv("KYF_FACULTY_COLLECTION") || "faculty";
  const syncExistingPhotos =
    String(toEnv("SCRAPER_SYNC_EXISTING_PHOTOS")).toLowerCase() === "true";

  logger.log?.("Scrape started");
  const scrapedFaculty = await scrapeFaculty();
  const existingIds = await listExistingEmployeeIds(db, collectionName);

  let added = 0;
  let photosUploaded = 0;
  let updatedPhotos = 0;

  for (const faculty of scrapedFaculty) {
    const employeeId = Number(faculty.employeeId);
    if (!Number.isFinite(employeeId)) continue;

    if (existingIds.has(employeeId)) {
      if (!syncExistingPhotos || !faculty.photoUrl) continue;
      const uploaded = await uploadPhoto(storage, employeeId, faculty.photoUrl);
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

    let photoFileId = null;
    if (faculty.photoUrl) {
      photoFileId = await uploadPhoto(storage, employeeId, faculty.photoUrl);
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
    scanned: scrapedFaculty.length,
    added,
    photosUploaded,
    updatedPhotos,
  };
  logger.log?.(`Scrape completed: ${JSON.stringify(summary)}`);
  return summary;
}
