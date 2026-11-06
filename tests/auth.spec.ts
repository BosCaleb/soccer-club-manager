import { test, expect } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createHmac } from "node:crypto";
function authenticatorCode(key: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...key]
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const secret = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", secret).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
async function capturedLink(email: string, purpose: string) {
  const directory = path.resolve(".local/mail");
  const files = await readdir(directory);
  for (const file of files.reverse()) {
    const message = JSON.parse(
      await readFile(path.join(directory, file), "utf8"),
    );
    if (message.to === email && message.purpose === purpose)
      return new URL(message.url);
  }
  throw new Error("Expected development mail is missing");
}
test("verified guardian journey persists across reload and logout", async ({
  page,
}) => {
  const email = `browser-${crypto.randomUUID()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Your full name").fill("Alex Browser");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Browser-synthetic!42-Long");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("verification email");
  const link = await capturedLink(email, "Verify your email");
  await page.goto(link.pathname + link.search);
  await page.getByRole("button", { name: "Verify my email" }).click();
  await expect(page.getByRole("status")).toContainText("Email verified");
  await page.getByRole("link", { name: "Back to sign in" }).click();
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Browser-synthetic!42-Long");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Alex." }),
  ).toBeVisible();
  await expect(page.getByLabel("Preview role")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome, Alex." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Jordan Browser");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status")).toContainText("Profile updated");
  await page.reload();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Jordan Browser",
  );
  await page
    .getByLabel("Confirm your password")
    .fill("Browser-synthetic!42-Long");
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(page.locator(".secret-key")).toBeVisible();
  const key = (await page.locator(".secret-key").textContent())!;
  await page.getByLabel("Six-digit code").fill(authenticatorCode(key));
  await page.getByRole("button", { name: "Enable MFA" }).click();
  await expect(
    page.getByRole("heading", { name: "Save these recovery codes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I’ve saved my codes" }).click();
  await page.goto("/app/staff");
  await expect(
    page.getByRole("heading", { name: "Staff management is protected." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Good to see you again." }),
  ).toBeVisible();
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Good to see you again." }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Browser-synthetic!42-Long");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "One more security check." }),
  ).toBeVisible();
  await page.getByLabel("Authenticator code").fill(authenticatorCode(key));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Jordan." }),
  ).toBeVisible();
});
test("account forms are accessible, mobile friendly and fail safely", async ({
  page,
}) => {
  for (const route of ["/login", "/register", "/forgot-password"]) {
    await page.goto(route);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/login");
  await page.getByLabel("Email address").fill("absent@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Incorrect-test!42");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.goto("/verify-email?userId=missing&token=invalid");
  await page.getByRole("button", { name: "Verify my email" }).click();
  await expect(page.getByRole("alert")).toContainText("invalid");
});
