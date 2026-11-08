// Offer coach (ROADMAP 2.8): when an application reaches "Offer", compare the offered salary with the market for the
// path and prepare the negotiation. Opened from the tracker card ("💼 Negotiate"), the details dialog and Home's
// Next actions. Everything runs in the browser; nothing is sent anywhere.
// - The offer: the card's Salary field, editable here ("48k €", "48 000 € brut annuel", "3 500 € brut mensuel"),
//   read by salary.js; "Save to the application" writes it back to the card.
// - The market: marketPay() (pulse.js): Adzuna's advertised salaries for the path's main title (middle half and
//   median), or the euro salaries of the offers seen on the Offers page. A bar places the offer on that range, with a
//   verdict (below, lower half, upper half, above) when both are in the same currency.
// - Negotiation tips, and a prompt to copy into the user's own AI (role, company, offer, market range, [brackets] for
//   their priorities and arguments; no CV text).
import { $, h, toast, copyText } from "./lib.js";
import { t, lang } from "./i18n.js";
import { state } from "./state.js";
import { parseSalary, formatSalary } from "./salary.js";
import { marketPay } from "./pulse.js";

const yearly = (x) => ({ ...x, min: x.yearMin, max: x.yearMax, period: "year" });
const money = (min, max = min, currency = "EUR") => formatSalary({ min: Math.round(min / 500) * 500, max: Math.round(max / 500) * 500, currency, period: "year", estimated: false });

// Where the offer sits: { key, text, color } (key: below | lower | upper | above).
function verdict(mid, m) {
  const diff = Math.round(((mid - m.median) / m.median) * 100);
  if (mid < m.low) return { key: "below", color: "#e0508b", text: t("Below the market: about {n}% under the median. Negotiate with the figures below.", { n: Math.abs(diff) }) };
  if (mid <= m.median) return { key: "lower", color: "#f08a24", text: t("In the market, lower half ({n}% vs the median): there is room to ask for more.", { n: diff }) };
  if (mid <= m.high) return { key: "upper", color: "#18a999", text: t("In the market, upper half (+{n}% vs the median): a good offer.", { n: diff }) };
  return { key: "above", color: "#18a999", text: t("Above the market (+{n}% vs the median): negotiate the rest of the package rather than the base.", { n: diff }) };
}

// Range bar: the middle half of the market shaded, the median and the offer marked.
function bar(m, mid) {
  const from = Math.min(m.low, mid ?? m.low) * 0.85, to = Math.max(m.high, mid ?? m.high) * 1.1;
  const x = (v) => `${(((v - from) / (to - from)) * 100).toFixed(1)}%`;
  return h("div", { class: "relative h-9 mt-2", "aria-hidden": "true" },
    h("div", { class: "absolute top-3 inset-x-0 h-2 rounded-full", style: "background:var(--line)" }),
    h("div", { class: "absolute top-3 h-2 rounded-full", style: `left:${x(m.low)};width:calc(${x(m.high)} - ${x(m.low)});background:color-mix(in srgb, var(--accent) 45%, transparent)` }),
    h("div", { class: "absolute top-1.5 h-5 w-0.5", style: `left:${x(m.median)};background:var(--accent)` }),
    mid != null ? h("div", { class: "absolute top-0 -translate-x-1/2 text-lg leading-none", style: `left:${x(mid)}` }, "▼") : null);
}

const TIPS = [
  "Thank them, sound pleased, and ask for a few days to answer: do not accept or refuse on the call.",
  "Ask for the whole offer in writing: base salary, variable part, bonus, benefits, remote days, start date.",
  "Counter with one precise figure near the top of the market range, backed by two of your results: a precise number reads as researched, a range lets them pick its bottom.",
  "If the base cannot move, negotiate the rest: signing bonus, training budget, extra remote days, job title, a salary review after 6 months.",
  "Compare like with like: gross yearly salary (brut annuel in France), and ask whether the variable part is guaranteed.",
  "Stay warm and short in writing; one round of negotiation is normal and rarely puts an offer at risk.",
];

function promptFor(c, offerText, m) {
  const fr = lang === "fr";
  const market = m ? (fr
    ? `Marché pour ce poste (${m.source === "adzuna" ? "salaires annoncés sur Adzuna" : "offres que j’ai consultées"}) : moitié centrale ${money(m.low, m.high, m.currency)}, médiane ${money(m.median, m.median, m.currency)}.`
    : `Market for this role (${m.source === "adzuna" ? "advertised salaries on Adzuna" : "offers I looked at"}): middle half ${money(m.low, m.high, m.currency)}, median ${money(m.median, m.median, m.currency)}.`) : "";
  return fr ? [
    "J’ai reçu une offre d’emploi et je veux la négocier de façon honnête et professionnelle.",
    `Poste : ${c.title}${c.company ? ` chez ${c.company}` : ""}.`,
    `Offre : ${offerText || "[salaire proposé, variable, avantages]"}.`, market,
    "Mes priorités : [salaire / jours de télétravail / formation / date de début].",
    "Mes meilleurs arguments : [2 ou 3 résultats ou compétences, chiffrés].",
    "1) Dis-moi si l’offre est basse, correcte ou haute, et quoi demander précisément.",
    "2) Écris un e-mail de contre-proposition court et chaleureux, en français.",
    "3) Donne-moi des réponses aux 3 objections que les recruteurs font le plus souvent.",
  ].filter(Boolean).join("\n") : [
    "I received a job offer and want to negotiate it honestly and professionally.",
    `Role: ${c.title}${c.company ? ` at ${c.company}` : ""}.`,
    `Offer: ${offerText || "[salary offered, variable pay, benefits]"}.`, market,
    "My priorities: [salary / remote days / training / start date].",
    "My strongest arguments: [2 or 3 results or skills, with numbers].",
    "1) Tell me whether the offer is low, fair or high, and exactly what to ask for.",
    "2) Write a short, warm counter-offer email, in English.",
    "3) Give me answers to the 3 objections recruiters raise most often.",
  ].filter(Boolean).join("\n");
}

