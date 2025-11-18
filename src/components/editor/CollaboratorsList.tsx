import React, { useEffect, useState } from "react";
import { X, UserPlus, Crown, Edit3, Eye, MessageCircle } from "lucide-react";

interface ActiveUser {
  userId: string;
  name: string;
  avatar?: string;
  cursorPosition: number;
}

interface Document {
  id: string;
  role: string;
}

interface Props {
  activeUsers: ActiveUser[];
  document: Document;
  onClose: () => void;
}

const CollaboratorsList: React.FC<Props> = ({
  activeUsers,
  document,
  onClose,
}) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("editor");
  const [allCollaborators, setAllCollaborators] = useState<any[]>([]);

  useEffect(() => {
    fetchAllCollaborators();
  }, [document.id]);

  const fetchAllCollaborators = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:3001/api/documents/${document.id}/collaborators`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const collaborators = await response.json();
        setAllCollaborators(collaborators);
      }
    } catch (error) {
      console.error("Failed to fetch collaborators:", error);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-4 w-4" />;
      case "editor":
        return <Edit3 className="h-4 w-4" />;
      case "viewer":
        return <Eye className="h-4 w-4" />;
      case "commenter":
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const shareDocument = async () => {
    if (!shareEmail.trim()) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:3001/api/documents/${document.id}/share`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: shareEmail, role: shareRole }),
        }
      );

      if (response.ok) {
        setShowShareModal(false);
        setShareEmail("");
        fetchAllCollaborators(); // Refresh the collaborators list
        alert("Document shared successfully!");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to share document");
      }
    } catch (error) {
      alert("Failed to share document");
    }
  };

  return (
    <div className="h-full flex flex-col component-shell component-padding">
      {/* Header */}
      <div className="component-header flex items-center justify-between p-4">
        <h3 className="font-semibold text-gray-900">Collaborators</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Active Users */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Currently Active
          </h4>
          {activeUsers.length === 0 ? (
            <p className="text-sm text-gray-500">No active collaborators</p>
          ) : (
            <div className="space-y-3">
              {activeUsers.map((user) => (
                <div key={user.userId} className="flex items-center">
                  <div className="relative">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500">Online now</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Collaborators */}
        {allCollaborators.length > 0 && (
          <div className="p-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              All Collaborators
            </h4>
            <div className="space-y-3">
              {allCollaborators.map((collaborator) => {
                const isActive = activeUsers.some(
                  (u) => u.userId === collaborator.user_id
                );
                return (
                  <div key={collaborator.user_id} className="flex items-center">
                    <div className="relative">
                      <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {collaborator.user_name.charAt(0).toUpperCase()}
                      </div>
                      {isActive && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {collaborator.user_name}
                      </p>
                      <div className="flex items-center text-xs text-gray-500">
                        {getRoleIcon(collaborator.role)}
                        <span className="ml-1 capitalize">
                          {collaborator.role}
                        </span>
                        {isActive && (
                          <span className="ml-2 text-green-600">• Online</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Share Document */}
        {document.role === "owner" && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => setShowShareModal(true)}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Share Document
            </button>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-10">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Share Document
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permission level
                </label>
                <select
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="editor">Can edit</option>
                  <option value="commenter">Can comment</option>
                  <option value="viewer">Can view</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={shareDocument}
                disabled={!shareEmail.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaboratorsList;
