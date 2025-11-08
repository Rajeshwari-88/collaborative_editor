import { v4 as uuidv4 } from "uuid";
import { db } from "../database/init.js";

const activeUsers = new Map();
const documentRooms = new Map();
const activeCalls = new Map(); // documentId -> { participants: Set, initiator: string }

export const handleSocketConnection = (socket, io) => {
  console.log(`User ${socket.userId} connected`);

  // Store user info in socket
  db.get(
    "SELECT name FROM users WHERE id = ?",
    [socket.userId],
    (err, user) => {
      if (user) {
        socket.userName = user.name;
      }
    }
  );

  // Join document room
  socket.on("join-document", async (documentId) => {
    try {
      // Verify user has access to document
      const accessQuery = `
        SELECT d.*, 
               COALESCE(dp.role, CASE WHEN d.owner_id = ? THEN 'owner' ELSE NULL END) as role
        FROM documents d
        LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
        WHERE d.id = ? AND (d.owner_id = ? OR dp.user_id = ?)
      `;

      db.get(
        accessQuery,
        [
          socket.userId,
          socket.userId,
          documentId,
          socket.userId,
          socket.userId,
        ],
        (err, document) => {
          if (err || !document) {
            socket.emit("error", { message: "Access denied" });
            return;
          }

          socket.join(documentId);
          socket.currentDocument = documentId;
          socket.userRole = document.role;

          // Update active session
          const sessionId = uuidv4();
          db.run(
            "INSERT OR REPLACE INTO active_sessions (id, document_id, user_id, socket_id, last_seen) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
            [sessionId, documentId, socket.userId, socket.id]
          );

          // Get user info and notify others
          db.get(
            "SELECT id, name, avatar FROM users WHERE id = ?",
            [socket.userId],
            (err, user) => {
              if (user) {
                // Notify others about the new user
                const userInfo = {
                  userId: user.id,
                  name: user.name,
                  avatar: user.avatar,
                  role: document.role,
                };

                socket.to(documentId).emit("user-joined", userInfo);

                // Send current active users to the joining user
                getActiveUsers(documentId, (users) => {
                  socket.emit("active-users", users);

                  // Add current user to the list and broadcast to all users in the room
                  const allUsers = [
                    ...users,
                    {
                      userId: user.id,
                      name: user.name,
                      avatar: user.avatar,
                      cursorPosition: 0,
                    },
                  ];

                  // Broadcast updated user list to everyone in the room
                  socket.to(documentId).emit("active-users", allUsers);
                });
              }
            }
          );
        }
      );
    } catch (error) {
      socket.emit("error", { message: "Failed to join document" });
    }
  });

  // Handle text changes
  socket.on("text-change", (data) => {
    if (
      !socket.currentDocument ||
      !["owner", "editor"].includes(socket.userRole)
    ) {
      return;
    }

    const { content, selection } = data;

    // Update document content
    db.run(
      "UPDATE documents SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [content, socket.currentDocument],
      (err) => {
        if (!err) {
          // Broadcast to other users in the document
          socket.to(socket.currentDocument).emit("text-changed", {
            content,
            userId: socket.userId,
            selection,
          });
        }
      }
    );
  });

  // Handle cursor position updates
  socket.on("cursor-position", (data) => {
    if (!socket.currentDocument) return;

    const { position } = data;

    // Update cursor position in database
    db.run(
      "UPDATE active_sessions SET cursor_position = ?, last_seen = CURRENT_TIMESTAMP WHERE document_id = ? AND user_id = ?",
      [position, socket.currentDocument, socket.userId]
    );

    // Broadcast cursor position to others
    socket.to(socket.currentDocument).emit("cursor-update", {
      userId: socket.userId,
      position,
    });
  });

  // Handle comments
  socket.on("add-comment", (data) => {
    if (
      !socket.currentDocument ||
      !["owner", "editor", "commenter"].includes(socket.userRole)
    ) {
      return;
    }

    const { content, position } = data;
    const commentId = uuidv4();

    db.run(
      "INSERT INTO comments (id, document_id, user_id, content, position) VALUES (?, ?, ?, ?, ?)",
      [commentId, socket.currentDocument, socket.userId, content, position],
      function (err) {
        if (!err) {
          // Get user info and broadcast comment
          db.get(
            "SELECT name, avatar FROM users WHERE id = ?",
            [socket.userId],
            (err, user) => {
              if (user) {
                const comment = {
                  id: commentId,
                  content,
                  position,
                  resolved: false,
                  user: {
                    id: socket.userId,
                    name: user.name,
                    avatar: user.avatar,
                  },
                  created_at: new Date().toISOString(),
                };

                io.to(socket.currentDocument).emit("comment-added", comment);
              }
            }
          );
        }
      }
    );
  });

  // Video call management
  socket.on("get-call-state", (data) => {
    const callState = activeCalls.get(data.documentId);
    if (callState) {
      socket.emit("call-state-update", {
        isActive: true,
        participants: Array.from(callState.participants),
        initiator: callState.initiator,
        roomUrl: callState.roomUrl,
      });
    }
  });

  socket.on("start-call", (data) => {
    const { documentId, name, roomUrl } = data;

    let callState = activeCalls.get(documentId);
    if (!callState) {
      // New call
      callState = {
        participants: new Set([socket.userId]),
        initiator: socket.userId,
        roomUrl: roomUrl,
      };
      activeCalls.set(documentId, callState);

      // Notify all users in the document about the new call
      socket.to(documentId).emit("call-started", {
        initiator: socket.userId,
        initiatorName: name || socket.userName,
        participants: Array.from(callState.participants),
        roomUrl: roomUrl,
      });
    } else {
      // Join existing call
      callState.participants.add(socket.userId);

      // Notify existing call participants about new user
      socket.to(documentId).emit("user-joined-call", {
        userId: socket.userId,
        name: name || socket.userName,
      });
    }

    // Join the video call room
    socket.join(`call-${documentId}`);
    socket.currentCall = documentId;
  });

  socket.on("end-call", (data) => {
    const { documentId } = data;
    const callState = activeCalls.get(documentId);

    if (callState) {
      callState.participants.delete(socket.userId);

      if (callState.participants.size === 0) {
        // Last person left, end the call
        activeCalls.delete(documentId);
        io.to(documentId).emit("call-ended");
      } else {
        // Notify others that user left
        db.get(
          "SELECT name FROM users WHERE id = ?",
          [socket.userId],
          (err, user) => {
            socket.to(documentId).emit("user-left-call", {
              userId: socket.userId,
              name: user ? user.name : socket.userName,
            });
          }
        );

        // Update call state
        io.to(documentId).emit("call-state-update", {
          isActive: true,
          participants: Array.from(callState.participants),
          initiator: callState.initiator,
          roomUrl: callState.roomUrl,
        });
      }
    }

    socket.leave(`call-${documentId}`);
    socket.currentCall = null;
  });

  socket.on("media-state-change", (data) => {
    const { documentId, isVideoEnabled, isAudioEnabled } = data;
    socket.to(documentId).emit("user-media-state", {
      userId: socket.userId,
      isVideoEnabled,
      isAudioEnabled,
    });
  });

  // Handle WebRTC signaling for video/audio
  socket.on("webrtc-offer", (data) => {
    const targetSocket = Array.from(io.sockets.sockets.values()).find(
      (s) => s.userId === data.targetUserId
    );

    if (targetSocket) {
      targetSocket.emit("webrtc-offer", {
        offer: data.offer,
        fromUserId: socket.userId,
      });
    }
  });

  socket.on("webrtc-answer", (data) => {
    const targetSocket = Array.from(io.sockets.sockets.values()).find(
      (s) => s.userId === data.targetUserId
    );

    if (targetSocket) {
      targetSocket.emit("webrtc-answer", {
        answer: data.answer,
        fromUserId: socket.userId,
      });
    }
  });

  socket.on("webrtc-ice-candidate", (data) => {
    const targetSocket = Array.from(io.sockets.sockets.values()).find(
      (s) => s.userId === data.targetUserId
    );

    if (targetSocket) {
      targetSocket.emit("webrtc-ice-candidate", {
        candidate: data.candidate,
        fromUserId: socket.userId,
      });
    }
  });

  // Legacy WebRTC events (keeping for backward compatibility)
  socket.on("webrtc-offer-legacy", (data) => {
    socket.to(data.targetUserId).emit("webrtc-offer-legacy", {
      offer: data.offer,
      fromUserId: socket.userId,
    });
  });

  socket.on("webrtc-answer-legacy", (data) => {
    socket.to(data.targetUserId).emit("webrtc-answer-legacy", {
      answer: data.answer,
      fromUserId: socket.userId,
    });
  });

  socket.on("webrtc-ice-candidate-legacy", (data) => {
    socket.to(data.targetUserId).emit("webrtc-ice-candidate-legacy", {
      candidate: data.candidate,
      fromUserId: socket.userId,
    });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`User ${socket.userId} disconnected`);

    if (socket.currentDocument) {
      // Remove from active sessions
      db.run("DELETE FROM active_sessions WHERE socket_id = ?", [socket.id]);

      // Get updated active users list and notify others
      getActiveUsers(socket.currentDocument, (users) => {
        // Broadcast to all users in the room including the one who left
        io.to(socket.currentDocument).emit("active-users", users);
      });

      socket.to(socket.currentDocument).emit("user-left", {
        userId: socket.userId,
      });

      // Also handle video call disconnect
      if (socket.currentCall) {
        const callState = activeCalls.get(socket.currentCall);
        if (callState) {
          callState.participants.delete(socket.userId);

          if (callState.participants.size === 0) {
            activeCalls.delete(socket.currentCall);
            io.to(socket.currentCall).emit("call-ended");
          } else {
            db.get(
              "SELECT name FROM users WHERE id = ?",
              [socket.userId],
              (err, user) => {
                socket.to(socket.currentCall).emit("user-left-call", {
                  userId: socket.userId,
                  name: user ? user.name : socket.userName,
                });
              }
            );
          }
        }
      }
    }
  });
};

function getActiveUsers(documentId, callback) {
  const query = `
    SELECT u.id as userId, u.name, u.avatar, as.cursor_position as cursorPosition
    FROM active_sessions as
    JOIN users u ON as.user_id = u.id
    WHERE as.document_id = ? AND as.last_seen > datetime('now', '-2 minutes')
  `;

  db.all(query, [documentId], (err, users) => {
    callback(users || []);
  });
}
