import {
  Client,
  Databases,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
} from "appwrite";
import clientConfig from "../config/client.js";

const RATING_FIELDS = [
  "theoryTeaching",
  "theoryAttendance",
  "theoryClass",
  "theoryCorrection",
  "labClass",
  "labCorrection",
  "labAttendance",
  "ecsCapstoneSDPReview",
  "ecsCapstoneSDPCorrection",
];

const SECTION_FIELDS = {
  theory: [
    "theoryTeaching",
    "theoryAttendance",
    "theoryClass",
    "theoryCorrection",
  ],
  lab: ["labClass", "labCorrection", "labAttendance"],
  ecs: ["ecsCapstoneSDPReview", "ecsCapstoneSDPCorrection"],
};

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
    Permission.delete(Role.user(uid)),
  ];
}

class FacultyFeedbackService {
  client = new Client();
  databases;
  tablesDB;
  initialized = false;
  initError = null;

  constructor() {
    // Validate required configuration
    if (!clientConfig.appwriteUrl || !clientConfig.appwriteProjectId) {
      this.initError = `Missing Appwrite configuration. URL: ${!!clientConfig.appwriteUrl}, ProjectID: ${!!clientConfig.appwriteProjectId}`;
      console.error(
        "FacultyFeedbackService initialization failed:",
        this.initError,
      );
      return;
    }

    try {
      this.client
        .setEndpoint(clientConfig.appwriteUrl)
        .setProject(clientConfig.appwriteProjectId);

      this.databases = new Databases(this.client);
      this.tablesDB = new TablesDB(this.client);
      this.initialized = true;
    } catch (error) {
      this.initError = error?.message || "Failed to initialize Appwrite client";
      console.error("FacultyFeedbackService initialization error:", error);
    }
  }

  get feedbackTableId() {
    return clientConfig.appwriteReviewTableId;
  }

  async listRows(tableId, queries) {
    if (!this.initialized || !this.tablesDB) {
      throw new Error(this.initError || "Appwrite service not initialized");
    }
    try {
      return await this.tablesDB.listRows(
        clientConfig.appwriteDBId,
        tableId,
        queries,
      );
    } catch {
      if (!this.databases) {
        throw new Error(
          this.initError || "Appwrite databases service not initialized",
        );
      }
      const response = await this.databases.listDocuments(
        clientConfig.appwriteDBId,
        tableId,
        queries,
      );
      return {
        rows: response.documents || [],
        total: response.total || 0,
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
        permissions,
      );
    } catch {
      return this.databases.createDocument(
        clientConfig.appwriteDBId,
        tableId,
        ID.unique(),
        data,
        permissions,
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
        permissions,
      );
    } catch {
      return this.databases.updateDocument(
        clientConfig.appwriteDBId,
        tableId,
        rowId,
        data,
        permissions,
      );
    }
  }

  async getFacultyReviews(facultyId, limit = 20) {
    const response = await this.listRows(this.feedbackTableId, [
      Query.equal("facultyId", String(facultyId)),
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
    ]);
    return (response.rows || []).filter(
      (row) => String(row?.review || "").trim().length > 0,
    );
  }

  async getFacultyRatings(facultyId, limit = 200) {
    const response = await this.listRows(this.feedbackTableId, [
      Query.equal("facultyId", String(facultyId)),
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
    ]);
    return response.rows || [];
  }

