import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import sicrediLogo from "@/assets/sicredi-logo.png";
import stoneLogo from "@/assets/stone-logo.png";
import redeLogo from "@/assets/rede-itau-logo.png";
import {
  ShieldCheck,
  Smartphone,
  CreditCard,
  Bell,
  BarChart3,
  Users,
  Store,
  QrCode,
  Printer,
  Gift,
  Cloud,
  Palette,
  Lock,
  Zap,
  Calendar,
  Mail,
  MonitorSmartphone,
  Receipt,
  Wallet,
  HeartHandshake,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  Rocket,
  Church,
  Globe,
  Headphones,
  Database,
  Layers,
  RefreshCw,
  FileText,
  Target,
  TrendingUp,
  Quote,
} from "lucide-react";

const modulos = [
  { icon: Smartphone, title: "App do Dizimista (PWA)", desc: "Instalável em iOS e Android. Dashboard com situação anual do dízimo, histórico e comprovantes.", color: "from-amber-400 to-yellow-600" },
  { icon: MonitorSmartphone, title: "Totem de Autoatendimento", desc: "Interface touch para ofertas e dízimos com identificação por CPF, cartão físico ou digital.", color: "from-rose-500 to-red-700" },
  { icon: BarChart3, title: "Painel Administrativo", desc: "Gestão completa de pagamentos, dizimistas, campanhas, relatórios e auditoria.", color: "from-purple-500 to-indigo-700" },
  { icon: Store, title: "Loja Paroquial", desc: "Venda de produtos, pedidos e códigos de retirada para eventos e festas.", color: "from-emerald-500 to-teal-700" },
  { icon: QrCode, title: "Carteirinha Digital", desc: "PDF alta qualidade (formato ID-1) com QR Code assinado por HMAC e verificação pública.", color: "from-sky-500 to-blue-700" },
  { icon: Gift, title: "Sistema de Cortesias", desc: "Concessão de créditos e cartões para equipe e voluntários das festas paroquiais.", color: "from-pink-500 to-fuchsia-700" },
];

const recursos = [
  { icon: CreditCard, title: "Múltiplos Gateways", desc: "Rede (Itaú), Sicredi (Sipag) e Pagar.me (Stone) — troca com um clique." },
  { icon: Printer, title: "Impressora Térmica", desc: "Comprovantes ESC/POS personalizáveis com corte de guilhotina." },
  { icon: Bell, title: "Notificações Push", desc: "Lembretes de dízimo, aniversários e avisos — iOS e Android." },
  { icon: Mail, title: "E-mails Automáticos", desc: "Confirmação de cadastro, agradecimento e aniversário personalizados." },
  { icon: Calendar, title: "Calendário Sincronizado", desc: "Situação mensal em tempo real (Realtime) entre app, totem e admin." },
  { icon: ShieldCheck, title: "Segurança Bancária", desc: "RLS, HMAC em webhooks, mTLS para Sicredi e auditoria completa." },
  { icon: Palette, title: "White-label", desc: "Logo, cores, brasão e nome da paróquia totalmente personalizáveis." },
  { icon: Cloud, title: "Multi-Paróquia", desc: "Instalação isolada por diocese/paróquia com gateways independentes." },
  { icon: Receipt, title: "Recibos Fiscais", desc: "Geração automática de comprovantes e balancetes prontos para impressão." },
  { icon: Wallet, title: "PIX + Cartão + TEF", desc: "Aceite qualquer forma de pagamento — presencial ou online." },
  { icon: Users, title: "Gestão de Equipe", desc: "Cadastro de servos, permissões granulares e níveis de acesso." },
  { icon: Lock, title: "LGPD Compliance", desc: "Consentimento, política de privacidade e direito ao esquecimento." },
];

const stats = [
  { value: "100%", label: "PWA Instalável" },
  { value: "3+", label: "Gateways Suportados" },
  { value: "24/7", label: "Realtime Sync" },
  { value: "ID-1", label: "Carteirinha PDF" },
];

