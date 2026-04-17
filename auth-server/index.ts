import express from "express";
import cors from "cors";
import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";

dotenv.config();

console.log("🚀 Starting Auth Server...");
console.log("ENV CHECK:");
console.log("BETTER_AUTH_URL:", process.env.BETTER_AUTH_URL);
console.log("BETTER_AUTH_SECRET:", process.env.BETTER_AUTH_SECRET ? "OK" : "MISSING");
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "OK" : "MISSING");
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "OK" : "MISSING");

try {
  const db = new Database("./neromeet.db");

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

  const auth = betterAuth({
    database: db,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    trustedOrigins: [
      "http://localhost:5173",
      "http://localhost:8080",
      "https://neuromeet-ai.onrender.com",
      "https://neuromeet-auth.onrender.com",
    ],
    cookies: {
      sessionToken: {
        attributes: {
          sameSite: "none",
          secure: true,
          partitioned: true,
        },
      },
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
      },
      crossSubdomainCookies: {
        enabled: true,
        domain: ".onrender.com",
      },
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        partitioned: true,
      },
    },
  });

  const app = express();

  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "http://localhost:8080",
        "https://neuromeet-ai.onrender.com",
        "https://neuromeet-auth.onrender.com",
      ],
      credentials: true,
    })
  );

  // ✅ Health routes FIRST
  app.get("/", (_req, res) => {
    res.send("Auth Server Running ✅");
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // ✅ Auth handler AFTER health routes
  app.use(toNodeHandler(auth));

  const PORT = process.env.PORT || 8080;

  app.listen(PORT, () => {
    console.log("--------------------------------------------------");
    console.log(`🚀 Auth Server running on port ${PORT}`);
    console.log(`🔗 Auth URL: ${process.env.BETTER_AUTH_URL}/api/auth`);
    console.log("--------------------------------------------------");
  });

} catch (err) {
  console.error("❌ SERVER CRASH:", err);
}