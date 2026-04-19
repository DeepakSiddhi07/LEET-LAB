import { db } from "../libs/db.js";

/**
 * POST /api/v1/playlist/create
 *
 * Creates a new playlist for the authenticated user.
 * Checks for duplicate playlist names before creating.
 */
export const createPlaylist = async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Playlist name is required",
      });
    }

    // Check if a playlist with the same name already exists for this user
    const existingPlaylist = await db.playlist.findUnique({
      where: {
        name_userId: {
          name: name.trim(),
          userId,
        },
      },
    });

    if (existingPlaylist) {
      return res.status(409).json({
        success: false,
        message: "A playlist with this name already exists",
      });
    }

    const playlist = await db.playlist.create({
      data: {
        name: name.trim(),
        description,
        userId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Playlist created successfully",
      playlist,
    });
  } catch (error) {
    console.error("Error creating playlist:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/playlist/
 *
 * Fetches all playlists for the authenticated user with their problems.
 */
export const getAllListDetails = async (req, res) => {
  try {
    const playlists = await db.playlist.findMany({
      where: {
        userId: req.user.id,
      },
      include: {
        problems: {
          include: {
            problem: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Playlists fetched successfully",
      playlists,
    });
  } catch (error) {
    console.error("Error fetching playlists:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch playlists",
    });
  }
};

/**
 * GET /api/v1/playlist/:playlistId
 *
 * Fetches a single playlist's details including its problems.
 *
 * Key fix: The success response was previously nested INSIDE the
 * `if(!playlist)` block due to a misplaced closing brace, making it
 * unreachable. Now the if-block properly returns 404 and the success
 * response follows after.
 */
export const getPlayListDetails = async (req, res) => {
  const { playlistId } = req.params;

  try {
    const playlist = await db.playlist.findUnique({
      where: {
        id: playlistId,
        userId: req.user.id,
      },
      include: {
        problems: {
          include: {
            problem: true,
          },
        },
      },
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    // ✅ Fix: This response is now OUTSIDE the if(!playlist) block
    return res.status(200).json({
      success: true,
      message: "Playlist fetched successfully",
      playlist,
    });
  } catch (error) {
    console.error("Error fetching playlist:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch playlist",
    });
  }
};

/**
 * POST /api/v1/playlist/:playlistId/add-problem
 *
 * Adds one or more problems to a playlist.
 *
 * Key fix: The duplicate check now happens BEFORE the insert.
 * Previously, the code inserted first and then checked for duplicates,
 * which was a race condition / logical error — duplicates would either
 * crash (unique constraint) or get inserted and then flagged.
 */
export const addProblemToPlaylist = async (req, res) => {
  const { playlistId } = req.params;
  const { problemIds } = req.body;

  try {
    // ─── Step 1: Validate input ───────────────────────────────────────
    if (!Array.isArray(problemIds) || problemIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing problemIds",
      });
    }

    // ─── Step 2: Verify playlist exists and belongs to user ───────────
    const playlist = await db.playlist.findUnique({
      where: {
        id: playlistId,
        userId: req.user.id,
      },
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    // ─── Step 3: Check for duplicates BEFORE inserting ────────────────
    const existingProblems = await db.problemInPlaylist.findMany({
      where: {
        playlistId,
        problemId: {
          in: problemIds,
        },
      },
    });

    // Filter out problem IDs that are already in the playlist
    const existingProblemIds = new Set(existingProblems.map((p) => p.problemId));
    const newProblemIds = problemIds.filter((id) => !existingProblemIds.has(id));

    if (newProblemIds.length === 0) {
      return res.status(409).json({
        success: false,
        message: "All selected problems already exist in this playlist",
      });
    }

    // ─── Step 4: Insert only the new (non-duplicate) problems ─────────
    const result = await db.problemInPlaylist.createMany({
      data: newProblemIds.map((problemId) => ({
        playlistId,
        problemId,
      })),
    });

    return res.status(201).json({
      success: true,
      message: `${result.count} problem(s) added to playlist successfully`,
      addedCount: result.count,
      skippedCount: existingProblemIds.size,
    });
  } catch (error) {
    console.error("Error adding problems to playlist:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to add problems to playlist",
    });
  }
};

/**
 * DELETE /api/v1/playlist/:playlistId
 *
 * Deletes a playlist. Only the owner can delete their playlist.
 */
export const deletePlaylist = async (req, res) => {
  const { playlistId } = req.params;

  try {
    // Verify ownership before deleting
    const playlist = await db.playlist.findUnique({
      where: {
        id: playlistId,
        userId: req.user.id,
      },
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    await db.playlist.delete({
      where: {
        id: playlistId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Playlist deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting playlist:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete playlist",
    });
  }
};

/**
 * DELETE /api/v1/playlist/:playlistId/remove-problem
 *
 * Removes one or more problems from a playlist.
 *
 * Key fix: Previously there was NO success response after deleteMany —
 * the request would hang indefinitely. Now we properly return a response.
 */
export const removeProblemFromPlaylist = async (req, res) => {
  const { playlistId } = req.params;
  const { problemIds } = req.body;

  try {
    if (!Array.isArray(problemIds) || problemIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing problemIds",
      });
    }

    // Verify playlist ownership
    const playlist = await db.playlist.findUnique({
      where: {
        id: playlistId,
        userId: req.user.id,
      },
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    const result = await db.problemInPlaylist.deleteMany({
      where: {
        playlistId,
        problemId: {
          in: problemIds,
        },
      },
    });

    // ✅ Fix: Actually return a response after the delete
    return res.status(200).json({
      success: true,
      message: `${result.count} problem(s) removed from playlist successfully`,
      removedCount: result.count,
    });
  } catch (error) {
    console.error("Error removing problems from playlist:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to remove problems from playlist",
    });
  }
};
