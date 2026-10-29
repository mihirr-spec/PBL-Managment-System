/*
 * Turns HTML copied from Outlook, Gmail or Word into the announcement marks
 * (**bold**, ==highlight==, - bullets, 1. numbers, [links](url), | tables |),
 * so a pasted email keeps its formatting.
 */

const BLOCK = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "SECTION", "ARTICLE", "HEADER", "FOOTER"]);

/** True for colours that read as green (Outlook's #00B050, Gmail's #34a853 and the like). */
function isGreen(color: string): boolean {
  let r: number, g: number, b: number;
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  const rgb = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, "$&$&") : hex[1];
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else if (rgb) {
    [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
  } else {
    return /^(green|seagreen|forestgreen|darkgreen|limegreen|mediumseagreen)$/i.test(color.trim());
  }
  return g > 90 && g > r + 40 && g > b + 15;
}

function isBold(el: HTMLElement): boolean {
  if (el.tagName === "B" || el.tagName === "STRONG") return true;
  const w = el.style.fontWeight;
  return w === "bold" || w === "bolder" || Number(w) >= 600;
}

const tidy = (s: string) => s.replace(/[ \t ]+/g, " ");

/** Inline text of a node, with bold, green and links marked. */
function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return tidy(node.textContent ?? "").replace(/\n/g, " ");
  if (!(node instanceof HTMLElement)) return "";
  if (node.tagName === "BR") return "\n";
  if (node.tagName === "STYLE" || node.tagName === "SCRIPT") return "";
  let text = Array.from(node.childNodes).map(inline).join("");
  if (!text.trim()) return text;
  const lead = text.match(/^\s*/)![0];
  const trail = text.match(/\s*$/)![0];
  let core = text.trim();
  if (node.tagName === "A") {
    const href = node.getAttribute("href") ?? "";
    if (/^https?:\/\//i.test(href)) core = core === href ? href : `[${core.replace(/[[\]]/g, "")}](${href})`;
  }
  const green = node.style.color ? isGreen(node.style.color) : node.tagName === "FONT" && isGreen(node.getAttribute("color") ?? "");
  if (green && !core.startsWith("==")) core = `==${core}==`;
  if (isBold(node) && !core.startsWith("**")) core = `**${core}**`;
  text = lead + core + trail;
  return text;
}

/** Block-level walk: paragraphs, lists and tables on their own lines. */
function blocks(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = tidy(node.textContent ?? "");
    if (t.trim()) out.push(t.trim());
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  const tag = node.tagName;
  if (tag === "STYLE" || tag === "SCRIPT" || tag === "HEAD" || tag === "META") return;

  if (tag === "UL" || tag === "OL") {
    out.push("");
    let n = 0;
    for (const li of Array.from(node.children)) {
      if (li.tagName !== "LI") continue;
      const line = inline(li).replace(/\s*\n\s*/g, " ").trim();
      if (line) out.push(tag === "OL" ? `${++n}. ${line}` : `- ${line}`);
    }
    out.push("");
    return;
  }
  if (tag === "TABLE") {
    out.push("");
    const rows = Array.from(node.querySelectorAll("tr"));
    rows.forEach((tr, i) => {
      const cells = Array.from(tr.children).map((c) => inline(c).replace(/\s*\n\s*/g, " ").replace(/\|/g, "/").trim());
      out.push(`| ${cells.join(" | ")} |`);
      if (i === 0) out.push(`| ${cells.map(() => "---").join(" | ")} |`);
    });
    out.push("");
    return;
  }
  if (tag === "BR") {
    out.push("");
    return;
  }

  const hasBlockChild = Array.from(node.children).some(
    (c) => BLOCK.has(c.tagName) || c.tagName === "UL" || c.tagName === "OL" || c.tagName === "TABLE",
  );
  if (hasBlockChild) {
    // Mixed content: inline runs between child blocks become their own lines.
    let run: Node[] = [];
    const flush = () => {
      const t = run.map(inline).join("").trim();
      if (t) out.push(...t.split("\n").map((l) => l.trim()));
      run = [];
    };
    for (const child of Array.from(node.childNodes)) {
      if (child instanceof HTMLElement && (BLOCK.has(child.tagName) || ["UL", "OL", "TABLE"].includes(child.tagName))) {
        flush();
        blocks(child, out);
      } else run.push(child);
    }
    flush();
    if (tag === "P") out.push("");
    return;
  }

  let text = inline(node).trim();
  // Word and Outlook lists arrive as paragraphs starting with a bullet glyph.
  text = text.replace(/^(\*\*)?[·•▪o§]\s+/, "- $1");
  if (/^H[1-6]$/.test(tag) && text) text = `## ${text}`;
  if (BLOCK.has(tag)) {
    // Outlook web writes one <div> per line (an empty one is a blank line);
    // Word writes one <p> per paragraph.
    out.push(...(text ? text.split("\n").map((l) => l.trim()) : [""]));
    if (tag === "P" || /^H[1-6]$/.test(tag)) out.push("");
  } else if (text) {
    out.push(text);
  }
}

/** Clipboard HTML to announcement text. */
export function htmlToMarks(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: string[] = [];
  blocks(doc.body, out);
  return out
    .join("\n")
    .replace(/\*\*\s*\*\*/g, "")
    .replace(/====/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
