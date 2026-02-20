// eslint-disable tailwindcss/no-custom-classname
function PrivacyPage() {
  return (
    <section className="rounded-xl border border-(--line) bg-(--bg-elev) p-6 sm:p-8">
      <h1 className="text-3xl font-black tracking-tight text-(--text)">
        Privacy Policy
      </h1>
      <p className="mt-2 text-xs text-(--muted)">
        Effective date: February 20, 2026
      </p>

      <div className="mt-6 space-y-6 text-sm text-(--muted)">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">1. Overview</h2>
          <p>
            KnowYourFaculty helps students discover faculty insights through
            public, anonymous feedback. We collect only the data needed to run
            the platform safely and reliably.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">
            2. Why login/signup exists
          </h2>
          <p>
            Login/signup is required only to verify legitimate VIT-AP students
            before allowing submissions. Public viewers can read ratings/reviews
            without signing in.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">
            3. What we collect
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Account details returned by authentication provider (for
              verification).
            </li>
            <li>
              Feedback content you submit (ratings, optional review text,
              optional course context).
            </li>
            <li>
              Technical metadata needed for operations and abuse prevention.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">
            4. Public anonymity
          </h2>
          <p>
            Feedback shown on the platform is public but anonymous. We do not
            publicly display your personal identity with your submitted review.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">
            5. Data control and deletion
          </h2>
          <p>
            You can edit or delete your feedback at any time from your
            dashboard. You can also request account deletion; associated user
            content will be removed according to platform deletion flow.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">
            6. Data sharing and sale
          </h2>
          <p>
            We do not sell personal data. Data access is restricted by platform
            permissions and operational controls.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">7. Security</h2>
          <p>
            We apply practical technical safeguards (access control, moderation
            controls, and transport protections) to reduce misuse and
            unauthorized access risk.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">8. FAQs</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-(--line) bg-(--panel) p-3">
              <p className="font-semibold text-(--text)">
                Is feedback submission mandatory after login?
              </p>
              <p className="mt-1">
                No. Login only verifies eligibility. Submission is optional.
              </p>
            </div>
            <div className="rounded-lg border border-(--line) bg-(--panel) p-3">
              <p className="font-semibold text-(--text)">
                Can I submit only some ratings?
              </p>
              <p className="mt-1">
                Yes. Ratings are optional by section and can be updated later.
              </p>
            </div>
            <div className="rounded-lg border border-(--line) bg-(--panel) p-3">
              <p className="font-semibold text-(--text)">
                Can I remove my data completely?
              </p>
              <p className="mt-1">
                Yes. You can delete feedback entries and request account
                deletion from your dashboard.
              </p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

export default PrivacyPage;
