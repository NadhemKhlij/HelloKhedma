// "Fix this file" checks (training step 2d, 2026-11-06): Kubernetes manifests, GitHub Actions workflows and
// Dockerfiles, checked with rules in plain JS. No DOM here: the same code runs in the browser (drills.js loads it on
// demand, with the self-hosted YAML parser) and in CI (scripts/check-content.mjs), so a course answer that CI accepts
// is accepted in the app too. Nothing is sent anywhere.
//   checkFile(code, text, rules) -> { error: { line, reason } | null, results: [{ id, title, ok, problems }] }
//     code: "yaml" (one or more documents separated by ---) or "dockerfile"; rules: ids, or { id, ...params };
//     title and each problem are { m, p }: an English text (a key of js/i18n-fr.js) and its {placeholders}.
//   RULES: the known rule ids, with the file kind each one reads.
// Rules (params in brackets):
//   k8s-basics      every document has apiVersion, kind and metadata.name
//   k8s-selector    a Deployment / StatefulSet / DaemonSet selector matches its pod template labels
//   k8s-image-tag   every container image has a fixed version (tag or digest, not latest)
//   k8s-resources   every container requests CPU and memory and has a memory limit (a CPU limit stays optional)
//   k8s-probes      every container of a long-running workload has a readiness and a liveness probe
//   k8s-security    every container runs as non-root, without privilege escalation, not privileged
//   k8s-secrets     no password / token / key in plain text in env (valueFrom.secretKeyRef instead)
//   k8s-service     each Service selects pods of the file and its targetPort is one of their ports
//   k8s-replicas    [min = 2] Deployments run at least min replicas
//   gha-basics      on + jobs; each job has runs-on and steps; each step has uses or run
//   gha-pinned      every action is pinned to a release tag or a commit SHA, not a branch
//   gha-permissions a top-level permissions block, not write-all
//   gha-secrets     no secret written in the workflow (env / with values come from ${{ secrets.* }})
//   gha-injection   no ${{ github.event.* }} / ${{ github.head_ref }} inside run: (pass them through env)
//   gha-needs       [job, needs] the job waits for the other one
//   gha-branch      [job] the job only runs for the main branch
//   gha-timeout     every job has timeout-minutes
//   docker-from-tag every base image has a fixed version (tag or digest, not latest)
//   docker-user     the final image does not run as root (USER)
//   docker-cache-order dependencies are installed before the rest of the code is copied (layer cache)
//   docker-apt      apt-get update + install -y --no-install-recommends + rm -rf /var/lib/apt/lists/* in one RUN
//   docker-copy     COPY rather than ADD for local files
//   docker-secrets  no password / token / key in ENV or ARG, no key files copied into the image
//   docker-exec-form CMD and ENTRYPOINT in exec form (JSON array)
//   docker-multistage the final image comes from a build stage (FROM … AS build, COPY --from=build)
import { loadAll } from "./vendor/js-yaml.esm.min.js";

// t() only marks the texts for scripts/check-i18n.pl; drills.js translates them (keys of js/i18n-fr.js).
const t = (m, p = {}) => ({ m, p });
const SECRET_NAME = /(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CREDENTIAL|WEBHOOK)/i;
const SECRET_VALUE = /(AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY)/;
const obj = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
const list = (x) => (Array.isArray(x) ? x : []);

/* ---------- image references (Kubernetes and Docker) ---------- */
// "registry:5000/team/app:1.2" -> tag "1.2"; "app@sha256:…" -> digest; "app" -> no version.
function imageVersion(ref) {
  const s = String(ref || "").trim();
  if (s.includes("@sha256:")) return "digest";
  const last = s.slice(s.lastIndexOf("/") + 1);
  const k = last.indexOf(":");
  return k < 0 ? "" : last.slice(k + 1);
}
const fixedImage = (ref) => { const v = imageVersion(ref); return !!v && v.toLowerCase() !== "latest" && !v.includes("$"); };

