// CV PDF (CV maker, "Download PDF"): builds the CV as a real text PDF in the browser with pdf-lib (js/vendor, loaded on
// demand), from the same layout model as the preview (cvModel() in cvmaker.js). Nothing is sent anywhere.
// Why not the browser's print: print adds the browser's own header and footer (URL, date, page numbers) and page breaks
// differ between phones and computers. Here the file is the same everywhere, with exact margins and page breaks.
// ATS rules followed: one column, Helvetica (the PDF standard font, metrically identical to Arial), no images, icons,
// tables, headers or footers; text drawn left to right and top to bottom so it is extracted in reading order; standard
// section titles; a section title never ends a page, an entry's title lines stay together, a bullet is never split.
// Characters outside the standard font (WinAnsi) are replaced by their closest plain form.

const MM = 72 / 25.4;
const PAGE = { w: 210 * MM, h: 297 * MM };
const M = { top: 14 * MM, bottom: 14 * MM, side: 16 * MM };
const SIZE = { name: 20, head: 11.5, contact: 9.5, h2: 11.5, body: 10.5, when: 10 };
const LEAD = 1.27; // line height, times the font size
const COLOR = { ink: [0.12, 0.176, 0.302], text: [0.1, 0.1, 0.1], mute: [0.3, 0.3, 0.3] };

let libPromise;
const loadLib = () => (libPromise ||= import(new URL("./vendor/pdf-lib.esm.min.js", import.meta.url).href));

