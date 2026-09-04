import { collectFacts } from "./facts.mjs";
import { MONO, SANS, THEMES, esc, writeText } from "./lib.mjs";

const facts = collectFacts();
const fmtKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

function svg({ width, height, title, label, themeName, body, extraCss = "" }) {
  const theme = THEMES[themeName];
  const narrowCss = width === 390
    ? ".eyebrow{font-size:14px}.subhead{font-size:20px}.label{font-size:15px}.copy{font-size:15px}.small{font-size:14px;letter-spacing:.15px}"
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(label)}">
<title>${esc(title)}</title>
<style>
text{font-family:${SANS};fill:${theme.ink}}.mono{font-family:${MONO}}.ink{fill:${theme.ink}}.mute{fill:${theme.mute}}.accent{fill:${theme.accent}}.soft{fill:${theme.soft}}.panel{fill:none;stroke:${theme.rule};stroke-width:1}.wire{fill:none;stroke:${theme.rule};stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.wire.active{stroke:${theme.accent}}.dash{stroke-dasharray:7 7}.tag{fill:${theme.soft};stroke:${theme.accent};stroke-width:1}.cell{fill:none;stroke:${theme.rule};stroke-width:1}.grid{stroke:${theme.rule};stroke-width:1;opacity:.28}.signal{fill:${theme.accent};stroke:${theme.accent}}.evidence{fill:${theme.soft};stroke:${theme.ink};stroke-width:1}.eyebrow{font:600 12px ${MONO};letter-spacing:1.8px}.headline{font:700 46px ${SANS};letter-spacing:-1.5px}.subhead{font:500 18px ${SANS}}.label{font:700 13px ${MONO};letter-spacing:.7px}.copy{font:400 14px ${SANS}}.small{font:500 12px ${MONO};letter-spacing:.25px}.count{font:700 34px ${MONO}}
@keyframes scanY{0%{transform:translateY(0)}92%,100%{transform:translateY(var(--scan-distance))}}
${narrowCss}
${extraCss}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.feedback-pulse,.scan-bar,.boot-cursor,.runtime-packet{display:none!important}.boot-ready{opacity:1!important}}
</style>
${body}
</svg>
`;
}

function grid(width, height, step = 44) {
  const lines = [];
  for (let x = step; x < width; x += step) lines.push(`<path class="grid" d="M${x} 0V${height}"/>`);
  for (let y = step; y < height; y += step) lines.push(`<path class="grid" d="M0 ${y}H${width}"/>`);
  return `<g aria-hidden="true">${lines.join("")}</g>`;
}

function arrowDefs(theme) {
  return `<defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${theme.rule}"/></marker></defs>`;
}

