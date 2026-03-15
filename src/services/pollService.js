import clientConfig from "../config/client.js";
import { supabase } from "../lib/supabase/client.js";
import {
  applyInChunks,
  normalizeRow,
  normalizeRows,
  throwIfSupabaseError,
} from "../lib/supabase/helpers.js";

const POLL_COLUMNS = [
  "id",
  "userId",
  "facultyId",
  "courseId",
  "courseType",
  "pollType",
  "pollStartTime",
  "pollEndTime",
  "isActive",
  "createdAt",
  "updatedAt",
].join(", ");

const POLL_VOTE_COLUMNS = [
  "id",
  "userId",
  "pollId",
  "vote",
  "createdAt",
  "updatedAt",
].join(", ");

class PollService {
  constructor() {
    this.pollCollection = clientConfig.supabasePollTable || "polls";
    this.pollVotesCollection =
      clientConfig.supabasePollVotesTable || "poll_votes";
    this.POLL_CACHE_TTL_MS = 5 * 60 * 1000;
    this.pollResultsCache = new Map();
    this.pollQueryCache = new Map();
    this.inflightRequests = new Map();
    this.activePollsCache = null;
    this.activePollsCacheExpiry = 0;
    this.PERSISTENT_CACHE_PREFIX = "kyf.polls.v1";
    this.PERSISTENT_CACHE_TTL_MS = 30 * 60 * 1000;
    this.hydratePersistentCaches();
  }

