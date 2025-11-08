import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  Users,
} from "lucide-react";
import DailyIframe from "@daily-co/daily-js";
import { useSocket } from "../../contexts/SocketContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

interface Props {
  documentId: string;
  onClose: () => void;
  autoJoin?: boolean;
  initialRoomUrl?: string;
}

interface CallState {
  isActive: boolean;
  participants: string[];
  roomUrl?: string;
}

const VideoChat: React.FC<Props> = ({ documentId, onClose, autoJoin = false, initialRoomUrl }) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    participants: [],
  });
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const [participantCount, setParticipantCount] = useState(0);

  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();
  const { user } = useAuth();
  const { showVideoCallToast, showSuccessToast, showErrorToast } = useToast();

  useEffect(() => {
    if (socket) {
      // Only keep local video call state management events
      socket.on("call-state-update", handleCallStateUpdate);

      // Request current call state
      socket.emit("get-call-state", { documentId });

      return () => {
        socket.off("call-state-update");
      };
    }
  }, [socket, documentId]);

  // Auto-join when the component opens from an accepted incoming call
  useEffect(() => {
    if (autoJoin && !isCallActive) {
      // If we already know the room URL (from accept), prefer it
      if (initialRoomUrl) {
        setCallState((prev) => ({ ...prev, isActive: true, roomUrl: initialRoomUrl }));
      }
      // Defer join slightly to allow state propagation
      const t = setTimeout(() => {
        joinCall();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [autoJoin, isCallActive, initialRoomUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
      }
    };
  }, []);

  // Handle call started from DocumentEditor notifications
  useEffect(() => {
    if (socket) {
      const handleCallStarted = (data: {
        initiator: string;
        initiatorName: string;
        participants: string[];
        roomUrl?: string;
      }) => {
        console.log("Call started:", data);
        if (data.initiator !== user?.id) {
          setCallState({
            isActive: true,
            participants: data.participants,
            roomUrl: data.roomUrl,
          });
          setShowJoinPrompt(true);
        }
      };

      const handleCallEnded = () => {
        console.log("Call ended");
        setCallState({ isActive: false, participants: [] });
        setShowJoinPrompt(false);
        endCall();
      };

      socket.on("call-started", handleCallStarted);
      socket.on("call-ended", handleCallEnded);

      return () => {
        socket.off("call-started", handleCallStarted);
        socket.off("call-ended", handleCallEnded);
      };
    }
  }, [socket, user?.id]);

  const handleCallStateUpdate = useCallback((data: CallState) => {
    console.log("Call state update:", data);
    setCallState(data);
    if (!data.isActive) {
      setShowJoinPrompt(false);
      endCall();
    }
  }, []);

  const createDailyRoom = async () => {
    try {
      // Use the fixed public room for showcase
      const roomUrl = `https://ai-docs-meet.daily.co/collabedit`;

      return roomUrl;
    } catch (error) {
      console.error("Failed to create Daily room:", error);
      throw error;
    }
  };

  const startCall = async () => {
    try {
      setConnectionStatus("Creating video room...");
      console.log("Starting call with Daily.co");

      // Create or get room URL
      const roomUrl = await createDailyRoom();

      // Create Daily call frame
      callFrameRef.current = DailyIframe.createFrame(containerRef.current!, {
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: "8px",
        },
        showLeaveButton: false,
        showFullscreenButton: false,
        showParticipantsBar: true,
        activeSpeakerMode: true,
      });

      // Set up event listeners
      callFrameRef.current
        .on("joined-meeting", () => {
          console.log("Joined Daily meeting");
          setIsCallActive(true);
          setConnectionStatus("");

          // Show success toast for the person who created the room
          showSuccessToast(
            "Video Room Created",
            "You successfully created a video room"
          );
        })
        .on("participant-joined", (event: any) => {
          console.log("Participant joined:", event.participant);
          setParticipantCount((prev) => prev + 1);
        })
        .on("participant-left", (event: any) => {
          console.log("Participant left:", event.participant);
          setParticipantCount((prev) => Math.max(0, prev - 1));
        })
        .on("left-meeting", () => {
          console.log("Left Daily meeting");
          setIsCallActive(false);
          setParticipantCount(0);
        })
        .on("error", (error: any) => {
          console.error("Daily error:", error);
          setConnectionStatus("");
          alert("Failed to join video call. Please try again later.");
        });

      // Join the room
      await callFrameRef.current.join({
        url: roomUrl,
        userName: user?.name || "Anonymous",
      });

      setShowJoinPrompt(false);

      // Notify server about the call
      if (socket) {
        socket.emit("start-call", {
          documentId,
          name: user?.name,
          roomUrl,
        });
      }
    } catch (error) {
      console.error("Failed to start call:", error);
      setConnectionStatus("");
      showErrorToast(
        "Call Failed",
        "Failed to start video call. Please try again."
      );
    }
  };

  const joinCall = async () => {
    try {
      setConnectionStatus("Joining video call...");

      // Use the same room URL logic as starting a call
      const roomUrl = initialRoomUrl || callState.roomUrl || (await createDailyRoom());

      // Create Daily call frame
      callFrameRef.current = DailyIframe.createFrame(containerRef.current!, {
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: "8px",
        },
        showLeaveButton: false,
        showFullscreenButton: false,
        showParticipantsBar: true,
        activeSpeakerMode: true,
      });

      // Set up event listeners
      callFrameRef.current
        .on("joined-meeting", () => {
          console.log("Joined Daily meeting");
          setIsCallActive(true);
          setShowJoinPrompt(false);
          setConnectionStatus("");

          // Show success toast
          showSuccessToast(
            "Joined Call",
            "You've successfully joined the video call"
          );
        })
        .on("participant-joined", (event: any) => {
          console.log("Participant joined:", event.participant);
          setParticipantCount((prev) => prev + 1);
        })
        .on("participant-left", (event: any) => {
          console.log("Participant left:", event.participant);
          setParticipantCount((prev) => Math.max(0, prev - 1));
        })
        .on("left-meeting", () => {
          console.log("Left Daily meeting");
          setIsCallActive(false);
          setParticipantCount(0);
        })
        .on("error", (error: any) => {
          console.error("Daily error:", error);
          setConnectionStatus("");
          alert("Failed to join video call. Please try again.");
        });

      // Join the room
      try {
        await callFrameRef.current.join({
          url: roomUrl,
          userName: user?.name || "Anonymous",
        });
      } catch (joinError) {
        console.error("Failed to join room:", joinError);
        throw joinError;
      }

      setShowJoinPrompt(false);

      // Notify server that we joined
      if (socket) {
        socket.emit("start-call", {
          documentId,
          name: user?.name,
          roomUrl,
        });
      }
    } catch (error) {
      console.error("Failed to join call:", error);
      setConnectionStatus("");
      showErrorToast(
        "Join Failed",
        "Failed to join video call. Please try again."
      );
    }
  };

  const endCall = () => {
    console.log("Ending call");

    if (callFrameRef.current) {
      callFrameRef.current.leave();
      callFrameRef.current.destroy();
      callFrameRef.current = null;
    }

    setIsCallActive(false);
    setParticipantCount(0);
    setConnectionStatus("");

    if (socket) {
      socket.emit("end-call", { documentId });
    }
  };

  const toggleVideo = async () => {
    if (callFrameRef.current) {
      const newEnabled = !isVideoEnabled;
      await callFrameRef.current.setLocalVideo(newEnabled);
      setIsVideoEnabled(newEnabled);
      console.log("🎥 Video toggled:", newEnabled);
    }
  };

  const toggleAudio = async () => {
    if (callFrameRef.current) {
      const newEnabled = !isAudioEnabled;
      await callFrameRef.current.setLocalAudio(newEnabled);
      setIsAudioEnabled(newEnabled);
      console.log("🎤 Audio toggled:", newEnabled);
    }
  };

  return (
    <div className="h-full flex flex-col component-shell component-padding min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-wrap gap-2">
        <div className="flex items-center">
          <h3 className="font-semibold text-gray-900">Video Chat</h3>
          {isCallActive && participantCount > 0 && (
            <div className="ml-3 flex items-center text-sm text-gray-600">
              <Users className="h-4 w-4 mr-1" />
              <span>
                {participantCount + 1} participant
                {participantCount !== 0 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Join Call Prompt */}
      {showJoinPrompt && !isCallActive && (
        <div className="p-4 bg-teal-50 border-b border-teal-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-teal-900">
                Video call in progress
              </p>
              <p className="text-xs text-teal-700">
                Someone started a video call
              </p>
            </div>
            <button
              onClick={joinCall}
              className="flex items-center px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors"
            >
              <PhoneCall className="h-3 w-3 mr-1" />
              Join Call
            </button>
          </div>
        </div>
      )}

      {/* Connection Status */}
      {connectionStatus && (
        <div className="p-2 bg-yellow-50 border-b border-yellow-200">
          <p className="text-sm text-yellow-800 text-center">
            {connectionStatus}
          </p>
        </div>
      )}

      {/* Video Area */}
      <div className="flex-1 p-4 min-h-0">
        {!isCallActive ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-teal-100 rounded-full p-6 mb-4">
              <Video className="h-12 w-12 text-teal-600" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Start Video Call
            </h4>
            <p className="text-gray-600 mb-6">
              Connect with your collaborators face-to-face using Daily.co
            </p>
            <button
              onClick={startCall}
              className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center"
            >
              <Video className="h-5 w-5 mr-2" />
              Start Call
            </button>
          </div>
        ) : (
          <div className="h-full flex flex-col min-h-0">
            {/* Daily.co Video Container */}
            <div className="flex-1 mb-4 bg-gray-900 rounded-lg overflow-hidden min-h-0">
              <div ref={containerRef} className="w-full h-full" />
            </div>

            {/* Call Controls */}
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={toggleAudio}
                className={`p-3 rounded-full transition-colors ${
                  isAudioEnabled
                    ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }`}
                title={isAudioEnabled ? "Mute" : "Unmute"}
              >
                {isAudioEnabled ? (
                  <Mic className="h-5 w-5" />
                ) : (
                  <MicOff className="h-5 w-5" />
                )}
              </button>

              <button
                onClick={toggleVideo}
                className={`p-3 rounded-full transition-colors ${
                  isVideoEnabled
                    ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }`}
                title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
              >
                {isVideoEnabled ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )}
              </button>

              <button
                onClick={endCall}
                className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                title="End call"
              >
                <Phone className="h-5 w-5 rotate-135" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoChat;
