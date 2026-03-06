import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const COURSE_CODE_RE = /\b([A-Z]{2,6}\s*-?\s*\d{3,4}[A-Z]?)\b/;

function normalizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeCode(value) {
  return normalizeSpaces(value).toUpperCase().replace(/[\s-]+/g, "");
}

function isSlotPart(value) {
  const token = normalizeSpaces(value).toUpperCase();
  if (!token) return false;
  return /^(?:[A-G][1-2]|T[A-G][1-2]|T[CG][1-2]|TG[1-2]|T[A-Z]{1,4}\d{1,2}|L\d{1,2}|V\d{1,2}|P\d{1,2})$/.test(
    token,
  );
}

function isSlotToken(value) {
  const token = normalizeSpaces(value)
    .toUpperCase()
    .replace(/^[\(\[\{]+|[\)\]\},.;:]+$/g, "");
  if (!token) return false;
  if (/^(TH|ETH|ELA)$/.test(token)) return true;
  return token.split("+").every((part) => isSlotPart(part));
}

function stripTrailingTypeMetadata(value) {
  const name = normalizeSpaces(value);
  if (!name) return name;

  const upper = name.toUpperCase();
  const markers = [" THEORY ", " LAB ", " ECS ", " CAPSTONE ", " SDP "];
  let lastIndex = -1;
  let markerLen = 0;

  for (const marker of markers) {
    const idx = upper.lastIndexOf(marker);
    if (idx > lastIndex) {
      lastIndex = idx;
      markerLen = marker.length;
    }
  }

  if (lastIndex < 0) return name;

  const head = normalizeSpaces(name.slice(0, lastIndex));
  const tail = normalizeSpaces(name.slice(lastIndex + markerLen));
  if (!tail) return name;

  // Tail should look like metadata (batch/slot/group text), not natural words.
  const hasLowercase = /[a-z]/.test(tail);
  const looksMeta =
    /\d/.test(tail) ||
    /\b(?:UE|LO|MGT|ALL|ODD|EVEN|B\.?TECH|M\.?TECH|AND)\b/i.test(tail);

  if (hasLowercase || !looksMeta) return name;
  return head || name;
}

function cleanCourseName(value) {
  let name = normalizeSpaces(value);
  name = name.replace(/^\d+[\.\)]?\s*/, "");
  {
    const parts = normalizeSpaces(name).split(" ").filter(Boolean);
    while (parts.length > 0 && isSlotToken(parts[parts.length - 1])) {
      parts.pop();
    }
    name = parts.join(" ");
  }
  // Remove trailing credit-like numeric columns if present.
  name = name.replace(/(\s+\d+(\.\d+)?){2,}\s*$/, "");
  // Remove trailing type+code tags like "Theory 24BCB-1", "Lab 24CSE-2", etc.
  name = name.replace(
    /\s+(THEORY|LAB|ECS|CAPSTONE|SDP)\s+\d{2}[A-Z]{2,5}-?\d{1,2}[A-Z]?\s*$/i,
    "",
  );
  // Remove broader trailing exam/type suffixes like:
  // "Theory 23BCE ALL/23MIS C1+TCC1", "Lab 24CSE C2+TCC2", etc.
  name = name.replace(
    /\s+(THEORY|LAB|ECS|CAPSTONE|SDP)\b(?=[A-Z0-9\/+\-\s]*\b\d{2}[A-Z]{2,5}\b)[A-Z0-9\/+\-\s]*$/i,
    "",
  );
  // Remove trailing metadata tails attached to a final type marker.
  name = stripTrailingTypeMetadata(name);
  {
    const parts = normalizeSpaces(name).split(" ").filter(Boolean);
    while (parts.length > 0 && isSlotToken(parts[parts.length - 1])) {
      parts.pop();
    }
    name = parts.join(" ");
  }
  return normalizeSpaces(name);
}

function mergeByCode(courses = []) {
  const map = new Map();
  for (const course of courses) {
    const code = normalizeCode(course?.courseCode);
    const name = cleanCourseName(course?.courseName);
    if (!code || !name) continue;

    const existing = map.get(code);
    if (!existing || name.length > existing.courseName.length) {
      map.set(code, { courseCode: code, courseName: name });
    }
  }
  return [...map.values()];
}

function extractCourseFromLine(rawLine) {
  const line = normalizeSpaces(rawLine);
  if (!line) return null;

  const codeMatch = line.match(COURSE_CODE_RE);
  if (!codeMatch) return null;

  const rawCode = codeMatch[1];
  const code = normalizeCode(rawCode);
  if (!code) return null;

  const codeStart = Number(codeMatch.index || 0);
  const afterCode = line.slice(codeStart + rawCode.length);
  const nameCandidate = cleanCourseName(afterCode);
  if (!nameCandidate || nameCandidate.length < 3) return null;

  return {
    courseCode: code,
    courseName: nameCandidate
  };
}

async function readPdfLines(file) {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const lines = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const text = await page.getTextContent();
    let current = "";

    for (const item of text.items || []) {
      const token = normalizeSpaces(item?.str || "");
      if (token) {
        current = current ? `${current} ${token}` : token;
      }
      if (item?.hasEOL) {
        if (current) lines.push(current);
        current = "";
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

export async function extractCoursesFromPdf(file) {
  if (!file) throw new Error("PDF file is required.");
  const lines = await readPdfLines(file);
  const extracted = [];

  for (const line of lines) {
    const course = extractCourseFromLine(line);
    if (course) extracted.push(course);
  }

  const merged = mergeByCode(extracted);
  return {
    linesScanned: lines.length,
    extractedCount: extracted.length,
    courses: merged
  };
}
