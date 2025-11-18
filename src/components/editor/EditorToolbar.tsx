import React from "react";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Link,
  Image as ImageIcon,
  Table as TableIcon,
  Undo,
  Redo,
  Strikethrough,
  Superscript,
  Subscript,
  Indent as IndentIcon,
  Outdent,
  Eraser,
  Minus,
  Code,
} from "lucide-react";

interface Props {
  onFormat: (command: string, value?: string) => void;
  inTable?: boolean;
  onTableAdjust?: (action: 'col:inc' | 'col:dec' | 'row:inc' | 'row:dec') => void;
}

const EditorToolbar: React.FC<Props> = ({ onFormat, inTable = false, onTableAdjust }) => {
  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      onFormat("createLink", url);
    }
  };

  const insertHeading = (level: string) => {
    onFormat("formatBlock", level);
  };

  const insertImage = () => {
    const url = prompt("Enter image URL:");
    if (url) {
      onFormat("insertImage", url);
    }
  };

  const insertTable = () => {
    const rowsStr = prompt("Number of rows (min 2):", "3");
    const colsStr = prompt("Number of columns (min 2):", "3");
    if (!rowsStr || !colsStr) return;
    let rows = parseInt(rowsStr, 10);
    let cols = parseInt(colsStr, 10);
    if (isNaN(rows) || isNaN(cols)) return;
    rows = Math.max(2, Math.min(10, rows));
    cols = Math.max(2, Math.min(10, cols));

    const makeCells = (tag: 'th' | 'td') =>
      Array.from({ length: cols })
        .map(() => `<${tag} style="padding:8px; border:1px solid #9ca3af; text-align:left"><br></${tag}>`)
        .join("");

    const header = `<thead style="background:#f9fafb"><tr>${makeCells('th')}</tr></thead>`;
    const bodyRows = Array.from({ length: rows - 1 })
      .map(() => `<tr>${makeCells('td')}</tr>`)
      .join("");
    const body = `<tbody>${bodyRows}</tbody>`;

    const html = `
      <div style="overflow-x:auto; margin:8px 0;">
        <table style="width:100%; border-collapse:collapse; font-size:14px; border:1px solid #9ca3af;">
          ${header}
          ${body}
        </table>
      </div>
    `;
    onFormat("insertHTML", html);
  };

  return (
    <div className="component-header px-3 py-2 overflow-x-auto">
      <div className="flex items-center flex-wrap gap-1 whitespace-nowrap">
        {/* Undo/Redo */}
        <button
          onClick={() => onFormat("undo")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </button>
        <button
          onClick={() => onFormat("redo")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        {/* Text Formatting */}
        <button
          onClick={() => onFormat("bold")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          onClick={() => onFormat("italic")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          onClick={() => onFormat("underline")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Underline"
        >
          <Underline className="h-4 w-4" />
        </button>
        <button
          onClick={() => onFormat("strikeThrough")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        {/* Alignment */}
        <button
          onClick={() => onFormat("justifyLeft")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onFormat("justifyCenter")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          onClick={() => onFormat("justifyRight")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onFormat("justifyFull")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Justify"
        >
          <AlignJustify className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        {/* Lists */}
        <button
          onClick={() => onFormat("insertUnorderedList")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onClick={() => onFormat("insertOrderedList")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        {/* Quote */}
        <button
          onClick={() => onFormat("formatBlock", "blockquote")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </button>

        {/* Link */}
        <button
          onClick={insertLink}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Insert Link"
        >
          <Link className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        {/* Indent/Outdent */}
        <button
          onClick={() => onFormat("indent")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Indent"
        >
          <IndentIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => onFormat("outdent")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Outdent"
        >
          <Outdent className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        {/* Super/Sub script */}
        <button
          onClick={() => onFormat("superscript")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Superscript"
        >
          <Superscript className="h-4 w-4" />
        </button>
        <button
          onClick={() => onFormat("subscript")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Subscript"
        >
          <Subscript className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        {/* Code block & HR */}
        <button
          onClick={() => onFormat("formatBlock", "pre")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </button>
        <button
          onClick={() => onFormat("insertHorizontalRule")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        {/* Image & Table */}
        <button
          onClick={insertImage}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Insert Image"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <button
          onClick={insertTable}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Insert Table (2x2)"
        >
          <TableIcon className="h-4 w-4" />
        </button>

        {/* Table sizing controls */}
        <div className="inline-flex items-center ml-1">
          <button
            onClick={() => onTableAdjust && onTableAdjust('col:dec')}
            disabled={!inTable}
            className={`px-2 py-1 rounded-l border ${inTable ? 'text-gray-700 hover:bg-gray-100 border-gray-300' : 'text-gray-400 border-gray-200 cursor-not-allowed'}`}
            title="Narrow column"
          >
            − Col
          </button>
          <button
            onClick={() => onTableAdjust && onTableAdjust('col:inc')}
            disabled={!inTable}
            className={`px-2 py-1 border-t border-b ${inTable ? 'text-gray-700 hover:bg-gray-100 border-gray-300' : 'text-gray-400 border-gray-200 cursor-not-allowed'}`}
            title="Widen column"
          >
            + Col
          </button>
          <button
            onClick={() => onTableAdjust && onTableAdjust('row:dec')}
            disabled={!inTable}
            className={`px-2 py-1 border ${inTable ? 'text-gray-700 hover:bg-gray-100 border-gray-300' : 'text-gray-400 border-gray-200 cursor-not-allowed'}`}
            title="Shorten row"
          >
            − Row
          </button>
          <button
            onClick={() => onTableAdjust && onTableAdjust('row:inc')}
            disabled={!inTable}
            className={`px-2 py-1 rounded-r border ${inTable ? 'text-gray-700 hover:bg-gray-100 border-gray-300' : 'text-gray-400 border-gray-200 cursor-not-allowed'}`}
            title="Taller row"
          >
            + Row
          </button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        {/* Clear formatting */}
        <button
          onClick={() => onFormat("removeFormat")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Clear Formatting"
        >
          <Eraser className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        {/* Heading Dropdown */}
        <select
          onChange={(e) => insertHeading(e.target.value)}
          className="px-3 py-1 bg-white/90 border border-teal-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          defaultValue=""
        >
          <option value="">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="h5">Heading 5</option>
          <option value="h6">Heading 6</option>
        </select>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        {/* Font Size */}
        <select
          onChange={(e) => onFormat("fontSize", e.target.value)}
          className="px-3 py-1 bg-white/90 border border-teal-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          defaultValue="3"
        >
          <option value="1">8pt</option>
          <option value="2">10pt</option>
          <option value="3">12pt</option>
          <option value="4">14pt</option>
          <option value="5">18pt</option>
          <option value="6">24pt</option>
          <option value="7">36pt</option>
        </select>

        {/* Text Color */}
        <input
          type="color"
          onChange={(e) => onFormat("foreColor", e.target.value)}
          className="w-8 h-8 border border-teal-300 rounded cursor-pointer bg-white/90"
          title="Text Color"
          defaultValue="#000000"
        />

        {/* Background Color */}
        <input
          type="color"
          onChange={(e) => onFormat("hiliteColor", e.target.value)}
          className="w-8 h-8 border border-teal-300 rounded cursor-pointer bg-white/90"
          title="Highlight Color"
          defaultValue="#ffff00"
        />
      </div>
    </div>
  );
};

export default EditorToolbar;
