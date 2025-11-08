import sqlite3 from "sqlite3";
import { promises as fs } from "fs";

const db = new sqlite3.Database("./database.sqlite");

export const initializeDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          avatar TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Documents table
      db.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT DEFAULT '',
          owner_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_id) REFERENCES users (id)
        )
      `);

      // Document permissions table
      db.run(`
        CREATE TABLE IF NOT EXISTS document_permissions (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer', 'commenter')),
          granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (document_id) REFERENCES documents (id),
          FOREIGN KEY (user_id) REFERENCES users (id),
          UNIQUE(document_id, user_id)
        )
      `);

      // Document versions table
      db.run(`
        CREATE TABLE IF NOT EXISTS document_versions (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          content TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (document_id) REFERENCES documents (id),
          FOREIGN KEY (created_by) REFERENCES users (id)
        )
      `);

      // Comments table
      db.run(`
        CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          position INTEGER,
          resolved BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (document_id) REFERENCES documents (id),
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // Active sessions table for real-time collaboration
      db.run(
        `
        CREATE TABLE IF NOT EXISTS active_sessions (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          socket_id TEXT NOT NULL,
          last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
          cursor_position INTEGER DEFAULT 0,
          FOREIGN KEY (document_id) REFERENCES documents (id),
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
};

export { db };
