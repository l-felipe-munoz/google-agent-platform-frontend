import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className || "");
    if (isBlock) {
      return (
        <code className={`font-mono text-[13px] ${className || ""}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre
      className="my-2 overflow-x-auto rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-[13px] leading-relaxed"
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...props }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-slate-200/80">
      <table className="w-full border-collapse text-left text-[13.5px]" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-slate-50 text-slate-700" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border-b border-slate-200/80 px-3 py-2 font-semibold whitespace-nowrap"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-b border-slate-100 px-3 py-2 align-top" {...props}>
      {children}
    </td>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-1.5 list-outside list-disc space-y-1 pl-5" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-1.5 list-outside list-decimal space-y-1 pl-5" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed" {...props}>
      {children}
    </li>
  ),
  p: ({ children, ...props }) => (
    <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0" {...props}>
      {children}
    </p>
  ),
  h1: ({ children, ...props }) => (
    <h1 className="mt-3 mb-1.5 text-[16px] font-bold text-slate-900 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-3 mb-1.5 text-[15px] font-bold text-slate-900 first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-2.5 mb-1 text-[14.5px] font-bold text-slate-900 first:mt-0" {...props}>
      {children}
    </h3>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-1.5 border-l-2 border-blue-300 pl-3 text-slate-600 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: (props) => <hr className="my-3 border-slate-200" {...props} />,
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-slate-900" {...props}>
      {children}
    </strong>
  ),
};

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div
      className={`text-[14.5px] leading-relaxed break-words font-sans [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
