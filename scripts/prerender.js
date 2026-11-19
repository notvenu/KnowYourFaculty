// Post-build step: turns the SPA into crawlable HTML. Run by `npm run build` after `vite build`.
//   - writes dist/<route>/index.html for every static route, department and faculty profile, each with its own
//     <title>, description, canonical, Open Graph, JSON-LD and a text copy of the page for crawlers that skip JS
//   - writes dist/app-shell.html (generic shell used as the SPA fallback for profiles added after the build)
//   - writes dist/sitemap.xml and dist/llms.txt from the live faculty data
// Needs VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY at build time; without them only the static routes are produced.
import { config } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

config();

const DIST = "dist";
const env = process.env;
const SUPABASE_URL = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";
const FACULTY_TABLE = env.VITE_SUPABASE_FACULTY_TABLE || "faculty";
const REVIEW_TABLE = env.VITE_SUPABASE_REVIEW_TABLE || "reviews";

const seo = await import("../src/lib/seo.js");
const { getTierFromRating, TIER_SYSTEM } = await import("../src/lib/ratingConfig.js");
const content = await import("../src/data/siteContent.js");
const { SITE_URL } = seo;

// ---------- data ----------

async function fetchAll(table, columns, order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${columns}${order ? `&order=${order}` : ""}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + 999}`,
        "Range-Unit": "items",
      },
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

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
const SECTIONS = {
  theory: RATING_FIELDS.slice(0, 4),
  lab: RATING_FIELDS.slice(4, 7),
  ecs: RATING_FIELDS.slice(7),
};

// Same arithmetic as facultyFeedbackService.buildRatingSummary, so the page and the markup agree.
function summarize(rows) {
  const total = {};
  const count = {};
  for (const field of RATING_FIELDS) [total[field], count[field]] = [0, 0];
  for (const row of rows) {
    for (const field of RATING_FIELDS) {
      const value = Number(row[field]);
      if (Number.isFinite(value) && value >= 1 && value <= 5) {
        total[field] += Math.round(value);
        count[field] += 1;
      }
    }
  }
  const avg = (fields) => {
    const n = fields.reduce((sum, f) => sum + count[f], 0);
    return n ? fields.reduce((sum, f) => sum + total[f], 0) / n : null;
  };
  return {
    totalRatings: rows.length,
    overallAverage: avg(RATING_FIELDS),
    sectionAverages: Object.fromEntries(
      Object.entries(SECTIONS).map(([key, fields]) => [key, avg(fields)]),
    ),
  };
}

async function loadData() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[prerender] Supabase env missing: building static routes only (no faculty pages).");
    return { faculty: [], summaries: new Map(), lastActivity: new Map() };
  }
  try {
    const [facultyRows, reviewRows] = await Promise.all([
      fetchAll(
        FACULTY_TABLE,
        "employeeId,name,designation,department,subDepartment,researchArea,educationUG,educationPG,educationPhD,photoFileId,updatedAt",
        "name.asc",
      ),
      fetchAll(REVIEW_TABLE, ["facultyId", "createdAt", "updatedAt", ...RATING_FIELDS].join(","), null),
    ]);
    const byFaculty = new Map();
    for (const row of reviewRows) {
      const key = String(row.facultyId ?? "").trim();
      if (!byFaculty.has(key)) byFaculty.set(key, []);
      byFaculty.get(key).push(row);
    }
    const faculty = facultyRows.filter((f) => f.name && Number.isFinite(Number(f.employeeId)));
    const summaries = new Map();
    const lastActivity = new Map();
    for (const f of faculty) {
      const rows = byFaculty.get(String(f.employeeId)) || [];
      summaries.set(String(f.employeeId), summarize(rows));
      const times = [f.updatedAt, ...rows.map((r) => r.updatedAt || r.createdAt)]
        .map((t) => Date.parse(t))
        .filter(Number.isFinite);
      if (times.length) lastActivity.set(String(f.employeeId), new Date(Math.max(...times)).toISOString());
    }
    console.log(`[prerender] ${faculty.length} faculty, ${reviewRows.length} ratings loaded.`);
    return { faculty, summaries, lastActivity };
  } catch (error) {
    console.warn(`[prerender] Could not load data (${error.message}); building static routes only.`);
    return { faculty: [], summaries: new Map(), lastActivity: new Map() };
  }
}

// ---------- html helpers ----------

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const link = (to, text) => `<a href="${esc(to)}">${esc(text)}</a>`;
const score = (value) => (Number.isFinite(value) ? `${value.toFixed(1)} / 5 (${TIER_SYSTEM[getTierFromRating(value)].label})` : null);

function serializeTags(tags) {
  return tags
    .map((entry) => {
      if (entry.tag === "script") {
        const json = JSON.stringify(entry.json).replace(/</g, "\\u003c");
        return `<script type="application/ld+json" data-seo>${json}</script>`;
      }
      const attrs = Object.entries(entry.attrs)
        .map(([key, value]) => `${key}="${esc(value)}"`)
        .join(" ");
      return `<${entry.tag} ${attrs} data-seo />`;
    })
    .join("\n    ");
}

const HIDDEN =
  "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";

const mainNav = `<nav aria-label="Main">${[
  ["/", "Home"],
  ["/faculty", "Faculty directory"],
  ["/rankings", "Rankings"],
  ["/about", "About and how ratings work"],
  ["/contact", "Contact"],
]
  .map(([to, text]) => link(to, text))
  .join(" ")}</nav>`;

let template = "";

function renderPage(seoData, bodyHtml) {
  const titleTag = `<title>${esc(seoData.title)}</title>`;
  return template
    .replace(/<title>[\s\S]*?<\/title>/, titleTag)
    .replace(
      /<!--seo:start-->[\s\S]*?<!--seo:end-->/,
      `<!--seo:start-->\n    ${serializeTags(seo.seoToTags(seoData))}\n    <!--seo:end-->`,
    )
    .replace("<!--prerender-->", `<div id="prerender" style="${HIDDEN}">${bodyHtml}${mainNav}</div>`);
}

async function writeRoute(routePath, html) {
  const file = routePath === "/" ? "index.html" : path.join(routePath.slice(1), "index.html");
  const target = path.join(DIST, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
}

// ---------- page bodies ----------

const facultyLine = (f, summaries) => {
  const s = summaries.get(String(f.employeeId));
  const rated = s?.totalRatings ? `, ${score(s.overallAverage)} from ${s.totalRatings} rating${s.totalRatings === 1 ? "" : "s"}` : "";
  return `<li>${link(seo.facultyPath(f), f.name)}${f.designation ? `, ${esc(f.designation)}` : ""}${rated}</li>`;
};

function faqHtml(list) {
  return list.map(({ q, a }) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("");
}

function homeBody({ faculty, departments, totalRatings }) {
  return `<h1>Know how your VIT-AP professors teach before you register</h1>
