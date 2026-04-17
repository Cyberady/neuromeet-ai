import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "https://neuromeet-auth.onrender.com", // ✅ NO /api/auth
  fetchOptions: {
    credentials: "include",
  },
});