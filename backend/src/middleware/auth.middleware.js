import jwt from "jsonwebtoken";
import { db } from "../libs/db.js";

/**
 * authMiddleware
 *
 * Protects routes by enforcing valid JWT authentication.
 * 1. Extracts the 'jwt' cookie from the request
 * 2. Verifies the token using the secret
 * 3. Fetches the user from the database
 * 4. Attaches the safe user object to the request (`req.user`)
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized - No token provided",
        success: false,
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      // Must return here, otherwise execution continues and accessing
      // decoded.id will throw a TypeError, crashing the backend.
      return res.status(401).json({
        message: "Unauthorized - Invalid token",
        success: false,
      });
    }

    // Fetch the user from the database, excluding sensitive info
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
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    // Attach user to request for use in controllers
    req.user = user;

    next();
  } catch (error) {
    console.error("Error authenticating user:", error.message);
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
 * MUST be applied AFTER `authMiddleware` so that `req.user` is defined.
 */
export const checkAdmin = async (req, res, next) => {
  try {
    const userId = req.user.id; // From authMiddleware

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
        message: "Access denied - Admins only",
        success: false,
      });
    }

    next();
  } catch (error) {
    console.error("Error checking admin role:", error.message);
    return res.status(500).json({
      message: "Internal Server Error checking admin role",
      success: false,
    });
  }
};