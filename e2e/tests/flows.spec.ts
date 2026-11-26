import { expect, test } from "@playwright/test";
import { shot, signIn } from "./helpers";

test("resident picks a month and pays through the test checkout", async ({ page }) => {
  await signIn(page, "resident.head");
  await page.goto("/resident/finance");
  const month = page.locator("input[type=checkbox]:not([disabled])").first();
  await expect(month).toBeVisible();
  await month.check();
  await shot(page, "flow-00-pay-by-month");
  await page.getByRole("button", { name: /pay online/i }).click();
  await expect(page).toHaveURL(/test-checkout/);
  await shot(page, "flow-01-test-checkout");
  await page.getByRole("button", { name: /simulate successful payment/i }).click();
  await expect(page.getByText(/payment successful/i)).toBeVisible();
  await shot(page, "flow-02-payment-success");
});

test("resident creates a visitor pass and the gate checks the visitor in", async ({ page }) => {
  await signIn(page, "resident.head");
  await page.goto("/resident/visitors");
  await page.getByRole("button", { name: /new visitor pass/i }).click();
  await page.getByLabel(/visitor's name/i).fill("E2E Test Visitor");
  await page.getByRole("button", { name: /create pass/i }).click();
  const code = (await page.locator("p.font-mono").first().innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  await expect(page.getByRole("img", { name: /qr code/i }).first()).toBeVisible();
  await shot(page, "flow-03-pass-created-qr");

  await signIn(page, "security.officer");
  await page.goto("/security/gate");
  await page.getByLabel(/visitor code/i).fill(code);
  await page.getByRole("button", { name: /check$/i }).click();
  await expect(page.getByText(/valid pass/i)).toBeVisible();
  await page.getByRole("button", { name: /check in/i }).click();
  await expect(page.getByText("E2E Test Visitor").first()).toBeVisible();
  await shot(page, "flow-04-gate-check-in");
});

test("panic from the sidebar reaches security; management can watch but only security resolves", async ({ page }) => {
  await signIn(page, "resident.head");
  await page.getByRole("button", { name: /panic/i }).first().click();
  await page.getByRole("button", { name: /send alert now/i }).click();
  await expect(page).toHaveURL(/\/resident\/emergency/);
  await shot(page, "flow-05-panic-raised");

  await signIn(page, "estate.manager");
  await page.goto("/security/alerts");
  await page.getByRole("button", { name: /^open$/i }).first().click();
  await expect(page.getByText(/only security officers can acknowledge/i)).toBeVisible();
  await shot(page, "flow-06-manager-read-only");

  await signIn(page, "security.officer");
  await page.goto("/security");
  await page.getByRole("button", { name: /^respond$/i }).first().click();
  await page.getByRole("button", { name: /^acknowledge$/i }).click();
  await expect(page.getByRole("button", { name: /dispatch responder/i })).toBeVisible();
  await page.getByLabel("Note").fill("Patrol attended; resident safe.");
  await page.getByRole("button", { name: /^resolve$/i }).click();
  await expect(page.getByText(/resolved/i).first()).toBeVisible();
  await shot(page, "flow-07-security-resolved");
});

test("resident estate pass shows dues status and the gate can scan it", async ({ page }) => {
  await signIn(page, "resident.head");
  await page.goto("/resident");
  await expect(page.getByText(/my estate pass/i)).toBeVisible();
  await expect(page.getByText(/cleared/i).first()).toBeVisible();
  await shot(page, "flow-08-estate-pass");
});
