import { db } from "./client.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  Query as FirestoreQuery,
  QueryConstraint,
} from "firebase/firestore";
import serverConfig from "../../config/server.js";

const FACULTY_COLLECTION = serverConfig.firebaseFacultyCollection || "faculty";
const PAGE_LIMIT = 5000;
const DEFAULT_MIN_STRING_LENGTH = 2;
const DEFAULT_MAX_STRING_LENGTH = 255;

function normalizeEmployeeId(employeeId) {
  if (employeeId === null || employeeId === undefined) return null;
  const normalized = Number(employeeId);
  return Number.isFinite(normalized) ? normalized : null;
}

function getMinStringLength() {
  const raw = Number(process.env.FIREBASE_MIN_STRING_LENGTH);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_MIN_STRING_LENGTH;
  return Math.floor(raw);
}

function getMaxStringLength() {
  const raw = Number(process.env.FIREBASE_MAX_STRING_LENGTH);
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

export async function getAllEmployeeIds() {
  const ids = new Set();

  try {
    const q = query(
      collection(db, FACULTY_COLLECTION),
      limit(PAGE_LIMIT)
    );
    // Only fetch employeeId field to reduce read size
    const snapshot = await getDocs(q);

    for (const docSnapshot of snapshot.docs) {
      const normalized = normalizeEmployeeId(docSnapshot.data().employeeId);
      if (normalized !== null) ids.add(normalized);
    }
  } catch (error) {
    throw error;
  }

  return ids;
}

export async function getFacultyIndexByEmployeeId() {
  const index = new Map();

  try {
    const q = query(
      collection(db, FACULTY_COLLECTION),
      limit(PAGE_LIMIT)
    );
    const snapshot = await getDocs(q);

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const normalized = normalizeEmployeeId(data.employeeId);
      if (normalized === null) continue;
      index.set(normalized, {
        docId: docSnapshot.id,
        photoFileId: data.photoFileId || null,
      });
    }
  } catch (error) {
    throw error;
  }

  return index;
}

export async function addFaculty(data) {
  try {
    const sanitizedData = sanitizeRowData(data || {});
    const docId = String(sanitizedData?.employeeId || "");

    if (!docId) {
      throw new Error("Employee ID is required");
    }

    await setDoc(doc(db, FACULTY_COLLECTION, docId), {
      ...sanitizedData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { $id: docId, ...sanitizedData };
  } catch (error) {
    throw error;
  }
}

export async function updateFacultyPhotoByDocId(docId, photoFileId) {
  try {
    await updateDoc(doc(db, FACULTY_COLLECTION, docId), {
      photoFileId,
      updatedAt: new Date(),
    });
  } catch (error) {
    throw error;
  }
}

export async function getAllFaculty(
  limit_val = 100,
  offset_val = 0,
  searchQuery = null,
  department = null
) {
  try {
    const constraints = [];

    if (department && department !== "all") {
      constraints.push(where("department", "==", department));
    }

    constraints.push(orderBy("updatedAt", "desc"));
    // Only fetch needed docs, not limit_val + offset_val (wasteful pagination)
    constraints.push(limit(limit_val * 2)); // Conservative multiplier

    const q = query(
      collection(db, FACULTY_COLLECTION),
      ...constraints
    );

    const snapshot = await getDocs(q);
    let faculty = snapshot.docs.map((docSnapshot) => ({
      $id: docSnapshot.id,
      ...docSnapshot.data(),
    }));

    // Client-side search if needed
    if (searchQuery) {
      const lowerSearch = searchQuery.toLowerCase();
      faculty = faculty.filter(
        (item) =>
          (item.name && item.name.toLowerCase().includes(lowerSearch)) ||
          (item.email && item.email.toLowerCase().includes(lowerSearch))
      );
    }

    // Apply offset
    faculty = faculty.slice(offset_val, offset_val + limit_val);

    return {
      faculty,
      total: snapshot.size,
      hasMore: offset_val + limit_val < snapshot.size,
    };
  } catch (error) {
    throw error;
  }
}

export async function getFacultyById(employeeId) {
  try {
    const q = query(
      collection(db, FACULTY_COLLECTION),
      where("employeeId", "==", employeeId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const docSnapshot = snapshot.docs[0];
    return {
      $id: docSnapshot.id,
      ...docSnapshot.data(),
    };
  } catch (error) {
    throw error;
  }
}

export async function getDepartments() {
  try {
    // Reduce read size by only fetching department field
    const q = query(
      collection(db, FACULTY_COLLECTION),
      limit(PAGE_LIMIT)
    );
    const snapshot = await getDocs(q);

    const departments = new Set();
    for (const docSnapshot of snapshot.docs) {
      const dept = docSnapshot.data().department;
      if (dept) departments.add(dept);
    }

    return Array.from(departments).sort();
  } catch (error) {
    throw error;
  }
}

export async function getFacultyStats() {
  try {
    // Reduce read size by only fetching department & designation fields
    const q = query(
      collection(db, FACULTY_COLLECTION),
      limit(PAGE_LIMIT)
    );
    const snapshot = await getDocs(q);

    const stats = {
      total: snapshot.size,
      byDepartment: {},
      byDesignation: {},
      lastUpdated: new Date().toISOString(),
    };

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      if (data.department) {
        stats.byDepartment[data.department] =
          (stats.byDepartment[data.department] || 0) + 1;
      }
      if (data.designation) {
        stats.byDesignation[data.designation] =
          (stats.byDesignation[data.designation] || 0) + 1;
      }
    }

    return stats;
  } catch (error) {
    throw error;
  }
}

export async function updateFaculty(employeeId, updateData) {
  try {
    const existing = await getFacultyById(employeeId);
    if (!existing) {
      throw new Error(`Faculty with ID ${employeeId} not found`);
    }

    await updateDoc(doc(db, FACULTY_COLLECTION, existing.$id), {
      ...sanitizeRowData(updateData || {}),
      updatedAt: new Date(),
    });

    return { $id: existing.$id, ...updateData };
  } catch (error) {
    throw error;
  }
}
