'use client';

import type { ComponentProps } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Styled manually for the Chronicle's compact dark surface — no typography
// plugin. react-markdown never renders raw HTML, so registered narrative
// bodies stay inert markup.
const components: Components = {
  h1: (props) => <h1 className="mt-3 text-sm font-semibold text-neutral-100 first:mt-0" {...props} />,
  h2: (props) => <h2 className="mt-3 text-[13px] font-semibold text-neutral-100 first:mt-0" {...props} />,
  h3: (props) => <h3 className="mt-2.5 text-xs font-semibold text-neutral-200 first:mt-0" {...props} />,
  h4: (props) => <h4 className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-300 first:mt-0" {...props} />,
  h5: (props) => <h5 className="mt-2 text-[11px] font-medium text-neutral-300 first:mt-0" {...props} />,
  h6: (props) => <h6 className="mt-2 text-[11px] font-medium text-neutral-400 first:mt-0" {...props} />,
  p: (props) => <p className="mt-2 leading-relaxed first:mt-0" {...props} />,
  a: ({ href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-cyan-400 underline decoration-cyan-800 underline-offset-2 transition-colors hover:text-cyan-300"
      {...props}
    />
  ),
  ul: (props) => <ul className="mt-2 list-disc space-y-1 pl-4 first:mt-0" {...props} />,
  ol: (props) => <ol className="mt-2 list-decimal space-y-1 pl-4 first:mt-0" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  blockquote: (props) => (
    <blockquote className="mt-2 border-l-2 border-neutral-700 pl-3 text-neutral-400 first:mt-0" {...props} />
  ),
  code: ({ className, ...props }: ComponentProps<'code'>) =>
    className?.includes('language-') ? (
      <code className={`${className} font-mono text-[10px]`} {...props} />
    ) : (
      <code className="rounded bg-neutral-800/80 px-1 py-0.5 font-mono text-[10px] text-amber-200/90" {...props} />
    ),
  pre: (props) => (
    <pre
      className="mt-2 overflow-x-auto rounded border border-neutral-800 bg-neutral-950/80 p-2.5 font-mono text-[10px] leading-relaxed text-neutral-300 first:mt-0"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mt-2 overflow-x-auto first:mt-0">
      <table className="w-full border-collapse text-left" {...props} />
    </div>
  ),
  thead: (props) => <thead className="border-b border-neutral-700" {...props} />,
  th: (props) => <th className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400" {...props} />,
  td: (props) => <td className="border-b border-neutral-800/60 px-2 py-1 align-top" {...props} />,
  hr: () => <hr className="my-3 border-neutral-800" />,
  strong: (props) => <strong className="font-semibold text-neutral-100" {...props} />,
  em: (props) => <em className="italic text-neutral-200" {...props} />,
  input: (props) => <input className="mr-1 accent-pink-600" disabled {...props} />,
  img: ({ alt }) => (
    <span className="mt-2 block rounded border border-dashed border-neutral-700 px-2 py-1 text-[10px] text-neutral-500">
      🖼 {alt || 'image'} (not loaded in read-only view)
    </span>
  ),
};

export default function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`text-[11px] leading-relaxed text-neutral-300 ${className ?? ''}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
