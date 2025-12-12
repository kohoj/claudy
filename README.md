# Claudy

Claude Code Workspace Manager - Launch Claude with pre-configured workspaces.

```
 ▐▛███▜▌  ▐▛███▜▌  ▐▛███▜▌
▝▜█████▛▘▝▜█████▛▘▝▜█████▛▘
  ▘▘ ▝▝    ▘▘ ▝▝    ▘▘ ▝▝
```

## Features

- Save and manage multiple Claude Code workspaces
- Quick launch with pre-configured working directories
- Support for additional directories (`--add-dir`)
- Interactive TUI for workspace selection
- CLI commands for automation

## Requirements

- [Bun](https://bun.sh) >= 1.0.0
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed

## Installation

```bash
bun add -g @koho/claudy
```

## Usage

### Interactive Mode

Simply run `claudy` to open the interactive workspace selector:

```bash
claudy
```

### Add a Workspace

```bash
# Add current directory interactively
claudy add

# Add current directory with a name
claudy add myapp

# Add a specific directory
claudy add myapp ~/projects/myapp

# Add with additional directories
claudy add myapp ~/projects/myapp ~/projects/shared-lib
```

### Launch a Workspace

```bash
claudy myapp
```

### Manage Workspaces

```bash
# List all workspaces
claudy ls

# Edit a workspace
claudy edit myapp

# Delete a workspace
claudy rm myapp
```

## Commands

| Command | Description |
|---------|-------------|
| `claudy` | Interactive workspace selector |
| `claudy <name>` | Launch workspace directly |
| `claudy add [name] [cwd] [dirs...]` | Add a new workspace |
| `claudy edit [name]` | Edit an existing workspace |
| `claudy rm [name]` | Remove a workspace |
| `claudy ls` | List all workspaces |
| `claudy help` | Show help |
| `claudy --version` | Show version |

## Configuration

Workspaces are stored in `~/.config/claudy/workspaces.json`:

```json
{
  "workspaces": [
    {
      "name": "myapp",
      "description": "My awesome app",
      "cwd": "/path/to/myapp",
      "addDirs": ["/path/to/shared-lib"]
    }
  ]
}
```

## How It Works

Claudy is a wrapper around Claude Code that:

1. Stores workspace configurations (working directory + additional directories)
2. Launches Claude Code with the correct `cwd` and `--add-dir` flags
3. Provides a nice TUI for selecting workspaces

When you run `claudy myapp`, it executes:

```bash
cd /path/to/myapp && claude --add-dir /path/to/shared-lib
```

## License

MIT
