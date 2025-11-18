import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../../contexts/SocketContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import EditorToolbar from "./EditorToolbar";
import CollaboratorsList from "./CollaboratorsList";
import AIAssistant from "./AIAssistant";
import VideoChat from "./VideoChat";
import VersionHistory from "./VersionHistory";
import CommentsPanel from "./CommentsPanel";
import { ArrowLeft, Users, MessageSquare, Video, Brain, History, Download, FileText as FileTextIcon, FileDown, File, ChevronDown } from "lucide-react";

interface Document {
  id: string;
  title: string;
  content: string;
  owner_name: string;
  role: string;
  collaborators: any[];
}

interface ActiveUser {
  userId: string;
  name: string;
  avatar?: string;
  cursorPosition: number;
}

const DocumentEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useAuth();

  const [documentData, setDocumentData] = useState<Document | null>(null);
  const [content, setContent] = useState("");
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarContent, setSidebarContent] = useState<
    "collaborators" | "comments" | "ai" | "video" | "versions"
  >("collaborators");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [suggestionPos, setSuggestionPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [inlineAIEnabled, setInlineAIEnabled] = useState(true);
  const [grammarMenuOpen, setGrammarMenuOpen] = useState(false);
  const [grammarSuggestions, setGrammarSuggestions] = useState<Array<{ original: string; suggestion: string; reason: string }>>([]);
  const [incomingCall, setIncomingCall] = useState<{ initiatorName: string; roomUrl?: string } | null>(null);
  const [incomingModalOpen, setIncomingModalOpen] = useState(false);
  const [momOpen, setMomOpen] = useState(false);
  const [momNotes, setMomNotes] = useState("");
  const [momGenerating, setMomGenerating] = useState(false);
  const [momResult, setMomResult] = useState<string>("");
  const [videoAutoJoin, setVideoAutoJoin] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [inTable, setInTable] = useState(false);
  const currentCellRef = useRef<HTMLTableCellElement | null>(null);
  const [colHandle, setColHandle] = useState<{ top: number; left: number; height: number; visible: boolean }>({ top: 0, left: 0, height: 0, visible: false });
  const [rowHandle, setRowHandle] = useState<{ top: number; left: number; width: number; visible: boolean }>({ top: 0, left: 0, width: 0, visible: false });
  const resizingRef = useRef<{
    type: 'col' | 'row' | null;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    colIndex: number;
    table: HTMLTableElement | null;
    row: HTMLTableRowElement | null;
  }>({ type: null, startX: 0, startY: 0, startWidth: 0, startHeight: 0, colIndex: -1, table: null, row: null });

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<number>();
  const suggestTimeoutRef = useRef<number>();
  const lastCompletedRef = useRef<string>("");
  const grammarTimeoutRef = useRef<number>();
  const lastGrammarTextRef = useRef<string>("");
  const { showVideoCallToast, showSuccessToast, showErrorToast } = useToast();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringTimerRef = useRef<number | null>(null);
  const prevSidebarRef = useRef<{open: boolean; tab: typeof sidebarContent}>({ open: false, tab: "collaborators" });

  const startRingtone = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 800; // base tone
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      let on = true;
      g.gain.value = 0;
      ringTimerRef.current = window.setInterval(() => {
        on = !on;
        g.gain.setTargetAtTime(on ? 0.15 : 0, ctx.currentTime, 0.01);
      }, 400);
      // Stop function stored on context for cleanup
      (ctx as any)._osc = o;
      (ctx as any)._gain = g;
    } catch {}
  };

  const beginColResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = currentCellRef.current;
    if (!cell) return;
    const tr = cell.parentElement as HTMLTableRowElement | null;
    const table = cell.closest('table') as HTMLTableElement | null;
    if (!tr || !table) return;
    const cells = Array.from(tr.children);
    const colIndex = cells.indexOf(cell);
    const startWidth = cell.getBoundingClientRect().width;
    resizingRef.current = {
      type: 'col',
      startX: (e as any).clientX,
      startY: (e as any).clientY,
      startWidth,
      startHeight: 0,
      colIndex,
      table,
      row: null,
    };
    window.addEventListener('mousemove', onColResizeMove);
    window.addEventListener('mouseup', endResize);
  };

  const beginRowResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = currentCellRef.current;
    if (!cell) return;
    const tr = cell.parentElement as HTMLTableRowElement | null;
    const table = cell.closest('table') as HTMLTableElement | null;
    if (!tr || !table) return;
    const startHeight = tr.getBoundingClientRect().height;
    resizingRef.current = {
      type: 'row',
      startX: (e as any).clientX,
      startY: (e as any).clientY,
      startWidth: 0,
      startHeight,
      colIndex: -1,
      table,
      row: tr,
    };
    window.addEventListener('mousemove', onRowResizeMove);
    window.addEventListener('mouseup', endResize);
  };

  const onColResizeMove = (e: MouseEvent) => {
    const st = resizingRef.current;
    if (st.type !== 'col' || !st.table) return;
    const dx = e.clientX - st.startX;
    const target = Math.max(40, st.startWidth + dx);
    Array.from(st.table.rows).forEach(r => {
      const c = r.cells.item(st.colIndex);
      if (c) (c as HTMLTableCellElement).style.width = target + 'px';
    });
  };

  const onRowResizeMove = (e: MouseEvent) => {
    const st = resizingRef.current;
    if (st.type !== 'row' || !st.row) return;
    const dy = e.clientY - st.startY;
    const target = Math.max(24, st.startHeight + dy);
    Array.from(st.row.cells).forEach(c => { (c as HTMLTableCellElement).style.height = target + 'px'; });
  };

  const endResize = () => {
    window.removeEventListener('mousemove', onColResizeMove);
    window.removeEventListener('mousemove', onRowResizeMove as any);
    window.removeEventListener('mouseup', endResize);
    resizingRef.current.type = null;
    // sync
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      setContent(newContent);
      if (socket && documentData) {
        socket.emit('text-change', { content: newContent, selection: getSelectionRange() });
      }
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveDocument(newContent), 2000);
    }
  };

  const getCurrentTableCell = (): HTMLTableCellElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && editorRef.current && node !== editorRef.current) {
      if (node instanceof HTMLTableCellElement) return node;
      node = node.parentNode;
    }
    return null;
  };

  const handleTableAdjust = (action: 'col:inc' | 'col:dec' | 'row:inc' | 'row:dec') => {
    const cell = getCurrentTableCell();
    if (!cell) return;
    const tr = cell.parentElement as HTMLTableRowElement | null;
    const table = cell.closest('table') as HTMLTableElement | null;
    if (!tr || !table) return;
    const delta = (action === 'col:inc' || action === 'row:inc') ? 20 : -20;

    if (action.startsWith('col')) {
      const cells = Array.from(tr.children);
      const colIndex = cells.indexOf(cell);
      if (colIndex < 0) return;
      const targetWidth = Math.max(40, (cell.getBoundingClientRect().width || 0) + delta);
      // apply inline width to each row's same column cell
      Array.from(table.rows).forEach(r => {
        const c = r.cells.item(colIndex) as HTMLTableCellElement | null;
        if (c) c.style.width = targetWidth + 'px';
      });
    } else {
      const targetHeight = Math.max(24, (tr.getBoundingClientRect().height || 0) + delta);
      // apply inline height to each cell in the row
      Array.from(tr.cells).forEach(c => {
        (c as HTMLTableCellElement).style.height = targetHeight + 'px';
      });
    }

    // sync content after DOM changes
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      setContent(newContent);
      if (socket && documentData) {
        socket.emit('text-change', { content: newContent, selection: getSelectionRange() });
      }
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveDocument(newContent), 2000);
    }
  };

  const stopRingtone = () => {
    try {
      if (ringTimerRef.current) { clearInterval(ringTimerRef.current); ringTimerRef.current = null; }
      const ctx = audioCtxRef.current as any;
      if (ctx && ctx._gain) ctx._gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      if (ctx && ctx._osc) { try { ctx._osc.stop(); } catch {} }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    } catch {}
  };

  useEffect(() => {
    // Ask for notification permission early (non-blocking)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch {}
      }
    }

    if (id) {
      fetchDocument();
      if (socket) {
        socket.emit("join-document", id);

        // Socket event listeners
        socket.on("text-changed", handleTextChanged);
        socket.on("user-joined", handleUserJoined);
        socket.on("user-left", handleUserLeft);
        socket.on("active-users", setActiveUsers);
        socket.on("cursor-update", handleCursorUpdate);

        // Video call notifications for all users
        socket.on(
          "call-started",
          (data: {
            initiator: string;
            initiatorName: string;
            participants: string[];
            roomUrl?: string;
          }) => {
            // Only show notification to others (not the initiator)
            if (data.initiator !== user?.id) {
              showVideoCallToast(
                "Incoming Call",
                `${data.initiatorName} is starting a video call`
              );
              setIncomingCall({ initiatorName: data.initiatorName, roomUrl: data.roomUrl });
              setIncomingModalOpen(true);
              startRingtone();

              // System-level notification
              if (typeof window !== 'undefined' && 'Notification' in window) {
                const notify = () => {
                  try {
                    const n = new Notification('Incoming Call', {
                      body: `${data.initiatorName} is calling`,
                      icon: '/favicon.ico'
                    });
                    n.onclick = () => {
                      window.focus();
                      setIncomingModalOpen(true);
                      startRingtone();
                      n.close();
                    };
                  } catch {}
                };
                if (Notification.permission === 'granted') {
                  notify();
                } else if (Notification.permission === 'default') {
                  Notification.requestPermission().then((perm) => {
                    if (perm === 'granted') notify();
                  }).catch(() => {});
                }
              }
            }
          }
        );

        // Ensure we still notify if the call already started before we joined
        socket.on(
          "call-state-update",
          (data: { isActive: boolean; participants: string[]; initiator: string; roomUrl?: string }) => {
            if (data.isActive && data.initiator !== user?.id) {
              const initiatorUser = activeUsers.find((u) => u.userId === data.initiator);
              const name = initiatorUser?.name || "Someone";
              setIncomingCall({ initiatorName: name, roomUrl: data.roomUrl });
              setIncomingModalOpen(true);
              startRingtone();
            }
          }
        );

        // Ask server for current call state right after joining the document
        socket.emit("get-call-state", { documentId: id });

        socket.on(
          "user-joined-call",
          (data: { userId: string; name: string }) => {
            if (data.userId !== user?.id) {
              showVideoCallToast(
                "User Joined Call",
                `${data.name} joined the video call`
              );
            }
          }
        );

        socket.on(
          "user-left-call",
          (data: { userId: string; name?: string }) => {
            if (data.userId !== user?.id && data.name) {
              showVideoCallToast(
                "User Left Call",
                `${data.name} left the video call`
              );
            }
          }
        );

        socket.on("call-ended", () => {
          showVideoCallToast("Video Call Ended", "The video call has ended");
          setIncomingCall(null);
          stopRingtone();
          setIncomingModalOpen(false);
          setMomOpen(true);
        });

        return () => {
          socket.off("text-changed");
          socket.off("user-joined");
          socket.off("user-left");
          socket.off("active-users");
          socket.off("cursor-update");
          socket.off("call-started");
          socket.off("call-state-update");
          socket.off("user-joined-call");
          socket.off("user-left-call");
          socket.off("call-ended");
        };

      }
    }
  }, [id, socket, user?.id, showVideoCallToast]);

  // Auto version snapshot every 5 minutes
  useEffect(() => {
    if (!id) return;
    let intervalId: number | undefined;
    const tick = async () => {
      try {
        const token = localStorage.getItem("token");
        await fetch(`http://localhost:3001/api/documents/${id}/versions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (showSuccessToast) {
          showSuccessToast("Version Saved", "Auto-snapshot created");
        }
      } catch (e) {
        if (showErrorToast) {
          showErrorToast("Snapshot Failed", "Could not save version snapshot");
        }
      }
    };
    // Start interval
    intervalId = window.setInterval(tick, 5 * 60 * 1000);
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [id, showSuccessToast, showErrorToast]);

  // Detect closing of Video tab to show MoM as well (user ended manually)
  useEffect(() => {
    const prev = prevSidebarRef.current;
    const now = { open: showSidebar, tab: sidebarContent };
    if (prev.open && prev.tab === 'video' && (!now.open || now.tab !== 'video')) {
      // Video panel just closed -> prompt MoM
      setMomOpen(true);
      stopRingtone();
      setIncomingModalOpen(false);
    }
    prevSidebarRef.current = now;
  }, [showSidebar, sidebarContent]);

  // Keep suggestion aligned with caret on selection changes
  useEffect(() => {
    const handler = () => {
      updateSuggestionPosition();
      // detect if selection is in a table cell
      const sel = window.getSelection();
      let node: Node | null = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
      let found = false;
      while (node && editorRef.current && node !== editorRef.current) {
        if (node instanceof HTMLElement && (node.tagName === 'TD' || node.tagName === 'TH')) { found = true; currentCellRef.current = node as HTMLTableCellElement; break; }
        node = node.parentNode;
      }
      setInTable(found);
      // position resize handles
      if (found && currentCellRef.current && editorRef.current) {
        const cellRect = currentCellRef.current.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();
        const top = cellRect.top - editorRect.top + editorRef.current.scrollTop;
        const left = cellRect.left - editorRect.left + editorRef.current.scrollLeft;
        setColHandle({
          top,
          left: left + cellRect.width - 3,
          height: cellRect.height,
          visible: true,
        });
        setRowHandle({
          top: top + cellRect.height - 3,
          left,
          width: cellRect.width,
          visible: true,
        });
      } else {
        setColHandle((p) => ({ ...p, visible: false }));
        setRowHandle((p) => ({ ...p, visible: false }));
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  // Download helpers
  const getSafeTitle = () => {
    const raw = documentData?.title || "document";
    const cleaned = raw.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "_");
    return cleaned || "document";
  };

  const downloadAsHTML = () => {
    const fileName = `${getSafeTitle()}.html`;
    const html = content || "";
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsText = () => {
    const source = editorRef.current ? editorRef.current.innerText : (content || "").replace(/<[^>]*>/g, " ");
    const text = (source || "").replace(/\s+/g, " ").trim();
    const fileName = `${getSafeTitle()}.txt`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsPDF = () => {
    const title = getSafeTitle();
    const html = content || (editorRef.current ? editorRef.current.innerHTML : "");
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @page { margin: 16mm; }
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111827; }
        h1,h2,h3,h4,h5,h6 { color: #0f766e; }
        img, table { max-width: 100%; }
      </style>
    </head><body>${html}</body></html>`);
    doc.close();

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }
    };
  };

  const downloadAsDoc = () => {
    const title = getSafeTitle();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${content || ""}</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Set initial content when document loads
  useEffect(() => {
    if (
      editorRef.current &&
      content &&
      editorRef.current.innerHTML !== content
    ) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  // Helpers: grammar fix + selection utils
  const applyGrammarFix = (replacement: string) => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.anchorNode;
      while (node && editorRef.current && node !== editorRef.current) {
        if (node instanceof HTMLElement && node.dataset && node.dataset.suggestion !== undefined) {
          node.textContent = replacement;
          const parent = node.parentNode;
          if (parent) {
            while (node.firstChild) parent.insertBefore(node.firstChild, node);
            parent.removeChild(node);
          }
          setGrammarMenuOpen(false);
          return;
        }
        node = node.parentNode;
      }
      try {
        document.execCommand("insertText", false, replacement);
      } catch {}
      setGrammarMenuOpen(false);
    }
  };

  const getCurrentBlockElement = (): HTMLElement | null => {
    if (!editorRef.current) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLElement && /^(P|DIV|LI|H1|H2|H3|H4|H5|H6)$/.test(node.tagName)) {
        return node;
      }
      node = node.parentNode;
    }
    return editorRef.current;
  };

  // Caret helpers: get/set caret character offset within the editor
  const getCaretOffsetWithin = (root: HTMLElement): number => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0);
    let offset = 0;
    const stack: Node[] = [root];
    while (stack.length) {
      const node = stack.shift()!;
      if (node === range.startContainer) {
        return offset + range.startOffset;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        offset += (node.textContent || "").length;
      }
      const children = Array.from(node.childNodes);
      if (children.length) stack.unshift(...children);
    }
    return offset;
  };

  const setCaretOffsetWithin = (root: HTMLElement, targetOffset: number) => {
    const sel = window.getSelection();
    if (!sel) return;
    let offset = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node: Node | null = walker.nextNode();
    while (node) {
      const len = (node.textContent || "").length;
      if (offset + len >= targetOffset) {
        const pos = Math.max(0, Math.min(len, targetOffset - offset));
        const range = document.createRange();
        range.setStart(node, pos);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        break;
      }
      offset += len;
      node = walker.nextNode();
    }
  };

  const triggerBlockGrammarCheck = async () => {
    if (!inlineAIEnabled) return;
    const block = getCurrentBlockElement();
    if (!block) return;
    const text = block.innerText.trim();
    if (!text || text === lastGrammarTextRef.current) return;
    lastGrammarTextRef.current = text;
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("http://localhost:3001/api/ai/grammar-check", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const suggestions: Array<{ original: string; suggestion: string; reason: string }> = data?.suggestions || [];
        setGrammarSuggestions(suggestions);
        // Preserve caret before mutating HTML
        const root = editorRef.current!;
        const caretOffset = getCaretOffsetWithin(root);
        let html = block.innerHTML;
        for (const s of suggestions) {
          if (!s.original) continue;
          const esc = s.original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re = new RegExp(`(${esc})`, "gi");
          html = html.replace(re, '<span class="underline decoration-red-500 decoration-dotted underline-offset-2" data-suggestion="$1">$1</span>');
        }
        block.innerHTML = html;
        updateSuggestionPosition();
        setGrammarMenuOpen(suggestions.length > 0);
        // Restore caret to previous logical position (clamped to new text length)
        const maxLen = (root.innerText || "").length;
        setCaretOffsetWithin(root, Math.min(caretOffset, maxLen));
        root.focus();
      }
    } catch {}
  };

  const fetchDocument = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:3001/api/documents/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const doc = await response.json();
        setDocumentData(doc);
        setContent(doc.content);
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Failed to fetch document:", error);
      navigate("/");
    }
  };

  const handleTextChanged = (data: any) => {
    if (data.userId !== user?.id) {
      setContent(data.content);
      // Only update innerHTML if the content is actually different to avoid cursor reset
      if (editorRef.current && editorRef.current.innerHTML !== data.content) {
        // Save current cursor position
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        const cursorOffset = range ? range.startOffset : 0;
        const parentNode = range ? range.startContainer : null;

        editorRef.current.innerHTML = data.content;

        // Restore cursor position if possible
        if (parentNode && selection && range) {
          try {
            const newRange = document.createRange();
            newRange.setStart(
              parentNode,
              Math.min(cursorOffset, parentNode.textContent?.length || 0)
            );
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } catch (error) {
            // If cursor restoration fails, just focus the editor
            editorRef.current.focus();
          }
        }
      }
    }
  };

  const handleUserJoined = (userData: any) => {
    setActiveUsers((prev) => [
      ...prev.filter((u) => u.userId !== userData.userId),
      userData,
    ]);
  };

  const handleUserLeft = (userData: any) => {
    setActiveUsers((prev) => prev.filter((u) => u.userId !== userData.userId));
  };

  const handleCursorUpdate = (data: any) => {
    setActiveUsers((prev) =>
      prev.map((user) =>
        user.userId === data.userId
          ? { ...user, cursorPosition: data.position }
          : user
      )
    );
  };

  const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerHTML || "";
    setContent(newContent);

    if (socket && documentData) {
      socket.emit("text-change", {
        content: newContent,
        selection: getSelectionRange(),
      });
    }

    // Auto-save after 2 seconds of inactivity
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(newContent);
    }, 2000);

    if (inlineAIEnabled && suggestTimeoutRef.current) {
      clearTimeout(suggestTimeoutRef.current);
    }
    if (inlineAIEnabled) {
      suggestTimeoutRef.current = setTimeout(() => {
        triggerInlineSuggestion(newContent);
      }, 900);
    }

    // Debounced grammar check scoped to current block
    if (inlineAIEnabled && grammarTimeoutRef.current) {
      clearTimeout(grammarTimeoutRef.current);
    }
    if (inlineAIEnabled) {
      grammarTimeoutRef.current = setTimeout(() => {
        triggerBlockGrammarCheck();
      }, 1200);
    }
  };

  const handleFormat = (command: string, value?: string) => {
    if (!editorRef.current) return;

    editorRef.current.focus();

    try {
      // Use execCommand for basic formatting
      if (
        [
          "bold",
          "italic",
          "underline",
          "strikeThrough",
          "undo",
          "redo",
        ].includes(command)
      ) {
        window.document.execCommand(command, false, undefined);
      } else if (
        ["justifyLeft", "justifyCenter", "justifyRight", "justifyFull"].includes(command)
      ) {
        window.document.execCommand(command, false, undefined);
      } else if (
        ["insertUnorderedList", "insertOrderedList"].includes(command)
      ) {
        window.document.execCommand(command, false, undefined);
      } else if (command === "formatBlock" && value) {
        window.document.execCommand("formatBlock", false, value);
      } else if (command === "createLink" && value) {
        window.document.execCommand("createLink", false, value);
      } else if (command === "foreColor" && value) {
        window.document.execCommand("foreColor", false, value);
      } else if (command === "hiliteColor" && value) {
        window.document.execCommand("hiliteColor", false, value);
      } else if (command === "fontSize" && value) {
        window.document.execCommand("fontSize", false, value);
      } else if (["superscript", "subscript", "indent", "outdent", "insertHorizontalRule", "removeFormat"].includes(command)) {
        window.document.execCommand(command, false, undefined);
      } else if (command === "insertImage" && value) {
        window.document.execCommand("insertImage", false, value);
      } else if (command === "insertHTML" && value) {
        window.document.execCommand("insertHTML", false, value);
      }

      // Update content after formatting
      const newContent = editorRef.current.innerHTML;
      setContent(newContent);

      if (socket && documentData) {
        socket.emit("text-change", {
          content: newContent,
          selection: getSelectionRange(),
        });
      }

      // Auto-save after formatting
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveDocument(newContent);
      }, 2000);
    } catch (error) {
      console.error("Format command failed:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case "b":
          e.preventDefault();
          handleFormat("bold");
          break;
        case "i":
          e.preventDefault();
          handleFormat("italic");
          break;
        case "u":
          e.preventDefault();
          handleFormat("underline");
          break;
        case "z":
          e.preventDefault();
          if (e.shiftKey) {
            handleFormat("redo");
          } else {
            handleFormat("undo");
          }
          break;
        case "y":
          e.preventDefault();
          handleFormat("redo");
          break;
      }
    }
    // Accept inline suggestion with Tab
    if (!e.ctrlKey && !e.metaKey && e.key === "Tab" && suggestion) {
      e.preventDefault();
      e.stopPropagation();
      insertTextAtCaret(suggestion);
      setSuggestion("");
      lastCompletedRef.current = "";
    }
  };

  // Insert text at current caret using Range APIs to avoid stray characters
  const insertTextAtCaret = (text: string) => {
    const root = editorRef.current;
    if (!root) return;
    root.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (sel.rangeCount === 0) {
      const range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
      sel.addRange(range);
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    // Move caret to end of inserted text
    const newRange = document.createRange();
    newRange.setStartAfter(node);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    // Sync content and collaboration state
    const newContent = root.innerHTML;
    setContent(newContent);
    if (socket && documentData) {
      socket.emit("text-change", {
        content: newContent,
        selection: getSelectionRange(),
      });
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveDocument(newContent), 2000);
  };

  const saveDocument = async (contentToSave?: string) => {
    if (!documentData || saving) return;

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:3001/api/documents/${documentData.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: contentToSave || content }),
        }
      );

      if (response.ok) {
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error("Failed to save document:", error);
    } finally {
      setSaving(false);
    }
  };

  const getSelectionRange = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return { start: 0, end: 0 };

    const range = selection.getRangeAt(0);
    return {
      start: range.startOffset,
      end: range.endOffset,
    };
  };

  // Inline suggestion helpers (component scope)
  const updateSuggestionPosition = () => {
    if (!editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0).cloneRange();
    range.collapse(true);
    const caretRect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();
    const top = caretRect.bottom - editorRect.top + editorRef.current.scrollTop;
    const left = caretRect.left - editorRect.left + editorRef.current.scrollLeft;
    setSuggestionPos({ top, left });
  };

  const triggerInlineSuggestion = async (currentContent: string) => {
    if (!inlineAIEnabled) return;
    if (!currentContent) {
      setSuggestion("");
      return;
    }
    const block = getCurrentBlockElement();
    const sourceHTML = block ? block.innerHTML : currentContent;
    const plain = sourceHTML.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const tail = plain.slice(Math.max(0, plain.length - 200));
    if (tail.length < 5) {
      setSuggestion("");
      return;
    }
    if (tail === lastCompletedRef.current) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:3001/api/ai/complete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: tail, context: plain.substring(0, 500) }),
      });
      if (response.ok) {
        const data = await response.json();
        const first = data?.completions?.[0] || "";
        setSuggestion(first);
        lastCompletedRef.current = tail;
        updateSuggestionPosition();
      }
    } catch {}
  };

  const toggleSidebar = (contentType: typeof sidebarContent) => {
    if (showSidebar && sidebarContent === contentType) {
      setShowSidebar(false);
    } else {
      setSidebarContent(contentType);
      setShowSidebar(true);
    }
  };

  if (!documentData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="component-header px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate("/")}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {documentData.title}
                </h1>
                <div className="flex items-center text-sm text-gray-600">
                  <span>By {documentData.owner_name}</span>
                  <span className="w-px h-4 bg-gray-300 mx-2 inline-block" />
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      documentData.role === "owner"
                        ? "bg-emerald-100 text-emerald-800"
                      : documentData.role === "editor"
                        ? "bg-emerald-100 text-emerald-800"
                      : documentData.role === "viewer"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {documentData.role}
                  </span>
                  <span className="w-px h-4 bg-gray-300 mx-2 inline-block" />
                  <button
                    onClick={() => {
                      setInlineAIEnabled((prev) => {
                        const next = !prev;
                        if (!next) {
                          setSuggestion("");
                          setGrammarMenuOpen(false);
                          setGrammarSuggestions([]);
                        }
                        return next;
                      });
                    }}
                    className={`px-2 py-1 rounded text-xs ${inlineAIEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'} hover:bg-gray-200`}
                    title="Toggle inline AI suggestions"
                  >
                    {inlineAIEnabled ? 'Inline AI: On' : 'Inline AI: Off'}
                  </button>
                  {saving && (
                    <>
                      <span className="mx-2">•</span>
                      <span className="text-indigo-700">Saving...</span>
                    </>
                  )}
                  {lastSaved && !saving && (
                    <>
                      <span className="mx-2">•</span>
                      <span className="text-gray-600">Saved {lastSaved.toLocaleTimeString()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Active Users */}
              <div className="flex -space-x-2">
                {activeUsers.slice(0, 3).map((user) => (
                  <div
                    key={user.userId}
                    className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium border-2 border-white"
                    title={user.name}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {activeUsers.length > 3 && (
                  <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white">
                    +{activeUsers.length - 3}
                  </div>
                )}
              </div>

              {/* Toolbar Buttons */}
              <button
                onClick={() => toggleSidebar("collaborators")}
                className={`p-2 rounded-lg transition-colors ${
                  showSidebar && sidebarContent === "collaborators"
                    ? "bg-indigo-100 text-indigo-600"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
                title="Collaborators"
              >
                <Users className="h-5 w-5" />
              </button>

              <button
                onClick={() => toggleSidebar("comments")}
                className={`p-2 rounded-lg transition-colors ${
                  showSidebar && sidebarContent === "comments"
                    ? "bg-indigo-100 text-indigo-600"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
                title="Comments"
              >
                <MessageSquare className="h-5 w-5" />
              </button>

              <button
                onClick={() => toggleSidebar("video")}
                className={`p-2 rounded-lg transition-colors ${
                  showSidebar && sidebarContent === "video"
                    ? "bg-indigo-100 text-indigo-600"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
                title="Video Chat"
              >
                <Video className="h-5 w-5" />
              </button>

              <button
                onClick={() => toggleSidebar("ai")}
                className={`p-2 rounded-lg transition-colors ${
                  showSidebar && sidebarContent === "ai"
                    ? "bg-indigo-100 text-indigo-600"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
                title="AI Assistant"
              >
                <Brain className="h-5 w-5" />
              </button>

              <button
                onClick={() => toggleSidebar("versions")}
                className={`p-2 rounded-lg transition-colors ${
                  showSidebar && sidebarContent === "versions"
                    ? "bg-indigo-100 text-indigo-600"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
                title="Version History"
              >
                <History className="h-5 w-5" />
              </button>

              <div className="w-px h-6 bg-gray-300 mx-1" />

              <div className="relative">
                <button
                  onClick={() => setDownloadOpen((o) => !o)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-700 border border-gray-200"
                  title="Download"
                >
                  <Download className="h-5 w-5" />
                  <span className="text-sm">Download</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {downloadOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow z-10">
                    <button
                      onClick={() => { setDownloadOpen(false); downloadAsHTML(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" />
                      HTML
                    </button>
                    <button
                      onClick={() => { setDownloadOpen(false); downloadAsText(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <FileTextIcon className="h-4 w-4" />
                      TXT
                    </button>
                    <button
                      onClick={() => { setDownloadOpen(false); downloadAsPDF(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <FileDown className="h-4 w-4" />
                      PDF
                    </button>
                    <button
                      onClick={() => { setDownloadOpen(false); downloadAsDoc(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <File className="h-4 w-4" />
                      DOC
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Editor Toolbar */}
        <EditorToolbar onFormat={handleFormat} inTable={inTable} onTableAdjust={handleTableAdjust} />

        {/* Editor Content */}
        <div className="flex-1 overflow-hidden relative">
          {momOpen && (
            <div className="fixed inset-0 z-30 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setMomOpen(false)} />
              <div className="relative z-40 w-full max-w-xl component-shell component-padding">
                <div className="mb-3">
                  <div className="text-lg font-semibold text-gray-900">Minutes of Meeting</div>
                  <div className="text-sm text-gray-600">Add quick notes and generate MoM.</div>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                  <textarea
                    className="input-teal h-32 resize-none text-sm"
                    value={momNotes}
                    onChange={(e) => setMomNotes(e.target.value)}
                    placeholder="Decisions taken, action items, deadlines..."
                  />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    className="btn-primary-teal disabled:opacity-50"
                    disabled={momGenerating}
                    onClick={async () => {
                      setMomGenerating(true);
                      try {
                        const token = localStorage.getItem("token");
                        const resp = await fetch("http://localhost:3001/api/ai/mom", {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                          body: JSON.stringify({
                            notes: momNotes,
                            participants: activeUsers.map((u) => u.name),
                            documentTitle: documentData.title,
                            context: (editorRef.current?.innerText || content || "").slice(0, 1200),
                            minimal: true,
                          }),
                        });
                        if (resp.ok) {
                          const data = await resp.json();
                          setMomResult(data?.mom || "");
                        }
                      } catch {}
                      finally {
                        setMomGenerating(false);
                      }
                    }}
                  >
                    {momGenerating ? "Generating..." : "Generate MoM"}
                  </button>
                  <button
                    className="btn-outline-teal"
                    onClick={() => {
                      if (momResult) {
                        navigator.clipboard.writeText(momResult);
                      }
                    }}
                    disabled={!momResult}
                  >
                    Copy
                  </button>
                  <button
                    className="btn-outline-teal"
                    onClick={() => {
                      if (!momResult || !editorRef.current) return;
                      // Insert MoM content only, preserving line breaks (no headings/metadata)
                      const html = `<div><pre style="white-space:pre-wrap">${momResult
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")}</pre></div>`;
                      editorRef.current.focus();
                      const sel = window.getSelection();
                      if (sel && sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        range.collapse(false);
                        const container = document.createElement("div");
                        container.innerHTML = html;
                        const frag = document.createDocumentFragment();
                        while (container.firstChild) frag.appendChild(container.firstChild);
                        range.insertNode(frag);
                      } else {
                        editorRef.current.innerHTML += html;
                      }
                      const newContent = editorRef.current.innerHTML;
                      setContent(newContent);
                      if (socket && documentData) {
                        socket.emit("text-change", { content: newContent, selection: getSelectionRange() });
                      }
                      setMomOpen(false);
                    }}
                    disabled={!momResult}
                  >
                    Insert into Document
                  </button>
                  <button
                    className="btn-outline-teal"
                    onClick={() => {
                      if (!momResult) return;
                      const fileName = `${(documentData.title || 'document').replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_')}_MoM.md`;
                      const blob = new Blob([momResult], { type: "text/markdown;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = fileName;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    disabled={!momResult}
                  >
                    Download .md
                  </button>
                  <button className="btn-outline-teal" onClick={() => setMomOpen(false)}>Close</button>
                </div>
                {momResult && (
                  <div className="component-card p-3 overflow-y-auto max-h-64">
                    <pre className="text-xs whitespace-pre-wrap text-gray-800">{momResult}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
          {incomingCall && incomingModalOpen && (
            <div className="fixed inset-0 z-30 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => { setIncomingModalOpen(false); stopRingtone(); }} />
              <div className="relative z-40 w-full max-w-sm component-shell component-padding text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl font-semibold">
                  {incomingCall.initiatorName.charAt(0).toUpperCase()}
                </div>
                <div className="text-lg font-semibold text-gray-900 mb-1">Incoming call</div>
                <div className="text-sm text-gray-700 mb-4">{incomingCall.initiatorName} is calling…</div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    className="px-4 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 smooth"
                    onClick={() => {
                      stopRingtone();
                      setIncomingModalOpen(false);
                      setVideoAutoJoin(true);
                      setSidebarContent('video');
                      setShowSidebar(true);
                      // reset autoJoin after the panel mounts
                      setTimeout(() => setVideoAutoJoin(false), 500);
                    }}
                  >
                    Accept
                  </button>
                  <button
                    className="px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 smooth"
                    onClick={() => {
                      stopRingtone();
                      setIncomingModalOpen(false);
                      setIncomingCall(null);
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable={["owner", "editor"].includes(documentData.role)}
            onInput={handleContentChange}
            onKeyDown={handleKeyDown}
            onScroll={updateSuggestionPosition}
            className="h-full p-6 focus:outline-none editor-content overflow-y-auto"
            style={
              {
                minHeight: "100%",
                writingMode: "horizontal-tb",
                textOrientation: "mixed",
              } as React.CSSProperties
            }
            suppressContentEditableWarning={true}
          />

          {/* Table resize handles */}
          {inTable && colHandle.visible && (
            <div
              onMouseDown={beginColResize}
              style={{ position: 'absolute', top: colHandle.top, left: colHandle.left, height: colHandle.height, width: 6, cursor: 'col-resize', background: 'transparent' }}
            />)
          }
          {inTable && rowHandle.visible && (
            <div
              onMouseDown={beginRowResize}
              style={{ position: 'absolute', top: rowHandle.top, left: rowHandle.left, height: 6, width: rowHandle.width, cursor: 'row-resize', background: 'transparent' }}
            />)
          }

          {suggestion && (
            <div
              onMouseDown={(e) => {
                // Prevent focus/selection change, then insert precisely at caret
                e.preventDefault();
                e.stopPropagation();
                insertTextAtCaret(suggestion);
                setSuggestion("");
                lastCompletedRef.current = "";
              }}
              style={{
                position: "absolute",
                top: suggestionPos.top + 4,
                left: suggestionPos.left + 8,
                maxWidth: "60%",
                pointerEvents: "auto",
                zIndex: 10,
              }}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 border border-gray-200 rounded shadow cursor-pointer select-none"
              title="Click or press Tab to accept"
            >
              {suggestion}
            </div>
          )}

          {grammarMenuOpen && grammarSuggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: suggestionPos.top + 28,
                left: suggestionPos.left,
                maxWidth: "70%",
                zIndex: 11,
              }}
              className="p-2 bg-white border border-gray-200 rounded shadow text-xs text-gray-800"
            >
              <div className="mb-1 font-medium">Quick fix</div>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  const fix = grammarSuggestions[0]?.suggestion || '';
                  if (fix) applyGrammarFix(fix);
                }}
                className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                Apply: {grammarSuggestions[0]?.suggestion}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar: mobile drawer + desktop panel */}
      {showSidebar && (
        <>
          {/* Mobile overlay/backdrop */}
          <div
            className="sm:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowSidebar(false)}
          />

          {/* Mobile drawer */}
          <div className="sm:hidden fixed right-0 top-0 h-full w-full max-w-[90%] bg-white z-50 shadow-lg">
            {sidebarContent === "collaborators" && (
              <CollaboratorsList
                activeUsers={activeUsers}
                document={documentData}
                onClose={() => setShowSidebar(false)}
              />
            )}
            {sidebarContent === "comments" && (
              <CommentsPanel
                documentId={documentData.id}
                onClose={() => setShowSidebar(false)}
              />
            )}
            {sidebarContent === "ai" && (
              <AIAssistant
                content={content}
                onClose={() => setShowSidebar(false)}
                autoWhileTyping={true}
                debounceMs={1200}
              />
            )}
            {sidebarContent === "video" && (
              <VideoChat
                documentId={documentData.id}
                autoJoin={videoAutoJoin}
                initialRoomUrl={incomingCall?.roomUrl}
                onClose={() => setShowSidebar(false)}
              />
            )}
            {sidebarContent === "versions" && (
              <VersionHistory
                documentId={documentData.id}
                onRestore={(newContent) => {
                  setContent(newContent);
                  if (editorRef.current) {
                    editorRef.current.innerHTML = newContent;
                  }
                  saveDocument(newContent);
                }}
                onClose={() => setShowSidebar(false)}
              />
            )}
          </div>

          {/* Desktop sidebar */}
          <div className="hidden sm:block w-80 border-l border-gray-200 bg-white">
            {sidebarContent === "collaborators" && (
              <CollaboratorsList
                activeUsers={activeUsers}
                document={documentData}
                onClose={() => setShowSidebar(false)}
              />
            )}
            {sidebarContent === "comments" && (
              <CommentsPanel
                documentId={documentData.id}
                onClose={() => setShowSidebar(false)}
              />
            )}
            {sidebarContent === "ai" && (
              <AIAssistant
                content={content}
                onClose={() => setShowSidebar(false)}
                autoWhileTyping={true}
                debounceMs={1200}
              />
            )}
            {sidebarContent === "video" && (
              <VideoChat
                documentId={documentData.id}
                onClose={() => setShowSidebar(false)}
              />
            )}
            {sidebarContent === "versions" && (
              <VersionHistory
                documentId={documentData.id}
                onRestore={(newContent) => {
                  setContent(newContent);
                  if (editorRef.current) {
                    editorRef.current.innerHTML = newContent;
                  }
                  saveDocument(newContent);
                }}
                onClose={() => setShowSidebar(false)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DocumentEditor;
