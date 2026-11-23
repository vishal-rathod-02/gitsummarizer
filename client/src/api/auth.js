import { apiRequest } from "./client";

/**
 * Auth endpoints matching API.md and api-contract.md.
 */

export async function registerUser({ name, email, password }) {
  const payload = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  return payload.data;
}

export async function loginUser({ email, password }) {
  const payload = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return payload.data;
}

export async function loginDemoUser() {
  const payload = await apiRequest("/auth/demo", {
    method: "POST",
  });
  return payload.data;
}

export async function logoutUser() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch {
    // Ignore error on client-side logout
  }
}

export async function getMe() {
  const payload = await apiRequest("/auth/me", { method: "GET" });
  return payload.data?.user;
}
