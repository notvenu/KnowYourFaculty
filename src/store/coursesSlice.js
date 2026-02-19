import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import courseService from "../services/courseService.js";

export const fetchAllCourses = createAsyncThunk(
  "courses/fetchAll",
  async (limit = 5000, { rejectWithValue }) => {
    try {
      const courses = await courseService.getAllCourses(limit);
      return courses;
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to load courses");
    }
  },
);

export const searchCourses = createAsyncThunk(
  "courses/search",
  async ({ query, limit = 8 }, { rejectWithValue }) => {
    try {
      const courses = await courseService.searchCourses(query, limit);
      return courses;
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to search courses");
    }
  },
);

const coursesSlice = createSlice({
  name: "courses",
  initialState: {
    list: [],
    searchResults: [],
    courseLookup: {},
    loading: false,
    error: null,
  },
  reducers: {
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchAllCourses
      .addCase(fetchAllCourses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllCourses.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
        // Build lookup
        const lookup = {};
        for (const course of action.payload) {
          if (course?.$id) {
            lookup[course.$id] = course;
          }
        }
        state.courseLookup = lookup;
      })
      .addCase(fetchAllCourses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // searchCourses
      .addCase(searchCourses.pending, (state) => {
        state.loading = true;
      })
      .addCase(searchCourses.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchCourses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearSearchResults, clearError } = coursesSlice.actions;
export default coursesSlice.reducer;
