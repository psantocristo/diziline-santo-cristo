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
      avisos_totem: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          duracao_segundos: number
          id: string
          imagem_url: string | null
          link_url: string | null
          mensagem: string
          ordem: number
          tela_cheia: boolean
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          duracao_segundos?: number
          id?: string
          imagem_url?: string | null
          link_url?: string | null
          mensagem: string
          ordem?: number
          tela_cheia?: boolean
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          duracao_segundos?: number
          id?: string
          imagem_url?: string | null
          link_url?: string | null
          mensagem?: string
          ordem?: number
          tela_cheia?: boolean
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      campanhas: {
        Row: {
          ativo: boolean
          banner_url: string | null
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          id: string
          meta_financeira: number | null
          nome: string
          qrcode_exclusivo: string | null
          total_arrecadado: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          id?: string
          meta_financeira?: number | null
          nome: string
          qrcode_exclusivo?: string | null
          total_arrecadado?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          meta_financeira?: number | null
          nome?: string
          qrcode_exclusivo?: string | null
          total_arrecadado?: number
          updated_at?: string
        }
        Relationships: []
      }
      categorias_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["contribuicao_tipo"]
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tipo: Database["public"]["Enums"]["contribuicao_tipo"]
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["contribuicao_tipo"]
        }
        Relationships: []
      }
      certificados_emitidos: {
        Row: {
          created_at: string
          dados: Json
          data_cerimonia: string | null
          emitido_por: string | null
          id: string
          nome_completo: string
          tamanho: string
          tipo: string
        }
        Insert: {
          created_at?: string
          dados?: Json
          data_cerimonia?: string | null
          emitido_por?: string | null
          id?: string
          nome_completo: string
          tamanho?: string
          tipo: string
        }
        Update: {
          created_at?: string
          dados?: Json
          data_cerimonia?: string | null
          emitido_por?: string | null
          id?: string
          nome_completo?: string
          tamanho?: string
          tipo?: string
        }
        Relationships: []
      }
      comprovantes: {
        Row: {
          created_at: string
          enviado_whatsapp: boolean | null
          id: string
          mensagem_pastoral: string | null
          pagamento_id: string
          pdf_url: string | null
          versículo: string | null
          whatsapp_enviado_em: string | null
        }
        Insert: {
          created_at?: string
          enviado_whatsapp?: boolean | null
          id?: string
          mensagem_pastoral?: string | null
          pagamento_id: string
          pdf_url?: string | null
          versículo?: string | null
          whatsapp_enviado_em?: string | null
        }
        Update: {
          created_at?: string
          enviado_whatsapp?: boolean | null
          id?: string
          mensagem_pastoral?: string | null
          pagamento_id?: string
          pdf_url?: string | null
          versículo?: string | null
          whatsapp_enviado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comprovantes_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      comunidades: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes_gateway: {
        Row: {
          api_key: string | null
          api_key_secret_name: string | null
          ativo: boolean
          client_id: string | null
          client_secret: string | null
          credito_ativo: boolean
          debito_ativo: boolean
          extra_config: Json | null
          id: string
          merchant_id: string | null
          modo: string
          nome: string
          oauth_url_producao: string | null
          oauth_url_sandbox: string | null
          parcelamento_juros: number | null
          parcelamento_max: number | null
          pix_ativo: boolean
          pix_expiracao_minutos: number | null
          producao_url: string | null
          provedor: string
          provedor_fallback: string | null
          sandbox_url: string | null
          updated_at: string
          webhook_hmac_obrigatorio: boolean
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          api_key_secret_name?: string | null
          ativo?: boolean
          client_id?: string | null
          client_secret?: string | null
          credito_ativo?: boolean
          debito_ativo?: boolean
          extra_config?: Json | null
          id?: string
          merchant_id?: string | null
          modo?: string
          nome?: string
          oauth_url_producao?: string | null
          oauth_url_sandbox?: string | null
          parcelamento_juros?: number | null
          parcelamento_max?: number | null
          pix_ativo?: boolean
          pix_expiracao_minutos?: number | null
          producao_url?: string | null
          provedor?: string
          provedor_fallback?: string | null
          sandbox_url?: string | null
          updated_at?: string
          webhook_hmac_obrigatorio?: boolean
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          api_key_secret_name?: string | null
          ativo?: boolean
          client_id?: string | null
          client_secret?: string | null
          credito_ativo?: boolean
          debito_ativo?: boolean
          extra_config?: Json | null
          id?: string
          merchant_id?: string | null
          modo?: string
          nome?: string
          oauth_url_producao?: string | null
          oauth_url_sandbox?: string | null
          parcelamento_juros?: number | null
          parcelamento_max?: number | null
          pix_ativo?: boolean
          pix_expiracao_minutos?: number | null
          producao_url?: string | null
          provedor?: string
          provedor_fallback?: string | null
          sandbox_url?: string | null
          updated_at?: string
          webhook_hmac_obrigatorio?: boolean
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      configuracoes_paroquia: {
        Row: {
          cadastro_aberto: boolean
          chave_pix: string | null
          cnpj: string | null
          comprovante_config: Json | null
          cor_acento: string | null
          cor_fonte: string | null
          cor_primaria: string | null
          cor_secundaria: string | null
          email_agradecimento_ativo: boolean
          email_aniversario_ativo: boolean
          endereco: string | null
          id: string
          impressora_preset: string | null
          logo_carteirinha_url: string | null
          logo_termico_url: string | null
          logo_url: string | null
          loja_ativa: boolean
          nome: string | null
          notif_aniversario_ativo: boolean
          notif_atraso_ativo: boolean
          notif_melhor_dia_ativo: boolean
          pin_totem: string | null
          resend_api_key: string | null
          resend_from_email: string | null
          site: string | null
          slogan: string | null
          tamanho_fonte: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cadastro_aberto?: boolean
          chave_pix?: string | null
          cnpj?: string | null
          comprovante_config?: Json | null
          cor_acento?: string | null
          cor_fonte?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          email_agradecimento_ativo?: boolean
          email_aniversario_ativo?: boolean
          endereco?: string | null
          id?: string
          impressora_preset?: string | null
          logo_carteirinha_url?: string | null
          logo_termico_url?: string | null
          logo_url?: string | null
          loja_ativa?: boolean
          nome?: string | null
          notif_aniversario_ativo?: boolean
          notif_atraso_ativo?: boolean
          notif_melhor_dia_ativo?: boolean
          pin_totem?: string | null
          resend_api_key?: string | null
          resend_from_email?: string | null
          site?: string | null
          slogan?: string | null
          tamanho_fonte?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cadastro_aberto?: boolean
          chave_pix?: string | null
          cnpj?: string | null
          comprovante_config?: Json | null
          cor_acento?: string | null
          cor_fonte?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          email_agradecimento_ativo?: boolean
          email_aniversario_ativo?: boolean
          endereco?: string | null
          id?: string
          impressora_preset?: string | null
          logo_carteirinha_url?: string | null
          logo_termico_url?: string | null
          logo_url?: string | null
          loja_ativa?: boolean
          nome?: string | null
          notif_aniversario_ativo?: boolean
          notif_atraso_ativo?: boolean
          notif_melhor_dia_ativo?: boolean
          pin_totem?: string | null
          resend_api_key?: string | null
          resend_from_email?: string | null
          site?: string | null
          slogan?: string | null
          tamanho_fonte?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes_tef: {
        Row: {
          ativo: boolean | null
          credito_ativo: boolean
          debito_ativo: boolean
          extra_config: Json | null
          id: string
          middleware_token: string | null
          middleware_url: string
          middleware_urls: Json
          modo: string | null
          provedor_tef: string
          status_conexao: string | null
          terminal_id: string | null
          timeout_segundos: number | null
          ultimo_teste: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          credito_ativo?: boolean
          debito_ativo?: boolean
          extra_config?: Json | null
          id?: string
          middleware_token?: string | null
          middleware_url?: string
          middleware_urls?: Json
          modo?: string | null
          provedor_tef?: string
          status_conexao?: string | null
          terminal_id?: string | null
          timeout_segundos?: number | null
          ultimo_teste?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          credito_ativo?: boolean
          debito_ativo?: boolean
          extra_config?: Json | null
          id?: string
          middleware_token?: string | null
          middleware_url?: string
          middleware_urls?: Json
          modo?: string | null
          provedor_tef?: string
          status_conexao?: string | null
          terminal_id?: string | null
          timeout_segundos?: number | null
          ultimo_teste?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      edge_rate_limits: {
        Row: {
          bucket: string
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          key: string
          window_start?: string
        }
        Update: {
          bucket?: string
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      itens_pedido: {
        Row: {
          created_at: string
          id: string
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          id?: string
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
        }
        Update: {
          created_at?: string
          id?: string
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_pedido_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          entidade: string | null
          entidade_id: string | null
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      logs_terminal: {
        Row: {
          created_at: string
          detalhes: string | null
          id: string
          mensagem: string
          origem: string
          pagamento_id: string | null
          return_code: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          detalhes?: string | null
          id?: string
          mensagem: string
          origem?: string
          pagamento_id?: string | null
          return_code?: string | null
          tipo?: string
        }
        Update: {
          created_at?: string
          detalhes?: string | null
          id?: string
          mensagem?: string
          origem?: string
          pagamento_id?: string | null
          return_code?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_terminal_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_webhook: {
        Row: {
          assinatura: string | null
          created_at: string
          erro: string | null
          evento: string
          id: string
          pagamento_id: string | null
          payload: Json | null
          status_processamento: string | null
        }
        Insert: {
          assinatura?: string | null
          created_at?: string
          erro?: string | null
          evento: string
          id?: string
          pagamento_id?: string | null
          payload?: Json | null
          status_processamento?: string | null
        }
        Update: {
          assinatura?: string | null
          created_at?: string
          erro?: string | null
          evento?: string
          id?: string
          pagamento_id?: string | null
          payload?: Json | null
          status_processamento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_webhook_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      membros_familia: {
        Row: {
          created_at: string
          data_nascimento: string | null
          id: string
          nome: string
          parentesco: string
          paroquiano_id: string
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome: string
          parentesco: string
          paroquiano_id: string
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome?: string
          parentesco?: string
          paroquiano_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membros_familia_paroquiano_id_fkey"
            columns: ["paroquiano_id"]
            isOneToOne: false
            referencedRelation: "paroquianos"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_personalizadas: {
        Row: {
          ativo: boolean
          campanha_id: string | null
          comunidade_id: string | null
          created_at: string
          id: string
          mensagem: string
          tipo: Database["public"]["Enums"]["contribuicao_tipo"] | null
          titulo: string
          updated_at: string
          versiculo: string | null
        }
        Insert: {
          ativo?: boolean
          campanha_id?: string | null
          comunidade_id?: string | null
          created_at?: string
          id?: string
          mensagem: string
          tipo?: Database["public"]["Enums"]["contribuicao_tipo"] | null
          titulo: string
          updated_at?: string
          versiculo?: string | null
        }
        Update: {
          ativo?: boolean
          campanha_id?: string | null
          comunidade_id?: string | null
          created_at?: string
          id?: string
          mensagem?: string
          tipo?: Database["public"]["Enums"]["contribuicao_tipo"] | null
          titulo?: string
          updated_at?: string
          versiculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_personalizadas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_personalizadas_comunidade_id_fkey"
            columns: ["comunidade_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_admin: {
        Row: {
          created_at: string
          dados: Json | null
          id: string
          lida: boolean
          mensagem: string
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          mensagem: string
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          mensagem?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      notificacoes_enviadas: {
        Row: {
          enviada_em: string
          id: string
          payload: Json | null
          referencia: string
          tipo: string
          user_id: string
        }
        Insert: {
          enviada_em?: string
          id?: string
          payload?: Json | null
          referencia: string
          tipo: string
          user_id: string
        }
        Update: {
          enviada_em?: string
          id?: string
          payload?: Json | null
          referencia?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          campanha_id: string | null
          cancelado_em: string | null
          categoria_id: string | null
          codigo_autenticacao: string | null
          comprovante_url: string | null
          cpf_contribuinte: string | null
          created_at: string
          descricao: string | null
          expirado_em: string | null
          gateway_id: string | null
          gateway_payload: Json | null
          gateway_status: string | null
          id: string
          idempotency_key: string | null
          mes_referencia: string | null
          metodo: Database["public"]["Enums"]["pagamento_metodo"]
          nome_contribuinte: string | null
          origem: string | null
          pago_em: string | null
          parcelas: number | null
          paroquiano_id: string | null
          pix_copia_cola: string | null
          pix_expiracao: string | null
          pix_qrcode: string | null
          provedor: string | null
          status: Database["public"]["Enums"]["pagamento_status"]
          tipo: Database["public"]["Enums"]["contribuicao_tipo"]
          updated_at: string
          user_id: string | null
          valor: number
        }
        Insert: {
          campanha_id?: string | null
          cancelado_em?: string | null
          categoria_id?: string | null
          codigo_autenticacao?: string | null
          comprovante_url?: string | null
          cpf_contribuinte?: string | null
          created_at?: string
          descricao?: string | null
          expirado_em?: string | null
          gateway_id?: string | null
          gateway_payload?: Json | null
          gateway_status?: string | null
          id?: string
          idempotency_key?: string | null
          mes_referencia?: string | null
          metodo: Database["public"]["Enums"]["pagamento_metodo"]
          nome_contribuinte?: string | null
          origem?: string | null
          pago_em?: string | null
          parcelas?: number | null
          paroquiano_id?: string | null
          pix_copia_cola?: string | null
          pix_expiracao?: string | null
          pix_qrcode?: string | null
          provedor?: string | null
          status?: Database["public"]["Enums"]["pagamento_status"]
          tipo: Database["public"]["Enums"]["contribuicao_tipo"]
          updated_at?: string
          user_id?: string | null
          valor: number
        }
        Update: {
          campanha_id?: string | null
          cancelado_em?: string | null
          categoria_id?: string | null
          codigo_autenticacao?: string | null
          comprovante_url?: string | null
          cpf_contribuinte?: string | null
          created_at?: string
          descricao?: string | null
          expirado_em?: string | null
          gateway_id?: string | null
          gateway_payload?: Json | null
          gateway_status?: string | null
          id?: string
          idempotency_key?: string | null
          mes_referencia?: string | null
          metodo?: Database["public"]["Enums"]["pagamento_metodo"]
          nome_contribuinte?: string | null
          origem?: string | null
          pago_em?: string | null
          parcelas?: number | null
          paroquiano_id?: string | null
          pix_copia_cola?: string | null
          pix_expiracao?: string | null
          pix_qrcode?: string | null
          provedor?: string | null
          status?: Database["public"]["Enums"]["pagamento_status"]
          tipo?: Database["public"]["Enums"]["contribuicao_tipo"]
          updated_at?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_paroquiano_id_fkey"
            columns: ["paroquiano_id"]
            isOneToOne: false
            referencedRelation: "paroquianos"
            referencedColumns: ["id"]
          },
        ]
      }
      paroquianos: {
        Row: {
          cep: string | null
          cidade: string | null
          comunidade_id: string | null
          cpf: string | null
          created_at: string
          data_inicio_dizimista: string | null
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          estado_civil: string | null
          foto_url: string | null
          id: string
          matricula_paroquial: string | null
          melhor_dia_pagamento: number | null
          nome_completo: string
          notificacoes_push_ativas: boolean
          observacoes: string | null
          status: Database["public"]["Enums"]["paroquiano_status"]
          telefone: string | null
          updated_at: string
          user_id: string | null
          valor_sugerido: number | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          comunidade_id?: string | null
          cpf?: string | null
          created_at?: string
          data_inicio_dizimista?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          id?: string
          matricula_paroquial?: string | null
          melhor_dia_pagamento?: number | null
          nome_completo: string
          notificacoes_push_ativas?: boolean
          observacoes?: string | null
          status?: Database["public"]["Enums"]["paroquiano_status"]
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          valor_sugerido?: number | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          comunidade_id?: string | null
          cpf?: string | null
          created_at?: string
          data_inicio_dizimista?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          id?: string
          matricula_paroquial?: string | null
          melhor_dia_pagamento?: number | null
          nome_completo?: string
          notificacoes_push_ativas?: boolean
          observacoes?: string | null
          status?: Database["public"]["Enums"]["paroquiano_status"]
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          valor_sugerido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paroquianos_comunidade_id_fkey"
            columns: ["comunidade_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cancelado_em: string | null
          codigo_retirada: string
          created_at: string
          id: string
          nome_cliente: string | null
          origem: string
          paroquiano_id: string | null
          retirado_em: string | null
          status: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancelado_em?: string | null
          codigo_retirada?: string
          created_at?: string
          id?: string
          nome_cliente?: string | null
          origem?: string
          paroquiano_id?: string | null
          retirado_em?: string | null
          status?: string
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancelado_em?: string | null
          codigo_retirada?: string
          created_at?: string
          id?: string
          nome_cliente?: string | null
          origem?: string
          paroquiano_id?: string | null
          retirado_em?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_paroquiano_id_fkey"
            columns: ["paroquiano_id"]
            isOneToOne: false
            referencedRelation: "paroquianos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          estoque: number
          id: string
          imagem_url: string | null
          nome: string
          preco: number
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          estoque?: number
          id?: string
          imagem_url?: string | null
          nome: string
          preco: number
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          estoque?: number
          id?: string
          imagem_url?: string | null
          nome?: string
          preco?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          nome_completo: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome_completo: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome_completo?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          platform: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          platform?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          platform?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      servos: {
        Row: {
          ativo: boolean
          comunidade_id: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          comunidade_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          comunidade_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servos_comunidade_id_fkey"
            columns: ["comunidade_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens_client: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          id: string
          ip_ultimo_uso: string | null
          nome: string
          token: string
          ultimo_uso: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          ip_ultimo_uso?: string | null
          nome: string
          token: string
          ultimo_uso?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          ip_ultimo_uso?: string | null
          nome?: string
          token?: string
          ultimo_uso?: string | null
        }
        Relationships: []
      }
      totens: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          created_by: string | null
          credito_ativo: boolean
          debito_ativo: boolean
          id: string
          nome: string
          pix_ativo: boolean
          tef_ativo: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          created_by?: string | null
          credito_ativo?: boolean
          debito_ativo?: boolean
          id?: string
          nome: string
          pix_ativo?: boolean
          tef_ativo?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          created_by?: string | null
          credito_ativo?: boolean
          debito_ativo?: boolean
          id?: string
          nome?: string
          pix_ativo?: boolean
          tef_ativo?: boolean
          updated_at?: string
          user_id?: string | null
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
      gerar_matricula_paroquial: { Args: never; Returns: string }
      get_dashboard_resumo: { Args: { _comunidade_id?: string }; Returns: Json }
      get_gateway_metrics: { Args: { _dias?: number }; Returns: Json }
      get_loja_config: { Args: never; Returns: Json }
      get_meses_dizimista: {
        Args: { _ano: number; _paroquiano_id: string }
        Returns: Json
      }
      get_paroquia_publica: {
        Args: never
        Returns: {
          cor_acento: string
          cor_fonte: string
          cor_primaria: string
          cor_secundaria: string
          id: string
          logo_carteirinha_url: string
          logo_termico_url: string
          logo_url: string
          nome: string
          site: string
          slogan: string
        }[]
      }
      get_servo_comunidade: { Args: { _user_id: string }; Returns: string }
      get_tema_paroquia: { Args: never; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      setup_nova_paroquia: {
        Args: {
          _cnpj?: string
          _email: string
          _nome_paroquia?: string
          _site?: string
        }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "dizimista" | "totem"
      contribuicao_tipo: "dizimo" | "oferta" | "campanha" | "eventual"
      pagamento_metodo: "pix" | "credito" | "debito"
      pagamento_status:
        | "criado"
        | "aguardando_pagamento"
        | "pago"
        | "cancelado"
        | "expirado"
        | "estornado"
      paroquiano_status: "ativo" | "inativo" | "suspenso" | "inadimplente"
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
      app_role: ["super_admin", "admin", "dizimista", "totem"],
      contribuicao_tipo: ["dizimo", "oferta", "campanha", "eventual"],
      pagamento_metodo: ["pix", "credito", "debito"],
      pagamento_status: [
        "criado",
        "aguardando_pagamento",
        "pago",
        "cancelado",
        "expirado",
        "estornado",
      ],
      paroquiano_status: ["ativo", "inativo", "suspenso", "inadimplente"],
    },
  },
} as const
