// eslint-disable tailwindcss/no-custom-classname
import { Link } from "react-router-dom";

function LandingPage() {
  const features = [
    {
      icon: "01",
      title: "Find Your Perfect Match",
      text: "Filter by department, course, or top ratings. Discover faculty whose teaching style clicks with how you learn best.",
    },
    {
      icon: "02",
      title: "Course-Specific Insights",
      text: "See what students say about specific courses. Get the real scoop on workload, grading, and teaching approach.",
    },
    {
      icon: "03",
      title: "Your Voice Matters",
      text: "Share your experience and help fellow students choose wisely. Update or remove your feedback anytime—you're in control!",
    },
  ];

  return (
    <div>
      {/* Hero - Full Screen */}
      <section className="animate-fadeIn min-h-screen flex items-center justify-center px-4 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-(--text) sm:text-5xl md:text-6xl">
            Discover professors who&apos;ll make you love learning
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-base leading-relaxed text-(--muted) sm:text-lg">
            Real feedback from students like you. Find professors who inspire,
            challenge, and support. No more guesswork—just honest reviews to
            help you choose.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/faculty"
              className="inline-flex items-center gap-2 rounded-full bg-(--primary) px-7 py-3.5 text-sm font-semibold text-white shadow-(--shadow) transition hover:shadow-(--shadow-hover)"
            >
              Explore Faculty
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-(--text) sm:text-3xl">
            Why use KnowYourFaculty?
          </h2>
          <div className="grid gap-6 md:grid-cols-3 stagger-children">
            {features.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-(--line) bg-(--bg-elev) p-6 transition-all hover:border-(--primary)/50 sm:p-8"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-(--primary-soft) text-lg font-bold text-(--primary)">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-(--text) sm:text-xl">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-(--muted)">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border border-(--line) bg-(--panel) p-8 text-center sm:p-12">
            <p className="text-base font-medium text-(--muted) sm:text-lg">
              By students, for students.
            </p>
            <Link
              to="/faculty"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-(--primary) px-7 py-3.5 text-sm font-semibold text-white shadow-(--shadow) transition hover:shadow-(--shadow-hover)"
            >
              Browse faculty
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;

