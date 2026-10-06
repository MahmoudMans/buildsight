import { chromium } from "playwright";
import { execFile, spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

const PROJECT = process.env.SMOKE_PROJECT_DIR ?? join(homedir(), "Documents/work/Projects/springbootnextprojects/buildsight/frontend");
const API = (process.env.SMOKE_API ?? "http://localhost:8080/api/v1").replace(/\/$/, "");
let FRONT = (process.env.SMOKE_FRONT ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = process.env.SMOKE_OUT ?? join(homedir(), "buildsight-smoke");
const NO_START = process.env.SMOKE_NO_START === "1";

const report = [];
const say = (line = "") => {
  console.log(line);
  report.push(line);
};

async function reachable(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(4000) });
    return true;
  } catch {
    return false;
  }
}

function kb(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

if (!existsSync(join(PROJECT, "src/lib/api.ts"))) {
  console.log(`Could not find the frontend at ${PROJECT} (src/lib/api.ts is missing).`);
  process.exit(2);
}

mkdirSync(join(OUT, "shots"), { recursive: true });

say(`BuildSight feature audit, ${new Date().toISOString()}`);
say(`frontend folder: ${PROJECT}`);
say(`backend: ${API}`);
say(`frontend: ${FRONT}`);
say();

if (!(await reachable(`${API}/projects`))) {
  say(`STOP  The backend does not answer at ${API}/projects.`);
  say("      Start the Spring Boot backend (and its database) first, then run this again.");
  process.exit(2);
}

let projectId = process.env.SMOKE_PROJECT_ID ?? null;
let projectName = "";

const listed = await (await fetch(`${API}/projects`)).json().catch(() => null);

if (!Array.isArray(listed) || listed.length === 0) {
  say("STOP  The backend has no projects yet, so there is no data to open the pages with. Create a project first.");
  process.exit(2);
}

const allProjects = listed.map((project) => ({ id: String(project.id), name: String(project.name ?? "") }));
const apiSource = readFileSync(join(PROJECT, "src/lib/api.ts"), "utf8");
const endpointTemplates = new Map();
const skipped = [];

for (const block of apiSource.split(/\nexport async function /).slice(1)) {
  const name = block.slice(0, block.indexOf("(")).trim();

  if (!name.startsWith("get")) {
    continue;
  }

  const match = block.match(/request<[\s\S]*?>\(\s*([`"'])(\/[^`"']*)\1\s*[,)]/);

  if (!match) {
    continue;
  }

  const template = match[2].replace(/\$\{projectId\}/g, "__PID__").replace(/\$\{weeks\}/g, "4");

  if (/\$\{/.test(template)) {
    skipped.push(`${name} (needs another id)`);
  } else if (/\/ai\//.test(template) && !/\/ai\/status$/.test(template)) {
    skipped.push(`${name} (AI call, not run)`);
  } else if (!endpointTemplates.has(template)) {
    endpointTemplates.set(template, name);
  }
}

async function dataScore(id) {
  let score = 0;

  for (const template of endpointTemplates.keys()) {
    if (!template.includes("__PID__")) {
      continue;
    }

    const res = await fetch(`${API}${template.replaceAll("__PID__", id)}`, { signal: AbortSignal.timeout(20000) }).catch(() => null);
    const json = res && res.status === 200 ? await res.json().catch(() => null) : null;

    if (json !== null) {
      const { rows, figures } = auditPayload(json);

      score += rows + figures;
    }
  }

  return score;
}

let ranked = allProjects.map((project) => ({ ...project, score: 0 }));

if (projectId) {
  projectName = allProjects.find((project) => project.id === projectId)?.name ?? "";
} else if (allProjects.length > 1) {
  say(`Choosing the project with the most data (scoring all ${allProjects.length}; a project with little data leaves most pages with nothing to check)`);

  ranked = [];

  for (const project of allProjects) {
    ranked.push({ ...project, score: await dataScore(project.id) });
  }

  ranked.sort((a, b) => b.score - a.score);
  projectId = ranked[0].id;
  projectName = ranked[0].name;

  for (const entry of ranked.slice(0, 6)) {
    say(`  ${String(entry.score).padStart(6)}  ${entry.name}${entry.id === projectId ? "   <- used" : ""}`);
  }

  if (ranked.length > 6) {
    say(`  and ${ranked.length - 6} more with less data`);
  }

  say();
} else {
  projectId = allProjects[0].id;
  projectName = allProjects[0].name;
}

say(`project used: ${projectName || "(unnamed)"} (${projectId})`);
say();

let failures = 0;
let warnings = 0;

say("1. BACKEND ENDPOINTS used by the pages (read only)");

const endpoints = new Map();

for (const [template, name] of endpointTemplates) {
  endpoints.set(template.replaceAll("__PID__", projectId), name);
}

let apiPass = 0;
let apiFail = 0;
const payloads = new Map();

for (const [path, name] of endpoints) {
  const started = Date.now();

  try {
    const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(60000) });
    const body = await res.text();
    let json = true;
    let parsed = null;

    try {
      parsed = JSON.parse(body);
    } catch {
      json = false;
    }

    const label = path.replace(projectId, ":id");

    if (res.status === 200 && json) {
      apiPass += 1;
      payloads.set(label, parsed);
      say(`  PASS  ${res.status}  ${label}  ${Date.now() - started} ms  ${kb(body.length)}`);
    } else {
      apiFail += 1;
      say(`  FAIL  ${res.status}  ${label}  (${name})${json ? "" : "  body is not JSON"}  ${body.slice(0, 140).replace(/\s+/g, " ")}`);
    }
  } catch (error) {
    apiFail += 1;
    say(`  FAIL  ---  ${path.replace(projectId, ":id")}  (${name})  ${String(error.message ?? error).slice(0, 140)}`);
  }
}

failures += apiFail;

if (skipped.length > 0) {
  say(`  not run: ${skipped.join("; ")}`);
}

function auditPayload(root) {
  const found = new Map();
  let rows = 0;
  let figures = 0;

  const note = (rule, where) => {
    if (!found.has(rule)) {
      found.set(rule, []);
    }

    found.get(rule).push(where);
  };

  const parseDay = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

    return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  };

  function walk(node, where, depth) {
    if (node === null || depth > 12) {
      return;
    }

    if (Array.isArray(node)) {
      const ids = new Set();

      node.forEach((item, index) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          rows += 1;

          if (typeof item.id === "string" || typeof item.id === "number") {
            if (ids.has(item.id)) {
              note("the same id twice in one list", `${where}[${index}] id ${String(item.id).slice(0, 12)}`);
            }

            ids.add(item.id);
          }
        }

        walk(item, `${where}[${index}]`, depth + 1);
      });

      return;
    }

    if (typeof node !== "object") {
      if (typeof node === "number" && node !== 0) {
        figures += 1;
      }

      return;
    }

    const entries = Object.entries(node);
    const name = String(node.name ?? node.title ?? node.code ?? node.reference ?? "").slice(0, 40);
    const here = name ? `${where} "${name}"` : where;

    for (const [key, value] of entries) {
      if (typeof value === "string") {
        if (/^(NaN|undefined|null|Invalid Date)$/.test(value.trim())) {
          note("a text field that literally says NaN, undefined or null", `${here}.${key}`);
        }

        const day = parseDay(value);

        if (day !== null) {
          const year = new Date(day).getUTCFullYear();

          if (year < 1990 || year > 2100) {
            note(`a date in the year ${year < 1990 ? "before 1990" : "after 2100"} (usually an empty or default date)`, `${here}.${key} = ${value.slice(0, 10)}`);
          }
        }
      } else if (typeof value === "number") {
        const isChange = /change|trend|adjust|variance|delta|growth|movement|swing|diff|slip|drift|saving|overrun|shift/i.test(key);

        if (!isChange && (/percent|pct/i.test(key) || /^(progress|completeness|utili[sz]ation)$/i.test(key)) && (value < 0 || value > 100)) {
          note("a percentage outside 0 to 100", `${here}.${key} = ${value}`);
        }

        if (/(amount|cost|budget|quantity|qty|hours|price|certified|paid|retention|value)$/i.test(key) && value < 0) {
          note("a negative amount or quantity (fine for a credit, otherwise an error)", `${here}.${key} = ${value}`);
        }
      }
    }

    const dated = entries.filter(([, value]) => typeof value === "string" && parseDay(value) !== null).map(([key]) => key);

    for (const start of dated.filter((key) => /start|begin/i.test(key))) {
      const prefix = start.replace(/start|begin|date/gi, "").toLowerCase();
      const end = dated.find((key) => /end|finish/i.test(key) && key.replace(/end|finish|date/gi, "").toLowerCase() === prefix);

      if (end && parseDay(node[end]) < parseDay(node[start])) {
        note("an end date before its start date", `${here}.${end} (${String(node[end]).slice(0, 10)}) is before ${start} (${String(node[start]).slice(0, 10)})`);
      }
    }

    for (const [key, value] of entries) {
      walk(value, `${where}.${key}`, depth + 1);
    }
  }

  walk(root, "", 0);

  return { found, rows, figures };
}

say("1b. DATA CHECKS (what the backend sends; problems here show up as odd numbers on the pages)");

const dataProblems = new Map();
const emptyAreas = [];

for (const [label, payload] of payloads) {
  const { found, rows, figures } = auditPayload(payload);
  const empty = rows === 0 && figures === 0;

  say(`  ${String(rows).padStart(5)} rows, ${String(figures).padStart(5)} non-zero figures  ${label}${empty ? "   (nothing recorded, the pages built on this cannot be checked)" : ""}`);

  if (empty) {
    emptyAreas.push(label);
  }

  for (const [rule, where] of found) {
    if (!dataProblems.has(rule)) {
      dataProblems.set(rule, []);
    }

    dataProblems.get(rule).push(...where.map((place) => `${label} ${place}`));
  }
}

if (dataProblems.size === 0) {
  say("  no impossible values found in the data the backend sends");
} else {
  for (const [rule, places] of dataProblems) {
    say(`  CHECK  ${rule}: ${places.length}`);

    for (const place of places.slice(0, 3)) {
      say(`           ${place.slice(0, 200)}`);
    }

    if (places.length > 3) {
      say(`           and ${places.length - 3} more`);
    }
  }
}

const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const EMPTY_YEARS = "1969|1970|1899|1900|0001|9999|2099";
const EMPTY_DATE = new RegExp(`(\\b\\d{1,2}[ /.-](?:${MONTHS}|\\d{1,2})[a-z]*[ /.-](?:${EMPTY_YEARS})\\b)|(\\b(?:${EMPTY_YEARS})-\\d{2}-\\d{2}\\b)|(\\b(?:${MONTHS})[a-z]* (?:\\d{1,2},? )?(?:${EMPTY_YEARS})\\b)`, "i");
const DEFECTS = [
  [/\bNaN\b/, "shows NaN, a number that could not be worked out"],
  [/\bundefined\b/, "shows the word undefined"],
  [/\[object Object\]/, "shows [object Object]"],
  [/\bInfinity\b/, "shows Infinity (a division by zero)"],
  [/Invalid Date/, "shows Invalid Date"],
  [/\bnull\b/, "shows the word null"],
  [EMPTY_DATE, "shows a date that is an empty default (1970, 1900 or 9999)"],
];
const ODDITIES = [
  [/\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b/, "shows a raw code instead of a label"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, "shows a raw id"],
  [/\b(TODO|TBD|FIXME)\b|[Ll]orem ipsum/, "shows placeholder text"],
  [/^\s*(?:tbd|todo|fixme)\s*$/im, "shows placeholder text"],
  [/(?:^|[\s(])[-−–]\d+(?:\.\d+)? ?(?:days?|weeks?|hours?|hrs?|months?)\b/i, "shows a negative time (fine for negative float, otherwise an error)"],
  [/\b\d{1,3}(?:,\d{3})+(?:\.\d+)? ?%|\b\d{4,}(?:\.\d+)? ?%/, "shows a percentage in the thousands"],
  [/[-−]0(?:\.0+)? ?(?:%|days?|€)/, "shows minus zero"],
];
const EMPTY_PHRASE = /\b(no|nothing|not enough|none)\b[^.\n]{0,70}\b(yet|found|recorded|to show|to report|available|logged|data|entries|records)\b/i;

const around = (text, index, length) => {
  const from = Math.max(0, index - 50);
  const to = Math.min(text.length, index + length + 50);

  return text.slice(from, to).replace(/\s*\n\s*/g, " | ").replace(/\s+/g, " ").trim();
};
const THOUSANDS_PERCENT = /\b\d{1,3}(?:,\d{3})+(?:\.\d+)? ?%|\b\d{4,}(?:\.\d+)? ?%/;
const RAW_CODE = /\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b/g;

function auditText(mainText, spacedText = mainText) {
  const defects = [];
  const oddities = [];

  for (const [pattern, message] of DEFECTS) {
    const match = mainText.match(pattern);

    if (match) {
      defects.push(`${message}: "${match[0].trim().slice(0, 40)}"  [in: ${around(mainText, match.index, match[0].length).slice(0, 130)}]`);
    }
  }

  for (const [pattern, message] of ODDITIES) {
    if (pattern.source === RAW_CODE.source) {
      const codes = [...new Set(mainText.match(RAW_CODE) ?? [])];

      if (codes.length > 0) {
        oddities.push(`${message}: ${codes.slice(0, 6).map((code) => `"${code}"`).join(", ")}${codes.length > 6 ? ` and ${codes.length - 6} more` : ""}`);
      }

      continue;
    }

    const haystack = pattern.source === THOUSANDS_PERCENT.source ? spacedText : mainText;
    const match = haystack.match(pattern);

    if (match) {
      oddities.push(`${message}: "${match[0].trim().slice(0, 40)}"  [in: ${around(haystack, match.index, match[0].length).slice(0, 130)}]`);
    }
  }

  const withoutDates = mainText
    .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?[ /.-](?:${MONTHS}|\\d{1,2})[a-z]*[ /.-]\\d{2,4}\\b`, "gi"), " ")
    .replace(new RegExp(`\\b(?:${MONTHS})[a-z]* (?:\\d{1,2},? )?\\d{4}\\b`, "gi"), " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ");
  const figures = withoutDates.match(/(?<![\w.:/-])-?\d[\d,]*(?:\.\d+)?(?![\w:/-])/g) ?? [];

  if (figures.length >= 3 && figures.every((token) => Number(token.replace(/,/g, "")) === 0)) {
    oddities.push("every number on the page is zero");
  }

  return { defects, oddities, numbers: figures.length, noFigures: figures.length === 0 || (EMPTY_PHRASE.test(mainText) && figures.length <= 12) };
}

say();

function pagesIn(dir, base = []) {
  const found = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      found.push(...pagesIn(full, [...base, entry]));
    } else if (/^page\.(tsx|ts|jsx|js)$/.test(entry)) {
      found.push(base);
    }
  }

  return found;
}

const appDir = existsSync(join(PROJECT, "src/app")) ? join(PROJECT, "src/app") : join(PROJECT, "app");
const routes = [];
const unreachable = [];

for (const segments of pagesIn(appDir)) {
  const visible = segments.filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith("@"));

  if (visible.some((segment) => /^\[.+\]$/.test(segment) && segment !== "[id]")) {
    unreachable.push(`/${visible.join("/")}`);
    continue;
  }

  routes.push({ pattern: `/${visible.join("/")}`.replace(/\[id\]/g, ":id"), path: `/${visible.join("/")}`.replace(/\[id\]/g, projectId) });
}

routes.sort((a, b) => a.pattern.length - b.pattern.length || (a.pattern < b.pattern ? -1 : 1));

say(`2. PAGES: opening ${routes.length} pages in a headless browser (a page fails on a script error, a failed backend call, an error banner, no heading, or content that is plainly wrong such as NaN or a 1970 date)`);

let dev = null;

function stopDev() {
  if (dev && dev.pid) {
    try {
      process.kill(-dev.pid, "SIGTERM");
    } catch {}
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopDev();
    process.exit(130);
  });
}

async function startDev(port) {
  const log = openSync(join(OUT, "dev.log"), "w");

  say(`  starting the frontend (npm run dev, port ${port}); its log is ${join(OUT, "dev.log")}`);
  dev = spawn("npm", ["run", "dev", "--", "-p", String(port)], { cwd: PROJECT, detached: true, stdio: ["ignore", log, log] });
  closeSync(log);

  for (let i = 0; i < 60; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (await reachable(`http://localhost:${port}/`)) {
      return true;
    }
  }

  return false;
}

