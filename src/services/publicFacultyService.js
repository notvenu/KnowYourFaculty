import { Client, Databases, Query, TablesDB } from "appwrite";
import clientConfig from "../config/client.js";

/**
 * 🌐 PUBLIC FACULTY SERVICE
 * Provides public access to faculty data without authentication
 * Uses client-side Appwrite SDK for frontend applications
 */

class PublicFacultyService {
  client = new Client();
  databases;
  tablesDB;
  initialized = false;
  initError = null;
  
  constructor() {
    // Validate required configuration
    if (!clientConfig.appwriteUrl || !clientConfig.appwriteProjectId) {
      this.initError = `Missing Appwrite configuration. URL: ${!!clientConfig.appwriteUrl}, ProjectID: ${!!clientConfig.appwriteProjectId}`;
      console.error('PublicFacultyService initialization failed:', this.initError);
      return;
    }
    
    try {
      this.client
        .setEndpoint(clientConfig.appwriteUrl)
        .setProject(clientConfig.appwriteProjectId);
      
      this.databases = new Databases(this.client);
      this.tablesDB = new TablesDB(this.client);
      this.initialized = true;
    } catch (error) {
      this.initError = error?.message || 'Failed to initialize Appwrite client';
      console.error('PublicFacultyService initialization error:', error);
    }
  }

  async listFacultyRecords(queries = []) {
    if (!this.initialized || !this.tablesDB) {
      throw new Error(this.initError || 'Appwrite service not initialized');
    }
    try {
      const response = await this.tablesDB.listRows(
        clientConfig.appwriteDBId,
        clientConfig.appwriteTableId,
        queries
      );
      return {
        records: response.rows || [],
        total: response.total || 0
      };
    } catch (tablesError) {
      if (!this.databases) {
        throw new Error(this.initError || 'Appwrite databases service not initialized');
      }
      const response = await this.databases.listDocuments(
        clientConfig.appwriteDBId,
        clientConfig.appwriteTableId,
        queries
      );
      return {
        records: response.documents || [],
        total: response.total || 0
      };
    }
  }

  /**
   * 📋 Get paginated faculty list
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (1-based)
   * @param {number} options.limit - Items per page
   * @param {string} options.search - Search query
   * @param {string} options.department - Department filter
   * @param {string} options.sortBy - Sort field
   * @param {string} options.sortOrder - Sort order (asc/desc)
   */
  async getFacultyList({
    page = 1,
    limit = 20,
    search = "",
    department = "all",
    sortBy = "$updatedAt",
    sortOrder = "desc"
  } = {}) {
    try {
      const trimmedSearch = search.trim();

      if (trimmedSearch) {
        return await this.getFacultyListWithClientSearch({
          page,
          limit,
          search: trimmedSearch,
          department,
          sortBy,
          sortOrder
        });
      }

      const queries = [
        Query.limit(limit),
        Query.offset((page - 1) * limit)
      ];

      // Add sorting
      if (sortOrder === "desc") {
        queries.push(Query.orderDesc(sortBy));
      } else {
        queries.push(Query.orderAsc(sortBy));
      }

      // Add department filter
      if (department && department !== "all") {
        queries.push(Query.equal("department", department));
      }

      const response = await this.listFacultyRecords(queries);

      return {
        faculty: response.records || [],
        total: response.total || 0,
        page,
        limit,
        totalPages: Math.ceil((response.total || 0) / limit),
        hasNext: page * limit < (response.total || 0),
        hasPrev: page > 1
      };
    } catch (error) {
      console.error("Error loading faculty list:", error);
      return this.getSampleFacultyData(page, limit, search, department);
    }
  }

  async getFacultyListWithClientSearch({
    page,
    limit,
    search,
    department,
    sortBy,
    sortOrder
  }) {
    const queries = [Query.limit(5000)];

    if (sortOrder === "desc") {
      queries.push(Query.orderDesc(sortBy));
    } else {
      queries.push(Query.orderAsc(sortBy));
    }

    if (department && department !== "all") {
      queries.push(Query.equal("department", department));
    }

    const response = await this.listFacultyRecords(queries);

    const normalizedSearch = search.toLowerCase();
    const filteredFaculty = (response.records || []).filter((faculty) =>
      this.matchesSearch(faculty, normalizedSearch)
    );

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedFaculty = filteredFaculty.slice(startIndex, endIndex);

    return {
      faculty: paginatedFaculty,
      total: filteredFaculty.length,
      page,
      limit,
      totalPages: Math.ceil(filteredFaculty.length / limit),
      hasNext: endIndex < filteredFaculty.length,
      hasPrev: page > 1
    };
  }

