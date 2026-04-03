import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../libs/db.js";
import { UserRole } from "../generated/prisma/index.js";
import { verifyGoogleToken } from "../libs/verifyGoogleToken.js";

// ─── Constants ────────────────────────────────────────────────
const JWT_EXPIRY = "7d";
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days in milliseconds
const BCRYPT_SALT_ROUNDS = 10;

// ─── Helpers ──────────────────────────────────────────────────

/**
 * generateToken
 * Creates a signed JWT containing the user's ID.
 *
 * @param {string} userId - The UUID of the user
 * @returns {string} Signed JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
};

/**
 * setTokenCookie
 * Attaches the JWT as an httpOnly cookie on the response.
 * - httpOnly: prevents client-side JS from reading the cookie (XSS protection)
 * - sameSite: "strict" prevents CSRF attacks
 * - secure: true in production so cookies are only sent over HTTPS
 *
 * @param {Object} res   - Express response object
 * @param {string} token - Signed JWT token
 */
const setTokenCookie = (res, token) => {
  res.cookie("jwt", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV !== "development",
    maxAge: COOKIE_MAX_AGE,
  });
};

/**
 * sanitizeUser
 * Returns only the safe, public-facing fields of a user object.
 * Ensures sensitive fields like `password` and `googleId` are never leaked.
 *
 * @param {Object} user - Prisma user record
 * @returns {Object} Sanitized user object
 */
const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  image: user.image,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ─── Controllers ──────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 *
 * Registers a new user with email and password.
 *
 * Request body:
 *   - email    (string, required) — must be a valid email format
 *   - password (string, required) — minimum 6 characters
 *   - name     (string, required) — minimum 3 characters
 *
 * Flow:
 *   1. Validate required fields
 *   2. Check if email is already registered
 *   3. Hash the password with bcrypt
 *   4. Create the user in the database
 *   5. Generate a JWT and set it as an httpOnly cookie
 *   6. Return the sanitized user object
 */
export const register = async (req, res) => {
  const { email, password, name } = req.body;

  try {
    // ── Step 1: Input validation ──────────────────────────
    if (!email || !password || !name) {
      return res.status(400).json({
        error: "All fields are required (name, email, password)",
        success: false,
      });
    }

    // Validate email format with a simple regex check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Please provide a valid email address",
        success: false,
      });
    }

    // Enforce minimum password length
    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
        success: false,
      });
    }

    // Enforce minimum name length
    if (name.trim().length < 3) {
      return res.status(400).json({
        error: "Name must be at least 3 characters long",
        success: false,
      });
    }

    // ── Step 2: Check for existing user ───────────────────
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        error: "An account with this email already exists",
        success: false,
      });
    }

    // ── Step 3: Hash the password ─────────────────────────
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // ── Step 4: Create the user ───────────────────────────
    const newUser = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name.trim(),
        role: UserRole.USER,
      },
    });

    // ── Step 5: Generate JWT and set cookie ───────────────
    const token = generateToken(newUser.id);
    setTokenCookie(res, token);

    // ── Step 6: Return sanitized user ─────────────────────
    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    console.error("Error in register controller:", error.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
      success: false,
    });
  }
};

/**
 * POST /api/v1/auth/login
 *
 * Authenticates an existing user with email and password.
 *
 * Request body:
 *   - email    (string, required)
 *   - password (string, required)
 *
 * Flow:
 *   1. Validate required fields
 *   2. Find the user by email
 *   3. Verify the password hash
 *   4. Generate a JWT and set it as an httpOnly cookie
 *   5. Return the sanitized user object
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // ── Step 1: Input validation ──────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
        success: false,
      });
    }

    // ── Step 2: Find user by email ────────────────────────
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Use a vague message to prevent email enumeration attacks
      return res.status(401).json({
        error: "Invalid email or password",
        success: false,
      });
    }

    // ── Step 3: Verify password ───────────────────────────
    // If the user signed up via Google OAuth, they won't have a password.
    // In that case, reject the login attempt with credentials.
    if (!user.password) {
      return res.status(401).json({
        error:
          "This account uses Google Sign-In. Please log in with Google instead.",
        success: false,
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid email or password",
        success: false,
      });
    }

    // ── Step 4: Generate JWT and set cookie ───────────────
    const token = generateToken(user.id);
    setTokenCookie(res, token);

    // ── Step 5: Return sanitized user ─────────────────────
    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Error in login controller:", error.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
      success: false,
    });
  }
};

/**
 * POST /api/v1/auth/logout
 *
 * Clears the JWT cookie, ending the user's session.
 * Requires the user to be authenticated (authMiddleware).
 */
export const logout = async (req, res) => {
  try {
    // Clear the JWT cookie with the same options it was set with
    // (path, httpOnly, sameSite, secure must match for the browser to clear it)
    res.clearCookie("jwt", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV !== "development",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Error in logout controller:", error.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
      success: false,
    });
  }
};

/**
 * GET /api/v1/auth/check
 *
 * Returns the currently authenticated user's info.
 * Used by the frontend on app load to restore the session.
 * The user object is already attached to `req.user` by authMiddleware.
 */
export const check = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "User authenticated successfully",
      user: req.user,
    });
  } catch (error) {
    console.error("Error in check controller:", error.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again later.",
      success: false,
    });
  }
};

/**
 * POST /api/v1/auth/google-login
 *
 * Authenticates (or registers) a user via Google OAuth.
 * The frontend sends a Google ID token obtained from the Google Sign-In SDK.
 *
 * Request body:
 *   - token (string, required) — Google ID token from @react-oauth/google
 *
 * Flow:
 *   1. Verify the Google ID token server-side
 *   2. Ensure the Google email is verified
 *   3. Find or create the user in the database
 *   4. Generate a JWT and set it as an httpOnly cookie
 *   5. Return the sanitized user object
 */
export const googleLogin = async (req, res) => {
  const { token } = req.body;

  try {
    // ── Step 1: Validate input ────────────────────────────
    if (!token) {
      return res.status(400).json({
        error: "Google token is required",
        success: false,
      });
    }

    // ── Step 2: Verify the Google ID token ────────────────
    // This calls Google's API to validate the token and returns
    // the user's profile info (email, name, picture, etc.)
    const payload = await verifyGoogleToken(token);

    if (!payload.email_verified) {
      return res.status(401).json({
        error: "Google email is not verified",
        success: false,
      });
    }

    // ── Step 3: Find or create user ───────────────────────
    let user = await db.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      // First-time Google sign-in — create a new account
      user = await db.user.create({
        data: {
          email: payload.email,
          name: payload.name,
          image: payload.picture,
          googleId: payload.sub, // Google's unique user ID
          role: UserRole.USER,
          // No password for OAuth-only accounts
        },
      });
    }

    // ── Step 4: Generate JWT and set cookie ───────────────
    const jwtToken = generateToken(user.id);
    setTokenCookie(res, jwtToken);

    // ── Step 5: Return sanitized user ─────────────────────
    return res.status(200).json({
      success: true,
      message: "Logged in with Google",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Error in googleLogin controller:", error.message);
    return res.status(401).json({
      error: "Invalid or expired Google token",
      success: false,
    });
  }
};
