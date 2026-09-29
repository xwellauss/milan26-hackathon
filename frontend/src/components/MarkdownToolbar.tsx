import React from 'react';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
  Heading, Quote, Code, FileCode, List, ListOrdered, 
  CheckSquare, Table, Link as LinkIcon, Sigma
} from 'lucide-react';

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (val: string) => void;
}

export const applyMarkdownFormatting = (
  element: HTMLTextAreaElement | HTMLInputElement | null,
  value: string,
  onChange: (val: string) => void,
  prefix: string,
  suffix: string = '',
  defaultPlaceholder: string = 'text'
) => {
  if (!element) return;
  const start = element.selectionStart ?? 0;
  const end = element.selectionEnd ?? 0;
  const selectedText = value.substring(start, end) || defaultPlaceholder;
  const before = value.substring(0, start);
  const after = value.substring(end);

  const replacement = `${prefix}${selectedText}${suffix}`;
  const newValue = `${before}${replacement}${after}`;
  onChange(newValue);

  setTimeout(() => {
    element.focus();
    element.setSelectionRange(
      start + prefix.length,
      start + prefix.length + selectedText.length
    );
  }, 10);
};

export const handleMarkdownKeydown = (
  e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  value: string,
  onChange: (val: string) => void
) => {
  // Support Tab indentation in textareas
  if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.currentTarget.tagName.toLowerCase() === 'textarea') {
      e.preventDefault();
      const element = e.currentTarget;
      const start = element.selectionStart ?? 0;
      const end = element.selectionEnd ?? 0;
      const before = value.substring(0, start);
      const after = value.substring(end);
      onChange(`${before}  ${after}`);
      setTimeout(() => {
        element.focus();
        element.setSelectionRange(start + 2, start + 2);
      }, 10);
      return true;
    }
  }

  const isCtrlOrCmd = e.ctrlKey || e.metaKey;
  if (!isCtrlOrCmd) return false;

  const key = e.key.toLowerCase();
  const element = e.currentTarget;

  // Ctrl+B -> Bold
  if (key === 'b') {
    e.preventDefault();
    applyMarkdownFormatting(element, value, onChange, '**', '**', 'bold text');
    return true;
  }
  // Ctrl+I -> Italic
  if (key === 'i') {
    e.preventDefault();
    applyMarkdownFormatting(element, value, onChange, '*', '*', 'italic text');
    return true;
  }
  // Ctrl+U -> Underline
  if (key === 'u') {
    e.preventDefault();
    applyMarkdownFormatting(element, value, onChange, '<u>', '</u>', 'underlined text');
    return true;
  }
  // Ctrl+M -> Inline Math Formula
  if (key === 'm' && !e.shiftKey) {
    e.preventDefault();
    applyMarkdownFormatting(element, value, onChange, '$', '$', 'x^2 + y^2 = r^2');
    return true;
  }
  // Ctrl+Shift+M -> Display Math Block
  if (key === 'm' && e.shiftKey) {
    e.preventDefault();
    applyMarkdownFormatting(element, value, onChange, '$$\n', '\n$$', 'E = mc^2');
    return true;
  }
  // Ctrl+Shift+X or Ctrl+Shift+S -> Strikethrough
  if ((key === 'x' || key === 's') && (e.shiftKey || e.altKey)) {
    e.preventDefault();
    applyMarkdownFormatting(element, value, onChange, '~~', '~~', 'strikethrough text');
    return true;
  }
  // Ctrl+K -> Link
  if (key === 'k') {
    e.preventDefault();
    applyMarkdownFormatting(element, value, onChange, '[', '](https://example.com)', 'link text');
    return true;
  }
  // Ctrl+E or Ctrl+` -> Code
  if (key === 'e' || key === '`') {
    e.preventDefault();
    if (e.shiftKey) {
      applyMarkdownFormatting(element, value, onChange, '```typescript\n', '\n```', '// code block');
    } else {
      applyMarkdownFormatting(element, value, onChange, '`', '`', 'code');
    }
    return true;
  }
  // Ctrl+Shift+Q -> Quote
  if (key === 'q' && e.shiftKey) {
    e.preventDefault();
    applyMarkdownFormatting(element, value, onChange, '\n> ', '', 'quoted message');
    return true;
  }

  return false;
};