<p>KnowYourFaculty is a free student platform with anonymous ratings and reviews from VIT-AP students, split into theory, lab and ECS. See who is strict about attendance and who marks fairly before you pick a course.</p>
<p>${faculty.length ? `${faculty.length} faculty profiles and ${totalRatings} student ratings across ${departments.length} departments.` : ""}</p>
<p>${link("/faculty", "Browse all faculty")} ${link("/rankings", "See faculty rankings")} ${link("/about", "How the ratings work")}</p>
<h2>What you get on every faculty page</h2>
<ul>${content.features.map((f) => `<li><strong>${esc(f.title)}.</strong> ${esc(f.text)}</li>`).join("")}</ul>
<h2>Built for trust and control</h2>
<ul>${content.trust.map((f) => `<li><strong>${esc(f.title)}.</strong> ${esc(f.text)}</li>`).join("")}</ul>
<h2>The strictness scale</h2>
<ul>${content.tierScale.map((t) => `<li>${t.score}: ${esc(t.label)}, ${esc(t.meaning)}</li>`).join("")}</ul>
<h2>Frequently asked questions</h2>${faqHtml(content.faqs)}
<h2>Faculty by department</h2>
<ul>${departments.map((d) => `<li>${link(seo.departmentPath(d.name), `${d.name} (${d.faculty.length} faculty)`)}</li>`).join("")}</ul>`;
}

function directoryBody({ departments, summaries }) {
  return `<h1>VIT-AP faculty directory</h1>
<p>Search every VIT-AP professor by name or department and read anonymous student ratings for theory, lab and ECS. Open a profile to see the full breakdown.</p>
${departments
  .map(
    (d) =>
      `<h2>${link(seo.departmentPath(d.name), d.name)}</h2><ul>${d.faculty.map((f) => facultyLine(f, summaries)).join("")}</ul>`,
  )
  .join("")}`;
}

function departmentBody(dept, { departments, summaries }) {
  const others = departments.filter((d) => d !== dept).slice(0, 12);
  return `<h1>${esc(dept.name)} faculty at VIT-AP</h1>
