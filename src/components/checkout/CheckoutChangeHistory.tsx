 
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Edit, Package, User, CreditCard, Shield, Palette, FileText, Filter, Trash2 } from 'lucide-react';
import { HistoryEntry, getTabDisplayName, getFieldDisplayName } from '@/hooks/useCheckoutHistory';

interface CheckoutChangeHistoryProps {
  history: HistoryEntry[];
  selectedTab?: string;
  onClearHistory?: () => void;
}

const getTabIcon = (tab: string) => {
  const icons: Record<string, React.ReactNode> = {
    basic: <FileText className="h-4 w-4" />,
    customer: <User className="h-4 w-4" />,
    packages: <Package className="h-4 w-4" />,
    bumps: <Package className="h-4 w-4" />,
    guarantee: <Shield className="h-4 w-4" />,
    payment: <CreditCard className="h-4 w-4" />,
    styles: <Palette className="h-4 w-4" />,
  };
  return icons[tab] || <Edit className="h-4 w-4" />;
};

const formatValue = (value: any): string => {
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'string') {
    return value || '(vazio)';
  }
  if (Array.isArray(value)) {
    return `Array com ${value.length} itens`;
  }
  if (typeof value === 'object' && value !== null) {
    return 'Objeto alterado';
  }
  return '(indefinido)';
};

const CheckoutChangeHistory: React.FC<CheckoutChangeHistoryProps> = ({ history, selectedTab, onClearHistory }) => {
  const [filterTab, setFilterTab] = useState<string>('all');
  
  const filteredHistory = filterTab === 'all' 
    ? history
    : history.filter(entry => entry.tab === filterTab);
  
  const tabOptions = [
    { value: 'all', label: 'Todas as abas' },
    { value: 'basic', label: 'Básico' },
    { value: 'customer', label: 'Cliente' },
    { value: 'packages', label: 'Pacotes' },
    { value: 'bumps', label: 'Order Bumps' },
    { value: 'guarantee', label: 'Garantia' },
    { value: 'payment', label: 'Pagamento' },
    { value: 'styles', label: 'Visual' },
  ];

  const groupedHistory = filteredHistory.reduce((groups, entry) => {
    const dateKey = entry.timestamp.toLocaleDateString('pt-BR');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(entry);
    return groups;
  }, {} as Record<string, HistoryEntry[]>);

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="text-center py-6 sm:py-8">
            <Clock className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">Nenhuma alteração registrada</h3>
            <p className="text-muted-foreground text-sm sm:text-base">
              {selectedTab 
                ? `Nenhuma alteração foi feita na aba ${getTabDisplayName(selectedTab)}`
                : 'Comece a editar para ver o histórico de alterações'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <h3 className="text-base sm:text-lg font-semibold">Histórico de Alterações</h3>
          <Badge variant="secondary" className="text-xs">
            {filteredHistory.length} alterações
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <Select value={filterTab} onValueChange={setFilterTab}>
            <SelectTrigger className="w-32 sm:w-40 text-sm">
              <SelectValue placeholder="Filtrar por aba" />
            </SelectTrigger>
            <SelectContent>
              {tabOptions.map(option => (
                <SelectItem key={option.value} value={option.value} className="text-sm">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onClearHistory && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClearHistory}
              className="ml-2 text-xs sm:text-sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Esvaziar
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="h-[300px] sm:h-[400px]">
        <div className="space-y-4 sm:space-y-6">
          {Object.entries(groupedHistory).map(([date, entries]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <h4 className="font-medium text-muted-foreground text-sm">{date}</h4>
                <Separator className="flex-1" />
                <Badge variant="outline" className="text-xs">
                  {entries.length} alterações
                </Badge>
              </div>

              <div className="space-y-3">
                {entries.map((entry) => (
                  <Card key={entry.id} className="border-l-4 border-l-primary">
                    <CardContent className="pt-3 sm:pt-4">
                      <div className="flex items-start justify-between mb-1 sm:mb-2">
                        <div className="flex items-center gap-2">
                          {getTabIcon(entry.tab)}
                          <Badge variant="outline" className="text-xs">
                            {getTabDisplayName(entry.tab)}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {entry.timestamp.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          {entry.description}
                        </p>
                        
                        <div className="text-xs text-muted-foreground">
                          <strong>Campo:</strong> {getFieldDisplayName(entry.field)}
                        </div>

                        {entry.oldValue !== undefined && (
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs">
                            <div className="flex-1">
                              <span className="text-red-600 font-medium">Antes:</span>
                              <span className="ml-1 bg-red-50 px-1.5 py-0.5 rounded">
                                {formatValue(entry.oldValue)}
                              </span>
                            </div>
                            <div className="flex-1">
                              <span className="text-green-600 font-medium">Depois:</span>
                              <span className="ml-1 bg-green-50 px-1.5 py-0.5 rounded">
                                {formatValue(entry.newValue)}
                              </span>
                            </div>
                          </div>
                        )}

                        {entry.oldValue === undefined && (
                          <div className="text-xs">
                            <span className="text-green-600 font-medium">Valor:</span>
                            <span className="ml-1 bg-green-50 px-1.5 py-0.5 rounded">
                                {formatValue(entry.newValue)}
                              </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default CheckoutChangeHistory;