const dizilineLogo = "/logo-diziline.png";

const beneficios = [
  { icon: TrendingUp, title: "Aumente a arrecadação", desc: "Facilite a contribuição em qualquer canal — app, totem, PIX, cartão ou boleto." },
  { icon: RefreshCw, title: "Reduza o trabalho manual", desc: "Baixas automáticas, conciliação bancária e relatórios prontos com um clique." },
  { icon: Target, title: "Engaje o dizimista", desc: "Notificações, lembretes personalizados e carteirinha digital para pertencimento." },
  { icon: FileText, title: "Transparência total", desc: "Balancetes, histórico e auditoria acessíveis para conselho e comunidade." },
];

const stack = [
  { name: "React 18", desc: "Interface reativa" },
  { name: "TypeScript", desc: "Código seguro" },
  { name: "Supabase", desc: "Backend escalável" },
  { name: "PostgreSQL", desc: "Banco com RLS" },
  { name: "Edge Functions", desc: "Serverless global" },
  { name: "PWA", desc: "Offline-first" },
];

const faqs = [
  { q: "O que é o Diziline?", a: "O Diziline é uma plataforma completa de gestão de dízimo e ofertas para paróquias católicas. Reúne app do dizimista, totem de autoatendimento, painel administrativo, loja paroquial, carteirinha digital, notificações push e integração com múltiplos gateways de pagamento em um único sistema." },
  { q: "Como funciona a instalação em minha paróquia?", a: "Cada paróquia recebe uma instalação isolada (multi-tenant) com sua própria identidade visual, banco de dados e gateway de pagamento. Nossa equipe realiza toda a configuração inicial, cadastro do super admin, personalização de logos e cores, além do treinamento da secretaria." },
  { q: "Quais formas de pagamento são aceitas?", a: "O Diziline aceita PIX (dinâmico e estático), cartão de crédito e débito (via TEF na maquininha ou online), boleto bancário e dinheiro. Suporta os gateways Rede (Itaú), Sicredi (Sipag) e Pagar.me (Stone), permitindo troca entre eles sem downtime." },
  { q: "É seguro? Segue a LGPD?", a: "Sim. Utilizamos Row Level Security (RLS) em todas as tabelas, HMAC SHA-256 em webhooks, mTLS na Sicredi, criptografia em repouso e auditoria imutável. Estamos em conformidade com a LGPD, com política de privacidade, consentimento explícito e direito ao esquecimento." },
  { q: "Preciso ter conhecimento técnico para usar?", a: "Não. O painel administrativo foi desenhado para secretarias paroquiais. Todas as operações do dia-a-dia (baixa de pagamento, cadastro, envio de lembretes, relatórios) são feitas em poucos cliques. Oferecemos treinamento inicial e suporte contínuo." },
  { q: "O app funciona em iPhone e Android?", a: "Sim. O Diziline é um PWA (Progressive Web App) instalável em iOS e Android diretamente pelo navegador — sem passar por App Store ou Play Store. Recebe notificações push nativas, funciona offline e ocupa muito menos espaço que apps tradicionais." },
  { q: "Como funciona a carteirinha digital?", a: "Cada dizimista recebe uma carteirinha digital no formato ID-1 (85,6×54mm), exportável em PDF de alta qualidade pronto para impressão. Possui QR Code assinado por HMAC que, ao ser lido, abre uma página pública de verificação com validação de autenticidade." },
  { q: "Posso migrar meus dados atuais?", a: "Sim. Nossa equipe realiza a importação de bases legadas (planilhas Excel, sistemas antigos) durante a implantação. Suportamos CSV, Excel e integrações personalizadas com sistemas paroquiais existentes." },
  { q: "O sistema funciona sem internet?", a: "O app do dizimista funciona parcialmente offline (visualização de histórico, comprovantes, carteirinha). O totem e a maquininha requerem internet para processar pagamentos, mas possuem modo de contingência com sincronização posterior." },
  { q: "Qual o custo?", a: "O investimento varia conforme o porte da paróquia e módulos ativados. Entre em contato para uma proposta personalizada — trabalhamos com condições especiais para paróquias e dioceses." },
];

