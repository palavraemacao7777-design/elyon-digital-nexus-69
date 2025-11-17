 
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Clock, User, Eye, EyeOff, Package, DollarSign, Palette, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tables } from '@/integrations/supabase/types'; // Import Tables

interface HistoryEntry extends Tables<'checkout_history'> {
  profiles?: Pick<Tables<'profiles'>, 'name' | 'email'> | null;
}

interface CheckoutHistoryProps {
  checkoutId: string;
}

const CheckoutHistory: React.FC<CheckoutHistoryProps> = ({ checkoutId }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState<{[key: string]: boolean}>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchHistory();
  }, [checkoutId]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('checkout_history')
        .select(`
          *,
          profiles (name, email)
        `)
        .eq('checkout_id', checkoutId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory((data as HistoryEntry[]) || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o histórico",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleDetails = (entryId: string) => {
    setShowDetails(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return <Package className="h-4 w-4 text-green-600" />;
      case 'updated':
        return <Settings className="h-4 w-4 text-blue-600" />;
      case 'deleted':
        return <Package className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return <Badge variant="default" className="bg-green-100 text-green-800 text-xs">Criado</Badge>;
      case 'updated':
        return <Badge variant="default" className="bg-blue-100 text-blue-800 text-xs">Atualizado</Badge>;
      case 'deleted':
        return <Badge variant="destructive" className="text-xs">Excluído</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{actionType}</Badge>;
    }
  };

  const formatPrice = (value: number) => {
    return (value / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const renderChangeDetails = (entry: HistoryEntry) => {
    const { changes, old_values, new_values } = entry;
    
    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs sm:text-sm">
        <h4 className="font-medium mb-2 text-sm">Detalhes das Modificações:</h4>
        
        {(changes as any)?.order_bumps_changed && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm">Order Bumps</span>
            </div>
            {(old_values as any)?.order_bumps && (new_values as any)?.order_bumps && (
              <div className="space-y-1 text-xs">
                <div>
                  <span className="font-medium">Antes:</span> {(old_values as any).order_bumps.length} item(s)
                </div>
                <div>
                  <span className="font-medium">Depois:</span> {(new_values as any).order_bumps.length} item(s)
                </div>
              </div>
            )}
          </div>
        )}

        {(changes as any)?.price_changed && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="font-medium text-sm">Preço</span>
            </div>
            <div className="space-y-1 text-xs">
              <div>
                <span className="font-medium">Antes:</span> {formatPrice((old_values as any)?.price || 0)}
              </div>
              <div>
                <span className="font-medium">Depois:</span> {formatPrice((new_values as any)?.price || 0)}
              </div>
            </div>
          </div>
        )}

        {(changes as any)?.promotional_price_changed && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-sm">Preço Promocional</span>
            </div>
            <div className="space-y-1 text-xs">
              <div>
                <span className="font-medium">Antes:</span> {(old_values as any)?.promotional_price ? formatPrice((old_values as any).promotional_price) : 'Não definido'}
              </div>
              <div>
                <span className="font-medium">Depois:</span> {(new_values as any)?.promotional_price ? formatPrice((new_values as any).promotional_price) : 'Não definido'}
              </div>
            </div>
          </div>
        )}

        {(changes as any)?.packages_changed && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-sm">Pacotes</span>
            </div>
            <div className="text-xs text-gray-600">
              Configurações de pacotes foram modificadas
            </div>
          </div>
        )}

        {(changes as any)?.layout_changed && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="h-4 w-4 text-indigo-600" />
              <span className="font-medium text-sm">Layout</span>
            </div>
            <div className="space-y-1 text-xs">
              <div>
                <span className="font-medium">Antes:</span> {(old_values as any)?.layout || 'horizontal'}
              </div>
              <div>
                <span className="font-medium">Depois:</span> {(new_values as any)?.layout || 'horizontal'}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Clock className="h-5 w-5" />
            Histórico de Modificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground text-sm sm:text-base">
            Carregando histórico...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Clock className="h-5 w-5" />
          Histórico de Modificações
        </CardTitle>
        <p className="text-sm sm:text-base text-muted-foreground">
          Acompanhe todas as alterações feitas neste checkout
        </p>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm sm:text-base">
            Nenhuma modificação registrada
          </div>
        ) : (
          <ScrollArea className="h-72 sm:h-96">
            <div className="space-y-3 sm:space-y-4">
              {history.map((entry, index) => (
                <div key={entry.id} className="relative">
                  {index < history.length - 1 && (
                    <div className="absolute left-4 top-10 sm:top-12 bottom-0 w-px bg-border" />
                  )}
                  
                  <div className="flex gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-background border flex items-center justify-center">
                      {getActionIcon(entry.action_type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <div className="flex items-center gap-2">
                          {getActionBadge(entry.action_type)}
                          <span className="text-sm font-medium">
                            {entry.description}
                          </span>
                        </div>
                        
                        {entry.action_type === 'updated' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleDetails(entry.id)}
                            className="h-6 px-2 text-xs"
                          >
                            {showDetails[entry.id] ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-2">
                        <User className="h-3 w-3" />
                        <span>{entry.profiles?.name || entry.profiles?.email || 'Sistema'}</span>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(entry.created_at), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </span>
                      </div>

                      {showDetails[entry.id] && entry.action_type === 'updated' && (
                        renderChangeDetails(entry)
                      )}
                    </div>
                  </div>
                  
                  {index < history.length - 1 && <Separator className="mt-3 sm:mt-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default CheckoutHistory;