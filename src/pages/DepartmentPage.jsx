import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import publicFacultyService from "../services/publicFacultyService.js";
import {
  applySeo,
  departmentSeo,
  departmentSlug,
  facultyPath,
} from "../lib/seo.js";

function DepartmentPage() {
  const { slug } = useParams();
  // `slug` in the state marks which department the data belongs to; a mismatch means still loading.
  const [data, setData] = useState({ slug: null, name: "", faculty: [] });
  const state = { ...data, loading: data.slug !== slug };

  useEffect(() => {
    let active = true;
    publicFacultyService
      .getFacultyList({ limit: 5000, page: 1, sortBy: "name", sortOrder: "asc" })
      .then(({ faculty }) => {
        if (!active) return;
        const members = faculty.filter(
          (row) => row.department && departmentSlug(row.department) === slug,
        );
        const name = members[0]?.department || "";
        setData({ slug, name, faculty: members });
        applySeo(
          name
            ? departmentSeo(name, members)
            : {
                title: "Department not found | KnowYourFaculty",
                description: "This department does not exist.",
                path: `/departments/${slug}`,
                noindex: true,
              },
        );
      })
      .catch(() => active && setData({ slug, name: "", faculty: [] }));
    return () => {
      active = false;
    };
  }, [slug]);

  if (state.loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-(--panel)" />;
  }
  if (!state.name) {
    return (
      <section className="py-10">
        <h1 className="text-3xl font-medium text-(--text)">Department not found</h1>
        <Link to="/faculty" className="mt-4 inline-block text-sm underline">
          Browse all faculty
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium text-(--text)">
          {state.name} faculty at VIT-AP
        </h1>
        <p className="mt-2 text-sm text-(--muted)">
          Anonymous student ratings for {state.faculty.length} faculty, with
          separate theory, lab and ECS scores. Open a profile for the full
          breakdown.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.faculty.map((row) => (
          <li key={row.employeeId}>
            <Link
              to={facultyPath(row)}
              className="block rounded-xl border border-(--line) bg-(--bg-elev) p-4 hover:border-(--muted)"
            >
              <span className="block font-medium text-(--text)">{row.name}</span>
              <span className="block text-sm text-(--muted)">{row.designation}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/faculty" className="inline-block text-sm font-medium underline-offset-4 hover:underline">
        All VIT-AP faculty
      </Link>
    </section>
  );
}

export default DepartmentPage;
