import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VERSICULOS_ANIVERSARIO = [
  { texto: "O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti e te conceda graça.", ref: "Nm 6,24-25" },
  { texto: "Pois eu bem sei os planos que tenho para vós, diz o Senhor; planos de paz e não de mal, para vos dar um futuro e uma esperança.", ref: "Jr 29,11" },
  { texto: "Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus; eu te fortaleço, e te ajudo, e te sustento com a minha destra fiel.", ref: "Is 41,10" },
  { texto: "Tudo tem o seu tempo determinado, e há tempo para todo propósito debaixo do céu.", ref: "Ecl 3,1" },
  { texto: "O Senhor é o meu pastor; nada me faltará.", ref: "Sl 23,1" },
  { texto: "Porque dele, e por ele, e para ele são todas as coisas. A ele seja a glória para sempre. Amém.", ref: "Rm 11,36" },
  { texto: "Este é o dia que o Senhor fez; regozijemo-nos e alegremo-nos nele.", ref: "Sl 118,24" },
  { texto: "Deem graças ao Senhor porque ele é bom; o seu amor dura para sempre.", ref: "Sl 136,1" },
];

function formatarReais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function gerarEmailAniversarioHTML(params: {
  nomeParoquia: string;
  logoUrl: string;
  corPrimaria: string;
  nome: string;
  versiculo: { texto: string; ref: string };
  cnpj?: string;
  site?: string;
}): string {
  const { nomeParoquia, logoUrl, corPrimaria, nome, versiculo, cnpj, site } = params;
  const cor = corPrimaria?.includes('%') ? `hsl(${corPrimaria})` : (corPrimaria || "#7c3aed");
  const primeiroNome = nome.split(" ")[0];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Feliz Aniversário!</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- HEADER -->
          <tr>
            <td style="background:${cor};padding:40px 24px;text-align:center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${nomeParoquia}" style="max-height:64px;max-width:200px;margin-bottom:16px;display:inline-block;" />` : ""}
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:0.5px;">
                🎂 Feliz Aniversário!
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">
                ${nomeParoquia}
              </p>
            </td>
          </tr>
          <!-- MAIN -->
          <tr>
            <td style="padding:36px 28px;">
              <h2 style="margin:0 0 16px;color:${cor};font-size:24px;font-weight:700;">
                Parabéns, ${primeiroNome}! 🎉
              </h2>
              <p style="margin:0 0 16px;color:#333;font-size:16px;line-height:1.7;">
                Neste dia especial, toda a comunidade da <strong>${nomeParoquia}</strong> se une em oração
                para agradecer a Deus pelo dom da sua vida. Cada ano que se completa é uma nova
                oportunidade de experimentar o amor infinito do Pai.
              </p>
              <p style="margin:0 0 16px;color:#333;font-size:16px;line-height:1.7;">
                Somos profundamente gratos pela sua presença em nossa comunidade e por cada gesto
                de fé, generosidade e amor que você compartilha conosco. Sua vida é uma bênção
                para todos que o cercam.
              </p>
              <p style="margin:0 0 24px;color:#333;font-size:16px;line-height:1.7;">
                Que o Senhor continue derramando abundantes graças sobre você e sua família.
                Que este novo ano de vida seja repleto de saúde, paz, alegria e muitas realizações
                ao lado de quem você ama. 🙏
              </p>

              <!-- Versículo -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="border-left:4px solid ${cor};border-radius:0 12px 12px 0;margin-bottom:28px;background:#f8f9fc;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 10px;font-style:italic;color:#555;font-size:16px;line-height:1.7;">
                      "${versiculo.texto}"
                    </p>
                    <p style="margin:0;color:${cor};font-weight:bold;font-size:14px;">
                      — ${versiculo.ref}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Selo decorativo -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8f9fc;border-radius:12px;border:1px solid #e8e8ee;margin-bottom:16px;">
                <tr>
                  <td style="padding:20px;text-align:center;">
                    <span style="font-size:40px;display:block;margin-bottom:8px;">🕊️</span>
                    <span style="font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#888;display:block;">
                      Com carinho e oração
                    </span>
                    <span style="font-size:16px;font-weight:bold;color:${cor};display:block;margin-top:4px;">
                      ${nomeParoquia}
                    </span>
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
                      Este e-mail foi enviado automaticamente. <strong>Por favor, não responda.</strong>
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

    let body: any = {};
    try { body = await req.json(); } catch { /* GET / sem body */ }
    const isPreview = body?.preview === true;

    // Fetch parish config
    const { data: config } = await supabase
      .from("configuracoes_paroquia")
      .select("nome, cnpj, logo_url, cor_primaria, site, resend_api_key, resend_from_email, email_agradecimento_ativo, email_aniversario_ativo")
      .limit(1)
      .maybeSingle();

    // PREVIEW: monta o HTML com dados de exemplo e retorna sem enviar
    if (isPreview) {
      const versiculo = VERSICULOS_ANIVERSARIO[0];
      const nomeExemplo = body?.nome || "Maria";
      const html = gerarEmailAniversarioHTML({
        nomeParoquia: config?.nome || "Paróquia",
        logoUrl: config?.logo_url || "",
        corPrimaria: config?.cor_primaria || "#7c3aed",
        nome: nomeExemplo,
        versiculo,
        cnpj: config?.cnpj || undefined,
        site: config?.site || undefined,
      });
      return new Response(
        JSON.stringify({
          success: true,
          preview: true,
          subject: `🎂 Feliz Aniversário, ${nomeExemplo}! — ${config?.nome || "Paróquia"}`,
          html,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = config?.resend_api_key;
    const resendFromEmail = config?.resend_from_email;

    if (!resendApiKey || !resendFromEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Resend não configurado." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Flag dedicada; fallback para a antiga email_agradecimento_ativo caso ainda não preenchida
    const ativo = (config as any)?.email_aniversario_ativo ?? config?.email_agradecimento_ativo;
    if (!ativo) {
      return new Response(
        JSON.stringify({ success: false, reason: "desativado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // Find parishioners with birthday today (São Paulo timezone)
    const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const mesStr = String(hoje.getMonth() + 1).padStart(2, "0");
    const diaStr = String(hoje.getDate()).padStart(2, "0");

    const { data: aniversariantes, error: errFetch } = await supabase
      .from("paroquianos")
      .select("id, nome_completo, email, data_nascimento")
      .eq("status", "ativo")
      .not("email", "is", null)
      .not("data_nascimento", "is", null);

    if (errFetch) {
      console.error("Erro ao buscar aniversariantes:", errFetch);
      return new Response(
        JSON.stringify({ success: false, error: errFetch.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter by month/day
    const aniversariantesHoje = (aniversariantes || []).filter((p) => {
      if (!p.data_nascimento) return false;
      const parts = p.data_nascimento.split("-");
      return parts[1] === mesStr && parts[2] === diaStr;
    });

    if (aniversariantesHoje.length === 0) {
      return new Response(
        JSON.stringify({ success: true, enviados: 0, mensagem: "Nenhum aniversariante hoje." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nomeParoquia = config?.nome || "Paróquia";
    const logoUrl = config?.logo_url || "";
    const corPrimaria = config?.cor_primaria || "#7c3aed";
    const cnpj = config?.cnpj || undefined;
    const site = config?.site || undefined;

    let enviados = 0;
    const erros: string[] = [];

    for (const p of aniversariantesHoje) {
      if (!p.email) continue;

      // Pick a random verse
      const versiculo = VERSICULOS_ANIVERSARIO[Math.floor(Math.random() * VERSICULOS_ANIVERSARIO.length)];

      const html = gerarEmailAniversarioHTML({
        nomeParoquia, logoUrl, corPrimaria,
        nome: p.nome_completo,
        versiculo, cnpj, site,
      });

      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${nomeParoquia} <${resendFromEmail}>`,
          to: [p.email],
          subject: `🎂 Feliz Aniversário, ${p.nome_completo.split(" ")[0]}! — ${nomeParoquia}`,
          html,
        }),
      });

      if (resendResp.ok) {
        enviados++;
        console.log(`E-mail de aniversário enviado para ${p.email}`);
      } else {
        const errData = await resendResp.json().catch(() => ({}));
        console.error(`Erro ao enviar para ${p.email}:`, errData);
        erros.push(`${p.email}: ${errData?.message || resendResp.status}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        enviados,
        total_aniversariantes: aniversariantesHoje.length,
        erros: erros.length > 0 ? erros : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro na edge function enviar-email-aniversario:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