async function corsAllows(origin) {
  try {
    const res = await fetch(`${API}/projects`, { headers: { Origin: origin, Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    const allowedOrigin = res.headers.get("access-control-allow-origin");

    return res.status < 400 && (allowedOrigin === origin || allowedOrigin === "*");
  } catch {
    return false;
  }
}

function originCandidates(front) {
  const url = new URL(front);
  const base = Number(url.port || 3000);
  const ports = [...new Set([base, base + 1, base + 2, base + 3, base + 4, base + 5, base + 10, 4200, 5173, 8081])];
  const hosts = [...new Set([url.hostname, "localhost", "127.0.0.1"])];

  return hosts.flatMap((host) => ports.map((port) => `http://${host}:${port}`));
}

const sampleRoutes = (() => {
  const candidates = routes.filter((route) => route.pattern !== "/");
  const count = Math.min(8, candidates.length);

  return Array.from({ length: count }, (_, index) => candidates[Math.floor((index * candidates.length) / count)]);
})();

async function coverage(origin) {
  const missing = [];

  for (const route of sampleRoutes) {
    const res = await fetch(`${origin}${route.path}`, { signal: AbortSignal.timeout(120000) }).catch(() => null);

    if (res) {
      await res.body?.cancel().catch(() => {});
    }

    if (!res || res.status === 404) {
      missing.push(route.pattern);
    }
  }

  return { total: sampleRoutes.length, missing, ok: sampleRoutes.length === 0 || missing.length * 2 < sampleRoutes.length };
}

const execFileAsync = promisify(execFile);

async function tryRun(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 8000 });

    return { ok: true, stdout: stdout.trim() };
  } catch {
    return { ok: false, stdout: "" };
  }
}

