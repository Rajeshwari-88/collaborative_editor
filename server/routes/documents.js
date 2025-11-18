import express from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../database/init.js";
import { authenticateToken } from "./auth.js";

const router = express.Router();

// Get user's documents
router.get("/", authenticateToken, (req, res) => {
  const query = `
    SELECT d.*, u.name as owner_name, dp.role
    FROM documents d
    JOIN users u ON d.owner_id = u.id
    LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
    WHERE d.owner_id = ? OR dp.user_id = ?
    ORDER BY d.updated_at DESC
  `;

  db.all(query, [req.userId, req.userId, req.userId], (err, documents) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch documents" });
    }
    res.json(documents);
  });
});

// Create new document
router.post("/", authenticateToken, (req, res) => {
  const { title } = req.body;
  const documentId = uuidv4();

  db.run(
    "INSERT INTO documents (id, title, owner_id) VALUES (?, ?, ?)",
    [documentId, title, req.userId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Failed to create document" });
      }

      // Create initial version
      const versionId = uuidv4();
      db.run(
        "INSERT INTO document_versions (id, document_id, content, version_number, created_by) VALUES (?, ?, ?, ?, ?)",
        [versionId, documentId, "", 1, req.userId],
        (err) => {
          if (err) {
            console.error("Failed to create initial version:", err);
          }
        }
      );

      res.json({ id: documentId, title, content: "", owner_id: req.userId });
    }
  );
});

// Get specific document
router.get("/:id", authenticateToken, (req, res) => {
  const documentId = req.params.id;

  // Check if user has access to document
  const accessQuery = `
    SELECT d.*, u.name as owner_name, 
           COALESCE(dp.role, CASE WHEN d.owner_id = ? THEN 'owner' ELSE NULL END) as role
    FROM documents d
    JOIN users u ON d.owner_id = u.id
    LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
    WHERE d.id = ? AND (d.owner_id = ? OR dp.user_id = ?)
  `;

  db.get(
    accessQuery,
    [req.userId, req.userId, documentId, req.userId, req.userId],
    (err, document) => {
      if (err || !document) {
        return res
          .status(404)
          .json({ error: "Document not found or access denied" });
      }

      // Get active collaborators
      const collaboratorsQuery = `
      SELECT u.id, u.name, u.avatar, as.cursor_position, as.last_seen
      FROM active_sessions as
      JOIN users u ON as.user_id = u.id
      WHERE as.document_id = ? AND as.last_seen > datetime('now', '-5 minutes')
    `;

      db.all(collaboratorsQuery, [documentId], (err, collaborators) => {
        if (err) collaborators = [];

        // Get document comments
        const commentsQuery = `
        SELECT c.*, u.name as user_name, u.avatar as user_avatar
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.document_id = ?
        ORDER BY c.created_at DESC
      `;

        db.all(commentsQuery, [documentId], (err, comments) => {
          if (err) comments = [];

          const formattedComments = comments.map((comment) => ({
            id: comment.id,
            content: comment.content,
            position: comment.position,
            resolved: comment.resolved,
            created_at: comment.created_at,
            user: {
              id: comment.user_id,
              name: comment.user_name,
              avatar: comment.user_avatar,
            },
          }));

          res.json({
            ...document,
            collaborators: collaborators || [],
            comments: formattedComments,
          });
        });
      });
    }
  );
});

// Get document collaborators
router.get("/:id/collaborators", authenticateToken, (req, res) => {
  const documentId = req.params.id;

  // Check if user has access to document
  const accessQuery = `
    SELECT d.id
    FROM documents d
    LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
    WHERE d.id = ? AND (d.owner_id = ? OR dp.user_id = ?)
  `;

  db.get(
    accessQuery,
    [req.userId, documentId, req.userId, req.userId],
    (err, document) => {
      if (err || !document) {
        return res
          .status(404)
          .json({ error: "Document not found or access denied" });
      }

      const collaboratorsQuery = `
      SELECT dp.role, u.id as user_id, u.name as user_name, u.avatar as user_avatar
      FROM document_permissions dp
      JOIN users u ON dp.user_id = u.id
      WHERE dp.document_id = ?
      UNION
      SELECT 'owner' as role, u.id as user_id, u.name as user_name, u.avatar as user_avatar
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      WHERE d.id = ?
    `;

      db.all(
        collaboratorsQuery,
        [documentId, documentId],
        (err, collaborators) => {
          if (err) {
            return res
              .status(500)
              .json({ error: "Failed to fetch collaborators" });
          }

          res.json(collaborators || []);
        }
      );
    }
  );
});

