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

function cleanCourseName(value) {
  let name = normalizeSpaces(value);
  name = name.replace(/^\d+[\.\)]?\s*/, "");
  // Remove trailing delivery/slot columns from annexure style rows, e.g. "TH B1+TB1", "ETH TG2", "ELA L14+L15".
  name = name.replace(/\s+(TH|ETH|ELA)\s+[A-Z0-9]+(?:\+[A-Z0-9]+)*\s*$/i, "");
  // Remove trailing credit-like numeric columns if present.
  name = name.replace(/(\s+\d+(\.\d+)?){2,}\s*$/, "");
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

  const nameCandidate = cleanCourseName(line.replace(rawCode, " "));
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
