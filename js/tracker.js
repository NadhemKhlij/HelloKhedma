import { h, safeUrl, safeColor } from "./lib.js";
import { STAGES } from "./store.js";

export function renderBoard(root, cards, { onMove, onRemove, colorOf }) {
  root.replaceChildren(...STAGES.map((st, i) => {
    const items = cards.filter((c) => c.stage === st.id);
    const col = h("div", { class: "rounded-lg p-2 min-h-[140px]", style: "background:var(--bg);border:1px solid var(--line)" },
      h("h3", { class: "flex justify-between px-1 pb-2 text-sm font-medium" }, st.label, h("span", { class: "mute" }, items.length)),
      items.length ? items.map((c) => card(c, i, { onMove, onRemove, colorOf })) : h("p", { class: "mute text-sm px-1" }, "Drop a card here."),
    );
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.style.outline = "2px dashed var(--accent)"; });
    col.addEventListener("dragleave", () => { col.style.outline = ""; });
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.style.outline = "";
      const id = e.dataTransfer.getData("text/plain");
      if (id) onMove(id, st.id);
    });
    return col;
  }));
}

function card(c, stageIndex, { onMove, onRemove, colorOf }) {
  const url = safeUrl(c.url);
  const move = (delta) => onMove(c.id, STAGES[stageIndex + delta].id);
  const btn = (label, title, disabled, fn) =>
    h("button", { class: "btn-ghost !px-2 !py-0", type: "button", title, "aria-label": title, disabled, onClick: fn }, label);
  const el = h("div", {
    class: "rounded-lg p-2 mb-2 text-sm cursor-grab",
    draggable: "true",
    style: `background:var(--panel);border:1px solid var(--line);border-left:3px solid ${safeColor(colorOf(c.path_id))}`,
  },
    h("b", { class: "block" }, c.title),
    h("span", { class: "mute" }, c.company || "No company"),
    url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "block underline", style: "color:var(--accent)" }, "Open offer") : null,
    h("div", { class: "flex gap-1 mt-2" },
      btn("←", "Move back", stageIndex === 0, () => move(-1)),
      btn("→", "Move forward", stageIndex === STAGES.length - 1, () => move(1)),
      btn("Delete", "Delete application", false, () => onRemove(c.id)),
    ),
  );
  el.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", c.id));
  return el;
}
