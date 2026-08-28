import { describe, expect, test } from "vitest";
import { renderMarkdown } from "./MarkdownPreview";

describe("MarkdownPreview", () => {
  test("keeps sanitized wikilinks clickable and readable", async () => {
    const html = await renderMarkdown(
      "Open [[Protocols/Transfection|the protocol]] before starting."
    );

    expect(html).toContain('href="#biota-wikilink=Protocols%2FTransfection"');
    expect(html).toContain(">the protocol</a>");
  });

  test("sanitizes script content from preview HTML", async () => {
    const html = await renderMarkdown("<script>alert('unsafe')</script>");

    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
  });
});
