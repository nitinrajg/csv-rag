/**
 * MarkdownRenderer — Lightweight markdown-to-JSX converter.
 *
 * Why not use a library like react-markdown?
 * To keep the bundle tiny and avoid adding dependencies.
 * This covers the patterns LLMs actually output:
 *   - **bold**, *italic*, `inline code`
 *   - Code blocks (```lang ... ```)
 *   - Headers (# ## ###)
 *   - Unordered lists (- or *)
 *   - Ordered lists (1. 2. 3.)
 *   - Blockquotes (>)
 *   - Tables (| col | col |)
 *   - Paragraphs with line breaks
 *
 * The approach: split the raw text into "blocks" (code blocks, tables,
 * lists, blockquotes, headers, paragraphs), then render each block
 * as the appropriate JSX element. Inline formatting is handled by
 * `renderInline` which uses regex replacements.
 */

/**
 * Converts inline markdown tokens to JSX elements.
 * Processes: bold, italic, inline code, and plain text.
 */
function renderInline(text) {
  if (!text) return null;
  const parts = [];
  // Pattern matches: `code`, **bold**, *italic*
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      parts.push(<code key={match.index}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ```
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <pre key={blocks.length}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Table: lines starting with |
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (row) =>
          row.split("|").slice(1, -1).map((c) => c.trim());
        const headers = parseRow(tableLines[0]);
        // Skip separator row (index 1)
        const dataRows = tableLines.slice(2).map(parseRow);
        blocks.push(
          <table key={blocks.length}>
            <thead>
              <tr>{headers.map((h, j) => <th key={j}>{renderInline(h)}</th>)}</tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{renderInline(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        );
      }
      continue;
    }

    // Headers: # ## ###
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={blocks.length}>{renderInline(line.slice(4))}</h3>);
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={blocks.length}>{renderInline(line.slice(3))}</h2>);
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(<h1 key={blocks.length}>{renderInline(line.slice(2))}</h1>);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <blockquote key={blocks.length}>
          {quoteLines.map((ql, qi) => <p key={qi}>{renderInline(ql)}</p>)}
        </blockquote>
      );
      continue;
    }

    // Unordered list: - or *
    if (/^[\s]*[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[-*]\s/, ""));
        i++;
      }
      blocks.push(
        <ul key={blocks.length}>
          {items.map((item, ii) => <li key={ii}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Ordered list: 1. 2. etc.
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push(
        <ol key={blocks.length}>
          {items.map((item, ii) => <li key={ii}>{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Default: paragraph — collect consecutive non-empty, non-special lines
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith(">") &&
      !lines[i].trimStart().startsWith("```") &&
      !/^[\s]*[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !(lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|"))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(<p key={blocks.length}>{renderInline(paraLines.join(" "))}</p>);
  }

  return <>{blocks}</>;
}