async function whatIsOn(port) {
  const pids = [...new Set((await tryRun("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"])).stdout.split(/\s+/).filter(Boolean))];
  const processes = [];

  for (const pid of pids) {
    const command = (await tryRun("ps", ["-p", pid, "-o", "command="])).stdout;
    const cwd = (await tryRun("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"])).stdout.split("\n").find((line) => line.startsWith("n"))?.slice(1) ?? "";

    processes.push({ pid, command, cwd });
  }

  const containers = (await tryRun("docker", ["ps", "--filter", `publish=${port}`, "--format", "{{.ID}}\t{{.Names}}\t{{.Image}}"])).stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [id, name, image] = line.split("\t");

      return { id, name, image };
    });

  return { processes, containers };
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let answered = false;

    rl.on("close", () => {
      if (!answered) {
        answered = true;
        report.push(`${question}(no answer)`);
        resolve(false);
      }
    });
    rl.question(question, (answer) => {
      answered = true;
      report.push(`${question}${answer.trim()}`);
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

const stoppedNotes = [];

function reportStopped() {
  if (stoppedNotes.length > 0) {
    say();
    say("Stopped for this test (not restarted):");

    for (const note of stoppedNotes) {
      say(`  ${note}`);
    }
  }
}

async function stopPort(port, info) {
  const notes = [];

  if (info.containers.length > 0) {
    for (const container of info.containers) {
      const result = await tryRun("docker", ["stop", container.id]);

      if (!result.ok) {
        return { ok: false, why: `docker could not stop container ${container.id}`, notes };
      }

      notes.push(`Docker container ${container.name} (${container.id}) was stopped. Start it again with:  docker start ${container.id}`);
    }
  } else {
    for (const found of info.processes) {
      if (/docker|vpnkit|colima|orbstack|podman|lima/i.test(found.command)) {
        return { ok: false, why: "it belongs to a container system, so it has to be stopped from there (docker ps, then docker stop <id>)", notes };
      }

      try {
        process.kill(Number(found.pid), "SIGTERM");
      } catch (error) {
        return { ok: false, why: `process ${found.pid} could not be stopped (${error.code ?? error.message})`, notes };
      }

      notes.push(`process ${found.pid} was stopped. It was running:  ${found.command.slice(0, 200)}${found.cwd ? `   (in ${found.cwd})` : ""}`);
    }
  }

  for (let i = 0; i < 20; i += 1) {
    if (!(await reachable(`http://localhost:${port}/`))) {
      return { ok: true, why: "", notes };
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return { ok: false, why: `port ${port} still answers 20 seconds after the stop request`, notes };
}

const corsGrep = `grep -rniE "allowedOrigins|allowed-origins|CorsConfiguration|CrossOrigin" "${dirname(PROJECT)}" --include=*.java --include=*.yml --include=*.yaml --include=*.properties --exclude-dir=node_modules --exclude-dir=.next`;
const allowed = [];

for (const origin of originCandidates(FRONT)) {
  if (await corsAllows(origin)) {
    allowed.push(origin);
  }
}

if (allowed.length === 0) {
  say();
  say("STOP  The backend does not accept browser requests from any usual local dev address (ports 3000 to 3010, 4200, 5173, 8081, on localhost or 127.0.0.1),");
  say("      so no page can load data in a browser. Its CORS setting decides this. Find where it is set with:");
  say(`      ${corsGrep}`);
  process.exit(2);
}

say(`  the backend accepts browser requests from: ${allowed.slice(0, 6).join(", ")}${allowed.length > 6 ? ", ..." : ""}`);

let chosen = null;
const busy = [];
const triedPorts = new Set();
const devLog = join(OUT, "dev.log");

async function startHere(port, origin) {
  if (!(await startDev(port))) {
    say(`  the frontend did not start on port ${port} within 2 minutes. See ${devLog}.`);
    stopDev();
    dev = null;
    return false;
  }

  const cover = await coverage(origin);

  if (!cover.ok) {
    say(`  the frontend started on port ${port} but did not serve your pages (${cover.missing.length} of ${cover.total} sample pages returned 404). See ${devLog}.`);
    stopDev();
    dev = null;
    return false;
  }

  return true;
}

for (const origin of allowed) {
  const port = new URL(origin).port;

  if (triedPorts.has(port)) {
    continue;
  }

  triedPorts.add(port);

  if (await reachable(`http://localhost:${port}/`)) {
    const cover = await coverage(origin);

    if (cover.ok) {
      chosen = origin;
      break;
    }

    busy.push({ port, origin, cover });
    continue;
  }

  if (NO_START) {
    continue;
  }

  if (await startHere(port, origin)) {
    chosen = origin;
    break;
  }

  process.exit(2);
}

if (chosen === null && busy.length > 0 && !NO_START) {
  for (const entry of busy) {
    const { port, origin, cover } = entry;

    say();
    say(`  Port ${port} already has a server, but it does not serve the pages in your folder: ${cover.missing.length} of ${cover.total} sample pages returned 404 there (for example ${cover.missing.slice(0, 3).join(", ")}).`);
    say(cover.missing.length === cover.total ? "  It looks like a different app." : "  It looks like an older or different copy of BuildSight (a production build, a Docker container, or another folder).");

    const info = await whatIsOn(port);

    if (info.processes.length === 0 && info.containers.length === 0) {
      say(`  The system did not say what is using port ${port}. Check with:  lsof -nP -iTCP:${port} -sTCP:LISTEN`);
      continue;
    }

    say(`  What is listening on port ${port}:`);

    for (const found of info.processes) {
      say(`    process ${found.pid}: ${found.command.slice(0, 160) || "(unknown)"}`);

      if (found.cwd) {
        say(`      running in: ${found.cwd}`);
      }
    }

    for (const container of info.containers) {
      say(`    Docker container ${container.id}: ${container.name} (image ${container.image})`);
    }

    const target = info.containers.length > 0 ? `that Docker container (docker stop ${info.containers.map((container) => container.id).join(" ")})` : `that process (PID ${info.processes.map((found) => found.pid).join(", ")})`;

    if (!(await ask(`  Stop ${target} so the test can run BuildSight from your folder on port ${port}? It will not be restarted afterwards. [y/N] `))) {
      continue;
    }

    const stopped = await stopPort(port, info);

    stoppedNotes.push(...stopped.notes);

    if (!stopped.ok) {
      say(`  Could not free port ${port}: ${stopped.why}.`);
      continue;
    }

    say(`  Port ${port} is free. Starting BuildSight from your folder.`);

    if (await startHere(port, origin)) {
      chosen = origin;
      break;
    }

    reportStopped();
    process.exit(2);
  }
}

if (chosen === null) {
  say();
  say(`STOP  BuildSight's frontend has to run on an address the backend accepts, and ${busy.length > 0 ? `${busy.length > 1 ? "ports" : "port"} ${busy.map((entry) => entry.port).join(", ")} ${busy.length > 1 ? "are" : "is"} used by a server that does not run your current code` : "none of them could be started"}.`);

  if (busy.length > 0) {
    say(`      See what is using ${busy.length > 1 ? "them" : "it"}:  lsof -nP -iTCP:${busy.map((entry) => entry.port).join(",")} -sTCP:LISTEN`);
    say("      Stop that server (Ctrl+C in its terminal, docker stop, or kill the PID), then run this script again. It will start BuildSight's own frontend.");
  }

  reportStopped();
  process.exit(2);
}

FRONT = chosen;
say(`  testing the pages at ${FRONT}`);

const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const audited = [];
let corsPages = 0;

async function runPage(route, pid) {
  const page = await context.newPage();
  const fail = new Set();
  const warn = new Set();
  const notes = new Set();
  let corsBlocked = false;
  let noFigures = false;
  let numbers = 0;
  const started = Date.now();

  page.on("pageerror", (error) => fail.add(`script error: ${String(error.message).slice(0, 160)}`));
  page.on("console", (message) => {
    const text = message.text();

    if (/blocked by CORS policy/i.test(text)) {
      corsBlocked = true;
    }

    if (message.type() === "error" && !text.startsWith("Failed to load resource")) {
      warn.add(`console error: ${text.slice(0, 160).replace(/\s+/g, " ")}`);
    }
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();

    if (status >= 400) {
      if (url.startsWith(API)) {
        fail.add(`backend call failed (${status}): ${url.slice(API.length).replace(pid, ":id")}`);
      } else if (!/favicon|\.map(\?|$)|webpack-hmr|apple-touch/.test(url)) {
        warn.add(`${status} for ${url.replace(FRONT, "").slice(0, 100)}`);
      }
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();

    if (url.startsWith(API) && !/ERR_ABORTED/.test(request.failure()?.errorText ?? "")) {
      fail.add(`backend call did not complete: ${url.slice(API.length).replace(pid, ":id")}`);
    }
  });

  try {
    const response = await page.goto(`${FRONT}${route.pattern.replace(/:id/g, pid)}`, { waitUntil: "domcontentloaded", timeout: 120000 });

    if (response && response.status() >= 400) {
      fail.add(`the page itself returned ${response.status()}`);
    }

    await page.waitForSelector("h1", { timeout: 30000 }).catch(() => fail.add("no page heading appeared"));
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(400);

    const info = await page.evaluate(() => {
      const main = document.querySelector("main");
      const portal = document.querySelector("nextjs-portal");

      return {
        text: (document.body.innerText || "").slice(0, 20000),
        mainLength: main ? (main.innerText || "").length : 0,
        mainText: ((main ? main.innerText : document.body.innerText) || "").slice(0, 30000),
        spacedText: (() => {
          const root = main || document.body;
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          const parts = [];
          let last = null;

          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const parent = node.parentElement;

            if (!parent || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName) || !node.nodeValue || !node.nodeValue.trim()) {
              continue;
            }

            parts.push(parent === last || /^\s*%/.test(node.nodeValue) ? node.nodeValue : `\n${node.nodeValue}`);
            last = parent;
          }

          return parts.join("").slice(0, 30000);
        })(),
        banner: (document.querySelector(".offline-banner")?.textContent || "").trim().slice(0, 140),
        overlay: portal && portal.shadowRoot ? (portal.shadowRoot.textContent || "").slice(0, 400) : "",
      };
    });

    let bannerIsError = false;

    if (info.banner) {
      const bannerText = info.banner.replace(/\s+/g, " ");

      if (/could not|couldn't|failed|unable|unavailable|not reachable|can't reach|cannot reach|check that the backend|went wrong|\berror\b|offline/i.test(bannerText)) {
        fail.add(`error banner on the page: ${bannerText}`);
        bannerIsError = true;
      } else {
        notes.add(`notice shown on the page (information, not an error): ${bannerText}`);
      }
    }

    if (/(Unhandled Runtime Error|Runtime (Type|Reference|Syntax)?Error|Build Error)/i.test(info.overlay) || /Application error: a client-side exception/i.test(info.text)) {
      fail.add("the framework error screen is showing");
    }

    const stated = info.text.match(/[^\n.]*(Could not load|Couldn't load|Failed to load|Unable to load)[^\n]*/i);

    if (stated && !bannerIsError) {
      fail.add(`page says: ${stated[0].trim().slice(0, 140)}`);
    }

    if (/^\s*(Loading|Reading|Fetching|Checking|Preparing)\b[^\n]{0,80}(…|\.\.\.)\s*$/im.test(info.text)) {
      warn.add("a loading message is still showing");
    }

    if (info.mainLength < 150) {
      warn.add("very little content on the page");
    }

    const content = auditText(info.mainText, info.spacedText);

    for (const defect of content.defects) {
      fail.add(defect);
    }

    for (const oddity of content.oddities) {
      warn.add(oddity);
    }

    if (content.oddities.some((oddity) => oddity.startsWith("shows a raw code"))) {
      const printed = await page.evaluate(() => {
        const root = document.querySelector("main") || document.body;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const pattern = /\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b/;
        const name = (element) => {
          const classes = String(element.className?.baseVal ?? element.className ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");

          return `<${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}>`;
        };
        const seen = new Set();
        const found = [];

        for (let node = walker.nextNode(); node && found.length < 4; node = walker.nextNode()) {
          const code = (node.nodeValue || "").match(pattern);

          if (!code || seen.has(code[0])) {
            continue;
          }

          seen.add(code[0]);

          const chain = [];

          for (let element = node.parentElement; element && element !== root && chain.length < 4; element = element.parentElement) {
            chain.push(name(element));
          }

          found.push(`"${code[0]}" printed by ${chain.join(" inside ")}`);
        }

        return found;
      }).catch(() => []);

      for (const entry of printed) {
        warn.add(`raw code ${entry}`);
      }
    }

    noFigures = content.noFigures;
    numbers = content.numbers;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    if (overflow > 1) {
      const culprits = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const isBox = (style) => style.position !== "static" || style.transform !== "none" || style.filter !== "none" || /(paint|layout|strict|content)/.test(style.contain || "");
        const clipped = (element) => {
          let current = element;

          while (current && current !== document.body && current !== document.documentElement) {
            const position = getComputedStyle(current).position;
            let holder;

            if (position === "fixed") {
              return true;
            }

            if (position === "absolute") {
              holder = null;

              for (let parent = current.parentElement; parent; parent = parent.parentElement) {
                if (isBox(getComputedStyle(parent))) {
                  holder = parent;
                  break;
                }
              }
            } else {
              holder = current.parentElement;
            }

            if (!holder || holder === document.body || holder === document.documentElement) {
              return false;
            }

            if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(holder).overflowX)) {
              return true;
            }

            current = holder;
          }

          return false;
        };
        const describe = (element, suffix = "") => {
          const classes = String(element.className?.baseVal ?? element.className ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
          const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);

          return `<${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}> reaches ${Math.round(element.getBoundingClientRect().right)} px${suffix}${text ? ` ("${text}")` : ""}`;
        };
        const leavesOf = (list) => {
          const set = new Set(list);

          return list.filter((element) => ![...element.children].some((child) => set.has(child)));
        };
        const all = [...document.querySelectorAll("body *")];
        const visible = all.filter((element) => {
          const box = element.getBoundingClientRect();

          return box.width > 0 && box.right > width + 1 && getComputedStyle(element).visibility !== "hidden";
        });
        const strict = visible.filter((element) => getComputedStyle(element).position !== "fixed" && !clipped(element));
        let picked = leavesOf(strict).sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right).slice(0, 3).map((element) => describe(element));

        if (picked.length === 0) {
          picked = leavesOf(visible).sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right).slice(0, 3).map((element) => describe(element, ", inside a container that hides or scrolls its overflow"));
        }

        if (picked.length === 0) {
          const inner = all.filter((element) => element.scrollWidth > width + 1 && getComputedStyle(element).overflowX === "visible");

          picked = leavesOf(inner).slice(0, 3).map((element) => `<${element.tagName.toLowerCase()}${element.className && typeof element.className === "string" ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}> has content ${element.scrollWidth} px wide`);
        }

        if (picked.length === 0) {
          picked = [`no single element found (page ${document.documentElement.scrollWidth} px, body ${document.body.scrollWidth} px, screen ${width} px, body overflow ${getComputedStyle(document.body).overflowX})`];
        }

        const label = (element) => {
          const classes = String(element.className?.baseVal ?? element.className ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");

          return `<${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}>`;
        };
        const doc = document.documentElement;
        const trail = [];
        let node = document.body;

        for (let depth = 0; depth < 14; depth += 1) {
          const before = doc.scrollWidth;
          let best = null;
          let bestWidth = before;

          for (const kid of [...node.children]) {
            const saved = kid.getAttribute("style");

            kid.style.setProperty("display", "none", "important");

            const after = doc.scrollWidth;

            if (saved === null) {
              kid.removeAttribute("style");
            } else {
              kid.setAttribute("style", saved);
            }

            if (after < bestWidth) {
              best = kid;
              bestWidth = after;
            }
          }

          if (!best) {
            break;
          }

          trail.push(label(best));
          node = best;
        }

        if (trail.length > 0) {
          const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);

          picked.unshift(`the page gets narrow enough when this is hidden: ${trail.join(" > ")}${text ? ` ("${text}")` : ""}; it measures ${Math.round(node.getBoundingClientRect().width)} px wide, its container allows ${Math.round(node.parentElement ? node.parentElement.getBoundingClientRect().width : 0)} px`);
        }

        return picked;
      }).catch(() => []);

      warn.add(`scrolls sideways on a phone-width screen (${overflow} px too wide)${culprits.length > 0 ? `; widest: ${culprits.join("; ")}` : ""}`);
    }

    await page.setViewportSize({ width: 1280, height: 900 });
  } catch (error) {
    fail.add(`could not open the page: ${String(error.message).split("\n")[0].slice(0, 160)}`);
  }

  const status = fail.size > 0 ? "FAIL" : warn.size > 0 ? "WARN" : "PASS";
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (status === "FAIL") {
    await page.screenshot({ path: join(OUT, "shots", `${route.pattern.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.png`) }).catch(() => {});
  }

  await page.close();

  return { status, fail: [...fail], warn: [...warn], notes: [...notes], noFigures, numbers, seconds, corsBlocked };
}

