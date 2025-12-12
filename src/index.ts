#!/usr/bin/env bun

import { createSelection, createPrompt } from "bun-promptx";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join, basename, resolve } from "path";

// ═══════════════════════════════════════════════════════════════
// Claudy - Claude Code Workspace Manager
// ═══════════════════════════════════════════════════════════════

const VERSION = "1.0.0";

interface Workspace {
  name: string;
  description: string;
  cwd: string;
  addDirs?: string[];
}

interface Config {
  workspaces: Workspace[];
}

const CONFIG_DIR = join(homedir(), ".config", "claudy");
const CONFIG_FILE = join(CONFIG_DIR, "workspaces.json");

// ─────────────────────────────────────────────────────────────────
// Logo
// ─────────────────────────────────────────────────────────────────

const LOGO = `
\x1b[38;5;27m ▐▛███▜▌ \x1b[38;5;39m ▐▛███▜▌ \x1b[38;5;117m ▐▛███▜▌
\x1b[38;5;27m▝▜█████▛▘\x1b[38;5;39m▝▜█████▛▘\x1b[38;5;117m▝▜█████▛▘
\x1b[38;5;27m  ▘▘ ▝▝  \x1b[38;5;39m  ▘▘ ▝▝  \x1b[38;5;117m  ▘▘ ▝▝\x1b[0m
\x1b[2mClaude Code Workspace Manager\x1b[0m
`;

// ─────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────

const load = (): Config => {
  if (!existsSync(CONFIG_FILE)) return { workspaces: [] };
  try {
    const data = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    if (!Array.isArray(data?.workspaces)) return { workspaces: [] };
    return data;
  } catch {
    console.error(`\x1b[33m⚠️  Config corrupted, starting fresh\x1b[0m`);
    return { workspaces: [] };
  }
};

const save = (c: Config): void => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2) + "\n");
};

const prompt = (msg: string): string | null => {
  const r = createPrompt(msg);
  return r.value === undefined || r.value === null ? null : r.value.trim();
};

const select = <T extends { text: string }>(opts: T[], header: string): number | null => {
  if (opts.length === 0) return null;
  const r = createSelection(opts, { headerText: header, perPage: 10 });
  return r.error || r.selectedIndex === undefined || r.selectedIndex < 0 ? null : r.selectedIndex;
};

const resolvePath = (s: string): string => {
  if (!s) return process.cwd();
  return s.startsWith("~") ? join(homedir(), s.slice(1)) : resolve(s);
};

const exists = (p: string): boolean => existsSync(p);

const findByName = (c: Config, n: string): Workspace | undefined =>
  c.workspaces.find((w) => w.name.toLowerCase() === n.toLowerCase());

const findByCwd = (c: Config, p: string): Workspace | undefined =>
  c.workspaces.find((w) => w.cwd === p);

const print = (w: Workspace, indent = ""): void => {
  console.log(`${indent}${w.name} - ${w.description}`);
  console.log(`${indent}  📁 ${w.cwd}`);
  w.addDirs?.forEach((d) => console.log(`${indent}  📂 ${d}`));
};

const die = (msg: string): never => {
  console.error(`\n\x1b[31m✗ ${msg}\x1b[0m\n`);
  process.exit(1);
};

const ok = (msg: string): void => {
  console.log(`\n\x1b[32m✓ ${msg}\x1b[0m\n`);
};

// ─────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────

/**
 * claudy add [name] [cwd] [addDirs...]
 * - No args: interactive mode, uses current directory
 * - With args: CLI mode with validation
 */
function cmdAdd(args: string[]): void {
  const config = load();
  const isInteractive = args.length === 0;

  const cwd = resolvePath(args[1] ?? "");
  const name = args[0] || basename(cwd);
  const addDirs = args.slice(2).map(resolvePath).filter((d) => d !== cwd);

  // Validate
  if (!exists(cwd)) die(`Directory not found: ${cwd}`);
  if (findByName(config, name)) die(`Workspace "${name}" already exists`);
  if (findByCwd(config, cwd)) die(`Directory already registered as "${findByCwd(config, cwd)!.name}"`);
  for (const d of addDirs) {
    if (!exists(d)) die(`Directory not found: ${d}`);
  }

  // Deduplicate addDirs
  const uniqueAddDirs = [...new Set(addDirs)];

  // Interactive description
  let desc = name;
  if (isInteractive) {
    console.log(`\n📁 ${cwd}\n`);
    const input = prompt(`  Description [${name}]: `);
    if (input === null) return;
    desc = input || name;
  }

  const ws: Workspace = {
    name,
    description: desc,
    cwd,
    ...(uniqueAddDirs.length > 0 && { addDirs: uniqueAddDirs }),
  };

  // Preview & confirm
  console.log();
  print(ws, "  ");
  const confirmIdx = select([{ text: "Save" }, { text: "Cancel" }], "\n  Confirm?");
  if (confirmIdx !== 0) return;

  config.workspaces.push(ws);
  save(config);
  ok(`Added "${name}"`);
}

