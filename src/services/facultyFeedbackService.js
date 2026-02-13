import { Client, Databases, ID, Permission, Query, Role, TablesDB } from "appwrite";
import clientConfig from "../config/client.js";

const RATING_FIELDS = [
  "theoryTeaching",
  "theoryAttendance",
  "theoryClass",
  "theoryCorrection",
  "labClass",
  "labCorrection",
  "labAttendance"
];

function clampRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 5) return null;
  return Math.round(n);
}

function getRowPermissions(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return [Permission.read(Role.any())];
  return [
    Permission.read(Role.any()),
    Permission.update(Role.user(uid)),
    Permission.delete(Role.user(uid))
  ];
}

class FacultyFeedbackService {
  client = new Client();
  databases;
  tablesDB;

  constructor() {
    this.client
      .setEndpoint(clientConfig.appwriteUrl)
      .setProject(clientConfig.appwriteProjectId);

    this.databases = new Databases(this.client);
    this.tablesDB = new TablesDB(this.client);
  }

  get feedbackTableId() {
    return clientConfig.appwriteReviewTableId;
  }

  async listRows(tableId, queries) {
    try {
      return await this.tablesDB.listRows(clientConfig.appwriteDBId, tableId, queries);
    } catch {
      const response = await this.databases.listDocuments(clientConfig.appwriteDBId, tableId, queries);
      return {
        rows: response.documents || [],
        total: response.total || 0
      };
    }
  }

  async createRow(tableId, data, permissions = undefined) {
    try {
      return await this.tablesDB.createRow(
        clientConfig.appwriteDBId,
        tableId,
        ID.unique(),
        data,
        permissions
      );
    } catch {
      return this.databases.createDocument(
        clientConfig.appwriteDBId,
        tableId,
        ID.unique(),
        data,
        permissions
      );
    }
  }

  async updateRow(tableId, rowId, data, permissions = undefined) {
    try {
      return await this.tablesDB.updateRow(
        clientConfig.appwriteDBId,
        tableId,
        rowId,
        data,
        permissions
      );
    } catch {
      return this.databases.updateDocument(
        clientConfig.appwriteDBId,
        tableId,
        rowId,
        data,
        permissions
      );
    }
  }

  async getFacultyReviews(facultyId, limit = 20) {
    const response = await this.listRows(this.feedbackTableId, [
      Query.equal("facultyId", String(facultyId)),
      Query.orderDesc("$createdAt"),
      Query.limit(limit)
    ]);
    return (response.rows || []).filter((row) => String(row?.review || "").trim().length > 0);
  }

  async getFacultyRatings(facultyId, limit = 200) {
    const response = await this.listRows(this.feedbackTableId, [
      Query.equal("facultyId", String(facultyId)),
      Query.orderDesc("$createdAt"),
      Query.limit(limit)
    ]);
    return response.rows || [];
  }

  buildRatingSummary(ratings) {
    const totals = {};
    const counts = {};

    for (const field of RATING_FIELDS) {
      totals[field] = 0;
      counts[field] = 0;
    }

    for (const row of ratings || []) {
      for (const field of RATING_FIELDS) {
        const value = clampRating(row?.[field]);
        if (value === null) continue;
        totals[field] += value;
        counts[field] += 1;
      }
    }

    const averages = {};
    let weightedTotal = 0;
    let weightedCount = 0;

    for (const field of RATING_FIELDS) {
      const count = counts[field];
      averages[field] = count > 0 ? Number((totals[field] / count).toFixed(2)) : null;
      if (count > 0) {
        weightedTotal += totals[field];
        weightedCount += count;
      }
    }

    return {
      totalRatings: ratings?.length || 0,
      overallAverage: weightedCount > 0 ? Number((weightedTotal / weightedCount).toFixed(2)) : null,
      averages
    };
  }

  async getFacultyFeedback(facultyId) {
    const [reviews, ratings] = await Promise.all([
      this.getFacultyReviews(facultyId),
      this.getFacultyRatings(facultyId)
    ]);

    return {
      reviews,
      ratings,
      ratingSummary: this.buildRatingSummary(ratings)
    };
  }

  async getUserFacultyFeedback(userId, facultyId) {
    const response = await this.listRows(this.feedbackTableId, [
      Query.equal("userId", String(userId)),
      Query.equal("facultyId", String(facultyId)),
      Query.orderDesc("$createdAt"),
      Query.limit(1)
    ]);
    return response.rows?.[0] || null;
  }

  async submitFeedback({
    userId,
    facultyId,
    courseId,
    review,
    theoryNotes = false,
    theoryTeaching,
    theoryAttendance,
    theoryClass,
    theoryCorrection,
    labClass,
    labCorrection,
    labAttendance,
    labNotes = "None"
  }) {
    if (!String(userId || "").trim()) {
      throw new Error("You must be logged in to submit feedback.");
    }

    const allowedLabNotes = new Set(["Soft", "Hard", "Both", "None"]);
    const normalizedLabNotes = String(labNotes || "None");
    const payload = {
      userId: String(userId),
      facultyId: String(facultyId),
      theoryNotes: Boolean(theoryNotes),
      labNotes: allowedLabNotes.has(normalizedLabNotes) ? normalizedLabNotes : "None"
    };

    if (courseId) payload.courseId = String(courseId).trim();
    if (typeof review === "string") payload.review = review.trim();

    for (const [field, rawValue] of Object.entries({
      theoryTeaching,
      theoryAttendance,
      theoryClass,
      theoryCorrection,
      labClass,
      labCorrection,
      labAttendance
    })) {
      const value = clampRating(rawValue);
      if (value !== null) payload[field] = value;
    }

    const existing = await this.getUserFacultyFeedback(userId, facultyId);
    const permissions = getRowPermissions(userId);
    if (existing?.$id) {
      return this.updateRow(this.feedbackTableId, existing.$id, payload, permissions);
    }
    return this.createRow(this.feedbackTableId, payload, permissions);
  }

  async submitRating({
    userId,
    facultyId,
    courseId,
    theoryTeaching,
    theoryAttendance,
    theoryClass,
    theoryCorrection,
    labClass,
    labCorrection,
    labAttendance,
    labNotes = "None"
  }) {
    return this.submitFeedback({
      userId,
      facultyId,
      courseId,
      theoryTeaching,
      theoryAttendance,
      theoryClass,
      theoryCorrection,
      labClass,
      labCorrection,
      labAttendance,
      labNotes
    });
  }

  async submitReview({ userId, facultyId, courseId, review, theoryNotes = false }) {
    return this.submitFeedback({
      userId,
      facultyId,
      courseId,
      review,
      theoryNotes
    });
  }

  async deleteUserFacultyFeedback(userId, facultyId) {
    if (!String(userId || "").trim()) {
      throw new Error("You must be logged in to delete feedback.");
    }
    const existing = await this.getUserFacultyFeedback(userId, facultyId);
    if (!existing?.$id) return null;
    try {
      return await this.tablesDB.deleteRow(clientConfig.appwriteDBId, this.feedbackTableId, existing.$id);
    } catch {
      return this.databases.deleteDocument(clientConfig.appwriteDBId, this.feedbackTableId, existing.$id);
    }
  }
}

const facultyFeedbackService = new FacultyFeedbackService();
export default facultyFeedbackService;
