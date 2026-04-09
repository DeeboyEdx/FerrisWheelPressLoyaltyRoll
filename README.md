# Ferris Wheel Press Loyalty Roll 🎡

Automated daily spin on the [Ferris Wheel Press](https://ferriswheelpress.com) loyalty lounge using [Playwright](https://playwright.dev/).

The script navigates to the loyalty lounge page, dismisses any sign-up popup, enters your email, spins the wheel, and saves a timestamped screenshot of the result.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later) — includes `npm` and `npx`
- [Git](https://git-scm.com/) — to clone the repo

### Installing Prerequisites (Windows)

If you don't have Git or Node.js installed, you can install both with [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) (built into Windows 10/11):

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
```

Close and reopen your terminal after installing so the new commands are available.

## Setup

```bash
git clone https://github.com/DeeboyEdx/FerrisWheelPressLoyaltyRoll.git
cd FerrisWheelPressLoyaltyRoll
npm install
npx playwright install chromium
```

## Usage

```bash
npm run spin -- --email your@email.com
```

### Options

| Flag | Description |
|------|-------------|
| `--email <email>` | **(Required)** Email address for the spin |
| `--headless` | Run without a visible browser window |
| `--login` | Log in before spinning (requires `--password`) |
| `--password <pw>` | Account password (only used with `--login`) |

### Examples

```bash
# Visible browser (watch it work)
npm run spin -- --email your@email.com

# Headless (no browser window)
npm run spin -- --email your@email.com --headless

# With login
npm run spin -- --email your@email.com --password yourpass --login
```

## Output

- **Screenshots** are saved to `screenshots/` with timestamps (e.g., `spin-2026-04-09T01-42-13.png`)
- **Logs** are appended to `logs/spin.log`
