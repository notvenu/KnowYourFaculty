const STORAGE_KEY = "kyf_account_deletion_v1";
const DELETION_DELAY_MS = 1 * 24 * 60 * 60 * 1000;

function hasStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readStore() {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  if (!hasStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store || {}));
}

function normalizeUserId(userId) {
  return String(userId || "").trim();
}

class AccountDeletionService {
  getScheduledDeletion(userId) {
    const uid = normalizeUserId(userId);
    if (!uid) return null;
    const store = readStore();
    const item = store[uid];
    if (!item || typeof item !== "object") return null;
    return item;
  }

  scheduleDeletion(userId, delayMs = DELETION_DELAY_MS) {
    const uid = normalizeUserId(userId);
    if (!uid) return null;
    const now = Date.now();
    const store = readStore();
    store[uid] = {
      userId: uid,
      requestedAt: new Date(now).toISOString(),
      executeAt: new Date(now + delayMs).toISOString(),
      status: "scheduled",
    };
    writeStore(store);
    return store[uid];
  }

  cancelDeletion(userId) {
    const uid = normalizeUserId(userId);
    if (!uid) return false;
    const store = readStore();
    if (!store[uid]) return false;
    delete store[uid];
    writeStore(store);
    return true;
  }

  async processDueDeletion({ user, authService, feedbackService }) {
    const uid = normalizeUserId(user?.$id);
    if (!uid) return { deleted: false };

    const scheduled = this.getScheduledDeletion(uid);
    if (!scheduled?.executeAt) return { deleted: false };

    const executeAt = new Date(scheduled.executeAt).getTime();
    if (!Number.isFinite(executeAt) || Date.now() < executeAt) {
      return { deleted: false, scheduled };
    }

    await feedbackService.deleteAllUserFeedback(uid);
    await authService.deleteCurrentAccount();
    this.cancelDeletion(uid);

    return {
      deleted: true,
      message:
        "Your account deletion request was completed. Your account and feedback data have been removed.",
    };
  }
}

const accountDeletionService = new AccountDeletionService();
export { DELETION_DELAY_MS };
export default accountDeletionService;