export async function openOfferCoach(c) {
  const dlg = $("#coachDialog"), body = $("#coachBody");
  const input = h("input", { class: "input w-full", value: c.salary || "", "aria-label": t("Salary offered"), placeholder: t("e.g. 48k € gross a year") });
  const read = h("p", { class: "text-sm" }), market = h("div", { class: "grid gap-1" }), promptBox = h("textarea", { class: "input w-full text-xs font-mono", rows: "9", readonly: true, "aria-label": t("Prompt") });
  const save = h("button", { type: "button", class: "btn-ghost", hidden: true, onClick: async () => {
    try {
      await state.store.update(c.id, { salary: input.value.trim() });
      c.salary = input.value.trim(); save.hidden = true; toast(t("Salary saved to the application."));
      (await import("./applications.js")).refreshTracker();
    } catch (e) { toast(e.message); }
  } }, t("Save to the application"));
  body.replaceChildren(h("p", { class: "mute text-sm" }, t("Loading the market…")));
  if (!dlg.open) dlg.showModal();
  const m = await marketPay();
  const draw = () => {
    const offer = parseSalary(input.value, { trusted: true }), y = offer && yearly(offer);
    const mid = y ? (y.min + y.max) / 2 : null;
    save.hidden = input.value.trim() === (c.salary || "");
    read.replaceChildren(!input.value.trim() ? h("span", { class: "mute" }, t("Write the salary offered to compare it with the market."))
      : y ? h("span", {}, t("Read as {pay}", { pay: formatSalary(y) }), offer.period !== "year" ? h("span", { class: "mute" }, t(" (from {pay})", { pay: formatSalary(offer) })) : null)
      : h("span", { style: "color:#f08a24" }, t("Could not read a salary: write it like 48k €, 48 000 € brut annuel or 3 500 € brut mensuel.")));
    const same = m && y && y.currency === m.currency;
    market.replaceChildren(...(m ? [
      h("p", { class: "text-sm" }, h("b", {}, t("Market for {title}: ", { title: m.title })), money(m.low, m.high, m.currency),
        h("span", { class: "mute" }, t(" (middle half) · median {median}", { median: money(m.median, m.median, m.currency) }))),
      bar(m, same ? mid : null),
      same ? (() => { const v = verdict(mid, m); return h("p", { class: "text-sm font-medium", style: `color:${v.color}`, "data-verdict": v.key }, v.text); })()
        : y ? h("p", { class: "mute text-sm" }, t("The offer and the market are in different currencies: compare them yourself.")) : null,
      h("p", { class: "mute text-xs" }, m.source === "adzuna"
        ? t("Source: {n} salaries advertised on Adzuna for this title. Advertised pay, not what people finally signed.", { n: m.n })
        : t("Source: {n} salaries given in the offers you looked at on HelloKhedma.", { n: m.n })),
    ] : [h("p", { class: "mute text-sm" }, t("Not enough salary data for this path yet. Run a few searches on the Offers page: the salaries they give build your reference."))]));
    promptBox.value = promptFor(c, input.value.trim(), m);
  };
  input.addEventListener("input", draw);
  body.replaceChildren(
    h("div", { class: "flex items-start gap-3" },
      h("div", { class: "flex-1" }, h("h2", { class: "!mb-0" }, t("💼 Offer coach")), h("p", { class: "mute text-sm" }, [c.title, c.company].filter(Boolean).join(" · "))),
      h("button", { type: "button", class: "btn-ghost !py-1", onClick: () => dlg.close() }, t("Close"))),
    h("label", { class: "grid gap-1 text-sm" }, h("span", { class: "font-medium" }, t("Salary offered")), input), read,
    h("div", { class: "flex flex-wrap gap-2" }, save),
    h("div", { class: "rounded-xl p-3 grid gap-1", style: "background:var(--soft)" }, market),
    h("div", { class: "grid gap-2" }, h("h3", { class: "font-semibold" }, t("Negotiate")),
      h("ol", { class: "list-decimal pl-5 grid gap-1 text-sm" }, TIPS.map((x) => h("li", {}, t(x))))),
    h("div", { class: "grid gap-2" }, h("h3", { class: "font-semibold" }, t("Prepare it with your AI assistant")),
      h("p", { class: "mute text-xs" }, t("Copy this prompt into your own AI (ChatGPT, Claude…), replace the [brackets]. Nothing is sent by HelloKhedma.")),
      promptBox,
      h("div", {}, h("button", { type: "button", class: "btn", onClick: () => copyText(promptBox.value, promptBox, t("Prompt copied. Paste it into your AI assistant.")) }, t("📋 Copy the prompt")))));
  draw();
  input.focus();
}
