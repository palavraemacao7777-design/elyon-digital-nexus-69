 
import { useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { EmailConfig as SimplifiedEmailConfig, Tables, TablesInsert, TablesUpdate, Json } from '@/integrations/supabase/types'; // Importar a interface simplificada e Tables

interface MercadoPagoAccount {
  id: string;
  name: string;
  accessToken: string | null; // Permitir null
  publicKey: string | null; // Permitir null
  clientId: string | null; // Permitir null
  clientSecret: string | null; // Permitir null
}

interface MetaPixel {
  id: string;
  name: string;
  pixelId: string;
  accessToken?: string;
}

interface UTMifyConfig {
  apiKey: string;
  websiteId: string;
  trackPurchases: boolean;
  trackEvents: boolean;
  customDomain?: string;
}

export const useIntegrations = () => {
  const { user } = useAuth();
  const [mercadoPagoAccounts, setMercadoPagoAccounts] = useState<MercadoPagoAccount[]>([]);
  const [metaPixels, setMetaPixels] = useState<MetaPixel[]>([]);
  const [utmifyConfig, setUtmifyConfig] = useState<UTMifyConfig | null>(null);
  const [emailConfig, setEmailConfig] = useState<SimplifiedEmailConfig | null>(null); // Usar a interface simplificada
  const [loading, setLoading] = useState(true);

  const loadIntegrations = useCallback(async () => {
    if (!user) {
      // Limpar dados quando não há usuário logado
      setMercadoPagoAccounts([]);
      setMetaPixels([]);
      setUtmifyConfig(null);
      setEmailConfig(null);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Erro ao carregar integrações:', error);
        return;
      }

      if (data) {
        const integrationData = data as Tables<'integrations'>; // Cast para o tipo correto

        // Parse dos dados salvos
        setMercadoPagoAccounts(integrationData.mercado_pago_access_token ? [{
          id: '1',
          name: 'Conta Principal',
          accessToken: integrationData.mercado_pago_access_token, // Corrigido o nome do campo
          publicKey: integrationData.mercado_pago_token_public || null,
          clientId: null,
          clientSecret: null
        }] : []);

        setMetaPixels(integrationData.meta_pixel_id ? [{
          id: '1',
          name: 'Pixel Principal',
          pixelId: integrationData.meta_pixel_id,
          accessToken: ''
        }] : []);

        setUtmifyConfig(integrationData.utmify_code ? {
          apiKey: integrationData.utmify_code,
          websiteId: '',
          trackPurchases: true,
          trackEvents: true,
          customDomain: ''
        } : null);

        // Carregar a nova estrutura simplificada do smtp_config
        // Adicionar verificação para garantir que não é um array antes de fazer o cast
        setEmailConfig(
          integrationData.smtp_config && 
          typeof integrationData.smtp_config === 'object' && 
          integrationData.smtp_config !== null && 
          'email' in integrationData.smtp_config && 
          'appPassword' in integrationData.smtp_config && 
          'displayName' in integrationData.smtp_config
            ? (integrationData.smtp_config as unknown as SimplifiedEmailConfig) 
            : null
        );
      } else {
        // Se não houver dados, garantir que os estados sejam resetados para o padrão
        setMercadoPagoAccounts([]);
        setMetaPixels([]);
        setUtmifyConfig(null);
        setEmailConfig(null);
      }
    } catch (error) {
      console.error('Erro ao carregar integrações:', error);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]); // Dependências para useCallback

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]); // Agora loadIntegrations é uma dependência estável

  const saveIntegrations = async (updates: Partial<{
    mercadoPagoAccounts: MercadoPagoAccount[];
    metaPixels: MetaPixel[];
    utmifyConfig: UTMifyConfig | null;
    emailConfig: SimplifiedEmailConfig | null; // Usar a interface simplificada
  }>) => {
    if (!user) return;

    try {
      const integrationData: TablesUpdate<'integrations'> = {}; // Usar TablesUpdate

      if (updates.mercadoPagoAccounts !== undefined) {
        const account = updates.mercadoPagoAccounts[0];
        integrationData.mercado_pago_access_token = account?.accessToken || null;
        integrationData.mercado_pago_token_public = account?.publicKey || null;
        setMercadoPagoAccounts(updates.mercadoPagoAccounts);
      }

      if (updates.metaPixels !== undefined) {
        const pixel = updates.metaPixels[0];
        integrationData.meta_pixel_id = pixel?.pixelId || null;
        setMetaPixels(updates.metaPixels);
      }

      if (updates.utmifyConfig !== undefined) {
        integrationData.utmify_code = updates.utmifyConfig?.apiKey || null;
        setUtmifyConfig(updates.utmifyConfig);
      }

      if (updates.emailConfig !== undefined) {
        integrationData.smtp_config = updates.emailConfig as Json || null; // Salvar a nova estrutura como Json
        setEmailConfig(updates.emailConfig);
      }

      // Verificar se existe integração para este usuário
      const { data: existing } = await supabase
        .from('integrations')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Atualizar existente
        const { error } = await supabase
          .from('integrations')
          .update(integrationData)
          .eq('user_id', user.id);

        if (error) {
          console.error('Erro ao atualizar integrações:', error);
          throw error;
        }
      } else {
        // Criar nova
        const { error } = await supabase
          .from('integrations')
          .insert({
            user_id: user.id,
            ...integrationData
          } as TablesInsert<'integrations'>); // Cast para TablesInsert

        if (error) {
          console.error('Erro ao criar integrações:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error('Erro ao salvar integrações:', error);
      throw error;
    }
  };

  const trackPurchase = (purchaseData: any) => {
    // Implementar tracking de compra para UTMify
    if (utmifyConfig && utmifyConfig.trackPurchases) {
      console.log('Tracking purchase with UTMify:', purchaseData);
      // Aqui você implementaria a chamada para a API do UTMify
    }
  };

  const trackEvent = (eventName: string, eventData: any) => {
    // Implementar tracking de evento para UTMify
    if (utmifyConfig && utmifyConfig.trackEvents) {
      console.log('Tracking event with UTMify:', eventName, eventData);
      // Aqui você implementaria a chamada para a API do UTMify
    }
  };

  const sendEmail = async (emailData: {
    to: string;
    subject: string;
    html: string;
  }) => {
    // Implementar envio de email
    if (emailConfig) {
      console.log('Sending email:', emailData);
      // Geralmente isso seria feito através de uma API backend
    }
  };

  const fireMetaPixel = (eventName: string, eventData: any) => {
    // Implementar disparo de eventos para Meta Pixel
    if (metaPixels.length > 0) {
      metaPixels.forEach((pixel) => {
        if (typeof window !== 'undefined' && (window as any).fbq) {
          (window as any).fbq('track', eventName, eventData);
        }
      });
    }
  };

  // Lógica atualizada para verificar se a configuração de e-mail está ativa
  const isEmailConfigured = !!(emailConfig && 
                             emailConfig.email && 
                             emailConfig.appPassword && 
                             emailConfig.displayName);

  return {
    mercadoPagoAccounts,
    metaPixels,
    utmifyConfig,
    emailConfig,
    loading,
    saveIntegrations,
    loadIntegrations,
    trackPurchase,
    trackEvent,
    sendEmail,
    fireMetaPixel,
    isConfigured: {
      mercadoPago: mercadoPagoAccounts.length > 0,
      metaPixel: metaPixels.length > 0,
      utmify: utmifyConfig !== null,
      email: isEmailConfigured // Usar a nova variável de status
    }
  };
};