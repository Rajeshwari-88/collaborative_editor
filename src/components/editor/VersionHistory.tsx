import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, User, RotateCcw, Search } from 'lucide-react';

interface Version {
  id: string;
  version_number: number;
  content: string;
  created_by_name: string;
  created_at: string;
}

interface Props {
  documentId: string;
  onRestore: (content: string) => void;
  onClose: () => void;
}

const VersionHistory: React.FC<Props> = ({ documentId, onRestore, onClose }) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  const fetchVersions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/documents/${documentId}/versions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getContentPreview = (content: string) => {
    const textContent = content.replace(/<[^>]*>/g, ''); // Strip HTML
    return textContent.substring(0, 100) + (textContent.length > 100 ? '...' : '');
  };

  const filteredVersions = useMemo(() => {
    if (!query.trim()) return versions;
    const q = query.toLowerCase();
    return versions.filter((v) => {
      const dateStr = formatDate(v.created_at).toLowerCase();
      return (
        String(v.version_number).includes(q) ||
        (v.created_by_name || '').toLowerCase().includes(q) ||
        dateStr.includes(q) ||
        getContentPreview(v.content).toLowerCase().includes(q)
      );
    });
  }, [versions, query]);

  const handleRestore = (version: Version) => {
    if (confirm(`Are you sure you want to restore to version ${version.version_number}? This will replace the current content.`)) {
      onRestore(version.content);
      alert('Version restored successfully!');
    }
  };

  return (
    <div className="h-full flex flex-col component-shell component-padding min-h-0">
      {/* Header */}
      <div className="component-header flex items-center justify-between p-4 flex-wrap gap-2">
        <h3 className="font-semibold text-white">Version History</h3>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search versions..."
            className="pl-8 pr-3 py-1.5 bg-white/90 text-gray-800 rounded-lg text-sm border border-teal-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
        {/* Versions List */}
        <div className="md:w-1/2 w-full border-b md:border-b-0 md:border-r border-gray-200 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
            </div>
          ) : filteredVersions.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No versions found</p>
            </div>
          ) : (
            <div className="p-2">
              {filteredVersions.map((version) => (
                <div
                  key={version.id}
                  onClick={() => setSelectedVersion(version)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors mb-2 border ${
                    selectedVersion?.id === version.id
                      ? 'bg-teal-50 border-teal-200'
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  } shadow-sm`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center text-sm gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-teal-100 text-teal-800 border border-teal-200">
                          v{version.version_number}
                        </span>
                        <span className="font-medium text-gray-900">{formatDate(version.created_at)}</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <User className="h-3 w-3 mr-1" />
                        <span>{version.created_by_name}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                        {getContentPreview(version.content)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Version Preview */}
        <div className="md:w-1/2 w-full flex flex-col min-h-0">
          {selectedVersion ? (
            <>
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      Version {selectedVersion.version_number}
                    </h4>
                    <p className="text-sm text-gray-600">
                      By {selectedVersion.created_by_name} • {formatDate(selectedVersion.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(selectedVersion)}
                    className="flex items-center px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors shadow"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restore
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedVersion.content }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">Select a version to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VersionHistory;