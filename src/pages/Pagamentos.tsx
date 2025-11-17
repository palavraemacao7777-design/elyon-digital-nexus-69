 
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Receipt, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast'; // Import useToast

interface Payment {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  mp_payment_status?: string;
  metadata: any;
}

const Pagamentos = () => {
  const { user, loading: authLoading } = useAuth(); // Removido isAdmin
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true); // Renamed from loadingPage for clarity
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    totalAmount: 0,
    thisMonth: 0
  });
  const { toast } = useToast(); // Initialize useToast

  useEffect(() => {
    console.log('PAGAMENTOS_DEBUG: useEffect triggered. user:', user?.id, 'authLoading:', authLoading); // Removido isAdmin do log
    // Não esperar por authLoading aqui, o redirecionamento será tratado abaixo
    if (user) { // Qualquer usuário logado pode acessar
      loadPayments();
    } else if (!user) {
      console.log('PAGAMENTOS_DEBUG: Not authenticated, redirecting.');
    }
  }, [user]); // Removido isAdmin das dependências

  const loadPayments = async () => {
    console.log('PAGAMENTOS_DEBUG: loadPayments started.');
    try {
      setLoadingPayments(true); // Use loadingPayments
      
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPayments(data || []);
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const total = data?.length || 0;
      const completed = data?.filter(p => p.status === 'completed').length || 0;
      const totalAmount = data?.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0) || 0;
      const thisMonth = data?.filter(p => 
        p.status === 'completed' && new Date(p.created_at) >= startOfMonth
      ).reduce((sum, p) => sum + p.amount, 0) || 0;
      
      setStats({ total, completed, totalAmount, thisMonth });
      console.log('PAGAMENTOS_DEBUG: loadPayments completed successfully.');
      
    } catch (error: any) {
      console.error('PAGAMENTOS_DEBUG: Erro ao carregar pagamentos:', error);
      toast({
        title: 'Erro ao carregar pagamentos',
        description: error.message || 'Erro ao carregar pagamentos. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPayments(false); // Use loadingPayments
      console.log('PAGAMENTOS_DEBUG: setLoadingPayments(false) called.');
    }
  };

  const getStatusBadge = (payment: Payment) => {
    const status = payment.status;
    const mpStatus = payment.mp_payment_status;
    
    if (status === 'completed' || mpStatus === 'approved') {
      return <Badge className="bg-green-100 text-green-800 text-xs">Aprovado</Badge>;
    } else if (status === 'failed' || mpStatus === 'rejected') {
      return <Badge variant="destructive" className="text-xs">Rejeitado</Badge>;
    } else {
      return <Badge variant="outline" className="text-xs">Pendente</Badge>;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'pix': return 'PIX';
      case 'creditCard': return 'Cartão de Crédito';
      default: return method;
    }
  };

  if (!user) {
    console.log('PAGAMENTOS_DEBUG: Redirecting to login because no user.');
    return <Navigate to="/auth/login" replace />;
  }

  // REMOVIDO: if (!isAdmin) { ... }

  if (loadingPayments) { // Show loading for payments only after auth is done
    return <div className="flex items-center justify-center min-h-screen">Carregando pagamentos...</div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Histórico de Pagamentos</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          Visualize todos os pagamentos da plataforma
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Pagamentos
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completed} aprovados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Faturado
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {(stats.totalAmount / 100).toFixed(2).replace('.', ',')}
            </div>
            <p className="text-xs text-muted-foreground">
              Pagamentos aprovados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Este Mês
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {(stats.thisMonth / 100).toFixed(2).replace('.', ',')}
            </div>
            <p className="text-xs text-muted-foreground">
              Faturamento mensal
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxa de Aprovação
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              Pagamentos aprovados
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Receipt className="h-5 w-5" />
            Lista de Pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">Nenhum pagamento encontrado</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Os pagamentos aparecerão aqui quando realizados
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors gap-2"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      {payment.payment_method === 'pix' ? (
                        <CreditCard className="h-5 w-5 text-primary" />
                      ) : (
                        <CreditCard className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-sm sm:text-base">
                        {payment.metadata?.customer_data?.name || 'Cliente'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.metadata?.customer_data?.email || 'Email não informado'}
                      </p>
                      <div className="flex flex-wrap items-center space-x-2 text-xs text-muted-foreground">
                        <span>{getPaymentMethodLabel(payment.payment_method)}</span>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(payment.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                        {payment.mp_payment_status && (
                          <>
                            <span>•</span>
                            <span>MP: {payment.mp_payment_status}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mt-2 sm:mt-0">
                    <div className="text-right space-y-1">
                      <p className="text-sm font-medium">
                        R$ {(payment.amount / 100).toFixed(2).replace('.', ',')}
                      </p>
                      {getStatusBadge(payment)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Pagamentos;