// eslint-disable tailwindcss/no-custom-classname
function ContactPage() {
  return (
    <section className="animate-fadeIn rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-8 shadow-lg">
      <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight">
        <span>👋</span> Get in Touch!
      </h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Have questions, feedback, or spotted an issue? We'd love to hear from you! 😊
        The KnowYourFaculty team is here to help make your academic journey smoother.
      </p>
      <div className="mt-6 space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 hover:border-[var(--primary)] transition-all">
          <span className="text-2xl">📧</span>
          <div>
            <p className="text-sm font-semibold">Email Us</p>
            <a href="mailto:support@knowyourfaculty.in" className="text-sm text-[var(--primary)] hover:underline">
              support@knowyourfaculty.in
            </a>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 hover:border-[var(--primary)] transition-all">
          <span className="text-2xl">🏫</span>
          <div>
            <p className="text-sm font-semibold">Find Us On Campus</p>
            <p className="text-sm text-[var(--muted)]">VIT-AP University, Amaravati</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 hover:border-[var(--primary)] transition-all">
          <span className="text-2xl">✨</span>
          <div>
            <p className="text-sm font-semibold">Made By Students, For Students</p>
            <p className="text-sm text-[var(--muted)]">Built with ❤️ to help you choose the right courses</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactPage;
