/**
 * Base HTTP client for communicating with the GitSummarizer backend API.
 * Handles base URL normalization, headers, auth token injection, and structured error responses.
 */

export function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
  const cleaned = envUrl.replace(/\/+$/, "");
  // Ensure the /api path prefix is included
  if (!cleaned.endsWith("/api")) {
    return `${cleaned}/api`;
  }
  return cleaned;
}

export async function apiRequest(endpointPath, options = {}) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // Inject Bearer token if user or demo session is signed in
  const token = localStorage.getItem("gitsummarizer.token");
  if (
    token &&
    !headers.Authorization &&
    !headers.authorization
  ) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkError) {
    throw {
      code: "NETWORK_ERROR",
      message: `Failed to connect to GitSummarizer API at ${baseUrl}. Ensure backend is running.`,
      original: networkError,
    };
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let payload = null;
  if (isJson) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    // If backend returned standard error envelope { success: false, error: { code, message }, requestId }
    if (payload && payload.error) {
      const err = new Error(payload.error.message || `Request failed with status ${response.status}`);
      err.code = payload.error.code || "REQUEST_FAILED";
      err.status = response.status;
      err.requestId = payload.requestId;
      throw err;
    }

    const genericErr = new Error(
      typeof payload === "string" && payload
        ? payload
        : `Request failed with status ${response.status}`
    );
    genericErr.status = response.status;
    genericErr.code = "REQUEST_FAILED";
    throw genericErr;
  }

  return payload;
}
