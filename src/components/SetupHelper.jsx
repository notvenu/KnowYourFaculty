import { useState, useEffect } from "react";
import publicFacultyService from "../services/publicFacultyService.js";

function SetupHelper() {
  const [connectionStatus, setConnectionStatus] = useState("checking");
  const [facultyData, setFacultyData] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);

  const checkConnection = async () => {
    try {
      setConnectionStatus("checking");
      const data = await publicFacultyService.getFacultyList({ limit: 5 });
      setFacultyData(data);
      setConnectionStatus("connected");
    } catch (error) {
      setErrorDetails(error);
      if (error.message?.includes("not authorized") || error.code === 401) {
        setConnectionStatus("permissions");
      } else {
        setConnectionStatus("error");
      }
    }
  };

  useEffect(() => {
    const id = setTimeout(() => checkConnection(), 0);
    return () => clearTimeout(id);
  }, []);

  const statusStyles = {
    checking: "border-[var(--primary)]/50 bg-[color-mix(in_srgb,var(--primary)_12%,var(--panel))] text-[var(--primary)]",
    connected: "border-emerald-400/50 bg-emerald-500/10 text-emerald-700",
    permissions: "border-amber-400/50 bg-amber-500/10 text-amber-800",
    error: "border-red-400/50 bg-red-500/10 text-red-700",
  };

  const statusContent = {
    checking: (
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        <h3 className="text-lg font-semibold">Checking database connection…</h3>
      </div>
    ),
    connected: (
      <>
        <h3 className="text-lg font-semibold text-emerald-800">Database connected</h3>
        <p className="mt-2 text-sm text-emerald-700">
          Found {facultyData?.total ?? 0} faculty. You can use the directory now.
        </p>
      </>
    ),
    permissions: (
      <>
        <h3 className="text-lg font-semibold text-amber-800">Permissions needed</h3>
        <div className="mt-4 space-y-4 text-sm text-amber-800">
          <p className="font-medium">The database is reachable but public read access must be set.</p>
          <div className="rounded-xl border border-amber-300/50 bg-white/80 p-4">
            <h4 className="mb-2 font-semibold">Steps</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open Appwrite Console</li>
              <li>Databases → your DB → faculty_profiles</li>
              <li>Settings → Permissions</li>
              <li>Add: Role <code className="rounded bg-amber-100 px-1">Any</code> with <code className="rounded bg-amber-100 px-1">Read</code></li>
              <li>Save and refresh this page</li>
            </ol>
          </div>
        </div>
      </>
    ),
    error: (
      <>
        <h3 className="text-lg font-semibold text-red-800">Connection error</h3>
        <p className="mt-2 text-sm font-medium">{errorDetails?.message}</p>
        <div className="mt-4 rounded-xl border border-red-300/50 bg-white/80 p-4 text-sm">
          <h4 className="mb-2 font-semibold">Check</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>Correct VITE_* in .env</li>
            <li>Appwrite project and database IDs</li>
            <li>Collection name &quot;faculty_profiles&quot;</li>
          </ul>
        </div>
      </>
    ),
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] py-10 px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)]">
            KnowYourFaculty – Setup
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Checking database connection and access…
          </p>
        </div>

        <div
          className={`border p-6 ${statusStyles[connectionStatus]}`}
        >
          {statusContent[connectionStatus]}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={checkConnection}
            className="rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-md"
          >
            Recheck connection
          </button>
          {connectionStatus === "connected" && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-6 py-2.5 text-sm font-semibold text-[var(--text)]"
            >
              Launch directory
            </button>
          )}
        </div>

        {connectionStatus === "permissions" && (
          <div className="mt-8 p-6 border-t border-[var(--line)]">
            <h3 className="text-lg font-bold text-[var(--text)]">Sample preview</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Faculty cards will look like this once permissions are set.
            </p>
            <SampleFacultyPreview />
          </div>
        )}

        <div className="mt-8 p-6 border-t border-[var(--line)]">
          <h3 className="text-lg font-bold text-[var(--text)]">System info</h3>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="font-semibold text-[var(--text)]">Scraper</span>
              <p className="text-[var(--muted)]">Runs weekly (e.g. Sunday 1:00 AM)</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text)]">Access</span>
              <p className="text-[var(--muted)]">Public read once permissions are set</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text)]">Features</span>
              <p className="text-[var(--muted)]">Search, filter, feedback, analytics</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text)]">Security</span>
              <p className="text-[var(--muted)]">Read-only public faculty data</p>
            </div>
          </div>
        </div>
    </div>
  );
}

function SampleFacultyPreview() {
  const sampleData = [
    {
      name: "Dr. Karthika Natarajan",
      designation: "Associate Professor",
      department: "SCOPE",
      researchArea: "AI, ML, Deep Learning",
    },
    {
      name: "Dr. Jagadish Chandra Mudiganti",
      designation: "Professor",
      department: "SENSE",
      researchArea: "IoT, Embedded Systems",
    },
  ];

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {sampleData.map((faculty, index) => (
        <div
          key={index}
          className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4"
        >
          <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-[var(--line)]/50 text-sm text-[var(--muted)]">
            Photo
          </div>
          <h4 className="font-semibold text-[var(--text)]">{faculty.name}</h4>
          <p className="text-sm text-[var(--muted)]">{faculty.designation}</p>
          <p className="text-sm font-medium text-[var(--primary)]">{faculty.department}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{faculty.researchArea}</p>
        </div>
      ))}
    </div>
  );
}

export default SetupHelper;