/* ---------- Kubernetes ---------- */
const WORKLOADS = new Set(["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet"]);
function podOf(d) {
  const k = d.kind, s = obj(d.spec);
  if (k === "Pod") return { spec: s, labels: obj(obj(d.metadata).labels), long: true };
  if (WORKLOADS.has(k)) return { spec: obj(obj(s.template).spec), labels: obj(obj(obj(s.template).metadata).labels), long: true };
  if (k === "Job") return { spec: obj(obj(s.template).spec), labels: obj(obj(obj(s.template).metadata).labels), long: false };
  if (k === "CronJob") { const tp = obj(obj(obj(s.jobTemplate).spec).template); return { spec: obj(tp.spec), labels: obj(obj(tp.metadata).labels), long: false }; }
  return null;
}
const nameOf = (d) => `${d.kind || "?"} ${obj(d.metadata).name || "?"}`;
// Every container of the file with its pod and owner: [{ c, pod, doc }].
const containers = (docs, init = false) => docs.flatMap((d) => {
  const pod = podOf(d);
  if (!pod) return [];
  return [...list(pod.spec.containers), ...(init ? list(pod.spec.initContainers) : [])].map((c) => ({ c: obj(c), pod, doc: d }));
});
const cname = (c) => c.name || "?";
const subset = (a, b) => Object.entries(a).every(([k, v]) => String(b[k]) === String(v));

const K8S = {
  "k8s-basics": [t("Every document has apiVersion, kind and metadata.name"), (docs) => docs.flatMap((d, i) =>
    ["apiVersion", "kind"].filter((k) => !d[k]).concat(obj(d.metadata).name ? [] : ["metadata.name"])
      .map((f) => t("Document {n} has no {field}.", { n: i + 1, field: f })))],
  "k8s-selector": [t("The selector matches the pod template labels"), (docs) => docs.filter((d) => WORKLOADS.has(d.kind)).flatMap((d) => {
    const sel = obj(obj(obj(d.spec).selector).matchLabels), labels = podOf(d).labels;
    if (!Object.keys(sel).length) return [t("{obj}: spec.selector.matchLabels is missing.", { obj: nameOf(d) })];
    return Object.entries(sel).filter(([k, v]) => String(labels[k]) !== String(v))
      .map(([k, v]) => t("{obj}: the selector wants {label}, the pod template labels do not have it.", { obj: nameOf(d), label: `${k}: ${v}` }));
  })],
  "k8s-image-tag": [t("Every image has a fixed version (tag or digest, not latest)"), (docs) => containers(docs, true).filter(({ c }) => !fixedImage(c.image))
    .map(({ c }) => t("Container {c}: image {img} has no fixed version.", { c: cname(c), img: c.image || "?" }))],
  "k8s-resources": [t("Every container requests CPU and memory and has a memory limit"), (docs) => containers(docs).flatMap(({ c }) => {
    const r = obj(c.resources), req = obj(r.requests), lim = obj(r.limits);
    return [[req.cpu, "requests.cpu"], [req.memory, "requests.memory"], [lim.memory, "limits.memory"]].filter(([v]) => v == null || v === "")
      .map(([, f]) => t("Container {c}: resources.{field} is missing.", { c: cname(c), field: f }));
  })],
  "k8s-probes": [t("Every container has a readiness probe and a liveness probe"), (docs) => containers(docs).filter(({ pod }) => pod.long).flatMap(({ c }) =>
    ["readinessProbe", "livenessProbe"].filter((p) => !c[p]).map((p) => t("Container {c}: no {probe}.", { c: cname(c), probe: p })))],
  "k8s-security": [t("Containers run as non-root, without privilege escalation"), (docs) => containers(docs, true).flatMap(({ c, pod }) => {
    const sc = obj(c.securityContext), psc = obj(pod.spec.securityContext), out = [];
    const nonRoot = sc.runAsNonRoot ?? psc.runAsNonRoot, uid = sc.runAsUser ?? psc.runAsUser;
    if (!(nonRoot === true || (Number.isInteger(uid) && uid > 0))) out.push(t("Container {c}: set securityContext.runAsNonRoot: true.", { c: cname(c) }));
    if (sc.allowPrivilegeEscalation !== false) out.push(t("Container {c}: set securityContext.allowPrivilegeEscalation: false.", { c: cname(c) }));
    if (sc.privileged === true) out.push(t("Container {c}: privileged: true gives it full access to the node.", { c: cname(c) }));
    return out;
  })],
  "k8s-secrets": [t("No secret in plain text in env (use a Secret)"), (docs) => containers(docs, true).flatMap(({ c }) => list(c.env).map(obj)
    .filter((e) => e.value != null && (SECRET_NAME.test(e.name || "") || SECRET_VALUE.test(String(e.value))))
    .map((e) => t("Container {c}: {name} is written in the file; read it with valueFrom.secretKeyRef.", { c: cname(c), name: e.name || "?" })))],
  "k8s-service": [t("Each Service selects pods of the file, on one of their ports"), (docs) => docs.filter((d) => d.kind === "Service").flatMap((svc) => {
    const sel = obj(obj(svc.spec).selector);
    if (!Object.keys(sel).length) return [t("{obj}: spec.selector is missing.", { obj: nameOf(svc) })];
    const pods = containers(docs).filter(({ pod }) => subset(sel, pod.labels));
    if (!pods.length) return [t("{obj}: the selector {sel} matches no pod of the file.", { obj: nameOf(svc), sel: Object.entries(sel).map(([k, v]) => `${k}: ${v}`).join(", ") })];
    const ports = pods.flatMap(({ c }) => list(c.ports).map(obj));
    return list(obj(svc.spec).ports).map(obj).filter((p) => {
      const tp = p.targetPort ?? p.port;
      return !ports.some((cp) => (typeof tp === "number" ? cp.containerPort === tp : cp.name === tp || String(cp.containerPort) === String(tp)));
    }).map((p) => t("{obj}: targetPort {port} is not a port of the selected containers.", { obj: nameOf(svc), port: String(p.targetPort ?? p.port) }));
  })],
  "k8s-replicas": [t("Deployments run at least {min} replicas"), (docs, r) => docs.filter((d) => d.kind === "Deployment" && (obj(d.spec).replicas ?? 1) < (r.min ?? 2))
    .map((d) => t("{obj}: {n} replica(s); one pod down means the app is down.", { obj: nameOf(d), n: obj(d.spec).replicas ?? 1 }))],
};

