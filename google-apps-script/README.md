# Google Apps Script Backend

This folder is the Google Drive sync version of the tracker.

## Files

- `Code.gs`: Apps Script server code. It writes daily entries to a Google Doc and tasks to a Google Sheet.
- `Index.html`: generated bundled UI for Apps Script deployment.
- `appsscript.json`: Apps Script manifest with the web app runtime, timezone, scopes, and access mode.

## Deploy

1. Run the bundler from the project root:

   ```bash
   npm run build:apps-script
   ```

2. Create a new Google Apps Script project.
3. Add `Code.gs`, `Index.html`, and `appsscript.json` from this folder.
4. In `Code.gs`, optionally paste existing `DOCUMENT_ID` and `SPREADSHEET_ID`.
5. Run `initializeProject` once in the Apps Script editor and approve the Docs/Sheets permissions.
6. Deploy as a web app with:
   - Execute as: Me
   - Who has access: Anyone with Google account
7. Open the deployed web app URL.

If the IDs are left blank, the script creates a Google Doc and Google Sheet in your Drive the first time it runs.

See `../DEPLOYMENT.md` for the full step-by-step publishing guide.
