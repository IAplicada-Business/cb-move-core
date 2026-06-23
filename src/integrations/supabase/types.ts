export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          canal_origem: string | null
          criado_por: string | null
          duracao_min: number
          fisioterapeuta_id: string | null
          id: string
          inicio: string
          paciente_id: string | null
          servico: string | null
          status: Database["public"]["Enums"]["status_agendamento"]
        }
        Insert: {
          canal_origem?: string | null
          criado_por?: string | null
          duracao_min?: number
          fisioterapeuta_id?: string | null
          id?: string
          inicio: string
          paciente_id?: string | null
          servico?: string | null
          status?: Database["public"]["Enums"]["status_agendamento"]
        }
        Update: {
          canal_origem?: string | null
          criado_por?: string | null
          duracao_min?: number
          fisioterapeuta_id?: string | null
          id?: string
          inicio?: string
          paciente_id?: string | null
          servico?: string | null
          status?: Database["public"]["Enums"]["status_agendamento"]
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_fisioterapeuta_id_fkey"
            columns: ["fisioterapeuta_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          boleto_url: string | null
          competencia_ano: number | null
          competencia_mes: number | null
          cora_invoice_id: string | null
          created_at: string
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          observacoes: string | null
          paciente_id: string
          pago_em: string | null
          qtd_sessoes: number | null
          regime: Database["public"]["Enums"]["regime_cobranca"] | null
          servico: string | null
          status: Database["public"]["Enums"]["cobranca_status"]
          tipo: Database["public"]["Enums"]["paciente_tipo"]
          updated_at: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          boleto_url?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          cora_invoice_id?: string | null
          created_at?: string
          descricao?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"] | null
          id?: string
          observacoes?: string | null
          paciente_id: string
          pago_em?: string | null
          qtd_sessoes?: number | null
          regime?: Database["public"]["Enums"]["regime_cobranca"] | null
          servico?: string | null
          status?: Database["public"]["Enums"]["cobranca_status"]
          tipo?: Database["public"]["Enums"]["paciente_tipo"]
          updated_at?: string
          valor?: number
          vencimento?: string | null
        }
        Update: {
          boleto_url?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          cora_invoice_id?: string | null
          created_at?: string
          descricao?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"] | null
          id?: string
          observacoes?: string | null
          paciente_id?: string
          pago_em?: string | null
          qtd_sessoes?: number | null
          regime?: Database["public"]["Enums"]["regime_cobranca"] | null
          servico?: string | null
          status?: Database["public"]["Enums"]["cobranca_status"]
          tipo?: Database["public"]["Enums"]["paciente_tipo"]
          updated_at?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      convenios: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      fisioterapeutas: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          nome: string
          registro_profissional: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          registro_profissional?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          registro_profissional?: string | null
        }
        Relationships: []
      }
      instrumentos_aplicados: {
        Row: {
          aplicado_em: string
          aplicado_por: string | null
          id: string
          instrumento_id: string
          paciente_id: string
          resultados: Json
          versao_aplicada: number
        }
        Insert: {
          aplicado_em?: string
          aplicado_por?: string | null
          id?: string
          instrumento_id: string
          paciente_id: string
          resultados: Json
          versao_aplicada: number
        }
        Update: {
          aplicado_em?: string
          aplicado_por?: string | null
          id?: string
          instrumento_id?: string
          paciente_id?: string
          resultados?: Json
          versao_aplicada?: number
        }
        Relationships: [
          {
            foreignKeyName: "instrumentos_aplicados_instrumento_id_fkey"
            columns: ["instrumento_id"]
            isOneToOne: false
            referencedRelation: "instrumentos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrumentos_aplicados_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      instrumentos_clinicos: {
        Row: {
          campos: Json
          categoria: string
          codigo: string
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          status: string
          versao: number
        }
        Insert: {
          campos?: Json
          categoria: string
          codigo: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          status?: string
          versao?: number
        }
        Update: {
          campos?: Json
          categoria?: string
          codigo?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          status?: string
          versao?: number
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          cobranca_id: string | null
          corpo_dias_atendidos: string | null
          corpo_numero_processo: string | null
          corpo_paciente_cpf: string | null
          corpo_paciente_nome: string | null
          corpo_total_sessoes: number | null
          corpo_valor_total: number | null
          created_at: string
          destinatario_documento: string | null
          destinatario_nome: string | null
          emissao: string | null
          emitida_em: string | null
          id: string
          numero: string | null
          paciente_id: string | null
          pdf_url: string | null
          status: Database["public"]["Enums"]["nf_status"]
          template_versionado_id: string | null
          tipo: Database["public"]["Enums"]["paciente_tipo"] | null
          updated_at: string
          valor: number
        }
        Insert: {
          cobranca_id?: string | null
          corpo_dias_atendidos?: string | null
          corpo_numero_processo?: string | null
          corpo_paciente_cpf?: string | null
          corpo_paciente_nome?: string | null
          corpo_total_sessoes?: number | null
          corpo_valor_total?: number | null
          created_at?: string
          destinatario_documento?: string | null
          destinatario_nome?: string | null
          emissao?: string | null
          emitida_em?: string | null
          id?: string
          numero?: string | null
          paciente_id?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["nf_status"]
          template_versionado_id?: string | null
          tipo?: Database["public"]["Enums"]["paciente_tipo"] | null
          updated_at?: string
          valor?: number
        }
        Update: {
          cobranca_id?: string | null
          corpo_dias_atendidos?: string | null
          corpo_numero_processo?: string | null
          corpo_paciente_cpf?: string | null
          corpo_paciente_nome?: string | null
          corpo_total_sessoes?: number | null
          corpo_valor_total?: number | null
          created_at?: string
          destinatario_documento?: string | null
          destinatario_nome?: string | null
          emissao?: string | null
          emitida_em?: string | null
          id?: string
          numero?: string | null
          paciente_id?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["nf_status"]
          template_versionado_id?: string | null
          tipo?: Database["public"]["Enums"]["paciente_tipo"] | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais_envios: {
        Row: {
          assunto: string
          destinatarios: string[]
          enviado_em: string
          id: string
          nota_fiscal_id: string
        }
        Insert: {
          assunto: string
          destinatarios: string[]
          enviado_em?: string
          id?: string
          nota_fiscal_id: string
        }
        Update: {
          assunto?: string
          destinatarios?: string[]
          enviado_em?: string
          id?: string
          nota_fiscal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_envios_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          advogado_email: string | null
          advogado_nome: string | null
          ativo: boolean
          convenio_id: string | null
          cpf: string | null
          created_at: string
          criado_em: string
          email: string | null
          fisioterapeuta_id: string | null
          forma_pagamento_preferida: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          nome: string
          numero_processo: string | null
          observacoes: string | null
          regime_cobranca: Database["public"]["Enums"]["regime_cobranca"]
          telefone: string | null
          tipo: Database["public"]["Enums"]["paciente_tipo"]
          updated_at: string
          valor_mensal: number | null
          valor_sessao: number | null
        }
        Insert: {
          advogado_email?: string | null
          advogado_nome?: string | null
          ativo?: boolean
          convenio_id?: string | null
          cpf?: string | null
          created_at?: string
          criado_em?: string
          email?: string | null
          fisioterapeuta_id?: string | null
          forma_pagamento_preferida?: Database["public"]["Enums"]["forma_pagamento"] | null
          id?: string
          nome: string
          numero_processo?: string | null
          observacoes?: string | null
          regime_cobranca?: Database["public"]["Enums"]["regime_cobranca"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["paciente_tipo"]
          updated_at?: string
          valor_mensal?: number | null
          valor_sessao?: number | null
        }
        Update: {
          advogado_email?: string | null
          advogado_nome?: string | null
          ativo?: boolean
          convenio_id?: string | null
          cpf?: string | null
          created_at?: string
          criado_em?: string
          email?: string | null
          fisioterapeuta_id?: string | null
          forma_pagamento_preferida?: Database["public"]["Enums"]["forma_pagamento"] | null
          id?: string
          nome?: string
          numero_processo?: string | null
          observacoes?: string | null
          regime_cobranca?: Database["public"]["Enums"]["regime_cobranca"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["paciente_tipo"]
          updated_at?: string
          valor_mensal?: number | null
          valor_sessao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_fisioterapeuta_id_fkey"
            columns: ["fisioterapeuta_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes_status_historico: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          campo: string
          id: string
          paciente_id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          campo: string
          id?: string
          paciente_id: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          campo?: string
          id?: string
          paciente_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_status_historico_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          fisioterapeuta_id: string | null
          id: string
          nome: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          fisioterapeuta_id?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          fisioterapeuta_id?: string | null
          id?: string
          nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_fisioterapeuta_id_fkey"
            columns: ["fisioterapeuta_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_atendimento: {
        Row: {
          assinado: boolean
          assinado_em: string | null
          assinatura_link: string | null
          competencia_ano: number
          competencia_mes: number
          created_at: string
          id: string
          modelo: Database["public"]["Enums"]["modelo_relatorio"]
          paciente_id: string
          pdf_url: string | null
          template_versionado_id: string | null
        }
        Insert: {
          assinado?: boolean
          assinado_em?: string | null
          assinatura_link?: string | null
          competencia_ano: number
          competencia_mes: number
          created_at?: string
          id?: string
          modelo: Database["public"]["Enums"]["modelo_relatorio"]
          paciente_id: string
          pdf_url?: string | null
          template_versionado_id?: string | null
        }
        Update: {
          assinado?: boolean
          assinado_em?: string | null
          assinatura_link?: string | null
          competencia_ano?: number
          competencia_mes?: number
          created_at?: string
          id?: string
          modelo?: Database["public"]["Enums"]["modelo_relatorio"]
          paciente_id?: string
          pdf_url?: string | null
          template_versionado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_atendimento_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes: {
        Row: {
          cancelada_com_antecedencia: boolean | null
          created_at: string
          data: string
          fisioterapeuta_id: string | null
          hora: string | null
          id: string
          observacoes: string | null
          paciente_id: string
          recupera_sessao_id: string | null
          sigla: Database["public"]["Enums"]["frequencia_sigla"]
        }
        Insert: {
          cancelada_com_antecedencia?: boolean | null
          created_at?: string
          data: string
          fisioterapeuta_id?: string | null
          hora?: string | null
          id?: string
          observacoes?: string | null
          paciente_id: string
          recupera_sessao_id?: string | null
          sigla?: Database["public"]["Enums"]["frequencia_sigla"]
        }
        Update: {
          cancelada_com_antecedencia?: boolean | null
          created_at?: string
          data?: string
          fisioterapeuta_id?: string | null
          hora?: string | null
          id?: string
          observacoes?: string | null
          paciente_id?: string
          recupera_sessao_id?: string | null
          sigla?: Database["public"]["Enums"]["frequencia_sigla"]
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_fisioterapeuta_id_fkey"
            columns: ["fisioterapeuta_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_recupera_sessao_id_fkey"
            columns: ["recupera_sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      templates_versionados: {
        Row: {
          ativo: boolean
          codigo: string
          conteudo: Json
          created_at: string
          criado_por: string | null
          id: string
          modelo: string | null
          tipo: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          conteudo: Json
          created_at?: string
          criado_por?: string | null
          id?: string
          modelo?: string | null
          tipo: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          conteudo?: Json
          created_at?: string
          criado_por?: string | null
          id?: string
          modelo?: string | null
          tipo?: string
          versao?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gestao" | "recepcao" | "fisio"
      cobranca_status:
        | "pendente"
        | "pago"
        | "atrasado"
        | "cancelado"
        | "vencido"
        | "aguardando_convenio"
        | "aguardando_alvara"
        | "regularizar_retroativa"
      forma_pagamento:
        | "boleto"
        | "deposito"
        | "transferencia"
        | "alvara_judicial"
        | "convenio_direto"
      frequencia_sigla: "P" | "F" | "FJ" | "NJ" | "RC" | "NR"
      modelo_relatorio: "convencional" | "unimed" | "sharepoint"
      nf_status:
        | "pendente"
        | "emitida"
        | "cancelada"
        | "erro"
        | "regularizada_retroativa"
      paciente_tipo: "particular" | "judicial" | "convenio" | "puc"
      regime_cobranca: "mensalista" | "por_sessao"
      status_agendamento:
        | "agendado"
        | "confirmado"
        | "realizado"
        | "faltou"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gestao", "recepcao", "fisio"],
      cobranca_status: [
        "pendente",
        "pago",
        "atrasado",
        "cancelado",
        "vencido",
        "aguardando_convenio",
        "aguardando_alvara",
        "regularizar_retroativa",
      ],
      forma_pagamento: [
        "boleto",
        "deposito",
        "transferencia",
        "alvara_judicial",
        "convenio_direto",
      ],
      frequencia_sigla: ["P", "F", "FJ", "NJ", "RC", "NR"],
      modelo_relatorio: ["convencional", "unimed", "sharepoint"],
      nf_status: ["pendente", "emitida", "cancelada", "erro", "regularizada_retroativa"],
      paciente_tipo: ["particular", "judicial", "convenio", "puc"],
      regime_cobranca: ["mensalista", "por_sessao"],
      status_agendamento: ["agendado", "confirmado", "realizado", "faltou", "cancelado"],
    },
  },
} as const
