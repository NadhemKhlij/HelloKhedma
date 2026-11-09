// Practice model for the DAX courses (2026-11-09): writes content/dax/retail.json, a small fictional star schema that
// js/daxeval.js loads in the browser (runnable DAX exercises) and scripts/test-dax.mjs loads into SQLite to check the
// engine against SQL. Fixed seed: re-running rewrites the file identically. Run from the repo root:
//   node scripts/gen-dax-model.mjs
// Tables: Sales (fact, one row per order line), Product, Customer, Store and Date (every day of 2023–2025).
// Date[Month] sorts by Date[Month Number]. A small library of measures (Total Sales, Total Cost, Margin, Quantity,
// Orders, Customers) that exercises can hand to the learner. Customers 41-52 first buy in 2024 and 53-60 in 2025;
// customers 9, 18, 27 and 36 buy nothing in 2025.
// Relationships (many-to-one, filters flow from the dimension to Sales): Sales[OrderDate] → Date[Date] (active),
// Sales[DeliveryDate] → Date[Date] (inactive, for USERELATIONSHIP), Sales[ProductKey] → Product, Sales[CustomerKey] →
// Customer, Sales[StoreKey] → Store. The story the numbers tell: sales grow each year (2024 about +29 %, 2025 about +13 %),
// with a November–December peak; Phones grow fastest, Computers dip in 2025, Home shrinks in 2025; the Online store
// grows faster than the shops.
// After a change: npm run test-dax (engine vs SQL) and npm run check-content (every DAX answer is run).
import { mkdirSync, writeFileSync } from "node:fs";

let s = 2026;
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Date: every day of 2023-2025. Dates are ISO strings in the JSON; the engine turns them into day numbers.
const dates = [];
for (let d = new Date(Date.UTC(2023, 0, 1)); d <= new Date(Date.UTC(2025, 11, 31)); d.setUTCDate(d.getUTCDate() + 1)) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  dates.push([`${y}-${pad(m)}-${pad(d.getUTCDate())}`, y, `Q${Math.ceil(m / 3)}`, m, MONTHS[m - 1], `${y}-${pad(m)}`,
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]]);
}

// Product: key, name, category, subcategory, colour, list price, unit cost.
const product = [
  [1, "Aria Earbuds", "Audio", "Headphones", "Black", 79, 31], [2, "Aria Earbuds", "Audio", "Headphones", "White", 79, 31],
  [3, "Studio Headphones", "Audio", "Headphones", "Black", 199, 84], [4, "Pocket Speaker", "Audio", "Speakers", "Blue", 59, 22],
  [5, "Room Speaker", "Audio", "Speakers", "Black", 249, 110], [6, "Soundbar", "Audio", "Speakers", "Black", 399, 175],
  [7, "Ultrabook 13", "Computers", "Laptops", "Silver", 1099, 690], [8, "Ultrabook 15", "Computers", "Laptops", "Silver", 1399, 880],
  [9, "Gaming Laptop", "Computers", "Laptops", "Black", 1799, 1180], [10, "Monitor 27", "Computers", "Monitors", "Black", 329, 190],
  [11, "Monitor 32", "Computers", "Monitors", "Black", 549, 330], [12, "Keyboard", "Computers", "Accessories", "White", 89, 34],
  [13, "Phone S", "Phones", "Smartphones", "Black", 499, 290], [14, "Phone S", "Phones", "Smartphones", "Blue", 499, 290],
  [15, "Phone Pro", "Phones", "Smartphones", "Silver", 999, 610], [16, "Phone Max", "Phones", "Smartphones", "Black", 1199, 740],
  [17, "Phone Case", "Phones", "Accessories", "Blue", 29, 6], [18, "Charger 30W", "Phones", "Accessories", "White", 39, 11],
  [19, "Robot Vacuum", "Home", "Cleaning", "White", 449, 240], [20, "Air Purifier", "Home", "Air", "White", 299, 150],
  [21, "Smart Bulb", "Home", "Lighting", "White", 25, 9], [22, "Smart Plug", "Home", "Lighting", "White", 19, 7],
  [23, "Coffee Machine", "Home", "Kitchen", "Black", 349, 170], [24, "Kettle", "Home", "Kitchen", "Silver", 69, 28],
];
// Customer: key, name, city, country, segment.
const cities = [["Paris", "France"], ["Lyon", "France"], ["Lille", "France"], ["Tunis", "Tunisia"], ["Sfax", "Tunisia"], ["Brussels", "Belgium"]];
const first = ["Lea", "Hugo", "Ines", "Adam", "Sara", "Yanis", "Lina", "Omar", "Nour", "Paul", "Emma", "Karim", "Chloe", "Rayan", "Amel"];
const last = ["Martin", "Ben Salah", "Dubois", "Trabelsi", "Laurent", "Haddad", "Moreau", "Jaziri", "Petit", "Gharbi"];
const customer = [];
for (let k = 1; k <= 60; k++) {
  const [city, country] = cities[(k * 7) % cities.length];
  customer.push([k, `${first[k % first.length]} ${last[(k * 3) % last.length]}`, city, country, k % 4 === 0 ? "Business" : "Consumer"]);
}
// Store: key, name, city, channel.
const store = [[1, "Paris Opera", "Paris", "Shop"], [2, "Lyon Part-Dieu", "Lyon", "Shop"], [3, "Tunis Lac", "Tunis", "Shop"],
  [4, "Brussels Louise", "Brussels", "Shop"], [5, "Online", "Paris", "Online"]];

