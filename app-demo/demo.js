const canvas = document.querySelector("#exploreCanvas");
const context = canvas.getContext("2d");
const shell = document.querySelector("#appShell");
const splash = document.querySelector("#startupSplash");
const palette = {
  background: "#090b0d",
  grid: "#17202a",
  line: "#9a5425",
  node: "#17130f",
  border: "#a65a27",
  text: "#eadfd3",
  muted: "#8d8177",
  accent: "#ff8a2a",
};

const emulatorProfiles = [
  ["Atari 2600", "Stella", "Preferred", "stella {game}"],
  ["ColecoVision", "Gearcoleco", "Preferred", "gearcoleco {game}"],
  ["Atari Jaguar", "BigPEmu", "Preferred", "bigpemu {game}"],
  ["NEC PC Engine", "Mednafen", "Preferred", "mednafen {game}"],
  ["SNK Neo Geo CD", "MAME", "Preferred", "mame {machine}"],
  ["Atari Lynx", "Mednafen", "Preferred", "mednafen {game}"],
  ["Sega Mega Drive / Genesis", "BlastEm", "Preferred", "blastem {game}"],
  ["Sega Saturn", "Mednafen", "Preferred", "mednafen {game}"],
  ["Sega Dreamcast", "Flycast", "Preferred", "flycast {game}"],
  ["Sony PlayStation", "DuckStation", "Preferred", "duckstation {game}"],
  ["Sony PlayStation 2", "PCSX2", "Preferred", "pcsx2 {game}"],
  ["Sony PlayStation Portable", "PPSSPP", "Preferred", "ppsspp {game}"],
  ["Microsoft Xbox", "xemu", "Preferred", "xemu -dvd_path {game}"],
  ["Arcade", "MAME", "Preferred", "mame {machine}"],
  ["Commodore Amiga", "FS-UAE", "Preferred", "fs-uae {game}"],
  ["IBM PC compatible", "DOSBox Pure", "Preferred", "retroarch -L dosbox_pure {game}"],
];

const groups = [
  { label: "Consoles", year: 1972, children: ["Atari 2600", "ColecoVision", "Mega Drive", "PlayStation"] },
  { label: "Computers", year: 1977, children: ["Apple II", "Commodore 64", "Amiga", "IBM PC"] },
  { label: "Handhelds", year: 1979, children: ["Microvision", "Atari Lynx", "Neo Geo Pocket", "PlayStation Vita"] },
];
let expanded = -1;
let nodes = [];

function sizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
  context.setTransform(scale, 0, 0, scale, 0, 0);
  draw(rect.width, rect.height);
}

function box(x, y, width, label, detail, active = false) {
  const height = 34;
  context.fillStyle = active ? "#24170f" : palette.node;
  context.strokeStyle = active ? palette.accent : palette.border;
  context.lineWidth = 1;
  context.fillRect(x, y, width, height);
  context.strokeRect(x + .5, y + .5, width - 1, height - 1);
  context.fillStyle = palette.text;
  context.font = "600 11px Inter, sans-serif";
  context.fillText(label, x + 10, y + 14);
  context.fillStyle = palette.muted;
  context.font = "9px Inter, sans-serif";
  context.fillText(detail, x + 10, y + 27);
  nodes.push({ x, y, width, height });
}

function draw(width, height) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = palette.background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = palette.grid;
  context.lineWidth = 1;
  for (let x = 40; x < width; x += 72) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
  for (let y = 30; y < height; y += 42) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  nodes = [];
  groups.forEach((group, index) => {
    const x = 90 + index * Math.max(130, (width - 250) / 3);
    const y = 62 + index * 58;
    context.strokeStyle = palette.line;
    context.beginPath(); context.moveTo(26, height - 40); context.lineTo(x, y + 17); context.stroke();
    box(x, y, 118, group.label, `${group.year} · click to expand`, expanded === index);
    if (expanded === index) group.children.forEach((child, childIndex) => {
      const childX = Math.min(width - 138, x + 145);
      const childY = 24 + childIndex * 48;
      context.beginPath(); context.moveTo(x + 118, y + 17); context.lineTo(childX, childY + 17); context.stroke();
      box(childX, childY, 126, child, `${group.year + childIndex * 6} · selected titles`);
    });
  });
  context.fillStyle = palette.accent;
  context.font = "10px ui-monospace, monospace";
  context.fillText("1950", 20, height - 14);
  context.fillText("2000", width - 48, height - 14);
}

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const index = groups.findIndex((_, groupIndex) => {
    const nodeX = 90 + groupIndex * Math.max(130, (rect.width - 250) / 3);
    const nodeY = 62 + groupIndex * 58;
    return x >= nodeX && x <= nodeX + 118 && y >= nodeY && y <= nodeY + 34;
  });
  if (index >= 0) { expanded = expanded === index ? -1 : index; draw(rect.width, rect.height); }
});

document.querySelectorAll('[data-view="launch"], [data-view="verify"]').forEach(button => {
  button.addEventListener("click", () => window.parent.location.href = "../index.html?site=archivist-v3#early-access");
});
document.querySelectorAll(".titlemenu button, .window-controls button, [data-mode], #exploreOrderButton").forEach(button => {
  button.addEventListener("click", event => event.preventDefault());
});

shell.inert = false;
splash.hidden = true;
document.querySelector("#emulatorProfiles").innerHTML = emulatorProfiles.map(([system, emulator, profile, command]) =>
  `<tr><td>${system}</td><td>${emulator}</td><td><span class="accent-text">${profile}</span></td><td><code>${command}</code></td></tr>`
).join("");
if (new URLSearchParams(location.search).get("view") === "emulators") {
  document.querySelector("#emulatorsModal").hidden = false;
  document.querySelector("#openEmulators").setAttribute("aria-expanded", "true");
}
new ResizeObserver(sizeCanvas).observe(canvas);
sizeCanvas();
