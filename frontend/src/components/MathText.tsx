import { Fragment, useMemo } from "react";
import katex from "katex";

interface Props {
  text: string;
  className?: string;
}

// Découpe un texte en segments : texte normal / formule inline ($...$) / formule bloc ($$...$$)
function splitMath(text: string) {
  const parts: { type: "text" | "inline" | "block"; content: string }[] = [];
  const regex = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      parts.push({ type: "block", content: match[1] });
    } else if (match[2] !== undefined) {
      parts.push({ type: "inline", content: match[2] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }
  return parts;
}

export default function MathText({ text, className }: Props) {
  const parts = useMemo(() => splitMath(text || ""), [text]);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === "text") {
          return <Fragment key={i}>{part.content}</Fragment>;
        }
        try {
          const html = katex.renderToString(part.content, {
            throwOnError: false,
            displayMode: part.type === "block",
          });
          const Tag: "div" | "span" = part.type === "block" ? "div" : "span";
          return <Tag key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <Fragment key={i}>{part.content}</Fragment>;
        }
      })}
    </span>
  );
}
