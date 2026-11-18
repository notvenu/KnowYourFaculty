import { useState, useEffect } from "react";
import publicFacultyService from "../../services/publicFacultyService.js";

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
    checking:
      "border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,var(--panel))] text-(--accent-text)",
    connected: "border-(--success)/40 bg-(--success-light) text-(--success)",
    permissions: "border-(--warning)/40 bg-(--warning-light) text-(--warning)",
    error: "border-(--danger)/40 bg-(--danger-light) text-(--danger)",
  };

  const statusContent = {
    checking: (
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--primary) border-t-transparent" />
        <h3 className="text-lg font-medium">Checking database connection…</h3>
      </div>
    ),
    connected: (
      <>
        <h3 className="text-lg font-medium text-(--success)">
          Database connected
        </h3>
        <p className="mt-2 text-sm text-(--success)">
          Found {facultyData?.total ?? 0} faculty. You can use the directory
          now.
        </p>
      </>
    ),
    permissions: (
      <>
        <h3 className="text-lg font-medium text-(--warning)">
          Permissions needed
        </h3>
        <div className="mt-4 space-y-4 text-sm text-(--warning)">
          <p className="font-medium">
            The database is reachable but public read access must be set.
          </p>
          <div className="rounded-xl border border-(--warning)/40 bg-(--bg-elev) p-4">
            <h4 className="mb-2 font-medium">Steps</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open Appwrite Console</li>
              <li>Databases → your DB → faculty_profiles</li>
              <li>Settings → Permissions</li>
              <li>
                Add: Role <code className="rounded bg-(--warning-light) px-1">Any</code>{" "}
                with <code className="rounded bg-(--warning-light) px-1">Read</code>
              </li>
              <li>Save and refresh this page</li>
            </ol>
          </div>
        </div>
      </>
    ),
    error: (
      <>
        <h3 className="text-lg font-medium text-(--danger)">Connection error</h3>
        <p className="mt-2 text-sm font-medium">{errorDetails?.message}</p>
        <div className="mt-4 rounded-xl border border-(--danger)/40 bg-(--bg-elev) p-4 text-sm">
          <h4 className="mb-2 font-medium">Check</h4>
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
    <div className="min-h-screen bg-(--bg) py-10 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-medium text-(--text)">
          KnowYourFaculty – Setup
        </h1>
        <p className="mt-2 text-sm text-(--muted)">
          Checking database connection and access…
        </p>
      </div>

      <div className={`border p-6 ${statusStyles[connectionStatus]}`}>
        {statusContent[connectionStatus]}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={checkConnection}
          className="rounded-xl bg-(--primary) px-6 py-2.5 text-sm font-medium text-white"
        >
          Recheck connection
        </button>
        {connectionStatus === "connected" && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-(--line) bg-(--panel) px-6 py-2.5 text-sm font-medium text-(--text)"
          >
            Launch directory
          </button>
        )}
      </div>

      {connectionStatus === "permissions" && (
        <div className="mt-8 p-6 border-t border-(--line)">
          <h3 className="text-lg font-medium text-(--text)">
            Sample preview
          </h3>
          <p className="mt-1 text-sm text-(--muted)">
            Faculty cards will look like this once permissions are set.
          </p>
          <SampleFacultyPreview />
        </div>
      )}

      <div className="mt-8 p-6 border-t border-(--line)">
        <h3 className="text-lg font-medium text-(--text)">
          System info
        </h3>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <span className="font-medium text-(--text)">
              Scraper
            </span>
            <p className="text-(--muted)">
              Runs weekly (e.g. Sunday 1:00 AM)
            </p>
          </div>
          <div>
            <span className="font-medium text-(--text)">
              Access
            </span>
            <p className="text-(--muted)">
              Public read once permissions are set
            </p>
          </div>
          <div>
            <span className="font-medium text-(--text)">
              Features
            </span>
            <p className="text-(--muted)">
              Search, filter, feedback, analytics
            </p>
          </div>
          <div>
            <span className="font-medium text-(--text)">
              Security
            </span>
            <p className="text-(--muted)">
              Read-only public faculty data
            </p>
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
          className="rounded-xl border border-(--line) bg-(--panel) p-4"
        >
          <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-(--panel) text-sm text-(--muted)">
            Photo
          </div>
          <h4 className="font-medium text-(--text)">
            {faculty.name}
          </h4>
          <p className="text-sm text-(--muted)">
            {faculty.designation}
          </p>
          <p className="text-sm font-medium text-(--accent-text)">
            {faculty.department}
          </p>
          <p className="mt-1 text-xs text-(--muted)">
            {faculty.researchArea}
          </p>
        </div>
      ))}
    </div>
  );
}

export default SetupHelper;
