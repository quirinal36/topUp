import { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
}

function parseLine(line: string): JSX.Element | string {
  // Inline formatting: **bold**, *italic*, `code`, [link](url)
  const parts: (string | JSX.Element)[] = [];
  let remaining = line;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Code: `text`
    const codeMatch = remaining.match(/`(.+?)`/);
    // Link: [text](url)
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);

    // Find the earliest match
    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch } : null,
      codeMatch ? { type: 'code', match: codeMatch } : null,
      linkMatch ? { type: 'link', match: linkMatch } : null,
    ]
      .filter(Boolean)
      .sort((a, b) => (a!.match.index ?? 0) - (b!.match.index ?? 0));

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const earliest = matches[0]!;
    const idx = earliest.match.index!;

    if (idx > 0) {
      parts.push(remaining.slice(0, idx));
    }

    if (earliest.type === 'bold') {
      parts.push(
        <strong key={key++} className="font-semibold text-gray-900 dark:text-white">
          {earliest.match[1]}
        </strong>
      );
      remaining = remaining.slice(idx + earliest.match[0].length);
    } else if (earliest.type === 'code') {
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-primary-700 dark:text-primary-300">
          {earliest.match[1]}
        </code>
      );
      remaining = remaining.slice(idx + earliest.match[0].length);
    } else if (earliest.type === 'link') {
      parts.push(
        <a key={key++} href={earliest.match[2]} className="text-primary-600 dark:text-primary-400 underline hover:text-primary-700">
          {earliest.match[1]}
        </a>
      );
      remaining = remaining.slice(idx + earliest.match[0].length);
    }
  }

  return <>{parts}</>;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const elements = useMemo(() => {
    const lines = content.split('\n');
    const result: JSX.Element[] = [];
    let i = 0;

    // Table parsing state
    const isTableRow = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|');
    const isSeparatorRow = (line: string) => /^\|[\s\-:|]+\|$/.test(line.trim());

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line
      if (trimmed === '') {
        result.push(<div key={i} className="h-3" />);
        i++;
        continue;
      }

      // Horizontal rule
      if (/^---+$/.test(trimmed)) {
        result.push(<hr key={i} className="my-4 border-gray-200 dark:border-gray-700" />);
        i++;
        continue;
      }

      // Headers
      if (trimmed.startsWith('# ')) {
        result.push(
          <h1 key={i} className="text-2xl font-bold text-gray-900 dark:text-white mt-6 mb-3">
            {parseLine(trimmed.slice(2))}
          </h1>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        result.push(
          <h2 key={i} className="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-2">
            {parseLine(trimmed.slice(3))}
          </h2>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('### ')) {
        result.push(
          <h3 key={i} className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
            {parseLine(trimmed.slice(4))}
          </h3>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('#### ')) {
        result.push(
          <h4 key={i} className="text-base font-semibold text-gray-800 dark:text-gray-200 mt-3 mb-1">
            {parseLine(trimmed.slice(5))}
          </h4>
        );
        i++;
        continue;
      }

      // Blockquote
      if (trimmed.startsWith('> ')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('> ')) {
          quoteLines.push(lines[i].trim().slice(2));
          i++;
        }
        result.push(
          <blockquote key={i} className="border-l-4 border-primary-400 dark:border-primary-600 pl-4 py-1 my-3 bg-primary-50 dark:bg-primary-900/20 rounded-r">
            {quoteLines.map((ql, qi) => (
              <p key={qi} className="text-sm text-gray-600 dark:text-gray-400">{parseLine(ql)}</p>
            ))}
          </blockquote>
        );
        continue;
      }

      // Table
      if (isTableRow(trimmed)) {
        const tableRows: string[] = [];
        while (i < lines.length && isTableRow(lines[i].trim())) {
          tableRows.push(lines[i].trim());
          i++;
        }

        if (tableRows.length >= 2) {
          const headerCells = tableRows[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
          const hasSeparator = isSeparatorRow(tableRows[1]);
          const dataStart = hasSeparator ? 2 : 1;

          result.push(
            <div key={i} className="overflow-x-auto my-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    {headerCells.map((cell, ci) => (
                      <th key={ci} className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                        {parseLine(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.slice(dataStart).map((row, ri) => {
                    const cells = row.split('|').filter(c => c.trim() !== '').map(c => c.trim());
                    return (
                      <tr key={ri} className={ri % 2 === 0 ? 'bg-white dark:bg-[#2d2420]' : 'bg-gray-50 dark:bg-[#231c18]'}>
                        {cells.map((cell, ci) => (
                          <td key={ci} className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-gray-700 dark:text-gray-300">
                            {parseLine(cell)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Unordered list
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const listItems: { text: string; indent: number }[] = [];
        while (i < lines.length && (lines[i].match(/^(\s*)[-*] /) || (listItems.length > 0 && lines[i].match(/^\s+\S/)))) {
          const match = lines[i].match(/^(\s*)[-*] (.+)/);
          if (match) {
            listItems.push({ text: match[2], indent: match[1].length });
          }
          i++;
        }
        result.push(
          <ul key={i} className="my-2 space-y-1">
            {listItems.map((item, li) => (
              <li key={li} className="text-sm text-gray-700 dark:text-gray-300 flex" style={{ paddingLeft: `${item.indent * 8 + 8}px` }}>
                <span className="mr-2 text-primary-500">&#8226;</span>
                <span>{parseLine(item.text)}</span>
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered list
      if (/^\d+\. /.test(trimmed)) {
        const listItems: string[] = [];
        while (i < lines.length && /^\s*\d+\. /.test(lines[i])) {
          const match = lines[i].match(/^\s*\d+\. (.+)/);
          if (match) listItems.push(match[1]);
          i++;
        }
        result.push(
          <ol key={i} className="my-2 space-y-1">
            {listItems.map((item, li) => (
              <li key={li} className="text-sm text-gray-700 dark:text-gray-300 flex pl-2">
                <span className="mr-2 text-primary-500 font-medium min-w-[1.5rem]">{li + 1}.</span>
                <span>{parseLine(item)}</span>
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // Regular paragraph
      result.push(
        <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed my-1">
          {parseLine(trimmed)}
        </p>
      );
      i++;
    }

    return result;
  }, [content]);

  return <div>{elements}</div>;
}
