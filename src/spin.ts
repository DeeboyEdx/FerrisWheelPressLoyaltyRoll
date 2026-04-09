import { chromium, Browser, Page, Frame } from "playwright";
import * as path from "path";
import * as fs from "fs";

// ── Logger ────────────────────────────────────────────────────────────
class Logger {
  private stream: fs.WriteStream;

  constructor() {
    const dir = path.join(__dirname, "..", "logs");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.stream = fs.createWriteStream(path.join(dir, "spin.log"), { flags: "a" });
  }

  private write(level: string, msg: string) {
    const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
    this.stream.write(line + "\n");
    if (level === "ERROR") {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  info(msg: string) { this.write("INFO", msg); }
  error(msg: string) { this.write("ERROR", msg); }

  close(): Promise<void> {
    return new Promise((resolve) => this.stream.end(resolve));
  }
}

const log = new Logger();

// ── CLI argument parsing ──────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--login") {
      parsed.login = true;
    } else if (arg === "--headless") {
      parsed.headless = true;
    } else if (arg === "--email" && args[i + 1]) {
      parsed.email = args[++i];
    } else if (arg === "--password" && args[i + 1]) {
      parsed.password = args[++i];
    }
  }

  if (!parsed.email) {
    console.error("Usage: npm run spin -- --email <email> [--password <password>] [--login] [--headless]");
    process.exit(1);
  }

  if (parsed.login && !parsed.password) {
    console.error("Error: --password is required when using --login");
    process.exit(1);
  }

  return parsed;
}

// ── Timestamped screenshot helper ─────────────────────────────────────
function screenshotPath(): string {
  const dir = path.join(__dirname, "..", "screenshots");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return path.join(dir, `spin-${ts}.png`);
}

// ── Selectors ─────────────────────────────────────────────────────────
const SELECTORS = {
  signInButton: "#login-button",
  emailInput: "#customer_email",
  passwordInput: "#customer_password",
  signInSubmit: "#customer_login > div.form-action-row > button",
  luckyPawSpin: "#shopify-section-template--18098984747102__dynamic_custom_liquid_zmChMB > section > a",
  // These live inside iframes, not the main page
  spinEmailInput: "#email_input_text",
  spinButton: "#spin-button",
  popupClose: "#form-23695-content > button",
};

const LOYALTY_URL = "https://ferriswheelpress.com/pages/loyalty-program";
const LOUNGE_URL = "https://ferriswheelpress.com/pages/loyalty-lounge";

// ── Find a frame containing a specific selector ──────────────────────
async function findFrameWithSelector(page: Page, selector: string, label: string): Promise<Frame | null> {
  for (const frame of page.frames()) {
    try {
      const el = await frame.$(selector);
      if (el) {
        log.info(`Found "${label}" (${selector}) in frame: ${frame.url().slice(0, 80)}`);
        return frame;
      }
    } catch {
      // frame might be detached
    }
  }
  log.info(`"${label}" (${selector}) not found in any frame.`);
  return null;
}

// ── Main automation ───────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const headless = opts.headless === true;

  log.info("════════════════════════════════════════════════════════════");
  log.info(`Starting spin automation (headless: ${headless})`);

  const browser: Browser = await chromium.launch({ headless });
  const page: Page = await browser.newPage();

  try {
    // ── Optional login phase ──────────────────────────────────────
    if (opts.login) {
      log.info("Navigating to loyalty page for login...");
      await page.goto(LOYALTY_URL, { waitUntil: "domcontentloaded" });

      log.info("Clicking SIGN IN...");
      await page.waitForSelector(SELECTORS.signInButton, { timeout: 15000 });
      await page.click(SELECTORS.signInButton);

      log.info("Filling credentials...");
      await page.waitForSelector(SELECTORS.emailInput, { timeout: 15000 });
      await page.fill(SELECTORS.emailInput, opts.email as string);
      await page.fill(SELECTORS.passwordInput, opts.password as string);

      log.info("Submitting login...");
      await page.click(SELECTORS.signInSubmit);
      await page.waitForLoadState("networkidle");
      log.info("Login complete.");
    }

    // ── Navigate directly to loyalty lounge ────────────────────────
    log.info("Navigating to loyalty lounge...");
    await page.goto(LOUNGE_URL, { waitUntil: "networkidle" });
    log.info(`Page loaded. URL: ${page.url()}`);

    // Give iframes time to load
    await page.waitForTimeout(5000);
    log.info(`Total frames on page: ${page.frames().length}`);

    // ── Dismiss sign-up popup (lives in an iframe) ────────────────
    log.info("Looking for popup close button in iframes...");
    const popupFrame = await findFrameWithSelector(page, SELECTORS.popupClose, "popup close");
    if (popupFrame) {
      await popupFrame.click(SELECTORS.popupClose);
      log.info("Dismissed sign-up popup.");
      await page.waitForTimeout(1000);
    } else {
      log.info("No popup to dismiss.");
    }

    // ── Find the spin widget iframe ───────────────────────────────
    log.info("Looking for spin email input in iframes...");
    const spinFrame = await findFrameWithSelector(page, SELECTORS.spinEmailInput, "spin email input");

    if (!spinFrame) {
      log.error("Spin widget iframe not found!");
      const ssPath = screenshotPath().replace(".png", "-DEBUG-no-spin-frame.png");
      await page.screenshot({ path: ssPath, fullPage: true });
      log.info(`Debug screenshot: ${ssPath}`);
      throw new Error("Could not find spin widget iframe");
    }

    // ── Fill email ────────────────────────────────────────────────
    log.info("Scrolling spin widget into view...");
    const emailEl = await spinFrame.$(SELECTORS.spinEmailInput);
    await emailEl?.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    log.info("Filling spin email...");
    await spinFrame.waitForSelector(SELECTORS.spinEmailInput, { state: "visible", timeout: 15000 });
    await spinFrame.fill(SELECTORS.spinEmailInput, opts.email as string);
    log.info("Email filled. Waiting 3s before spinning...");
    await page.waitForTimeout(3000);

    // ── Click Spin to Win ─────────────────────────────────────────
    log.info("Clicking SPIN TO WIN...");
    await spinFrame.waitForSelector(SELECTORS.spinButton, { state: "visible", timeout: 15000 });
    await spinFrame.click(SELECTORS.spinButton);
    log.info("Clicked SPIN TO WIN.");

    // Wait for spin animation/result to settle
    log.info("Waiting for spin result...");
    await page.waitForTimeout(8000);

    // ── Screenshot ────────────────────────────────────────────────
    const ssPath = screenshotPath();
    await page.screenshot({ path: ssPath, fullPage: true });
    log.info(`Screenshot saved: ${ssPath}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error(`Automation failed: ${errMsg}`);
    try {
      const failPath = screenshotPath().replace(".png", "-FAIL.png");
      await page.screenshot({ path: failPath, fullPage: true });
      log.info(`Failure screenshot saved: ${failPath}`);
    } catch {
      // ignore screenshot failure
    }
    process.exitCode = 1;
  } finally {
    await browser.close();
    log.info("Browser closed.");
    log.info("════════════════════════════════════════════════════════════");
    await log.close();
  }
}

main();
