import { test, expect } from "@playwright/test";
test("guardian responses are child-specific and reset with the preview", async ({
  page,
}) => {
  await page.goto("/preview");
  await expect(
    page.getByRole("heading", { name: "Hey Sam, welcome back." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Available", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Available", exact: true }).first(),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Available", exact: true }).nth(1),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Leo L", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "vs Atlantic Juniors" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "vs Riverside FC" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Available", exact: true }).first(),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("role previews, fixture form and draft publication are interactive", async ({
  page,
}) => {
  await page.goto("/preview/fixtures");
  await expect(
    page.getByRole("button", { name: "Preview a fixture" }),
  ).toHaveCount(0);
  await page.getByLabel("Preview role").selectOption("manager");
  await page.goto("/preview/registrations");
  // Full reload deliberately resets the synthetic role to guardian.
  await expect(
    page.getByRole("heading", { name: "Admin preview only" }),
  ).toBeVisible();
  await page.getByLabel("Preview role").selectOption("coach");
  await page.getByRole("button", { name: "View upcoming fixtures" }).click();
  await page.getByRole("button", { name: "Preview a fixture" }).click();
  await page.getByLabel("Opponent").fill("Seaside Juniors");
  await page.getByLabel("Venue", { exact: true }).fill("Demo Field");
  await page.getByRole("button", { name: "Add preview fixture" }).click();
  await expect(
    page.getByRole("heading", { name: "vs Seaside Juniors" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review matchday squad" })
    .first()
    .click();
  await page.getByLabel("Draft selection").selectOption("reserve");
  await page
    .getByRole("button", { name: "Publish preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review matchday squad" })
    .first()
    .click();
  await page.getByLabel("Draft selection").selectOption("selected");
  await expect(
    page.getByText("Published preview: reserve.", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Review matchday squad" })
    .nth(1)
    .click();
  await expect(
    page.getByText("Published preview: Not announced.", { exact: false }),
  ).toBeVisible();
});
test("notifications, direct navigation, reduced motion and missing pages work", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview/notifications");
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText("0 unread club updates.")).toBeVisible();
  await page.goto("/preview/fixtures/demo-riverside");
  await expect(page.getByText("Meet at 09:15 SAST")).toBeVisible();
  await page.goto("/preview/fixtures/unknown");
  await expect(
    page.getByRole("heading", { name: "Fixture unavailable" }),
  ).toBeVisible();
  await page.goto("/preview/missing");
  await expect(
    page.getByRole("heading", { name: "That page is off the pitch." }),
  ).toBeVisible();
});

test("key screens and dialogs pass automated accessibility checks", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  for (const route of [
    "/preview",
    "/preview/children",
    "/preview/notifications",
    "/preview/account",
  ]) {
    await page.goto(route);
    await page.locator("main").evaluate(async (el) => {
      await Promise.all(
        el.getAnimations().map((animation) => animation.finished),
      );
    });
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.getByRole("button", { name: "Privacy & support" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").evaluate(async (el) => {
    await Promise.all(
      el.getAnimations().map((animation) => animation.finished),
    );
  });
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Privacy & support" }),
  ).toBeFocused();
});

test("mobile navigation supports keyboard close and route selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/preview");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator(".sidebar .brand")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "My children" }).click();
  await expect(
    page.getByRole("heading", { name: "Small boots. Big dreams." }),
  ).toBeVisible();
  await expect(page.locator(".sidebar")).not.toBeVisible();
});
