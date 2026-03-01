import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase/client.js";
import clientConfig from "../config/client.js";

class PollService {
  constructor() {
    this.pollCollection = clientConfig.firebasePollCollection || "polls";
    this.pollVotesCollection =
      clientConfig.firebasePollVotesCollection || "poll_votes";

    this.POLL_CACHE_TTL_MS = 5 * 60 * 1000;  // Increased from 30s to 5 min
    this.pollResultsCache = new Map();
    this.activePollsCache = null;
    this.activePollsCacheExpiry = 0;
    this.hasLoggedActivePollFallback = false;
    this.hasLoggedUserPollFallback = false;
  }

  toTimeMs(value) {
    if (!value) return 0;
    if (typeof value?.toDate === "function") {
      const date = value.toDate();
      return Number.isFinite(date?.getTime?.()) ? date.getTime() : 0;
    }
    const date = new Date(value);
    const time = date.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  sortByCreatedAtDesc(rows) {
    return [...rows].sort(
      (a, b) => this.toTimeMs(b?.createdAt) - this.toTimeMs(a?.createdAt),
    );
  }

  chunkArray(items, chunkSize = 30) {
    const safeChunkSize = Math.max(1, Number(chunkSize) || 30);
    const chunks = [];
    for (let i = 0; i < items.length; i += safeChunkSize) {
      chunks.push(items.slice(i, i + safeChunkSize));
    }
    return chunks;
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (facultyId) payload.facultyId = String(facultyId);
    if (courseId) payload.courseId = String(courseId);
    if (courseType) payload.courseType = String(courseType);
    if (pollStartTime) payload.pollStartTime = pollStartTime;

    try {
      const docRef = await addDoc(collection(db, this.pollCollection), payload);
      this.activePollsCache = null;
      this.activePollsCacheExpiry = 0;
      return { $id: docRef.id, ...payload };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all active polls
   */
  async getActivePolls() {
    if (this.activePollsCache && this.activePollsCacheExpiry > Date.now()) {
      return this.activePollsCache;
    }

    try {
      const q = query(
        collection(db, this.pollCollection),
        where("isActive", "==", true),
        limit(100),
      );
      const snapshot = await getDocs(q);
      const documents = this.sortByCreatedAtDesc(
        snapshot.docs.map((docSnapshot) => ({
          $id: docSnapshot.id,
          ...docSnapshot.data(),
        })),
      );
      this.activePollsCache = documents;
      this.activePollsCacheExpiry = Date.now() + this.POLL_CACHE_TTL_MS;
      return documents;
    } catch (error) {
      if (!this.hasLoggedActivePollFallback) {
        this.hasLoggedActivePollFallback = true;
      }
      try {
        const fallbackQuery = query(
          collection(db, this.pollCollection),
          limit(200),
        );
        const snapshot = await getDocs(fallbackQuery);
        const documents = snapshot.docs.map((docSnapshot) => ({
          $id: docSnapshot.id,
          ...docSnapshot.data(),
        }));
        const activeDocuments = this.sortByCreatedAtDesc(
          documents.filter((row) => row?.isActive !== false),
        ).slice(0, 100);
        this.activePollsCache = activeDocuments;
        this.activePollsCacheExpiry = Date.now() + this.POLL_CACHE_TTL_MS;
        return activeDocuments;
      } catch (fallbackError) {
        return [];
      }
    }
  }

  /**
   * Get polls by faculty
   */
  async getPollsByFaculty(facultyId) {
    try {
      const q = query(
        collection(db, this.pollCollection),
        where("facultyId", "==", String(facultyId)),
        limit(50),
      );
      const snapshot = await getDocs(q);
      return this.sortByCreatedAtDesc(
        snapshot.docs.map((docSnapshot) => ({
          $id: docSnapshot.id,
          ...docSnapshot.data(),
        })),
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Get polls created by a specific user
   */
  async getUserPolls(userId) {
    try {
      const q = query(
        collection(db, this.pollCollection),
        where("userId", "==", String(userId)),
        limit(100),
      );
      const snapshot = await getDocs(q);
      return this.sortByCreatedAtDesc(
        snapshot.docs.map((docSnapshot) => ({
          $id: docSnapshot.id,
          ...docSnapshot.data(),
        })),
      );
    } catch (error) {
      if (!this.hasLoggedUserPollFallback) {
        this.hasLoggedUserPollFallback = true;
      }
      try {
        const fallbackQuery = query(
          collection(db, this.pollCollection),
          where("userId", "==", String(userId)),
          limit(200),
        );
        const snapshot = await getDocs(fallbackQuery);
        const documents = snapshot.docs.map((docSnapshot) => ({
          $id: docSnapshot.id,
          ...docSnapshot.data(),
        }));
        return this.sortByCreatedAtDesc(documents).slice(0, 100);
      } catch (fallbackError) {
        return [];
      }
    }
  }

  /**
   * Get polls by course
   */
  async getPollsByCourse(courseId) {
    try {
      const q = query(
        collection(db, this.pollCollection),
        where("courseId", "==", String(courseId)),
        limit(50),
      );
      const snapshot = await getDocs(q);
      return this.sortByCreatedAtDesc(
        snapshot.docs.map((docSnapshot) => ({
          $id: docSnapshot.id,
          ...docSnapshot.data(),
        })),
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Get a single poll by ID
   */
  async getPollById(pollId) {
    try {
      const docSnapshot = await getDoc(
        doc(db, this.pollCollection, String(pollId))
      );
      if (!docSnapshot.exists()) return null;
      return {
        $id: docSnapshot.id,
        ...docSnapshot.data(),
      };
    } catch (error) {
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      if (existingVote?.$id) {
        // Update existing vote
        await updateDoc(
          doc(db, this.pollVotesCollection, existingVote.$id),
          payload
        );
        this.pollResultsCache.delete(String(pollId));
        return { $id: existingVote.$id, ...payload };
      }

      // Create new vote
      const docRef = await addDoc(
        collection(db, this.pollVotesCollection),
        payload
      );
      this.pollResultsCache.delete(String(pollId));
      return { $id: docRef.id, ...payload };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's vote for a specific poll
   */
  async getUserVote(userId, pollId) {
    try {
      const q = query(
        collection(db, this.pollVotesCollection),
        where("userId", "==", String(userId)),
        where("pollId", "==", String(pollId)),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const docSnapshot = snapshot.docs[0];
      return {
        $id: docSnapshot.id,
        ...docSnapshot.data(),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all votes for a poll with aggregated results
   */
  async getPollResults(pollId) {
    const id = String(pollId);
    const cached = this.pollResultsCache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      // OPTIMIZATION: Cap fetch to 1000 max instead of 5000 for vote aggregation
      const q = query(
        collection(db, this.pollVotesCollection),
        where("pollId", "==", id),
        limit(1000)
      );
      const snapshot = await getDocs(q);

      const votes = snapshot.docs.map((docSnapshot) => ({
        $id: docSnapshot.id,
        ...docSnapshot.data(),
      }));

      const voteCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      votes.forEach((vote) => {
        if (vote.vote >= 1 && vote.vote <= 5) {
          voteCounts[vote.vote]++;
        }
      });

      const result = {
        votes,
        voteCounts,
        totalVotes: votes.length,
      };

      this.pollResultsCache.set(id, {
        value: result,
        expiresAt: Date.now() + this.POLL_CACHE_TTL_MS,
      });
      return result;
    } catch (error) {
      return {
        votes: [],
        voteCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        totalVotes: 0,
      };
    }
  }

  async getPollResultsBulk(pollIds = []) {
    const ids = Array.from(
      new Set(
        (pollIds || [])
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ),
    );
    const resultMap = {};
    if (ids.length === 0) return resultMap;

    const uncachedIds = [];
    for (const id of ids) {
      const cached = this.pollResultsCache.get(id);
      if (cached && cached.expiresAt > Date.now()) {
        resultMap[id] = cached.value;
      } else {
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length === 0) return resultMap;

    for (const id of uncachedIds) {
      resultMap[id] = {
        votes: [],
        voteCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        totalVotes: 0,
      };
    }

    const chunks = this.chunkArray(uncachedIds, 30);
    for (const chunk of chunks) {
      // OPTIMIZATION: Cap fetch to 1000 instead of 5000 per batch
      const q = query(
        collection(db, this.pollVotesCollection),
        where("pollId", "in", chunk),
        limit(1000),
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((docSnapshot) => {
        const voteRow = {
          $id: docSnapshot.id,
          ...docSnapshot.data(),
        };
        const pollId = String(voteRow?.pollId || "").trim();
        if (!pollId || !resultMap[pollId]) return;

        resultMap[pollId].votes.push(voteRow);
        const voteValue = Number(voteRow?.vote);
        if (voteValue >= 1 && voteValue <= 5) {
          resultMap[pollId].voteCounts[voteValue] += 1;
        }
      });
    }

    for (const id of uncachedIds) {
      const row = resultMap[id];
      row.totalVotes = row.votes.length;
      this.pollResultsCache.set(id, {
        value: row,
        expiresAt: Date.now() + this.POLL_CACHE_TTL_MS,
      });
    }

    return resultMap;
  }

  async getUserVotesBulk(userId, pollIds = []) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) return {};

    const ids = Array.from(
      new Set(
        (pollIds || [])
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ),
    );
    const resultMap = {};
    for (const id of ids) {
      resultMap[id] = null;
    }
    if (ids.length === 0) return resultMap;

    const chunks = this.chunkArray(ids, 30);
    for (const chunk of chunks) {
      const q = query(
        collection(db, this.pollVotesCollection),
        where("userId", "==", normalizedUserId),
        where("pollId", "in", chunk),
        limit(5000),
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((docSnapshot) => {
        const voteRow = {
          $id: docSnapshot.id,
          ...docSnapshot.data(),
        };
        const pollId = String(voteRow?.pollId || "").trim();
        if (!pollId || !resultMap[pollId]) {
          resultMap[pollId] = voteRow;
          return;
        }

        const existing = resultMap[pollId];
        const existingTime = this.toTimeMs(
          existing?.updatedAt || existing?.createdAt,
        );
        const nextTime = this.toTimeMs(voteRow?.updatedAt || voteRow?.createdAt);
        if (nextTime >= existingTime) {
          resultMap[pollId] = voteRow;
        }
      });
    }

    return resultMap;
  }

  /**
   * Update poll status (activate/deactivate)
   */
  async updatePollStatus(pollId, isActive) {
    try {
      await updateDoc(doc(db, this.pollCollection, String(pollId)), {
        isActive: Boolean(isActive),
        updatedAt: new Date(),
      });
      this.activePollsCache = null;
      this.activePollsCacheExpiry = 0;
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update the active flag for a batch of polls in a single write.
   * This is significantly faster than issuing a separate network call for
   * each poll when many polls need to be toggled at once (such as during the
   * automatic deactivation process on the poll page).
   *
   * @param {string[]} pollIds array of poll document ids to update
   * @param {boolean} isActive new active state
   */
  async batchUpdatePollStatus(pollIds, isActive) {
    if (!Array.isArray(pollIds) || pollIds.length === 0) return;
    const batch = writeBatch(db);
    const timestamp = new Date();
    pollIds.forEach((id) => {
      const ref = doc(db, this.pollCollection, String(id));
      batch.update(ref, { isActive: Boolean(isActive), updatedAt: timestamp });
    });
    try {
      await batch.commit();
      this.activePollsCache = null;
      this.activePollsCacheExpiry = 0;
      return true;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Update poll details
   */
  async updatePoll(pollId, updates) {
    try {
      const allowedUpdates = { updatedAt: new Date() };

      // Only allow updating specific fields
      if (updates.pollEndTime !== undefined) {
        allowedUpdates.pollEndTime = updates.pollEndTime;
      }
      if (updates.pollStartTime !== undefined) {
        allowedUpdates.pollStartTime = updates.pollStartTime;
      }
      if (updates.isActive !== undefined) {
        allowedUpdates.isActive = Boolean(updates.isActive);
      }
      if (updates.courseType !== undefined) {
        allowedUpdates.courseType = String(updates.courseType);
      }

      await updateDoc(doc(db, this.pollCollection, String(pollId)), allowedUpdates);
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a poll (only by creator)
   */
  async deletePoll(pollId) {
    try {
      await deleteDoc(doc(db, this.pollCollection, String(pollId)));
      this.activePollsCache = null;
      this.activePollsCacheExpiry = 0;
      this.pollResultsCache.delete(String(pollId));
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a vote
   */
  async deleteVote(voteId) {
    try {
      await deleteDoc(doc(db, this.pollVotesCollection, String(voteId)));
      return true;
    } catch (error) {
      throw error;
    }
  }
}

export const pollService = new PollService();
export default pollService;
