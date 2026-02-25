# VTM Chronicle MCP Server

> Give Claude direct access to your World of Darkness chronicles so it can be your Storyteller assistant, look up NPCs mid-session, track plot threads, advance clocks, and more — all from a normal Claude Desktop conversation.

---

## Table of Contents

1. [What Is This?](#what-is-this)
2. [What Is MCP?](#what-is-mcp)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Setup](#step-by-step-setup)
   - [Step 1: Install Node.js](#step-1-install-nodejs)
   - [Step 2: Install the MCP Server](#step-2-install-the-mcp-server)
   - [Step 3: Find Your Claude Desktop Config File](#step-3-find-your-claude-desktop-config-file)
   - [Step 4: Add the Server to Claude Desktop](#step-4-add-the-server-to-claude-desktop)
   - [Step 5: Restart Claude Desktop](#step-5-restart-claude-desktop)
   - [Step 6: Verify It Works](#step-6-verify-it-works)
5. [Getting Your Chronicle Data In](#getting-your-chronicle-data-in)
   - [Option A: Export from the Web App](#option-a-export-from-the-web-app)
   - [Option B: Let Claude Create a Chronicle from Scratch](#option-b-let-claude-create-a-chronicle-from-scratch)
6. [How to Use It (with examples)](#how-to-use-it)
   - [Starting a Session](#starting-a-session)
   - [Looking Up NPCs](#looking-up-npcs)
   - [Tracking Plot Threads](#tracking-plot-threads)
   - [Working with Clocks](#working-with-clocks)
   - [Logging Sessions](#logging-sessions)
   - [Searching Everything](#searching-everything)
   - [Managing Factions & Locations](#managing-factions--locations)
   - [Rumor Board](#rumor-board)
7. [All Available Tools Reference](#all-available-tools-reference)
8. [Where Is My Data Stored?](#where-is-my-data-stored)
9. [Troubleshooting](#troubleshooting)
10. [Tips for Best Results](#tips-for-best-results)

---

## What Is This?

The VTM Chronicle App is a web app for tracking your World of Darkness tabletop RPG campaigns — NPCs, sessions, plot threads, factions, locations, progress clocks, and more.

This **MCP server** is an add-on that lets **Claude Desktop** read and write your chronicle data directly. Instead of copy-pasting NPC notes into chat, you just say *"look up Marcus"* and Claude already has access to everything.

Think of it like giving Claude a direct line to your Storyteller binder.

## What Is MCP?

**MCP (Model Context Protocol)** is a standard that lets Claude Desktop connect to external tools and data sources. It's like plugins, but built into the app.

When you add an MCP server to Claude Desktop:
- Claude gets new **tools** it can use (like "get_npcs" or "advance_clock")
- These tools run locally on your computer
- Claude calls them automatically when relevant to your conversation
- You see a permission prompt the first time Claude uses a tool

**You don't need to understand how MCP works internally.** You just need to install this server and point Claude Desktop at it.

---

## Prerequisites

| What | Why |
|------|-----|
| **Claude Desktop app** | The desktop app (not claude.ai in a browser). Download from [claude.ai/download](https://claude.ai/download) |
| **Node.js v18 or newer** | Runs the MCP server. Check with `node --version` |
| **This repository** | The `mcp-server/` folder from the VTM Chronicle App |

> **Important:** MCP servers only work with the **Claude Desktop application**, not the web version at claude.ai. If you've only used Claude in a browser, you'll need to download and install the desktop app first.

---

## Step-by-Step Setup

### Step 1: Install Node.js

If you don't have Node.js installed:

**Windows:**
1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the green button)
3. Run the installer, click Next through everything
4. Open a new terminal and type `node --version` to verify

**macOS:**
```bash
# If you have Homebrew:
brew install node

# Otherwise, download from nodejs.org
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install nodejs npm

# Or use nvm (recommended):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install --lts
```

Verify it's installed:
```bash
node --version
# Should print v18.x.x or higher
```

---

### Step 2: Install the MCP Server

Open a terminal and navigate to the `mcp-server` folder inside this project:

```bash
cd /path/to/VTM_Chronicle_App/mcp-server
npm install
```

This installs the MCP SDK dependency. You should see output ending with something like `added 1 package`.

**Take note of the full absolute path** to the `mcp-server` folder — you'll need it in the next step. You can get it by running:

```bash
# macOS/Linux
pwd

# Windows (PowerShell)
(Get-Location).Path
```

It will look something like:
- macOS: `/Users/yourname/projects/VTM_Chronicle_App/mcp-server`
- Windows: `C:\Users\yourname\projects\VTM_Chronicle_App\mcp-server`
- Linux: `/home/yourname/projects/VTM_Chronicle_App/mcp-server`

---

### Step 3: Find Your Claude Desktop Config File

Claude Desktop stores its configuration in a JSON file. You need to find and edit it.

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```
Quick way to open it:
```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```
If the file doesn't exist yet, create it.

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```
Quick way to open it — press `Win + R`, type this, and hit Enter:
```
notepad %APPDATA%\Claude\claude_desktop_config.json
```
If the file doesn't exist, Notepad will ask if you want to create it — say Yes.

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

---

### Step 4: Add the Server to Claude Desktop

Open the config file from Step 3 in any text editor. Add the following (or merge it into what's already there):

```json
{
  "mcpServers": {
    "vtm-chronicle": {
      "command": "node",
      "args": ["/FULL/PATH/TO/VTM_Chronicle_App/mcp-server/index.js"]
    }
  }
}
```

**Replace `/FULL/PATH/TO/` with the actual path from Step 2.**

#### Real examples:

**macOS:**
```json
{
  "mcpServers": {
    "vtm-chronicle": {
      "command": "node",
      "args": ["/Users/alex/projects/VTM_Chronicle_App/mcp-server/index.js"]
    }
  }
}
```

**Windows** (note the double backslashes):
```json
{
  "mcpServers": {
    "vtm-chronicle": {
      "command": "node",
      "args": ["C:\\Users\\alex\\projects\\VTM_Chronicle_App\\mcp-server\\index.js"]
    }
  }
}
```

**Linux:**
```json
{
  "mcpServers": {
    "vtm-chronicle": {
      "command": "node",
      "args": ["/home/alex/projects/VTM_Chronicle_App/mcp-server/index.js"]
    }
  }
}
```

#### If you already have other MCP servers configured

Just add `"vtm-chronicle"` alongside the existing ones inside the `"mcpServers"` object:

```json
{
  "mcpServers": {
    "some-other-server": {
      "command": "...",
      "args": ["..."]
    },
    "vtm-chronicle": {
      "command": "node",
      "args": ["/Users/alex/projects/VTM_Chronicle_App/mcp-server/index.js"]
    }
  }
}
```

#### Optional: Custom data directory

By default, the server stores data in `mcp-server/data/`. To use a different location, add an `env` block:

```json
{
  "mcpServers": {
    "vtm-chronicle": {
      "command": "node",
      "args": ["/Users/alex/projects/VTM_Chronicle_App/mcp-server/index.js"],
      "env": {
        "VTM_DATA_DIR": "/Users/alex/Documents/my-chronicles"
      }
    }
  }
}
```

Save the file.

---

### Step 5: Restart Claude Desktop

**Fully quit** Claude Desktop (not just close the window — actually quit the app):

- **macOS:** `Cmd + Q` or Claude menu > Quit Claude
- **Windows:** Right-click the system tray icon > Quit, or `Alt + F4`
- **Linux:** Close all windows and ensure the process is stopped

Then reopen Claude Desktop.

---

### Step 6: Verify It Works

1. Open a new conversation in Claude Desktop
2. Look for a **hammer icon** (🔨) or **tools indicator** near the message input — this shows MCP tools are available
3. Type: **"What chronicles do I have?"**
4. Claude should call the `list_chronicles` tool
5. The first time a tool is called, you'll see a **permission prompt** — click **Allow** (or "Allow for this chat")

If Claude says something like *"You don't have any chronicles yet"*, that's correct! The server is working. See the next section for getting your data in.

**If you don't see the tools indicator**, see [Troubleshooting](#troubleshooting).

---

## Getting Your Chronicle Data In

### Option A: Export from the Web App

If you've been using the VTM Chronicle web app and already have chronicle data:

1. Open the web app
2. Go to your chronicle's **Dashboard** tab
3. Click the **Export** button and choose **JSON**
4. Save the `.json` file
5. Copy or move that file into the MCP server's `data/` folder:
   ```bash
   cp ~/Downloads/my-chronicle-export.json /path/to/mcp-server/data/
   ```
6. **Restart Claude Desktop** (or start a new conversation)
7. The server auto-imports any `.json` export files it finds in the `data/` folder on startup

Now ask Claude: *"What chronicles do I have?"* — your chronicle should appear.

### Option B: Let Claude Create a Chronicle from Scratch

You don't need existing data. Just tell Claude to make one:

> **You:** "Create a new Vampire: The Masquerade chronicle called 'Shadows of Chicago'"
>
> **Claude:** *(calls create_chronicle)* Done! Created "Shadows of Chicago" — a VTM chronicle. It's empty for now. Want me to add some NPCs, factions, or locations to get started?

Then you can populate it through conversation:

> **You:** "Add an NPC — Miriam Blackwood, a Tremere Regent. She's cold and calculating, runs the local chantry, and suspects someone in the coterie is a spy."

---

## How to Use It

Once the server is connected and you have a chronicle, just talk to Claude naturally. It will call the right tools automatically.

### Starting a Session

Start your conversation by orienting Claude to your chronicle:

> **You:** "Let's do a session for Shadows of Chicago. Give me a quick overview of where things stand."
>
> **Claude:** *(calls get_chronicle_overview)* Here's where things stand in Shadows of Chicago...
> - **6 sessions** logged so far
> - **12 NPCs** tracked (3 allies, 2 enemies, 7 contacts)
> - **4 active plot threads**, 1 cold
> - **2 clocks** ticking: "Sabbat Invasion" at 4/8 and "Blood Hunt" at 2/6
> - Last session: "The Warehouse Ambush" — the coterie discovered Sabbat weapons caches...

### Looking Up NPCs

> **You:** "What do we know about Marcus?"
>
> **Claude:** *(calls get_npc, name: "Marcus")* Marcus is a Nosferatu information broker...

> **You:** "Show me all our enemies"
>
> **Claude:** *(calls get_npcs, relationship: "Enemy")* You currently have 3 NPCs marked as enemies...

> **You:** "Who's in the Camarilla?"
>
> **Claude:** *(calls get_npcs, faction: "Camarilla")* Here are the Camarilla-affiliated NPCs...

### Tracking Plot Threads

> **You:** "What plot threads are still active?"
>
> **Claude:** *(calls get_plot_threads, status: "active")* You have 4 active threads...

> **You:** "We just figured out that the missing blood supply is being funneled to the Sabbat. Add that as a clue to the Blood Shortage thread."
>
> **Claude:** *(calls update_plot_thread)* Added a new clue to "Blood Shortage": the missing supply is being funneled to the Sabbat. That thread now has 5 clues total.

> **You:** "Start a new mystery thread — someone's been leaving occult symbols at Elysium."
>
> **Claude:** *(calls add_plot_thread)* Created "Occult Symbols at Elysium" — a new mystery thread.

### Working with Clocks

Progress clocks track slow-burning threats and countdowns:

> **You:** "How's the Sabbat Invasion clock looking?"
>
> **Claude:** *(calls get_clocks)* The Sabbat Invasion clock is at 5/8 segments: `█████░░░`

> **You:** "After tonight's events, advance the Sabbat Invasion clock by 1"
>
> **Claude:** *(calls advance_clock)* Sabbat Invasion advanced to 6/8: `██████░░` — getting close...

> **You:** "Create a new 4-segment countdown clock called 'Ritual of Summoning'"
>
> **Claude:** *(calls add_clock)* Created "Ritual of Summoning" — a 4-segment countdown clock: `░░░░`

### Logging Sessions

After a game session, you can log what happened:

> **You:** "Log tonight's session. Title: 'The Prince's Gambit'. Summary: The coterie was summoned to the Prince's court and given an ultimatum — destroy the Sabbat weapons cache within 3 nights or face a Blood Hunt. They scouted the warehouse district and made contact with a Nosferatu informant named Rattus."
>
> **Claude:** *(calls add_session)* Session 7 logged: "The Prince's Gambit"

You can also paste in a full session log as the `log_text` and Claude will store it.

### Searching Everything

> **You:** "Search the chronicle for anything related to 'blood ritual'"
>
> **Claude:** *(calls search_chronicle)* Found 4 matches for "blood ritual"...

### Managing Factions & Locations

> **You:** "Add the Tremere as a faction. They're Wary toward the coterie, have Significant influence, control the University District, and their goal is to monopolize all blood magic in the city."
>
> **Claude:** *(calls add_faction)* Added the Tremere faction.

> **You:** "Add The Crimson Lounge as a bar location. It's a dimly lit jazz club that serves as unofficial Elysium. Controlled by the Toreador. The atmosphere is smoky and decadent."
>
> **Claude:** *(calls add_location)* Added "The Crimson Lounge" to your locations.

### Rumor Board

The rumor board is for in-world gossip, hearsay, and unconfirmed intel:

> **You:** "Post a rumor: 'Word on the street is the Nosferatu Warrens have a new tunnel connecting to City Hall.'"
>
> **Claude:** *(calls add_rumor)* Rumor posted to the board.

> **You:** "What rumors are floating around?"
>
> **Claude:** *(calls get_rumors)* The rumor board has 3 entries...

---

## All Available Tools Reference

### Read Tools (look things up)

| Tool | What It Does |
|------|-------------|
| `list_chronicles` | List all your chronicles |
| `get_chronicle_overview` | Overview stats, active threads, recent session, clocks |
| `get_npcs` | Get NPCs (optionally filter by relationship, faction, or search) |
| `get_npc` | Get full details on one specific NPC by name |
| `get_sessions` | Get session list, or one specific session's full details |
| `get_characters` | Get player characters |
| `get_factions` | Get all factions |
| `get_locations` | Get all locations |
| `get_plot_threads` | Get plot threads (filter by status: active/cold/resolved/all) |
| `get_clocks` | Get all progress clocks with visual fill bars |
| `get_timeline` | Get story beats grouped by session |
| `get_rumors` | Get the rumor board |
| `search_chronicle` | Full-text search across everything |

### Write Tools (change things)

| Tool | What It Does |
|------|-------------|
| `create_chronicle` | Create a new empty chronicle |
| `add_npc` | Add a new NPC |
| `update_npc` | Update an existing NPC (personality, backstory, etc. get appended, not replaced) |
| `add_session` | Log a new session with summary, story beats, mood |
| `add_story_beat` | Add a story beat to the timeline |
| `add_plot_thread` | Create a new plot thread |
| `update_plot_thread` | Add clues, change status (active/cold/resolved) |
| `add_clock` | Create a new progress clock (3-12 segments) |
| `advance_clock` | Move a clock forward or backward |
| `add_rumor` | Post a rumor to the board |
| `add_faction` | Add a new faction |
| `add_location` | Add a new location |
| `import_chronicle_json` | Import a JSON export from the web app |

---

## Where Is My Data Stored?

All chronicle data is stored as plain JSON files in the `data/` directory:

```
mcp-server/
  data/
    chronicles.json              <-- list of all chronicles
    chronicles/
      chr-1708123456789.json     <-- full data for each chronicle
      chr-1708123456790.json
```

- Data never leaves your computer
- No cloud sync, no external APIs
- You can back up the `data/` folder at any time
- Files are human-readable JSON (pretty-printed)

---

## Troubleshooting

### "I don't see the tools/hammer icon in Claude Desktop"

1. **Did you save the config file?** Double-check `claude_desktop_config.json`
2. **Is the path correct?** The path in `args` must be the **full absolute path** to `index.js` — no `~`, no relative paths
3. **Did you fully restart Claude Desktop?** Just closing the window isn't enough — actually Quit the app
4. **Is Node.js installed?** Run `node --version` in a terminal. Must be v18+
5. **Did you run `npm install`?** The server won't start without its dependencies

### "Claude says it can't find any chronicles"

That's normal if you haven't imported data yet. See [Getting Your Chronicle Data In](#getting-your-chronicle-data-in).

### "Permission denied" or "EACCES" errors

The server needs read/write access to the `data/` directory. Make sure:
```bash
# Check the data directory exists and is writable
ls -la /path/to/mcp-server/data/

# If needed, fix permissions
chmod 755 /path/to/mcp-server/data/
```

### "The server keeps disconnecting"

Check Claude Desktop's MCP logs:
- **macOS:** `~/Library/Logs/Claude/mcp*.log`
- **Windows:** `%APPDATA%\Claude\logs\mcp*.log`

Common causes:
- Syntax error in `claude_desktop_config.json` (missing comma, extra comma, etc.)
- Wrong Node.js version
- `npm install` wasn't run

### "Claude isn't calling the tools automatically"

Try being more explicit: *"Use the vtm-chronicle tools to look up my NPCs"*. Once Claude knows the tools are available, it typically starts using them proactively.

You can also start your conversation with a system-setting message like:

> "You are my World of Darkness Storyteller assistant. You have access to my chronicle via MCP tools. Always use them to look up and update chronicle data when relevant."

### Checking server logs manually

You can test the server runs correctly by itself:
```bash
cd /path/to/mcp-server
node index.js
```

If it starts without errors, you should see:
```
[vtm-chronicle-mcp] Started. Data dir: /path/to/data
```

Press `Ctrl+C` to stop it. (It will sit there waiting for MCP messages — that's normal.)

### Windows: "node" is not recognized

Node.js might not be in your PATH. Try using the full path to node:
```json
{
  "mcpServers": {
    "vtm-chronicle": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\Users\\alex\\projects\\VTM_Chronicle_App\\mcp-server\\index.js"]
    }
  }
}
```

---

## Tips for Best Results

### Set the scene at the start of each conversation

Claude Desktop doesn't carry context between conversations. At the start of each chat, orient Claude:

> "Load up my Shadows of Chicago chronicle. I'm about to run Session 8. Remind me what happened last time and what threads are active."

### Use a Project with custom instructions (optional but powerful)

In Claude Desktop, you can create a **Project** and add custom instructions. This means Claude will always know to use your chronicle tools without being told. Example instructions:

```
You are my World of Darkness Storyteller assistant for a Vampire: The Masquerade
chronicle called "Shadows of Chicago".

You have access to my chronicle data via MCP tools (vtm-chronicle server).
Always use these tools to:
- Look up NPCs, factions, and locations before answering questions about them
- Track any new information that comes up during our sessions
- Update plot threads when we discover new clues
- Advance clocks when events warrant it

My chronicle ID is: chr-1708123456789

Stay in-character as a knowledgeable WoD narrator. Reference actual chronicle
data in your responses.
```

### Let Claude manage your data during play

During a session, you can say things like:

> "We just met a new Malkavian named Oracle at the park. She seemed friendly but cryptic. She told us the Tremere are planning something with the ley lines. Track all of this."

Claude will typically:
1. Add Oracle as a new NPC
2. Add a clue to any relevant plot thread
3. Maybe post a rumor

### Back up your data

The `data/` folder is your entire chronicle database. Back it up however you like:
```bash
cp -r mcp-server/data/ ~/Backups/vtm-chronicles-backup/
```

### Data syncs with the web app (manually)

The MCP server and web app use the same data format. To sync:
- **Web app → MCP:** Export JSON from web app, drop in `data/` folder, restart Claude Desktop
- **MCP → Web app:** Import the chronicle JSON file from `data/chronicles/` into the web app

---

## Supported Game Lines

| Game Line | Code | Accent Color |
|-----------|------|-------------|
| Vampire: The Masquerade | `vtm` | Red |
| Mage: The Ascension | `mta` | Purple |
| Werewolf: The Apocalypse | `wta` | Green |
| Wraith: The Oblivion | `wto` | Blue |
| Hunter: The Reckoning | `htr` | Gold |
| Changeling: The Dreaming | `ctd` | Blue-Purple |
| Mixed Chronicle | `mixed` | Gray |

---

## Quick Reference Card

```
"What chronicles do I have?"           → lists all chronicles
"Overview of [chronicle]"              → stats, active threads, clocks
"Who is [NPC name]?"                   → detailed NPC lookup
"Show me all enemies"                  → NPCs filtered by relationship
"What threads are active?"             → active plot threads
"Add a clue to [thread]: [info]"       → updates a thread with new clue
"Advance the [clock name] clock"       → fills one segment
"Log a session: [details]"             → records a new session
"Search for [keyword]"                 → full-text search
"Add NPC: [details]"                   → creates a new NPC
"Post a rumor: [text]"                 → adds to the rumor board
"What's on the rumor board?"           → shows all rumors
"Create a clock: [name], [segments]"   → new progress clock
```
