import React, { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useSubmissionStore } from "../store/useSubmissionStore";
import { usePlaylistStore } from "../store/usePlaylistStore";
import { useProblemStore } from "../store/useProblemStore";
import {
  User,
  Mail,
  Calendar,
  Shield,
  Code,
  CheckCircle,
  BookOpen,
  Trophy,
  Edit,
  Camera,
  Save,
  X,
  Loader,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

/**
 * Profile Page
 *
 * Key fix: Previously this page showed HARDCODED mock data for
 * Recent Submissions ("Two Sum"), Playlists ("Array Problems"),
 * and all stats. Now it fetches real data from the API on mount
 * using existing Zustand stores.
 */
const Profile = () => {
  const { authUser } = useAuthStore();
  const {
    submissions,
    getAllSubmissions,
    isLoading: isSubmissionsLoading,
  } = useSubmissionStore();
  const {
    playlists,
    getAllPlaylists,
    isLoading: isPlaylistsLoading,
  } = usePlaylistStore();
  const {
    solvedProblems,
    getSolvedProblemByUser,
  } = useProblemStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    image: "",
  });

  // ─── Fetch real data on mount ──────────────────────────────────────
  useEffect(() => {
    getAllSubmissions();
    getAllPlaylists();
    getSolvedProblemByUser();
  }, [getAllSubmissions, getAllPlaylists, getSolvedProblemByUser]);

  useEffect(() => {
    if (authUser) {
      setEditForm({
        name: authUser.name || "",
        email: authUser.email || "",
        image: authUser.image || "",
      });
    }
  }, [authUser]);

  // ─── Compute stats from real data ─────────────────────────────────
  const stats = {
    solvedProblems: solvedProblems?.length || 0,
    totalSubmissions: submissions?.length || 0,
    playlists: playlists?.length || 0,
    successRate:
      submissions?.length > 0
        ? Math.round(
            (submissions.filter((s) => s.status === "Accepted").length /
              submissions.length) *
              100
          )
        : 0,
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      setEditForm({
        name: authUser.name || "",
        email: authUser.email || "",
        image: authUser.image || "",
      });
    }
  };

  const handleSave = () => {
    // TODO: Implement API call to update user profile
    console.log("Saving profile:", editForm);
    setIsEditing(false);
  };

  const getRoleBadge = (role) => {
    return role === "ADMIN" ? "badge-error" : "badge-primary";
  };

  /**
   * Returns a human-readable relative time string like "2 hours ago".
   * Falls back to the formatted date if the submission is older than 7 days.
   */
  const getTimeAgo = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      return format(date, "MMM d, yyyy");
    } catch {
      return "Unknown";
    }
  };

  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="mt-4 text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header Card */}
        <div className="card bg-base-200 shadow-xl mb-8">
          <div className="card-body">
            <div className="flex flex-col lg:flex-row items-center gap-6">
              {/* Profile Image */}
              <div className="relative">
                <div className="avatar">
                  <div className="w-32 h-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                    <img
                      src={
                        isEditing
                          ? editForm.image
                          : authUser.image ||
                            "https://avatar.iran.liara.run/public/boy"
                      }
                      alt="Profile"
                      className="object-cover"
                    />
                  </div>
                </div>
                {isEditing && (
                  <button className="btn btn-circle btn-sm btn-primary absolute -bottom-2 -right-2">
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 text-center lg:text-left">
                {isEditing ? (
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Name"
                      className="input input-bordered w-full max-w-md"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      className="input input-bordered w-full max-w-md"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                    />
                    <input
                      type="url"
                      placeholder="Profile Image URL"
                      className="input input-bordered w-full max-w-md"
                      value={editForm.image}
                      onChange={(e) =>
                        setEditForm({ ...editForm, image: e.target.value })
                      }
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-3xl font-bold mb-2">
                      {authUser.name || "Anonymous User"}
                    </h1>
                    <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span>{authUser.email}</span>
                      </div>
                      <div
                        className={`badge ${getRoleBadge(authUser.role)} gap-2`}
                      >
                        <Shield className="w-3 h-3" />
                        {authUser.role}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 justify-center lg:justify-start">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Member since{" "}
                        {authUser.createdAt
                          ? format(new Date(authUser.createdAt), "MMMM yyyy")
                          : "N/A"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Edit Controls */}
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="btn btn-success gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={handleEditToggle}
                      className="btn btn-outline gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleEditToggle}
                    className="btn btn-primary gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="stat bg-base-200 rounded-xl shadow-lg">
            <div className="stat-figure text-success">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="stat-title">Problems Solved</div>
            <div className="stat-value text-success">
              {stats.solvedProblems}
            </div>
            <div className="stat-desc">Successfully completed</div>
          </div>

          <div className="stat bg-base-200 rounded-xl shadow-lg">
            <div className="stat-figure text-info">
              <Trophy className="w-8 h-8" />
            </div>
            <div className="stat-title">Submissions</div>
            <div className="stat-value text-info">{stats.totalSubmissions}</div>
            <div className="stat-desc">Total attempts made</div>
          </div>

          <div className="stat bg-base-200 rounded-xl shadow-lg">
            <div className="stat-figure text-warning">
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="stat-title">Playlists</div>
            <div className="stat-value text-warning">{stats.playlists}</div>
            <div className="stat-desc">Collections created</div>
          </div>

          <div className="stat bg-base-200 rounded-xl shadow-lg">
            <div className="stat-figure text-primary">
              <Code className="w-8 h-8" />
            </div>
            <div className="stat-title">Success Rate</div>
            <div className="stat-value text-primary">{stats.successRate}%</div>
            <div className="stat-desc">Accepted submissions</div>
          </div>
        </div>

        {/* Activity Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Submissions — Real Data */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Recent Submissions</h2>
              <div className="space-y-3">
                {isSubmissionsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader className="w-6 h-6 animate-spin" />
                  </div>
                ) : submissions && submissions.length > 0 ? (
                  <>
                    {submissions.slice(0, 5).map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-3 bg-base-100 rounded-lg"
                      >
                        <div>
                          <p className="font-semibold">
                            {sub.language} — {sub.status}
                          </p>
                          <p className="text-sm text-gray-500">
                            Submitted {getTimeAgo(sub.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`badge ${
                              sub.status === "Accepted"
                                ? "badge-success"
                                : "badge-error"
                            }`}
                          >
                            {sub.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {submissions.length > 5 && (
                      <div className="text-center">
                        <span className="text-sm text-gray-500">
                          and {submissions.length - 5} more submissions
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-center text-gray-500 py-4">
                    No submissions yet. Start solving problems!
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* My Playlists — Real Data */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">My Playlists</h2>
              <div className="space-y-3">
                {isPlaylistsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader className="w-6 h-6 animate-spin" />
                  </div>
                ) : playlists && playlists.length > 0 ? (
                  <>
                    {playlists.slice(0, 5).map((playlist) => (
                      <div
                        key={playlist.id}
                        className="flex items-center justify-between p-3 bg-base-100 rounded-lg"
                      >
                        <div>
                          <p className="font-semibold">{playlist.name}</p>
                          <p className="text-sm text-gray-500">
                            {playlist.problems?.length || 0} problem
                            {(playlist.problems?.length || 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {playlist.description && (
                          <div className="flex gap-2">
                            <span className="badge badge-outline text-xs">
                              {playlist.description.length > 20
                                ? playlist.description.slice(0, 20) + "…"
                                : playlist.description}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    {playlists.length > 5 && (
                      <div className="text-center">
                        <span className="text-sm text-gray-500">
                          and {playlists.length - 5} more playlists
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-center text-gray-500 py-4">
                    No playlists yet. Create one from the home page!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Account Details */}
        <div className="card bg-base-200 shadow-xl mt-8">
          <div className="card-body">
            <h2 className="card-title mb-4">Account Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600">
                    User ID
                  </label>
                  <p className="font-mono text-sm bg-base-100 p-2 rounded border">
                    {authUser.id}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600">
                    Account Type
                  </label>
                  <p className="text-sm">
                    {authUser.googleId ? "Google Account" : "Email Account"}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600">
                    Member Since
                  </label>
                  <p className="text-sm">
                    {authUser.createdAt
                      ? format(new Date(authUser.createdAt), "PPP")
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600">
                    Last Updated
                  </label>
                  <p className="text-sm">
                    {authUser.updatedAt
                      ? format(new Date(authUser.updatedAt), "PPP")
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
