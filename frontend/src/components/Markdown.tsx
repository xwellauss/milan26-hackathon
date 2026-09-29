import React, { useMemo, useState } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import { getHighlightTokens } from './UI';

// Create a configured instance of Marked
const markedInstance = new Marked({
  gfm: true,
  breaks: true,
});

// Configure DOMPurify to allow standard markdown, formatting tags, and KaTeX math/MathML tags
const sanitizeConfig = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 'ins', 'del', 's', 'strike',
    'ul', 'ol', 'li', 'blockquote',
    'pre', 'code', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'a', 'img', 'span', 'div', 'input', 'sub', 'sup', 'mark',
    // MathML and KaTeX rendering tags
    'math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 
    'msubsup', 'mfrac', 'msqrt', 'mroot', 'mtable', 'mtr', 'mtd', 'mtext', 
    'mspace', 'mover', 'munder', 'munderover', 'mpadded', 'mphantom',
    'svg', 'path', 'g', 'line', 'rect', 'circle', 'use'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height',
    'class', 'className', 'type', 'checked', 'disabled', 'style', 'data-language',
    // KaTeX attributes
    'aria-hidden', 'viewBox', 'xmlns', 'mathvariant', 'encoding', 'display',
    'd', 'fill', 'stroke', 'stroke-width'
  ],
  ALLOW_DATA_ATTR: true
};

/**
 * Preprocess Markdown text to render LaTeX / KaTeX math:
 * 1. Protects multiline & inline code blocks from math parsing.
 * 2. Parses $$...$$ for block/display math.
 * 3. Parses $...$ for inline math.
 * 4. Restores code blocks.
 */
function renderMathInMarkdown(raw: string): string {
  if (!raw) return '';

  const codeBlocks: string[] = [];
  const mathBlocks: string[] = [];

  // 1. Protect multiline code blocks (```...```)
  let text = raw.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // 2. Protect inline code (`...`)
  text = text.replace(/`[^`\n]+`/g, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // 3. Render Block / Display Math ($$...$$)
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
        output: 'htmlAndMathml'
      });
      const placeholder = `__MATH_BLOCK_${mathBlocks.length}__`;
      mathBlocks.push(rendered);
      return placeholder;
    } catch {
      return `$$${math}$$`;
    }
  });

  // 4. Render Inline Math ($...$)
  text = text.replace(/(?<!\\)\$((?:\\\$|[^\$\n])+?)(?<!\\)\$/g, (_, math) => {
    const trimmed = math.trim();
    if (!trimmed) return '$$';
    try {
      const rendered = katex.renderToString(trimmed, {
        displayMode: false,
        throwOnError: false,
        output: 'htmlAndMathml'
      });
      const placeholder = `__MATH_BLOCK_${mathBlocks.length}__`;
      mathBlocks.push(rendered);
      return placeholder;
    } catch {
      return `$${math}$`;
    }
  });

  // 5. Restore Math blocks
  mathBlocks.forEach((mathHtml, idx) => {
    text = text.replace(`__MATH_BLOCK_${idx}__`, mathHtml);
  });

  // 6. Restore Code blocks
  codeBlocks.forEach((code, idx) => {
    text = text.replace(`__CODE_BLOCK_${idx}__`, code);
  });

  return text;
}

/**
 * Safely highlights search query tokens inside HTML text nodes (skipping tags and math blocks)
 */
function highlightHtmlTextNodes(html: string, query?: string): string {
  const tokens = getHighlightTokens(query);
  if (!html || tokens.length === 0) return html;

  const escaped = tokens
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
  if (escaped.length === 0) return html;

  const matchRegex = new RegExp(`(${escaped.join('|')})`, 'gi');

  // Protect <math>...</math> and <svg>...</svg> blocks from text highlighting
  const protectedBlocks: string[] = [];
  let safeHtml = html.replace(/<(math|svg)[\s\S]*?<\/\1>/gi, (m) => {
    const ph = `__PROTECTED_HTML_${protectedBlocks.length}__`;
    protectedBlocks.push(m);
    return ph;
  });

  // Replace only outside HTML tags
  safeHtml = safeHtml.replace(/(<[^>]+>)|([^<]+)/g, (full, tag, textNode) => {
    if (tag) return tag;
    if (!textNode) return full;
    return textNode.replace(
      matchRegex,
      '<mark class="bg-amber-200/85 dark:bg-amber-500/35 text-slate-900 dark:text-amber-100 rounded-xs px-0.5 font-semibold">$1</mark>'
    );
  });

  protectedBlocks.forEach((block, idx) => {
    safeHtml = safeHtml.replace(`__PROTECTED_HTML_${idx}__`, block);
  });

  return safeHtml;
}

export const SimpleMarkdown = ({ 
  children, 
  className = '',
  inverted = false,
  highlightQuery
}: { 
  children: string; 
  className?: string;
  inverted?: boolean;
  highlightQuery?: string;
}) => {
  const [, setCopiedIndex] = useState<number | null>(null);

  const parsedHtml = useMemo(() => {
    if (!children) return '';

    let content = children;

    // Support ++underline++ syntax in addition to <u>underline</u> and <ins>underline</ins>
    content = content.replace(/\+\+([^\+]+)\+\+/g, '<u>$1</u>');

    // Parse inline and display math formulas ($...$ and $$...$$) using KaTeX
    content = renderMathInMarkdown(content);

    // Parse Markdown to HTML
    let rawHtml = '';
    try {
      rawHtml = markedInstance.parse(content) as string;
    } catch {
      rawHtml = content;
    }

    // Sanitize with DOMPurify while preserving KaTeX and HTML elements
    let cleanHtml = String(DOMPurify.sanitize(rawHtml, sanitizeConfig));

    // Ensure all links open in new tab securely
    cleanHtml = cleanHtml.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi, (_: string, href: string) => {
      let finalHref = href;
      if (!/^https?:\/\//i.test(finalHref) && !finalHref.startsWith('mailto:') && !finalHref.startsWith('#')) {
        finalHref = 'https://' + finalHref;
      }
      const linkColorClass = inverted
        ? 'text-indigo-100 font-semibold underline underline-offset-2 hover:text-white'
        : 'text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-2 hover:text-indigo-800 dark:hover:text-indigo-300';
      return `<a href="${finalHref}" target="_blank" rel="noopener noreferrer" class="${linkColorClass} transition-colors inline-flex items-center gap-0.5"`;
    });

    if (highlightQuery && highlightQuery.trim()) {
      cleanHtml = highlightHtmlTextNodes(cleanHtml, highlightQuery);
    }

    return cleanHtml;
  }, [children, inverted, highlightQuery]);

  // Handle copy button clicks on code blocks inside the rendered container
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const copyBtn = target.closest('button[data-code-copy]');
    if (copyBtn) {
      const codeId = copyBtn.getAttribute('data-code-copy');
      if (codeId) {
        const codeElement = document.getElementById(codeId);
        if (codeElement) {
          const textToCopy = codeElement.innerText;
          navigator.clipboard.writeText(textToCopy).then(() => {
            const btnIdx = parseInt(codeId.replace('code-block-', ''), 10);
            setCopiedIndex(btnIdx);
            setTimeout(() => setCopiedIndex(null), 2000);
          });
        }
      }
    }
  };

  return (
    <div 
      onClick={handleContainerClick}
      dangerouslySetInnerHTML={{ __html: parsedHtml }} 
      className={`markdown-content text-sm leading-relaxed break-words ${
        inverted ? 'markdown-inverted text-slate-50' : 'text-slate-800 dark:text-slate-200'
      } ${className}`} 
    />
  );
};