  getStorage() {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage || null;
    } catch {
      return null;
    }
  }

  getPersistentKey(suffix) {
    return `${this.PERSISTENT_CACHE_PREFIX}:${suffix}`;
  }

  readPersistentCache(suffix) {
    const storage = this.getStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(this.getPersistentKey(suffix));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.expiresAt <= Date.now()) {
        storage.removeItem(this.getPersistentKey(suffix));
        return null;
      }
      return parsed.value;
    } catch {
      return null;
    }
  }

  writePersistentCache(suffix, value, ttlMs = this.PERSISTENT_CACHE_TTL_MS) {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(
        this.getPersistentKey(suffix),
        JSON.stringify({
          value,
          expiresAt: Date.now() + ttlMs,
        }),
      );
    } catch {
    }
  }

  clearPersistentCache(prefixes = []) {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (!key) continue;
        if (prefixes.some((prefix) => key === this.getPersistentKey(prefix) || key.startsWith(this.getPersistentKey(prefix)))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => storage.removeItem(key));
    } catch {
    }
  }

  hydratePersistentCaches() {
    const activePolls = this.readPersistentCache("activePolls");
    if (Array.isArray(activePolls)) {
      this.activePollsCache = activePolls;
      this.activePollsCacheExpiry = Date.now() + this.POLL_CACHE_TTL_MS;
    }
  }

  getCachedValue(cacheKey) {
    const cached = this.pollQueryCache.get(cacheKey);
    if (!cached) return undefined;
    if (cached.expiresAt > Date.now()) return cached.value;
    this.pollQueryCache.delete(cacheKey);
    return undefined;
  }

  setCachedValue(cacheKey, value, ttlMs = this.POLL_CACHE_TTL_MS) {
    this.pollQueryCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async getOrCreateInflight(cacheKey, loader) {
    if (this.inflightRequests.has(cacheKey)) {
      return this.inflightRequests.get(cacheKey);
    }
    const promise = (async () => {
      try {
        return await loader();
      } finally {
        this.inflightRequests.delete(cacheKey);
      }
    })();
    this.inflightRequests.set(cacheKey, promise);
    return promise;
  }

  invalidatePollQueryCache() {
    this.pollQueryCache.clear();
    this.inflightRequests.clear();
    this.activePollsCache = null;
    this.activePollsCacheExpiry = 0;
    this.clearPersistentCache(["activePolls", "pollResults_"]);
  }

  toTimeMs(value) {
    if (!value) return 0;
    const date = new Date(value);
    const time = date.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  sortByCreatedAtDesc(rows) {
    return [...rows].sort(
      (a, b) => this.toTimeMs(b?.createdAt) - this.toTimeMs(a?.createdAt),
    );
  }

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

    const timestamp = new Date().toISOString();
    const payload = {
      userId: String(userId),
      pollType: String(pollTypeNum),
      pollEndTime,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      facultyId: String(facultyId),
    };

    if (courseId) payload.courseId = String(courseId);
    if (courseType) payload.courseType = String(courseType);
    if (pollStartTime) payload.pollStartTime = pollStartTime;

    const { data, error } = await supabase
      .from(this.pollCollection)
      .insert(payload)
      .select("*")
      .single();
    throwIfSupabaseError(error, "Failed to create poll.");
    this.invalidatePollQueryCache();
    return normalizeRow(data);
  }

  async getActivePolls() {
    if (this.activePollsCache && this.activePollsCacheExpiry > Date.now()) {
      return this.activePollsCache;
    }

    return this.getOrCreateInflight("activePolls", async () => {
      const { data, error } = await supabase
        .from(this.pollCollection)
        .select(POLL_COLUMNS)
        .eq("isActive", true)
        .order("createdAt", { ascending: false })
        .limit(100);
      throwIfSupabaseError(error, "Failed to load active polls.");
      const rows = normalizeRows(data || []);
      this.activePollsCache = rows;
      this.activePollsCacheExpiry = Date.now() + this.POLL_CACHE_TTL_MS;
      this.writePersistentCache("activePolls", rows, this.PERSISTENT_CACHE_TTL_MS);
      return rows;
    });
  }

  async getPollsByFaculty(facultyId) {
    const normalizedFacultyId = String(facultyId || "").trim();
    if (!normalizedFacultyId) return [];
    const cacheKey = `pollsByFaculty_${normalizedFacultyId}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== undefined) return cached;
    return this.getOrCreateInflight(cacheKey, async () => {
      const { data, error } = await supabase
        .from(this.pollCollection)
        .select(POLL_COLUMNS)
        .eq("facultyId", normalizedFacultyId)
        .order("createdAt", { ascending: false })
        .limit(50);
      throwIfSupabaseError(error, "Failed to load polls.");
      const rows = normalizeRows(data || []);
      this.setCachedValue(cacheKey, rows);
      return rows;
    });
  }

  async getUserPolls(userId) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) return [];
    const cacheKey = `userPolls_${normalizedUserId}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== undefined) return cached;
    return this.getOrCreateInflight(cacheKey, async () => {
      const { data, error } = await supabase
        .from(this.pollCollection)
        .select(POLL_COLUMNS)
        .eq("userId", normalizedUserId)
        .order("createdAt", { ascending: false })
        .limit(100);
      throwIfSupabaseError(error, "Failed to load user polls.");
      const rows = normalizeRows(data || []);
      this.setCachedValue(cacheKey, rows);
      return rows;
    });
  }

  async getPollsByCourse(courseId) {
    const normalizedCourseId = String(courseId || "").trim();
    if (!normalizedCourseId) return [];
    const cacheKey = `pollsByCourse_${normalizedCourseId}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== undefined) return cached;
    return this.getOrCreateInflight(cacheKey, async () => {
      const { data, error } = await supabase
        .from(this.pollCollection)
        .select(POLL_COLUMNS)
        .eq("courseId", normalizedCourseId)
        .order("createdAt", { ascending: false })
        .limit(50);
      throwIfSupabaseError(error, "Failed to load course polls.");
      const rows = normalizeRows(data || []);
      this.setCachedValue(cacheKey, rows);
      return rows;
    });
  }

  async getPollById(pollId) {
    const normalizedPollId = String(pollId || "").trim();
    if (!normalizedPollId) return null;
    const cacheKey = `pollById_${normalizedPollId}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== undefined) return cached;
    return this.getOrCreateInflight(cacheKey, async () => {
      const { data, error } = await supabase
        .from(this.pollCollection)
        .select(POLL_COLUMNS)
        .eq("id", normalizedPollId)
        .maybeSingle();
      throwIfSupabaseError(error, "Failed to load poll.");
      const row = data ? normalizeRow(data) : null;
      this.setCachedValue(cacheKey, row);
      return row;
    });
  }

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

    const existingVote = await this.getUserVote(userId, pollId);
    const payload = {
      userId: String(userId),
      pollId: String(pollId),
      vote: voteValue,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingVote?.$id) {
      const { data, error } = await supabase
        .from(this.pollVotesCollection)
        .update(payload)
        .eq("id", existingVote.$id)
        .select("*")
        .single();
      throwIfSupabaseError(error, "Failed to update vote.");
      const row = normalizeRow(data);
      this.pollResultsCache.delete(String(pollId));
      this.setCachedValue(`userVote_${String(userId)}_${String(pollId)}`, row);
      return row;
    }

    const { data, error } = await supabase
      .from(this.pollVotesCollection)
      .insert(payload)
      .select("*")
      .single();
    throwIfSupabaseError(error, "Failed to submit vote.");
    const row = normalizeRow(data);
    this.pollResultsCache.delete(String(pollId));
    this.setCachedValue(`userVote_${String(userId)}_${String(pollId)}`, row);
    return row;
  }

  async getUserVote(userId, pollId) {
    const normalizedUserId = String(userId || "").trim();
    const normalizedPollId = String(pollId || "").trim();
    if (!normalizedUserId || !normalizedPollId) return null;
    const cacheKey = `userVote_${normalizedUserId}_${normalizedPollId}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== undefined) return cached;
    return this.getOrCreateInflight(cacheKey, async () => {
      const { data, error } = await supabase
        .from(this.pollVotesCollection)
        .select(POLL_VOTE_COLUMNS)
        .eq("userId", normalizedUserId)
        .eq("pollId", normalizedPollId)
        .limit(1)
        .maybeSingle();
      throwIfSupabaseError(error, "Failed to load vote.");
      const row = data ? normalizeRow(data) : null;
      this.setCachedValue(cacheKey, row);
      return row;
    });
  }

  async getPollResults(pollId) {
    const id = String(pollId);
    const cached = this.pollResultsCache.get(id);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const persisted = this.readPersistentCache(`pollResults_${id}`);
    if (persisted) {
      this.pollResultsCache.set(id, {
        value: persisted,
        expiresAt: Date.now() + this.POLL_CACHE_TTL_MS,
      });
      return persisted;
    }

    return this.getOrCreateInflight(`pollResults_${id}`, async () => {
      const { data, error } = await supabase
        .from(this.pollVotesCollection)
        .select(POLL_VOTE_COLUMNS)
        .eq("pollId", id)
        .limit(1000);
      throwIfSupabaseError(error, "Failed to load poll results.");
      const votes = normalizeRows(data || []);
      const voteCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      votes.forEach((item) => {
        const voteValue = Number(item.vote);
        if (voteValue >= 1 && voteValue <= 5) {
          voteCounts[voteValue] += 1;
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
      this.writePersistentCache(`pollResults_${id}`, result);
      return result;
    });
  }

  async getPollResultsBulk(pollIds = []) {
    const ids = Array.from(
      new Set((pollIds || []).map((id) => String(id || "").trim()).filter(Boolean)),
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

    for (const chunk of applyInChunks(uncachedIds, 100)) {
      const { data, error } = await supabase
        .from(this.pollVotesCollection)
        .select(POLL_VOTE_COLUMNS)
        .in("pollId", chunk)
        .limit(1000);
      throwIfSupabaseError(error, "Failed to load poll results.");
      const rows = normalizeRows(data || []);
      rows.forEach((voteRow) => {
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
      new Set((pollIds || []).map((id) => String(id || "").trim()).filter(Boolean)),
    );
    const resultMap = {};
    ids.forEach((id) => {
      resultMap[id] = null;
    });
    if (ids.length === 0) return resultMap;

    const cacheKey = `userVotesBulk_${normalizedUserId}_${ids.join(",")}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== undefined) return cached;

    return this.getOrCreateInflight(cacheKey, async () => {
      for (const chunk of applyInChunks(ids, 100)) {
        const { data, error } = await supabase
        .from(this.pollVotesCollection)
        .select(POLL_VOTE_COLUMNS)
        .eq("userId", normalizedUserId)
          .in("pollId", chunk);
        throwIfSupabaseError(error, "Failed to load user votes.");
        const rows = normalizeRows(data || []);
        rows.forEach((voteRow) => {
          const pollId = String(voteRow?.pollId || "").trim();
          if (!pollId) return;
          const existing = resultMap[pollId];
          if (!existing) {
            resultMap[pollId] = voteRow;
            return;
          }
          const existingTime = this.toTimeMs(existing?.updatedAt || existing?.createdAt);
          const nextTime = this.toTimeMs(voteRow?.updatedAt || voteRow?.createdAt);
          if (nextTime >= existingTime) {
            resultMap[pollId] = voteRow;
          }
        });
      }

      for (const [pid, vote] of Object.entries(resultMap)) {
        this.setCachedValue(`userVote_${normalizedUserId}_${pid}`, vote);
      }
      this.setCachedValue(cacheKey, resultMap);
      return resultMap;
    });
  }

  async updatePollStatus(pollId, isActive) {
    const { error } = await supabase
      .from(this.pollCollection)
      .update({
        isActive: Boolean(isActive),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", String(pollId));
    throwIfSupabaseError(error, "Failed to update poll.");
    this.invalidatePollQueryCache();
    return true;
  }

  async batchUpdatePollStatus(pollIds, isActive) {
    if (!Array.isArray(pollIds) || pollIds.length === 0) return;
    const { error } = await supabase
      .from(this.pollCollection)
      .update({
        isActive: Boolean(isActive),
        updatedAt: new Date().toISOString(),
      })
      .in("id", pollIds.map((id) => String(id)));
    throwIfSupabaseError(error, "Failed to update polls.");
    this.invalidatePollQueryCache();
    return true;
  }

  async updatePoll(pollId, updates) {
    const allowedUpdates = { updatedAt: new Date().toISOString() };
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

    const { error } = await supabase
      .from(this.pollCollection)
      .update(allowedUpdates)
      .eq("id", String(pollId));
    throwIfSupabaseError(error, "Failed to update poll.");
    this.invalidatePollQueryCache();
    return true;
  }

  async deletePoll(pollId) {
    const { error } = await supabase
      .from(this.pollCollection)
      .delete()
      .eq("id", String(pollId));
    throwIfSupabaseError(error, "Failed to delete poll.");
    this.invalidatePollQueryCache();
    this.pollResultsCache.delete(String(pollId));
    return true;
  }

  async deleteVote(voteId) {
    const { error } = await supabase
      .from(this.pollVotesCollection)
      .delete()
      .eq("id", String(voteId));
    throwIfSupabaseError(error, "Failed to delete vote.");
    this.pollResultsCache.clear();
    this.pollQueryCache.clear();
    this.inflightRequests.clear();
    return true;
  }
}

export const pollService = new PollService();
export default pollService;