if (process.env.AUDIT_ONLY) {
  const keep = new RegExp(process.env.AUDIT_ONLY);

  for (let index = routes.length - 1; index >= 0; index -= 1) {
    if (!keep.test(routes[index].pattern)) {
      routes.splice(index, 1);
    }
  }

  say(`only the ${routes.length} pages matching ${process.env.AUDIT_ONLY} are opened`);
}

let stoppedEarly = false;

for (const [index, route] of routes.entries()) {
  const outcome = await runPage(route, projectId);

  corsPages += outcome.corsBlocked ? 1 : 0;
  audited.push({ pattern: route.pattern, status: outcome.status, fail: outcome.fail, warn: outcome.warn, notes: outcome.notes, noFigures: outcome.noFigures, numbers: outcome.numbers, project: projectName });
  say(`  [${String(index + 1).padStart(String(routes.length).length)}/${routes.length}] ${outcome.status}  ${route.pattern}  (${outcome.seconds}s)${outcome.noFigures ? "  no figures shown" : ""}`);

  for (const reason of [...outcome.fail, ...outcome.warn, ...outcome.notes]) {
    say(`        ${outcome.fail.includes(reason) ? "-" : outcome.notes.includes(reason) ? "i" : "~"} ${reason}`);
  }

  if (corsPages >= 3 && corsPages * 2 >= audited.length) {
    say();
    say(`STOP  The browser is being blocked by the backend's CORS policy at ${FRONT}, on ${corsPages} of the ${audited.length} pages checked so far, so the remaining pages would only repeat that.`);
    say("      The backend rules are more specific than this script checks. Find where they are set with:");
    say(`      ${corsGrep}`);
    stoppedEarly = true;
    break;
  }
}