// Sales: order lines. Volume per month follows growth + seasonality; mix shifts as described above.
const growth = { 2023: 1, 2024: 1.18, 2025: 1.32 };
const season = [0.8, 0.75, 0.9, 0.9, 0.95, 0.9, 0.85, 0.8, 1, 1.05, 1.35, 1.6];
const catWeight = (cat, y) => ({ Audio: 1, Computers: 0.8, Phones: y === 2023 ? 0.8 : y === 2024 ? 1.05 : 1.3, Home: y === 2025 ? 0.55 : 0.8 }[cat]);
// Customers who buy each year: 1-40 from 2023, 41-52 join in 2024, 53-60 in 2025; every 9th of the first 40 stops
// after 2024 (new and lost customers, and "customers who bought" differs from "all customers").
const active = {
  2023: customer.filter(([k]) => k <= 40).map(([k]) => k),
  2024: customer.filter(([k]) => k <= 52).map(([k]) => k),
  2025: customer.filter(([k]) => !(k <= 40 && k % 9 === 0)).map(([k]) => k),
};
const sales = [];
let order = 10000;
for (const y of [2023, 2024, 2025]) for (let m = 1; m <= 12; m++) {
  const lines = Math.round(46 * growth[y] * season[m - 1]);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let i = 0; i < lines; i++) {
    let p;
    do { p = pick(product); } while (rnd() > catWeight(p[2], y) / 1.3);
    const st = rnd() < (y === 2023 ? 0.2 : y === 2024 ? 0.28 : 0.36) ? 5 : 1 + Math.floor(rnd() * 4);
    const day = 1 + Math.floor(rnd() * days);
    const od = `${y}-${pad(m)}-${pad(day)}`;
    const dd = new Date(Date.UTC(y, m - 1, day + 1 + Math.floor(rnd() * (st === 5 ? 5 : 2))));
    const delivery = dd.getUTCFullYear() > 2025 ? "2025-12-31" : `${dd.getUTCFullYear()}-${pad(dd.getUTCMonth() + 1)}-${pad(dd.getUTCDate())}`;
    const qty = p[5] > 500 ? 1 : 1 + Math.floor(rnd() * (p[5] < 50 ? 4 : 2));
    const discount = rnd() < 0.25 ? [0.05, 0.1, 0.15][Math.floor(rnd() * 3)] : 0;
    const net = Math.round(p[5] * (1 - discount) * 100) / 100;
    sales.push([++order, od, delivery, p[0], pick(active[y]), st, qty, net, p[6]]);
  }
}

const model = {
  name: "retail",
  about: "Fictional electronics retailer, 2023–2025. Generated by scripts/gen-dax-model.mjs (fixed seed).",
  tables: {
    Sales: { columns: ["Order Number", "OrderDate", "DeliveryDate", "ProductKey", "CustomerKey", "StoreKey", "Quantity", "Net Price", "Unit Cost"],
      types: ["int", "date", "date", "int", "int", "int", "int", "number", "number"], rows: sales },
    Product: { columns: ["ProductKey", "Product", "Category", "Subcategory", "Color", "List Price", "Unit Cost"],
      types: ["int", "text", "text", "text", "text", "number", "number"], key: "ProductKey", rows: product },
    Customer: { columns: ["CustomerKey", "Customer", "City", "Country", "Segment"],
      types: ["int", "text", "text", "text", "text"], key: "CustomerKey", rows: customer },
    Store: { columns: ["StoreKey", "Store", "City", "Channel"], types: ["int", "text", "text", "text"], key: "StoreKey", rows: store },
    Date: { columns: ["Date", "Year", "Quarter", "Month Number", "Month", "Year Month", "Day of Week"],
      types: ["date", "int", "text", "int", "text", "text", "text"], key: "Date", rows: dates, dateTable: true,
      sortBy: { Month: "Month Number" } },
  },
  relationships: [
    { from: "Sales[OrderDate]", to: "Date[Date]", active: true },
    { from: "Sales[DeliveryDate]", to: "Date[Date]", active: false },
    { from: "Sales[ProductKey]", to: "Product[ProductKey]", active: true },
    { from: "Sales[CustomerKey]", to: "Customer[CustomerKey]", active: true },
    { from: "Sales[StoreKey]", to: "Store[StoreKey]", active: true },
  ],
  // Measures an exercise may give the learner ("dax": { "measures": ["Total Sales"] }); scripts/test-dax.mjs checks them
  // against SQL.
  measures: {
    "Total Sales": "SUMX(Sales, Sales[Quantity] * Sales[Net Price])",
    "Total Cost": "SUMX(Sales, Sales[Quantity] * Sales[Unit Cost])",
    "Margin": "[Total Sales] - [Total Cost]",
    "Quantity": "SUM(Sales[Quantity])",
    "Orders": "DISTINCTCOUNT(Sales[Order Number])",
    "Customers": "DISTINCTCOUNT(Sales[CustomerKey])",
  },
};
mkdirSync("content/dax", { recursive: true });
writeFileSync("content/dax/retail.json", JSON.stringify(model) + "\n");
console.log(`content/dax/retail.json: ${sales.length} sales lines, ${dates.length} dates, ${product.length} products, ${customer.length} customers`);