<p>Anonymous student ratings for ${dept.faculty.length} ${esc(dept.name)} faculty, with separate theory, lab and ECS scores. Open a profile for the full breakdown.</p>
<ul>${dept.faculty.map((f) => facultyLine(f, summaries)).join("")}</ul>
<h2>Other departments</h2>
<ul>${others.map((d) => `<li>${link(seo.departmentPath(d.name), d.name)}</li>`).join("")}</ul>
<p>${link("/faculty", "All VIT-AP faculty")}</p>`;
}

function rankingBody({ faculty, summaries }) {
  const ranked = faculty
    .map((f) => ({ f, s: summaries.get(String(f.employeeId)) }))
    .filter(({ s }) => s?.totalRatings && Number.isFinite(s.overallAverage))
    .sort((a, b) => b.s.overallAverage - a.s.overallAverage || b.s.totalRatings - a.s.totalRatings)
    .slice(0, 50);
  return `<h1>VIT-AP faculty rankings</h1>
<p>VIT-AP professors ranked by overall anonymous student rating, highest first. Scores run from 1 (Rod-God, the strictest) to 5 (Loose-God, the most lenient). Filter by department, designation, course and theory, lab or ECS on the live page.</p>
<ol>${ranked
    .map(
      ({ f, s }) =>
        `<li>${link(seo.facultyPath(f), f.name)} (${esc(seo.departmentLabel(f.department))}): ${score(s.overallAverage)} from ${s.totalRatings} rating${s.totalRatings === 1 ? "" : "s"}</li>`,
    )
    .join("")}</ol>
<p>${link("/faculty", "Browse all faculty")} ${link("/about", "How scores are calculated")}</p>`;
}

function aboutBody() {
  return `<h1>About KnowYourFaculty</h1>
<p>KnowYourFaculty is a free, student-run website where VIT-AP students rate and review their professors anonymously. Ratings are split into theory, lab and ECS (capstone / SDP), so a great lecturer with a harsh lab does not average out. It is built and maintained by Venu K.</p>
<h2>The Rod-God to Loose-God scale</h2>
<ul>${content.tierScale.map((t) => `<li>${t.score}: ${esc(t.label)}, ${esc(t.meaning)}</li>`).join("")}</ul>
<h2>Questions and answers</h2>${faqHtml(content.aboutFaqs)}
<p>${link("/faculty", "Browse faculty")} ${link("/rankings", "Rankings")} ${link("/privacy-policy", "Privacy policy")} ${link("/terms-and-conditions", "Terms")}</p>`;
}

function facultyBody(f, ctx) {
  const { departments, summaries } = ctx;
  const s = summaries.get(String(f.employeeId));
  const dept = departments.find((d) => d.name === f.department);
  const siblings = dept?.faculty || [];
  const at = siblings.indexOf(f);
  const related = siblings.length > 1
    ? Array.from({ length: Math.min(6, siblings.length - 1) }, (_, i) => siblings[(at + 1 + i) % siblings.length])
    : [];
  const education = [f.educationUG, f.educationPG, f.educationPhD].filter(Boolean);
  const lines = [
    s?.overallAverage != null && `<li>Overall: ${score(s.overallAverage)} from ${s.totalRatings} student rating${s.totalRatings === 1 ? "" : "s"}</li>`,
    s?.sectionAverages.theory != null && `<li>Theory: ${score(s.sectionAverages.theory)}</li>`,
    s?.sectionAverages.lab != null && `<li>Lab: ${score(s.sectionAverages.lab)}</li>`,
    s?.sectionAverages.ecs != null && `<li>ECS / Capstone / SDP: ${score(s.sectionAverages.ecs)}</li>`,
  ].filter(Boolean);
  return `<h1>${esc(f.name)}: reviews and ratings at VIT-AP</h1>
<p>${esc([f.designation, f.department].filter(Boolean).join(", "))}${f.subDepartment ? ` (${esc(f.subDepartment)})` : ""}.</p>
<h2>Student ratings</h2>
${lines.length ? `<ul>${lines.join("")}</ul><p>Scores run from 1 (Rod-God, the strictest) to 5 (Loose-God, the most lenient). Based on anonymous ratings from verified VIT-AP students.</p>` : `<p>No student has rated ${esc(f.name)} yet. Verified VIT-AP students can add the first anonymous rating.</p>`}
${f.researchArea ? `<h2>Research areas</h2><p>${esc(f.researchArea)}</p>` : ""}
${education.length ? `<h2>Education</h2><ul>${education.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
${related.length ? `<h2>More ${esc(seo.departmentLabel(f.department))} faculty</h2><ul>${related.map((r) => facultyLine(r, summaries)).join("")}</ul>` : ""}
<p>${dept ? link(seo.departmentPath(dept.name), `All ${dept.name} faculty`) : ""} ${link("/faculty", "All VIT-AP faculty")} ${link("/rankings", "Rankings")}</p>`;
}

// ---------- build ----------

const today = new Date().toISOString().slice(0, 10);
template = await readFile(path.join(DIST, "index.html"), "utf8");

const { faculty, summaries, lastActivity } = await loadData();

