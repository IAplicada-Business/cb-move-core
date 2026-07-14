import { describe, expect, it, vi, afterEach } from "vitest";
import {
  documentoCoraValido,
  formatCoraApiErrorBody,
  hojeIsoBrasil,
  validarCobrancaParaBoletoCora,
  vencimentoCoraValido,
} from "./cora-boleto";

describe("documentoCoraValido", () => {
  it("aceita CPF com 11 dígitos", () => {
    expect(documentoCoraValido("529.982.247-25")).toBe(true);
  });

  it("aceita CNPJ com 14 dígitos", () => {
    expect(documentoCoraValido("12.345.678/0001-95")).toBe(true);
  });

  it("rejeita documento inválido", () => {
    expect(documentoCoraValido("123")).toBe(false);
    expect(documentoCoraValido(null)).toBe(false);
  });
});

describe("vencimentoCoraValido", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejeita vencimento no passado", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:00:00-03:00"));
    expect(vencimentoCoraValido("2026-07-13")).toBe(false);
    expect(vencimentoCoraValido(hojeIsoBrasil())).toBe(true);
    expect(vencimentoCoraValido("2026-08-01")).toBe(true);
  });
});

describe("validarCobrancaParaBoletoCora", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const base = {
    cpf: "529.982.247-25",
    email: "paciente@email.com",
    vencimento: "2099-12-31",
    valor: 150,
  };

  it("retorna null quando dados válidos", () => {
    expect(validarCobrancaParaBoletoCora(base)).toBeNull();
  });

  it("rejeita vencimento ausente", () => {
    expect(validarCobrancaParaBoletoCora({ ...base, vencimento: null })).toMatch(/vencimento/i);
  });

  it("rejeita vencimento no passado", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:00:00-03:00"));
    expect(validarCobrancaParaBoletoCora({ ...base, vencimento: "2026-01-01" })).toMatch(/passado/i);
  });

  it("rejeita CPF/CNPJ inválido", () => {
    expect(validarCobrancaParaBoletoCora({ ...base, cpf: "123" })).toMatch(/CPF ou CNPJ/i);
  });

  it("rejeita e-mail ausente", () => {
    expect(validarCobrancaParaBoletoCora({ ...base, email: "" })).toMatch(/e-mail/i);
  });

  it("rejeita valor abaixo do mínimo", () => {
    expect(validarCobrancaParaBoletoCora({ ...base, valor: 4.99 })).toMatch(/mínimo/i);
  });
});

describe("formatCoraApiErrorBody", () => {
  it("traduz erro de documento do cliente", () => {
    const raw = '{"errors":[{"code":"customer.document","message":"invalid"}]}';
    expect(formatCoraApiErrorBody(raw, 400)).toMatch(/CPF\/CNPJ/i);
  });

  it("traduz 401", () => {
    expect(formatCoraApiErrorBody("unauthorized", 401)).toMatch(/401/i);
  });
});
