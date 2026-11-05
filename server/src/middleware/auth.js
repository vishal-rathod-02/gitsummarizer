import AppError from "../utils/AppError.js";
import { verifyAccessToken } from "../services/authService.js";

function extractBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    throw new AppError(
      401,
      "UNAUTHORIZED",
      "Authorization header must use Bearer <token> format."
    );
  }

  return parts[1];
}

/**
 * Attaches `req.user` if a valid Bearer token is present, or `req.user = null` if omitted.
 * Allows both anonymous and authenticated flows to work seamlessly.
 */
export function optionalAuth(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      req.user = null;
      return next();
    }

    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name || null
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Requires a valid Bearer token and attaches `req.user`.
 */
export function requireAuth(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AppError(
        401,
        "UNAUTHORIZED",
        "Authentication is required to access this resource."
      );
    }

    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name || null
    };
    return next();
  } catch (err) {
    return next(err);
  }
}
