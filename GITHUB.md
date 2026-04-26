# Publishing To GitHub

This project is safe to publish as a public source repository as long as you keep private IDs and credentials out of the code.

## Recommended Setup

- Use GitHub for source code and optional static preview.
- Use Google Apps Script for the real collaborative app that syncs to Google Docs and Google Sheets.

## Create A Public Repository

From this folder:

```bash
git init
git add .
git commit -m "Build generic mentoring workspace"
git branch -M main
gh repo create mentoring-workspace --public --source=. --remote=origin --push
```

If you do not use GitHub CLI, create a public repository on GitHub named `mentoring-workspace`, then run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/mentoring-workspace.git
git push -u origin main
```

## Enable GitHub Pages Preview

1. Open the GitHub repository.
2. Go to **Settings > Pages**.
3. Set **Build and deployment** to **GitHub Actions**.
4. The included `.github/workflows/pages.yml` workflow publishes the static preview.

## Important

The GitHub Pages version uses local browser storage. It is only a preview.

For real collaboration, deploy `google-apps-script/Code.gs`, `google-apps-script/Index.html`, and `google-apps-script/appsscript.json` through Google Apps Script, then share the Apps Script web app URL.
