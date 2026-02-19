import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import facultyFeedbackService from "../services/facultyFeedbackService.js";

export const fetchFacultyFeedback = createAsyncThunk(
  "feedback/fetchFacultyFeedback",
  async (facultyId, { rejectWithValue }) => {
    try {
      const feedbackData =
        await facultyFeedbackService.getFacultyFeedback(facultyId);
      return { facultyId, ...feedbackData };
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to load feedback");
    }
  },
);

export const fetchAllRatings = createAsyncThunk(
  "feedback/fetchAllRatings",
  async (limit = 10000, { rejectWithValue }) => {
    try {
      const ratings = await facultyFeedbackService.getAllRatings(limit);
      return ratings;
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to load ratings");
    }
  },
);

export const submitFeedback = createAsyncThunk(
  "feedback/submit",
  async (feedbackData, { rejectWithValue }) => {
    try {
      const result = await facultyFeedbackService.submitFeedback(feedbackData);
      return result;
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to submit feedback");
    }
  },
);

export const deleteFeedback = createAsyncThunk(
  "feedback/delete",
  async (feedbackId, { rejectWithValue }) => {
    try {
      await facultyFeedbackService.deleteRow(feedbackId);
      return feedbackId;
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to delete feedback");
    }
  },
);

const feedbackSlice = createSlice({
  name: "feedback",
  initialState: {
    feedbackByFaculty: {},
    allRatings: [],
    loading: false,
    submitting: false,
    deleting: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearFeedbackForFaculty: (state, action) => {
      delete state.feedbackByFaculty[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchFacultyFeedback
      .addCase(fetchFacultyFeedback.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFacultyFeedback.fulfilled, (state, action) => {
        state.loading = false;
        const { facultyId, reviews, ratings, ratingSummary } = action.payload;
        state.feedbackByFaculty[facultyId] = {
          reviews,
          ratings,
          ratingSummary,
        };
      })
      .addCase(fetchFacultyFeedback.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchAllRatings
      .addCase(fetchAllRatings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllRatings.fulfilled, (state, action) => {
        state.loading = false;
        state.allRatings = action.payload;
      })
      .addCase(fetchAllRatings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // submitFeedback
      .addCase(submitFeedback.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(submitFeedback.fulfilled, (state) => {
        state.submitting = false;
      })
      .addCase(submitFeedback.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload;
      })
      // deleteFeedback
      .addCase(deleteFeedback.pending, (state) => {
        state.deleting = true;
        state.error = null;
      })
      .addCase(deleteFeedback.fulfilled, (state) => {
        state.deleting = false;
      })
      .addCase(deleteFeedback.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearFeedbackForFaculty } = feedbackSlice.actions;
export default feedbackSlice.reducer;
