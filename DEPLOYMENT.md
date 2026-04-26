# Deploying Mentoring Workspace

## Recommended Path: Google Apps Script Web App

Use this path for the real version collaborators will use. It is free for normal small-group use and keeps the interface, Google Doc, and Google Sheet in one Google account.

GitHub Pages is useful for a static preview, but it cannot securely write to Google Docs or Google Sheets by itself. The synced version should be deployed as an Apps Script web app because Apps Script can host the page and write to your Google Drive files.

## What Gets Created

The first time the Apps Script project runs, it creates these files in the deploying Google account:

- `Mentoring Daily Log`: a Google Doc that receives daily log entries.
- `Mentoring Task Tracker`: a Google Sheet with tabs for tasks and daily logs.

If you already have a Doc or Sheet you want to use, paste their IDs into `DOCUMENT_ID` and `SPREADSHEET_ID` in `google-apps-script/Code.gs` before deployment.

## One-Time Setup

From this project folder, rebuild the bundled Apps Script UI:

```bash
npm run build:apps-script
```

Then create the Google Apps Script project:

1. Go to [script.google.com](https://script.google.com/).
2. Create a new project named `Mentoring Workspace`.
3. Add or replace these files in the Apps Script editor:
   - `Code.gs` from `google-apps-script/Code.gs`
   - `Index.html` from `google-apps-script/Index.html`
   - `appsscript.json` from `google-apps-script/appsscript.json`
4. In the Apps Script editor, run `initializeProject`.
5. Approve the requested Google Docs and Google Sheets permissions.
6. Open **Executions** or **Logs** to see the Doc and Sheet URLs that were created.

## Publish the App

In the Apps Script editor:

1. Click **Deploy > New deployment**.
2. Select **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone with Google account**.
5. Click **Deploy**.
6. Share the generated web app URL with collaborators.

With this configuration, collaborators use the same interface and all changes go into the same Google Doc and Google Sheet in your Drive.

## Updating Later

When you change `index.html`, `styles.css`, or files in `src/`, run:

```bash
npm run build:apps-script
```

Then paste the updated `google-apps-script/Index.html` into the Apps Script editor and create a new deployment version.

If you change `google-apps-script/Code.gs` or `google-apps-script/appsscript.json`, paste those updates into Apps Script too.

## GitHub Pages Option

You can publish this repository with GitHub Pages as a free static preview, but it will use local browser storage unless it is served by Apps Script. For the functional shared tracker, use the Apps Script web app URL as the link collaborators open.
