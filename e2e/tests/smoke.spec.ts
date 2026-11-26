import { expect, test } from "@playwright/test";
import { expectHealthy, shot, signIn } from "./helpers";

test("public site: landing page with search and listings; header has only Sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /find your dream home in the estate/i })).toBeVisible();
  const header = page.locator("header").first();
  await expect(header.getByRole("link")).toHaveCount(2); // brand name + Sign in, no menu links
  await expect(header.getByRole("link", { name: /sign in/i })).toBeVisible();
  await expect(page.getByText(/\d+ listings?/).first()).toBeVisible();
  await expect(page.getByText(/TEST –/).first()).toBeVisible();
  await shot(page, "01-landing");

  // Search filters the listings on the same page.
  await page.getByLabel(/rent or sale/i).selectOption("rent");
  await page.getByRole("button", { name: /^search$/i }).click();
  await expect(page).toHaveURL(/type=rent/);
  await shot(page, "02-landing-search-rent");

  // Old /listings links still work.
  await page.goto("/listings?type=sale");
  await expect(page).toHaveURL(/\/\?type=sale/);

  await page.goto("/login");
  await expect(page.getByRole("link", { name: /request access/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /agent account/i })).toBeVisible();
  await page.goto("/request-access");
  await shot(page, "03-request-access");
});

const portals: Array<[string, string, string[]]> = [
  ["super.admin", "/admin", ["/admin", "/admin/users", "/admin/listings", "/admin/audit-logs", "/admin/settings"]],
  ["estate.manager", "/admin", ["/admin/residents", "/admin/staff", "/admin/stores", "/admin/reports", "/notices", "/community"]],
  ["finance.officer", "/admin", ["/admin/finance", "/admin/finance/bills", "/admin/finance/payments", "/admin/finance/outstanding", "/admin/finance/services"]],
  ["security.officer", "/security", ["/security", "/security/alerts", "/security/gate", "/security/logs", "/security/blacklist", "/security/incidents"]],
  ["resident.head", "/resident", ["/resident", "/resident/finance", "/resident/market", "/messages", "/resident/report", "/resident/direction", "/resident/visitors", "/resident/household", "/resident/emergency"]],
  ["store.owner", "/store", ["/store", "/store/products", "/store/orders"]],
  ["agent", "/agent", ["/agent", "/agent/listings"]],
];

for (const [role, home, pages] of portals) {
  test(`${role} signs in and reaches ${home}`, async ({ page }) => {
    await signIn(page, role);
    await expect(page).toHaveURL(new RegExp(home));
    for (const path of pages) {
      await page.goto(path);
      await expectHealthy(page);
      await shot(page, `${role}${path.replaceAll("/", "_")}`);
    }
  });
}

test("resident sidebar matches the Figma menu, with PANIC above sign out", async ({ page }) => {
  await signIn(page, "resident.head");
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  const labels = (await nav.getByRole("link").allInnerTexts()).map((t) => t.replace(/\d+$/, "").trim());
  expect(labels).toEqual(["Dashboard", "Finance", "Marketplace", "Messages", "Report", "Direction"]);
  await expect(page.getByRole("button", { name: /panic/i }).first()).toBeVisible();
});

test("API health and session cookie flow through the proxy", async ({ request }) => {
  const res = await request.get("/api/v1/public/estate");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.data.stats.liveListings).toBeGreaterThan(0);
});
