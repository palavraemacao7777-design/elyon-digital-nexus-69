 
import { useState, useEffect } from 'react';

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  tab: string;
  action: string;
  field: string;
  oldValue?: any;
  newValue: any;
  description: string;
}

export interface UseCheckoutHistoryReturn {
  history: HistoryEntry[];
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  getHistoryByTab: (tab: string) => HistoryEntry[];
}

export const useCheckoutHistory = (): UseCheckoutHistoryReturn => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const addHistoryEntry = useCallback((entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: HistoryEntry = {
      ...entry,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };

    setHistory(prev => [newEntry, ...prev]);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const getHistoryByTab = useCallback((tab: string) => {
    return history.filter(entry => entry.tab === tab);
  }, [history]);

  return {
    history,
    addHistoryEntry,
    clearHistory,
    getHistoryByTab,
  };
};

export const getTabDisplayName = (tab: string): string => {
  const tabNames: Record<string, string> = {
    basic: 'Básico',
    customer: 'Cliente',
    packages: 'Pacotes',
    bumps: 'Order Bumps',
    guarantee: 'Garantia',
    payment: 'Pagamento',
    styles: 'Visual',
  };
  return tabNames[tab] || tab;
};

export const getFieldDisplayName = (field: string): string => {
  const fieldNames: Record<string, string> = {
    selectedProduct: 'Produto Base',
    description: 'Descrição',
    layout: 'Layout',
    'customerFields.requireName': 'Exigir Nome',
    'customerFields.requireCpf': 'Exigir CPF',
    'customerFields.requirePhone': 'Exigir Telefone',
    'customerFields.requireEmail': 'Exigir Email',
    'customerFields.requireEmailConfirm': 'Confirmar Email',
    'guarantee.enabled': 'Garantia Habilitada',
    'guarantee.days': 'Dias de Garantia',
    'guarantee.description': 'Descrição da Garantia',
    'reservedRights.enabled': 'Direitos Reservados',
    'reservedRights.text': 'Texto dos Direitos',
    'paymentMethods.pix': 'PIX',
    'paymentMethods.creditCard': 'Cartão de Crédito',
    'integrations.selectedMercadoPagoAccount': 'Conta Mercado Pago',
    'integrations.selectedMetaPixel': 'Meta Pixel',
    'support_contact.email': 'Email de Suporte',
    'styles.backgroundColor': 'Cor de Fundo',
    'styles.primaryColor': 'Cor Primária',
    'styles.textColor': 'Cor do Texto',
    'styles.headlineText': 'Texto do Título',
    'styles.headlineColor': 'Cor do Título',
    'styles.gradientColor': 'Cor do Gradiente',
    'styles.highlightColor': 'Cor de Destaque',
  };
  return fieldNames[field] || field;
};