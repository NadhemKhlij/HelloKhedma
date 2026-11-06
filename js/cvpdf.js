// CV PDF (CV maker, "Download PDF"): builds the CV as a real text PDF in the browser with pdf-lib (js/vendor, loaded on
// demand), from the same layout model as the preview (cvModel() in cvmaker.js). Nothing is sent anywhere.
// Why not the browser's print: print adds the browser's own header and footer (URL, date, page numbers) and page breaks
// differ between phones and computers. Here the file is the same everywhere, with exact margins and page breaks.
// ATS rules followed: one column, Helvetica (the PDF standard font, metrically identical to Arial), no images, icons,
// tables, headers or footers; text drawn left to right and top to bottom so it is extracted in reading order; standard
// section titles. Page breaks: a section title never ends a page, an entry's title lines stay with what follows, a
// bullet is never split, an entry's last two bullets stay together. When the last page would be mostly empty, compact
// passes (smaller gaps, then slightly smaller type, never under 10 pt body text) are tried and kept if they save it.
// Text widths are summed per character: pdf-lib's widthOfTextAtSize adds kerning that drawText does not apply.
// Characters outside the standard font (WinAnsi) are replaced by their closest plain form.

const MM = 72 / 25.4;
const PAGE = { w: 210 * MM, h: 297 * MM };
// Sizes in pt. "compact" and "tight" are only used when they save a page (see cvPdf); body text stays >= 10 pt.
const STYLES = {
  normal: { name: 20, head: 11.5, contact: 9.5, h2: 11.5, title: 11, body: 10.5, when: 10, lead: 1.22,
    marginY: 14 * MM, marginX: 16 * MM, secGap: 14, ruleGap: 3.5, afterRule: 6, entryGap: 6, bulletGap: 2.5, paraGap: 2 },
  compact: { name: 19, head: 11, contact: 9.5, h2: 11, title: 10.5, body: 10, when: 9.5, lead: 1.18,
    marginY: 12 * MM, marginX: 15 * MM, secGap: 10, ruleGap: 3, afterRule: 4.5, entryGap: 4, bulletGap: 1.5, paraGap: 1.5 },
  tight: { name: 18, head: 10.5, contact: 9, h2: 10.5, title: 10.5, body: 10, when: 9.5, lead: 1.14,
    marginY: 11 * MM, marginX: 14 * MM, secGap: 8, ruleGap: 2.5, afterRule: 4, entryGap: 3.5, bulletGap: 1, paraGap: 1 },
};
const COLOR = { ink: [0.12, 0.176, 0.302], text: [0.1, 0.1, 0.1], mute: [0.33, 0.33, 0.33] };
const BULLET_INDENT = 11;

let libPromise;
const loadLib = () => (libPromise ||= import(new URL("./vendor/pdf-lib.esm.min.js", import.meta.url).href));

// Returns the PDF bytes (Uint8Array) for a cvModel() result.
export async function cvPdf(model) {
  const lib = await loadLib();
  const normal = await build(lib, model, STYLES.normal);
  // A last page under 40% full looks unfinished: try the compact styles and keep the first one that saves that page.
  if (normal.pages > 1 && normal.lastFill < 0.4) {
    for (const style of [STYLES.compact, STYLES.tight]) {
      const fit = await build(lib, model, style);
      if (fit.pages < normal.pages) return fit.doc.save();
    }
  }
  return normal.doc.save();
}

