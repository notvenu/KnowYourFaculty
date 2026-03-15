export function toIsoString(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? date.toISOString() : null;
}

export function normalizeRow(row) {
  if (!row || typeof row !== "object") return row;

  const normalized = {
    ...row,
    $id: String(row.$id || row.id || "").trim(),
  };

  if ("createdAt" in normalized) {
    normalized.createdAt = toIsoString(normalized.createdAt);
  }
  if ("updatedAt" in normalized) {
    normalized.updatedAt = toIsoString(normalized.updatedAt);
  }
  if ("pollStartTime" in normalized) {
    normalized.pollStartTime = toIsoString(normalized.pollStartTime);
  }
  if ("pollEndTime" in normalized) {
    normalized.pollEndTime = toIsoString(normalized.pollEndTime);
  }

  return normalized;
}

export function normalizeRows(rows = []) {
  return (rows || []).map((row) => normalizeRow(row));
}

export function applyRange(query, page = 1, limit = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;
  return query.range(from, to);
}

export function applyInChunks(items = [], chunkSize = 100) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export function throwIfSupabaseError(error, fallbackMessage) {
  if (!error) return;
  throw new Error(error.message || fallbackMessage || "Supabase request failed.");
}
