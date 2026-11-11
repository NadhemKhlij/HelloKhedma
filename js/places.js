// Place suggestions for the Offers search box (#loc + <datalist id="locList">, offers.js): the main job-market cities
// of each country of the Offers country menu, with the places this browser already searched in that country first.
// Built in on purpose: nothing is sent anywhere while typing (no geocoding service, no privacy policy change), and any
// other place can still be typed (France: also a postcode or a département number).
// - Cities only, no regions: for France, La bonne alternance (and France Travail) turn the place into a département
//   with the Geo API, which knows towns, not regions ("Île-de-France" would silently search the whole country).
// - Spelling of the local job sites the sources query (München, Milano, Bruxelles, Genève…); US cities as "City, ST".
//   France: no homonym bigger elsewhere (the Geo API picks the most populated town of that name).
// - Recent places: "hk.places" = { <country>: [place, …] }, newest first, RECENT per country, this browser only;
//   rememberPlace() is called by each search.
import { ls } from "./lib.js";

const KEY = "hk.places", RECENT = 8;
const list = (s) => s.split("|");
export const PLACES = {
  fr: list("Paris|Lyon|Marseille|Toulouse|Lille|Bordeaux|Nantes|Strasbourg|Montpellier|Nice|Rennes|Grenoble|Rouen|Toulon|Reims|Saint-Étienne|Le Havre|Dijon|Angers|Nîmes|Clermont-Ferrand|Aix-en-Provence|Brest|Tours|Amiens|Limoges|Annecy|Metz|Nancy|Besançon|Orléans|Caen|Mulhouse|Perpignan|Poitiers|Pau|La Rochelle|Avignon|Le Mans|Valence|Villeurbanne|Mérignac|Blagnac|Boulogne-Billancourt|Nanterre|Courbevoie|Puteaux|Issy-les-Moulineaux|Levallois-Perret|Neuilly-sur-Seine|Rueil-Malmaison|Versailles|Massy|Vélizy-Villacoublay|Montreuil|Saclay"),
  gb: list("London|Manchester|Birmingham|Edinburgh|Glasgow|Leeds|Bristol|Liverpool|Cambridge|Oxford|Reading|Belfast|Cardiff|Newcastle upon Tyne|Sheffield|Nottingham|Leicester|Southampton|Brighton|Milton Keynes|Aberdeen|Coventry|York|Bath|Swindon|Slough|Guildford|Basingstoke"),
  us: list("New York, NY|San Francisco, CA|Seattle, WA|Austin, TX|Boston, MA|Chicago, IL|Los Angeles, CA|San Jose, CA|Washington, DC|Atlanta, GA|Dallas, TX|Houston, TX|Denver, CO|Raleigh, NC|Charlotte, NC|Miami, FL|Phoenix, AZ|San Diego, CA|Minneapolis, MN|Philadelphia, PA|Pittsburgh, PA|Salt Lake City, UT|Portland, OR|Nashville, TN|Columbus, OH|Detroit, MI|St. Louis, MO|Kansas City, MO"),
  de: list("Berlin|München|Hamburg|Frankfurt am Main|Köln|Stuttgart|Düsseldorf|Leipzig|Dresden|Hannover|Nürnberg|Bremen|Essen|Dortmund|Karlsruhe|Mannheim|Bonn|Münster|Heidelberg|Darmstadt|Aachen|Freiburg im Breisgau|Augsburg|Wiesbaden|Potsdam|Walldorf"),
  nl: list("Amsterdam|Rotterdam|Den Haag|Utrecht|Eindhoven|Groningen|Tilburg|Almere|Breda|Nijmegen|Arnhem|Haarlem|Amersfoort|Leiden|Delft|Zwolle|Maastricht|Enschede|Apeldoorn|Hilversum|'s-Hertogenbosch|Amstelveen|Hoofddorp"),
  ca: list("Toronto|Montréal|Vancouver|Calgary|Ottawa|Edmonton|Québec|Winnipeg|Waterloo|Kitchener|Mississauga|Halifax|Victoria|Hamilton|Laval|Gatineau|Burnaby|Markham|Saskatoon|Regina"),
  au: list("Sydney|Melbourne|Brisbane|Perth|Adelaide|Canberra|Gold Coast|Hobart|Darwin|Newcastle|Wollongong|Geelong|Parramatta"),
  be: list("Bruxelles|Antwerpen|Gent|Liège|Leuven|Namur|Charleroi|Mechelen|Brugge|Hasselt|Louvain-la-Neuve|Mons|Wavre|Kortrijk|Zaventem|Diegem"),
  ch: list("Zürich|Genève|Basel|Bern|Lausanne|Luzern|Lugano|Zug|St. Gallen|Winterthur|Neuchâtel|Fribourg|Baden|Schaffhausen"),
  es: list("Madrid|Barcelona|Valencia|Sevilla|Málaga|Bilbao|Zaragoza|Alicante|Palma|Las Palmas de Gran Canaria|Murcia|Valladolid|Vigo|A Coruña|Granada|San Sebastián|Pamplona|Santander"),
  it: list("Milano|Roma|Torino|Bologna|Firenze|Napoli|Genova|Padova|Verona|Venezia|Bari|Brescia|Bergamo|Trieste|Parma|Modena|Pisa|Catania|Palermo|Cagliari"),
};

function recentAll() {
  try { const v = JSON.parse(ls.get(KEY) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
const same = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;

// Remember a searched place for that country (newest first, no duplicates whatever the case or accents); a built-in
// city keeps its own spelling ("saint-etienne" → "Saint-Étienne").
export function rememberPlace(country, place) {
  place = String(place || "").trim().slice(0, 80);
  if (!country || !place) return;
  place = (PLACES[country] || []).find((p) => same(p, place)) || place;
  const all = recentAll();
  all[country] = [place, ...(Array.isArray(all[country]) ? all[country] : []).filter((p) => typeof p === "string" && !same(p, place))].slice(0, RECENT);
  ls.set(KEY, JSON.stringify(all));
}

// Suggestions for a country: places searched here first, then the built-in cities.
export function placeOptions(country) {
  const out = [];
  for (const p of [...(recentAll()[country] || []), ...(PLACES[country] || [])]) {
    if (typeof p === "string" && p.trim() && !out.some((q) => same(q, p))) out.push(p.trim());
  }
  return out;
}