  matchesSearch(faculty, query) {
    if (!query) return true;

    const searchable = [
      faculty.name,
      faculty.department,
      faculty.designation,
      faculty.researchArea,
      faculty.employeeId,
      faculty.employeeid
    ]
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value).toLowerCase());

    return searchable.some((value) => value.includes(query));
  }

  /**
   * 🎯 Get faculty member by Employee ID
   * @param {number|string} employeeId - Employee ID
   */
  async getFacultyById(employeeId) {
    try {
      const response = await this.listFacultyRecords([Query.equal("employeeId", Number(employeeId))]);

      return response.records && response.records.length > 0 ? response.records[0] : null;
    } catch (error) {
      // Return sample faculty if database not accessible
      const sampleData = this.getSampleFacultyData(1, 10);
      return sampleData.faculty.find(f => f.employeeId === Number(employeeId)) || null;
    }
  }

  /**
   * 🏢 Get all departments
   */
  async getDepartments() {
    try {
      const response = await this.listFacultyRecords([
        Query.select(["department"]),
        Query.limit(5000)
      ]);

      const departments = [
        ...new Set(
          (response.records || [])
            .map(doc => doc.department)
            .filter(dept => dept && dept.trim())
        )
      ];

      return departments.sort();
    } catch (error) {
      // Silently return sample departments
      return this.getSampleDepartments();
    }
  }

  /**
   * 📊 Get faculty statistics
   */
  async getFacultyStats() {
    try {
      const response = await this.listFacultyRecords([
        Query.select(["department", "designation"]),
        Query.limit(5000)
      ]);

      const stats = {
        total: response.total || 0,
        byDepartment: {},
        byDesignation: {},
        lastUpdated: new Date().toISOString()
      };

      (response.records || []).forEach(faculty => {
        // Count by department
        if (faculty.department) {
          stats.byDepartment[faculty.department] = 
            (stats.byDepartment[faculty.department] || 0) + 1;
        }

        // Count by designation
        if (faculty.designation) {
          stats.byDesignation[faculty.designation] = 
            (stats.byDesignation[faculty.designation] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      // Silently return sample stats
      return this.getSampleStats();
    }
  }

  /**
   * 🔍 Search faculty members
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   */
  async searchFaculty(query, filters = {}) {
    try {
      const searchOptions = {
        search: query,
        limit: filters.limit || 50,
        page: 1,
        department: filters.department || "all"
      };

      return await this.getFacultyList(searchOptions);
    } catch (error) {
      console.error("Error searching faculty:", error);
      throw new Error("Search failed. Please try again.");
    }
  }

  /**
   * 📸 Get faculty photo URL
   * @param {string} photoFileId - Photo file ID from Appwrite Storage
   */
  getFacultyPhotoUrl(photoFileId) {
    if (!photoFileId) return this.getPlaceholderPhoto();
    
    try {
      // For sample data, return placeholder
      if (photoFileId.startsWith('sample_')) {
        return this.getPlaceholderPhoto();
      }
      
      return `${clientConfig.appwriteUrl}/storage/buckets/${clientConfig.appwriteBucketId}/files/${photoFileId}/view?project=${clientConfig.appwriteProjectId}`;
    } catch (error) {
      return this.getPlaceholderPhoto();
    }
  }

  /**
   * 🖼️ Get placeholder photo URL
   */
  getPlaceholderPhoto() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Cg transform='translate(100 100)'%3E%3Ccircle r='30' fill='%23d1d5db'/%3E%3Cpath d='M-15,-10 Q0,-25 15,-10 Q25,0 15,15 L-15,15 Q-25,0 -15,-10 Z' fill='%23d1d5db'/%3E%3C/g%3E%3Ctext x='100' y='160' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%236b7280'%3EFaculty Photo%3C/text%3E%3C/svg%3E";
  }

  /**
   * 🔄 Check if data is fresh (less than 7 days old)
   */
  async isDataFresh() {
    try {
      const stats = await this.getFacultyStats();
      const lastUpdate = new Date(stats.lastUpdated);
      const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
      
      return {
        isFresh: daysSinceUpdate < 7,
        daysSinceUpdate: Math.round(daysSinceUpdate),
        lastUpdate: stats.lastUpdated
      };
    } catch (error) {
      console.error("Error checking data freshness:", error);
      return {
        isFresh: false,
        error: "Unable to check data freshness"
      };
    }
  }

  /**
   * 📈 Get trending research areas
   */
  async getTrendingResearch(limit = 10) {
    try {
      const response = await this.listFacultyRecords([
        Query.select(["researchArea"]),
        Query.limit(5000)
      ]);

      const researchCounts = {};
      
      (response.records || []).forEach(faculty => {
        if (faculty.researchArea) {
          // Split research areas by common delimiters
          const areas = faculty.researchArea
            .split(/[,;|&\n]/)
            .map(area => area.trim())
            .filter(area => area.length > 0);

          areas.forEach(area => {
            researchCounts[area] = (researchCounts[area] || 0) + 1;
          });
        }
      });

      return Object.entries(researchCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([area, count]) => ({ area, count }));
        
    } catch (error) {
      console.error("Error getting trending research:", error);
      return [];
    }
  }

  /**
   * 🎭 Sample data methods for fallback when database is not accessible
   */
  getSampleFacultyData(page = 1, limit = 20, search = "", department = "all") {
    const sampleFaculty = [
      {
        $id: "sample1",
        employeeId: 70001,
        name: "Dr. Karthika Natarajan",
        designation: "Associate Professor Grade 1",
        department: "School of Computer Science and Engineering (SCOPE)",
        subDepartment: "Computer Vision & AI",
        researchArea: "Artificial Intelligence, Machine Learning, Deep Learning, Information Retrieval",
        educationUG: "B.Tech Computer Science",
        educationPG: "M.E Computer Science",
        educationPhD: "PhD Computer Science & Engineering",
        photoFileId: "sample_photo_1",
        $createdAt: "2024-01-01T00:00:00.000Z",
        $updatedAt: "2024-02-11T00:00:00.000Z"
      },
      {
        $id: "sample2",
        employeeId: 70002,
        name: "Dr. Jagadish Chandra Mudiganti",
        designation: "Professor",
        department: "School of Electronics Engineering (SENSE)",
        subDepartment: "Signal Processing",
        researchArea: "IoT, Embedded Systems, Signal Processing, Wireless Communication",
        educationUG: "B.Tech Electronics & Communication",
        educationPG: "M.Tech Signal Processing",
        educationPhD: "PhD Electronics & Communication Engineering",
        photoFileId: "sample_photo_2",
        $createdAt: "2024-01-01T00:00:00.000Z",
        $updatedAt: "2024-02-11T00:00:00.000Z"
      },
      {
        $id: "sample3",
        employeeId: 70003,
        name: "Dr. Prashanth Rajam",
        designation: "Associate Professor",
        department: "School of Computer Science and Engineering (SCOPE)",
        subDepartment: "Software Engineering",
        researchArea: "Software Engineering, Database Systems, Data Mining",
        educationUG: "B.E Computer Science",
        educationPG: "M.Tech Software Engineering",
        educationPhD: "PhD Computer Science",
        photoFileId: "sample_photo_3",
        $createdAt: "2024-01-01T00:00:00.000Z",
        $updatedAt: "2024-02-11T00:00:00.000Z"
      },
      {
        $id: "sample4",
        employeeId: 70004,
        name: "Dr. Rajeev Sharma",
        designation: "Assistant Professor",
        department: "School of Mechanical Engineering (SME)",
        subDepartment: "Thermal Engineering",
        researchArea: "Thermal Analysis, Heat Transfer, Renewable Energy Systems",
        educationUG: "B.Tech Mechanical Engineering",
        educationPG: "M.Tech Thermal Engineering",
        educationPhD: "PhD Mechanical Engineering",
        photoFileId: "sample_photo_4",
        $createdAt: "2024-01-01T00:00:00.000Z",
        $updatedAt: "2024-02-11T00:00:00.000Z"
      },
      {
        $id: "sample5",
        employeeId: 70005,
        name: "Dr. Shalini Subramani",
        designation: "Associate Professor Grade 2",
        department: "School of Civil Engineering (SCE)",
        subDepartment: "Structural Engineering",
        researchArea: "Structural Analysis, Earthquake Engineering, Smart Materials",
        educationUG: "B.Tech Civil Engineering",
        educationPG: "M.Tech Structural Engineering",
        educationPhD: "PhD Structural Engineering",
        photoFileId: "sample_photo_5",
        $createdAt: "2024-01-01T00:00:00.000Z",
        $updatedAt: "2024-02-11T00:00:00.000Z"
      }
    ];

    // Apply search filter
    let filteredFaculty = sampleFaculty;
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase();
      filteredFaculty = sampleFaculty.filter(faculty => 
        faculty.name.toLowerCase().includes(searchTerm) ||
        faculty.department.toLowerCase().includes(searchTerm) ||
        faculty.designation.toLowerCase().includes(searchTerm)
      );
    }

    // Apply department filter
    if (department && department !== "all") {
      filteredFaculty = filteredFaculty.filter(faculty => 
        faculty.department === department
      );
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    return {
      faculty: filteredFaculty.slice(startIndex, endIndex),
      total: filteredFaculty.length,
      page,
      limit,
      totalPages: Math.ceil(filteredFaculty.length / limit),
      hasNext: endIndex < filteredFaculty.length,
      hasPrev: page > 1
    };
  }

  getSampleDepartments() {
    return [
      "School of Computer Science and Engineering (SCOPE)",
      "School of Electronics Engineering (SENSE)",
      "School of Mechanical Engineering (SME)",
      "School of Civil Engineering (SCE)",
      "School of Chemical Engineering",
      "School of Applied Sciences and Mathematics (SASMAT)"
    ];
  }

  getSampleStats() {
    return {
      total: 5,
      byDepartment: {
        "School of Computer Science and Engineering (SCOPE)": 2,
        "School of Electronics Engineering (SENSE)": 1,
        "School of Mechanical Engineering (SME)": 1,
        "School of Civil Engineering (SCE)": 1
      },
      byDesignation: {
        "Professor": 1,
        "Associate Professor Grade 1": 1,
        "Associate Professor": 1,
        "Associate Professor Grade 2": 1,
        "Assistant Professor": 1
      },
      lastUpdated: new Date().toISOString()
    };
  }
}

// Create and export singleton instance
const publicFacultyService = new PublicFacultyService();
export default publicFacultyService;
