// eslint-disable tailwindcss/no-custom-classname
import { Link } from "react-router-dom";

function LandingPage() {
  return (
    <div className="space-y-16">
      <section className="hero-surface animate-fadeIn overflow-hidden rounded-3xl border border-[var(--line)] p-8 shadow-xl sm:p-12">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          <span className="animate-pulse">✨</span>
          VIT-AP Faculty Intelligence
        </p>
        <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
          Discover professors who'll make you love learning 📚
        </h1>
        <p className="mt-5 max-w-2xl text-base text-[var(--muted)] sm:text-lg">
          Real feedback from students like you. Find professors who inspire, challenge, and support. 
          No more guesswork—just honest reviews to help you make the best choice for your education.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/faculty" className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl">
            🔍 Explore Faculty
          </Link>
          <Link
            to="/contact"
            className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-6 py-3 text-sm font-semibold hover:border-[var(--primary)]"
          >
            💬 Got Questions?
          </Link>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {[
          {
            emoji: "🎯",
            title: "Find Your Perfect Match",
            text: "Filter by department, course, or top ratings. Discover faculty whose teaching style clicks with how you learn best."
          },
          {
            emoji: "📖",
            title: "Course-Specific Insights",
            text: "See what students say about specific courses. Get the real scoop on workload, grading, and teaching approach."
          },
          {
            emoji: "💯",
            title: "Your Voice Matters",
            text: "Share your experience and help fellow students choose wisely. Update or remove your feedback anytime—you're in control!"
          }
        ].map((item) => (
          <article key={item.title} className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-6 hover:border-[var(--primary)]">
            <div className="mb-3 text-3xl">{item.emoji}</div>
            <h2 className="text-lg font-bold">{item.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{item.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

export default LandingPage;
