// import passport from "passport";
// import { Strategy as GoogleStrategy } from "passport-google-oauth20";
// import dotenv from "dotenv";
// import { db } from "../libs/db.js"; 

// dotenv.config();


// // Debug logs
// console.log("Google OAuth strategy initialized");
// console.log("Google OAuth credentials:", {
//   clientID: process.env.GOOGLE_CLIENT_ID,
//   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
// });

// // Google OAuth strategy
// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: "/auth/auth/google/callback",
//        // adjust if your route is different
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       console.log("Google profile:", profile);
//       console.log("Access Token:", accessToken);
//       console.log("Refresh Token:", refreshToken);
//       try {
//         // Check if user already exists
//         let user = await db.user.findUnique({
//           where: { email: profile.emails[0].value }, // google Id
//         });

//         // If not, create the user
//         if (!user) {
//           user = await db.user.create({
//             data: {
//               email: profile.emails[0].value,
//               name: profile.displayName,
//               image: profile.photos?.[0]?.value || null,
//               password: "", // no password for OAuth
//               role: "USER",
//             },
//           });
//         }

//         return done(null, user);
//       } catch (error) {
//         console.error("Google OAuth error:", error);
//         return done(error, null);
//       }
//     }
//   )
// );

// // Optional: for session-based auth (not required for JWT flow)
// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });

// passport.deserializeUser(async (id, done) => {
//   try {
//     const user = await db.user.findUnique({
//       where: { id },
//     });
//     done(null, user);
//   } catch (error) {
//     done(error, null);
//   }
// });








