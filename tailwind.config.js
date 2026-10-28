/** @type {import('tailwindcss').Config} */
// Class names are also built in JS with h(), so scan js/ too.
module.exports = {
  content: ["./index.html", "./js/**/*.js"],
  theme: { extend: {} },
  plugins: [],
};
