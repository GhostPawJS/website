# Changelog

All notable changes to this project are documented in this file.
The format is based on Keep a Changelog 1.1.0.

## [Unreleased]

### Added

- MIT license and contributor guidance.
- Packaged dependency verification, including runtime import checks.
- Shared tool definitions with handlers returning outcome summaries, preserving the existing tool exports.
- Markdown parity, CLI parsing, tool integration, analyzer diagnostics, and fitness preview tests.

### Changed

- Replace runtime Markdown and CLI dependencies with local implementations; retain marked only as a development parity oracle.
- Load the HTTP module when starting the development server to reduce library import time.
- Document zero runtime dependencies and the additional tool facade.

## [0.4.2] - 2026-03-29

### Fixed

- Correct deployment templates and production server behavior to honor documented promises.

## [0.4.1] - 2026-03-29

### Fixed

- Resolve CLI lint and type-check errors.

## [0.4.0] - 2026-03-29

### Changed

- Update documentation for the CLI and library interfaces.

## [0.3.0] - 2026-03-29

### Added

- CLI commands for initialization, development, builds, fitness checks, content creation, configuration, deployment setup, and production serving.

## [0.2.1] - 2026-03-29

### Fixed

- Replace directory iteration with a readdir stack to prevent browser demo hangs.

## [0.2.0] - 2026-03-29

### Added

- File-based static site builder, templates, content APIs, and SEO and content fitness checks.
- Browser demo, Italian, Portuguese, and Dutch language kits, incremental builds, and release automation.

### Changed

- Organize documentation and package metadata.

[Unreleased]: https://github.com/GhostPawJS/website/compare/v0.4.2...HEAD
[0.4.2]: https://github.com/GhostPawJS/website/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/GhostPawJS/website/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/GhostPawJS/website/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/GhostPawJS/website/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/GhostPawJS/website/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/GhostPawJS/website/releases/tag/v0.2.0
