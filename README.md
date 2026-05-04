# copilot-receipts

Generate quirky, shareable receipts for your GitHub Copilot usage — with per-model pricing breakdowns. Inspired by [claude-receipts](https://github.com/chrishutchinson/claude-receipts).

```
  ●  GitHub Copilot  ●
  ╔═══════════════╗
  ║  < / >        ║
  ╚═══════════════╝

      Location: San Francisco, CA
        User: jane-doe
           Org: my-org
         2026-05-02 (Saturday)

════════════════════════════════════════
Claude-sonnet-4.6                  $1.24
────────────────────────────────────────
Interactions                          42
Code generations                      35
Acceptances                           28
Input tokens                     136,500
Output tokens                     40,600
Lines added                          310
Lines deleted                         85

════════════════════════════════════════
Gpt-5.3-codex                     $0.89
────────────────────────────────────────
Interactions                          20
Code generations                      15
Acceptances                           12
Input tokens                      62,500
Output tokens                     24,020
Lines added                          180
Lines deleted                         42

════════════════════════════════════════
TOTAL                              $2.13
════════════════════════════════════════

        CASHIER: GitHub Copilot

        Thank you for building!
      github.com/features/copilot

════════════════════════════════════════
```

## Installation

```bash
npx copilot-receipts setup
```

This will:
- Prompt for your GitHub organization name
- Prompt for a GitHub token
- Store configuration at `~/.copilot-receipts.config.json`

## Requirements

- Node.js >= 20.0.0
- A GitHub organization with **GitHub Copilot Business** or **GitHub Copilot Enterprise** enabled
- A GitHub token with `read:org` or `manage_billing:copilot` scope
- For enterprise reports: a token with `enterprise:read` scope

> **Note:** GitHub Copilot's usage API is only available at the organization/enterprise level (not individual accounts).

## Commands

### `generate`

Generate a receipt for your organization's GitHub Copilot usage.

```bash
# Org-level receipt (most recent day)
npx copilot-receipts generate

# Specific date
npx copilot-receipts generate --date 2026-05-02

# Per-user receipt with pricing breakdown
npx copilot-receipts generate --user jane-doe --date 2026-05-02

# Enterprise mode
npx copilot-receipts generate --enterprise my-enterprise --date 2026-05-02

# HTML output
npx copilot-receipts generate --output html

# Override org and token inline
npx copilot-receipts generate --org my-org --token ghp_...
```

**Options:**

- `-d, --date <YYYY-MM-DD>` — Specific date to generate a receipt for (defaults to most recent)
- `-o, --output <format>` — Output format: `console` (default) or `html` (supports multiple, comma-separated)
- `-l, --location <text>` — Override location detection
- `--org <name>` — GitHub organization name (overrides config)
- `--enterprise <slug>` — GitHub Enterprise slug (uses enterprise API endpoint)
- `--user <login>` — Generate a receipt for a specific user (with per-model pricing)
- `--token <token>` — GitHub token (overrides config and `GITHUB_TOKEN` env var)

### `setup`

Interactive wizard to configure copilot-receipts.

```bash
# Run interactive setup
npx copilot-receipts setup

# Clear stored configuration
npx copilot-receipts setup --uninstall
```

### `config`

Manage configuration values.

```bash
# Show current configuration
npx copilot-receipts config --show

# Set a value
npx copilot-receipts config --set org=my-org
npx copilot-receipts config --set token=ghp_...
npx copilot-receipts config --set location="San Francisco, CA"
npx copilot-receipts config --set timezone="America/Los_Angeles"

# Reset to defaults
npx copilot-receipts config --reset
```

**Available settings:**

| Key          | Description                                      |
|--------------|--------------------------------------------------|
| `org`        | GitHub organization name                         |
| `enterprise` | GitHub Enterprise slug                           |
| `token`      | GitHub personal access token                     |
| `location`   | Default location string (otherwise auto-detected) |
| `timezone`   | Timezone for date formatting (e.g. `America/New_York`) |

## Configuration

Configuration is stored at `~/.copilot-receipts.config.json`.

```json
{
  "version": "1.0.0",
  "org": "my-org",
  "token": "ghp_...",
  "location": "San Francisco, CA",
  "timezone": "America/Los_Angeles"
}
```

The token can also be provided via the `GITHUB_TOKEN` or `GH_TOKEN` environment variable.

## Automated Daily Receipts

Since GitHub Copilot doesn't have a "session end" hook, you can schedule daily receipt generation with a cron job:

```bash
# Open crontab
crontab -e

# Run every day at 6pm and save HTML
0 18 * * * npx copilot-receipts generate --output html
```

Or add it to a CI/CD pipeline to send receipts to your team.

## How It Works

1. **GitHub API**: Calls the Copilot metrics/reports API at the org or enterprise level
2. **Per-User Data**: When `--user` is specified, fetches per-user daily reports and calculates estimated costs using [GitHub Copilot model pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)
3. **Receipt Generation**: Formats data into a terminal receipt or styled HTML page with per-model cost breakdowns
4. **Location Detection**: Auto-detects your location via IP geolocation (offline, using geoip-lite), or uses your configured location
5. **HTML Output**: Saves a styled receipt to `~/.copilot-receipts/receipts/` and opens it in your browser

## License

MIT
