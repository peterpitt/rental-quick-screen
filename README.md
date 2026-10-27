# 租屋快篩 (Rental Quick-Screen)

A lightweight, client-side web app that helps a renter cut a long list of
listings down to a shortlist fast. Pure HTML/CSS/JS — no build step, open
`index.html` in a browser to run.

## Why

Browsing rental sites means wading through dozens of listings with inconsistent
layouts. This app pulls the facts that matter into one scannable view and lets
you screen hard must-haves, score soft preferences, and compare finalists.

## Running it

```
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` directly.

## Development

This project is built feature-by-feature on a single `trunk` branch
(trunk-based development), with every commit keeping the app runnable, and uses
Conventional Commits for history. See the commit log for the feature sequence.

## Roadmap

1. Listing list + data model
2. Quick filters (budget / rooms / district)
3. Deal-breaker knock-out (hard must-haves)
4. Preference scoring & ranking
5. Shortlist & compare