/* ---------- GitHub Actions ---------- */
const jobsOf = (w) => Object.entries(obj(w.jobs)).map(([id, j]) => ({ id, j: obj(j) }));
const stepsOf = (w) => jobsOf(w).flatMap(({ id, j }) => list(j.steps).map((s, k) => ({ job: id, n: k + 1, s: obj(s) })));
const stepName = (x) => x.s.name || x.s.uses || `${x.job} #${x.n}`;
const BRANCH_REF = /^(main|master|dev|develop|trunk|head|latest|release)$/i;
function envBlocks(w) {
  const out = [{ where: "env", env: obj(w.env) }];
  for (const { id, j } of jobsOf(w)) out.push({ where: `jobs.${id}.env`, env: obj(j.env) });
  for (const x of stepsOf(w)) out.push({ where: stepName(x), env: obj(x.s.env) }, { where: stepName(x), env: obj(x.s.with) });
  return out;
}
const onlyMain = (on) => {
  const o = typeof on === "string" ? { [on]: null } : Array.isArray(on) ? Object.fromEntries(on.map((e) => [e, null])) : obj(on);
  const keys = Object.keys(o).filter((k) => k !== "workflow_dispatch");
  return keys.length === 1 && keys[0] === "push" && list(obj(o.push).branches).length > 0 && list(obj(o.push).branches).every((b) => ["main", "master"].includes(b));
};

