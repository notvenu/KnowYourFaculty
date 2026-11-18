import axios from "axios";
import serverConfig from "../../config/server.js";

function processFacultyData(rawData, baseUrl = "") {
  return rawData.data.map(({ attributes }) => {
    const rawPhotoUrl = attributes.Photo?.data?.attributes?.url || null;
    const photoUrl =
      rawPhotoUrl && rawPhotoUrl.startsWith("/")
        ? `${baseUrl}${rawPhotoUrl}`
        : rawPhotoUrl;
    return {
      name: attributes.Name || null,
      employeeid: attributes.Employee_Id || null,
      designation: attributes.Designation || null,
      department: attributes.Department || null,
      subDepartment: attributes.sub_department || null,
      educationUG: attributes.Education_UG || null,
      educationPG: attributes.Education_PG || null,
      educationPhD: attributes.Education_PHD || null,
      educationOther: attributes.Education_other || null,
      researchArea: attributes.Research_area_of_specialization || null,
      photoUrl,
    };
  });
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety stop; 607 faculty is 7 pages

export async function fetchFacultyProfiles() {
  const baseUrl = "https://cms.vitap.ac.in";

  const endpoint =
    "/api/faculty-profiles" +
    "?fields[0]=Name" +
    "&fields[1]=Employee_Id" +
    "&fields[2]=Designation" +
    "&fields[3]=Department" +
    "&fields[4]=sub_department" +
    "&fields[5]=Education_UG" +
    "&fields[6]=Education_PG" +
    "&fields[7]=Education_PHD" +
    "&fields[8]=Education_other" +
    "&fields[9]=Research_area_of_specialization" +
    "&populate[Photo][fields][0]=url";

  // The CMS (Strapi) paginates, default 500 per page. Without these params only the
  // first page came back and everyone past it was never scraped.
  const rows = [];
  let pageCount = 1;
  for (let page = 1; page <= pageCount && page <= MAX_PAGES; page++) {
    const response = await axios.get(
      `${baseUrl}${endpoint}&pagination[page]=${page}&pagination[pageSize]=${PAGE_SIZE}`,
      {
        headers: { Authorization: `Bearer ${serverConfig.authToken}` },
        timeout: 20000,
      },
    );
    rows.push(...processFacultyData(response.data, baseUrl));
    pageCount = response.data?.meta?.pagination?.pageCount || 1;
  }
  return rows;
}
