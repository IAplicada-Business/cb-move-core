import { expect, test } from "@playwright/test";

test.describe("smoke público", () => {
  test("página de login carrega", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("E-mail")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });

  test("rota /app exige autenticação", async ({ page }) => {
    await page.goto("/app/cobrancas");
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });
});

test.describe("smoke autenticado", () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  test.skip(!email || !password, "Defina E2E_EMAIL e E2E_PASSWORD para rotas autenticadas");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha").fill(password!);
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30_000 });
  });

  test("dashboard operacional", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("cobranças com banner NF", async ({ page }) => {
    await page.goto("/app/cobrancas");
    await expect(page.getByRole("heading", { name: /cobran/i })).toBeVisible();
    await expect(page.getByText(/Notas Fiscais/i).first()).toBeVisible();
  });

  test("notas fiscais com fila A emitir visível", async ({ page }) => {
    await page.goto("/app/notas-fiscais");
    await expect(page.getByRole("heading", { name: /notas fiscais/i })).toBeVisible();
    await expect(page.getByText(/A emitir/i).first()).toBeVisible();
  });

  test("dashboard financeiro", async ({ page }) => {
    await page.goto("/app/financeiro");
    await expect(page.getByRole("heading", { name: /dashboard financeiro/i })).toBeVisible();
  });

  test("prontuários consolidados", async ({ page }) => {
    await page.goto("/app/prontuarios");
    await expect(page.getByRole("heading", { name: /prontuários consolidados/i })).toBeVisible();
  });

  test("lista de pacientes", async ({ page }) => {
    await page.goto("/app/pacientes");
    await expect(page.getByRole("heading", { name: /pacientes/i })).toBeVisible();
  });

  test("agenda", async ({ page }) => {
    await page.goto("/app/agenda");
    await expect(page.getByRole("heading", { name: /^Agenda/i })).toBeVisible();
  });
});
