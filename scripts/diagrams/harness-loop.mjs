// Generates assets/diagrams/harness-loop-{light,dark}.svg — the harness-firmware
// counterpart of NVIDIA's AVO architecture diagram: inputs, the audited round loop,
// the stagnation supervisor, the CI gate, and the lineage that feeds back into the
// firmware itself. Every element names its real skill or file and links to it
// (links are clickable when the SVG is opened directly; GitHub's <img> embed strips
// interactivity). Regenerate with: node scripts/diagrams/harness-loop.mjs
import { MONO, SANS, THEMES, esc, writeText } from "../readme/lib.mjs";

const WARN = { light: "#bc4c00", dark: "#f0883e" };
const W = 1320;
const H = 670;

const REPO = "https://github.com/ryanportfolio/Harness-Firmware";
const BLOB = `${REPO}/blob/main`;
const TREE = `${REPO}/tree/main`;
const SKILL = (name) => `${BLOB}/.claude/skills/${name}/SKILL.md`;
const GITHUB_PR = "https://cli.github.com/manual/gh_pr";

const part = (label, href = null) => ({ label, href });
const partsText = (parts) => parts.map(({ label }) => label).join("");
const linkedText = (parts) => parts.map(({ label, href }) => href
  ? `<a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)}"><tspan>${esc(label)}</tspan></a>`
  : `<tspan>${esc(label)}</tspan>`).join("");

const CX = 570;
const CY = 355;
const R = 185;

const rad = (deg) => (deg * Math.PI) / 180;
const pos = (deg) => [CX + R * Math.sin(rad(deg)), CY - R * Math.cos(rad(deg))];
const fmt = (n) => Number(n.toFixed(1));

const NODES = [
  { deg: 0, name: "Recall", sub: "kernel, reference, dead ends", refs: [part("/recall", SKILL("recall")), part(" · "), part(".claude/reference/", `${TREE}/.claude/reference`)], href: SKILL("recall") },
  { deg: 72, name: "Plan", sub: "one step, one brief", minBoxW: 160, refRows: [
    [part("long-horizon", SKILL("long-horizon"))],
    [part("brainstorming", SKILL("brainstorming"))],
    [part("why", SKILL("why"))],
  ], href: SKILL("long-horizon") },
  { deg: 144, name: "Execute", sub: "fresh executor subagent", refs: [part("fable-mode", SKILL("fable-mode")), part(" discipline")], href: SKILL("fable-mode") },
  { deg: 216, name: "Audit", sub: "fresh auditor or cross-vendor", refRows: [
    [part("long-horizon", SKILL("long-horizon")), part(" · "), part("verify-this", SKILL("verify-this"))],
    [part("advocate", SKILL("advocate")), part(" · "), part("codex-review", SKILL("codex-review"))],
    [part("arena", SKILL("arena")), part(" · "), part("wow-loop", SKILL("wow-loop"))],
    [part("impartial-review", SKILL("impartial-review"))],
  ], href: SKILL("codex-review") },
  { deg: 288, name: "Integrate", sub: "verified progress or dead end", minBoxW: 160, refRows: [
    [part("record verified result")],
    [part("refine", SKILL("refine"))],
  ], href: SKILL("long-horizon") },
];

function loopArrows() {
  const gap = 15;
  return NODES.map((node, index) => {
    const [x1, y1] = pos(node.deg + gap).map(fmt);
    const [x2, y2] = pos(NODES[(index + 1) % 5].deg - gap).map(fmt);
    return `<path class="wire flow" marker-end="url(#arrow)" d="M${x1} ${y1}A${R} ${R} 0 0 1 ${x2} ${y2}"/>`;
  }).join("");
}

