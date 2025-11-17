 
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, ShoppingCart, Calendar } from 'lucide-react';
import { NewSaleDialog } from '@/components/dialogs/NewSaleDialog';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Sale {
  id: string;
  customer_id: string;
  product_name: string;
  amount: number;
  created_at: string;
  status: string;
  payment_method: string;
  net_amount: number;
  customers?: {
    name: string;
    email: string;
  };
}

const Sales = () => {
  const { user, loading: authLoading } = useAuth(); // Removido isAdmin
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true); // Renamed from loadingPage for clarity
  const [stats, setStats] = useState({
    totalRevenue: 0,
    salesCount: 0,
    averageTicket: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    console.log('SALES_DEBUG: useEffect triggered. user:', user?.id, 'authLoading:', authLoading); // Removido isAdmin do log
    // Não esperar por authLoading aqui, o redirecionamento será tratado abaixo
    if (user) { // Qualquer usuário logado pode acessar
      loadSales();
    } else if (!user) {
      console.log('SALES_DEBUG: Not authenticated, redirecting.');
    }
  }, [user]); // Removido isAdmin das dependências

  const loadSales = async () => {
    console.log('SALES_DEBUG: loadSales started.');
    try {
      setLoadingSales(true); // Use loadingSales
      
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customers (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSales(data || []);
      
      const totalRevenue = data?.reduce((sum, sale) => sum + sale.amount, 0) || 0;
      const salesCount = data?.length || 0;
      const averageTicket = salesCount > 0 ? Math.round(totalRevenue / salesCount) : 0;
      
      setStats({ totalRevenue, salesCount, averageTicket });
      console.log('SALES_DEBUG: loadSales completed successfully.');
      
    } catch (error: any) {
      console.error('SALES_DEBUG: Erro ao carregar vendas:', error);
      toast({
        title: 'Erro ao carregar vendas',
        description: error.message || 'Erro ao carregar vendas. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSales(false); // Use loadingSales
      console.log('SALES_DEBUG: setLoadingSales(false) called.');
    }
  };

  // Removido: if (authLoading) { ... }

  if (!user) {
    console.log('SALES_DEBUG: Redirecting to login because no user.');
    return <Navigate to="/auth/login" replace />;
  }

  // REMOVIDO: if (!isAdmin) { ... }

  if (loadingSales) { // Show loading for sales only after auth is done
    return <div className="container mx-auto px-4 py-8">Carregando vendas...</div>;
  }

  const salesData = sales;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Vendas</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Gerencie todas as suas vendas e transações
          </p>
        </div>
        <NewSaleDialog onSaleCreated={loadSales} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Vendas Totais
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {(stats.totalRevenue / 100).toFixed(2).replace('.', ',')}</div>
            <p className="text-xs text-muted-foreground">
              Total de vendas realizadas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Vendas Este Mês
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.salesCount}</div>
            <p className="text-xs text-muted-foreground">
              Vendas realizadas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ticket Médio
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {(stats.averageTicket / 100).toFixed(2).replace('.', ',')}</div>
            <p className="text-xs text-muted-foreground">
              Valor médio por venda
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Vendas Recentes</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Lista das vendas mais recentes realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {salesData.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">Nenhuma venda encontrada</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                As vendas aparecerão aqui quando forem realizadas
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {salesData.map((sale) => (
                <div
                  key={sale.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors gap-2"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm sm:text-base">{sale.customers?.name || 'Cliente'}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{sale.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.customers?.email}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4 mt-2 sm:mt-0">
                    <div className="text-right">
                      <p className="font-medium text-sm sm:text-base">R$ {(sale.amount / 100).toFixed(2).replace('.', ',')}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(sale.created_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">{sale.payment_method}</p>
                    </div>
                    <Badge variant={sale.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                      {sale.status === 'completed' ? 'Concluída' : 'Pendente'}
                    </Badge>
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

export default Sales;