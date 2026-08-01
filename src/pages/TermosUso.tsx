import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AppFooter from "@/components/AppFooter";

const TermosUso: React.FC = () => {
  const [nomeParoquia, setNomeParoquia] = useState("a Paróquia");

  useEffect(() => {
    supabase
      .from("configuracoes_paroquia")
      .select("nome")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nome) setNomeParoquia(data.nome);
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
            <ScrollText className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-foreground text-lg">Termos de Uso</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="max-w-3xl mx-auto prose prose-sm dark:prose-invert">
          <p className="text-muted-foreground text-sm mb-8">
            Última atualização: {hoje}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">1. Aceitação dos Termos</h2>
            <p className="text-foreground/80 leading-relaxed">
              Ao acessar e utilizar o sistema de gestão de dízimos e contribuições de{" "}
              <strong>{nomeParoquia}</strong> ("Sistema"), você concorda com estes Termos de Uso.
              Se não concordar com qualquer disposição, não utilize o Sistema.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">2. Descrição do Serviço</h2>
            <p className="text-foreground/80 leading-relaxed mb-3">
              O Sistema é uma plataforma digital de gestão financeira e pastoral, destinada exclusivamente
              ao registro, controle e processamento de contribuições financeiras dos fiéis à paróquia. As
              funcionalidades incluem:
            </p>
            <ul className="list-disc list-inside space-y-1 text-foreground/80">
              <li>Registro e consulta de contribuições (dízimos, ofertas, doações e campanhas);</li>
              <li>Processamento de pagamentos via PIX e cartão de crédito/débito;</li>
              <li>Emissão de comprovantes de pagamento;</li>
              <li>Autoatendimento por meio de terminal físico (Totem);</li>
              <li>Painel administrativo para gestão paroquial.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">3. Cadastro e Acesso</h2>
            <p className="text-foreground/80 leading-relaxed">
              O acesso ao Sistema requer cadastro com informações verdadeiras e atualizadas. O usuário é
              responsável pela confidencialidade de suas credenciais de acesso (e-mail e senha). Qualquer
              uso não autorizado deve ser reportado imediatamente à administração paroquial. A paróquia
              reserva-se o direito de suspender contas que violem estes Termos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">4. Uso Permitido</h2>
            <p className="text-foreground/80 leading-relaxed mb-3">O Sistema deve ser utilizado exclusivamente para:</p>
            <ul className="list-disc list-inside space-y-1 text-foreground/80">
              <li>Realizar contribuições financeiras à paróquia;</li>
              <li>Consultar o histórico de contribuições próprias;</li>
              <li>Obter comprovantes de pagamento;</li>
              <li>Gerenciar dados cadastrais pessoais.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">5. Uso Proibido</h2>
            <p className="text-foreground/80 leading-relaxed mb-3">É expressamente proibido:</p>
            <ul className="list-disc list-inside space-y-1 text-foreground/80">
              <li>Utilizar o Sistema para fins ilegais ou fraudulentos;</li>
              <li>Tentar acessar dados de outros usuários sem autorização;</li>
              <li>Realizar engenharia reversa ou tentativas de invasão (pentest não autorizado);</li>
              <li>Inserir informações falsas no cadastro;</li>
              <li>Interferir no funcionamento do Sistema.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">6. Pagamentos e Contribuições</h2>
            <p className="text-foreground/80 leading-relaxed">
              As contribuições realizadas por meio do Sistema são de caráter voluntário e destinadas
              exclusivamente às atividades pastorais e manutenção da paróquia. Os pagamentos são processados
              por gateway de pagamentos certificado pelo Banco Central do Brasil (e.Rede/Itaú) com segurança
              PCI-DSS. A paróquia não armazena dados completos de cartão de crédito/débito. Comprovantes
              são emitidos para todas as transações concluídas com sucesso.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">7. Estornos e Cancelamentos</h2>
            <p className="text-foreground/80 leading-relaxed">
              Pedidos de estorno ou cancelamento de contribuições devem ser solicitados diretamente na
              secretaria paroquial, com apresentação do comprovante de pagamento. Estornos estão sujeitos
              às políticas do gateway de pagamentos e às normas do Banco Central.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">8. Limitação de Responsabilidade</h2>
            <p className="text-foreground/80 leading-relaxed">
              A paróquia emprega medidas razoáveis de segurança, mas não garante disponibilidade
              ininterrupta do Sistema. Não nos responsabilizamos por danos decorrentes de falhas de
              conectividade à internet, interrupções de serviços de terceiros (gateway de pagamentos,
              serviços de nuvem) ou uso indevido pelo próprio usuário.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">9. Propriedade Intelectual</h2>
            <p className="text-foreground/80 leading-relaxed">
              O Sistema, incluindo seu código-fonte, design e conteúdo, é de propriedade de{" "}
              <strong>{nomeParoquia}</strong> e de seus desenvolvedores. É vedada a reprodução, distribuição
              ou modificação sem autorização expressa por escrito.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">10. Privacidade</h2>
            <p className="text-foreground/80 leading-relaxed">
              O tratamento de dados pessoais é regido pela nossa{" "}
              <Link to="/politica-de-privacidade" className="text-primary underline">
                Política de Privacidade
              </Link>
              , elaborada em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-3">11. Alterações nos Termos</h2>
            <p className="text-foreground/80 leading-relaxed">
              Estes Termos podem ser atualizados a qualquer momento. O uso continuado do Sistema após
              notificação de alterações constitui aceite das novas condições.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">12. Foro e Lei Aplicável</h2>
            <p className="text-foreground/80 leading-relaxed">
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro
              da Comarca sede de <strong>{nomeParoquia}</strong> para dirimir quaisquer controvérsias
              decorrentes deste instrumento.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
};

export default TermosUso;