  async getAllRatings(limit = 10000) {
    const response = await this.listRows(this.feedbackTableId, [
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
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

    // For notes calculation
    let theoryNotesCount = 0;
    let totalTheoryNotes = 0;
    const labNotesCounts = {
      Soft: 0,
      Hard: 0,
      Both: 0,
      None: 0,
    };
    let totalLabNotes = 0;

    for (const row of ratings || []) {
      for (const field of RATING_FIELDS) {
        const value = clampRating(row?.[field]);
        if (value === null) continue;
        totals[field] += value;
        counts[field] += 1;
      }

      // Count theory notes (majority-based: >= 50%)
      if (row.theoryNotes === true || row.theoryNotes === 1) {
        theoryNotesCount++;
      }
      totalTheoryNotes++;

      // Count lab notes
      if (row.labNotes && typeof row.labNotes === "string") {
        const noteType = row.labNotes.trim();
        if (labNotesCounts.hasOwnProperty(noteType)) {
          labNotesCounts[noteType]++;
        }
        totalLabNotes++;
      }
    }

    const averages = {};
    let weightedTotal = 0;
    let weightedCount = 0;

    for (const field of RATING_FIELDS) {
      const count = counts[field];
      averages[field] =
        count > 0 ? Number((totals[field] / count).toFixed(2)) : null;
      if (count > 0) {
        weightedTotal += totals[field];
        weightedCount += count;
      }
    }

    const sectionAverages = {};
    for (const [sectionKey, fields] of Object.entries(SECTION_FIELDS)) {
      let sectionTotal = 0;
      let sectionCount = 0;
      for (const field of fields) {
        sectionTotal += totals[field];
        sectionCount += counts[field];
      }
      sectionAverages[sectionKey] =
        sectionCount > 0
          ? Number((sectionTotal / sectionCount).toFixed(2))
          : null;
    }

    // Calculate notes summary with majority-based logic (>=50%)
    const notesSummary = {};

    // Theory notes: show if >= 50% voted yes
    if (totalTheoryNotes > 0) {
      const percentage = Math.round(
        (theoryNotesCount / totalTheoryNotes) * 100,
      );
      if (percentage >= 50) {
        notesSummary.theoryNotes = {
          count: theoryNotesCount,
          total: totalTheoryNotes,
          percentage,
        };
      }
    }

    // Lab notes: show each type that has >= 50% (excluding "None")
    if (totalLabNotes > 0) {
      const labNotesData = {};
      for (const [noteType, count] of Object.entries(labNotesCounts)) {
        if (noteType !== "None" && count > 0) {
          const percentage = Math.round((count / totalLabNotes) * 100);
          if (percentage >= 50) {
            labNotesData[noteType] = {
              count,
              total: totalLabNotes,
              percentage,
            };
          }
        }
      }
      if (Object.keys(labNotesData).length > 0) {
        notesSummary.labNotes = labNotesData;
      }
    }

    return {
      totalRatings: ratings?.length || 0,
      overallAverage:
        weightedCount > 0
          ? Number((weightedTotal / weightedCount).toFixed(2))
          : null,
      sectionAverages,
      averages,
      notesSummary: Object.keys(notesSummary).length > 0 ? notesSummary : null,
    };
  }

  async getFacultyFeedback(facultyId) {
    const [reviews, ratings] = await Promise.all([
      this.getFacultyReviews(facultyId),
      this.getFacultyRatings(facultyId),
    ]);

    return {
      reviews,
      ratings,
      ratingSummary: this.buildRatingSummary(ratings),
    };
  }

  async getUserFacultyFeedback(userId, facultyId) {
    const response = await this.listRows(this.feedbackTableId, [
      Query.equal("userId", String(userId)),
      Query.equal("facultyId", String(facultyId)),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
    return response.rows?.[0] || null;
  }

  async getUserFeedbackEntries(userId, limit = 200) {
    if (!String(userId || "").trim()) return [];
    const response = await this.listRows(this.feedbackTableId, [
      Query.equal("userId", String(userId)),
      Query.orderDesc("$updatedAt"),
      Query.limit(limit),
    ]);
    return response.rows || [];
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
    ecsCapstoneSDPReview,
    ecsCapstoneSDPCorrection,
    labNotes = "None",
  }) {
    if (!String(userId || "").trim()) {
      throw new Error("You must be logged in to submit feedback.");
    }

    const allowedLabNotes = new Set(["Soft", "Hard", "Both", "None"]);
    const normalizedLabNotes = String(labNotes || "None");
    const payload = {
      userId: String(userId),
      facultyId: String(facultyId),
    };

    if (courseId) payload.courseId = String(courseId).trim();
    if (typeof review === "string") payload.review = review.trim();
    if (Boolean(theoryNotes)) payload.theoryNotes = true;
    if (
      allowedLabNotes.has(normalizedLabNotes) &&
      normalizedLabNotes !== "None"
    ) {
      payload.labNotes = normalizedLabNotes;
    }

    for (const [field, rawValue] of Object.entries({
      theoryTeaching,
      theoryAttendance,
      theoryClass,
      theoryCorrection,
      labClass,
      labCorrection,
      labAttendance,
      ecsCapstoneSDPReview,
      ecsCapstoneSDPCorrection,
    })) {
      const value = clampRating(rawValue);
      if (value !== null) payload[field] = value;
    }

    const existing = await this.getUserFacultyFeedback(userId, facultyId);
    const permissions = getRowPermissions(userId);
    if (existing?.$id) {
      return this.updateRow(
        this.feedbackTableId,
        existing.$id,
        payload,
        permissions,
      );
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
    ecsCapstoneSDPReview,
    ecsCapstoneSDPCorrection,
    labNotes = "None",
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
      ecsCapstoneSDPReview,
      ecsCapstoneSDPCorrection,
      labNotes,
    });
  }

  async submitReview({
    userId,
    facultyId,
    courseId,
    review,
    theoryNotes = false,
  }) {
    return this.submitFeedback({
      userId,
      facultyId,
      courseId,
      review,
      theoryNotes,
    });
  }

  async deleteUserFacultyFeedback(userId, facultyId) {
    if (!String(userId || "").trim()) {
      throw new Error("You must be logged in to delete feedback.");
    }
    const existing = await this.getUserFacultyFeedback(userId, facultyId);
    if (!existing?.$id) return null;
    try {
      return await this.tablesDB.deleteRow(
        clientConfig.appwriteDBId,
        this.feedbackTableId,
        existing.$id,
      );
    } catch {
      return this.databases.deleteDocument(
        clientConfig.appwriteDBId,
        this.feedbackTableId,
        existing.$id,
      );
    }
  }

  async deleteFeedbackById(rowId) {
    if (!String(rowId || "").trim()) return null;
    try {
      return await this.tablesDB.deleteRow(
        clientConfig.appwriteDBId,
        this.feedbackTableId,
        rowId,
      );
    } catch {
      return this.databases.deleteDocument(
        clientConfig.appwriteDBId,
        this.feedbackTableId,
        rowId,
      );
    }
  }

  async deleteAllUserFeedback(userId) {
    const rows = await this.getUserFeedbackEntries(userId, 5000);
    if (!rows.length) return 0;
    await Promise.all(rows.map((row) => this.deleteFeedbackById(row.$id)));
    return rows.length;
  }
}

const facultyFeedbackService = new FacultyFeedbackService();
export default facultyFeedbackService;
