# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Tests:**
```bash
bin/rails db:test:prepare test           # Unit and integration tests
bin/rails db:test:prepare test:system    # System tests (Capybara/Selenium)
bin/rails test test/models/user_test.rb  # Run a single test file
```

**Linting & Security:**
```bash
bin/rubocop                              # Ruby style linting
bin/brakeman --no-pager                  # Rails security scan
bin/bundler-audit                        # Gem vulnerability audit
```

**Database:**
```bash
bin/rails db:setup                       # Create, migrate, and seed
bin/rails db:seed                        # Re-seed development data
```

## Architecture

**Domain:** A catalog/management app for Japanese doujinshi (self-published fan works). Users browse events (conventions), track booths (vendor tables), and manage personal collections.

**Core entity hierarchy:**
```
Event → Booth → Circle (vendor/publisher)
              → BoothWork (denormalized; title/circle/price stored directly)
User  → Favorite → Booth
      → Collection → Work
```

**Key models with payloads** (not plain join tables):
- `BoothWork` — belongs to `Booth` only (no `work_id`); stores denormalized title, circle, price, quantity, purchase info
- `Favorite` — user's bookmarked booth, stores priority (1-9) and notes
- `CollectionWork`, `CircleWork`, `IncludedWork`, `BookmarkedEvent` — plain join tables

**Authentication & Authorization:**
- Devise handles auth; `ApplicationController` enforces `authenticate_user!` globally
- `PagesController#home` is the only public action (exempted via `skip_before_action`)
- Pundit policies live in `app/policies/`; currently permissive but wired up

**Stack:**
- Rails 8.1 / Ruby 3.3.5 / PostgreSQL
- Hotwire (Turbo + Stimulus) — no heavy JS framework
- Bootstrap 5.3 + SCSS for styling
- Cloudinary for all Active Storage attachments
- Solid Cache/Queue/Cable (database-backed, no Redis needed)

**Generator config** (`config/application.rb`): helpers and assets are disabled by default — don't expect auto-generated helper or asset files.

**Test conventions:** Uses fixtures (not factories). Tests run in parallel. System test screenshots on failure go to `tmp/screenshots/`.

**Rubocop:** Uses `rubocop-rails-omakase` with max line length of 120.

## CI Pipeline

GitHub Actions runs on PRs and pushes to `master`:
1. `scan_ruby` — Brakeman + bundler-audit
2. `scan_js` — importmap audit
3. `lint` — RuboCop
4. `test` — unit/integration tests against PostgreSQL
5. `system-test` — browser automation tests
