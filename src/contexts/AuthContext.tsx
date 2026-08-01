import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'super_admin' | 'admin' | 'dizimista';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  isServo: boolean;
  nomeServo: string | null;
  comunidadeIdServo: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nomeCompleto: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isServo, setIsServo] = useState(false);
  const [nomeServo, setNomeServo] = useState<string | null>(null);
  const [comunidadeIdServo, setComunidadeIdServo] = useState<string | null>(null);

  const fetchUserRole = async (userId: string): Promise<AppRole> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .order('role')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar role:', error);
        return 'dizimista';
      }
      // Se não houver linha em user_roles, tratamos como dizimista
      // para não travar a tela em "Verificando permissões".
      return (data?.role as AppRole) || 'dizimista';
    } catch {
      return 'dizimista';
    }
  };

  const fetchServoInfo = async (userId: string) => {
    try {
      const { data } = await (supabase as any)
        .from('servos')
        .select('nome, ativo, comunidade_id')
        .eq('user_id', userId)
        .eq('ativo', true)
        .maybeSingle();
      if (data) {
        setIsServo(true);
        setNomeServo(data.nome);
        setComunidadeIdServo(data.comunidade_id || null);
      } else {
        setIsServo(false);
        setNomeServo(null);
        setComunidadeIdServo(null);
      }
    } catch {
      setIsServo(false);
      setNomeServo(null);
      setComunidadeIdServo(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let currentUserId: string | null = null;


    // Inicialização: busca sessão existente e role ANTES de setar loading=false
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          currentUserId = session.user.id;
          const [userRole] = await Promise.all([
            fetchUserRole(session.user.id),
            fetchServoInfo(session.user.id),
          ]);
          if (isMounted) setRole(userRole);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    // Listener para mudanças subsequentes de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      // TOKEN_REFRESHED e INITIAL_SESSION: apenas atualizam tokens, não disparam re-render pesado
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        setSession(session);
        return;
      }

      // SIGNED_IN dispara também quando a aba volta a ficar visível (Supabase re-valida a sessão).
      // Se for o mesmo usuário já carregado, ignoramos para não recarregar a página inteira.
      if (event === 'SIGNED_IN' && session?.user) {
        if (currentUserId === session.user.id) {
          setSession(session);
          return;
        }
        currentUserId = session.user.id;
        setSession(session);
        setUser(session.user);
        setLoading(true);
        setTimeout(async () => {
          if (!isMounted) return;
          const [userRole] = await Promise.all([
            fetchUserRole(session.user.id),
            fetchServoInfo(session.user.id),
          ]);
          if (isMounted) {
            setRole(userRole);
            setLoading(false);
          }
        }, 0);
        return;
      }

      if (event === 'SIGNED_OUT') {
        currentUserId = null;
        setSession(null);
        setUser(null);
        setRole(null);
        setIsServo(false);
        setNomeServo(null);
        setComunidadeIdServo(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, nomeCompleto: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome_completo: nomeCompleto },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = () => role === 'admin' || role === 'super_admin';
  const isSuperAdmin = () => role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, session, role, loading, isServo, nomeServo, comunidadeIdServo, signIn, signUp, signOut, isAdmin, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
};
