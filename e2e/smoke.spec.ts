import { expect, test, type Page } from "@playwright/test";

const AUTH_TIMEOUT = 30_000;

const APP_ROUTES = {
  dashboard: { path: "/app", nav: /^Dashboard$/, heading: "Dashboard" },
  cobrancas: { path: "/app/cobrancas", nav: "Cobranças", heading: /cobran/i },
  notasFiscais: { path: "/app/notas-fiscais", nav: "Notas Fiscais", heading: /notas fiscais/i },
  financeiro: {
    path: "/app/financeiro",
    nav: "Dashboard Financeiro",
    heading: /dashboard financeiro/i,
  },
  prontuario: {
    path: "/app/prontuario",
    nav: "Prontuário",
    heading: "Prontuário",
  },
  pacientes: { path: "/app/pacientes", nav: "Pacientes", heading: /pacientes/i },
  agenda: { path: "/app/agenda", nav: "Agenda", heading: /^Agenda/i },
} as const;

const SIDEBAR_LINK = 'a[data-sidebar="menu-sub-button"]';

async function loginAsAppUser(page: Page, email: string, password: string) {
  await loginWithCredentials(page, email, password, "app");
}

async function loginAsPortalUser(page: Page, email: string, password: string) {
  await loginWithCredentials(page, email, password, "portal");
}

async function loginWithCredentials(
  page: Page,
  email: string,
  password: string,
  destination: "app" | "portal",
) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: AUTH_TIMEOUT });
  if (page.url().includes("/redefinir-senha")) {
    await page.getByLabel("Nova senha").fill(password);
    await page.getByLabel("Confirmar senha").fill(password);
    await page.getByRole("button", { name: /salvar e entrar/i }).click();
    await page.waitForURL(
      (url) => url.pathname.startsWith(destination === "app" ? "/app" : "/portal"),
      { timeout: AUTH_TIMEOUT },
    );
  }
  if (destination === "app") {
    await page.waitForURL(/\/app/, { timeout: AUTH_TIMEOUT });
    await expect(page.locator(SIDEBAR_LINK).first()).toBeVisible({
      timeout: AUTH_TIMEOUT,
    });
  } else {
    await expect(page).toHaveURL(/\/portal/, { timeout: AUTH_TIMEOUT });
    await expect(page.getByRole("link", { name: "Sessões" })).toBeVisible({
      timeout: AUTH_TIMEOUT,
    });
  }
}

const FINANCE_PATHS = new Set(["/app/cobrancas", "/app/notas-fiscais", "/app/financeiro"]);

async function openAppRoute(page: Page, route: (typeof APP_ROUTES)[keyof typeof APP_ROUTES]) {
  const basePath = route.path.split("?")[0];
  const sidebarLink = page.locator(`${SIDEBAR_LINK}[href="${basePath}"]`);

  if (FINANCE_PATHS.has(basePath)) {
    await page.getByRole("button", { name: "Financeiro" }).click();
    await expect(sidebarLink).toBeVisible({ timeout: AUTH_TIMEOUT });
    await sidebarLink.click();
  } else if (await sidebarLink.isVisible().catch(() => false)) {
    await sidebarLink.click();
  } else {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
  }

  await expect(page).toHaveURL(new RegExp(`${basePath}`), { timeout: AUTH_TIMEOUT });
  await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible({
    timeout: AUTH_TIMEOUT,
  });
}

test.describe("smoke público", () => {
  test("página de login carrega", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("E-mail")).toBeVisible({ timeout: AUTH_TIMEOUT });
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  });

  test("rota /app exige autenticação", async ({ page }) => {
    await page.goto("/app/cobrancas");
    await expect(page).toHaveURL(/\/login/, { timeout: AUTH_TIMEOUT });
  });
});

