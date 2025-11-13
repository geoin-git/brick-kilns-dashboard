# Troubleshooting Guide - GitHub Pages Data Loading

## Issue: CORS Error / Failed to Fetch

### Common Causes:

1. **File doesn't exist at the specified path**
2. **File is in wrong location**
3. **Repository is private** (must be public for raw.githubusercontent.com)
4. **File name mismatch** (case-sensitive)
5. **Branch name mismatch** (might be `master` instead of `main`)

## Quick Fixes:

### 1. Verify File Location

Your file should be at:
```
https://raw.githubusercontent.com/geoin-git/brick-kilns-dashboard/main/data/kilns.json
```

Check your repository structure:
```
brick-kilns-dashboard/
├── index.html
├── script.js
├── style.css
└── data/
    └── kilns.json  ← Must be here
```

### 2. Check File Name

- Must be exactly: `kilns.json` (lowercase)
- Not: `Kilns.json`, `KILNS.json`, or `kilns.JSON`

### 3. Verify Repository is Public

1. Go to your repository on GitHub
2. Click "Settings"
3. Scroll down to "Danger Zone"
4. Make sure repository is **Public** (not Private)

### 4. Check Branch Name

If your default branch is `master` instead of `main`, update the URL in `script.js`:
```javascript
const DATA_URL = 'https://raw.githubusercontent.com/geoin-git/brick-kilns-dashboard/master/data/kilns.json';
```

### 5. Test File URL Directly

Open this URL in your browser:
```
https://raw.githubusercontent.com/geoin-git/brick-kilns-dashboard/main/data/kilns.json
```

If you see:
- ✅ **JSON data** → File exists, issue is with fetch
- ❌ **404 Not Found** → File doesn't exist or wrong path
- ❌ **403 Forbidden** → Repository is private

### 6. Alternative: Put JSON in Root Folder

If the `data/` folder doesn't work, try putting the file in the root:

1. Move `kilns.json` to root folder (same level as `index.html`)
2. Update `script.js`:
```javascript
const DATA_URL = 'https://raw.githubusercontent.com/geoin-git/brick-kilns-dashboard/main/kilns.json';
```

### 7. Verify JSON Format

Your JSON file should be a valid array:
```json
[
  {
    "name": "Kohinoor Brick Kiln",
    "lat": 33.9704,
    "lng": 74.7625,
    "dateCTO": "25-11-2025",
    "validity": "Valid"
  },
  ...
]
```

## Still Not Working?

1. **Check browser console** for detailed error messages
2. **Try incognito mode** to rule out cache issues
3. **Verify file was committed** - check GitHub repository to see if file exists
4. **Wait a few minutes** - GitHub CDN might need time to update

