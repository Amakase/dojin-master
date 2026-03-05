# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start development server
bin/dev

# Run all tests
bin/rails test

# Run a single test file
bin/rails test test/models/booth_test.rb

# Run system tests
bin/rails test:system

# Lint
bin/rubocop

# Security scans (run in CI)
bin/brakeman --no-pager
bin/bundler-audit
bin/importmap audit

# Database
bin/rails db:migrate
bin/rails db:seed
```

## Architecture

Rails 8.1 app for planning attendance at dojin (doujinshi) events (Comiket-style conventions). Users browse events, favorite booths they want to visit, and track their collection of works.

**Stack:** PostgreSQL, Devise (auth), Pundit (authorization), Bootstrap 5, Turbo/Stimulus (Hotwire), Cloudinary (image storage), SimpleForm.

### Domain Model

- **Event** — a convention (has many Booths)
- **Circle** — a creator group; participates in Events via Booths, publishes Works
- **Booth** — a circle's table at an event (belongs to Event + Circle); has BoothWorks, Favorites, Notifications
- **BoothWork** — a denormalized record of works being sold at a specific booth (title, price, limit, num_to_buy, etc.)
- **Work** — a published work (manga, doujin, etc.); belongs to Circles via CircleWork join; belongs to Collections via CollectionWork join
- **Collection** — a user's library of Works. Every user has exactly one collection created at registration (never destroyed); `current_user.collections.first` is always safe.
- **Favorite** — a user's bookmark on a Booth at an event; has optional `priority` (1–9) and `notes`
- **Notification** — an update/announcement attached to a Booth
- **BookmarkedEvent** — join table for users bookmarking Events

### Authorization

- All controllers require `authenticate_user!` via `ApplicationController`.
- Pundit is used in allow-list mode: `after_action :verify_authorized` (non-index) and `verify_policy_scoped` (index) fire everywhere except Devise controllers and `PagesController`.
- `BoothsController` has only a `:show` route; there is no index action, so `verify_policy_scoped` for booths is never triggered.
- `FavoritePolicy` scopes favorites to `user: user` (users only see their own).

### Key Controller Patterns

- `FavoritesController` responds to both HTML and `turbo_stream` format on create/update.
- `BoothsController#show` loads the user's inventory by cross-referencing their collection against the booth's circle to show which works they already own.
- Favorites index is nested under events (`/events/:event_id/favorites`) and ordered by priority then circle name_reading (katakana).

### Validations / Domain Rules

- `Circle#name_reading` and `Work#title_reading` must be full-width katakana (`/\A[ァ-ヿ]+\z/`).
- `Work#download_source` is required only if `digital: true`.
- `Favorite#priority` must be 1–9 or nil.