const deptMap = new Map();
for (const f of faculty) {
  const name = String(f.department || "").trim();
  if (!name) continue;
  if (!deptMap.has(name)) deptMap.set(name, { name, slug: seo.departmentSlug(name), faculty: [] });
  deptMap.get(name).faculty.push(f);
}
const seenSlugs = new Set();
const departments = [...deptMap.values()].sort((a, b) => a.name.localeCompare(b.name));
for (const d of departments) {
  while (seenSlugs.has(d.slug)) d.slug += "-2"; // distinct names that slugify the same
  seenSlugs.add(d.slug);
}
const ctx = {
  faculty,
  departments,
  summaries,
  totalRatings: [...summaries.values()].reduce((sum, s) => sum + s.totalRatings, 0),
};

const sitemap = [];
const addUrl = (loc, lastmod) => sitemap.push({ loc: `${SITE_URL}${loc}`, lastmod });
const newest = [...lastActivity.values()].sort().pop();

const staticPages = [
  ["/", homeBody(ctx), newest],
  ["/faculty", directoryBody(ctx), newest],
  ["/rankings", rankingBody(ctx), newest],
  ["/about", aboutBody()],
  ["/contact", `<h1>Contact and contribute</h1><p>Report a bug, suggest a feature or contribute to the open-source KnowYourFaculty project on GitHub.</p>`],
  ["/privacy-policy", `<h1>Privacy policy</h1><p>How KnowYourFaculty keeps student reviews anonymous, what data is stored and how to delete your account.</p>`],
  ["/terms-and-conditions", `<h1>Terms and conditions</h1><p>The rules for posting and moderating faculty feedback on KnowYourFaculty.</p>`],
  ["/polls", `<h1>Student polls</h1><p>Vote and view VIT-AP student polls about faculty strictness and course difficulty. Sign in with a VIT-AP account to take part.</p>`],
];
for (const [route, body, lastmod] of staticPages) {
  const data = seo.getStaticSeo(route, { faculty });
  await writeRoute(route, renderPage(data, body));
  if (!data.noindex) addUrl(route, lastmod);
}

for (const d of departments) {
  const data = { ...seo.departmentSeo(d.name, d.faculty), path: `/departments/${d.slug}` };
  await writeRoute(data.path, renderPage(data, departmentBody(d, ctx)));
  addUrl(data.path, d.faculty.map((f) => lastActivity.get(String(f.employeeId))).filter(Boolean).sort().pop());
}

for (const f of faculty) {
  const data = seo.facultySeo(f, summaries.get(String(f.employeeId)));
  await writeRoute(data.path, renderPage(data, facultyBody(f, ctx)));
  addUrl(data.path, lastActivity.get(String(f.employeeId)));
}

// Generic shell: no canonical, no og:url, no robots, so a profile added after the build is not mislabelled.
const shellDescription = "Anonymous VIT-AP faculty reviews and ratings from real students.";
await writeFile(
  path.join(DIST, "app-shell.html"),
  template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>KnowYourFaculty</title>`)
    .replace(
      /<!--seo:start-->[\s\S]*?<!--seo:end-->/,
      `<!--seo:start-->\n    <meta name="description" content="${shellDescription}" data-seo />\n    <!--seo:end-->`,
    ),
);

const xml = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ...sitemap.map(
    ({ loc, lastmod }) =>
      `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}</url>`,
  ),
  `</urlset>`,
  ``,
].join("\n");
await writeFile(path.join(DIST, "sitemap.xml"), xml);

const llms = `# KnowYourFaculty

> KnowYourFaculty is a free, student-run website where VIT-AP students rate and review their professors anonymously. Ratings are split into theory, lab and ECS and scored from 1 (Rod-God, the strictest) to 5 (Loose-God, the most lenient). Anyone can read ratings without signing in; only verified VIT-AP students can post.

## Key pages
- [Faculty directory](${SITE_URL}/faculty): every VIT-AP professor with their student ratings
- [Faculty rankings](${SITE_URL}/rankings): professors ordered by overall student rating
- [About and how ratings work](${SITE_URL}/about): the scale, the calculation, anonymity and FAQs
- [Privacy policy](${SITE_URL}/privacy-policy)
- [Terms](${SITE_URL}/terms-and-conditions)

## Departments
${departments.map((d) => `- [${d.name}](${SITE_URL}/departments/${d.slug}): ${d.faculty.length} faculty`).join("\n")}

## Optional
- [Sitemap](${SITE_URL}/sitemap.xml)
- [Source code](https://github.com/notvenu/KnowYourFaculty)
`;
await writeFile(path.join(DIST, "llms.txt"), llms);

console.log(
  `[prerender] ${staticPages.length} static pages, ${departments.length} departments, ${faculty.length} faculty profiles, ${sitemap.length} sitemap URLs (${today}).`,
);
