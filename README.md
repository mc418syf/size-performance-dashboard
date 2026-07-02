# size? Ecom Performance Dashboard

Static GitHub Pages dashboard for weekly ecommerce product performance.

## Open Locally

Run a local server from this folder:

```powershell
node server.js
```

Then open `http://localhost:4173`.

## Refresh Data

Export one or more weekly Excel workbooks into the dashboard JSON:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-dashboard-data.ps1 `
  -WorkbookPath "C:\Users\MeixiChen\Documents\ecom performance report\SZ_02012026-07020206_performance report.xlsx" `
  -OutputPath "data\dashboard-data.json"
```

Or copy weekly `.xlsx` files into the `workbooks` folder and refresh all of them at once:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\refresh-dashboard.ps1
```

If this repository is on GitHub, you can also refresh without asking Codex:

1. Upload the new weekly `.xlsx` file into the `workbooks` folder.
2. Open the repository's **Actions** tab.
3. Select **Refresh dashboard data**.
4. Click **Run workflow**.

The workflow rebuilds `data/dashboard-data.json` from every workbook in `workbooks`.

To compare week over week, pass multiple workbook paths:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-dashboard-data.ps1 `
  -WorkbookPath "C:\path\SZ_02012026-07020206_performance report.xlsx" `
  -OutputPath "data\dashboard-data.json"
```

## Publish On GitHub

Create a repository, commit these files, push to GitHub, then enable GitHub Pages from the repository settings. Use the repository root as the Pages source.