const GHA = {
  "gha-basics": [t("The workflow has on and jobs; each job has runs-on and steps"), (docs) => {
    const w = obj(docs[0]), out = [];
    if (w.on == null) out.push(t("The workflow has no on: (what starts it)."));
    if (!jobsOf(w).length) out.push(t("The workflow has no jobs."));
    for (const { id, j } of jobsOf(w)) {
      if (j.uses) continue; // a reusable workflow call
      if (!j["runs-on"]) out.push(t("Job {job}: no runs-on.", { job: id }));
      if (!list(j.steps).length) out.push(t("Job {job}: no steps.", { job: id }));
    }
    for (const x of stepsOf(w)) if (!x.s.uses && !x.s.run) out.push(t("Step {step}: needs uses or run.", { step: stepName(x) }));
    return out;
  }],
  "gha-pinned": [t("Every action is pinned to a release tag or a commit SHA (not a branch)"), (docs) => {
    const w = obj(docs[0]);
    const uses = [...stepsOf(w).map((x) => x.s.uses), ...jobsOf(w).map(({ j }) => j.uses)].filter((u) => typeof u === "string");
    return uses.filter((u) => !u.startsWith("./") && !u.startsWith("docker://")).filter((u) => {
      const ref = u.includes("@") ? u.slice(u.lastIndexOf("@") + 1) : "";
      return !ref || BRANCH_REF.test(ref);
    }).map((u) => t("{action} follows a branch: pin a release (@v4) or, safer, a commit SHA.", { action: u }));
  }],
  "gha-permissions": [t("The workflow limits the GITHUB_TOKEN permissions"), (docs) => {
    const p = obj(docs[0]).permissions;
    if (p == null) return [t("No permissions: block: the token gets the repository's default rights. Add only what the jobs need (e.g. contents: read).")];
    if (p === "write-all" || Object.values(obj(p)).every((v) => v === "write") && Object.keys(obj(p)).length > 3) return [t("permissions: write-all gives every job write access to everything.")];
    return [];
  }],
  "gha-secrets": [t("No secret is written in the workflow (use ${{ secrets.NAME }})"), (docs) => {
    const w = obj(docs[0]), out = [];
    for (const b of envBlocks(w)) for (const [k, v] of Object.entries(b.env)) {
      const s = String(v ?? "");
      if (s.includes("${{")) continue;
      if ((SECRET_NAME.test(k) && s.trim()) || SECRET_VALUE.test(s)) out.push(t("{where}: {name} is written in the file; store it as a repository secret.", { where: b.where, name: k }));
    }
    for (const x of stepsOf(w)) if (SECRET_VALUE.test(String(x.s.run || ""))) out.push(t("{where}: the script contains a key or token.", { where: stepName(x) }));
    return out;
  }],
  "gha-injection": [t("No untrusted ${{ github.event… }} text inside run: (pass it through env)"), (docs) => stepsOf(obj(docs[0]))
    .filter((x) => /\$\{\{\s*github\.(event\.|head_ref)/.test(String(x.s.run || "")))
    .map((x) => t("{where}: run: pastes ${{ github… }} straight into the script; an issue title or branch name could run commands. Put it in env: and use \"$VAR\".", { where: stepName(x) }))],
  "gha-needs": [t("{job} waits for {needs}"), (docs, r) => {
    const j = obj(obj(obj(docs[0]).jobs)[r.job]);
    const needs = typeof j.needs === "string" ? [j.needs] : list(j.needs);
    return needs.includes(r.needs) ? [] : [t("Job {job} starts without waiting for {needs} (needs: {needs}).", { job: r.job, needs: r.needs })];
  }],
  "gha-branch": [t("{job} only runs for the main branch"), (docs, r) => {
    const w = obj(docs[0]), j = obj(obj(w.jobs)[r.job]);
    const cond = String(j.if || "");
    if (/github\.ref\s*==\s*'refs\/heads\/(main|master)'/.test(cond) && !/\|\|/.test(cond)) return [];
    if (onlyMain(w.on)) return [];
    return [t("Job {job} also runs for other branches and pull requests. Add if: github.ref == 'refs/heads/main' (or only run the workflow on pushes to main).", { job: r.job })];
  }],
  "gha-timeout": [t("Every job has timeout-minutes"), (docs) => jobsOf(obj(docs[0])).filter(({ j }) => !j.uses && !(Number(j["timeout-minutes"]) > 0))
    .map(({ id }) => t("Job {job}: no timeout-minutes (a stuck job runs for 6 hours).", { job: id }))],
};

/* ---------- Dockerfile ---------- */
const INSTR = new Set(["FROM", "RUN", "CMD", "LABEL", "EXPOSE", "ENV", "ADD", "COPY", "ENTRYPOINT", "VOLUME", "USER", "WORKDIR", "ARG", "ONBUILD", "STOPSIGNAL", "HEALTHCHECK", "SHELL", "MAINTAINER"]);
// -> [{ cmd, args, line }] (continuation lines joined), or throws { line, reason }.
function parseDockerfile(text) {
  const out = [], lines = String(text).split(/\r?\n/);
  let cur = null;
  lines.forEach((raw, i) => {
    const l = raw.trim();
    if (!cur && (!l || l.startsWith("#"))) return;
    if (cur && l.startsWith("#")) return; // comment inside a continued instruction
    if (cur) cur.args += " " + l.replace(/\\$/, "").trim();
    else {
      const m = /^([A-Za-z]+)\s*(.*)$/.exec(l);
      if (!m || !INSTR.has(m[1].toUpperCase())) throw { line: i + 1, reason: `unknown instruction "${l.split(/\s/)[0]}"` };
      cur = { cmd: m[1].toUpperCase(), args: m[2].replace(/\\$/, "").trim(), line: i + 1 };
    }
    if (/\\$/.test(l)) return;
    out.push(cur); cur = null;
  });
  if (cur) out.push(cur);
  if (!out.length) throw { line: 1, reason: "empty file" };
  if (out.find((x) => x.cmd !== "ARG")?.cmd !== "FROM") throw { line: out[0].line, reason: "a Dockerfile starts with FROM (after optional ARG lines)" };
  return out;
}
// Stages: [{ from, name, ins: [..] }]; ARG defaults declared before the first FROM fill ${NAME} / $NAME in FROM.
function stages(ins) {
  const out = [], args = {};
  for (const x of ins) {
    if (x.cmd === "ARG" && !out.length) {
      const [k, ...v] = x.args.trim().split("=");
      if (v.length) args[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
    } else if (x.cmd === "FROM") {
      const parts = x.args.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (m, k) => (k in args ? args[k] : m)).split(/\s+/).filter((p) => !p.startsWith("--"));
      out.push({ from: parts[0] || "", name: /^as$/i.test(parts[1] || "") ? parts[2] : null, line: x.line, ins: [] });
    } else if (out.length) out.at(-1).ins.push(x);
  }
  return out;
}
const INSTALL = /\b(npm (ci|install|i)\b|yarn( install)?\b|pnpm install|pip3? install|poetry install|uv (sync|pip install)|go mod download|mvn\b|gradle\b|bundle install|composer install|dotnet restore|cargo (build|fetch))/;
const copyAll = (x) => x.cmd === "COPY" || x.cmd === "ADD" ? x.args.split(/\s+/).filter((p) => !p.startsWith("--")).slice(0, -1).some((s) => s === "." || s === "./") : false;
const at = (x) => ({ line: x.line });

const DOCKER = {
  "docker-from-tag": [t("Every base image has a fixed version (tag or digest, not latest)"), (ins) => {
    const st = stages(ins), names = new Set(st.map((s) => s.name).filter(Boolean));
    return st.filter((s) => s.from !== "scratch" && !names.has(s.from) && !fixedImage(s.from))
      .map((s) => t("Line {line}: FROM {img} has no fixed version.", { ...at(s), img: s.from }));
  }],
  "docker-user": [t("The final image does not run as root"), (ins) => {
    const last = stages(ins).at(-1), user = last.ins.filter((x) => x.cmd === "USER").at(-1);
    if (!user) return [t("No USER in the final stage: the app runs as root.")];
    return /^(root|0)(:|$)/.test(user.args.trim()) ? [t("Line {line}: USER {user} is still root.", { ...at(user), user: user.args.trim() })] : [];
  }],
  "docker-cache-order": [t("Dependencies are installed before the code is copied (layer cache)"), (ins) => stages(ins).flatMap((s) => {
    const all = s.ins.findIndex(copyAll), inst = s.ins.findIndex((x) => x.cmd === "RUN" && INSTALL.test(x.args));
    if (inst < 0 || all < 0 || all > inst) return [];
    return [t("Line {line}: COPY . copies the whole project before the dependencies are installed (line {install}): any code change reinstalls them. Copy the dependency files first, install, then copy the rest.", { ...at(s.ins[all]), install: s.ins[inst].line })];
  })],
  "docker-apt": [t("apt-get: update and install in one RUN, --no-install-recommends, lists removed"), (ins) => ins.filter((x) => x.cmd === "RUN" && /apt-get\s/.test(x.args)).flatMap((x) => {
    const a = x.args, out = [];
    const install = /apt-get\s+(-\S+\s+)*install\b/.test(a), update = /apt-get\s+(-\S+\s+)*update\b/.test(a);
    if (update && !install) return [t("Line {line}: apt-get update alone in its RUN is cached and goes stale; run it in the same RUN as apt-get install.", at(x))];
    if (!install) return [];
    if (!update) out.push(t("Line {line}: apt-get install without apt-get update in the same RUN.", at(x)));
    if (!/(\s-y\b|\s--yes\b|\s-[a-z]*y[a-z]*\b|--assume-yes)/.test(a)) out.push(t("Line {line}: add -y (the build cannot answer questions).", at(x)));
    if (!a.includes("--no-install-recommends")) out.push(t("Line {line}: add --no-install-recommends (smaller image).", at(x)));
    if (!/rm\s+-rf?\s+\/var\/lib\/apt\/lists/.test(a)) out.push(t("Line {line}: remove /var/lib/apt/lists/* in the same RUN (smaller layer).", at(x)));
    return out;
  })],
  "docker-copy": [t("COPY rather than ADD for local files"), (ins) => ins.filter((x) => x.cmd === "ADD").filter((x) => {
    const src = x.args.split(/\s+/).filter((p) => !p.startsWith("--")).slice(0, -1);
    return !src.every((s) => /^https?:\/\//.test(s) || /\.(tar|tar\.gz|tgz|tar\.xz|tar\.bz2)$/.test(s));
  }).map((x) => t("Line {line}: ADD copies local files with extra magic (archives unpacked, URLs fetched); use COPY.", at(x)))],
  "docker-secrets": [t("No secret in ENV, ARG or copied files"), (ins) => ins.flatMap((x) => {
    if (x.cmd === "ENV" || x.cmd === "ARG") {
      const names = x.args.split(/\s+/).map((p) => p.split("=")[0]).filter((n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n));
      const keys = x.cmd === "ENV" && !x.args.includes("=") ? names.slice(0, 1) : names;
      return keys.filter((n) => SECRET_NAME.test(n)).map((n) => t("Line {line}: {name} stays readable in the image (docker history / inspect). Pass it at run time or use a build secret (RUN --mount=type=secret).", { ...at(x), name: n }));
    }
    if ((x.cmd === "COPY" || x.cmd === "ADD") && /(^|\s|\/)(\.env|id_rsa|id_ed25519|[\w.-]+\.pem|[\w.-]+\.key)(\s|$)/.test(x.args)) return [t("Line {line}: a key or .env file is copied into the image.", at(x))];
    return SECRET_VALUE.test(x.args) ? [t("Line {line}: contains a key or token.", at(x))] : [];
  })],
  "docker-exec-form": [t("CMD and ENTRYPOINT use the exec form [\"…\"]"), (ins) => ins.filter((x) => (x.cmd === "CMD" || x.cmd === "ENTRYPOINT") && !/^\[.*\]$/s.test(x.args.trim()))
    .map((x) => t("Line {line}: {cmd} in shell form runs through /bin/sh, which does not pass on stop signals; write it as a JSON list.", { ...at(x), cmd: x.cmd }))],
  "docker-multistage": [t("The final image is built from a build stage (multi-stage)"), (ins) => {
    const st = stages(ins);
    if (st.length < 2) return [t("One stage only: compilers and build tools end up in the image you ship.")];
    return st.at(-1).ins.some((x) => x.cmd === "COPY" && /--from=/.test(x.args)) ? [] : [t("The final stage copies nothing from the build stage (COPY --from=build …).")];
  }],
};

export const RULES = Object.fromEntries([
  ...Object.entries(K8S).map(([id, r]) => [id, { kind: "yaml", title: r[0], run: r[1] }]),
  ...Object.entries(GHA).map(([id, r]) => [id, { kind: "yaml", title: r[0], run: r[1] }]),
  ...Object.entries(DOCKER).map(([id, r]) => [id, { kind: "dockerfile", title: r[0], run: r[1] }]),
]);

const ruleOf = (r) => (typeof r === "string" ? { id: r } : obj(r));
// The rule's title with its params filled in (e.g. "deploy waits for test").
export const ruleTitle = (r) => { const x = ruleOf(r), def = RULES[x.id]; return def ? { m: def.title.m, p: { min: 2, ...x } } : t("Unknown check {id}", { id: x.id }); };

export function checkFile(code, text, rules) {
  let parsed;
  try {
    if (code === "dockerfile") parsed = parseDockerfile(text);
    else {
      parsed = loadAll(String(text)).filter((d) => d != null);
      if (!parsed.length) throw { line: 1, reason: "empty file" };
      if (parsed.some((d) => typeof d !== "object" || Array.isArray(d))) throw { line: 1, reason: "each document must be a mapping (key: value)" };
    }
  } catch (err) {
    const line = err?.mark ? err.mark.line + 1 : err?.line || 1;
    return { error: { line, reason: String(err?.reason || err?.message || err) }, results: [] };
  }
  const results = list(rules).map((r) => {
    const x = ruleOf(r), def = RULES[x.id];
    if (!def) return { id: x.id, title: ruleTitle(x), ok: false, problems: [t("Unknown check {id}", { id: x.id })] };
    let problems;
    try { problems = def.run(parsed, x); } catch { problems = [t("This check could not read the file.")]; }
    return { id: x.id, title: ruleTitle(x), ok: !problems.length, problems };
  });
  return { error: null, results };
}
