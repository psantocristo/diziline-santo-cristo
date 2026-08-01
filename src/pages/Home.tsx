import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Church, Heart, HandCoins, BookOpen, Star, 
  ArrowRight, Phone, MapPin, Clock
} from 'lucide-react';

const campanhaMock = [
  { nome: 'Reforma da Igreja', meta: 150000, arrecadado: 87500, prazo: '31/12/2025' },
  { nome: 'Fundo Catequese', meta: 20000, arrecadado: 14200, prazo: '30/06/2025' },
  { nome: 'Pastoral da Criança', meta: 8000, arrecadado: 5600, prazo: '31/08/2025' },
];

const HomePage = () => {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER */}
      <header className="bg-gradient-hero text-primary-foreground sticky top-0 z-50 shadow-wine">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 rounded-full p-2">
              <Church className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-primary text-sm leading-tight">Dízimo Santo Cristo</h1>
              <p className="text-primary/60 text-xs hidden sm:block">Paróquia Senhor Santo Cristo dos Milagres</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            {user ? (
              <>
                {isAdmin() && (
                  <Button asChild variant="ghost" size="sm" className="text-primary hover:bg-primary/10 hidden sm:flex">
                    <Link to="/admin">Painel Admin</Link>
                  </Button>
                )}
                <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link to="/paroquiano">Minha Área</Link>
                </Button>
              </>
            ) : (
              <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/login">Entrar</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-gradient-hero text-center py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="bg-primary/20 rounded-full p-6 border-2 border-primary/40">
              <Church className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4 leading-tight">
            Paróquia Senhor<br />Santo Cristo dos Milagres
          </h2>
          <p className="text-xl text-primary/80 mb-2 italic">
            "Sua contribuição sustenta a missão da fé"
          </p>
          <p className="text-primary/60 mb-8 text-sm">
            Contribua com o dízimo, ofertas e campanhas de forma simples e segura
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="h-14 px-8 text-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold font-semibold">
              <Link to={user ? "/paroquiano/contribuir" : "/login"}>
                <HandCoins className="h-5 w-5 mr-2" />
                Contribuir Agora
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 px-8 text-lg border-primary/40 text-primary hover:bg-primary/10">
              <Link to="#campanhas">Ver Campanhas</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* TIPOS DE CONTRIBUIÇÃO */}
      <section className="py-16 px-4 bg-background">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-2xl font-bold text-center text-secondary mb-2">Como você pode contribuir</h3>
          <p className="text-center text-muted-foreground mb-10">Escolha a forma que mais se identifica com sua fé</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: HandCoins, titulo: 'Dízimo', desc: 'Contribuição mensal de 10% para sustentar a paróquia', cor: 'text-primary' },
              { icon: Heart, titulo: 'Oferta', desc: 'Contribuição espontânea de qualquer valor', cor: 'text-red-500' },
              { icon: Star, titulo: 'Campanha', desc: 'Apoie projetos específicos com meta financeira', cor: 'text-yellow-500' },
              { icon: Church, titulo: 'Eventual', desc: 'Festas, eventos, rifas e obras especiais', cor: 'text-purple-500' },
            ].map(({ icon: Icon, titulo, desc, cor }) => (
              <Card key={titulo} className="text-center hover:shadow-card transition-shadow border-border/60">
                <CardContent className="pt-6 pb-4">
                  <Icon className={`h-10 w-10 mx-auto mb-3 ${cor}`} />
                  <h4 className="font-semibold text-foreground mb-2">{titulo}</h4>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CAMPANHAS ATIVAS */}
      <section id="campanhas" className="py-16 px-4 bg-muted/40">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-2xl font-bold text-center text-secondary mb-2">Campanhas em Andamento</h3>
          <p className="text-center text-muted-foreground mb-10">Cada real faz diferença na obra de Deus</p>
          <div className="grid gap-4 md:grid-cols-3">
            {campanhaMock.map(c => {
              const pct = Math.round((c.arrecadado / c.meta) * 100);
              return (
                <Card key={c.nome} className="shadow-card border-border/60">
                  <CardContent className="pt-5">
                    <h4 className="font-bold text-foreground mb-1">{c.nome}</h4>
                    <p className="text-xs text-muted-foreground mb-3">Prazo: {c.prazo}</p>
                    <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-gold rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-primary">
                        R$ {c.arrecadado.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Meta: R$ {c.meta.toLocaleString('pt-BR')}
                    </p>
                    <Button asChild className="w-full mt-4 bg-secondary hover:bg-secondary/90 text-secondary-foreground" size="sm">
                      <Link to={user ? "/paroquiano/contribuir" : "/login"}>
                        Contribuir <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* FORMAS DE PAGAMENTO */}
      <section className="py-16 px-4 bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-2xl font-bold text-secondary mb-2">Formas de Pagamento</h3>
          <p className="text-muted-foreground mb-8">Praticidade e segurança para sua contribuição</p>
          <div className="flex flex-wrap justify-center gap-4">
            {['PIX', 'Cartão de Crédito', 'Cartão de Débito'].map(m => (
              <div key={m} className="bg-muted rounded-xl px-6 py-4 font-semibold text-foreground border border-border">
                {m}
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            🔒 Pagamentos processados com segurança via Gateway Laranjinha (Rede Itaú)
          </p>
        </div>
      </section>

      {/* VERSÍCULO */}
      <section className="py-12 px-4 bg-gradient-hero">
        <div className="max-w-3xl mx-auto text-center">
          <BookOpen className="h-8 w-8 text-primary mx-auto mb-4" />
          <blockquote className="text-lg text-primary/90 italic font-medium mb-3">
            "Trazei todos os dízimos à casa do tesouro, para que haja mantimento na minha casa, e provai-me nisto, diz o Senhor dos Exércitos."
          </blockquote>
          <cite className="text-primary/60 text-sm">— Ml 3,10</cite>
        </div>
      </section>

      {/* INFORMAÇÕES */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6 text-center">
          {[
            { icon: MapPin, titulo: 'Endereço', texto: 'Rua da Paróquia, 100\nCentro — São Paulo/SP' },
            { icon: Clock, titulo: 'Horário das Missas', texto: 'Dom: 7h, 9h, 11h, 19h\nSeg-Sáb: 7h e 19h' },
            { icon: Phone, titulo: 'Contato', texto: '(11) 9999-9999\nparoquia@santocristodosmilagres.org' },
          ].map(({ icon: Icon, titulo, texto }) => (
            <div key={titulo}>
              <Icon className="h-8 w-8 text-primary mx-auto mb-3" />
              <h4 className="font-bold text-foreground mb-2">{titulo}</h4>
              <p className="text-muted-foreground text-sm whitespace-pre-line">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gradient-hero py-8 px-4 text-center">
        <p className="text-primary/70 text-sm">
          © 2025 Paróquia Senhor Santo Cristo dos Milagres · Sistema Dízimo Santo Cristo
        </p>
        <p className="text-primary/40 text-xs mt-1">Deus lhe pague! 🙏</p>
      </footer>
    </div>
  );
};

export default HomePage;
