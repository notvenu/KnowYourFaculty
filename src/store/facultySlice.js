import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import publicFacultyService from "../services/publicFacultyService.js";

export const fetchFacultyList = createAsyncThunk(
  "faculty/fetchList",
  async ({ limit = 5000, page = 1 }, { rejectWithValue }) => {
    try {
      const response = await publicFacultyService.getFacultyList({
        limit,
        page,
      });
      return response.faculty || [];
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to load faculty list");
    }
  },
);

export const fetchFacultyById = createAsyncThunk(
  "faculty/fetchById",
  async (facultyId, { rejectWithValue }) => {
    try {
      const faculty = await publicFacultyService.getFacultyById(facultyId);
      return faculty;
    } catch (error) {
      return rejectWithValue(
        error?.message || "Failed to load faculty details",
      );
    }
  },
);

const facultySlice = createSlice({
  name: "faculty",
  initialState: {
    list: [],
    currentFaculty: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearCurrentFaculty: (state) => {
      state.currentFaculty = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchFacultyList
      .addCase(fetchFacultyList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFacultyList.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchFacultyList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchFacultyById
      .addCase(fetchFacultyById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFacultyById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentFaculty = action.payload;
      })
      .addCase(fetchFacultyById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearCurrentFaculty, clearError } = facultySlice.actions;
export default facultySlice.reducer;
