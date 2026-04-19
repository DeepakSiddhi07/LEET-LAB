import jwt from "jsonwebtoken";
import { db } from "../libs/db.js";

/**
 * authMiddleware
 *
 * Protects routes by enforcing valid JWT authentication.
 * Production-ready checks include:
 * 1. Safe extraction of token from either cookies ('jwt') or Authorization HTTP header ('Bearer <token>')
 * 2. Secure verification using 'jsonwebtoken' against the secret
 * 3. Graceful handling of malformed, expired, or missing tokens (explicit return prevents crashes)
 * 4. Database verification to ensure the user still exists and hasn't been deleted
 * 5. Stripping out sensitive parameters before attaching the user to `req.user`
 */
export const authMiddleware = async (req, res, next) => {
  try {
    // ─── Step 1: Extract Token ──────────────────────────────────────────
    // Check cookies first, fall back to Authorization header if testing APIs or using mobile client
    let token = req.cookies?.jwt;
    
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized - No token provided",
        success: false,
      });
    }

    // ─── Step 2: Verify Token ───────────────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      // Must return explicitly, otherwise execution continues and accessing
      // decoded.id will throw a TypeError, leading to an unhandled rejection / server crash.
      const isExpired = error.name === "TokenExpiredError";
      return res.status(401).json({
        message: isExpired ? "Unauthorized - Token expired" : "Unauthorized - Invalid token",
        success: false,
      });
    }

    // ─── Step 3: Verify User Exists ─────────────────────────────────────
    // Fetch the user from the database, rigorously excluding sensitive info
    const user = await db.user.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        id: true,
        image: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        googleId: true,
      },
    });

    if (!user) {
      // Token is valid but user was deleted in the database
      // Optional: Clear the cookie so the user isn't stuck with an orphaned session
      res.clearCookie("jwt", {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV !== "development",
      });

      return res.status(404).json({
        message: "User account no longer exists",
        success: false,
      });
    }

    // ─── Step 4: Attach to Request ──────────────────────────────────────
    // Attach validated user to request for use in underlying controllers
    req.user = user;

    next();
  } catch (error) {
    console.error("Error authenticating user in middleware:", error.message);
    return res.status(500).json({
      message: "Internal Server Error during authentication",
      success: false,
    });
  }
};

/**
 * checkAdmin
 *
 * Middleware to restrict route access to ADMIN users only.
 * MUST be chained AFTER `authMiddleware` in the route definition 
 * so that `req.user` is fully verified and available.
 */
export const checkAdmin = async (req, res, next) => {
  try {
    // Make sure req.user is supplied from authMiddleware
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Unauthorized - User context missing",
        success: false,
      });
    }

    const userId = req.user.id; 

    // Re-verify role against database securely
    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        role: true,
      },
    });

    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Access denied - Admin privileges required",
        success: false,
      });
    }

    next();
  } catch (error) {
    console.error("Error checking admin role:", error.message);
    return res.status(500).json({
      message: "Internal Server Error processing admin authorization",
      success: false,
    });
  }
};