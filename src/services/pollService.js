import { Client, Databases, ID, Permission, Query, Role } from "appwrite";
import clientConfig from "../config/client.js";

function getRowPermissions(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return [Permission.read(Role.any())];
  return [
    Permission.read(Role.any()),
    Permission.update(Role.user(uid)),
    Permission.delete(Role.user(uid)),
  ];
}

class PollService {
  constructor() {
    this.client = new Client()
      .setEndpoint(clientConfig.appwriteUrl)
      .setProject(clientConfig.appwriteProjectId);

    this.databases = new Databases(this.client);
    this.databaseId = clientConfig.appwriteDBId;
    this.pollTableId = import.meta.env.VITE_APPWRITE_POLL_TABLE_ID || "poll";
    this.pollVotesTableId =
      import.meta.env.VITE_APPWRITE_POLL_VOTES_TABLE_ID || "poll_votes";
  }

  /**
   * Create a new poll
   */
  async createPoll({
    userId,
    facultyId,
    courseId,
    courseType,
    pollType,
    pollStartTime,
    pollEndTime,
  }) {
    if (!String(userId || "").trim()) {
      throw new Error("You must be logged in to create a poll.");
    }

    if (!facultyId) {
      throw new Error("Faculty ID is required for creating a poll.");
    }

    const pollTypeNum = Number(pollType);
    if (![3, 5].includes(pollTypeNum) || !Number.isFinite(pollTypeNum)) {
      throw new Error("Poll type must be either 3 or 5.");
    }

    const payload = {
      userId: String(userId),
      pollType: String(pollTypeNum),
      pollEndTime: pollEndTime,
      isActive: true,
    };

    if (facultyId) payload.facultyId = String(facultyId);
    if (courseId) payload.courseId = String(courseId);
    if (courseType) payload.courseType = String(courseType);
    if (pollStartTime) payload.pollStartTime = pollStartTime;

    const permissions = getRowPermissions(userId);

    return await this.databases.createDocument(
      this.databaseId,
      this.pollTableId,
      ID.unique(),
      payload,
      permissions,
    );
  }

  /**
   * Get all active polls
   */
  async getActivePolls() {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.pollTableId,
        [
          Query.equal("isActive", true),
          Query.orderDesc("$createdAt"),
          Query.limit(100),
        ],
      );
      return response.documents;
    } catch (error) {
      console.error("Error fetching active polls:", error);
      return [];
    }
  }

  /**
   * Get polls by faculty
   */
  async getPollsByFaculty(facultyId) {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.pollTableId,
        [
          Query.equal("facultyId", String(facultyId)),
          Query.orderDesc("$createdAt"),
          Query.limit(50),
        ],
      );
      return response.documents;
    } catch (error) {
      console.error("Error fetching faculty polls:", error);
      return [];
    }
  }

  /**
   * Get polls by course
   */
  async getPollsByCourse(courseId) {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.pollTableId,
        [
          Query.equal("courseId", String(courseId)),
          Query.orderDesc("$createdAt"),
          Query.limit(50),
        ],
      );
      return response.documents;
    } catch (error) {
      console.error("Error fetching course polls:", error);
      return [];
    }
  }

  /**
   * Get a single poll by ID
   */
  async getPollById(pollId) {
    try {
      return await this.databases.getDocument(
        this.databaseId,
        this.pollTableId,
        String(pollId),
      );
    } catch (error) {
      console.error("Error fetching poll:", error);
      return null;
    }
  }

  /**
   * Submit a vote for a poll
   */
  async submitVote({ userId, pollId, vote }) {
    if (!String(userId || "").trim()) {
      throw new Error("You must be logged in to vote.");
    }

    if (!String(pollId || "").trim()) {
      throw new Error("Poll ID is required.");
    }

    const voteValue = Number(vote);
    if (!Number.isFinite(voteValue) || voteValue < 1 || voteValue > 5) {
      throw new Error("Vote must be between 1 and 5.");
    }

    // Check if user has already voted
    const existingVote = await this.getUserVote(userId, pollId);

    const payload = {
      userId: String(userId),
      pollId: String(pollId),
      vote: voteValue,
    };

    const permissions = getRowPermissions(userId);

    if (existingVote?.$id) {
      // Update existing vote
      return await this.databases.updateDocument(
        this.databaseId,
        this.pollVotesTableId,
        existingVote.$id,
        payload,
        permissions,
      );
    } else {
      // Create new vote
      return await this.databases.createDocument(
        this.databaseId,
        this.pollVotesTableId,
        ID.unique(),
        payload,
        permissions,
      );
    }
  }

  /**
   * Get user's vote for a specific poll
   */
  async getUserVote(userId, pollId) {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.pollVotesTableId,
        [
          Query.equal("userId", String(userId)),
          Query.equal("pollId", String(pollId)),
          Query.limit(1),
        ],
      );
      return response.documents[0] || null;
    } catch (error) {
      console.error("Error fetching user vote:", error);
      return null;
    }
  }

  /**
   * Get all votes for a poll with aggregated results
   */
  async getPollResults(pollId) {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.pollVotesTableId,
        [Query.equal("pollId", String(pollId)), Query.limit(5000)],
      );

      const votes = response.documents;
      const voteCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      votes.forEach((vote) => {
        if (vote.vote >= 1 && vote.vote <= 5) {
          voteCounts[vote.vote]++;
        }
      });

      return {
        votes,
        voteCounts,
        totalVotes: votes.length,
      };
    } catch (error) {
      console.error("Error fetching poll results:", error);
      return {
        votes: [],
        voteCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        totalVotes: 0,
      };
    }
  }

  /**
   * Update poll status (activate/deactivate)
   */
  async updatePollStatus(pollId, isActive) {
    try {
      return await this.databases.updateDocument(
        this.databaseId,
        this.pollTableId,
        String(pollId),
        { isActive: Boolean(isActive) },
      );
    } catch (error) {
      console.error("Error updating poll status:", error);
      throw error;
    }
  }

  /**
   * Delete a poll (only by creator)
   */
  async deletePoll(pollId) {
    try {
      await this.databases.deleteDocument(
        this.databaseId,
        this.pollTableId,
        String(pollId),
      );
      return true;
    } catch (error) {
      console.error("Error deleting poll:", error);
      throw error;
    }
  }

  /**
   * Delete a vote
   */
  async deleteVote(voteId) {
    try {
      await this.databases.deleteDocument(
        this.databaseId,
        this.pollVotesTableId,
        String(voteId),
      );
      return true;
    } catch (error) {
      console.error("Error deleting vote:", error);
      throw error;
    }
  }
}

export const pollService = new PollService();
export default pollService;