export const MarkdownToolbar = ({ textareaRef, value, onChange }: MarkdownToolbarProps) => {
  const insertSyntax = (prefix: string, suffix: string = '', defaultPlaceholder: string = 'text') => {
    applyMarkdownFormatting(textareaRef.current, value, onChange, prefix, suffix, defaultPlaceholder);
  };

  const insertLinePrefix = (prefix: string, defaultPlaceholder: string = 'List item') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const before = value.substring(0, start);
    const after = value.substring(start);
    
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const addition = `${needsNewline ? '\n' : ''}${prefix}${defaultPlaceholder}\n`;
    
    const newValue = `${before}${addition}${after}`;
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + (needsNewline ? 1 : 0) + prefix.length,
        start + (needsNewline ? 1 : 0) + prefix.length + defaultPlaceholder.length
      );
    }, 10);
  };

  const insertTable = () => {
    const tableTemplate = `
| Header 1 | Header 2 | Header 3 |
| :--- | :--- | :--- |
| Item 1 | Details A | Active |
| Item 2 | Details B | Pending |
`;
    insertSyntax(tableTemplate, '', '');
  };

  const insertCodeBlock = () => {
    insertSyntax('```typescript\n', '\n```', '// Type code here');
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-100/90 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300">
      {/* Text Styles */}
      <div className="flex items-center gap-0.5 pr-1 border-r border-slate-300 dark:border-slate-600">
        <button
          type="button"
          onClick={() => insertSyntax('**', '**', 'bold text')}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => insertSyntax('*', '*', 'italic text')}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => insertSyntax('<u>', '</u>', 'underlined text')}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => insertSyntax('~~', '~~', 'strikethrough text')}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
      </div>

      {/* Headings & Quote */}
      <div className="flex items-center gap-0.5 px-1 border-r border-slate-300 dark:border-slate-600">
        <button
          type="button"
          onClick={() => insertLinePrefix('## ', 'Section Heading')}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer text-xs font-black"
          title="Heading"
        >
          <Heading className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => insertLinePrefix('> ', 'Quote text')}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Blockquote"
        >
          <Quote className="w-4 h-4" />
        </button>
      </div>

      {/* Code & Math */}
      <div className="flex items-center gap-0.5 px-1 border-r border-slate-300 dark:border-slate-600">
        <button
          type="button"
          onClick={() => insertSyntax('`', '`', 'code')}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Inline Code"
        >
          <Code className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={insertCodeBlock}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Code Block"
        >
          <FileCode className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => insertSyntax('$', '$', 'x^2 + y^2 = r^2')}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Math Formula"
        >
          <Sigma className="w-4 h-4" />
        </button>
      </div>

      {/* Lists & Tables */}
      <div className="flex items-center gap-0.5 px-1 border-r border-slate-300 dark:border-slate-600">
        <button
          type="button"
          onClick={() => insertLinePrefix('- ', 'Bulleted item')}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Bulleted List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => insertLinePrefix('1. ', 'Numbered item')}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => insertLinePrefix('- [ ] ', 'Task to do')}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Task Checklist"
        >
          <CheckSquare className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={insertTable}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Insert Table"
        >
          <Table className="w-4 h-4" />
        </button>
      </div>

      {/* Links */}
      <div className="flex items-center gap-0.5 pl-1">
        <button
          type="button"
          onClick={() => insertSyntax('[', '](https://example.com)', 'link title')}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg hover:text-slate-900 dark:hover:text-white transition-all duration-150 active:scale-90 cursor-pointer"
          title="Insert Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
