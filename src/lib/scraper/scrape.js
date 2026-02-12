import axios from "axios";
import serverConfig from "../../config/server.js";

function processFacultyData(rawData) {
  return rawData.data.map(({ attributes }) => ({
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
    photoUrl: attributes.Photo?.data?.attributes?.url || null
  }));
}

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

  const url = baseUrl + endpoint;

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${serverConfig.authToken}`
    },
    timeout: 20000
  });

  return processFacultyData(response.data);
}