const publicoAlvo = [
  { icon: Church, title: "Paróquias", desc: "De pequenas capelas a santuários com milhares de dizimistas." },
  { icon: Globe, title: "Dioceses", desc: "Consolidação multi-paróquia com relatórios diocesanos." },
  { icon: Users, title: "Movimentos", desc: "Comunidades, pastorais e associações religiosas." },
];

const Apresentacao = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.title = "Diziline — Plataforma de Gestão Paroquial";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ══════════ NAV ══════════ */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/apresentacao" className="flex items-center gap-2 font-bold text-lg">
            <img src={dizilineLogo} alt="Diziline" className="w-9 h-9 object-contain" />
            <span>Diziline</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#modulos" className="hover:text-primary transition-colors">Módulos</a>
            <a href="#recursos" className="hover:text-primary transition-colors">Recursos</a>
            <a href="#beneficios" className="hover:text-primary transition-colors">Benefícios</a>
            <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Entrar
          </Link>
        </div>
      </nav>

      {/* ══════════ HERO ══════════ */}
      <header className="relative overflow-hidden bg-gradient-hero text-white pt-16">
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="absolute top-10 left-10 w-64 h-64 bg-gold/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

        <div className="relative container mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
              <Sparkles className="h-4 w-4 text-gold" />
              <span className="text-sm font-medium">A plataforma católica de gestão paroquial</span>
            </div>

            <div className="flex justify-center mb-6 animate-in fade-in zoom-in duration-700 delay-75">
              <img src={dizilineLogo} alt="Diziline" className="w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-2xl" />
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-bold mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 tracking-tight">
              Diziline
            </h1>
            <p className="text-xl sm:text-2xl md:text-3xl mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 text-white/90">
              Gestão de dízimo <span className="bg-gradient-to-r from-gold via-yellow-300 to-gold bg-clip-text text-transparent font-bold">moderna e segura</span>
            </p>

            <p className="text-base sm:text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              App, totem, admin, loja, carteirinha digital e notificações — tudo em uma
              única plataforma pronta para sua paróquia.
            </p>

            <div className="flex flex-wrap gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-wine font-bold rounded-xl shadow-gold hover:scale-105 transition-transform"
              >
                Acessar Sistema <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#recursos"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/20 transition-colors"
              >
                Ver Recursos
              </a>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-gold">{s.value}</div>
                  <div className="text-sm text-white/70 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <svg className="absolute bottom-0 left-0 w-full text-background" viewBox="0 0 1440 100" preserveAspectRatio="none">
          <path fill="currentColor" d="M0,60 C240,100 480,20 720,50 C960,80 1200,40 1440,60 L1440,100 L0,100 Z" />
        </svg>
      </header>

      {/* ══════════ BENEFÍCIOS ══════════ */}
      <section id="beneficios" className="py-20 container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            POR QUE DIZILINE
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Resultados que sua paróquia sente
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {beneficios.map((b) => (
            <div key={b.title} className="p-6 rounded-2xl bg-card border border-border text-center hover:shadow-gold transition-shadow">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <b.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-bold mb-2">{b.title}</h3>
              <p className="text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ MÓDULOS ══════════ */}
      <section id="modulos" className="py-20 bg-accent/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              MÓDULOS
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Uma plataforma, <span className="text-primary">seis experiências</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Cada módulo do Diziline foi desenhado para uma jornada específica — do dizimista à secretaria paroquial.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modulos.map((m) => (
              <div key={m.title} className="group relative p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-lg transition-all hover:-translate-y-1">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <m.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">{m.title}</h3>
                <p className="text-muted-foreground">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FLUXO ILUSTRADO ══════════ */}
      <section className="py-20 container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            COMO FUNCIONA
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Do dizimista à contabilidade
          </h2>
        </div>

        <div className="max-w-5xl mx-auto">
          <svg viewBox="0 0 800 300" className="w-full h-auto">
            <defs>
              <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--gold))" />
                <stop offset="100%" stopColor="hsl(var(--wine))" />
              </linearGradient>
            </defs>

            <path
              d="M 130 150 L 290 150 M 370 150 L 530 150 M 610 150 L 770 150"
              stroke="url(#flowGrad)"
              strokeWidth="3"
              strokeDasharray="8 4"
              fill="none"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="1s" repeatCount="indefinite" />
            </path>

            <g transform="translate(50 90)">
              <rect width="80" height="120" rx="10" fill="hsl(var(--wine))" />
              <rect x="8" y="15" width="64" height="90" rx="4" fill="hsl(var(--gold))" opacity="0.9" />
              <circle cx="40" cy="112" r="3" fill="hsl(var(--gold))" />
              <text x="40" y="235" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="14" fontWeight="600">App</text>
              <text x="40" y="252" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11">Contribuição</text>
            </g>

            <g transform="translate(290 100)">
              <rect width="80" height="100" rx="10" fill="hsl(var(--primary))" />
              <path d="M 15 40 h 50 M 15 55 h 50 M 15 70 h 30" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <text x="40" y="235" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="14" fontWeight="600">Gateway</text>
              <text x="40" y="252" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11">Processamento</text>
            </g>

            <g transform="translate(530 105)">
              <path
                d="M 20 60 Q 5 60 5 45 Q 5 30 20 30 Q 25 15 40 15 Q 55 15 60 30 Q 75 30 75 45 Q 75 60 60 60 Z"
                fill="hsl(var(--secondary))"
              />
              <text x="40" y="235" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="14" fontWeight="600">Cloud</text>
              <text x="40" y="252" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11">Realtime Sync</text>
            </g>

            <g transform="translate(720 90)">
              <rect width="80" height="120" rx="6" fill="hsl(var(--wine))" />
              <rect x="10" y="15" width="60" height="8" rx="2" fill="hsl(var(--gold))" />
              <rect x="10" y="30" width="25" height="30" rx="2" fill="hsl(var(--gold))" opacity="0.7" />
              <rect x="45" y="30" width="25" height="30" rx="2" fill="hsl(var(--gold))" opacity="0.5" />
              <rect x="10" y="70" width="60" height="4" rx="2" fill="hsl(var(--gold))" opacity="0.6" />
              <rect x="10" y="80" width="60" height="4" rx="2" fill="hsl(var(--gold))" opacity="0.6" />
              <rect x="10" y="90" width="40" height="4" rx="2" fill="hsl(var(--gold))" opacity="0.6" />
              <text x="40" y="235" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="14" fontWeight="600">Admin</text>
              <text x="40" y="252" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11">Relatórios</text>
            </g>
          </svg>
        </div>
      </section>

      {/* ══════════ RECURSOS ══════════ */}
      <section id="recursos" className="py-20 bg-accent/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              RECURSOS
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Tudo que sua paróquia precisa
            </h2>
            <p className="text-lg text-muted-foreground">
              Recursos pensados para simplificar o dia-a-dia da secretaria e encantar o dizimista.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recursos.map((r) => (
              <div key={r.title} className="group flex gap-4 p-5 rounded-xl bg-card border border-border hover:border-primary/50 hover:shadow-gold transition-all">
                <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                  <r.icon className="h-5 w-5 text-primary group-hover:text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">{r.title}</h3>
                  <p className="text-sm text-muted-foreground">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ PERSONALIZAÇÃO ══════════ */}
      <section id="personalizacao" className="py-20 bg-accent/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
                INSTALAÇÃO INDIVIDUAL
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
                Cada paróquia com <span className="text-primary">sua própria cara</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Cada instalação do Diziline é <strong>individual e exclusiva</strong>, preparada
                sob medida para a realidade da sua paróquia. Banco de dados isolado,
                gateway de pagamento próprio e identidade visual totalmente personalizada —
                do logo ao comprovante impresso.
              </p>

              <ul className="space-y-4">
                {[
                  { icon: Palette, title: "Cores e tipografia", desc: "Paleta da paróquia aplicada em todo o sistema — web, app e totem." },
                  { icon: Church, title: "Logo e brasão", desc: "Logo da paróquia e brasão da diocese na carteirinha, e-mails e telas." },
                  { icon: Receipt, title: "Comprovantes personalizados", desc: "Cabeçalho, rodapé, mensagens e QR Code de acordo com sua identidade." },
                  { icon: Globe, title: "Domínio próprio", desc: "URL personalizada (ex: dizimo.suaparoquia.org.br) com HTTPS incluso." },
                  { icon: Database, title: "Dados isolados", desc: "Banco de dados exclusivo — nenhum dado compartilhado com outras paróquias." },
                  { icon: CreditCard, title: "Gateway próprio", desc: "Sua conta na Rede, Sicredi ou Pagar.me — o dinheiro cai direto na paróquia." },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-sm text-muted-foreground">{item.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mockup ilustrativo */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-gold/20 to-wine/20 blur-3xl rounded-full" />
              <svg viewBox="0 0 500 500" className="relative w-full h-auto max-w-md mx-auto">
                <defs>
                  <linearGradient id="pageA" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--gold))" />
                    <stop offset="100%" stopColor="hsl(var(--gold-dark))" />
                  </linearGradient>
                  <linearGradient id="pageB" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--wine))" />
                    <stop offset="100%" stopColor="hsl(var(--wine-dark))" />
                  </linearGradient>
                  <linearGradient id="pageC" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(220 65% 50%)" />
                    <stop offset="100%" stopColor="hsl(220 65% 30%)" />
                  </linearGradient>
                </defs>

                {/* Página C (fundo) */}
                <g transform="translate(280 120) rotate(8)">
                  <rect width="180" height="260" rx="14" fill="url(#pageC)" opacity="0.9" />
                  <circle cx="35" cy="35" r="18" fill="white" opacity="0.9" />
                  <rect x="65" y="25" width="90" height="8" rx="2" fill="white" opacity="0.7" />
                  <rect x="65" y="40" width="60" height="5" rx="2" fill="white" opacity="0.5" />
                  <rect x="20" y="80" width="140" height="4" rx="2" fill="white" opacity="0.4" />
                  <rect x="20" y="92" width="120" height="4" rx="2" fill="white" opacity="0.4" />
                  <rect x="20" y="120" width="65" height="65" rx="6" fill="white" opacity="0.3" />
                  <rect x="95" y="120" width="65" height="65" rx="6" fill="white" opacity="0.3" />
                  <rect x="20" y="205" width="140" height="30" rx="6" fill="white" opacity="0.5" />
                </g>

                {/* Página B (meio) */}
                <g transform="translate(160 90) rotate(-3)">
                  <rect width="180" height="260" rx="14" fill="url(#pageB)" />
                  <rect width="180" height="50" rx="14" fill="hsl(var(--gold))" opacity="0.9" />
                  <circle cx="30" cy="25" r="14" fill="white" />
                  <rect x="55" y="18" width="80" height="7" rx="2" fill="white" />
                  <rect x="55" y="30" width="55" height="5" rx="2" fill="white" opacity="0.7" />
                  <rect x="20" y="75" width="140" height="60" rx="8" fill="white" opacity="0.15" />
                  <rect x="20" y="145" width="65" height="50" rx="6" fill="white" opacity="0.15" />
                  <rect x="95" y="145" width="65" height="50" rx="6" fill="white" opacity="0.15" />
                  <rect x="20" y="210" width="140" height="30" rx="6" fill="hsl(var(--gold))" opacity="0.9" />
                </g>

                {/* Página A (frente) */}
                <g transform="translate(40 70) rotate(-8)">
                  <rect width="180" height="260" rx="14" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" />
                  <rect width="180" height="60" rx="14" fill="url(#pageA)" />
                  <circle cx="35" cy="30" r="16" fill="white" />
                  <text x="35" y="35" textAnchor="middle" fill="hsl(var(--wine))" fontSize="16" fontWeight="700">✝</text>
                  <rect x="60" y="22" width="90" height="7" rx="2" fill="white" />
                  <rect x="60" y="34" width="60" height="5" rx="2" fill="white" opacity="0.8" />

                  <rect x="15" y="80" width="150" height="45" rx="8" fill="hsl(var(--accent))" />
                  <text x="90" y="105" textAnchor="middle" fill="hsl(var(--wine))" fontSize="18" fontWeight="700">R$ 150,00</text>
                  <text x="90" y="118" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8">Dízimo · Jul/2026</text>

                  <rect x="15" y="140" width="72" height="60" rx="6" fill="hsl(var(--gold))" opacity="0.15" />
                  <rect x="93" y="140" width="72" height="60" rx="6" fill="hsl(var(--wine))" opacity="0.15" />

                  <rect x="15" y="215" width="150" height="30" rx="6" fill="url(#pageA)" />
                  <text x="90" y="234" textAnchor="middle" fill="white" fontSize="9" fontWeight="600">Contribuir</text>
                </g>

                {/* Etiquetas flutuantes */}
                <g>
                  <rect x="20" y="380" width="90" height="26" rx="13" fill="hsl(var(--gold))" opacity="0.95">
                    <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
                  </rect>
                  <text x="65" y="397" textAnchor="middle" fill="hsl(var(--wine))" fontSize="10" fontWeight="700">Dourado</text>

                  <rect x="200" y="410" width="90" height="26" rx="13" fill="hsl(var(--wine))">
                    <animate attributeName="opacity" values="0.7;1;0.7" dur="2.5s" repeatCount="indefinite" />
                  </rect>
                  <text x="245" y="427" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">Vinho</text>

                  <rect x="360" y="380" width="110" height="26" rx="13" fill="hsl(220 65% 45%)">
                    <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
                  </rect>
                  <text x="415" y="397" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">Personalize</text>
                </g>
              </svg>
            </div>
          </div>

          {/* Grid de mockups menores */}
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              { title: "App", desc: "Cores da paróquia" },
              { title: "Totem", desc: "Logo e boas-vindas" },
              { title: "E-mails", desc: "Template exclusivo" },
              { title: "Comprovantes", desc: "Cabeçalho e rodapé" },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-xl bg-card border border-border text-center">
                <CheckCircle2 className="h-6 w-6 text-primary mx-auto mb-2" />
                <div className="font-bold text-sm">{item.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ HARDWARE & GATEWAYS ══════════ */}
      <section id="hardware" className="py-20 container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            HARDWARE & GATEWAYS
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Software Diziline + hardware da paróquia
          </h2>
          <p className="text-lg text-muted-foreground">
            O Diziline é uma <strong>plataforma de software</strong>. O totem (PC touch,
            impressora térmica e maquininha) deve ser adquirido pela paróquia
            diretamente com um dos gateways parceiros abaixo — assim as taxas e o
            suporte da maquininha ficam sob controle da própria paróquia.
          </p>
        </div>

        {/* Aviso destaque */}
        <div className="max-w-4xl mx-auto mb-12 p-5 rounded-2xl bg-gold/10 border border-gold/30 flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-gold" />
          </div>
          <div className="text-sm sm:text-base">
            <strong className="block mb-1">Importante:</strong>
            <span className="text-muted-foreground">
              O Diziline <strong>não comercializa</strong> maquininhas, impressoras ou
              computadores. Nossa equipe orienta a compra, faz a homologação e ativa
              a integração — mas o hardware é contratado pela paróquia junto ao
              gateway escolhido, sem intermediários.
            </span>
          </div>
        </div>

        {/* Cards dos gateways */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            {
              logo: redeLogo,
              alt: "Rede (Itaú)",
              nome: "Rede (Itaú)",
              desc: "Maquininhas Rede/Itaú com integração TEF e PIX. Suporte 24/7 do banco.",
              site: "https://www.userede.com.br",
              cta: "Contratar Rede",
              features: ["TEF integrado", "PIX + Cartão", "Antecipação Itaú"],
            },
            {
              logo: sicrediLogo,
              alt: "Sicredi (Sipag)",
              nome: "Sicredi (Sipag)",
              desc: "Cooperativa de crédito com condições especiais para entidades religiosas.",
              site: "https://www.sipag.com.br",
              cta: "Contratar Sipag",
              features: ["mTLS seguro", "Taxas cooperativas", "Sem tarifa mensal"],
            },
            {
              logo: stoneLogo,
              alt: "Pagar.me (Stone)",
              nome: "Pagar.me (Stone)",
              desc: "Ecossistema Stone com maquininhas Ton e integração online completa.",
              site: "https://pagar.me",
              cta: "Contratar Pagar.me",
              features: ["API robusta", "PIX + Cartão + Boleto", "Split de pagamento"],
            },
          ].map((g) => (
            <div
              key={g.nome}
              className="group flex flex-col p-6 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-gold transition-all"
            >
              <div className="h-20 flex items-center justify-center mb-4 bg-white rounded-xl p-3">
                <img src={g.logo} alt={g.alt} className="max-h-12 w-auto object-contain" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-center">{g.nome}</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">{g.desc}</p>

              <ul className="space-y-2 mb-6 flex-1">
                {g.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={g.site}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                {g.cta} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>

        {/* Componentes do totem */}
        <div className="mt-16 max-w-5xl mx-auto">
          <h3 className="text-xl sm:text-2xl font-bold text-center mb-8">
            O que compõe um totem completo
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: MonitorSmartphone, title: "PC touch / Tablet", desc: "Windows ou Android com tela ≥ 15\"" },
              { icon: CreditCard, title: "Maquininha (PINPad)", desc: "Fornecida pelo gateway escolhido" },
              { icon: Printer, title: "Impressora térmica", desc: "80mm ESC/POS com guilhotina" },
              { icon: Cloud, title: "Internet estável", desc: "Wi-Fi ou 4G (backup recomendado)" },
            ].map((c) => (
              <div key={c.title} className="p-5 rounded-xl bg-card border border-border text-center">
                <c.icon className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="font-bold text-sm">{c.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.desc}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Nossa equipe fornece a lista completa de modelos homologados e auxilia
            na configuração remota após a chegada dos equipamentos.
          </p>
        </div>
      </section>

      {/* ══════════ PÚBLICO ALVO ══════════ */}
      <section className="py-20 container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            PARA QUEM
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Feito para toda a Igreja
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {publicoAlvo.map((p) => (
            <div key={p.title} className="p-8 rounded-2xl bg-gradient-to-br from-card to-accent/30 border border-border text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <p.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">{p.title}</h3>
              <p className="text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ SEGURANÇA ══════════ */}
      <section className="py-20 bg-gradient-hero text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full">
            <defs>
              <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="15" cy="15" r="1.5" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        <div className="relative container mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-gold/20 text-gold text-sm font-semibold mb-4">
                SEGURANÇA
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
                Segurança de nível bancário
              </h2>
              <ul className="space-y-4">
                {[
                  "Row Level Security (RLS) em todas as tabelas",
                  "HMAC SHA-256 em todos os webhooks de pagamento",
                  "mTLS na comunicação com Sicredi",
                  "Auditoria completa e imutável de todas as operações",
                  "Conformidade com LGPD e boas práticas OWASP",
                  "Backup automático e criptografia em repouso",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-gold flex-shrink-0 mt-0.5" />
                    <span className="text-white/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 bg-gold/30 blur-3xl rounded-full animate-pulse" />
                <svg viewBox="0 0 400 400" className="relative w-full h-auto">
                  <defs>
                    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="hsl(var(--gold))" />
                      <stop offset="100%" stopColor="hsl(var(--wine))" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 200 40 L 340 100 L 340 200 Q 340 320 200 370 Q 60 320 60 200 L 60 100 Z"
                    fill="url(#shieldGrad)"
                    stroke="hsl(var(--gold))"
                    strokeWidth="4"
                  />
                  <path
                    d="M 140 200 L 185 245 L 270 155"
                    stroke="white"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  >
                    <animate attributeName="stroke-dasharray" from="0 200" to="200 0" dur="1.5s" fill="freeze" />
                  </path>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ STACK ══════════ */}
      <section className="py-20 container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            TECNOLOGIA
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Construído com as melhores ferramentas
          </h2>
          <p className="text-lg text-muted-foreground">
            Stack moderna, escalável e mantida por comunidade ativa.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
          {stack.map((s) => (
            <div key={s.name} className="p-5 rounded-xl bg-card border border-border text-center hover:border-primary transition-colors">
              <Layers className="h-6 w-6 text-primary mx-auto mb-2" />
              <div className="font-bold text-sm">{s.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ DEPOIMENTO ══════════ */}
      <section className="py-20 bg-accent/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <Quote className="h-12 w-12 text-primary mx-auto mb-6 opacity-40" />
            <p className="text-xl sm:text-2xl md:text-3xl font-serif italic mb-8 leading-relaxed">
              "Cada um dê conforme decidiu em seu coração, sem tristeza, nem por
              obrigação; pois Deus ama a quem dá com alegria."
            </p>
            <p className="text-muted-foreground">— 2 Coríntios 9,7</p>
          </div>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section id="faq" className="py-20 container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            FAQ
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Perguntas frequentes
          </h2>
          <p className="text-lg text-muted-foreground">
            As principais dúvidas sobre o Diziline. Não achou o que procura? Fale conosco.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((f, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i} className="rounded-xl bg-card border border-border overflow-hidden">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-accent/50 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold">{f.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 text-primary transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-96" : "max-h-0"}`}
                >
                  <p className="p-5 pt-0 text-muted-foreground leading-relaxed">{f.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ══════════ SUPORTE ══════════ */}
      <section className="py-20 container mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="p-6 rounded-2xl bg-card border border-border text-center">
            <Rocket className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-bold mb-1">Onboarding assistido</h3>
            <p className="text-sm text-muted-foreground">Implantação guiada e migração de dados incluídas.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border text-center">
            <Headphones className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-bold mb-1">Suporte contínuo</h3>
            <p className="text-sm text-muted-foreground">Atendimento por e-mail, WhatsApp e videochamada.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border text-center">
            <Database className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-bold mb-1">Seus dados, seus</h3>
            <p className="text-sm text-muted-foreground">Exportação total a qualquer momento, sem lock-in.</p>
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section className="py-20 container mx-auto px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-primary/10 via-card to-secondary/10 border border-border shadow-card">
          <HeartHandshake className="h-16 w-16 text-primary mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Pronto para modernizar sua paróquia?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Instale o Diziline em sua paróquia com identidade visual própria, gateways independentes
            e suporte técnico dedicado.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl shadow-gold hover:scale-105 transition-transform"
            >
              Entrar no Sistema <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="mailto:contato@acathosec.com.br"
              className="inline-flex items-center gap-2 px-8 py-4 border border-border rounded-xl hover:bg-accent transition-colors"
            >
              <Mail className="h-5 w-5" /> Falar com Consultor
            </a>
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="py-10 border-t border-border bg-accent/20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={dizilineLogo} alt="Diziline" className="w-10 h-10 object-contain" />
              <div>
                <div className="font-bold">Diziline</div>
                <div className="text-xs text-muted-foreground">Plataforma católica de gestão paroquial</div>
              </div>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/politica-de-privacidade" className="hover:text-primary transition-colors">Privacidade</Link>
              <Link to="/termos-de-uso" className="hover:text-primary transition-colors">Termos</Link>
              <Link to="/login" className="hover:text-primary transition-colors">Entrar</Link>
            </div>
          </div>
          <div className="text-center text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} Diziline · Todos os direitos reservados
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Apresentacao;