function nodeIcon(name) {
  switch (name) {
    case "Recall":
      return `<circle cx="-3" cy="-3" r="7" class="glyph"/><path class="glyph" d="M2 2L10 10"/>`;
    case "Plan":
      return `<rect x="-8" y="-11" width="16" height="22" rx="2" class="glyph"/><path class="glyph" d="M-4-4H4M-4 1H4M-4 6H1"/>`;
    case "Execute":
      return `<rect x="-11" y="-9" width="22" height="18" rx="2" class="glyph"/><path class="glyph" d="M-6-3L-2 0L-6 3M0 4H6"/>`;
    case "Audit":
      return `<circle cx="0" cy="0" r="10" class="glyph"/><path class="glyph" d="M-4 0L-1 3L5-3"/>`;
    case "Integrate":
      return `<circle cx="-6" cy="-7" r="3.5" class="glyph"/><circle cx="-6" cy="7" r="3.5" class="glyph"/><circle cx="7" cy="0" r="3.5" class="glyph"/><path class="glyph" d="M-6-3.5V3.5M-2.7 7C1 7 3.5 4 3.5 0"/>`;
    default:
      return "";
  }
}

function loopNodes() {
  return NODES.map((node) => {
    const [x, y] = pos(node.deg).map(fmt);
    const refRows = node.refRows ?? [node.refs];
    const boxW = Math.max(node.minBoxW ?? 192, ...refRows.map((parts) => partsText(parts).length * 6.4 + 18));
    const boxH = 56 + (refRows.length - 1) * 14;
    const refLines = refRows.map((parts, index) => `<text class="ref accent" text-anchor="middle" y="${34 + index * 14}">${linkedText(parts)}</text>`).join("");
    return `<g transform="translate(${x} ${y})">
<circle r="34" class="node"/>
<g>${nodeIcon(node.name)}</g>
<g transform="translate(0 52)"><rect x="${fmt(-boxW / 2)}" y="-14" width="${fmt(boxW)}" height="${boxH}" rx="6" class="tagbox"/>
<a href="${node.href}" target="_blank" rel="noopener noreferrer" aria-label="${esc(node.name)} skill"><text class="small ink" text-anchor="middle" y="2"><tspan font-weight="700">${esc(node.name)}</tspan></text></a>
<text class="tiny mute" text-anchor="middle" y="18">${esc(node.sub)}</text>
${refLines}</g>
</g>`;
  }).join("");
}

function inputBox(y, title, lines, refs, href, icon, options = {}) {
  const {
    height = 150,
    lineStart = 72,
    lineGap = 20,
    refY = 132,
    extra = "",
  } = options;
  const rows = lines.map((line, i) => `<text class="copy mute" x="16" y="${lineStart + i * lineGap}">${esc(line)}</text>`).join("");
  return `<g transform="translate(24 ${y})">
<rect class="panel" width="272" height="${height}" rx="8"/>
<a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${esc(title)}"><g transform="translate(24 30)">${icon}</g>
<text class="subhead ink" x="52" y="36" font-weight="600">${esc(title)}</text></a>
${rows}
<text class="ref accent" x="16" y="${refY}">${linkedText(refs)}</text>
${extra}
</g>`;
}

