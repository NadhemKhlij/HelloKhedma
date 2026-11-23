import base from "./playwright.config.mjs";
export default { ...base, reporter: "line", use: { ...base.use, proxy: { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" }, launchOptions: { executablePath: "/opt/pw-browsers/chromium" } } };