const others = ranked.filter((entry) => entry.id !== projectId && entry.score > 0).slice(0, 2);
const needsMore = audited.filter((entry) => entry.status !== "FAIL" && entry.noFigures && entry.pattern.includes(":id"));

if (!stoppedEarly && others.length > 0 && needsMore.length > 0) {
  say();
  say(`2b. RE-CHECK: ${needsMore.length} project pages had nothing to check on "${projectName}". Trying them on ${others.map((entry) => `"${entry.name}"`).join(" and ")}.`);

  for (const entry of needsMore) {
    const route = routes.find((candidate) => candidate.pattern === entry.pattern);

    for (const other of others) {
      const outcome = await runPage(route, other.id);

      if (!outcome.noFigures) {
        Object.assign(entry, { status: outcome.status, fail: outcome.fail, warn: outcome.warn, notes: outcome.notes, noFigures: false, numbers: outcome.numbers, project: other.name });
        say(`  ${outcome.status}  ${entry.pattern}  has figures on "${other.name}"`);

        for (const reason of [...outcome.fail, ...outcome.warn, ...outcome.notes]) {
          say(`        ${outcome.fail.includes(reason) ? "-" : outcome.notes.includes(reason) ? "i" : "~"} ${reason}`);
        }

        break;
      }
    }
  }
}

