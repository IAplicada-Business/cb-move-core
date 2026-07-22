"""Regras de valor para cobranças retroativas (R5 corrigido: valor mensal cheio)."""
from __future__ import annotations


def calc_valor_retroativo(
    valor_mensal: float | None,
    previsto_planilha: float,
) -> float:
    """Cada mês retroativo recebe valor mensal cheio (fallback: previsto da planilha)."""
    if valor_mensal is not None and valor_mensal > 0:
        return round(valor_mensal, 2)
    return round(previsto_planilha, 2)


def calc_valor_mes_atual(previsto_planilha: float) -> float:
    """Mês da aba usa o R$ Previsto da planilha (sem divisão)."""
    return round(previsto_planilha, 2)


def is_r5_suspect(cobranca_valor: float, valor_mensal: float | None) -> bool:
    """
    Detecta valores provavelmente gerados pela regra R5 antiga (divisão do previsto).
    """
    if cobranca_valor <= 0:
        return False
    if valor_mensal is None or valor_mensal <= 0:
        return False
    if cobranca_valor >= valor_mensal * 0.9:
        return False
    for divisor in range(2, 7):
        if abs(cobranca_valor * divisor - valor_mensal) <= max(1.0, valor_mensal * 0.03):
            return True
    return cobranca_valor < valor_mensal * 0.5
