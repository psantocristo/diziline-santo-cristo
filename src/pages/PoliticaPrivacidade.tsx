import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AppFooter from "@/components/AppFooter";

const PoliticaPrivacidade: React.FC = () => {
  const [nomeParoquia, setNomeParoquia] = useState("a Paróquia");
  const [cnpj, setCnpj] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("configuracoes_paroquia")
      .select("nome, cnpj")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nome) setNomeParoquia(data.nome);
        if (data?.cnpj) setCnpj(data.cnpj);
      });
    window.scrollTo(0, 0);
  }, []);

  const hoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-foreground text-lg">Política de Privacidade</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="max-w-3xl mx-auto prose prose-sm dark:prose-invert">
          <p className="text-muted-foreground text-sm mb-8">
            Última atualização: {hoje}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">1. Identificação do Controlador</h2>
            <p className="text-foreground/80 leading-relaxed">
              A presente Política de Privacidade descreve como <strong>{nomeParoquia}</strong>
              {cnpj && `, CNPJ nº ${cnpj},`} trata os dados pessoais coletados por meio do
              sistema <strong>Dízimos &amp; Contribuições</strong>, em conformidade com a{" "}
              <strong>Lei nº 13.709/2018 (LGPD)</strong> e demais normas aplicáveis.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">2. Dados Coletados</h2>
            <p className="text-foreground/80 leading-relaxed mb-3">Coletamos as seguintes categorias de dados pessoais:</p>
            <ul className="list-disc list-inside space-y-1 text-foreground/80">
              <li><strong>Identificação:</strong> nome completo, CPF, data de nascimento, matrícula paroquial.</li>
              <li><strong>Contato:</strong> e-mail, telefone, endereço.</li>
              <li><strong>Financeiros:</strong> valor das contribuições, método de pagamento (PIX, cartão de crédito/débito), código de autenticação da transação.</li>
              <li><strong>Cadastral:</strong> comunidade de origem, status de dizimista.</li>
              <li><strong>Técnicos:</strong> logs de acesso, endereço IP, agente de usuário (user agent).</li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-3">
              O CPF é coletado exclusivamente para fins de processamento de transações financeiras junto ao gateway de pagamentos (e.Rede / Itaú), conforme exigência regulatória do Banco Central do Brasil.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">3. Finalidade e Base Legal</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-foreground font-semibold">Finalidade</th>
                    <th className="text-left py-2 text-foreground font-semibold">Base Legal (LGPD)</th>
                  </tr>
                </thead>
                <tbody className="text-foreground/80">
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Gestão de dízimos e contribuições</td>
                    <td className="py-2">Legítimo interesse (Art. 7º, IX)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Processamento de pagamentos</td>
                    <td className="py-2">Execução de contrato (Art. 7º, V)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Emissão de comprovantes</td>
                    <td className="py-2">Obrigação legal (Art. 7º, II)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Comunicação pastoral e avisos</td>
                    <td className="py-2">Consentimento (Art. 7º, I)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Segurança e auditoria do sistema</td>
                    <td className="py-2">Legítimo interesse (Art. 7º, IX)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">4. Compartilhamento de Dados</h2>
            <p className="text-foreground/80 leading-relaxed mb-3">
              Os dados poderão ser compartilhados com terceiros apenas nas seguintes hipóteses:
            </p>
            <ul className="list-disc list-inside space-y-1 text-foreground/80">
              <li><strong>Gateway de pagamentos (e.Rede/Itaú):</strong> CPF e nome para processamento de transações com cartão, conforme regulamentação do Banco Central.</li>
              <li><strong>Autoridades competentes:</strong> quando exigido por lei ou ordem judicial.</li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-3">
              <strong>Não vendemos, alugamos ou cedemos seus dados a terceiros para fins comerciais.</strong>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">5. Armazenamento e Segurança</h2>
            <p className="text-foreground/80 leading-relaxed">
              Os dados são armazenados em servidores seguros com criptografia em repouso e em trânsito (TLS 1.2+).
              O acesso é restrito por autenticação multifatorial e controle de papéis (RBAC). Dados sensíveis como CPF
              nunca são expostos à interface do terminal de autoatendimento (Totem), sendo processados exclusivamente
              no servidor. Os dados são retidos pelo período mínimo exigido pela legislação fiscal brasileira (5 anos) e,
              após esse prazo, eliminados de forma segura.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">6. Direitos do Titular</h2>
            <p className="text-foreground/80 leading-relaxed mb-3">
              Nos termos dos Arts. 17 a 22 da LGPD, você tem direito a:
            </p>
            <ul className="list-disc list-inside space-y-1 text-foreground/80">
              <li>Confirmar a existência de tratamento de seus dados;</li>
              <li>Acessar seus dados pessoais;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>Revogar o consentimento a qualquer momento;</li>
              <li>Obter informações sobre o compartilhamento de seus dados.</li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-3">
              Para exercer seus direitos, entre em contato com a secretaria paroquial ou pelo e-mail
              cadastrado em seu perfil no sistema.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">7. Cookies e Dados de Sessão</h2>
            <p className="text-foreground/80 leading-relaxed">
              O sistema utiliza armazenamento local (<em>localStorage</em>) exclusivamente para manutenção da sessão
              autenticada do usuário. Não utilizamos cookies de rastreamento ou publicidade.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">8. Menores de Idade</h2>
            <p className="text-foreground/80 leading-relaxed">
              O sistema não é destinado a menores de 18 anos. Caso identifiquemos o tratamento de dados de menores
              sem o consentimento dos responsáveis, procederemos à exclusão imediata.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">9. Alterações nesta Política</h2>
            <p className="text-foreground/80 leading-relaxed">
              Esta Política poderá ser atualizada periodicamente. As alterações relevantes serão comunicadas
              por meio do sistema ou pelos canais oficiais da paróquia. O uso continuado do sistema após as
              atualizações implica aceitação das mudanças.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">10. Contato e Encarregado (DPO)</h2>
            <p className="text-foreground/80 leading-relaxed">
              Para dúvidas, solicitações ou reclamações relacionadas à privacidade de dados, entre em contato
              com a administração de <strong>{nomeParoquia}</strong> diretamente na secretaria paroquial.
              Você também pode registrar reclamações junto à{" "}
              <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> em{" "}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer"
                className="text-primary underline">
                www.gov.br/anpd
              </a>.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
};

export default PoliticaPrivacidade;
