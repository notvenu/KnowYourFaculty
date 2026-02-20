// eslint-disable tailwindcss/no-custom-classname
function TermsPage() {
  return (
    <section className="rounded-xl border border-(--line) bg-(--bg-elev) p-6 sm:p-8">
      <h1 className="text-3xl font-black tracking-tight text-(--text)">
        Terms and Conditions
      </h1>
      <p className="mt-2 text-xs text-(--muted)">
        Effective date: February 20, 2026
      </p>

      <div className="mt-6 space-y-6 text-sm text-(--muted)">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">1. Purpose</h2>
          <p>
            This platform is provided for academic feedback and informed faculty
            discovery by students.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">
            2. Eligibility and verification
          </h2>
          <p>
            Login/signup is only to verify legitimate VIT-AP student accounts
            before posting. Viewing public ratings/reviews does not require
            sign-in.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">
            3. Anonymous public content
          </h2>
          <p>
            Submitted feedback may be publicly visible in anonymous form to help
            other students.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">
            4. User responsibilities
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Share honest and respectful academic feedback.</li>
            <li>Avoid abusive, defamatory, or discriminatory content.</li>
            <li>Do not impersonate others or submit misleading information.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">
            5. Optional ratings and edits
          </h2>
          <p>
            Ratings are optional by section (Theory/Lab/ECS). You can update or
            delete your submissions at any time from your dashboard.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">6. Moderation</h2>
          <p>
            Administrators may moderate or remove content that violates these
            terms, community standards, or applicable institutional policies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">
            7. Service availability
          </h2>
          <p>
            We strive for reliable service but do not guarantee uninterrupted
            availability at all times.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-(--text)">8. FAQs</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-(--line) bg-(--panel) p-3">
              <p className="font-semibold text-(--text)">
                Can guests view ratings and reviews?
              </p>
              <p className="mt-1">
                Yes. Public content is available without login.
              </p>
            </div>
            <div className="rounded-lg border border-(--line) bg-(--panel) p-3">
              <p className="font-semibold text-(--text)">
                Why is sign-in required then?
              </p>
              <p className="mt-1">
                Only for student verification and safer submissions.
              </p>
            </div>
            <div className="rounded-lg border border-(--line) bg-(--panel) p-3">
              <p className="font-semibold text-(--text)">
                Can I remove my feedback later?
              </p>
              <p className="mt-1">
                Yes, edits and deletions are supported from your dashboard.
              </p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

export default TermsPage;