await browser.close();
stopDev();

const count = (status) => audited.filter((entry) => entry.status === status).length;

say();
say("3. VERDICT PER FEATURE");

const needsFix = audited.filter((entry) => entry.status === "FAIL");
const nothingToCheck = audited.filter((entry) => entry.status !== "FAIL" && entry.noFigures);
const byEye = audited.filter((entry) => entry.status === "WARN" && !entry.noFigures);
const fine = audited.filter((entry) => entry.status === "PASS" && !entry.noFigures);

const reasons = (entry) => [...entry.fail, ...entry.warn].join("; ").slice(0, 900);
const where = (entry) => (entry.project && entry.project !== projectName ? `  (on "${entry.project}")` : "");
const shortName = (pattern) => pattern.replace(/^\/projects\/:id\//, "");

function wrapList(items) {
  const lines = [];
  let line = "    ";

  for (const item of items) {
    if (line.trim() && line.length + item.length + 2 > 110) {
      lines.push(line.replace(/, $/, ""));
      line = "    ";
    }

    line += `${item}, `;
  }

  if (line.trim()) {
    lines.push(line.replace(/, $/, ""));
  }

  return lines;
}

say(`  NEEDS A FIX (${needsFix.length}): the page shows something plainly wrong or does not load`);

for (const entry of needsFix) {
  say(`    ${entry.pattern}${where(entry)}  ${reasons(entry)}`);
}

say(`  CHECK BY EYE (${byEye.length}): loads, but shows something a person should confirm is meant`);

for (const entry of byEye) {
  say(`    ${entry.pattern}${where(entry)}  ${reasons(entry)}`);
}

say(`  NOTHING TO CHECK (${nothingToCheck.length}): loads, but shows no figures on any project tried, so there is no data for it (or it is a tool page)`);

if (nothingToCheck.length > 0) {
  say("    (project pages are listed by name only, without /projects/:id/)");
}

for (const line of wrapList(nothingToCheck.map((entry) => shortName(entry.pattern)))) {
  say(line);
}

say(`  LOOKS FINE (${fine.length}): loads, shows figures, nothing odd found. This is not proof the figures are right, only that nothing is visibly broken.`);

const csvCell = (value) => `"${String(value).replace(/"/g, '""')}"`;
const csvRows = [["page", "verdict", "project", "figures_on_page", "notes"].map(csvCell).join(",")];

for (const entry of audited) {
  const verdict = entry.status === "FAIL" ? "NEEDS A FIX" : entry.noFigures ? "NOTHING TO CHECK" : entry.status === "WARN" ? "CHECK BY EYE" : "LOOKS FINE";

  csvRows.push([entry.pattern, verdict, entry.project, entry.numbers, [reasons(entry), ...(entry.notes ?? [])].filter(Boolean).join("; ")].map(csvCell).join(","));
}

writeFileSync(join(OUT, "audit.csv"), `${csvRows.join("\n")}\n`);

say();

if (unreachable.length > 0) {
  say(`not opened (they need another id in the address): ${unreachable.join(", ")}`);
}

say(`SUMMARY  backend endpoints: ${apiPass} pass, ${apiFail} fail  |  pages: ${count("PASS")} pass, ${count("WARN")} warn, ${count("FAIL")} fail of ${routes.length}${audited.length < routes.length ? ` (stopped early after ${audited.length})` : ""}`);
say(`COVERAGE  ${audited.length - nothingToCheck.length} of ${audited.length} pages could be checked; the other ${nothingToCheck.length} had no data on the projects tried, or are tool pages`);
say("This only reads data. It does not create, edit or delete anything, so forms and buttons that save changes are not exercised.");

if (count("FAIL") + apiFail > 0) {
  say(`Screenshots of failing pages: ${join(OUT, "shots")}`);
}

reportStopped();

writeFileSync(join(OUT, "audit-report.txt"), `${report.join("\n")}\n`);
console.log(`Full report: ${join(OUT, "audit-report.txt")}`);
console.log(`One line per feature (open in a spreadsheet): ${join(OUT, "audit.csv")}`);
process.exit(apiFail + count("FAIL") > 0 ? 1 : 0);