// Returns the PDF bytes (Uint8Array) for a cvModel() result.
export async function cvPdf(model) {
  const { PDFDocument, StandardFonts, rgb } = await loadLib();
  const doc = await PDFDocument.create();
  const F = { reg: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const supported = new Set(F.reg.getCharacterSet());
  const color = (c) => rgb(...COLOR[c]);
  const W = PAGE.w - 2 * M.side, X0 = M.side, X1 = PAGE.w - M.side;

  // Plain-form fallback for characters the standard font cannot draw.
  const MAP = { "→": "->", "←": "<-", "⇒": "=>", "≥": ">=", "≤": "<=", "✓": "-", " ": " ", " ": " ", " ": " ", "‑": "-", "‐": "-" };
  const clean = (s) => [...String(s ?? "")].map((ch) => {
    if (supported.has(ch.codePointAt(0))) return ch;
    if (MAP[ch]) return MAP[ch];
    const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    return [...base].every((c) => supported.has(c.codePointAt(0))) ? base : "";
  }).join("").replace(/\s+/g, " ").trim();
  const width = (text, font, size) => font.widthOfTextAtSize(text, size);

  // Word wrap of runs [{ text, font }] into lines of runs within maxW. A word longer than a line (a URL) is cut.
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

  let page, y;
  const newPage = () => { page = doc.addPage([PAGE.w, PAGE.h]); y = PAGE.h - M.top; };
  const room = (hgt) => y - hgt >= M.bottom;
  const ensure = (hgt) => { if (!room(hgt)) newPage(); };
  const lh = (size) => size * LEAD;
  // Draws one line of runs with its baseline at the current line; x from the left margin (or centered).
  function drawRuns(runs, size, x, c, { center = false } = {}) {
    const total = runs.reduce((s, r) => s + width(r.text, r.font, size), 0);
    let cx = center ? X0 + (W - total) / 2 : x;
    for (const r of runs) { page.drawText(r.text, { x: cx, y: y - size, size, font: r.font, color: color(r.color || c) }); cx += width(r.text, r.font, size); }
  }
  const linesOf = (runs, size, maxW) => wrap(runs, size, maxW);

  newPage();

  // Header: name, headline, contact line (items never broken: wrapped at the " | " between items).
  y -= 2;
  drawRuns([{ text: clean(model.name), font: F.bold }], SIZE.name, X0, "ink", { center: true });
  y -= lh(SIZE.name);
  if (model.headline) {
    for (const line of linesOf([{ text: model.headline, font: F.bold }], SIZE.head, W)) { drawRuns(line, SIZE.head, X0, "text", { center: true }); y -= lh(SIZE.head); }
  }
  if (model.contact.length) {
    const items = model.contact.map(clean).filter(Boolean), sep = "  |  ", rows = [[]];
    for (const it of items) {
      const row = rows[rows.length - 1], test = [...row, it].join(sep);
      if (row.length && width(test, F.reg, SIZE.contact) > W) rows.push([it]); else row.push(it);
    }
    y -= 1;
    for (const row of rows) { drawRuns([{ text: row.join(sep), font: F.reg }], SIZE.contact, X0, "mute", { center: true }); y -= lh(SIZE.contact); }
  }

  const B = SIZE.body, BL = lh(B);
  const bulletIndent = 11;
  for (const [si, sec] of model.sections.entries()) {
    // Section title: never alone at the bottom of a page (title + rule + first two lines must fit).
    const gapBefore = si ? 12 : 10;
    ensure(gapBefore + lh(SIZE.h2) + 4 + 2 * BL);
    y -= gapBefore;
    drawRuns([{ text: clean(sec.title).toUpperCase(), font: F.bold }], SIZE.h2, X0, "ink");
    y -= lh(SIZE.h2) - 1;
    page.drawLine({ start: { x: X0, y }, end: { x: X1, y }, thickness: 0.9, color: color("ink") });
    y -= 5;

    for (const blk of sec.blocks) {
      if (blk.type === "p" || blk.type === "label") {
        const runs = blk.type === "p" ? [{ text: blk.text, font: F.reg }] : [{ text: `${blk.label}:`, font: F.bold }, { text: ` ${blk.text}`, font: F.reg }];
        const lines = linesOf(runs, B, W);
        for (const line of lines) { ensure(BL); drawRuns(line, B, X0, "text"); y -= BL; }
        y -= 1.5;
      } else if (blk.type === "bullets") {
        bullets(blk.items);
      } else if (blk.type === "entry") {
        entry(blk);
      }
    }
  }

  function bullets(items) {
    for (const item of items) {
      const lines = linesOf([{ text: item, font: F.reg }], B, W - bulletIndent);
      ensure(lines.length * BL); // a bullet is never split across pages
      lines.forEach((line, i) => {
        if (!i) drawRuns([{ text: "•", font: F.reg }], B, X0 + 2, "text");
        drawRuns(line, B, X0 + bulletIndent, "text"); y -= BL;
      });
      y -= 0.8;
    }
  }

  // Entry: title (bold) with dates on the right; organisation and place below; context; bullets.
  function entry(e) {
    const whenText = clean(e.right), whenW = whenText ? width(whenText, F.reg, SIZE.when) : 0;
    const titleLines = linesOf([{ text: e.title, font: F.bold }], B, W - (whenW ? whenW + 14 : 0));
    const subRuns = [...(e.org ? [{ text: e.org, font: F.bold }] : []), ...(e.place ? [{ text: `${e.org ? ", " : ""}${e.place}`, font: F.reg, color: "mute" }] : [])];
    const subLines = subRuns.length ? linesOf(subRuns, B, W) : [];
    const ctxLines = e.context.flatMap((c) => linesOf([{ text: c, font: F.reg }], B, W));
    const firstBullet = e.bullets[0] ? linesOf([{ text: e.bullets[0], font: F.reg }], B, W - bulletIndent).length : 0;
    // Title, organisation and at least the first line of what follows stay on the same page.
    ensure((titleLines.length + subLines.length + Math.min(1, ctxLines.length + firstBullet)) * BL + 5);
    y -= 5;
    titleLines.forEach((line, i) => {
      drawRuns(line, B, X0, "ink");
      if (!i && whenText) drawRuns([{ text: whenText, font: F.reg }], SIZE.when, X1 - whenW, "mute");
      y -= BL;
    });
    for (const line of subLines) { drawRuns(line, B, X0, "text"); y -= BL; }
    for (const line of ctxLines) { ensure(BL); drawRuns(line, B, X0, "mute"); y -= BL; }
    if (e.bullets.length) { y -= 0.5; bullets(e.bullets); }
    y -= 1;
  }

  doc.setTitle(clean(`${model.name} - CV`));
  doc.setAuthor(clean(model.name));
  if (model.headline) doc.setSubject(clean(model.headline));
  doc.setLanguage(model.lang === "fr" ? "fr-FR" : "en-GB");
  doc.setCreator("HelloKhedma");
  doc.setProducer("HelloKhedma");
  return doc.save();
}
