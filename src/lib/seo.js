/**
 * One SEO definition used by the browser (applySeo) and the build-time prerender (seoToTags).
 * Plain ESM with no DOM or Vite-only imports at module level, so Node can import it.
 */
import clientConfig from "../config/client.js";
import { getCloudinaryImageUrl } from "./cloudinary/shared.js";
import { getTierFromRating, TIER_SYSTEM } from "./ratingConfig.js";
import { aboutFaqs, faqs, INSTITUTION, SITE_NAME } from "../data/siteContent.js";

const DEFAULT_SITE_URL = "https://knowyourfaculty.vercel.app";

// Set VITE_SITE_URL on the host to move to a custom domain; localhost values are ignored.
export const SITE_URL = (() => {
  const raw = String(clientConfig.siteUrl || "")
    .trim()
    .replace(/\/+$/, "");
  return raw && !/localhost|127\.0\.0\.1/.test(raw) ? raw : DEFAULT_SITE_URL;
})();

export const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;
export const DEFAULT_IMAGE_ALT =
  "KnowYourFaculty: anonymous VIT-AP faculty reviews and ratings";
const UNIVERSITY = {
  "@type": "CollegeOrUniversity",
  name: "VIT-AP University",
  url: "https://vitap.ac.in",
};
const ROBOTS_INDEX =
  "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

export const absoluteUrl = (path = "/") => `${SITE_URL}${path}`;

const clip = (text, max) => {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).replace(/[\s,;:.-]+\S*$/, "")}…`;
};

// "School of Computer Science and Engineering (SCOPE)" -> "scope"; falls back to a slug of the name.
export function departmentLabel(name) {
  const match = String(name || "").match(/\(([^)]+)\)\s*$/);
  return match ? match[1].trim() : String(name || "").trim();
}

export function departmentSlug(name) {
  return departmentLabel(name)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const facultyPath = (faculty) => `/faculty/${faculty.employeeId}`;
export const departmentPath = (name) => `/departments/${departmentSlug(name)}`;

export function facultyPhotoUrl(photoFileId) {
  const raw = String(photoFileId || "").trim();
  if (!raw || raw.startsWith("sample_")) return null;
  return /^https?:\/\//i.test(raw) ? raw : getCloudinaryImageUrl(raw);
}

const breadcrumb = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
});

const faqPage = (list) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: list.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});

const itemList = (items) => ({
  "@type": "ItemList",
  numberOfItems: items.length,
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: absoluteUrl(item.path),
    name: item.name,
  })),
});

// Entities every page repeats so search and AI engines resolve the brand to one thing.
const siteJsonLd = () => [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: "Know Your Faculty",
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/icon-512.png"),
      width: 512,
      height: 512,
    },
    description:
      "KnowYourFaculty is a free, student-run website for anonymous VIT-AP faculty reviews and ratings.",
    knowsAbout: ["VIT-AP faculty", "professor ratings", "course registration"],
    founder: {
      "@type": "Person",
      name: "Venu K",
      url: "https://github.com/notvenu",
      sameAs: [
        "https://github.com/notvenu",
        "https://linkedin.com/in/venu-kasibhatla",
      ],
    },
    sameAs: ["https://github.com/notvenu/KnowYourFaculty"],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: "Know Your Faculty",
    url: absoluteUrl("/"),
    inLanguage: "en",
    publisher: { "@id": `${SITE_URL}/#organization` },
  },
];

const HOME = { name: "Home", path: "/" };
const DIRECTORY = { name: "Faculty", path: "/faculty" };