function feedback(themeName, narrow) {
  const width = narrow ? 390 : 880;
  const height = narrow ? 1030 : 560;
  const theme = THEMES[themeName];
  const stages = [
    ["RECALL", "load repo facts"],
    ["WORK", "use routed playbook"],
    ["VERIFY", "capture evidence"],
    ["REFINE", "turn friction into a fix"],
    ["REVIEWED CHANGE", "commit useful lesson"],
    ["NEXT TASK", "recall stronger repo"],
  ];
  const positions = narrow
    ? [
        { x: 24, y: 142 }, { x: 198, y: 142 }, { x: 198, y: 268 },
        { x: 24, y: 268 }, { x: 24, y: 394 }, { x: 198, y: 394 },
      ]
    : [
        { x: 40, y: 158 }, { x: 300, y: 158 }, { x: 560, y: 158 },
        { x: 560, y: 326 }, { x: 300, y: 326 }, { x: 40, y: 326 },
      ];
  const nodeWidth = narrow ? 168 : 220;
  const nodeHeight = narrow ? 88 : 96;
  const center = ({ x, y }) => ({ x: x + nodeWidth / 2, y: y + nodeHeight / 2 });
  const centers = positions.map(center);
  const segments = centers.map((point, index) => {
    const next = centers[(index + 1) % centers.length];
    if (index === centers.length - 1) {
      return narrow
        ? `<path class="wire" marker-end="url(#arrow)" d="M${point.x} ${point.y}H376V122H108V${centers[0].y - 8}"/>`
        : `<path class="wire" marker-end="url(#arrow)" d="M${point.x} ${point.y}H20V138H${centers[0].x}V${centers[0].y - 8}"/>`;
    }
    const elbow = index % 2 === 0
      ? `M${point.x} ${point.y}H${next.x - 9}`
      : `M${point.x} ${point.y}V${next.y}H${next.x + (next.x < point.x ? 9 : -9)}`;
    return `<path class="wire" marker-end="url(#arrow)" d="${elbow}"/>`;
  }).join("");
  const nodes = stages.map(([name, description], index) => {
    const { x, y } = positions[index];
    return `<g transform="translate(${x} ${y})"><rect class="cell" width="${nodeWidth}" height="${nodeHeight}"/><text class="small mute" x="${nodeWidth - 12}" y="22" text-anchor="end">0${index + 1}</text><text class="label" x="14" y="43">${name}</text><text class="copy mute" x="14" y="${narrow ? 68 : 72}">${description}</text></g>`;
  }).join("");
  const evidence = narrow
    ? `<g transform="translate(238 236)"><rect class="evidence" width="112" height="28"/><path class="wire active" d="M10 14l7 7 13-15"/><text class="small" x="38" y="19">EVIDENCE</text></g>`
    : `<g transform="translate(616 270)"><rect class="evidence" width="132" height="30"/><path class="wire active" d="M10 15l7 7 13-15"/><text class="small" x="40" y="20">EVIDENCE</text></g>`;
  const branch = narrow
    ? `<path class="wire dash" marker-end="url(#arrow)" d="M108 482V574"/><g transform="translate(24 582)"><rect class="cell" width="168" height="88"/><text class="small mute" x="156" y="22" text-anchor="end">OPTIONAL</text><text class="label" x="14" y="43">HUMAN REVIEW</text><text class="copy mute" x="14" y="68">keep local or sync</text></g><path class="wire dash" marker-end="url(#arrow)" d="M108 670V730"/><g transform="translate(24 738)"><rect class="cell" width="168" height="88"/><text class="label" x="14" y="43">SYNC</text><text class="copy mute" x="14" y="68">generic change only</text></g><path class="wire dash" marker-end="url(#arrow)" d="M192 782H212"/><g transform="translate(220 738)"><rect class="cell" width="146" height="88"/><text class="label" x="14" y="43">FUTURE REPOS</text><text class="copy mute" x="14" y="68">start stronger</text></g><text class="small mute" x="24" y="872">SOLID: LOCAL LOOP</text><text class="small mute" x="24" y="902">DOTTED: HUMAN-GATED SYNC</text><text class="small mute" x="24" y="956">KEEP LOCAL remains the default.</text>`
    : `<path class="wire dash" marker-end="url(#arrow)" d="M410 422V484H518"/><g transform="translate(526 446)"><rect class="cell" width="142" height="70"/><text class="small mute" x="12" y="21">OPTIONAL GATE</text><text class="label" x="12" y="45">HUMAN REVIEW</text><text class="small mute" x="12" y="62">KEEP LOCAL / SYNC</text></g><path class="wire dash" marker-end="url(#arrow)" d="M668 481H698"/><g transform="translate(706 446)"><rect class="cell" width="134" height="70"/><text class="label" x="12" y="31">FUTURE REPOS</text><text class="small mute" x="12" y="53">generic changes only</text></g><text class="small mute" x="40" y="530">SOLID: LOCAL LOOP · DOTTED: HUMAN-GATED SYNC</text>`;
  const keyframes = centers.map((point, index) => {
    const start = ((index / centers.length) * 100).toFixed(2);
    const end = ((((index + 1) / centers.length) * 100) - 1).toFixed(2);
    return `${start}%,${end}%{transform:translate(${point.x}px,${point.y}px)}`;
  }).join("");
  const header = narrow
    ? `<text class="eyebrow mute" x="24" y="34">THE FEEDBACK CIRCUIT</text><text class="subhead" x="24" y="70">Verified lessons improve</text><text class="subhead" x="24" y="96">the next task.</text>`
    : `<text class="eyebrow mute" x="40" y="42">THE FEEDBACK CIRCUIT</text><text class="headline" x="40" y="94" style="font-size:42px">Verified lessons improve the next task.</text><text class="subhead mute" x="40" y="124">Propagation stays optional and human-reviewed.</text>`;
  return svg({
    width, height, title: "Harness Firmware feedback circuit",
    label: "Recall, work, verify, refine, and a reviewed repository change form a local loop. A separate human-approved sync can carry generic changes into future repositories.",
    themeName,
    extraCss: `@keyframes feedbackPulse{${keyframes}}.feedback-pulse{animation:feedbackPulse 12s steps(1,end) infinite}`,
    body: `${grid(width, height)}${arrowDefs(theme)}${header}${segments}${nodes}${evidence}${branch}<circle class="signal feedback-pulse" cx="0" cy="0" r="7"/>`,
  });
}