/**
 * claudy rm [name]
 */
function cmdRm(args: string[]): void {
  const config = load();
  if (config.workspaces.length === 0) die("No workspaces configured");

  let idx: number;
  if (args[0]) {
    idx = config.workspaces.findIndex((w) => w.name.toLowerCase() === args[0].toLowerCase());
    if (idx < 0) die(`Workspace "${args[0]}" not found`);
  } else {
    const i = select(
      config.workspaces.map((w) => ({ text: w.name, description: w.cwd })),
      "🗑️  Select workspace to delete:"
    );
    if (i === null) return;
    idx = i;
  }

  const ws = config.workspaces[idx];

  // Confirm for interactive mode
  if (!args[0]) {
    const confirmIdx = select([{ text: "Delete" }, { text: "Cancel" }], `\n  Delete "${ws.name}"?`);
    if (confirmIdx !== 0) return;
  }

  config.workspaces.splice(idx, 1);
  save(config);
  ok(`Deleted "${ws.name}"`);
}

/**
 * claudy edit [name]
 */
function cmdEdit(args: string[]): void {
  const config = load();
  if (config.workspaces.length === 0) die("No workspaces configured");

  let idx: number;
  if (args[0]) {
    idx = config.workspaces.findIndex((w) => w.name.toLowerCase() === args[0].toLowerCase());
    if (idx < 0) die(`Workspace "${args[0]}" not found`);
  } else {
    const i = select(
      config.workspaces.map((w) => ({ text: w.name, description: w.cwd })),
      "✏️  Select workspace to edit:"
    );
    if (i === null) return;
    idx = i;
  }

  const ws = config.workspaces[idx];

  const editLoop = (): void => {
    const field = select(
      [
        { text: "Name", description: ws.name },
        { text: "Description", description: ws.description },
        { text: "Working dir", description: ws.cwd },
        { text: "Additional dirs", description: ws.addDirs?.length ? `${ws.addDirs.length} configured` : "(none)" },
        { text: "Done", description: "Save and exit" },
      ],
      `\n✏️  Editing "${ws.name}":`
    );

    if (field === null || field === 4) return;

    switch (field) {
      case 0: {
        const v = prompt(`  New name [${ws.name}]: `);
        if (v && v !== ws.name) {
          if (findByName(config, v)) {
            console.log(`  \x1b[33m⚠️  "${v}" already exists\x1b[0m`);
          } else {
            ws.name = v;
            save(config);
          }
        }
        break;
      }
      case 1: {
        const v = prompt(`  New description [${ws.description}]: `);
        if (v) {
          ws.description = v;
          save(config);
        }
        break;
      }
      case 2: {
        const v = prompt(`  New working dir [${ws.cwd}]: `);
        if (v) {
          const p = resolvePath(v);
          if (!exists(p)) {
            console.log(`  \x1b[33m⚠️  Not found: ${p}\x1b[0m`);
          } else if (findByCwd(config, p) && findByCwd(config, p)!.name !== ws.name) {
            console.log(`  \x1b[33m⚠️  Already used by "${findByCwd(config, p)!.name}"\x1b[0m`);
          } else {
            ws.cwd = p;
            // Remove any addDirs that match the new cwd
            if (ws.addDirs) {
              ws.addDirs = ws.addDirs.filter((d) => d !== p);
              if (ws.addDirs.length === 0) delete ws.addDirs;
            }
            save(config);
          }
        }
        break;
      }
      case 3: {
        const action = select(
          [
            { text: "Add", description: "Add a directory" },
            { text: "Remove", description: "Remove a directory" },
            { text: "Clear", description: "Remove all" },
            { text: "Back", description: "" },
          ],
          "  Additional directories:"
        );

        if (action === 0) {
          const v = prompt("  Path: ");
          if (v) {
            const p = resolvePath(v);
            if (!exists(p)) {
              console.log(`  \x1b[33m⚠️  Not found\x1b[0m`);
            } else if (p === ws.cwd) {
              console.log(`  \x1b[33m⚠️  Same as working directory\x1b[0m`);
            } else if (ws.addDirs?.includes(p)) {
              console.log(`  \x1b[33m⚠️  Already added\x1b[0m`);
            } else {
              (ws.addDirs ??= []).push(p);
              save(config);
              console.log(`  \x1b[32m✓ Added\x1b[0m`);
            }
          }
        } else if (action === 1) {
          if (!ws.addDirs?.length) {
            console.log(`  \x1b[33m⚠️  No directories to remove\x1b[0m`);
          } else {
            const di = select(
              ws.addDirs.map((d) => ({ text: basename(d), description: d })),
              "  Select to remove:"
            );
            if (di !== null) {
              ws.addDirs.splice(di, 1);
              if (ws.addDirs.length === 0) delete ws.addDirs;
              save(config);
              console.log(`  \x1b[32m✓ Removed\x1b[0m`);
            }
          }
        } else if (action === 2) {
          if (ws.addDirs?.length) {
            delete ws.addDirs;
            save(config);
            console.log(`  \x1b[32m✓ Cleared all\x1b[0m`);
          }
        }
        break;
      }
    }

    editLoop();
  };

  editLoop();
}