function build(themeName) {
  const theme = THEMES[themeName];
  const warn = WARN[themeName];
  const grid = [];
  for (let x = 44; x < W; x += 44) grid.push(`<path class="grid" d="M${x} 0V${H}"/>`);
  for (let y = 44; y < H; y += 44) grid.push(`<path class="grid" d="M0 ${y}H${W}"/>`);

  const tokenEfficiency = `<path class="panel" d="M16 116H256"/>
<text class="label mute" x="16" y="137">TOKEN EFFICIENCY</text>
<text class="ref accent" x="16" y="160">${linkedText([
  part("caveman", SKILL("caveman")),
  part(" · "),
  part("RTK", "https://github.com/rtk-ai/rtk"),
  part(" · "),
  part("STK", "https://github.com/ryanportfolio/STK"),
])}</text>`;

  const inputs = [
    inputBox(100, "Kernel", [
      "CLAUDE.md rules always loaded;",
      "6 reference files on demand",
    ], [part("CLAUDE.md", `${BLOB}/CLAUDE.md`), part(" · "), part(".claude/reference/", `${TREE}/.claude/reference`)], `${BLOB}/CLAUDE.md`,
    `<path class="glyph" d="M-8-10H5A3 3 0 0 1 8-7V10H-5A3 3 0 0 1-8 7Z"/><path class="glyph" d="M-5 10A3 3 0 0 1-5 4H8"/>`, {
      height: 180,
      lineStart: 64,
      lineGap: 18,
      refY: 102,
      extra: tokenEfficiency,
    }),
    inputBox(300, "Skill library", [
      "30 playbooks routed by description,",
      "loaded only when called",
    ], [part(".claude/skills/", `${TREE}/.claude/skills`), part(" · "), part(".agents/skills/", `${TREE}/.agents/skills`)], `${TREE}/.claude/skills`,
    `<rect class="glyph" x="-9" y="-9" width="8" height="8" rx="1"/><rect class="glyph" x="1" y="-9" width="8" height="8" rx="1"/><rect class="glyph" x="-9" y="1" width="8" height="8" rx="1"/><rect class="glyph" x="1" y="1" width="8" height="8" rx="1"/>`),
    inputBox(470, "Evaluators", [
      "CI, tests, audited evidence:",
      "evidence beats claims",
    ], [part(".github/workflows/", `${TREE}/.github/workflows`), part(" · "), part("/verify-this", SKILL("verify-this"))], `${TREE}/.github/workflows`,
    `<path class="glyph" d="M-9 4A9 9 0 0 1 9 4"/><path class="glyph" d="M0 4L5-3"/><path class="glyph" d="M-11 8H11"/>`),
  ];

  const inputArrows = [190, 375, 545]
    .map((y) => `<path class="wire" marker-end="url(#arrow)" d="M296 ${y}H316"/>`)
    .join("");

  const supervisor = `<g transform="translate(860 90)">
<rect class="panel" width="436" height="150" rx="8"/>
<a href="${SKILL("long-horizon")}" target="_blank" rel="noopener noreferrer" aria-label="Long-horizon stagnation supervisor"><text class="label mute" x="16" y="28">SUPERVISOR · STAGNATION WATCH</text></a>
<text class="copy ink" x="16" y="54">2 audit fails on one step → change approach</text>
<text class="copy ink" x="16" y="76">3 rounds, no new verified progress → rewrite plan</text>
<text class="copy ink" x="16" y="98">cross-vendor consult, checked against the contract</text>
<text class="ref accent" x="16" y="126">${linkedText([part("long-horizon (Stagnation)", SKILL("long-horizon")), part(" · "), part("codex-review (gpt-5.6-sol)", SKILL("codex-review"))])}</text>
</g>
<path class="warnwire dash" marker-end="url(#warnarrow)" d="M880 240C830 262 800 278 786 290"/>
<text class="tiny" fill="${warn}" x="872" y="262">conditional intervention</text>`;

  const candidate = `<g transform="translate(860 350)">
<rect class="panel" width="170" height="120" rx="8"/>
<a href="${SKILL("merge")}" target="_blank" rel="noopener noreferrer" aria-label="Merge skill"><text class="subhead ink" x="16" y="32" font-weight="600">Candidate</text></a>
<text class="copy mute" x="16" y="58">branch + PR,</text>
<text class="copy mute" x="16" y="78">evidence attached</text>
<text class="ref accent" x="16" y="102">${linkedText([part("/merge cycle", SKILL("merge")), part(" · "), part("gh pr", GITHUB_PR)])}</text>
</g>
<path class="wire" marker-end="url(#arrow)" d="M820 410H856"/>
<path class="wire" marker-end="url(#arrow)" d="M1030 410H1041"/>
<g transform="translate(1085 410)">
<path class="panel" d="M0-40L44 0L0 40L-44 0Z"/>
<text class="tiny ink" text-anchor="middle" y="-2">checks</text>
<text class="tiny ink" text-anchor="middle" y="12">pass?</text>
</g>
<path class="wire active" marker-end="url(#accentarrow)" d="M1129 410H1134"/>
<text class="tiny accent" x="1116" y="378" text-anchor="middle">merge</text>
<g transform="translate(1138 340)">
<rect width="158" height="140" rx="8" fill="none" stroke="${theme.accent}" stroke-width="1.5"/>
<a href="${SKILL("refine")}" target="_blank" rel="noopener noreferrer" aria-label="Refine skill"><text class="subhead ink" x="12" y="30" font-weight="600">Updated lineage</text></a>
<text class="copy mute" x="12" y="58">squash-merge → main</text>
<text class="copy mute" x="12" y="78">checkout pulled</text>
<text class="copy mute" x="12" y="98">lessons → /refine</text>
<text class="ref accent" x="12" y="122">${linkedText([part("refine", SKILL("refine")), part(" · "), part("recall save", SKILL("recall"))])}</text>
</g>
<path class="warnwire dash" marker-end="url(#warnarrow)" d="M1085 450V600H835"/>
<a href="${SKILL("babysit-ci")}" target="_blank" rel="noopener noreferrer"><text class="tiny" fill="${warn}" x="960" y="590" text-anchor="middle">repair and retry · babysit-ci</text></a>`;

  const refine = `<path class="accentwire dash" marker-end="url(#accentarrow)" d="M1230 336C1310 260 1312 96 1160 74C900 44 400 38 168 92"/>
<text class="tiny accent" x="560" y="68">lessons merge back into the firmware: kernel, skills, reference</text>`;

  const body = `${grid.join("")}
<defs>
<marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${theme.rule}"/></marker>
<marker id="warnarrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${warn}"/></marker>
<marker id="accentarrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${theme.accent}"/></marker>
</defs>
<text class="eyebrow mute" x="24" y="34">HARNESS FIRMWARE</text>
<text class="headline" x="24" y="66" style="font-size:28px;letter-spacing:-.5px">The audited round loop</text>
<text class="label mute" x="24" y="92">INPUTS</text>
${inputs.join("")}
${inputArrows}
<rect class="panel" x="310" y="90" width="520" height="560" rx="10"/>
${loopArrows()}
${loopNodes()}
<circle cx="${CX}" cy="378" r="90" class="panel dash"/>
<text class="subhead ink" x="${CX}" y="352" text-anchor="middle" font-weight="600">Manager session</text>
<text class="tiny mute" x="${CX}" y="372" text-anchor="middle">one context holds the goal</text>
${supervisor}
${candidate}
${refine}`;

  const css = `text{font-family:${SANS};fill:${theme.ink}}.mono{font-family:${MONO}}.ink{fill:${theme.ink}}.mute{fill:${theme.mute}}.accent{fill:${theme.accent}}
.panel{fill:none;stroke:${theme.rule};stroke-width:1}
.node{fill:none;stroke:${theme.ink};stroke-width:1.5}
.tagbox{fill:${themeName === "light" ? "#ffffff" : "#0d1117"};stroke:${theme.rule};stroke-width:1}
.grid{stroke:${theme.rule};stroke-width:1;opacity:.28}
.glyph{fill:none;stroke:${theme.ink};stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.wire{fill:none;stroke:${theme.rule};stroke-width:2;stroke-linecap:round}
.wire.active{stroke:${theme.accent}}
.warnwire{fill:none;stroke:${warn};stroke-width:2;stroke-linecap:round}
.accentwire{fill:none;stroke:${theme.accent};stroke-width:1.5}
.dash{stroke-dasharray:6 7}
.flow{stroke-dasharray:10 8;animation:flow 2.4s linear infinite}
@keyframes flow{to{stroke-dashoffset:-18}}
a{text-decoration:none;cursor:pointer}
a:hover text,a:focus-visible text,text a:hover tspan,text a:focus-visible tspan{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}
.eyebrow{font:600 12px ${MONO};letter-spacing:1.8px}
.headline{font:700 46px ${SANS};letter-spacing:-1.5px}
.subhead{font:500 18px ${SANS}}
.label{font:700 13px ${MONO};letter-spacing:.7px}
.copy{font:400 14px ${SANS}}
.small{font:500 12px ${MONO};letter-spacing:.25px}
.tiny{font:500 11px ${SANS}}
.ref{font:500 10.5px ${MONO};letter-spacing:.2px}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="Harness firmware architecture with links: inputs feed an audited round loop, a stagnation supervisor intervenes conditionally, candidates pass a CI gate into an updated lineage that feeds lessons back into the firmware.">
<title>Harness firmware · the audited round loop</title>
<style>${css}</style>
<rect width="${W}" height="${H}" fill="${themeName === "light" ? "#ffffff" : "#0d1117"}"/>
${body}
</svg>
`;
}

for (const themeName of ["light", "dark"]) {
  writeText(`assets/diagrams/harness-loop-${themeName}.svg`, build(themeName));
}
process.stdout.write("Generated assets/diagrams/harness-loop-{light,dark}.svg\n");
