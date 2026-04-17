import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: `${import.meta.env.VITE_AUTH_URL}/api/auth`// Base URL of the auth server
});
