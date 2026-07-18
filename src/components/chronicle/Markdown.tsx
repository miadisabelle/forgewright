'use client';

import type { ComponentProps } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Chronicle prose on the warm-coal ground — styled manually, no typography
// plugin. react-markdown never renders raw HTML, so registered narrative
// bodies stay inert markup. Layout survival rules: tables scroll inside
// their own container, code blocks sit on raised iron, and links wrap
// instead of bursting narrow cards.
const components: Components = {
  h1: (props) => <h1 className="mt-3 text-[15px] font-semibold text-neutral-100 first:mt-0" {...props} />,
  h2: (props) => <h2 className="mt-3 text-body font-semibold text-neutral-100 first:mt-0" {...props} />,
  h3: (props) => <h3 className="mt-2.5 text-[13px] font-semibold text-neutral-200 first:mt-0" {...props} />,
  h4: (props) => <h4 className="mt-2.5 text-caption font-semibold uppercase tracking-wide text-neutral-300 first:mt-0" {...props} />,
  h5: (props) => <h5 className="mt-2 text-caption font-medium text-neutral-300 first:mt-0" {...props} />,
  h6: (props) => <h6 className="mt-2 text-caption font-medium text-neutral-400 first:mt-0" {...props} />,
  p: (props) => <p className="mt-2.5 leading-relaxed first:mt-0" {...props} />,
  a: ({ href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="break-words [overflow-wrap:anywhere] text-neutral-100 underline decoration-neutral-600 underline-offset-2 transition-colors hover:text-white hover:decoration-neutral-400"
      {...props}
    />
  ),
  ul: (props) => <ul className="mt-2.5 list-disc space-y-1 pl-5 marker:text-neutral-500 first:mt-0" {...props} />,
  ol: (props) => <ol className="mt-2.5 list-decimal space-y-1 pl-5 marker:text-neutral-500 first:mt-0" {...props} />,
  li: (props) => <li className="leading-relaxed [&>ul]:mt-1 [&>ol]:mt-1" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="mt-2.5 border-l-2 border-neutral-700 py-0.5 pl-3 text-neutral-400 first:mt-0 [&>p]:mt-1.5 [&>p:first-child]:mt-0"
      {...props}
    />
  ),
  code: ({ className, ...props }: ComponentProps<'code'>) =>
    className?.includes('language-') ? (
      <code className={`${className} font-mono text-[11.5px]`} {...props} />
    ) : (
      <code
        className="rounded bg-fw-iron-2 px-1 py-0.5 font-mono text-[11.5px] text-neutral-100 [overflow-wrap:anywhere]"
        {...props}
      />
    ),
  pre: (props) => (
    <pre
      className="mt-2.5 overflow-x-auto rounded-md border border-fw-border bg-fw-iron-2 p-3 font-mono text-[11.5px] leading-[1.55] text-neutral-200 first:mt-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mt-2.5 overflow-x-auto rounded border border-fw-border first:mt-0">
      <table className="w-full min-w-max border-collapse text-left text-caption" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-fw-iron-2" {...props} />,
  th: (props) => (
    <th className="whitespace-nowrap px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400" {...props} />
  ),
  td: (props) => <td className="border-t border-fw-border px-2.5 py-1.5 align-top" {...props} />,
  hr: () => <hr className="my-3.5 border-fw-border" />,
  strong: (props) => <strong className="font-semibold text-neutral-100" {...props} />,
  em: (props) => <em className="italic text-neutral-200" {...props} />,
  input: (props) => <input className="mr-1.5 accent-neutral-500" disabled {...props} />,
  img: ({ alt }) => (
    <span className="mt-2.5 block rounded border border-dashed border-neutral-700 px-2.5 py-1.5 text-[11px] text-neutral-500">
      🖼 {alt || 'image'} (not loaded in read-only view)
    </span>
  ),
};

export default function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`text-[13px] leading-[1.6] text-neutral-300 ${className ?? ''}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
