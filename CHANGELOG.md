# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-05-10

### Added
- Thermal print support via CUPS with optional print prompt/force/skip modes
- New `--print` and `--no-print` CLI flags for print control
- Configurable receipt width (`receiptWidth`) with CLI override via `--width`
- Per-user HTML export path aligned with org-level receipt output flow

### Changed
- Thermal printing now uses raw text mode for generated text receipts to preserve alignment
- Thermal default media uses driver-supported `X48MMY210MM`
- Added top/bottom print buffer lines to reduce clipping on physical output

### Fixed
- Reduced divergence between terminal receipt layout and physical thermal print output

## [1.0.0] - 2026-05-03

### Added
- `generate` command — print a quirky receipt to the terminal or export as HTML
- `setup` command — interactive wizard to configure org, token, location, and timezone
- `config` command — view, set, or reset configuration values
- Auto-detection of location via offline IP geolocation (`geoip-lite`)
- HTML receipt output saved to `~/.copilot-receipts/receipts/` and opened in browser
- Configuration stored at `~/.copilot-receipts.config.json`
- Support for `GITHUB_TOKEN` / `GH_TOKEN` environment variables
