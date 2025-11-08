import React, { useState, useEffect } from "react";
import { X, MessageSquare, Send, Check, Mic, Square, Play, Trash2 } from "lucide-react";
import { useSocket } from "../../contexts/SocketContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

interface Comment {
  id: string;
  content: string;
  position?: number;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  created_at: string;
  resolved: boolean;
}

interface Props {
  documentId: string;
  onClose: () => void;
}

const CommentsPanel: React.FC<Props> = ({ documentId, onClose }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const { socket } = useSocket();
  const { user } = useAuth();
  const { showSuccessToast, showInfoToast } = useToast();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchComments();

    if (socket) {
      socket.on("comment-added", handleCommentAdded);
      socket.on("comments-updated", fetchComments);

      return () => {
        socket.off("comment-added");
        socket.off("comments-updated");
      };
    }
  }, [socket, documentId]);

  const normalizeTimestamp = (s: any): string => {
    if (!s) return "";
    if (typeof s === 'number') return new Date(s).toISOString();
    if (typeof s !== 'string') return new Date(String(s)).toISOString();
    // 'YYYY-MM-DD HH:mm:ss' (UTC)
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
      return new Date(s.replace(' ', 'T') + 'Z').toISOString();
    }
    // 'YYYY-MM-DD HH:mm:ss.SSS' (UTC)
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{1,3}$/.test(s)) {
      return new Date(s.replace(' ', 'T') + 'Z').toISOString();
    }
    // ISO-like without timezone -> treat as UTC
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      return new Date(s + 'Z').toISOString();
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString();
  };

  const fetchComments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/documents/${documentId}/comments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const normalized = Array.isArray(data)
          ? data.map((c: any) => ({ ...c, created_at: normalizeTimestamp(c?.created_at) }))
          : [];
        setComments(normalized);
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCommentAdded = (comment: Comment) => {
    console.log("New comment added:", comment);
    setComments((prev) => [comment, ...prev]);
    if (comment.user?.id && comment.user.id !== user?.id) {
      const name = comment.user.name || "Someone";
      showInfoToast?.("New Comment", `${name} added a comment`);
    }
  };

  const addComment = async () => {
    if (!socket) return;

    if (audioBlob) {
      try {
        const dataUrl = await blobToDataURL(audioBlob);
        const payload = JSON.stringify({ type: "audio", mime: audioBlob.type || "audio/webm", dataUrl });
        socket.emit("add-comment", {
          content: payload,
          position: 0,
        });
        clearAudio();
        showSuccessToast?.("Comment Sent", "Your voice comment was posted");
        return;
      } catch (e) {
        console.error("Failed to encode audio", e);
      }
    }

    if (!newComment.trim()) return;

    socket.emit("add-comment", {
      content: newComment,
      position: 0, // In a real implementation, this would be the cursor position
    });

    setNewComment("");
    showSuccessToast?.("Comment Sent", "Your comment was posted");
  };

  const formatDate = (dateString: string) => {
    const parseDate = (s: any) => {
      if (typeof s === "number") return new Date(s);
      if (typeof s !== "string") return new Date(NaN);
      // Pattern like 'YYYY-MM-DD HH:mm:ss'
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        // First, interpret as local time
        const localGuess = new Date(s.replace(" ", "T"));
        // If that ends up in the future by >2 minutes, assume original was UTC and parse with Z
        if (localGuess.getTime() - Date.now() > 2 * 60 * 1000) {
          return new Date(s.replace(" ", "T") + "Z");
        }
        return localGuess;
      }
      // ISO strings (with timezone or Z)
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        return new Date(s);
      }
      // Fallback plain date
      return new Date(s);
    };
    const date = parseDate(dateString);
    const ts = date.getTime();
    if (isNaN(ts)) return "";
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const startRecording = async () => {
    setRecError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioChunks([]);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };

      setAudioChunks(chunks);
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Microphone permission or recording error", err);
      setRecError("Microphone access denied or unsupported browser.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const clearAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioChunks([]);
  };

  const playAudio = () => {
    if (audioUrl) {
      const a = new Audio(audioUrl);
      a.play();
    }
  };

  const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Failed to read audio"));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white to-gray-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <h3 className="font-semibold text-gray-900 tracking-tight">Comments</h3>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="p-3 rounded-full bg-teal-50 ring-1 ring-teal-100 mb-3">
              <MessageSquare className="h-6 w-6 text-teal-600" />
            </div>
            <p className="text-sm font-medium text-gray-800">No comments yet</p>
            <p className="text-xs text-gray-500 mt-1">Start a conversation about this document</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-9 h-9 bg-teal-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 shadow ring-2 ring-white">
                    {comment.user.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">
                        {comment.user.name}
                      </h4>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>

                    {(() => {
                      // Try to detect audio payload
                      try {
                        const parsed = JSON.parse(comment.content);
                        if (parsed && parsed.type === "audio" && typeof parsed.dataUrl === "string") {
                          return (
                            <div className="mt-2 rounded-lg overflow-hidden ring-1 ring-gray-200 bg-gray-50">
                              <audio controls src={parsed.dataUrl} className="w-full" />
                            </div>
                          );
                        }
                      } catch (_) {
                        // not JSON, treat as text
                      }
                      return (
                        <p className="text-[13px] leading-6 text-gray-800 mt-1">{comment.content}</p>
                      );
                    })()}

                    {Boolean(comment.resolved) && (
                      <div className="flex items-center mt-2 text-xs text-emerald-600">
                        <Check className="h-3 w-3 mr-1" />
                        Resolved
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-4 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
        <div className="flex space-x-3">
          <div className="w-9 h-9 bg-teal-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 shadow ring-2 ring-white">
            {user?.name.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1">
            {!audioBlob && (
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50/70 backdrop-blur placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-teal-600 focus:border-teal-600 outline-none"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    addComment();
                  }
                }}
              />
            )}

            <div className="flex items-center gap-2 mt-3">
              {!isRecording && !audioBlob && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center px-3 py-1.5 border border-teal-200 text-teal-700 bg-teal-50 rounded-lg text-sm hover:bg-teal-100 hover:border-teal-300 transition-colors"
                  title="Start voice recording"
                >
                  <Mic className="h-4 w-4 mr-1 text-teal-700" /> Record
                </button>
              )}
              {isRecording && (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center px-3 py-1.5 border border-red-300 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors"
                  title="Stop recording"
                >
                  <Square className="h-4 w-4 mr-1" /> Stop
                </button>
              )}
              {audioBlob && (
                <>
                  <button
                    type="button"
                    onClick={playAudio}
                    className="flex items-center px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                    title="Play recording"
                  >
                    <Play className="h-4 w-4 mr-1 text-gray-700" /> Play
                  </button>
                  <button
                    type="button"
                    onClick={clearAudio}
                    className="flex items-center px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-100 text-gray-700 transition-colors"
                    title="Remove recording"
                  >
                    <Trash2 className="h-4 w-4 mr-1 text-gray-600" /> Remove
                  </button>
                </>
              )}
              {recError && (
                <span className="text-xs text-red-600">{recError}</span>
              )}
            </div>

            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-gray-500">
                {audioBlob ? "Ready to send voice comment" : "Press Cmd+Enter to send"}
              </p>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  addComment();
                }}
                disabled={!audioBlob && !newComment.trim() || loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg shadow hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                Comment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentsPanel;
