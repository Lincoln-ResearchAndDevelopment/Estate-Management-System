import { expect, test } from "@playwright/test";
import { shot, signIn } from "./helpers";

test("resident pays a bill through the test checkout and gets a receipt", async ({ page }) => {
  await signIn(page, "resident.head");
  await page.goto("/resident/finance");
  const firstBill = page.getByRole("checkbox", { name: /select/i }).first();
  await expect(firstBill).toBeVisible();
  await firstBill.check();
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
  await shot(page, "flow-03-pass-created");

  await signIn(page, "security.officer");
  await page.goto("/security/gate");
  await page.getByLabel(/visitor code/i).fill(code);
  await page.getByRole("button", { name: /check$/i }).click();
  await expect(page.getByText(/valid pass/i)).toBeVisible();
  await page.getByRole("button", { name: /check in/i }).click();
  await expect(page.getByText("E2E Test Visitor").first()).toBeVisible();
  await shot(page, "flow-04-gate-check-in");
});
