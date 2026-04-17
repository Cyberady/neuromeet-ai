import express from 'express';
import cors from 'cors';
import { betterAuth } from 'better-auth';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { toNodeHandler } from "better-auth/node";

dotenv.config();

// ✅ SQLite DB (local file in Render container)
const db = new Database('./neromeet.db');

// ✅ Create tables if not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expiresAt INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id)
  );

  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    password TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id)
  );

  CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER,
    updatedAt INTEGER
  );
`);

// ✅ Better Auth setup
export const auth = betterAuth({
  database: db,
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  emailAndPassword: { enabled: true },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }
  },

  // ✅ TEMP (we'll secure later)
  trustedOrigins: ["*"]
});

const app = express();

// ✅ CORS (TEMP open for testing)
app.use(cors({
  origin: "*",
  credentials: true,
}));

// ✅ FIXED ROUTE HANDLER (IMPORTANT)
app.all("/api/auth/*", (req, res) => {
  console.log(`[Better Auth] ${req.method} ${req.url}`);
  return toNodeHandler(auth)(req, res);
});

// ✅ ROOT ROUTE (optional)
app.get("/", (req, res) => {
  res.send("Auth Server Running ✅");
});

// ✅ RENDER PORT FIX
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("--------------------------------------------------");
  console.log(`🚀 Auth Server running on port ${PORT}`);
  console.log(`🔗 Auth URL: ${process.env.BETTER_AUTH_URL}/api/auth`);
  console.log("--------------------------------------------------");
});