function boot(themeName, narrow) {
  const width = narrow ? 390 : 880;
  const height = narrow ? 600 : 430;
  const rows = [
    ["RULE KERNEL", `${fmtKiB(facts.kernelBytes)} loaded`],
    ["SKILL INDEX", `${facts.skillCount} workflows ready`],
    ["PROJECT MEMORY", `${facts.referenceFileCount} files mounted`],
    ["RUNTIME BOUNDARY", `${facts.runtimeCount} targets declared`],
    ["VALIDATION", "template checks wired"],
  ];
  const startY = narrow ? 250 : 184;
  const rowGap = narrow ? 56 : 48;
  const xDot = narrow ? 30 : 48;
  const xLabel = narrow ? 50 : 66;
  const xValue = narrow ? 366 : 612;
  const rowsMarkup = rows.map(([name, value], index) => {
    const y = startY + index * rowGap;
    return `<g><circle class="evidence" cx="${xDot}" cy="${y - 5}" r="4"/><text class="small" x="${xLabel}" y="${y}">${name}</text><text class="small mute" x="${xValue}" y="${y}" text-anchor="end">${value}</text><path class="wire" d="M${narrow ? 24 : 40} ${y + 18}H${xValue}"/></g>`;
  }).join("");
  const cursorFrames = rows.map((_, index) => {
    const start = ((index / rows.length) * 84).toFixed(1);
    const end = ((((index + 1) / rows.length) * 84) - 1).toFixed(1);
    return `${start}%,${end}%{transform:translateY(${index * rowGap}px)}`;
  }).join("");
  const title = narrow
    ? `<text class="eyebrow mute" x="24" y="38">REPOSITORY FIRMWARE</text><text class="headline" x="24" y="88" style="font-size:38px">Harness</text><text class="headline" x="24" y="130" style="font-size:38px">Firmware</text><text class="copy mute" x="24" y="170">Instructions, memory, and verification</text><text class="copy mute" x="24" y="194">for Claude Code and Codex.</text>`
    : `<text class="eyebrow mute" x="40" y="46">REPOSITORY FIRMWARE</text><text class="headline" x="40" y="100">Harness Firmware</text><text class="subhead mute" x="40" y="132">Instructions, project memory, and verification for Claude Code and Codex.</text>`;
  const ready = narrow
    ? `<g class="boot-ready"><rect class="tag" x="24" y="548" width="342" height="30" rx="6"/><text class="label accent" x="195" y="569" text-anchor="middle">READY · ${facts.skillCount}/${facts.skillCount}</text></g>`
    : `<g class="boot-ready"><rect class="tag" x="660" y="58" width="180" height="174" rx="8"/><text class="small mute" x="680" y="88">BOOT STATUS</text><text class="count accent" x="680" y="136">READY</text><text class="small" x="680" y="170">${facts.skillCount}/${facts.skillCount} skills indexed</text><text class="small" x="680" y="196">${facts.codexSkillCount}/${facts.codexSkillCount} skills current</text></g>`;
  return svg({
    width, height, title: "Harness Firmware boot trace",
    label: `Harness Firmware boots with ${facts.skillCount} skills, ${facts.referenceFileCount} project-memory files, and ${facts.runtimeCount} runtime boundaries ready.`,
    themeName,
    extraCss: `@keyframes bootCursor{${cursorFrames}84%,100%{transform:translateY(${(rows.length - 1) * rowGap}px)}}@keyframes bootReady{0%,83%{opacity:.25}84%,100%{opacity:1}}.boot-cursor{animation:bootCursor 12s steps(1,end) infinite}.boot-ready{animation:bootReady 12s steps(1,end) infinite}`,
    body: `${grid(width, height)}${title}${rowsMarkup}<circle class="signal boot-cursor" cx="${xDot}" cy="${startY - 5}" r="7"/>${ready}`,
  });
}

