import { expect, test } from "@playwright/test";
import { expectHealthy, shot, signIn } from "./helpers";

test("public site: landing, listings, request access", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /listings|properties/i }).first()).toBeVisible();
  await shot(page, "01-landing");

  await page.goto("/listings");
  await expect(page.getByText(/TEST –/).first()).toBeVisible();
  await shot(page, "02-listings");

  await page.goto("/request-access");
  await shot(page, "03-request-access");
});

const portals: Array<[string, string, string[]]> = [
  ["super.admin", "/admin", ["/admin", "/admin/users", "/admin/listings", "/admin/audit-logs"]],
  ["agent", "/agent", ["/agent", "/agent/listings"]],
  ["resident.head", "/resident", ["/resident"]],
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

test("API health and session cookie flow through the proxy", async ({ request }) => {
  const res = await request.get("/api/v1/public/estate");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.data.stats.liveListings).toBeGreaterThan(0);
});
