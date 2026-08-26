# Disabled workflows

These four workflows were moved here from `.github/workflows/` to turn off
GitHub Actions completely — no schedule, no manual "Run workflow" button,
nothing listed in the Actions tab. GitHub Actions only scans
`.github/workflows/`, so a file sitting here is fully inert.

Why: none of these had real GHL/Google/Fathom secrets configured yet
(`docs/SETUP.md` §7), so every run failed and spammed failure emails.

## To reactivate one (or all) of them

```bash
git mv .github/workflows-disabled/<name>.yml .github/workflows/<name>.yml
git commit -m "re-enable <name> workflow"
git push
```

Each file still has its `schedule:` trigger commented out from an earlier
fix — uncomment it too if you want automatic runs back, not just manual
`workflow_dispatch`.
