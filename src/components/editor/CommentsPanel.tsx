import React, { useState, useEffect } from "react";
import { X, MessageSquare, Send, Check, Mic, Square, Play, Trash2 } from "lucide-react";
import { useSocket } from "../../contexts/SocketContext";
import { useAuth } from "../../contexts/AuthContext";

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
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [recordTime, setRecordTime] = useState<number>(0);
  const [recordTimerId, setRecordTimerId] = useState<number | null>(null);
  const { socket } = useSocket();
  const { user } = useAuth();

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

  useEffect(() => {
    return () => {
      // Cleanup: stop recording and tracks if component unmounts
      try {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      } catch {}
    };
  }, [mediaRecorder]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:3001/api/documents/${documentId}/comments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Fetched comments:", data);
        setComments(data);
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
  };

  const addComment = () => {
    if (!socket) return;
    const hasText = Boolean(newComment.trim());
    const hasAudio = Boolean(audioUrl);
    if (!hasText && !hasAudio) return;

    // Prefer sending audio if present; if both present, concatenate text and include audio URL line
    let payloadContent = "";
    if (hasAudio && hasText) {
      payloadContent = `${newComment}\n${audioUrl}`;
    } else if (hasAudio) {
      payloadContent = audioUrl;
    } else {
      payloadContent = newComment;
    }

    socket.emit("add-comment", {
      content: payloadContent,
      position: 0, // In a real implementation, this would be the cursor position
    });

    setNewComment("");
    resetAudio();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 3600);

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioUrl(reader.result as string);
        };
        reader.readAsDataURL(blob);
        setAudioChunks(chunks);
        // stop tracks
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setMediaRecorder(mr);
      setAudioChunks([]);
      setRecording(true);
      setRecordTime(0);
      const id = window.setInterval(() => setRecordTime((t) => t + 1), 1000);
      setRecordTimerId(id);
    } catch (err) {
      console.error("Microphone permission denied or unsupported:", err);
      alert("Unable to access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (!recording || !mediaRecorder) return;
    try {
      mediaRecorder.stop();
    } catch {}
    setRecording(false);
    if (recordTimerId) {
      window.clearInterval(recordTimerId);
      setRecordTimerId(null);
    }
  };

  const resetAudio = () => {
    setAudioUrl("");
    setAudioChunks([]);
    setRecording(false);
    setRecordTime(0);
    if (recordTimerId) {
      window.clearInterval(recordTimerId);
      setRecordTimerId(null);
    }
    try {
      if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    } catch {}
    setMediaRecorder(null);
  };

  return (
    <div className="h-full flex flex-col component-shell component-padding">
      {/* Header */}
      <div className="component-header flex items-center justify-between p-4">
        <h3 className="font-semibold text-white">Comments</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <MessageSquare className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">No comments yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Start a conversation about this document
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-white border border-gray-200 rounded-lg p-3"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {comment.user.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">
                        {comment.user.name}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>

                    {comment.content?.startsWith("data:audio") ? (
                      <div className="mt-2">
                        <audio controls src={comment.content} className="w-full" />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
                    )}

                    {Boolean(comment.resolved) && (
                      <div className="flex items-center mt-2 text-xs text-green-600">
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

      {/* Add Comment */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-3">
          <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
            {user?.name.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              rows={3}
              onKeyPress={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  addComment();
                }
              }}
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-2 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    recording ? stopRecording() : startRecording();
                  }}
                  className={`inline-flex items-center px-2 py-1 rounded-md text-sm border ${recording ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"}`}
                  title={recording ? "Stop recording" : "Record voice note"}
                >
                  {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  <span className="ml-1">{recording ? `Stop (${Math.floor(recordTime / 60)}:${String(recordTime % 60).padStart(2, "0")})` : "Voice"}</span>
                </button>
                {audioUrl && !recording && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <audio controls src={audioUrl} className="w-64 max-w-full" />
                    <button
                      onClick={(e) => { e.preventDefault(); resetAudio(); }}
                      className="p-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100"
                      title="Remove audio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); addComment(); }}
                      disabled={loading}
                      className="inline-flex items-center px-2 py-1 rounded-md text-sm bg-indigo-600 text-white hover:bg-indigo-700"
                      title="Send voice note"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Send voice
                    </button>
                  </div>
                )}
                {/* Mobile/compact send button */}
                <button
                  onClick={(e) => { e.preventDefault(); addComment(); }}
                  disabled={(!newComment.trim() && !audioUrl) || loading}
                  className="inline-flex items-center justify-center p-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 sm:hidden"
                  title="Send"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  addComment();
                }}
                disabled={(!newComment.trim() && !audioUrl) || loading}
                className="flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-3 w-3 mr-1" />
                Comment
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Press Cmd/Ctrl+Enter to send</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentsPanel;
