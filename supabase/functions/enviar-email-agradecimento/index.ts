import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  pagamento_id: string;
  paroquiano_id?: string;
  nome_contribuinte?: string;
  valor: number;
  tipo: string;
  metodo?: string;
  mes_referencia?: string;
  email_teste?: string; // For test emails
}

const TIPO_LABEL: Record<string, string> = {
  dizimo: "Dízimo",
  oferta: "Oferta",
  campanha: "Campanha",
  eventual: "Doação",
};

const METODO_LABEL: Record<string, string> = {
  pix: "PIX",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
};

function formatarReais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarMesReferencia(mes?: string): string | null {
  if (!mes) return null;
  const d = new Date(mes + "T12:00:00");
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function gerarEmailHTML(params: {
  nomeParoquia: string;
  logoUrl: string;
  corPrimaria: string;
  nome: string;
  valor: number;
  tipo: string;
  metodo: string;
  mesReferencia?: string;
  pagamentoId: string;
  cnpj?: string;
  site?: string;
}): string {
  const {
    nomeParoquia, logoUrl, corPrimaria, nome, valor, tipo, metodo,
    mesReferencia, pagamentoId, cnpj, site,
  } = params;

  // Convert HSL string "40 55% 54%" to a usable CSS color
  const cor = corPrimaria?.includes('%') ? `hsl(${corPrimaria})` : (corPrimaria || "#7c3aed");
  const mesRef = formatarMesReferencia(mesReferencia);
  const primeiroNome = nome.split(" ")[0];
  const dataFormatada = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const mesReferenciaRow = mesRef
    ? `<tr>
        <td style="padding:8px 16px;color:#666;font-size:14px;">Mês de Referência</td>
        <td style="padding:8px 16px;text-align:right;font-weight:bold;font-size:14px;">${mesRef}</td>
       </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Comprovante de Contribuição</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- HEADER -->
          <tr>
            <td style="background:${cor};padding:32px 24px;text-align:center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${nomeParoquia}" style="max-height:64px;max-width:200px;margin-bottom:12px;display:inline-block;" />` : ""}
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                ${nomeParoquia}
              </h1>
            </td>
          </tr>
          <!-- MAIN -->
          <tr>
            <td style="padding:32px 24px;">
              <h2 style="margin:0 0 8px;color:${cor};font-size:26px;font-weight:700;">
                Deus lhe pague! 🙏
              </h2>
              <p style="margin:0 0 24px;color:#333;font-size:16px;line-height:1.6;">
               Olá, <strong>${primeiroNome}</strong>! ${tipo === 'dizimo' ? 'Seu dízimo foi recebido' : 'Sua contribuição foi recebida'} com sucesso.
                Agradecemos de coração pela sua generosidade. ${tipo === 'dizimo' ? 'Seu dízimo sustenta' : 'Cada oferta sustenta'} a missão
                e a comunidade da nossa paróquia.
              </p>
              <!-- Resumo -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8f9fc;border-radius:12px;border:1px solid #e8e8ee;margin-bottom:24px;">
                <tr>
                  <td colspan="2" style="padding:16px;text-align:center;border-bottom:1px solid #e8e8ee;">
                    <span style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#888;">
                      Comprovante de ${tipo === 'dizimo' ? 'Dízimo' : 'Contribuição'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;color:#666;font-size:14px;">Tipo</td>
                  <td style="padding:8px 16px;text-align:right;font-weight:bold;font-size:14px;">
                    ${TIPO_LABEL[tipo] || tipo}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;color:#666;font-size:14px;">Valor</td>
                  <td style="padding:8px 16px;text-align:right;font-weight:bold;font-size:20px;color:${cor};">
                    ${formatarReais(valor)}
                  </td>
                </tr>
                ${mesReferenciaRow}
                <tr>
                  <td style="padding:8px 16px;color:#666;font-size:14px;">Método</td>
                  <td style="padding:8px 16px;text-align:right;font-weight:bold;font-size:14px;">
                    ${METODO_LABEL[metodo] || metodo}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;color:#666;font-size:14px;">Data</td>
                  <td style="padding:8px 16px;text-align:right;font-size:14px;">
                    ${dataFormatada}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;color:#666;font-size:14px;">ID</td>
                  <td style="padding:8px 16px;text-align:right;font-family:monospace;font-size:12px;color:#999;">
                    #${pagamentoId.slice(0, 8).toUpperCase()}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:12px 16px;text-align:center;border-top:1px solid #e8e8ee;">
                    <span style="display:inline-block;background:${cor};color:#fff;padding:4px 16px;border-radius:20px;font-size:13px;font-weight:bold;letter-spacing:1px;">
                      ✓ PAGO
                    </span>
                  </td>
                </tr>
              </table>
              <!-- Citação bíblica -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="border-left:4px solid ${cor};border-radius:0 8px 8px 0;margin-bottom:24px;background:#f8f9fc;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-style:italic;color:#555;font-size:15px;line-height:1.6;">
                      "Cada um dê conforme determinou em seu coração, sem tristeza nem por obrigação,
                      porque Deus ama quem dá com alegria."
                    </p>
                    <p style="margin:0;color:${cor};font-weight:bold;font-size:14px;">
                      — 2 Coríntios 9,7
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background:#f8f9fc;padding:24px;border-top:1px solid #e8e8ee;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;">
                    <p style="margin:0 0 8px;color:#888;font-size:13px;">${nomeParoquia}</p>
                    ${cnpj ? `<p style="margin:0 0 4px;color:#aaa;font-size:12px;">CNPJ: ${cnpj}</p>` : ""}
                    ${site ? `<p style="margin:0 0 12px;color:#aaa;font-size:12px;">${site}</p>` : ""}
                    <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;" />
                    <p style="margin:0;color:#bbb;font-size:11px;line-height:1.5;">
                      Este e-mail foi enviado automaticamente. <strong>Por favor, não responda.</strong><br />
                      Guarde este comprovante para seus registros.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: EmailPayload = await req.json();
    const { pagamento_id, paroquiano_id, nome_contribuinte, valor, tipo, metodo, mes_referencia, email_teste } = payload;

    if (!pagamento_id || !valor || !tipo) {
      return new Response(
        JSON.stringify({ success: false, error: "Dados incompletos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch parish config (includes Resend keys)
    const { data: config } = await supabase
      .from("configuracoes_paroquia")
      .select("nome, cnpj, logo_url, cor_primaria, site, resend_api_key, resend_from_email, email_agradecimento_ativo")
      .limit(1)
      .maybeSingle();

    const resendApiKey = config?.resend_api_key;
    const resendFromEmail = config?.resend_from_email;
    const emailAtivo = config?.email_agradecimento_ativo;

    // For test emails, skip the "ativo" check but still require keys
    if (!email_teste && !emailAtivo) {
      console.log("E-mail de agradecimento desativado nas configurações.");
      return new Response(
        JSON.stringify({ success: false, reason: "desativado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!resendApiKey || !resendFromEmail) {
      console.error("Resend não configurado: chaves ausentes");
      return new Response(
        JSON.stringify({ success: false, error: "Resend não configurado. Configure a API Key e o e-mail remetente nas configurações." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine recipient
    let emailDestinatario: string | null = email_teste || null;
    let nomeDestinatario = nome_contribuinte || (tipo === 'dizimo' ? 'Dizimista' : 'Fiel');

    if (!emailDestinatario && paroquiano_id) {
      const { data: paroquiano } = await supabase
        .from("paroquianos")
        .select("email, nome_completo")
        .eq("id", paroquiano_id)
        .maybeSingle();

      if (paroquiano?.email) {
        emailDestinatario = paroquiano.email;
        nomeDestinatario = paroquiano.nome_completo || nomeDestinatario;
      }
    }

    if (!emailDestinatario) {
      console.log("Paroquiano sem e-mail cadastrado, e-mail não enviado.");
      return new Response(
        JSON.stringify({ success: false, reason: "sem_email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nomeParoquia = config?.nome || "Paróquia";
    const logoUrl = config?.logo_url || "";
    const corPrimaria = config?.cor_primaria || "#7c3aed";
    const cnpj = config?.cnpj || undefined;
    const site = config?.site || undefined;

    const html = gerarEmailHTML({
      nomeParoquia, logoUrl, corPrimaria,
      nome: nomeDestinatario, valor, tipo,
      metodo: metodo || "pix",
      mesReferencia: mes_referencia,
      pagamentoId: pagamento_id,
      cnpj, site,
    });

    // Send via Resend
    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${nomeParoquia} <${resendFromEmail}>`,
        to: [emailDestinatario],
        subject: `✝️ Comprovante de ${TIPO_LABEL[tipo] || tipo} — ${nomeParoquia}`,
        html,
      }),
    });

    if (!resendResp.ok) {
      const errData = await resendResp.json().catch(() => ({}));
      console.error("Resend error:", resendResp.status, JSON.stringify(errData));
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao enviar e-mail", details: errData?.message || String(resendResp.status) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`E-mail de agradecimento enviado para ${emailDestinatario}`);

    return new Response(
      JSON.stringify({ success: true, email: emailDestinatario }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro na edge function enviar-email-agradecimento:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