test.describe("smoke autenticado", () => {
  test.describe.configure({ timeout: 60_000 });

  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  test.skip(!email || !password, "Defina E2E_EMAIL e E2E_PASSWORD para rotas autenticadas");

  test.beforeEach(async ({ page }) => {
    await loginAsAppUser(page, email!, password!);
  });

  test("dashboard operacional", async ({ page }) => {
    await expect(page.getByRole("heading", { name: APP_ROUTES.dashboard.heading })).toBeVisible({
      timeout: AUTH_TIMEOUT,
    });
  });

  test("cobranças com banner NF", async ({ page }) => {
    await openAppRoute(page, APP_ROUTES.cobrancas);
    await expect(page.getByText(/Notas Fiscais/i).first()).toBeVisible({ timeout: AUTH_TIMEOUT });
  });

  test("notas fiscais com fila A emitir visível", async ({ page }) => {
    await openAppRoute(page, APP_ROUTES.notasFiscais);
    await expect(page.getByText(/A emitir/i).first()).toBeVisible({ timeout: AUTH_TIMEOUT });
  });

  test("dashboard financeiro", async ({ page }) => {
    await openAppRoute(page, APP_ROUTES.financeiro);
  });

  test("visão geral de prontuários", async ({ page }) => {
    await openAppRoute(page, APP_ROUTES.prontuario);
    await expect(page.getByRole("heading", { name: /Visão geral por paciente/i })).toBeVisible({
      timeout: AUTH_TIMEOUT,
    });
  });

  test("lista de pacientes", async ({ page }) => {
    await openAppRoute(page, APP_ROUTES.pacientes);
  });

  test("agenda", async ({ page }) => {
    await openAppRoute(page, APP_ROUTES.agenda);
  });
});

const TEST_PASSWORD = process.env.E2E_PASSWORD ?? "CB2026";

test.describe("smoke admin (Charlene)", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await loginAsAppUser(page, "cbmoveneuro@gmail.com", TEST_PASSWORD);
  });

  test("menu Usuários visível", async ({ page }) => {
    const usuariosLink = page.locator(`${SIDEBAR_LINK}[href="/app/usuarios"]`);
    if (await usuariosLink.isVisible().catch(() => false)) {
      await expect(usuariosLink).toBeVisible({ timeout: AUTH_TIMEOUT });
      return;
    }
    await page.getByRole("button", { name: "Equipe" }).click();
    await expect(page.getByRole("link", { name: "Usuários" })).toBeVisible({
      timeout: AUTH_TIMEOUT,
    });
  });

  test("Usuários carrega", async ({ page }) => {
    await page.goto("/app/usuarios", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: /usuários/i })).toBeVisible({
      timeout: AUTH_TIMEOUT,
    });
  });
});

test.describe("smoke fisio clínico", () => {
  test.describe.configure({ timeout: 60_000, mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await loginAsAppUser(page, "fisio.teste@iaplicada.com", TEST_PASSWORD);
  });

  test("operação básica visível", async ({ page }) => {
    await expect(page.locator(`${SIDEBAR_LINK}[href="/app/pacientes"]`)).toBeVisible({
      timeout: AUTH_TIMEOUT,
    });
    await expect(page.locator(`${SIDEBAR_LINK}[href="/app/agenda"]`)).toBeVisible({
      timeout: AUTH_TIMEOUT,
    });
  });

  test("financeiro oculto no menu", async ({ page }) => {
    await expect(page.locator(`${SIDEBAR_LINK}[href="/app/cobrancas"]`)).toHaveCount(0);
    await expect(page.locator(`${SIDEBAR_LINK}[href="/app/usuarios"]`)).toHaveCount(0);
  });
});

test.describe("smoke portal cliente", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await loginAsPortalUser(page, "cliente.teste@iaplicada.com", TEST_PASSWORD);
  });

  test("início do portal", async ({ page }) => {
    await expect(page.getByText(/Bem-vinda de volta/i)).toBeVisible({ timeout: AUTH_TIMEOUT });
    await expect(page.getByText(/Suas sessões este mês/i)).toBeVisible({ timeout: AUTH_TIMEOUT });
  });

  test("navegação sessões e contato", async ({ page }) => {
    await page.getByRole("link", { name: "Sessões" }).click();
    await expect(page).toHaveURL(/\/portal\/sessoes/, { timeout: AUTH_TIMEOUT });
    await page.goto("/portal/contato", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Precisa de ajuda/i })).toBeVisible({
      timeout: AUTH_TIMEOUT,
    });
  });

  test("/app redireciona para portal", async ({ page }) => {
    await page.goto("/app/pacientes", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/portal/, { timeout: AUTH_TIMEOUT });
  });
});
