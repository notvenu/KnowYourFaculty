// Copy shared by the React pages, the build-time prerender and the JSON-LD, so all three always agree.

export const features = [
  {
    title: "Rated by section",
    text: "Theory, lab and ECS are scored separately, so a strong lecturer with a harsh lab does not average out.",
  },
  {
    title: "Search by course",
    text: "Filter by department, course or top rating, then read what students say about workload, grading and teaching style.",
  },
  {
    title: "Yours to edit",
    text: "Every section is optional. Change or delete your feedback from your dashboard whenever you like.",
  },
];

export const trust = [
  {
    title: "Student verification",
    text: "Only verified VIT-AP student accounts can post feedback.",
  },
  {
    title: "Public but anonymous",
    text: "Ratings and reviews are visible to everyone. Identities are never shown.",
  },
  {
    title: "Full data control",
    text: "Update or delete your feedback anytime, or request account deletion.",
  },
];

export const faqs = [
  {
    q: "Do I need to sign in to view data?",
    a: "No. Faculty ratings and reviews are public. Sign in is only required to verify VIT-AP students before they submit feedback.",
  },
  {
    q: "Is feedback anonymous?",
    a: "Yes. Public feedback is anonymous. Your account is used only for verification, moderation and letting you edit or delete your own entries.",
  },
  {
    q: "Are all rating sections mandatory?",
    a: "No. Submit only the parts you experienced: Theory, Lab or ECS.",
  },
  {
    q: "Can I remove my data later?",
    a: "Yes. Edit or delete your feedback from your dashboard, or request account deletion.",
  },
];

// Extra answers used on /about and in FAQPage markup (the questions students actually search).
export const aboutFaqs = [
  ...faqs,
  {
    q: "What is KnowYourFaculty?",
    a: "KnowYourFaculty is a free, student-run website where VIT-AP students rate and review their professors anonymously, split into theory, lab and ECS (capstone / SDP), so you can compare faculty before course registration.",
  },
  {
    q: "How does the Rod-God to Loose-God scale work?",
    a: "Every rating is a score from 1 to 5. 1 is Rod-God (the strictest), 2 is Rod, 3 is Moderate, 4 is Loose and 5 is Loose-God (the most lenient). A faculty member's tier is the average of all the scores students gave them.",
  },
  {
    q: "Who can post reviews on KnowYourFaculty?",
    a: "Only verified VIT-AP student accounts can post. Anyone can read the ratings without signing in, and reviewer identities are never shown.",
  },
  {
    q: "How are faculty ratings calculated?",
    a: "Each rated field (teaching, attendance strictness, class quality, correction fairness, lab support, lab correction, lab attendance and ECS review and marking) is averaged across all student ratings. The theory, lab and ECS scores are averages of their own fields, and the overall score is the average of every rated field.",
  },
  {
    q: "How do I find the strictest or most lenient professor at VIT-AP?",
    a: "Open the Faculty Rankings page to see faculty ordered by their overall student rating, or open any faculty profile to see the separate theory, lab and ECS scores.",
  },
];

export const tierScale = [
  { score: 1, label: "Rod-God", meaning: "the strictest" },
  { score: 2, label: "Rod", meaning: "strict" },
  { score: 3, label: "Moderate", meaning: "balanced" },
  { score: 4, label: "Loose", meaning: "lenient" },
  { score: 5, label: "Loose-God", meaning: "the most lenient" },
];

export const SITE_NAME = "KnowYourFaculty";
export const INSTITUTION = "VIT-AP";
