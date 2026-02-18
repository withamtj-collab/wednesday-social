# ⛳ The Wednesday Social — Golf League Manager

A free, self-hosted golf league management website for ~40 golfers. Runs on **GitHub Pages** (free hosting) + **Firebase Realtime Database** (free tier).

## Features

- **League Standings** — Win/loss records, handicaps, averages, dues tracking
- **Weekly Scores** — Admin enters scores; front 9 (par 36) or back 9 (par 34) per week
- **Head-to-Head Matchups** — Random weekly pairings, handicap-adjusted net scoring
- **Handicap System** — Average strokes over par, max 15; prior-year carryover
- **End-of-Season Tournament** — NCAA-style bracket seeded by regular season record
- **Skins Calculator** — Track entries, skins won, and payouts
- **Commish Game Calculator** — Closest to pin, longest putt, longest drive payouts
- **Admin Portal** — Password-protected management of golfers, scores, and settings
- **Season Awards** — Regular season champ, low handicap, tournament winner

## Setup Instructions (15 minutes)

### Step 1: Create a Firebase Project (Free)

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create a project"** (or "Add project")
3. Name it something like `wednesday-social`
4. Disable Google Analytics (not needed) → **Create Project**
5. Once created, click the **gear icon** → **Project settings**
6. Scroll down to **"Your apps"** → click the **web icon** (`</>`)
7. Register the app with a nickname (e.g., `wednesday-social-web`)
8. **Copy the `firebaseConfig` object** — you'll need it in Step 3

It will look like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "wednesday-social.firebaseapp.com",
  databaseURL: "https://wednesday-social-default-rtdb.firebaseio.com",
  projectId: "wednesday-social",
  storageBucket: "wednesday-social.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Step 2: Enable Realtime Database

1. In Firebase Console, click **"Build"** → **"Realtime Database"**
2. Click **"Create Database"**
3. Choose a location (pick the one closest to you)
4. Start in **test mode** (we'll set rules next)
5. Go to the **"Rules"** tab and replace with:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> ⚠️ This allows anyone with the URL to read/write. The admin password in the app provides UI-level protection. For a casual league of 40, this is fine. For tighter security, see the "Advanced Security" section below.

### Step 3: Add Your Firebase Config

1. Open `index.html` in a text editor
2. Find the section near the top that says `// 🔧 PASTE YOUR FIREBASE CONFIG HERE`
3. Replace the placeholder config with your actual config from Step 1
4. Save the file

### Step 4: Deploy to GitHub Pages (Free)

1. Go to [https://github.com](https://github.com) and sign in (or create a free account)
2. Click **"New repository"**
3. Name it `wednesday-social` (or whatever you like)
4. Make it **Public** (required for free GitHub Pages)
5. Upload `index.html` to the repository
6. Go to **Settings** → **Pages**
7. Under "Source", select **"Deploy from a branch"**
8. Select **`main`** branch and **`/ (root)`** folder
9. Click **Save**
10. Wait 1-2 minutes, then your site will be live at:
    ```
    https://YOUR-USERNAME.github.io/wednesday-social/
    ```

### Step 5: Share with Your League

Send the GitHub Pages URL to your 40 golfers. That's it!

- **Everyone** can view standings, scores, matchups, tournament bracket
- **Everyone** can use the Skins and Commish calculators
- **Admin only** (default password: `golf2026`) can manage golfers, enter scores, run matchups

---

## Ongoing Usage

### Each Week (Admin)
1. Log in via 🔐 Admin button
2. Go to **Scores** tab → select the week → choose Front/Back 9 → enter scores
3. Go to **Matchups** tab → click **🎲 Random Matchups** → click **⚡ Resolve**

### End of Season (Admin)
1. Go to **Tournament** tab → click **Generate Bracket**
2. After each tournament round, click ✅ next to winners to advance them

### Skins / Commish (Anyone)
- Open the calculator, select who's playing, mark who paid, enter results
- These are session-only (not saved) — just quick calculators for the day

---

## Cost

| Service | Cost |
|---------|------|
| GitHub Pages hosting | **Free** |
| Firebase Realtime Database (Spark plan) | **Free** (1 GB stored, 10 GB/month transfer) |
| Custom domain (optional) | ~$10/year |
| **Total** | **$0/year** |

The free Firebase tier easily handles 40 golfers checking scores weekly.

---

## Advanced Security (Optional)

For tighter database security, replace the Firebase rules with:

```json
{
  "rules": {
    ".read": true,
    "league": {
      ".write": true
    }
  }
}
```

This still allows the app to function but limits write access to the `league` path only.

---

## Customization

- **Change the league name**: Search for "The Wednesday Social" in `index.html`
- **Change par values**: Search for `FRONT_PAR` and `BACK_PAR`
- **Change max handicap**: Search for `MAX_HANDICAP`
- **Change admin password**: Done in the Admin panel (Settings section)
- **Change tournament weeks**: Search for `TOURNEY_WEEKS` (default: 6)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank page | Check browser console (F12) for Firebase config errors |
| "Permission denied" | Check Firebase Realtime Database rules are set to allow read/write |
| Data not syncing | Verify `databaseURL` in your Firebase config is correct |
| Site not loading | Make sure the repository is **Public** and GitHub Pages is enabled |
