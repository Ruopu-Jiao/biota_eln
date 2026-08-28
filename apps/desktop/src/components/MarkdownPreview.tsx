import { useEffect, useState, type MouseEvent } from "react";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

interface MarkdownPreviewProps {
  markdown: string;
  onOpenWikilink?: (target: string) => void;
}

const wikilinkHrefPrefix = "#biota-wikilink=";

export function prepareWikilinks(markdown: string) {
  return markdown.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, alias?: string) =>
      `[${alias?.trim() || target.trim()}](${wikilinkHrefPrefix}${encodeURIComponent(target.trim())})`
  );
}

export async function renderMarkdown(markdown: string) {
  const result = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(prepareWikilinks(markdown));
  return String(result);
}

export function MarkdownPreview({
  markdown,
  onOpenWikilink,
}: MarkdownPreviewProps) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let current = true;
    void renderMarkdown(markdown)
      .then((value) => {
        if (current) setHtml(value);
      })
      .catch(() => {
        if (current) setHtml("<p>Preview unavailable for this document.</p>");
      });
    return () => {
      current = false;
    };
  }, [markdown]);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as HTMLElement).closest("a");
    const href = anchor?.getAttribute("href");
    if (!href?.startsWith(wikilinkHrefPrefix)) return;
    event.preventDefault();
    onOpenWikilink?.(decodeURIComponent(href.slice(wikilinkHrefPrefix.length)));
  }

  return (
    <div
      className="markdown-preview prose"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
