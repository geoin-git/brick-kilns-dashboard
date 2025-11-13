# Setup Guide - GitHub Pages Hosting

## Step 1: Prepare Your Data

1. Open `convert-to-json.html` in your browser
2. Copy your CSV data from Google Sheets
3. Paste it into the converter
4. Click "Convert to JSON"
5. Click "Download JSON" - this creates `kilns.json`

## Step 2: Create GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click the "+" icon → "New repository"
3. Name it: `brick-kilns-dashboard`
4. Make it **Public** (required for GitHub Pages)
5. Click "Create repository"

## Step 3: Upload Files

### Option A: Using GitHub Web Interface
1. In your repository, click "Add file" → "Upload files"
2. Upload these files:
   - `index.html`
   - `style.css`
   - `script-github.js` (rename to `script.js` after upload)
   - Create folder `data` and upload `kilns.json` inside it

### Option B: Using Git (Recommended)
```bash
# Clone your repository
git clone https://github.com/yourusername/brick-kilns-dashboard.git
cd brick-kilns-dashboard

# Copy your files
cp index.html .
cp style.css .
cp script-github.js script.js
mkdir data
cp kilns.json data/

# Commit and push
git add .
git commit -m "Initial commit"
git push origin main
```

## Step 4: Update Data URL

1. Edit `script.js` (or `script-github.js` if you haven't renamed it)
2. Find this line:
   ```javascript
   const DATA_URL = 'https://raw.githubusercontent.com/yourusername/brick-kilns-dashboard/main/data/kilns.json';
   ```
3. Replace `yourusername` with your GitHub username
4. Replace `brick-kilns-dashboard` with your repository name if different

## Step 5: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings" tab
3. Scroll to "Pages" section
4. Under "Source", select "Deploy from a branch"
5. Select "main" branch and "/ (root)" folder
6. Click "Save"
7. Your site will be live at: `https://yourusername.github.io/brick-kilns-dashboard/`

## Step 6: Update Data (When Needed)

1. Export new data from Google Sheets to CSV
2. Use `convert-to-json.html` to convert to JSON
3. Upload the new `kilns.json` to `data/` folder in your repository
4. Changes are live immediately!

## Benefits of This Approach

✅ **Free hosting** - No costs
✅ **No CORS issues** - GitHub raw files allow CORS
✅ **No proxy needed** - Direct fetch works
✅ **Fast & reliable** - GitHub CDN
✅ **Easy updates** - Just update JSON file
✅ **Version control** - Git history of all changes

## Alternative: Netlify/Vercel

If you prefer, you can also:
1. Push to GitHub (same as above)
2. Connect to Netlify or Vercel
3. Auto-deploy on every push
4. Get custom domain support

Both are free and work great!