// Get document comments
router.get("/:id/comments", authenticateToken, (req, res) => {
  const documentId = req.params.id;

  // Check if user has access to document
  const accessQuery = `
    SELECT d.id
    FROM documents d
    LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
    WHERE d.id = ? AND (d.owner_id = ? OR dp.user_id = ?)
  `;

  db.get(
    accessQuery,
    [req.userId, documentId, req.userId, req.userId],
    (err, document) => {
      if (err || !document) {
        return res
          .status(404)
          .json({ error: "Document not found or access denied" });
      }

      const commentsQuery = `
      SELECT c.*, u.name as user_name, u.avatar as user_avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.document_id = ?
      ORDER BY c.created_at DESC
    `;

      db.all(commentsQuery, [documentId], (err, comments) => {
        if (err) {
          return res.status(500).json({ error: "Failed to fetch comments" });
        }

        const formattedComments = comments.map((comment) => ({
          id: comment.id,
          content: comment.content,
          position: comment.position,
          resolved: comment.resolved,
          created_at: comment.created_at,
          user: {
            id: comment.user_id,
            name: comment.user_name,
            avatar: comment.user_avatar,
          },
        }));

        res.json(formattedComments);
      });
    }
  );
});

// Update document content
router.put("/:id", authenticateToken, (req, res) => {
  const { content } = req.body;
  const documentId = req.params.id;

  // Check edit permission
  const permissionQuery = `
    SELECT COALESCE(dp.role, CASE WHEN d.owner_id = ? THEN 'owner' ELSE NULL END) as role
    FROM documents d
    LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
    WHERE d.id = ?
  `;

  db.get(
    permissionQuery,
    [req.userId, req.userId, documentId],
    (err, permission) => {
      if (
        err ||
        !permission ||
        !["owner", "editor"].includes(permission.role)
      ) {
        return res.status(403).json({ error: "No edit permission" });
      }

      db.run(
        "UPDATE documents SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [content, documentId],
        function (err) {
          if (err) {
            return res.status(500).json({ error: "Failed to update document" });
          }

          // Create new version
          const versionId = uuidv4();
          db.get(
            "SELECT MAX(version_number) as max_version FROM document_versions WHERE document_id = ?",
            [documentId],
            (err, result) => {
              const newVersionNumber = (result?.max_version || 0) + 1;

              db.run(
                "INSERT INTO document_versions (id, document_id, content, version_number, created_by) VALUES (?, ?, ?, ?, ?)",
                [versionId, documentId, content, newVersionNumber, req.userId],
                (err) => {
                  if (err) {
                    console.error("Failed to create version:", err);
                  }
                }
              );
            }
          );

          res.json({ success: true });
        }
      );
    }
  );
});

// Share document
router.post("/:id/share", authenticateToken, (req, res) => {
  const { email, role } = req.body;
  const documentId = req.params.id;

  // Check if user is owner
  db.get(
    "SELECT * FROM documents WHERE id = ? AND owner_id = ?",
    [documentId, req.userId],
    (err, document) => {
      if (err || !document) {
        return res.status(403).json({ error: "Only document owner can share" });
      }

      // Find user by email
      db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (err || !user) {
          return res.status(404).json({ error: "User not found" });
        }

        const permissionId = uuidv4();
        db.run(
          "INSERT OR REPLACE INTO document_permissions (id, document_id, user_id, role) VALUES (?, ?, ?, ?)",
          [permissionId, documentId, user.id, role],
          function (err) {
            if (err) {
              return res
                .status(500)
                .json({ error: "Failed to share document" });
            }
            res.json({ success: true });
          }
        );
      });
    }
  );
});

// Get document versions
router.get("/:id/versions", authenticateToken, (req, res) => {
  const documentId = req.params.id;

  const query = `
    SELECT dv.*, u.name as created_by_name
    FROM document_versions dv
    JOIN users u ON dv.created_by = u.id
    WHERE dv.document_id = ?
    ORDER BY dv.version_number DESC
  `;

  db.all(query, [documentId], (err, versions) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch versions" });
    }
    res.json(versions);
  });
});

// Create a new version snapshot (without overwriting current content)
router.post("/:id/versions", authenticateToken, (req, res) => {
  const documentId = req.params.id;

  // Check edit permission
  const permissionQuery = `
    SELECT COALESCE(dp.role, CASE WHEN d.owner_id = ? THEN 'owner' ELSE NULL END) as role
    FROM documents d
    LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
    WHERE d.id = ?
  `;

  db.get(
    permissionQuery,
    [req.userId, req.userId, documentId],
    (err, permission) => {
      if (err || !permission || !["owner", "editor"].includes(permission.role)) {
        return res.status(403).json({ error: "No edit permission" });
      }

      // Read current content
      db.get(
        "SELECT content FROM documents WHERE id = ?",
        [documentId],
        (err, doc) => {
          if (err || !doc) {
            return res.status(404).json({ error: "Document not found" });
          }

          // Create new version
          const versionId = uuidv4();
          db.get(
            "SELECT MAX(version_number) as max_version FROM document_versions WHERE document_id = ?",
            [documentId],
            (err, result) => {
              const newVersionNumber = (result?.max_version || 0) + 1;

              db.run(
                "INSERT INTO document_versions (id, document_id, content, version_number, created_by) VALUES (?, ?, ?, ?, ?)",
                [versionId, documentId, doc.content || "", newVersionNumber, req.userId],
                (err) => {
                  if (err) {
                    return res.status(500).json({ error: "Failed to create version" });
                  }
                  res.json({ success: true, version_number: newVersionNumber });
                }
              );
            }
          );
        }
      );
    }
  );
});

export default router;
