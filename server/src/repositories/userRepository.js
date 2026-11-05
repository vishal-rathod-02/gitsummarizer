import crypto from "node:crypto";
import { getDb } from "../config/db.js";

function normalizeUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt || user.created_at
  };
}

export function findByEmail(email) {
  const db = getDb();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const row = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizedEmail);
  return normalizeUserRow(row);
}

export function findById(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  return normalizeUserRow(row);
}

export function createUser({ name, email, passwordHash }) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const normalizedEmail = String(email).trim().toLowerCase();

  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name || null, normalizedEmail, passwordHash, now, now);

  return {
    id,
    name: name || null,
    email: normalizedEmail,
    createdAt: now,
    updatedAt: now
  };
}
