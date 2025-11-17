import { createContext } from 'react';
import { User, Session } from '@supabase/supabase-js';

// Definir a interface do tipo de contexto
 
export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  userRole: string | null; // NEW: Add userRole
}

// Criar e exportar o AuthContext com um valor padrão completo
// Isso garante que o useContext sempre retorne um objeto com a estrutura esperada,
// mesmo que o provedor ainda não tenha sido montado.
export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true, // Default to loading until actual state is determined
  signUp: async () => ({ error: new Error('AuthContext not initialized') }),
  signIn: async () => ({ error: new Error('AuthContext not initialized') }),
  signOut: async () => { /* no-op */ },
  userRole: null, // NEW: Default userRole
});