function runtime(themeName, narrow) {
  const width = narrow ? 390 : 880;
  const height = narrow ? 650 : 420;
  const theme = THEMES[themeName];
  const node = (x, y, w, h, kicker, label, detail, memory = false) => `<g transform="translate(${x} ${y})"><rect class="cell" width="${w}" height="${h}"${memory ? " rx=\"6\"" : ""}/><text class="small mute" x="16" y="25">${kicker}</text><text class="label" x="16" y="51">${label}</text><text class="copy mute" x="16" y="74">${detail}</text></g>`;
  let body;
  if (narrow) {
    body = `${grid(width, height)}${arrowDefs(theme)}<text class="eyebrow mute" x="24" y="36">ONE SOURCE · TWO BOUNDARIES</text><text class="subhead" x="24" y="70">Canonical playbooks stay together.</text>
${node(40, 108, 310, 92, "SOURCE OF TRUTH", ".claude/skills/", `${facts.skillCount} canonical workflows`)}
<path class="wire" marker-end="url(#arrow)" d="M195 200V240H108V264"/><path class="wire dash" marker-end="url(#arrow)" d="M195 240H282V264"/>
${node(24, 274, 168, 104, "DIRECT", "CLAUDE CODE", "kernel + hooks")}${node(198, 274, 168, 104, "DISCOVERED", "CODEX", "AGENTS.md boundary")}
<path class="wire" marker-end="url(#arrow)" d="M108 378V428H184"/><path class="wire" marker-end="url(#arrow)" d="M282 378V428H206"/>
${node(40, 438, 310, 96, "SHARED PROJECT MEMORY", ".claude/reference/", `${facts.referenceFileCount} committed topics`, true)}
<rect class="tag" x="40" y="570" width="310" height="48" rx="6"/><text class="label accent" x="195" y="600" text-anchor="middle">${facts.codexSkillCount} CODEX SKILLS VERIFIED</text><circle class="signal runtime-packet" cx="195" cy="240" r="6"/>`;
  } else {
    body = `${grid(width, height)}${arrowDefs(theme)}<text class="eyebrow mute" x="40" y="42">ONE SOURCE · TWO RUNTIME BOUNDARIES</text><text class="headline" x="40" y="92" style="font-size:38px">Playbooks stay canonical.</text><text class="subhead mute" x="40" y="122">Adapters translate discovery and safety rules without copying workflow bodies.</text>
${node(40, 170, 234, 106, "SOURCE OF TRUTH", ".claude/skills/", `${facts.skillCount} canonical workflows`)}
<path class="wire" marker-end="url(#arrow)" d="M274 218H348"/><path class="wire dash" marker-end="url(#arrow)" d="M274 250H330V326H590"/>
${node(358, 170, 212, 106, "DIRECT", "CLAUDE CODE", "kernel · hooks · skills")}${node(600, 170, 240, 106, "DISCOVERED", "CODEX", `${facts.codexSkillCount} skills · AGENTS.md`)}
<path class="wire" marker-end="url(#arrow)" d="M464 276V314H444"/><path class="wire" marker-end="url(#arrow)" d="M720 276V314H610"/>
${node(252, 326, 368, 76, "SHARED PROJECT MEMORY", ".claude/reference/", `${facts.referenceFileCount} committed topics`, true)}<circle class="signal runtime-packet" cx="310" cy="218" r="6"/>`;
  }
  return svg({
    width, height, title: "Harness Firmware runtime bus",
    label: `${facts.skillCount} canonical playbooks serve Claude Code directly and Codex through ${facts.codexSkillCount} skills, with shared project memory.`,
    themeName,
    extraCss: "@keyframes runtimePacket{0%,8%{opacity:0;transform:translateX(0)}12%{opacity:1}82%{opacity:1;transform:translateX(280px)}88%,100%{opacity:0;transform:translateX(280px)}}.runtime-packet{animation:runtimePacket 12s linear infinite}",
    body,
  });
}