/** SEO for the fixed routes. `faculty` (all rows) is optional and only feeds the directory ItemList. */
export function getStaticSeo(path, { faculty = [] } = {}) {
  switch (path) {
    case "/":
      return {
        title: `${INSTITUTION} Faculty Reviews & Ratings | ${SITE_NAME}`,
        description:
          "Anonymous VIT-AP faculty reviews from real students. Compare professors by theory, lab and ECS, and see who is strict about attendance before you register.",
        path,
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: SITE_NAME,
            url: absoluteUrl("/"),
            description:
              "Free anonymous faculty ratings and reviews for VIT-AP students, scored separately for theory, lab and ECS.",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Any",
            audience: { "@type": "EducationalAudience", educationalRole: "student" },
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
            featureList: [
              "Anonymous faculty reviews",
              "Separate theory, lab and ECS ratings",
              "Faculty search by name, department or course",
              "Faculty rankings",
              "Community polls",
            ],
          },
          faqPage(faqs),
        ],
      };
    case "/faculty":
      return {
        title: `${INSTITUTION} Faculty Directory & Ratings | ${SITE_NAME}`,
        description:
          "Search every VIT-AP professor by name or department and read anonymous student ratings for theory, lab and ECS.",
        path,
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "VIT-AP Faculty Directory",
            url: absoluteUrl(path),
            about: UNIVERSITY,
            ...(faculty.length
              ? {
                  mainEntity: itemList(
                    faculty.map((f) => ({ name: f.name, path: facultyPath(f) })),
                  ),
                }
              : {}),
          },
          breadcrumb([HOME, DIRECTORY]),
        ],
      };
    case "/rankings":
      return {
        title: `${INSTITUTION} Faculty Rankings by Student Ratings | ${SITE_NAME}`,
        description:
          "VIT-AP professors ranked by anonymous student ratings. Filter by department, designation, course and theory, lab or ECS.",
        path,
        jsonLd: [breadcrumb([HOME, { name: "Rankings", path }])],
      };
    case "/polls":
      return {
        title: `Student Polls on VIT-AP Faculty | ${SITE_NAME}`,
        description:
          "Vote and view VIT-AP student polls about faculty strictness and course difficulty.",
        path,
        noindex: true, // the page asks guests to sign in, so there is nothing to index
      };
    case "/about":
      return {
        title: `About ${SITE_NAME}: How VIT-AP Faculty Ratings Work`,
        description:
          "What KnowYourFaculty is, who runs it, how the Rod-God to Loose-God scale is calculated, and how student reviews stay anonymous.",
        path,
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: `About ${SITE_NAME}`,
            url: absoluteUrl(path),
            about: { "@id": `${SITE_URL}/#organization` },
          },
          faqPage(aboutFaqs),
          breadcrumb([HOME, { name: "About", path }]),
        ],
      };
    case "/contact":
      return {
        title: `Contact & Contribute | ${SITE_NAME}`,
        description:
          "Report a bug, suggest a feature or contribute to the open-source KnowYourFaculty project.",
        path,
        jsonLd: [
          { "@context": "https://schema.org", "@type": "ContactPage", url: absoluteUrl(path), name: "Contact" },
          breadcrumb([HOME, { name: "Contact", path }]),
        ],
      };
    case "/privacy-policy":
      return {
        title: `Privacy Policy | ${SITE_NAME}`,
        description:
          "How KnowYourFaculty keeps student reviews anonymous, what data is stored and how to delete your account.",
        path,
        jsonLd: [breadcrumb([HOME, { name: "Privacy Policy", path }])],
      };
    case "/terms-and-conditions":
      return {
        title: `Terms and Conditions | ${SITE_NAME}`,
        description:
          "The rules for posting and moderating faculty feedback on KnowYourFaculty.",
        path,
        jsonLd: [breadcrumb([HOME, { name: "Terms", path }])],
      };
    case "/dashboard":
    case "/admin":
      return {
        title: `${SITE_NAME}`,
        description: "Private page.",
        path,
        noindex: true,
      };
    default:
      return null;
  }
}

