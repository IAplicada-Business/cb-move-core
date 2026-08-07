import { expect, test, type Page } from "@playwright/test";

const AUTH_TIMEOUT = 30_000;
const TEST_PASSWORD = process.env.E2E_PASSWORD ?? "CB2026";
const FISIO_EMAIL = "fisio.teste@iaplicada.com";
const HOMOLOG_DEPLOY = process.env.PLAYWRIGHT_BASE_URL?.includes("lovable.app") ?? false;
/** Paciente vinculado ao fisio teste — ver scripts/setup-fisio-teste-e2e.py */
const DEFAULT_PACIENTE_ID = process.env.E2E_PACIENTE_ID ?? "f4da1fb0-40f0-49e7-91d5-575ea865cbe0";

function patientProntuarioUrl(pacienteId: string, tab: string): string {
  if (HOMOLOG_DEPLOY) {
    return `/app/prontuario?pacienteId=${pacienteId}&tab=${tab}`;
  }
  return `/app/prontuario/${pacienteId}?tab=${tab}`;
}

async function loginAsFisio(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(FISIO_EMAIL);
  await page.getByLabel("Senha").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: AUTH_TIMEOUT });
  await expect(page.locator('a[data-sidebar="menu-button"]').first()).toBeVisible({
    timeout: AUTH_TIMEOUT,
  });
}

function uniqueSoapSuffix() {
  return Date.now().toString(36).slice(-6);
}

test.describe("prontuário — rota dedicada", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await loginAsFisio(page);
  });

  test("legacy ?pacienteId= redireciona para /app/prontuario/$pacienteId", async ({ page }) => {
    test.skip(HOMOLOG_DEPLOY, "Rota dedicada ainda não publicada em homologação Lovable");

    await page.goto(`/app/prontuario?pacienteId=${DEFAULT_PACIENTE_ID}&tab=documentos`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(
      new RegExp(`/app/prontuario/${DEFAULT_PACIENTE_ID}(\\?tab=documentos)?`),
      { timeout: AUTH_TIMEOUT },
    );
    await expect(page.getByRole("tab", { name: /Documentos/i })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  test("deep link abre paciente na evolução diária", async ({ page }) => {
    test.skip(HOMOLOG_DEPLOY, "Rota dedicada ainda não publicada em homologação Lovable");

    await page.goto(`/app/prontuario/${DEFAULT_PACIENTE_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("tab", { name: /Evolução diária/i })).toHaveAttribute(
      "data-state",
      "active",
      { timeout: AUTH_TIMEOUT },
    );
    await expect(page.getByRole("button", { name: /Gravar evolução/i })).toBeVisible({
      timeout: AUTH_TIMEOUT,
    });
  });
});

test.describe("prontuário — fluxo clínico E2E", () => {
  test.describe.configure({ timeout: 120_000, mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await loginAsFisio(page);
  });

  test("evolução → assinatura → relatório mensal", async ({ page }) => {
    const suffix = uniqueSoapSuffix();
    const subjetivo = `E2E subjetivo ${suffix}`;
    const objetivo = `E2E objetivo ${suffix}`;
    const plano = `E2E plano ${suffix}`;

    await page.goto(patientProntuarioUrl(DEFAULT_PACIENTE_ID, "evolucao-diaria"), {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("button", { name: /Gravar evolução/i })).toBeVisible({
      timeout: AUTH_TIMEOUT,
    });
    await page.getByRole("button", { name: /Gravar evolução/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: AUTH_TIMEOUT });
    await expect(page.getByRole("heading", { name: /Nova evolução clínica/i })).toBeVisible();

    await page.getByPlaceholder(/Queixa principal/i).fill(subjetivo);
    await page.getByPlaceholder(/Dados clínicos/i).fill(objetivo);
    await page.getByPlaceholder(/Condutas, exercícios/i).fill(plano);
    await page.getByRole("button", { name: /Salvar evolução/i }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: AUTH_TIMEOUT });
    await expect(page.getByText(subjetivo).first()).toBeVisible({ timeout: AUTH_TIMEOUT });

    const assinarBtn = page.getByRole("button", { name: /^Assinar$/ }).first();
    await expect(assinarBtn).toBeVisible({ timeout: AUTH_TIMEOUT });
    await assinarBtn.click();

    const confirmDialog = page.getByRole("alertdialog");
    const hasConfirm = await confirmDialog
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!hasConfirm) {
      test.skip(
        true,
        "Fisio teste sem assinatura no perfil — configure em Configurações ou rode setup-fisio-teste-e2e",
      );
    }

    await confirmDialog.getByRole("button", { name: /Confirmar assinatura/i }).click();
    await expect(page.getByText("Assinada").first()).toBeVisible({ timeout: AUTH_TIMEOUT });

    await page.getByRole("tab", { name: /^Documentos$/i }).click();
    await expect(page.getByRole("tab", { name: /^Documentos$/i })).toHaveAttribute(
      "data-state",
      "active",
    );

    const gerarBtn = page.getByRole("button", { name: /Gerar relatório/i });
    await expect(gerarBtn).toBeVisible({ timeout: AUTH_TIMEOUT });
    await gerarBtn.click();

    await expect(page.getByRole("button", { name: /Finalizar \/ assinar/i }).first()).toBeVisible({
      timeout: 60_000,
    });

    await page
      .getByRole("button", { name: /Finalizar \/ assinar/i })
      .first()
      .click();

    await expect(
      page
        .getByText(/Solicitação de assinatura enviada|Aguardando assinatura|Aguardando credencial/i)
        .first(),
    ).toBeVisible({ timeout: 60_000 });
  });
});
