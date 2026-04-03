import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

/**
 * Authentication Store (Zustand)
 *
 * Manages all auth-related state and actions:
 * - `authUser`       → The currently authenticated user object, or null
 * - `isSigningUp`    → Loading flag while the signup request is in-flight
 * - `isLoggingIn`    → Loading flag while the login request is in-flight
 * - `isCheckingAuth` → Loading flag while verifying an existing session on app load
 */
export const useAuthStore = create((set) => ({
  // ─── State ──────────────────────────────────────────────
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isCheckingAuth: false,

  // ─── Actions ────────────────────────────────────────────

  /**
   * checkAuth
   * Called once on app mount (in App.jsx) to verify if the user
   * has a valid JWT cookie from a previous session.
   * Sets `authUser` if the token is valid, otherwise clears it.
   */
  checkAuth: async () => {
    set({ isCheckingAuth: true });
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data.user });
    } catch (error) {
      // Token missing, expired, or invalid — user is not authenticated
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  /**
   * signup
   * Registers a new user account with name, email, and password.
   *
   * @param {Object} data - The registration form data
   * @param {string} data.name     - User's display name
   * @param {string} data.email    - User's email address
   * @param {string} data.password - User's chosen password
   */
  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/register", data);

      // On success, the backend returns the user object and sets a JWT cookie
      set({ authUser: res.data.user });
      toast.success(res.data.message || "Account created successfully!");
    } catch (error) {
      // Extract the error message from the API response, or use a fallback
      const errorMessage =
        error.response?.data?.error || "Error signing up. Please try again.";
      toast.error(errorMessage);
    } finally {
      set({ isSigningUp: false });
    }
  },

  /**
   * login
   * Authenticates an existing user with email and password.
   *
   * @param {Object} data - The login form data
   * @param {string} data.email    - User's email address
   * @param {string} data.password - User's password
   */
  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);

      // On success, the backend returns the user object and sets a JWT cookie
      set({ authUser: res.data.user });
      toast.success(res.data.message || "Logged in successfully!");
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Error logging in. Please try again.";
      toast.error(errorMessage);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  /**
   * logout
   * Clears the JWT cookie on the server and resets local auth state.
   */
  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Error logging out. Please try again.";
      toast.error(errorMessage);
    }
  },
}));