// eslint-disable tailwindcss/no-custom-classname
function TermsPage() {
  return (
    <section className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-8">
      <h1 className="text-3xl font-black tracking-tight">Terms and Conditions</h1>
      <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
        <p>Use this platform for academic feedback and faculty discovery purposes only.</p>
        <p>Users are responsible for respectful and accurate feedback submissions.</p>
        <p>Administrators may moderate or remove content that violates institutional policies.</p>
      </div>
    </section>
  );
}

export default TermsPage;
