window.__ARCHIVIST_INITIAL_OPEN_NODES = [
  "computers",
  "computers-home-computer",
  "computers-home-computer-1977-trinity"
];
window.__ARCHIVIST_FIT_INITIAL_VIEW = true;
window.__ARCHIVIST_INITIAL_TIMELINE_WINDOW = { min: 1962, max: 2036 };
window.__ARCHIVIST_INITIAL_SELECTED_NODE = "apple-ii";
window.__ARCHIVIST_INITIAL_FRAME_NODES = [
  "computers-home-computer",
  "computers-home-computer-1977-trinity",
  "apple-ii",
  "commodore-pet",
  "trs-80-model-i"
];

const mockSystems = [
  ["magnavox-odyssey", "Magnavox Odyssey", 1972, "Console", "First generation", "Magnavox", 28, "MAME"],
  ["atari-2600", "Atari 2600", 1977, "Console", "Second generation", "Atari", 524, "Stella"],
  ["coleco-colecovision", "ColecoVision", 1982, "Console", "Third generation", "Coleco", 146, "Gearcoleco"],
  ["sega-mega-drive", "Sega Mega Drive / Genesis", 1988, "Console", "Fourth generation", "Sega", 878, "BlastEm"],
  ["sony-playstation", "Sony PlayStation", 1994, "Console", "Fifth generation", "Sony", 4105, "DuckStation"],
  ["atari-jaguar", "Atari Jaguar", 1993, "Console", "Fifth generation", "Atari", 54, "BigPEmu"],
  ["sega-dreamcast", "Sega Dreamcast", 1998, "Console", "Sixth generation", "Sega", 624, "Flycast"],
  ["sony-playstation-2", "Sony PlayStation 2", 2000, "Console", "Sixth generation", "Sony", 4376, "PCSX2"],
  ["atari-lynx", "Atari Lynx", 1989, "Handheld", "Fourth generation handheld", "Atari", 143, "Mednafen"],
  ["sony-psp", "Sony PlayStation Portable", 2004, "Portable console", "Seventh generation handheld", "Sony", 1924, "PPSSPP"],
  ["ibm-system-360", "IBM System/360", 1964, "Mainframe computer", "Computer mainframe", "IBM", 94, "MAME"],
  ["dec-pdp-8", "DEC PDP-8", 1965, "Minicomputer", "Computer minicomputer", "Digital Equipment Corporation", 138, "SIMH"],
  ["dec-pdp-11", "DEC PDP-11", 1970, "Minicomputer", "Computer minicomputer", "Digital Equipment Corporation", 212, "SIMH"],
  ["altair-8800", "Altair 8800", 1975, "Microcomputer", "Early microcomputer", "MITS", 86, "MAME"],
  ["kim-1", "KIM-1", 1976, "Single-board computer", "Single-board computer", "MOS Technology", 42, "MAME"],
  ["apple-ii", "Apple II", 1977, "Home computer", "1977 Trinity", "Apple", 1268, "MAME", 6000000],
  ["commodore-pet", "Commodore PET", 1977, "Home computer", "1977 Trinity", "Commodore", 612, "VICE"],
  ["trs-80-model-i", "TRS-80 Model I", 1977, "Home computer", "1977 Trinity", "Tandy / Radio Shack", 884, "MAME"],
  ["atari-800", "Atari 800", 1979, "Home computer", "8-bit computer era", "Atari", 1180, "Atari800"],
  ["bbc-micro", "BBC Micro", 1981, "Home computer", "8-bit computer era", "Acorn", 740, "MAME"],
  ["commodore-64", "Commodore 64", 1982, "Home computer", "8-bit computer era", "Commodore", 3284, "VICE"],
  ["zx-spectrum", "ZX Spectrum", 1982, "Home computer", "8-bit computer era", "Sinclair", 2440, "Fuse"],
  ["apple-ii-language-card", "Apple II Language Card", 1979, "Home computer add-on", "8-bit computer add-on era", "Apple", 54, "MAME"],
  ["commodore-amiga", "Commodore Amiga", 1985, "Home computer", "16-bit computer era", "Commodore", 2140, "FS-UAE"],
  ["atari-st", "Atari ST", 1985, "Home computer", "16-bit computer era", "Atari", 1710, "Hatari"],
  ["ibm-pc", "IBM PC", 1981, "Desktop computer", "PC clone era", "IBM", 6821, "DOSBox Pure"],
  ["compaq-portable", "Compaq Portable", 1983, "Desktop computer", "PC clone era", "Compaq", 1320, "DOSBox Pure"],
  ["acorn-archimedes", "Acorn Archimedes", 1987, "Home computer", "32-bit computer era", "Acorn", 834, "Arculator"],
  ["next-computer", "NeXT Computer", 1988, "Home computer", "32-bit computer era", "NeXT", 428, "Previous"],
  ["zx-spectrum-next", "ZX Spectrum Next", 2017, "Home computer", "Modern retro computer", "SpecNext", 284, "MAME"],
  ["commander-x16", "Commander X16", 2024, "Home computer", "Modern retro computer", "Commander X16", 116, "X16 Emulator"],
  ["arcade", "Arcade", 1971, "Arcade cabinet", "Fixed-function device", "Various", 11642, "MAME"],
].map(([id, name, year, kind, era, manufacturer, gameCount, emulator, unitsSold]) => ({
  id, slug: id, name, year, kind, era, manufacturer, gameCount, unitsSold, emulators: [emulator], enabledEmulators: [emulator]
}));

const mockEmulatorProfiles = window.ARCHIVIST_EMULATOR_PROFILES || mockSystems.map(system => ({
  system: system.name,
  emulator: system.emulators[0],
  profile: "Default",
  command: `${system.emulators[0].toLowerCase().replaceAll(" ", "-")} {game}`,
  preferred: true,
  installed: true,
  requirement: system.emulators[0].toLowerCase().replaceAll(" ", "-")
}));

const mockResponses = {
  systems: mockSystems,
  vault_files: [],
  emulator_profiles: mockEmulatorProfiles,
  selection: { titles: [], manifests: [] },
  manifest_sources: [],
  bios_sets: [],
  launch_on_startup_enabled: false,
  app_version: "demo",
};

window.__TAURI__ = {
  core: {
    invoke(command) {
      return Promise.resolve(mockResponses[command] ?? null);
    }
  }
};
