import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

import { check, googleLogin, login, logout, register } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";


const authRoutes = express.Router();

authRoutes.post("/register", register)

authRoutes.post("/login",login)

authRoutes.post("/logout",authMiddleware,logout)

authRoutes.get("/check",authMiddleware,check)

// Google OAuth routes
// authRoutes.get("/auth/google",
//   passport.authenticate("google", { scope: ["profile", "email"] })
// );
// export async function getGoogleAuthSettings(req, res) {
//     const googleAuthURL =
//         `https://accounts.google.com/o/oauth2/v2/auth?` +
//         querystring.stringify({
//             client_id: GOOGLE_CLIENT_ID,
//             redirect_uri: GOOGLE_REDIRECT_URI,
//             response_type: 'code',
//             scope: 'openid profile email',
//             access_type: 'offline',
//             prompt: 'consent',
//         });
//     res.json({ url: googleAuthURL });
// }

// authRoutes.get("/google/callback",
//   passport.authenticate("google", { session: false, failureRedirect: "/login" }),
//   (req, res) => {
//     // Generate JWT
//     const token = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, {
//       expiresIn: "7d"
//     });

//     // Set cookie (or redirect with token as query param)
//     res.cookie("jwt", token, {
//       httpOnly: true,
//       sameSite: "strict",
//       secure: process.env.NODE_ENV !== "development",
//       maxAge: 1000 * 60 * 60 * 24 * 7,
//     });

//     // ✅ You can redirect to frontend with token or session
//     res.redirect(`${process.env.CLIENT_URL}/`); // Adjust this path
//   }
// );

authRoutes.post('/google-login',googleLogin)





export default authRoutes;