async function build({ PDFDocument, StandardFonts, rgb }, model, S) {
  const doc = await PDFDocument.create();
  const F = { reg: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const supported = new Set(F.reg.getCharacterSet());
  const color = (c) => rgb(...COLOR[c]);
  const W = PAGE.w - 2 * S.marginX, X0 = S.marginX, X1 = PAGE.w - S.marginX;
  const lh = (size) => size * S.lead;

  // Plain-form fallback for characters the standard font cannot draw.
  const MAP = { "→": "->", "←": "<-", "⇒": "=>", "≥": ">=", "≤": "<=", "✓": "-", " ": " ", " ": " ", " ": " ", "‑": "-", "‐": "-" };
  const clean = (s) => [...String(s ?? "")].map((ch) => {
    if (supported.has(ch.codePointAt(0))) return ch;
    if (MAP[ch]) return MAP[ch];
    const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    return [...base].every((c) => supported.has(c.codePointAt(0))) ? base : "";
  }).join("").replace(/\s+/g, " ").trim();
  // Width as drawn (no kerning): sum of the character widths.
  const cache = new Map();
  const width = (text, font, size) => {
    let w = 0;
    for (const ch of text) {
      const key = `${font === F.bold ? "b" : "r"}${ch}`;
      if (!cache.has(key)) cache.set(key, font.widthOfTextAtSize(ch, 1000));
      w += cache.get(key);
    }
    return (w * size) / 1000;
  };

  // Word wrap of runs [{ text, font, color }] into lines of runs within maxW. A word longer than a line (a URL) is cut.
  function wrap(runs, size, maxW) {
    const lines = [];
    let line = [], x = 0;
    const put = (text, font, c) => {
      const last = line[line.length - 1];
      if (last && last.font === font && last.color === c) last.text += text; else line.push({ text, font, color: c });
      x += width(text, font, size);
    };
    for (const r of runs) {
      // Like HTML: a run that does not start with a space sticks to the previous one (", Paris" after a bold company).
      let glue = !/^\s/.test(r.text);
      for (const w of clean(r.text).split(" ").filter(Boolean)) {
        let rest = w;
        if (glue && line.length && x + width(rest, r.font, size) <= maxW) { put(rest, r.font, r.color); glue = false; continue; }
        glue = false;
        if (line.length && x + width(` ${rest}`, r.font, size) > maxW) { lines.push(line); line = []; x = 0; }
        while (!line.length && width(rest, r.font, size) > maxW) {
          let n = rest.length;
          while (n > 1 && width(rest.slice(0, n), r.font, size) > maxW) n--;
          put(rest.slice(0, n), r.font, r.color); lines.push(line); line = []; x = 0; rest = rest.slice(n);
        }
        if (!rest) continue;
        if (line.length) put(" ", r.font, r.color);
        put(rest, r.font, r.color);
      }
    }
    if (line.length) lines.push(line);
    return lines;
  }

  let page, y, pages = 0;
  const newPage = () => { page = doc.addPage([PAGE.w, PAGE.h]); y = PAGE.h - S.marginY; pages++; };
  const ensure = (hgt) => { if (y - hgt < S.marginY) newPage(); };
  // Draws one line of runs. The baseline is y - base (base = the size of the line's main text), so text of another
  // size on the same line (the dates) shares the baseline.
  function drawRuns(runs, size, x, c, { center = false, base = size } = {}) {
    const total = runs.reduce((s, r) => s + width(r.text, r.font, size), 0);
    let cx = center ? X0 + (W - total) / 2 : x;
    for (const r of runs) { page.drawText(r.text, { x: cx, y: y - base, size, font: r.font, color: color(r.color || c) }); cx += width(r.text, r.font, size); }
  }

  newPage();

  // Header: name, headline, contact line (items never broken: wrapped at the separators between items).
  drawRuns([{ text: clean(model.name), font: F.bold }], S.name, X0, "ink", { center: true });
  y -= lh(S.name) + 1;
  if (model.headline) {
    for (const line of wrap([{ text: model.headline, font: F.reg }], S.head, W)) { drawRuns(line, S.head, X0, "text", { center: true }); y -= lh(S.head); }
  }
  if (model.contact.length) {
    const items = model.contact.map(clean).filter(Boolean), sep = "  |  ", rows = [[]];
    for (const it of items) {
      const row = rows[rows.length - 1];
      if (row.length && width([...row, it].join(sep), F.reg, S.contact) > W) rows.push([it]); else row.push(it);
    }
    y -= 1;
    for (const row of rows) { drawRuns([{ text: row.join(sep), font: F.reg }], S.contact, X0, "mute", { center: true }); y -= lh(S.contact); }
  }

  const B = S.body, BL = lh(B);
  const bulletLines = (item) => wrap([{ text: item.text, font: F.reg }], B, W - BULLET_INDENT - (item.right ? width(item.right, F.reg, S.when) + 12 : 0));
  const bulletHeight = (item) => bulletLines(item).length * BL + S.bulletGap;

  function bullets(items) {
    items.forEach((item, i) => {
      const lines = bulletLines(item);
      // A bullet is never split; the last two bullets of a list stay together (no lone bullet on a new page).
      ensure(i === items.length - 2 ? bulletHeight(item) + bulletHeight(items[i + 1]) : lines.length * BL);
      lines.forEach((line, j) => {
        if (!j) {
          drawRuns([{ text: "•", font: F.reg }], B, X0 + 2, "text");
          if (item.right) drawRuns([{ text: clean(item.right), font: F.reg }], S.when, X1 - width(clean(item.right), F.reg, S.when), "text", { base: B });
        }
        drawRuns(line, B, X0 + BULLET_INDENT, "text"); y -= BL;
      });
      y -= S.bulletGap;
    });
  }

  // Entry: title (bold, ink) with the dates on the right on the same baseline; organisation (bold) and place (grey)
  // below; context (grey); bullets.
  function entry(e) {
    const whenText = clean(e.right), whenW = whenText ? width(whenText, F.reg, S.when) : 0;
    const TL = lh(S.title);
    const titleLines = wrap([{ text: e.title, font: F.bold }], S.title, W - (whenW ? whenW + 14 : 0));
    const subRuns = [...(e.org ? [{ text: e.org, font: F.bold }] : []), ...(e.place ? [{ text: `${e.org ? ", " : ""}${e.place}`, font: F.reg, color: "mute" }] : [])];
    const subLines = subRuns.length ? wrap(subRuns, B, W) : [];
    const ctxLines = e.context.flatMap((c) => wrap([{ text: c, font: F.reg }], B, W));
    const items = e.bullets.map((text) => ({ text }));
    // Title lines + at least two lines of what follows stay on the same page.
    const follow = Math.min(2, ctxLines.length + items.reduce((n, it) => n + bulletLines(it).length, 0));
    ensure(S.entryGap + titleLines.length * TL + (subLines.length + follow) * BL);
    y -= S.entryGap;
    titleLines.forEach((line, i) => {
      drawRuns(line, S.title, X0, "ink");
      if (!i && whenText) drawRuns([{ text: whenText, font: F.reg }], S.when, X1 - whenW, "text", { base: S.title });
      y -= TL;
    });
    for (const line of subLines) { drawRuns(line, B, X0, "text"); y -= BL; }
    for (const line of ctxLines) { ensure(BL); drawRuns(line, B, X0, "mute"); y -= BL; }
    if (items.length) { y -= 1; bullets(items); }
  }

  for (const [si, sec] of model.sections.entries()) {
    // Section title: never alone at the bottom of a page (title + rule + two lines must fit).
    const gap = si ? S.secGap : S.secGap - 2;
    ensure(gap + lh(S.h2) + S.ruleGap + S.afterRule + 2 * BL);
    y -= gap;
    drawRuns([{ text: clean(sec.title).toUpperCase(), font: F.bold }], S.h2, X0, "ink");
    y -= S.h2 + S.ruleGap;
    page.drawLine({ start: { x: X0, y }, end: { x: X1, y }, thickness: 0.5, color: color("ink") });
    y -= S.afterRule;
    for (const blk of sec.blocks) {
      if (blk.type === "p" || blk.type === "label") {
        const runs = blk.type === "p" ? [{ text: blk.text, font: F.reg }] : [{ text: `${blk.label}:`, font: F.bold }, { text: ` ${blk.text}`, font: F.reg }];
        for (const line of wrap(runs, B, W)) { ensure(BL); drawRuns(line, B, X0, "text"); y -= BL; }
        y -= S.paraGap;
      } else if (blk.type === "bullets") {
        bullets(blk.items.map((it) => (typeof it === "string" ? { text: it } : it)));
      } else if (blk.type === "entry") {
        entry(blk);
      }
    }
  }

  doc.setTitle(clean(`${model.name} - CV`));
  doc.setAuthor(clean(model.name));
  if (model.headline) doc.setSubject(clean(model.headline));
  doc.setLanguage(model.lang === "fr" ? "fr-FR" : "en-GB");
  doc.setCreator("HelloKhedma");
  doc.setProducer("HelloKhedma");
  const usable = PAGE.h - 2 * S.marginY;
  return { doc, pages, lastFill: (PAGE.h - S.marginY - y) / usable };
}
