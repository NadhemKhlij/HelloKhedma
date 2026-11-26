// Where an offer really is (functional audit of 2026-11-23, section 2). The location shown used to be the source's own
// field, and sources get it wrong: Adzuna placed a NEXTON offer "en CDI, à Lille !" in "Paris, Ile-de-France", and JSearch
// (Google Jobs) placed "Technicien Support Applicatif SQL – Lisbonne, Portugal" in "Paris, FR". offerPlace() reads the
// place written in the offer itself and compares it with the source's:
// - a known city or country in the job title wins (titles like "… – Lisbonne, Portugal");
// - otherwise a city introduced in the text by "à", "sur", "basé à", "based in", "Lieu :", "Localisation :"… counts only
//   when the text names exactly one such city (a company introduction listing its offices proves nothing), and not after
//   words about trips, head offices or agencies ("Déplacements à Nantes", "siège social à Paris");
// - conflict = the source names another known city or another country; then the offer's place is shown, with the
//   source's in a note. No place at all → place null ("Location not stated" on the card).
// - abroad = the offer's place is in another country than the one searched (shown as "Outside the country searched").
// Cities: places.js (the countries of the Offers menu) plus big cities of nearby countries, with their French and English
// names. Built in, nothing sent anywhere. No DOM: checked by the smoke tests ("offer place").
import { PLACES } from "./places.js";

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, " ");

// Extra names: other countries' big cities, and the French / English names of cities that places.js spells locally.
const EXTRA = {
  pt: ["Lisbonne", "Lisbon", "Lisboa", "Porto"], lu: ["Luxembourg"], ie: ["Dublin"], mc: ["Monaco"],
  tn: ["Tunis", "Sfax", "Sousse"], ma: ["Casablanca", "Rabat", "Tanger", "Marrakech"], dz: ["Alger", "Algiers", "Oran"],
  pl: ["Varsovie", "Warsaw", "Cracovie", "Krakow"], ro: ["Bucarest", "Bucharest"], at: ["Vienna", "Wien"],
  gb: ["Londres"], be: ["Brussels", "Anvers", "Antwerp", "Gand", "Ghent", "Liege"], ch: ["Geneve", "Geneva", "Zurich", "Bale", "Lucerne"],
  de: ["Munich", "Cologne", "Francfort", "Frankfurt", "Hambourg", "Dusseldorf"], it: ["Milan", "Rome", "Turin", "Naples", "Florence", "Venise", "Venice"],
  es: ["Barcelone", "Seville", "Saragosse"], nl: ["La Haye", "The Hague"],
};
const COUNTRIES = {
  fr: ["France"], gb: ["Royaume-Uni", "United Kingdom", "Angleterre", "England", "UK"], us: ["Etats-Unis", "United States", "USA"],
  de: ["Allemagne", "Germany", "Deutschland"], nl: ["Pays-Bas", "Netherlands"], ca: ["Canada"], au: ["Australie", "Australia"],
  be: ["Belgique", "Belgium"], ch: ["Suisse", "Switzerland"], es: ["Espagne", "Spain", "Espana"], it: ["Italie", "Italy", "Italia"],
  pt: ["Portugal"], lu: ["Luxembourg"], ie: ["Irlande", "Ireland"], tn: ["Tunisie", "Tunisia"], ma: ["Maroc", "Morocco"],
  dz: ["Algerie", "Algeria"], pl: ["Pologne", "Poland"], ro: ["Roumanie", "Romania"], at: ["Autriche", "Austria"], mc: ["Monaco"],
};
// Short names that are also common words or names of other things: never matched on their own.
const SKIP = new Set(["nice", "valence", "orleans", "laval", "victoria", "reading", "bath", "york", "set"]);

// name (folded, without ", ST" for US cities) → { name, country }
const CITY = new Map();
const add = (name, country) => {
  const key = fold(name.replace(/,\s*[A-Z]{2}$/, "")).trim();
  if (key.length >= 3 && !SKIP.has(key) && !CITY.has(key)) CITY.set(key, { name: name.replace(/,\s*[A-Z]{2}$/, ""), country });
};
for (const [c, list] of Object.entries(PLACES)) list.forEach((n) => add(n, c));
for (const [c, list] of Object.entries(EXTRA)) list.forEach((n) => add(n, c));
const COUNTRY = new Map(Object.entries(COUNTRIES).flatMap(([c, names]) => names.map((n) => [fold(n), c])));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alt = (keys) => [...keys].sort((a, b) => b.length - a.length).map(esc).join("|");
const B = "(?<![a-z0-9-])", E = "(?![a-z0-9-])";
const CITY_RE = new RegExp(`${B}(${alt(CITY.keys())})${E}`, "g");
const COUNTRY_RE = new RegExp(`${B}(${alt(COUNTRY.keys())})${E}`, "g");
// "à Lille", "sur Lille", "basé à Lille", "based in Lille", "Lieu : Lille", "Localisation : Lille (59)"…
const CUE_RE = new RegExp(`${B}(?:a|sur|base[e]?s? a|situe[e]?s? a|localise[e]?s? a|based in|located in|location\\s*:|lieu(?: de travail)?\\s*:|localisation\\s*:|ville\\s*:)\\s+(${alt(CITY.keys())})${E}`, "g");

const NOT_WORKPLACE = /(deplacement|voyage|travel|trip|siege|head ?office|headquarter|agences?|filiales?|implante|present)[a-z]*[^.]*$/;
const citiesIn = (text) => [...fold(text).matchAll(CITY_RE)].map((m) => CITY.get(m[1]));
const countriesIn = (text) => [...fold(text).matchAll(COUNTRY_RE)].map((m) => COUNTRY.get(m[1]));

// { place, source, fromOffer, conflict, abroad, country }
export function offerPlace({ title = "", text = "", location = "", searchCountry = "" }) {
  const source = String(location || "").trim();
  const inTitle = citiesIn(title)[0];
  const titleCountry = countriesIn(title)[0];
  const ft = fold(text);
  // Trips, head offices and agency lists are not the workplace ("Déplacements à Nantes", "siège social à Paris").
  const cued = [...new Map([...ft.matchAll(CUE_RE)].filter((m) => !NOT_WORKPLACE.test(ft.slice(Math.max(0, m.index - 40), m.index + 1)))
    .map((m) => [m[1], CITY.get(m[1])])).values()];
  const found = inTitle || (cued.length === 1 ? cued[0] : null);
  const country = found?.country || titleCountry || null;
  const srcCities = citiesIn(source), srcCountries = countriesIn(source);
  const srcCountry = srcCities[0]?.country || srcCountries[0] || null;
  const sameCity = found && srcCities.some((c) => c.name === found.name || fold(c.name) === fold(found.name));
  const conflict = Boolean(found && !sameCity && (srcCities.length > 0 || (srcCountry && srcCountry !== found.country)))
    || Boolean(!found && titleCountry && srcCountry && srcCountry !== titleCountry);
  // The country is added when the offer itself names it and it differs from the source's ("Lisbonne, Portugal").
  const named = (code) => COUNTRIES[code]?.find((n) => fold(title).includes(fold(n))) || null;
  const place = conflict && found ? [found.name, country !== srcCountry ? named(country) : null].filter(Boolean).join(", ")
    : conflict ? source : source || found?.name || null;
  const abroad = Boolean(country && searchCountry && country !== searchCountry.toLowerCase());
  return { place: place || null, source, fromOffer: conflict || (!source && Boolean(found)), conflict, abroad, country };
}