function wrapLabel(label, max = 14) {
  if (label.length <= max) return [label];
  const words = label.split(" ");
  if (words.length === 1) return [label.slice(0, max), label.slice(max, max * 2)];
  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function skillsPanel(themeName, narrow) {
  const width = narrow ? 390 : 880;
  const height = narrow ? 1560 : 700;
  const groups = facts.groups.map((group) => ({
    ...group,
    skills: facts.skills.filter((skill) => skill.group === group.id).sort((a, b) => a.name.localeCompare(b.name)),
  }));
  let markup = `${grid(width, height)}<text class="eyebrow mute" x="${narrow ? 24 : 40}" y="${narrow ? 36 : 42}">ON-DEMAND MEMORY MAP</text><text class="${narrow ? "subhead" : "headline"}" x="${narrow ? 24 : 40}" y="${narrow ? 72 : 92}"${narrow ? "" : " style=\"font-size:38px\""}>${facts.skillCount} workflows. Loaded when called.</text>`;
  markup += narrow
    ? `<text class="copy mute" x="24" y="104">Repository source estimate:</text><text class="small mute" x="24" y="132">${fmtKiB(facts.residentBytes)} kernel + index</text><text class="small mute" x="24" y="158">${fmtKiB(facts.onDemandBytes)} on-demand skill bodies</text>`
    : `<text class="copy mute" x="40" y="122">Repository source estimate · ${fmtKiB(facts.residentBytes)} kernel + index · ${fmtKiB(facts.onDemandBytes)} on-demand skill bodies</text>`;
  let footerY;
  if (narrow) {
    let y = 188;
    for (const group of groups) {
      markup += `<text class="label mute" x="24" y="${y + 22}" data-group-count="${group.skills.length}">${group.label.toUpperCase()} · ${group.skills.length}</text>`;
      y += 40;
      group.skills.forEach((skill, index) => {
        const x = index % 2 === 0 ? 24 : 200;
        if (index > 0 && index % 2 === 0) y += 62;
        const lines = wrapLabel(skill.label, 14);
        markup += `<g data-skill="${skill.name}" data-bottom="${y + 52}" transform="translate(${x} ${y})"><rect class="cell" width="166" height="52" rx="6"/><text class="small" x="12" y="${lines.length === 1 ? 31 : 22}">${esc(lines[0])}</text>${lines[1] ? `<text class="small" x="12" y="40">${esc(lines[1])}</text>` : ""}</g>`;
      });
      y += 88;
    }
    footerY = y + 12;
    markup += `<text class="small mute" x="24" y="${footerY}">COUNTS VERIFIED AGAINST</text><text class="small mute" x="24" y="${footerY + 26}">.claude/skills/</text>`;
  } else {
    const starts = [158, 314, 470];
    groups.forEach((group, groupIndex) => {
      const y = starts[groupIndex];
      const columns = group.id === "specialist" ? 7 : 8;
      const cellWidth = group.id === "specialist" ? 108 : 96;
      markup += `<text class="label mute" x="40" y="${y}" data-group-count="${group.skills.length}">${group.label.toUpperCase()} · ${group.skills.length}</text>`;
      group.skills.forEach((skill, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const x = 40 + column * (cellWidth + 6);
        const cellY = y + 18 + row * 66;
        const lines = wrapLabel(skill.label, group.id === "specialist" ? 14 : 12);
        markup += `<g data-skill="${skill.name}" data-bottom="${cellY + 54}" transform="translate(${x} ${cellY})"><rect class="cell" width="${cellWidth}" height="54" rx="6"/><text class="small" x="10" y="${lines.length === 1 ? 31 : 23}">${esc(lines[0])}</text>${lines[1] ? `<text class="small" x="10" y="40">${esc(lines[1])}</text>` : ""}</g>`;
      });
    });
    footerY = height - 22;
    markup += `<text class="small mute" x="40" y="${footerY}">CELL AND GROUP COUNTS VERIFIED AGAINST .claude/skills/</text>`;
  }
  const scanTop = narrow ? 188 : 158;
  const scanDistance = narrow ? Math.max(0, footerY - scanTop - 60) : 430;
  markup += `<g class="scan-bar" aria-hidden="true" style="--scan-distance:${scanDistance}px"><rect class="signal" x="${narrow ? 18 : 34}" y="${scanTop}" width="4" height="32" style="animation:scanY 12s linear infinite"/></g>`;
  return svg({
    width, height, title: "Harness Firmware skill memory map",
    label: `A memory map of ${facts.skillCount} on-demand workflows grouped into ${facts.tierCounts.core} core, ${facts.tierCounts.discipline} discipline, and ${facts.tierCounts.specialist} specialist skills.`,
    themeName, body: markup,
  });
}

const panels = { boot, feedback, runtime, skills: skillsPanel };
for (const [name, build] of Object.entries(panels)) {
  for (const themeName of ["light", "dark"]) {
    writeText(`assets/readme/${name}-${themeName}.svg`, build(themeName, false));
    writeText(`assets/readme/${name}-narrow-${themeName}.svg`, build(themeName, true));
  }
}

process.stdout.write(`Generated ${Object.keys(panels).length * 4} README SVG assets.\n`);
