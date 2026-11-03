import React from 'react';

/** Minimal jewelry-safe Markdown → React (headings, lists, bold). No HTML injection. */
export function renderSimpleMarkdown(src: string): React.ReactNode[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!listBuf.length) return;
    out.push(
      <ul key={`ul-${key++}`} className="my-4 list-disc space-y-2 pl-6">
        {listBuf.map((item, i) => (
          <li key={i}>{inlineBold(item)}</li>
        ))}
      </ul>
    );
    listBuf = [];
  };

  const inlineBold = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      listBuf.push(trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
      continue;
    }
    flushList();
    if (trimmed.startsWith('### ')) {
      out.push(
        <h3 key={`h3-${key++}`} className="mt-8 mb-3 text-xl font-semibold serif dark:text-white">
          {inlineBold(trimmed.slice(4))}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      out.push(
        <h2 key={`h2-${key++}`} className="mt-10 mb-4 text-2xl font-bold serif dark:text-white">
          {inlineBold(trimmed.slice(3))}
        </h2>
      );
    } else if (trimmed.startsWith('# ')) {
      out.push(
        <h1 key={`h1-${key++}`} className="mt-10 mb-4 text-3xl font-bold serif dark:text-white">
          {inlineBold(trimmed.slice(2))}
        </h1>
      );
    } else {
      out.push(
        <p key={`p-${key++}`} className="my-3 text-lg font-light leading-relaxed text-navy-800 dark:text-navy-100">
          {inlineBold(trimmed)}
        </p>
      );
    }
  }
  flushList();
  return out;
}
