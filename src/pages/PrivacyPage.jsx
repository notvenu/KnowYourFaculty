// eslint-disable tailwindcss/no-custom-classname
function PrivacyPage() {
  return (
    <section className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-8">
      <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
      <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
        <p>We store only essential account and feedback data required to operate the platform.</p>
        <p>Your feedback is linked to your account for edit/delete controls and abuse prevention.</p>
        <p>We do not sell user data. Access is controlled through Appwrite permissions and project policies.</p>
      </div>
    </section>
  );
}

export default PrivacyPage;