/**
 * claudy ls
 */
function cmdLs(): void {
  const { workspaces } = load();
  if (workspaces.length === 0) {
    console.log("\n📭 No workspaces configured");
    console.log(`   Run \x1b[36mclaudy add\x1b[0m to create one\n`);
    return;
  }
  console.log();
  workspaces.forEach((w) => {
    print(w, "  ");
    console.log();
  });
}

/**
 * claudy [name] - Main launcher
 */
async function cmdLaunch(name?: string): Promise<void> {
  const config = load();

  // Direct launch by name
  if (name) {
    const ws = findByName(config, name);
    if (!ws) die(`Workspace "${name}" not found`);
    return launch(ws);
  }

  // No workspaces - welcome screen
  if (config.workspaces.length === 0) {
    console.log(LOGO);
    console.log("  No workspaces configured yet.\n");
    const i = select(
      [
        { text: "Add workspace", description: "Add current directory" },
        { text: "Launch Claude", description: "Without workspace" },
      ],
      "  What would you like to do?"
    );
    if (i === 0) cmdAdd([]);
    else if (i === 1) await launch();
    return;
  }

  // Workspace selector
  const opts = [
    ...config.workspaces.map((w) => ({ text: w.name, description: w.description })),
    { text: "Claude", description: "Launch without workspace" },
    { text: "Manage", description: "Add, edit, delete" },
  ];

  console.log(LOGO);
  const i = select(opts, "");
  if (i === null) return;

  const wsCount = config.workspaces.length;
  if (i < wsCount) {
    await launch(config.workspaces[i]);
  } else if (i === wsCount) {
    await launch();
  } else if (i === wsCount + 1) {
    const a = select(
      [
        { text: "Add", description: "Add new workspace" },
        { text: "Edit", description: "Edit workspace" },
        { text: "Delete", description: "Delete workspace" },
        { text: "List", description: "List all workspaces" },
      ],
      "⚙️  Manage workspaces:"
    );
    if (a === 0) cmdAdd([]);
    else if (a === 1) cmdEdit([]);
    else if (a === 2) cmdRm([]);
    else if (a === 3) cmdLs();
  }
}

/**
 * Launch Claude with optional workspace
 */
async function launch(ws?: Workspace): Promise<never> {
  if (!ws) {
    console.log("\n✨ Launching Claude...\n");
    const p = Bun.spawn(["claude"], { stdio: ["inherit", "inherit", "inherit"] });
    await p.exited;
    process.exit(p.exitCode ?? 0);
  }

  // Validate paths
  if (!exists(ws.cwd)) die(`Working directory not found: ${ws.cwd}`);
  for (const d of ws.addDirs ?? []) {
    if (!exists(d)) die(`Additional directory not found: ${d}`);
  }

  console.log(`\n✨ Launching ${ws.name}...\n`);
  print(ws, "   ");
  console.log();

  const args = ["claude", ...(ws.addDirs ?? []).flatMap((d) => ["--add-dir", d])];
  const p = Bun.spawn(args, { cwd: ws.cwd, stdio: ["inherit", "inherit", "inherit"] });
  await p.exited;
  process.exit(p.exitCode ?? 0);
}

/**
 * Show help
 */
function showHelp(): void {
  console.log(`
\x1b[1mClaudy\x1b[0m v${VERSION} - Claude Code Workspace Manager

\x1b[1mUSAGE\x1b[0m
  claudy                      Interactive workspace selector
  claudy <name>               Launch workspace directly
  claudy add [name] [cwd] [dirs...]
                              Add workspace (interactive if no args)
  claudy edit [name]          Edit workspace
  claudy rm [name]            Remove workspace
  claudy ls                   List all workspaces

\x1b[1mEXAMPLES\x1b[0m
  claudy add                  Add current directory interactively
  claudy add myapp            Add current dir as "myapp"
  claudy add myapp ~/proj     Add ~/proj as "myapp"
  claudy add myapp ~/proj ~/lib
                              Add with additional directory
  claudy myapp                Launch "myapp" workspace

\x1b[1mCONFIG\x1b[0m
  ~/.config/claudy/workspaces.json
`);
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "add":
  case "init":
    cmdAdd(args);
    break;
  case "rm":
  case "delete":
    cmdRm(args);
    break;
  case "edit":
    cmdEdit(args);
    break;
  case "ls":
  case "list":
    cmdLs();
    break;
  case "help":
  case "-h":
  case "--help":
    showHelp();
    break;
  case "-v":
  case "--version":
    console.log(`claudy v${VERSION}`);
    break;
  default:
    cmdLaunch(cmd);
}
