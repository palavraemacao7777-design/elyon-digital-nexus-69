 
import { useState, useEffect } from 'react';
import { useIntegrations } from './useIntegrations';
import { loadMetaPixel, trackEvent } from '@/utils/metaPixelLoader';

interface CheckoutIntegrations {
  selectedMercadoPagoAccount?: string;
  selectedMetaPixel?: string;
}

export const useCheckoutIntegrations = (checkoutIntegrations: CheckoutIntegrations) => {
  const { mercadoPagoAccounts, metaPixels, fireMetaPixel, trackPurchase } = useIntegrations();
  const [selectedMPAccount, setSelectedMPAccount] = useState<any>(null);
  const [selectedPixel, setSelectedPixel] = useState<any>(null);

  useEffect(() => {
    // Carregar conta do Mercado Pago selecionada
    if (checkoutIntegrations.selectedMercadoPagoAccount) {
      const account = mercadoPagoAccounts.find(
        acc => acc.id === checkoutIntegrations.selectedMercadoPagoAccount
      );
      setSelectedMPAccount(account || null);
    }

    // Carregar Meta Pixel selecionado
    if (checkoutIntegrations.selectedMetaPixel) {
      const pixel = metaPixels.find(
        px => px.id === checkoutIntegrations.selectedMetaPixel
      );
      setSelectedPixel(pixel || null);
    }
  }, [checkoutIntegrations, mercadoPagoAccounts, metaPixels]);

  // Carregar e disparar evento de visualização da página (PageView)
  useEffect(() => {
    if (selectedPixel) {
      loadMetaPixel(selectedPixel);
    }
  }, [selectedPixel]);

  const trackCheckoutEvent = (eventName: string, eventData: any) => {
    if (selectedPixel) {
      trackEvent(eventName, eventData);
    }
    
    trackPurchase(eventData);
  };

  const trackPurchaseEvent = (purchaseData: any) => {
    const eventData = {
      value: purchaseData.amount / 100, // Converter de centavos para reais
      currency: 'BRL',
      content_ids: [purchaseData.product_id],
      content_type: 'product',
      num_items: 1
    };

    trackCheckoutEvent('Purchase', eventData);
  };

  const trackAddToCartEvent = (productData: any) => {
    const eventData = {
      value: productData.price / 100,
      currency: 'BRL',
      content_ids: [productData.product_id],
      content_type: 'product'
    };

    trackCheckoutEvent('AddToCart', eventData);
  };

  const trackInitiateCheckoutEvent = (checkoutData: any) => {
    const eventData = {
      value: checkoutData.total / 100,
      currency: 'BRL',
      content_ids: [checkoutData.product_id],
      content_type: 'product',
      num_items: 1
    };

    trackCheckoutEvent('InitiateCheckout', eventData);
  };

  return {
    selectedMPAccount,
    selectedPixel,
    trackPurchaseEvent,
    trackAddToCartEvent,
    trackInitiateCheckoutEvent,
    trackCheckoutEvent,
    hasIntegrations: Boolean(selectedMPAccount || selectedPixel)
  };
};