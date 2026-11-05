import crypto from "node:crypto";
import env from "../config/env.js";
import AppError from "../utils/AppError.js";
import {
  findByEmail,
  findById,
  createUser,
  toPublicUser
} from "../repositories/userRepository.js";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto
    .scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p
    })
    .toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [, salt, keyHex] = parts;
  const derivedBuffer = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p
  });
  const storedBuffer = Buffer.from(keyHex, "hex");
  if (derivedBuffer.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(derivedBuffer, storedBuffer);
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input) {
  let str = input.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4 !== 0) {
    str += "=";
  }
  return Buffer.from(str, "base64").toString("utf8");
}

/**
 * Signs an HS256 JWT token.
 */
export function signAccessToken(user) {
  const secret = process.env.JWT_SECRET || env.JWT_SECRET;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expSeconds = nowSeconds + (env.JWT_EXPIRES_IN_SECONDS || 86400);

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name || null,
      iat: nowSeconds,
      exp: expSeconds
    })
  );

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${header}.${payload}.${signature}`;
}

/**
 * Verifies an HS256 JWT token and returns the decoded payload.
 */
export function verifyAccessToken(token) {
  if (!token || typeof token !== "string") {
    throw new AppError(401, "UNAUTHORIZED", "Authentication token is required.");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid authentication token.");
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const secret = process.env.JWT_SECRET || env.JWT_SECRET;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const sigBuf = Buffer.from(signatureB64);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid authentication token signature.");
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch (_err) {
    throw new AppError(401, "UNAUTHORIZED", "Malformed authentication token.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSeconds) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication token has expired.");
  }

  return payload;
}

export function registerUser({ name, email, password }) {
  const existing = findByEmail(email);
  if (existing) {
    throw new AppError(
      409,
      "EMAIL_ALREADY_EXISTS",
      "An account with this email address already exists."
    );
  }

  const passwordHash = hashPassword(password);
  const created = createUser({ name, email, passwordHash });
  const publicUser = toPublicUser(created);
  const token = signAccessToken(publicUser);

  return {
    user: publicUser,
    token,
    expiresIn: env.JWT_EXPIRES_IN_SECONDS
  };
}

export function loginUser({ email, password }) {
  const existing = findByEmail(email);
  if (!existing || !verifyPassword(password, existing.passwordHash)) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password."
    );
  }

  const publicUser = toPublicUser(existing);
  const token = signAccessToken(publicUser);

  return {
    user: publicUser,
    token,
    expiresIn: env.JWT_EXPIRES_IN_SECONDS
  };
}

export function getAuthenticatedUser(userId) {
  const user = findById(userId);
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "User account no longer exists.");
  }
  return toPublicUser(user);
}
