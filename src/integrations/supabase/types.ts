export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _cbmove_test_flags: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      agenda_avisos: {
        Row: {
          data: string
          id: string
          texto: string
          updated_at: string
        }
        Insert: {
          data: string
          id?: string
          texto?: string
          updated_at?: string
        }
        Update: {
          data?: string
          id?: string
          texto?: string
          updated_at?: string
        }
        Relationships: []
      }
      agendamento_historico: {
        Row: {
          acao: string
          agendamento_id: string
          created_at: string
          escopo: string | null
          id: string
          inicio_anterior: string | null
          inicio_novo: string | null
          status_anterior: string | null
          status_novo: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          agendamento_id: string
          created_at?: string
          escopo?: string | null
          id?: string
          inicio_anterior?: string | null
          inicio_novo?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          agendamento_id?: string
          created_at?: string
          escopo?: string | null
          id?: string
          inicio_anterior?: string | null
          inicio_novo?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_historico_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          canal_origem: string | null
          criado_por: string | null
          duracao_min: number
          fisioterapeuta_id: string | null
          id: string
          inicio: string
          paciente_id: string | null
          remarcado_de_id: string | null
          remarcado_para_id: string | null
          serie_id: string | null
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
          remarcado_de_id?: string | null
          remarcado_para_id?: string | null
          serie_id?: string | null
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
          remarcado_de_id?: string | null
          remarcado_para_id?: string | null
          serie_id?: string | null
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
          {
            foreignKeyName: "agendamentos_remarcado_de_id_fkey"
            columns: ["remarcado_de_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_remarcado_para_id_fkey"
            columns: ["remarcado_para_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          boleto_modo: Database["public"]["Enums"]["boleto_modo"]
          boleto_url: string | null
          competencia_ano: number | null
          competencia_mes: number | null
          cora_invoice_id: string | null
          created_at: string
          descricao: string | null
          dias_semana: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          frequencia_atendimento: string | null
          id: string
          observacoes: string | null
          paciente_id: string
          pago_em: string | null
          parcela_numero: number | null
          parcela_total: number | null
          parcelamento_grupo_id: string | null
          pix_emv: string | null
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
          boleto_modo?: Database["public"]["Enums"]["boleto_modo"]
          boleto_url?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          cora_invoice_id?: string | null
          created_at?: string
          descricao?: string | null
          dias_semana?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          frequencia_atendimento?: string | null
          id?: string
          observacoes?: string | null
          paciente_id: string
          pago_em?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          parcelamento_grupo_id?: string | null
          pix_emv?: string | null
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
          boleto_modo?: Database["public"]["Enums"]["boleto_modo"]
          boleto_url?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          cora_invoice_id?: string | null
          created_at?: string
          descricao?: string | null
          dias_semana?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          frequencia_atendimento?: string | null
          id?: string
          observacoes?: string | null
          paciente_id?: string
          pago_em?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          parcelamento_grupo_id?: string | null
          pix_emv?: string | null
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
      cobrancas_envios: {
        Row: {
          canais: string[]
          cobranca_id: string
          destinatarios: string[]
          enviado_em: string
          event_id: string | null
          id: string
        }
        Insert: {
          canais?: string[]
          cobranca_id: string
          destinatarios?: string[]
          enviado_em?: string
          event_id?: string | null
          id?: string
        }
        Update: {
          canais?: string[]
          cobranca_id?: string
          destinatarios?: string[]
          enviado_em?: string
          event_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_envios_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas_pagamentos_eventos: {
        Row: {
          cobranca_id: string | null
          cora_invoice_id: string | null
          criado_em: string
          emit_nf_disparado: boolean
          erro: string | null
          id: string
          marcou_pago: boolean
          nf_criada: boolean
          nf_id: string | null
          origem: string
          payload: Json | null
          status_cora_anterior: string | null
          status_cora_novo: string | null
          webhook_event_id: string | null
        }
        Insert: {
          cobranca_id?: string | null
          cora_invoice_id?: string | null
          criado_em?: string
          emit_nf_disparado?: boolean
          erro?: string | null
          id?: string
          marcou_pago?: boolean
          nf_criada?: boolean
          nf_id?: string | null
          origem?: string
          payload?: Json | null
          status_cora_anterior?: string | null
          status_cora_novo?: string | null
          webhook_event_id?: string | null
        }
        Update: {
          cobranca_id?: string | null
          cora_invoice_id?: string | null
          criado_em?: string
          emit_nf_disparado?: boolean
          erro?: string | null
          id?: string
          marcou_pago?: boolean
          nf_criada?: boolean
          nf_id?: string | null
          origem?: string
          payload?: Json | null
          status_cora_anterior?: string | null
          status_cora_novo?: string | null
          webhook_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_pagamentos_eventos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_pagamentos_eventos_nf_id_fkey"
            columns: ["nf_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      convenios: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          codigo_municipio_ibge: number | null
          complemento: string | null
          created_at: string
          email_envio: string | null
          email_nf: string | null
          endereco: string | null
          id: string
          nome: string
          numero: string | null
          razao_social: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_municipio_ibge?: number | null
          complemento?: string | null
          created_at?: string
          email_envio?: string | null
          email_nf?: string | null
          endereco?: string | null
          id?: string
          nome: string
          numero?: string | null
          razao_social?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_municipio_ibge?: number | null
          complemento?: string | null
          created_at?: string
          email_envio?: string | null
          email_nf?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          numero?: string | null
          razao_social?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      creditos_ia_uso: {
        Row: {
          created_at: string | null
          custo_estimado_usd: number | null
          id: string
          tipo: string
          tokens_entrada: number | null
          tokens_saida: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          custo_estimado_usd?: number | null
          id?: string
          tipo: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          custo_estimado_usd?: number | null
          id?: string
          tipo?: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      exercicios: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          criado_por: string | null
          descricao: string | null
          fisioterapeuta_id: string | null
          frequencia_semanal: number | null
          id: string
          midia_url: string | null
          nome: string
          paciente_id: string
          repeticoes: number | null
          series: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          fisioterapeuta_id?: string | null
          frequencia_semanal?: number | null
          id?: string
          midia_url?: string | null
          nome: string
          paciente_id: string
          repeticoes?: number | null
          series?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          fisioterapeuta_id?: string | null
          frequencia_semanal?: number | null
          id?: string
          midia_url?: string | null
          nome?: string
          paciente_id?: string
          repeticoes?: number | null
          series?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercicios_fisioterapeuta_id_fkey"
            columns: ["fisioterapeuta_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercicios_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      exercicios_realizados: {
        Row: {
          data: string
          exercicio_id: string
          id: string
          observacoes_paciente: string | null
          paciente_id: string
          realizado_em: string | null
        }
        Insert: {
          data?: string
          exercicio_id: string
          id?: string
          observacoes_paciente?: string | null
          paciente_id: string
          realizado_em?: string | null
        }
        Update: {
          data?: string
          exercicio_id?: string
          id?: string
          observacoes_paciente?: string | null
          paciente_id?: string
          realizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercicios_realizados_exercicio_id_fkey"
            columns: ["exercicio_id"]
            isOneToOne: false
            referencedRelation: "exercicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercicios_realizados_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      fisio_disponibilidade: {
        Row: {
          ativo: boolean
          created_at: string
          dia_semana: number
          fisioterapeuta_id: string
          hora_fim: string
          hora_inicio: string
          id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_semana: number
          fisioterapeuta_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number
          fisioterapeuta_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fisio_disponibilidade_fisioterapeuta_id_fkey"
            columns: ["fisioterapeuta_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
        ]
      }
      fisio_indisponibilidade: {
        Row: {
          created_at: string
          fim: string
          fisioterapeuta_id: string
          id: string
          inicio: string
          motivo: string
          observacoes: string | null
        }
        Insert: {
          created_at?: string
          fim: string
          fisioterapeuta_id: string
          id?: string
          inicio: string
          motivo?: string
          observacoes?: string | null
        }
        Update: {
          created_at?: string
          fim?: string
          fisioterapeuta_id?: string
          id?: string
          inicio?: string
          motivo?: string
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fisio_indisponibilidade_fisioterapeuta_id_fkey"
            columns: ["fisioterapeuta_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
        ]
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
      integracao_config: {
        Row: {
          atualizado_em: string
          chave: string
          valor: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          valor: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          valor?: string
        }
        Relationships: []
      }
      menu_permissions: {
        Row: {
          enabled: boolean
          menu_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          menu_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          menu_key?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          cobranca_id: string | null
          competencia_ano: number | null
          competencia_mes: number | null
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
          fiscal_provider: string | null
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
          competencia_ano?: number | null
          competencia_mes?: number | null
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
          fiscal_provider?: string | null
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
          competencia_ano?: number | null
          competencia_mes?: number | null
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
          fiscal_provider?: string | null
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
          event_id: string | null
          id: string
          nota_fiscal_id: string
        }
        Insert: {
          assunto: string
          destinatarios: string[]
          enviado_em?: string
          event_id?: string | null
          id?: string
          nota_fiscal_id: string
        }
        Update: {
          assunto?: string
          destinatarios?: string[]
          enviado_em?: string
          event_id?: string | null
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
          bairro: string | null
          cep: string | null
          cid: string | null
          cidade: string | null
          codigo_municipio_ibge: number | null
          complemento: string | null
          consulta_experimental_em: string | null
          consulta_experimental_fisio_id: string | null
          consulta_experimental_observacoes: string | null
          convenio_id: string | null
          cpf: string | null
          created_at: string
          criado_em: string
          dia_emissao_boleto: number | null
          dia_emissao_nf: number | null
          dias_semana: string | null
          email: string | null
          endereco: string | null
          fisioterapeuta_id: string | null
          forma_pagamento_preferida:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          frequencia_atendimento: string | null
          id: string
          modelo_relatorio_preferido:
            | Database["public"]["Enums"]["modelo_relatorio"]
            | null
          modo_emissao_boleto: Database["public"]["Enums"]["modo_emissao_nf"]
          modo_emissao_nf: Database["public"]["Enums"]["modo_emissao_nf"]
          motivo_acompanhamento: string | null
          nome: string
          numero_endereco: string | null
          numero_processo: string | null
          observacoes: string | null
          periodizacao_pdf_url: string | null
          plano_total_sessoes: number | null
          regime_cobranca: Database["public"]["Enums"]["regime_cobranca"]
          telefone: string | null
          tipo: Database["public"]["Enums"]["paciente_tipo"]
          uf: string | null
          updated_at: string
          user_id: string | null
          valor_mensal: number | null
          valor_sessao: number | null
        }
        Insert: {
          advogado_email?: string | null
          advogado_nome?: string | null
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cid?: string | null
          cidade?: string | null
          codigo_municipio_ibge?: number | null
          complemento?: string | null
          consulta_experimental_em?: string | null
          consulta_experimental_fisio_id?: string | null
          consulta_experimental_observacoes?: string | null
          convenio_id?: string | null
          cpf?: string | null
          created_at?: string
          criado_em?: string
          dia_emissao_boleto?: number | null
          dia_emissao_nf?: number | null
          dias_semana?: string | null
          email?: string | null
          endereco?: string | null
          fisioterapeuta_id?: string | null
          forma_pagamento_preferida?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          frequencia_atendimento?: string | null
          id?: string
          modelo_relatorio_preferido?:
            | Database["public"]["Enums"]["modelo_relatorio"]
            | null
          modo_emissao_boleto?: Database["public"]["Enums"]["modo_emissao_nf"]
          modo_emissao_nf?: Database["public"]["Enums"]["modo_emissao_nf"]
          motivo_acompanhamento?: string | null
          nome: string
          numero_endereco?: string | null
          numero_processo?: string | null
          observacoes?: string | null
          periodizacao_pdf_url?: string | null
          plano_total_sessoes?: number | null
          regime_cobranca?: Database["public"]["Enums"]["regime_cobranca"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["paciente_tipo"]
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          valor_mensal?: number | null
          valor_sessao?: number | null
        }
        Update: {
          advogado_email?: string | null
          advogado_nome?: string | null
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cid?: string | null
          cidade?: string | null
          codigo_municipio_ibge?: number | null
          complemento?: string | null
          consulta_experimental_em?: string | null
          consulta_experimental_fisio_id?: string | null
          consulta_experimental_observacoes?: string | null
          convenio_id?: string | null
          cpf?: string | null
          created_at?: string
          criado_em?: string
          dia_emissao_boleto?: number | null
          dia_emissao_nf?: number | null
          dias_semana?: string | null
          email?: string | null
          endereco?: string | null
          fisioterapeuta_id?: string | null
          forma_pagamento_preferida?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          frequencia_atendimento?: string | null
          id?: string
          modelo_relatorio_preferido?:
            | Database["public"]["Enums"]["modelo_relatorio"]
            | null
          modo_emissao_boleto?: Database["public"]["Enums"]["modo_emissao_nf"]
          modo_emissao_nf?: Database["public"]["Enums"]["modo_emissao_nf"]
          motivo_acompanhamento?: string | null
          nome?: string
          numero_endereco?: string | null
          numero_processo?: string | null
          observacoes?: string | null
          periodizacao_pdf_url?: string | null
          plano_total_sessoes?: number | null
          regime_cobranca?: Database["public"]["Enums"]["regime_cobranca"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["paciente_tipo"]
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          valor_mensal?: number | null
          valor_sessao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_consulta_experimental_fisio_id_fkey"
            columns: ["consulta_experimental_fisio_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
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
      periodizacao_sessoes: {
        Row: {
          atividades_previstas: string | null
          atualizado_por: string | null
          created_at: string
          drive_doc_url: string | null
          fisioterapeuta_id: string | null
          id: string
          numero_sessao: number
          objetivo: string | null
          paciente_id: string
          sessao_id: string | null
          status: Database["public"]["Enums"]["periodizacao_status"]
          updated_at: string
        }
        Insert: {
          atividades_previstas?: string | null
          atualizado_por?: string | null
          created_at?: string
          drive_doc_url?: string | null
          fisioterapeuta_id?: string | null
          id?: string
          numero_sessao: number
          objetivo?: string | null
          paciente_id: string
          sessao_id?: string | null
          status?: Database["public"]["Enums"]["periodizacao_status"]
          updated_at?: string
        }
        Update: {
          atividades_previstas?: string | null
          atualizado_por?: string | null
          created_at?: string
          drive_doc_url?: string | null
          fisioterapeuta_id?: string | null
          id?: string
          numero_sessao?: number
          objetivo?: string | null
          paciente_id?: string
          sessao_id?: string | null
          status?: Database["public"]["Enums"]["periodizacao_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "periodizacao_sessoes_fisioterapeuta_id_fkey"
            columns: ["fisioterapeuta_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodizacao_sessoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodizacao_sessoes_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assinatura_storage_path: string | null
          avatar_storage_path: string | null
          created_at: string
          email: string | null
          fisioterapeuta_id: string | null
          id: string
          nome: string | null
        }
        Insert: {
          assinatura_storage_path?: string | null
          avatar_storage_path?: string | null
          created_at?: string
          email?: string | null
          fisioterapeuta_id?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          assinatura_storage_path?: string | null
          avatar_storage_path?: string | null
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
      prontuario_evolucoes: {
        Row: {
          assinado_em: string | null
          assinado_por: string | null
          created_at: string | null
          criado_por: string | null
          data: string
          fisioterapeuta_id: string | null
          fonte: string | null
          id: string
          objetivo: string | null
          paciente_id: string
          plano: string | null
          sessao_id: string | null
          subjetivo: string | null
          transcricao_raw: string | null
          updated_at: string | null
        }
        Insert: {
          assinado_em?: string | null
          assinado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          data?: string
          fisioterapeuta_id?: string | null
          fonte?: string | null
          id?: string
          objetivo?: string | null
          paciente_id: string
          plano?: string | null
          sessao_id?: string | null
          subjetivo?: string | null
          transcricao_raw?: string | null
          updated_at?: string | null
        }
        Update: {
          assinado_em?: string | null
          assinado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          data?: string
          fisioterapeuta_id?: string | null
          fonte?: string | null
          id?: string
          objetivo?: string | null
          paciente_id?: string
          plano?: string | null
          sessao_id?: string | null
          subjetivo?: string | null
          transcricao_raw?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prontuario_evolucoes_fisioterapeuta_id_fkey"
            columns: ["fisioterapeuta_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prontuario_evolucoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prontuario_evolucoes_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_atendimento_linhas: {
        Row: {
          carga_horaria: string
          created_at: string
          data: string
          fisioterapeuta_id: string | null
          fisioterapeuta_nome: string | null
          id: string
          ordem_no_dia: number
          relatorio_id: string
        }
        Insert: {
          carga_horaria?: string
          created_at?: string
          data: string
          fisioterapeuta_id?: string | null
          fisioterapeuta_nome?: string | null
          id?: string
          ordem_no_dia?: number
          relatorio_id: string
        }
        Update: {
          carga_horaria?: string
          created_at?: string
          data?: string
          fisioterapeuta_id?: string | null
          fisioterapeuta_nome?: string | null
          id?: string
          ordem_no_dia?: number
          relatorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_atendimento_linhas_fisioterapeuta_id_fkey"
            columns: ["fisioterapeuta_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_atendimento_linhas_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_atendimento"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_atendimento: {
        Row: {
          assinado: boolean
          assinado_em: string | null
          assinatura_link: string | null
          carga_horaria: string | null
          clicksign_document_key: string | null
          competencia_ano: number
          competencia_mes: number
          created_at: string
          fisioterapeuta_id: string | null
          formato_arquivo: string
          frequencia_texto: string | null
          id: string
          modelo: Database["public"]["Enums"]["modelo_relatorio"]
          modelo_pdf: string | null
          num_sessoes: number | null
          paciente_id: string
          pdf_url: string | null
          status: string | null
          template_versionado_id: string | null
          valor_sessao: number | null
          valor_total: number | null
          xlsx_url: string | null
        }
        Insert: {
          assinado?: boolean
          assinado_em?: string | null
          assinatura_link?: string | null
          carga_horaria?: string | null
          clicksign_document_key?: string | null
          competencia_ano: number
          competencia_mes: number
          created_at?: string
          fisioterapeuta_id?: string | null
          formato_arquivo?: string
          frequencia_texto?: string | null
          id?: string
          modelo: Database["public"]["Enums"]["modelo_relatorio"]
          modelo_pdf?: string | null
          num_sessoes?: number | null
          paciente_id: string
          pdf_url?: string | null
          status?: string | null
          template_versionado_id?: string | null
          valor_sessao?: number | null
          valor_total?: number | null
          xlsx_url?: string | null
        }
        Update: {
          assinado?: boolean
          assinado_em?: string | null
          assinatura_link?: string | null
          carga_horaria?: string | null
          clicksign_document_key?: string | null
          competencia_ano?: number
          competencia_mes?: number
          created_at?: string
          fisioterapeuta_id?: string | null
          formato_arquivo?: string
          frequencia_texto?: string | null
          id?: string
          modelo?: Database["public"]["Enums"]["modelo_relatorio"]
          modelo_pdf?: string | null
          num_sessoes?: number | null
          paciente_id?: string
          pdf_url?: string | null
          status?: string | null
          template_versionado_id?: string | null
          valor_sessao?: number | null
          valor_total?: number | null
          xlsx_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_atendimento_fisioterapeuta_id_fkey"
            columns: ["fisioterapeuta_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_atendimento_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao_fisioterapeutas: {
        Row: {
          created_at: string
          fisioterapeuta_id: string
          principal: boolean
          sessao_id: string
        }
        Insert: {
          created_at?: string
          fisioterapeuta_id: string
          principal?: boolean
          sessao_id: string
        }
        Update: {
          created_at?: string
          fisioterapeuta_id?: string
          principal?: boolean
          sessao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessao_fisioterapeutas_fisioterapeuta_id_fkey"
            columns: ["fisioterapeuta_id"]
            isOneToOne: false
            referencedRelation: "fisioterapeutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessao_fisioterapeutas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
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
      assert_finance_or_service_role: { Args: never; Returns: undefined }
      assinar_evolucao: {
        Args: { p_evolucao_id: string }
        Returns: {
          assinado_em: string | null
          assinado_por: string | null
          created_at: string | null
          criado_por: string | null
          data: string
          fisioterapeuta_id: string | null
          fonte: string | null
          id: string
          objetivo: string | null
          paciente_id: string
          plano: string | null
          sessao_id: string | null
          subjetivo: string | null
          transcricao_raw: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "prontuario_evolucoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      atualizar_cobrancas_vencidas: { Args: never; Returns: number }
      cobrancas_sem_nf: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          cobranca_id: string
          competencia_ano: number
          competencia_mes: number
          destinatario_documento: string
          destinatario_nome: string
          paciente_cpf: string
          paciente_id: string
          paciente_nome: string
          paciente_telefone: string
          status: Database["public"]["Enums"]["cobranca_status"]
          tipo: Database["public"]["Enums"]["paciente_tipo"]
          valor: number
        }[]
      }
      criar_nf_de_cobranca: { Args: { p_cobranca_id: string }; Returns: string }
      current_fisioterapeuta_id: { Args: never; Returns: string }
      financeiro_kpis: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          pago: number
          pendente: number
          qtd_pago: number
          qtd_pendente: number
          qtd_total: number
          qtd_vencido: number
          total: number
          vencido: number
        }[]
      }
      financeiro_kpis_por_tipo: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          pacientes: number
          tipo: Database["public"]["Enums"]["paciente_tipo"]
          valor: number
        }[]
      }
      fisio_can_access_paciente: {
        Args: { p_paciente_id: string }
        Returns: boolean
      }
      get_fisio_conta_vinculada: {
        Args: { p_fisio_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_fisio_uso_logs: {
        Args: { p_fisio_id: string; p_limit?: number }
        Returns: {
          categoria: string
          detalhe: string
          id: string
          titulo: string
          ts: string
        }[]
      }
      has_finance_access: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_relatorio_atendimento_pdf: {
        Args: {
          p_competencia_ano: number
          p_competencia_mes: number
          p_paciente_id: string
          p_pdf_url: string
        }
        Returns: string
      }
      is_clinical_fisio_user: { Args: never; Returns: boolean }
      list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          nome: string
          paciente_id: string
          paciente_nome: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      marcar_cobranca_paga_cora: {
        Args: { p_cobranca_id: string; p_pago_em: string; p_payload?: Json }
        Returns: {
          boleto_modo: Database["public"]["Enums"]["boleto_modo"]
          boleto_url: string | null
          competencia_ano: number | null
          competencia_mes: number | null
          cora_invoice_id: string | null
          created_at: string
          descricao: string | null
          dias_semana: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          frequencia_atendimento: string | null
          id: string
          observacoes: string | null
          paciente_id: string
          pago_em: string | null
          parcela_numero: number | null
          parcela_total: number | null
          parcelamento_grupo_id: string | null
          pix_emv: string | null
          qtd_sessoes: number | null
          regime: Database["public"]["Enums"]["regime_cobranca"] | null
          servico: string | null
          status: Database["public"]["Enums"]["cobranca_status"]
          tipo: Database["public"]["Enums"]["paciente_tipo"]
          updated_at: string
          valor: number
          vencimento: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "cobrancas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      paciente_logado: { Args: never; Returns: string }
      paciente_portal_can_read_relatorio: {
        Args: { p_paciente_id: string }
        Returns: boolean
      }
      processar_boleto_emissao_data_especifica: {
        Args: { p_dia?: number }
        Returns: Json
      }
      processar_nf_emissao_data_especifica: {
        Args: { p_dia?: number }
        Returns: Json
      }
      relatorio_receita_convenio: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          convenio: string
          faturado: number
          nfs_emitidas: number
          pacientes: number
          recebido: number
          sessoes: number
        }[]
      }
      remarcar_agendamentos_lote: {
        Args: {
          p_agendamento_id: string
          p_duracao_min?: number
          p_escopo: string
          p_novo_fisio_id?: string
          p_novo_inicio: string
          p_usuario_id?: string
        }
        Returns: Json
      }
      resolver_destinatario_nf: {
        Args: { p_cobranca_id: string }
        Returns: Json
      }
      set_periodizacao_pdf_url: {
        Args: { p_paciente_id: string; p_url: string }
        Returns: undefined
      }
      set_relatorio_atendimento_pdf_url: {
        Args: { p_pdf_url: string; p_relatorio_id: string }
        Returns: undefined
      }
      staff_can_manage_pacientes: { Args: never; Returns: boolean }
      staff_can_view_finance: { Args: never; Returns: boolean }
      staff_has_full_agenda_access: { Args: never; Returns: boolean }
      staff_has_full_patient_access: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "gestao" | "recepcao" | "fisio" | "membro" | "cliente"
      boleto_modo: "automatico" | "manual"
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
      modelo_relatorio: "convencional" | "unimed" | "sharepoint" | "puc"
      modo_emissao_nf: "automatico_pagamento" | "data_especifica"
      nf_status:
        | "pendente"
        | "emitida"
        | "cancelada"
        | "erro"
        | "regularizada_retroativa"
        | "processando"
      paciente_tipo: "particular" | "judicial" | "convenio" | "puc"
      periodizacao_status:
        | "planejada"
        | "em_andamento"
        | "concluida"
        | "cancelada"
      regime_cobranca: "mensalista" | "por_sessao"
      status_agendamento:
        | "agendado"
        | "confirmado"
        | "realizado"
        | "faltou"
        | "cancelado"
        | "remarcacao"
        | "indisponivel"
        | "ferias"
        | "horario_extra"
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
      app_role: ["admin", "gestao", "recepcao", "fisio", "membro", "cliente"],
      boleto_modo: ["automatico", "manual"],
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
      modelo_relatorio: ["convencional", "unimed", "sharepoint", "puc"],
      modo_emissao_nf: ["automatico_pagamento", "data_especifica"],
      nf_status: [
        "pendente",
        "emitida",
        "cancelada",
        "erro",
        "regularizada_retroativa",
        "processando",
      ],
      paciente_tipo: ["particular", "judicial", "convenio", "puc"],
      periodizacao_status: [
        "planejada",
        "em_andamento",
        "concluida",
        "cancelada",
      ],
      regime_cobranca: ["mensalista", "por_sessao"],
      status_agendamento: [
        "agendado",
        "confirmado",
        "realizado",
        "faltou",
        "cancelado",
        "remarcacao",
        "indisponivel",
        "ferias",
        "horario_extra",
      ],
    },
  },
} as const