export function departmentSeo(name, faculty = []) {
  const label = departmentLabel(name);
  const path = departmentPath(name);
  return {
    title: `${label} Faculty Reviews at ${INSTITUTION} | ${SITE_NAME}`,
    description: clip(
      `Anonymous student ratings for ${faculty.length || "all"} ${name} faculty at VIT-AP, with theory, lab and ECS scores for each professor.`,
      160,
    ),
    path,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${name} faculty at VIT-AP`,
        url: absoluteUrl(path),
        about: { "@type": "Organization", name, parentOrganization: UNIVERSITY },
        ...(faculty.length
          ? {
              mainEntity: itemList(
                faculty.map((f) => ({ name: f.name, path: facultyPath(f) })),
              ),
            }
          : {}),
      },
      breadcrumb([HOME, DIRECTORY, { name: label, path }]),
    ],
  };
}

const scoreText = (value) => (Number.isFinite(value) ? value.toFixed(1) : null);

/** `summary` = { totalRatings, overallAverage, sectionAverages: {theory, lab, ecs} } (any part may be missing). */
export function facultySeo(faculty, summary = {}) {
  const path = facultyPath(faculty);
  const name = String(faculty.name || "Faculty").trim();
  const dept = String(faculty.department || "").trim();
  const label = departmentLabel(dept);
  const total = Number(summary.totalRatings) || 0;
  const overall = Number(summary.overallAverage);
  const tier = Number.isFinite(overall)
    ? TIER_SYSTEM[getTierFromRating(overall)].label
    : null;

  const who = [faculty.designation, dept].filter(Boolean).join(", ");
  const description = clip(
    total > 0 && tier
      ? `${name}${who ? `, ${who}` : ""}. Rated ${scoreText(overall)}/5 (${tier}) by ${total} VIT-AP student${total === 1 ? "" : "s"}. See theory, lab and ECS scores and reviews.`
      : `${name}${who ? `, ${who}` : ""} at VIT-AP. Read anonymous student ratings for theory, lab and ECS, or be the first to rate.`,
    160,
  );

  const researchAreas = String(faculty.researchArea || "")
    .split(/[,;|\n]/)
    .map((area) => area.trim())
    .filter(Boolean)
    .slice(0, 12);
  const image = facultyPhotoUrl(faculty.photoFileId);

  return {
    // Brand last, and dropped when the name is long enough to push the title past ~65 characters.
    title: (() => {
      const core = `${name}${label ? ` (${label})` : ""} VIT-AP Reviews & Ratings`;
      return core.length + SITE_NAME.length + 3 <= 65 ? `${core} | ${SITE_NAME}` : core;
    })(),
    description,
    path,
    type: "profile",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        url: absoluteUrl(path),
        name: `${name}: reviews and ratings`,
        ...(faculty.updatedAt ? { dateModified: faculty.updatedAt } : {}),
        mainEntity: {
          "@type": "Person",
          "@id": `${absoluteUrl(path)}#person`,
          name,
          url: absoluteUrl(path),
          ...(faculty.designation ? { jobTitle: faculty.designation } : {}),
          ...(image ? { image } : {}),
          ...(researchAreas.length ? { knowsAbout: researchAreas } : {}),
          worksFor: {
            ...UNIVERSITY,
            ...(dept ? { department: { "@type": "Organization", name: dept } } : {}),
          },
        },
      },
      breadcrumb([
        HOME,
        DIRECTORY,
        ...(dept ? [{ name: label, path: departmentPath(dept) }] : []),
        { name, path },
      ]),
    ],
  };
}

/** Head entries for an SEO object, as plain data both the browser and Node can consume. */
export function seoToTags(seo) {
  const url = absoluteUrl(seo.path || "/");
  const image = seo.image || DEFAULT_IMAGE;
  const imageAlt = seo.imageAlt || DEFAULT_IMAGE_ALT;
  const isDefaultImage = image === DEFAULT_IMAGE;
  const meta = (key, content, attribute = "name") => ({
    tag: "meta",
    attrs: { [attribute]: key, content },
  });

  const tags = [
    meta("description", seo.description),
    meta("robots", seo.noindex ? "noindex, nofollow" : ROBOTS_INDEX),
  ];
  if (!seo.noindex) tags.push({ tag: "link", attrs: { rel: "canonical", href: url } });
  tags.push(
    meta("og:type", seo.type || "website", "property"),
    meta("og:site_name", SITE_NAME, "property"),
    meta("og:locale", "en_IN", "property"),
    meta("og:url", url, "property"),
    meta("og:title", seo.title, "property"),
    meta("og:description", seo.description, "property"),
    meta("og:image", image, "property"),
    meta("og:image:alt", imageAlt, "property"),
  );
  if (isDefaultImage) {
    tags.push(
      meta("og:image:width", "1200", "property"),
      meta("og:image:height", "630", "property"),
    );
  }
  tags.push(
    meta("twitter:card", isDefaultImage ? "summary_large_image" : "summary"),
    meta("twitter:title", seo.title),
    meta("twitter:description", seo.description),
    meta("twitter:image", image),
    meta("twitter:image:alt", imageAlt),
  );
  for (const data of [...siteJsonLd(), ...(seo.jsonLd || [])]) {
    tags.push({ tag: "script", json: data });
  }
  return tags;
}

/** Browser only: replace the SEO head entries and the title for the current route. */
export function applySeo(seo) {
  if (typeof document === "undefined" || !seo) return;
  document.title = seo.title;
  document.head.querySelectorAll("[data-seo]").forEach((node) => node.remove());
  for (const entry of seoToTags(seo)) {
    const node = document.createElement(entry.tag);
    if (entry.tag === "script") {
      node.type = "application/ld+json";
      node.textContent = JSON.stringify(entry.json);
    } else {
      for (const [key, value] of Object.entries(entry.attrs)) node.setAttribute(key, value);
    }
    node.setAttribute("data-seo", "");
    document.head.appendChild(node);
  }
}

// Route matching for the SPA (the prerender calls getStaticSeo directly).
export function getRouteSeo(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return getStaticSeo(path);
}
