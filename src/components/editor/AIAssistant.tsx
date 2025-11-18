import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle, Zap, Languages, FileText, Loader } from 'lucide-react';

interface Props {
  content: string;
  onClose: () => void;
  autoWhileTyping?: boolean;
  debounceMs?: number;
}

const AIAssistant: React.FC<Props> = ({ content, onClose, autoWhileTyping = false, debounceMs = 1500 }) => {
  const [activeTab, setActiveTab] = useState<'grammar' | 'complete' | 'translate' | 'summarize'>('grammar');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedText, setSelectedText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('Auto');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const lastCheckedRef = useRef<string>("");
  const debounceTimerRef = useRef<number>();
  const lastCompletedRef = useRef<string>("");

  const getToken = () => localStorage.getItem('token');

  const runGrammarCheck = async () => {
    if (!selectedText && !content) return;
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/ai/grammar-check', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: selectedText || content }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setResult(data);
      }
    } catch (error) {
      console.error('Grammar check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const runTextCompletion = async () => {
    if (!selectedText) return;
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/ai/complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: selectedText,
          context: content.substring(0, 500)
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setResult(data);
      }
    } catch (error) {
      console.error('Text completion failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const runTranslation = async () => {
    if (!selectedText && !content) return;
    
    setLoading(true);
    try {
      const payload: any = {
        text: selectedText || content,
        targetLanguage,
      };
      if (sourceLanguage !== 'Auto') {
        payload.sourceLanguage = sourceLanguage;
      }
      const response = await fetch('http://localhost:3001/api/ai/translate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        const data = await response.json();
        setResult(data);
      }
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSummarization = async () => {
    if (!content) return;
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/ai/summarize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: content,
          length: 'medium'
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setResult(data);
      }
    } catch (error) {
      console.error('Summarization failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyCorrection = (_original: string, suggestion: string) => {
    // In a real implementation, this would replace the text in the editor
    navigator.clipboard.writeText(suggestion);
    alert('Correction copied to clipboard!');
  };

  const applyCompletion = (completion: string) => {
    navigator.clipboard.writeText(completion);
    alert('Completion copied to clipboard!');
  };

  const tabs = [
    { id: 'grammar', label: 'Grammar', icon: CheckCircle },
    { id: 'complete', label: 'Complete', icon: Zap },
    { id: 'translate', label: 'Translate', icon: Languages },
    { id: 'summarize', label: 'Summarize', icon: FileText },
  ];

  // Auto-trigger grammar check while typing (debounced)
  useEffect(() => {
    if (!autoWhileTyping) return;
    if (activeTab !== 'grammar') return;
    const textToCheck = (selectedText || content || '').trim();
    if (!textToCheck) return;

    // Avoid duplicate checks for unchanged content
    if (textToCheck === lastCheckedRef.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(async () => {
      // Re-check latest snapshot
      const latestText = (selectedText || content || '').trim();
      if (!latestText || latestText === lastCheckedRef.current) return;
      // Run grammar check silently
      setLoading(true);
      try {
        const response = await fetch('http://localhost:3001/api/ai/grammar-check', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: latestText }),
        });
        if (response.ok) {
          const data = await response.json();
          setResult(data);
          lastCheckedRef.current = latestText;
        }
      } catch (err) {
        // Silent fail to avoid interrupting typing
        console.error('Auto grammar check failed:', err);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // We intentionally watch content and selectedText to retrigger debounced checks
  }, [autoWhileTyping, debounceMs, activeTab, content, selectedText]);

  // Auto-trigger text completion while typing (debounced)
  useEffect(() => {
    if (!autoWhileTyping) return;
    if (activeTab !== 'complete') return;
    const contentTail = (content || '').slice(Math.max(0, (content || '').length - 200));
    const textToComplete = (selectedText || contentTail || '').trim();
    if (textToComplete.length < 5) return; // require minimal context

    if (textToComplete === lastCompletedRef.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(async () => {
      const latestTail = (content || '').slice(Math.max(0, (content || '').length - 200));
      const latest = (selectedText || latestTail || '').trim();
      if (!latest || latest === lastCompletedRef.current) return;
      setLoading(true);
      try {
        const response = await fetch('http://localhost:3001/api/ai/complete', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            text: latest,
            context: content.substring(0, 500)
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setResult(data);
          lastCompletedRef.current = latest;
        }
      } catch (err) {
        console.error('Auto text completion failed:', err);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [autoWhileTyping, debounceMs, activeTab, content, selectedText]);

  return (
    <div className="h-full flex flex-col min-w-0 component-shell component-padding">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between p-4 border-b border-transparent bg-gradient-to-r from-teal-500 via-emerald-600 to-teal-700 text-white rounded-lg">
        <h3 className="font-semibold">AI Assistant</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="sticky top-12 z-10 border-b border-teal-200 bg-white/70 backdrop-blur">
        <div className="flex overflow-x-auto gap-2 p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setResult(null);
                }}
                className={`flex-none inline-flex items-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors border shadow-sm ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white border-transparent'
                    : 'bg-white/90 text-gray-700 border-teal-200 hover:bg-teal-50'
                }`}
              >
                <Icon className="h-4 w-4 mr-1" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {activeTab === 'grammar' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Check your document for grammar and spelling errors.
            </p>
            
            <textarea
              value={selectedText}
              onChange={(e) => setSelectedText(e.target.value)}
              placeholder="Paste text to check, or leave empty to check entire document"
              className="input-teal h-24 resize-none text-sm"
            />
            
            <button
              onClick={runGrammarCheck}
              disabled={loading}
              className="w-full mt-3 btn-primary-teal disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader className="animate-spin h-4 w-4 mr-2" />
                  Checking...
                </div>
              ) : (
                'Check Grammar'
              )}
            </button>
            
            {result && (
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">Corrected Text</h4>
                  <p className="text-sm text-green-700">{result.corrected}</p>
                </div>
                
                {result.suggestions && result.suggestions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Suggestions</h4>
                    {result.suggestions.map((suggestion: any, index: number) => (
                      <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-yellow-800">
                              "{suggestion.original}" → "{suggestion.suggestion}"
                            </p>
                            <p className="text-xs text-yellow-600 mt-1">{suggestion.reason}</p>
                          </div>
                          <button
                            onClick={() => applyCorrection(suggestion.original, suggestion.suggestion)}
                            className="ml-2 px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'complete' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Get AI-powered text completions for your writing.
            </p>
            
            <textarea
              value={selectedText}
              onChange={(e) => setSelectedText(e.target.value)}
              placeholder="Enter partial text to complete"
              className="input-teal h-24 resize-none text-sm"
            />
            
            <button
              onClick={runTextCompletion}
              disabled={loading || !selectedText}
              className="w-full mt-3 btn-primary-teal disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader className="animate-spin h-4 w-4 mr-2" />
                  Generating...
                </div>
              ) : (
                'Complete Text'
              )}
            </button>
            
            {result && result.completions && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-800 mb-2">Suggestions</h4>
                {result.completions.map((completion: string, index: number) => (
                  <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm text-blue-800 flex-1">{completion}</p>
                      <button
                        onClick={() => applyCompletion(completion)}
                        className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'translate' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Translate your text to different languages.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source Language
                </label>
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className="input-teal text-sm"
                >
                  <option value="Auto">Auto</option>
                  <option value="English">English</option>
                  <option value="Kannada">Kannada</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Telugu">Telugu</option>
                  <option value="Malayalam">Malayalam</option>
                  <option value="Marathi">Marathi</option>
                  <option value="Gujarati">Gujarati</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Punjabi">Punjabi</option>
                  <option value="Urdu">Urdu</option>
                  <option value="Assamese">Assamese</option>
                  <option value="Odia">Odia</option>
                  <option value="Sanskrit">Sanskrit</option>
                  <option value="Nepali">Nepali</option>
                  <option value="Sindhi">Sindhi</option>
                  <option value="Konkani">Konkani</option>
                  <option value="Maithili">Maithili</option>
                  <option value="Dogri">Dogri</option>
                  <option value="Kashmiri">Kashmiri</option>
                  <option value="Manipuri (Meitei)">Manipuri (Meitei)</option>
                </select>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Language
              </label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="input-teal text-sm"
              >
                <option value="English">English</option>
                <option value="Kannada">Kannada</option>
                <option value="Hindi">Hindi</option>
                <option value="Tamil">Tamil</option>
                <option value="Telugu">Telugu</option>
                <option value="Malayalam">Malayalam</option>
                <option value="Marathi">Marathi</option>
                <option value="Gujarati">Gujarati</option>
                <option value="Bengali">Bengali</option>
                <option value="Punjabi">Punjabi</option>
                <option value="Urdu">Urdu</option>
                <option value="Assamese">Assamese</option>
                <option value="Odia">Odia</option>
                <option value="Sanskrit">Sanskrit</option>
                <option value="Nepali">Nepali</option>
                <option value="Sindhi">Sindhi</option>
                <option value="Konkani">Konkani</option>
                <option value="Maithili">Maithili</option>
                <option value="Dogri">Dogri</option>
                <option value="Kashmiri">Kashmiri</option>
                <option value="Manipuri (Meitei)">Manipuri (Meitei)</option>
              </select>
            </div>

            <div className="mb-3">
              <button
                type="button"
                onClick={() => {
                  if (sourceLanguage === 'Auto') return;
                  const prevSource = sourceLanguage;
                  const prevTarget = targetLanguage;
                  setSourceLanguage(prevTarget);
                  setTargetLanguage(prevSource);
                }}
                className="btn-outline-teal smooth"
              >
                Swap Languages
              </button>
            </div>
            
            <textarea
              value={selectedText}
              onChange={(e) => setSelectedText(e.target.value)}
              placeholder="Enter text to translate, or leave empty to translate entire document"
              className="input-teal h-24 resize-none text-sm"
            />
            
            <button
              onClick={runTranslation}
              disabled={loading}
              className="w-full mt-3 btn-primary-teal disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader className="animate-spin h-4 w-4 mr-2" />
                  Translating...
                </div>
              ) : (
                `Translate to ${targetLanguage}`
              )}
            </button>
            
            {result && result.translation && (
              <div className="mt-4">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="font-medium text-purple-800 mb-2">Translation</h4>
                  <p className="text-sm text-purple-700">{result.translation}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.translation);
                      alert('Translation copied to clipboard!');
                    }}
                    className="mt-2 px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                  >
                    Copy Translation
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'summarize' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Generate a summary of your document content.
            </p>
            
            <button
              onClick={runSummarization}
              disabled={loading || !content}
              className="w-full btn-primary-teal disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader className="animate-spin h-4 w-4 mr-2" />
                  Summarizing...
                </div>
              ) : (
                'Summarize Document'
              )}
            </button>
            
            {result && result.summary && (
              <div className="mt-4">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <h4 className="font-medium text-indigo-800 mb-2">Summary</h4>
                  <p className="text-sm text-indigo-700 whitespace-pre-wrap">{result.summary}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.summary);
                      alert('Summary copied to clipboard!');
                    }}
                    className="mt-2 px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                  >
                    Copy Summary
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;