import { Link } from "react-router-dom";
import { aboutFaqs, tierScale } from "../data/siteContent.js";

function AboutPage() {
  return (
    <section className="rounded-xl border border-(--line) bg-(--bg-elev) p-6 sm:p-8">
      <h1 className="text-3xl font-medium text-(--text)">
        About KnowYourFaculty
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-(--muted)">
        KnowYourFaculty is a free, student-run website where VIT-AP students rate
        and review their professors anonymously. Ratings are split into theory,
        lab and ECS (capstone / SDP), so a great lecturer with a harsh lab does
        not average out. It is built and maintained by Venu K.
      </p>

      <h2 className="mt-8 text-xl font-medium text-(--text)">
        The Rod-God to Loose-God scale
      </h2>
      <p className="mt-2 text-sm text-(--muted)">
        Every rating is a score from 1 to 5. A faculty member&apos;s tier is the
        average of all the scores students gave them.
      </p>
      <dl className="mt-4 border-t border-(--line)">
        {tierScale.map((tier) => (
          <div
            key={tier.score}
            className="grid grid-cols-[3rem_1fr] gap-2 border-b border-(--line) py-3 text-sm sm:grid-cols-[3rem_10rem_1fr]"
          >
            <dt className="font-mono text-(--muted)">{tier.score}</dt>
            <dd className="font-medium text-(--text)">{tier.label}</dd>
            <dd className="col-span-2 text-(--muted) sm:col-span-1">
              {tier.meaning}
            </dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 text-xl font-medium text-(--text)">
        Questions and answers
      </h2>
      <div className="mt-4 space-y-6">
        {aboutFaqs.map((item) => (
          <div key={item.q}>
            <h3 className="text-base font-medium text-(--text)">{item.q}</h3>
            <p className="mt-1 text-sm leading-6 text-(--muted)">{item.a}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-(--text)">
        <Link to="/faculty" className="underline-offset-4 hover:underline">
          Browse faculty
        </Link>
        <Link to="/rankings" className="underline-offset-4 hover:underline">
          Rankings
        </Link>
        <Link to="/privacy-policy" className="underline-offset-4 hover:underline">
          Privacy policy
        </Link>
      </p>
    </section>
  );
}

export default AboutPage;
