# Changelog

All notable changes to EventKit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial public release of EventKit
- Type-safe AWS EventBridge patterns from Zod schemas
- Universal compatibility with AWS SDK, CDK, Terraform, SST
- Complete AWS EventBridge operator support
- AWS Schema Registry integration
- SST infrastructure helpers
- Cross-workspace event usage with lazy bus pattern
- Standalone npm package support with environment variables
- Comprehensive documentation and examples

### Changed
- Migrated from private monorepo to public standalone package
- Made SST dependencies optional for standalone usage

### Fixed
- Bus initialization now works in both SST and standalone contexts
- Environment variable fallback for non-SST usage

## [1.0.0] - 2025-09-18

### Added
- Initial stable release
- Core Event class with type-safe pattern generation
- Bus class for EventBridge publishing
- Event handler creation utilities
- CLI tools for schema registration and syncing
- SST infrastructure utilities
- Complete EventBridge operator type definitions
- Schema registry integration
- Pattern generation for single and multiple events