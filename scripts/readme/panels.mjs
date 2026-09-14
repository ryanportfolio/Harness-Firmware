import { collectFacts } from "./facts.mjs";
import { MONO, SANS, THEMES, esc, writeText } from "./lib.mjs";

const facts = collectFacts();
/* Project README contract: a repository circuit, with two independently owned
 * runtime lanes connected to committed memory. Setup precedes explanatory art.
 * Counts come from the filesystem and ownership registry. No performance claims.
 * Four variants must read at 880px and a real 390px viewport, in both themes.
 * SVGs require no scripts, hover, fonts, or external requests; motion loops and
 * reduced motion preserves every label. Plain Markdown carries usage and links.
 */
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
    let d;
    if(index === centers.length - 1) {
      d = narrow ? 'M366 438H376V122H108V140' : 'M40 374H20V206H38';
    } else if (point.y === next.y) {
      const direction = Math.sign(next.x-point.x);
      d = `M${point.x+direction*nodeWidth/2} ${point.y}H${next.x-direction*(nodeWidth/2+2)}`;
    } else {
      const direction = Math.sign(next.y-point.y);
      d = `M${point.x} ${point.y+direction*nodeHeight/2}V${next.y-direction*(nodeHeight/2+2)}`;
    }
    return `<path class="wire" marker-end="url(#arrow)" d="${d}"/>`;
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
    : `<g class="boot-ready"><rect class="tag" x="660" y="174" width="180" height="174" rx="8"/><text class="small mute" x="680" y="204">BOOT STATUS</text><text class="count accent" x="680" y="252">READY</text><text class="small" x="680" y="286">${facts.skillCount} Claude skills</text><text class="small" x="680" y="312">${facts.codexSkillCount} Codex skills</text></g>`;
  return svg({
    width, height, title: "Harness Firmware boot trace",
    label: `Harness Firmware boots with ${facts.skillCount} skills, ${facts.referenceFileCount} project-memory files, and ${facts.runtimeCount} runtime boundaries ready.`,
    themeName,
    extraCss: `@keyframes bootCursor{${cursorFrames}84%,100%{transform:translateY(${(rows.length - 1) * rowGap}px)}}.boot-cursor{animation:bootCursor 12s steps(1,end) infinite}`,
    body: `${grid(width, height)}${title}${rowsMarkup}<circle class="signal boot-cursor" cx="${xDot}" cy="${startY - 5}" r="7"/>${ready}`,
  });
}

function runtime(themeName, narrow) {
  const width = narrow ? 390 : 880;
  const height = narrow ? 630 : 430;
  const x = narrow ? 24 : 40;
  const cardWidth = narrow ? 342 : 382;
  const card = (left, top, name, kernel, count, detail) => `<g transform="translate(${left} ${top})"><rect class="cell" width="${cardWidth}" height="150"/><text class="label accent" x="20" y="30">${name}</text><text class="subhead" x="20" y="66">${kernel}</text><text class="copy" x="20" y="98">${count}</text><text class="copy mute" x="20" y="126">${detail}</text></g>`;
  const memoryY = narrow ? 488 : 318;
  const body = `${grid(width,height)}
<text class="eyebrow mute" x="${x}" y="36">TWO RUNTIMES · SHARED MEMORY</text>
<text class="subhead" x="${x}" y="72">Two runtimes. One project.</text>
${card(x,108,'CLAUDE CODE','CLAUDE.md + hooks',`${facts.skillCount} canonical workflows`,'.claude/skills/')}
${card(narrow ? x : 458,narrow ? 294 : 108,'CODEX','AGENTS.md',`${facts.codexSkillCount} skills · ${facts.codexNativeCount} native · ${facts.codexAdapterCount} adapters`,'.agents/skills/')}
<path class="wire active" d="${narrow ? 'M195 258V294 M195 444V488' : 'M231 258V292H649V258 M440 292V318'}"/>
<rect class="tag" x="${x}" y="${memoryY}" width="${width-2*x}" height="90"/>
<text class="label" x="${x+20}" y="${memoryY+28}">COMMITTED PROJECT MEMORY</text>
<text class="copy" x="${x+20}" y="${memoryY+54}">.claude/reference/ · ${facts.referenceFileCount} topics</text>
<text class="copy mute" x="${x+20}" y="${memoryY+76}">Facts, decisions, commands, and pitfalls</text>`;
  return svg({width,height,title:'Harness Firmware runtime ownership',
    label:`${facts.skillCount} Claude Code workflows and ${facts.codexSkillCount} Codex skills, including ${facts.codexNativeCount} native and ${facts.codexAdapterCount} adapters, share committed project memory.`,themeName,body});
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
