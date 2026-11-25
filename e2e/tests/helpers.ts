import { expect, type Page } from "@playwright/test";
import fs from "node:fs";

export const PASSWORD = process.env.DEMO_USER_PASSWORD ?? "Demo@Pahe2026";
const SHOTS = "screenshots";

export async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

/** Signs in with a seeded test account, e.g. role "resident.head". */
export async function signIn(page: Page, role: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(`${role}@test.pahe.local`);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

/** Fails the test if the page shows an error boundary or a failed-to-load message. */
export async function expectHealthy(page: Page) {
  await expect(page.getByText(/something went wrong|couldn.t load|failed to load/i)).toHaveCount(0);
}
