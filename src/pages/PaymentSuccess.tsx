 
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Download, MessageCircle, Copy, CreditCard, QrCode, Shield, Clock, AlertTriangle, ChevronDown, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import nubankLogo from '@/assets/banks/nubank-logo.png';
import itauLogo from '@/assets/banks/itau-logo.png';
import bradescoLogo from '@/assets/banks/bradesco-logo.png';
import santanderLogo from '@/assets/banks/santander-logo.png';
import { DeliverableConfig, FormFields, PackageConfig } from '@/integrations/supabase/types';
import { CheckoutData } from '@/components/checkout/CheckoutLayoutProps';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [paymentData, setPaymentData] = useState<any>(null);
  const [isProtectionOpen, setIsProtectionOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [productData, setProductData] = useState<CheckoutData['products'] | null>(null); // Main checkout product
  const [checkoutDeliverable, setCheckoutDeliverable] = useState<DeliverableConfig | null>(null); // Checkout-level deliverable
  // const [packageDeliverable, setPackageDeliverable] = useState<DeliverableConfig | null>(null); // REMOVIDO
  const [isChecking, setIsChecking] = useState(true);
  const [lastDetail, setLastDetail] = useState<string | null>(null);
  const [deliverableLinkToDisplay, setDeliverableLinkToDisplay] = useState<string | null>(null);
  const [sendTransactionalEmail, setSendTransactionalEmail] = useState<boolean>(true);

  const intervalRef = useRef<number | null>(null);
  const isMounted = useRef(true);

  const clearPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('PAYMENT_SUCCESS_DEBUG: Polling interval cleared.');
    }
  };

  const deriveDeliverableLink = (
    product: CheckoutData['products'] | null,
    checkoutDeliverableConfig: DeliverableConfig | null,
    // packageDeliverableConfig: DeliverableConfig | null, // REMOVIDO
    emailTransactionalDeliverableLink: string | null
  ): string | null => {
    console.log('PAYMENT_SUCCESS_DEBUG: deriveDeliverableLink called with:', { product, checkoutDeliverableConfig, emailTransactionalDeliverableLink });
    
    // 1. Prioritize link from emailTransactionalDeliverableLink (passed from Edge Function)
    if (emailTransactionalDeliverableLink) {
      console.log('PAYMENT_SUCCESS_DEBUG: Derived link from emailTransactionalDeliverableLink (highest priority):', emailTransactionalDeliverableLink);
      return emailTransactionalDeliverableLink;
    }
    // 2. Then, package-specific deliverable // REMOVIDO
    // if (packageDeliverableConfig?.type !== 'none' && (packageDeliverableConfig?.link || packageDeliverableConfig?.fileUrl)) {
    //   console.log('PAYMENT_SUCCESS_DEBUG: Derived link from packageDeliverableConfig:', packageDeliverableConfig.link || packageDeliverableConfig.fileUrl);
    //   return packageDeliverableConfig.link || packageDeliverableConfig.fileUrl;
    // }
    // 3. Then, checkout-level deliverable
    if (checkoutDeliverableConfig?.type !== 'none' && (checkoutDeliverableConfig?.link || checkoutDeliverableConfig?.fileUrl)) {
      console.log('PAYMENT_SUCCESS_DEBUG: Derived link from checkoutDeliverableConfig:', checkoutDeliverableConfig.link || checkoutDeliverableConfig.fileUrl);
      return checkoutDeliverableConfig.link || checkoutDeliverableConfig.fileUrl;
    }
    // 4. Finally, main product deliverable
    if (product?.member_area_link || product?.file_url) {
      console.log('PAYMENT_SUCCESS_DEBUG: Derived link from productData:', product.member_area_link || product.file_url);
      return product.member_area_link || product.file_url;
    }
    console.log('PAYMENT_SUCCESS_DEBUG: No deliverable link derived, returning null.');
    return null;
  };

  const fetchAndVerifyPayment = async (mpIdToCheck: string) => {
    console.log('PAYMENT_SUCCESS_DEBUG: 7. Starting fetchAndVerifyPayment for MP ID:', mpIdToCheck);
    let fetchedPaymentFromDb: any = null;

    try {
      console.log('PAYMENT_SUCCESS_DEBUG: 9. Invoking verify-mercado-pago-payment for MP ID:', mpIdToCheck);
      const res = await supabase.functions.invoke('verify-mercado-pago-payment', {
        body: { mp_payment_id: mpIdToCheck },
        method: 'POST'
      });
      console.log('PAYMENT_SUCCESS_DEBUG: 10. Response from verify-mercado-pago-payment:', res);

      if (!isMounted.current) return;

      if (res.data?.success) {
        const dbPaymentStatus = res.data.payment?.status;
        const dbMpPaymentStatus = res.data.payment?.mp_payment_status;
        console.log('PAYMENT_SUCCESS_DEBUG: 11. DB Payment Status from Edge Function:', { dbPaymentStatus, dbMpPaymentStatus });

        if (dbPaymentStatus === 'completed' || dbMpPaymentStatus === 'approved') {
          setPaymentStatus('completed');
          setIsChecking(false);
          clearPolling(); // <--- Clear polling here
          localStorage.removeItem('paymentData'); // Limpar localStorage ao completar
          console.log('PAYMENT_SUCCESS_DEBUG: 12. Status updated to COMPLETED (from Edge Function) and localStorage cleared.');
          fetchedPaymentFromDb = res.data.payment;
          console.log('PAYMENT_SUCCESS_DEBUG: 11.1. Full fetchedPaymentFromDb:', JSON.stringify(fetchedPaymentFromDb, null, 2));
        } else if (dbPaymentStatus === 'failed' || dbMpPaymentStatus === 'rejected') {
          setPaymentStatus('failed');
          setIsChecking(false);
          clearPolling(); // <--- Clear polling here
          localStorage.removeItem('paymentData'); // Limpar localStorage ao falhar
          console.log('PAYMENT_SUCCESS_DEBUG: 13. Status updated to FAILED (from Edge Function) and localStorage cleared.');
        } else {
          setLastDetail(res.data.status_detail || null);
          console.log('PAYMENT_SUCCESS_DEBUG: 14. Status still PENDING, last detail:', res.data.status_detail);
        }
      } else if (res.error) {
        console.error('PAYMENT_SUCCESS_DEBUG: 15. Error invoking verify-mercado-pago-payment:', res.error);
        setIsChecking(false);
        clearPolling();
        localStorage.removeItem('paymentData'); // Limpar localStorage em caso de erro na verificação
        setPaymentStatus('failed'); // Assume failed if verification itself fails
      }
    } catch (err) {
      console.warn('PAYMENT_SUCCESS_DEBUG: 16. Erro ao verificar status via Edge Function:', err);
      setIsChecking(false);
      clearPolling();
      localStorage.removeItem('paymentData'); // Limpar localStorage em caso de erro
      setPaymentStatus('failed'); // Assume failed on network/unexpected error
    }

    if (!isMounted.current) return;

    if (fetchedPaymentFromDb) {
      console.log('PAYMENT_SUCCESS_DEBUG: 20. Processing fetchedPaymentFromDb for product/deliverable data.');
      const currentProduct = fetchedPaymentFromDb.checkouts?.products as CheckoutData['products'] || null;
      const emailTransactionalDeliverableLink = (fetchedPaymentFromDb.metadata as any)?.email_transactional_data?.deliverableLink || null;
      const currentCheckoutDeliverableConfig = fetchedPaymentFromDb.checkouts?.form_fields?.deliverable as DeliverableConfig || null;
      const currentSendTransactionalEmail = (fetchedPaymentFromDb.metadata as any)?.email_transactional_data?.sendTransactionalEmail ?? true;
      
      // Get package-specific deliverable from fetched payment // REMOVIDO
      // const selectedPackageId = (fetchedPaymentFromDb.metadata as any)?.selected_package;
      // const packages = fetchedPaymentFromDb.checkouts?.form_fields?.packages as PackageConfig[] || [];
      // const selectedPackageDetails = packages.find(pkg => pkg.id === selectedPackageId);
      // const currentPackageDeliverableConfig = selectedPackageDetails?.deliverable || null;

      setProductData(currentProduct);
      setCheckoutDeliverable(currentCheckoutDeliverableConfig);
      // setPackageDeliverable(currentPackageDeliverableConfig); // REMOVIDO
      setSendTransactionalEmail(currentSendTransactionalEmail);

      const determinedLink = deriveDeliverableLink(
        currentProduct,
        currentCheckoutDeliverableConfig,
        // currentPackageDeliverableConfig, // REMOVIDO
        emailTransactionalDeliverableLink
      );
      setDeliverableLinkToDisplay(determinedLink);
      console.log('PAYMENT_SUCCESS_DEBUG: 21. Product/Deliverable data updated from fetched payment:', { currentProduct, currentCheckoutDeliverableConfig, determinedLink, currentSendTransactionalEmail });
    } else {
      setProductData(null);
      setCheckoutDeliverable(null);
      // setPackageDeliverable(null); // REMOVIDO
      setDeliverableLinkToDisplay(null);
      setSendTransactionalEmail(true); // Default to true if no specific data
    }
  };

  useEffect(() => {
    isMounted.current = true;
    let initialPaymentData: any = null;
    const savedPaymentData = localStorage.getItem('paymentData');
    console.log('PAYMENT_SUCCESS_DEBUG: 1. Saved payment data from localStorage (initial effect):', savedPaymentData);

    if (savedPaymentData) {
      initialPaymentData = JSON.parse(savedPaymentData);
      setPaymentData(initialPaymentData);
      setSendTransactionalEmail(initialPaymentData.sendTransactionalEmail ?? true);

      // Directly use product and deliverable data from the payment object in localStorage
      const productFromLocalStorage = initialPaymentData.payment?.checkouts?.products as CheckoutData['products'] || null;
      const checkoutDeliverableFromLocalStorage = initialPaymentData.payment?.checkouts?.form_fields?.deliverable as DeliverableConfig || null;
      const emailTransactionalDeliverableLinkFromLocalStorage = initialPaymentData.deliverableLink || null;
      
      // Get package-specific deliverable from localStorage // REMOVIDO
      // const selectedPackageId = initialPaymentData.selectedPackage;
      // const packages = initialPaymentData.payment?.checkouts?.form_fields?.packages as PackageConfig[] || [];
      // const selectedPackageDetails = packages.find(pkg => pkg.id === selectedPackageId);
      // const packageDeliverableFromLocalStorage = selectedPackageDetails?.deliverable || null;

      setProductData(productFromLocalStorage);
      setCheckoutDeliverable(checkoutDeliverableFromLocalStorage);
      // setPackageDeliverable(packageDeliverableFromLocalStorage); // REMOVIDO

      const initialDeterminedLink = deriveDeliverableLink(
        productFromLocalStorage,
        checkoutDeliverableFromLocalStorage,
        // packageDeliverableFromLocalStorage, // REMOVIDO
        emailTransactionalDeliverableLinkFromLocalStorage
      );
      setDeliverableLinkToDisplay(initialDeterminedLink);

      console.log('PAYMENT_SUCCESS_DEBUG: 2. Initialized from localStorage (initial effect):', { initialPaymentData, initialDeterminedLink, sendTransactionalEmail: initialPaymentData.sendTransactionalEmail });
    }

    const urlStatus = searchParams.get('status');
    const urlPaymentId = searchParams.get('payment_id');
    const mpIdToCheck = urlPaymentId || initialPaymentData?.payment?.mp_payment_id;
    console.log('PAYMENT_SUCCESS_DEBUG: 3. URL Params:', { urlStatus, urlPaymentId });
    console.log('PAYMENT_SUCCESS_DEBUG: 8. MP ID to check (initial effect):', mpIdToCheck);

    // Clear any existing polling interval before setting up a new one
    clearPolling();

    // Case 1: Status is already confirmed as completed by URL parameter
    if (urlStatus === 'approved' || urlStatus === 'completed') {
      setPaymentStatus('completed');
      setIsChecking(false);
      localStorage.removeItem('paymentData'); 
      console.log('PAYMENT_SUCCESS_DEBUG: 4. Initial status: COMPLETED (from URL) and localStorage cleared.');
    } 
    // Case 2: PIX payment with QR code from localStorage
    else if (initialPaymentData?.paymentMethod === 'pix' && initialPaymentData?.payment?.qr_code) {
      setPaymentStatus('pending'); // It's pending until paid
      setIsChecking(false); // But we show the QR code immediately
      console.log('PAYMENT_SUCCESS_DEBUG: 5. Initial status: PENDING (PIX with QR code, showing QR)');
      if (mpIdToCheck) {
        // Start polling for PIX status
        intervalRef.current = setInterval(() => {
          if (isMounted.current) { // Check if component is still mounted
            console.log('PAYMENT_SUCCESS_DEBUG: 23. Interval check (PIX): re-fetching...');
            fetchAndVerifyPayment(mpIdToCheck);
          } else {
            clearPolling();
          }
        }, 5000) as unknown as number;
      }
    }
    // Case 3: Other pending payment (e.g., Credit Card processing, or PIX without QR in local storage, or just an MP ID from URL)
    else if (mpIdToCheck) {
      setPaymentStatus('pending');
      setIsChecking(true); // Show spinner for generic checking
      console.log('PAYMENT_SUCCESS_DEBUG: 6. Initial status: PENDING (default, starting check)');
      fetchAndVerifyPayment(mpIdToCheck); // Initial check
      
      intervalRef.current = setInterval(() => {
        if (isMounted.current) { // Check if component is still mounted
          console.log('PAYMENT_SUCCESS_DEBUG: 23. Interval check: re-fetching...');
          fetchAndVerifyPayment(mpIdToCheck);
        } else {
          clearPolling();
        }
      }, 5000) as unknown as number;
    } 
    // Case 4: No MP ID to check and no definitive URL status, so it's a failed/unknown state
    else {
      setPaymentStatus('failed'); 
      setIsChecking(false);
      localStorage.removeItem('paymentData'); 
      console.log('PAYMENT_SUCCESS_DEBUG: 6.1. No payment data or MP ID, defaulting to FAILED and localStorage cleared.');
    }

    return () => {
      isMounted.current = false;
      clearPolling();
      console.log('PAYMENT_SUCCESS_DEBUG: 25. Component unmounted or effect re-ran, interval cleared.');
    };
  }, [searchParams]); // Removed paymentStatus from dependencies

  useEffect(() => {
    console.log('PAYMENT_SUCCESS_DEBUG: Redirection useEffect triggered. Current values:', { paymentStatus, deliverableLinkToDisplay });
    if (paymentStatus === 'completed' && deliverableLinkToDisplay) {
      console.log('PAYMENT_SUCCESS_DEBUG: Payment completed and deliverable link found. User will stay on this page.');
      toast({
        title: "Pagamento Aprovado! ✅",
        description: "Seu acesso ao produto está liberado. Clique no botão abaixo para acessá-lo.",
      });
    }
  }, [paymentStatus, deliverableLinkToDisplay, toast]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Código PIX copiado para a área de transferência",
    });
  };

  const copyQRCode = () => {
    if (paymentData?.payment?.qr_code) {
      copyToClipboard(paymentData.payment.qr_code);
    }
  };

  const getDeliverableButtonText = (link: string | null) => {
    if (!link) return 'Acessar Produto';
    // if (packageDeliverable?.name) { // REMOVIDO
    //   return `Acessar ${packageDeliverable.name}`;
    // }
    if (checkoutDeliverable?.name) { // Then checkout-level deliverable name
      return `Acessar ${checkoutDeliverable.name}`;
    }
    if (productData?.name) { // Finally main product name
      return `Acessar ${productData.name}`;
    }
    return 'Acessar Produto';
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="border-blue-200">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
              <CardTitle className="text-xl sm:text-2xl text-blue-700">
                Verificando Pagamento...
              </CardTitle>
              <p className="text-sm sm:text-base text-muted-foreground">
                Aguarde enquanto confirmamos seu pagamento
              </p>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="border-green-200">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              </div>
              <CardTitle className="text-xl sm:text-2xl text-green-700">
                🎉 Pagamento Aprovado!
              </CardTitle>
              <p className="text-sm sm:text-base text-muted-foreground">
                Sua compra foi processada com sucesso
              </p>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <div className="text-center space-y-3 sm:space-y-4">
                <p className="text-base sm:text-lg font-medium text-green-800">
                  Parabéns! Agora você tem acesso completo ao seu produto.
                </p>
                
                {deliverableLinkToDisplay && (
                  <div className="bg-white border border-green-200 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                    <h3 className="font-semibold text-base sm:text-lg text-gray-800">
                      {/* {packageDeliverable?.name || checkoutDeliverable?.name || productData?.name || 'Seu Produto'} */}
                      {checkoutDeliverable?.name || productData?.name || 'Seu Produto'}
                    </h3>
                    
                    {(/* packageDeliverable?.description || */ checkoutDeliverable?.description || productData?.description) && (
                      <p className="text-xs sm:text-sm text-gray-600">
                        {/* {packageDeliverable?.description || */ checkoutDeliverable?.description || productData?.description}
                      </p>
                    )}
                    
                    <div className="space-y-3">
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base"
                        onClick={() => window.open(deliverableLinkToDisplay, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {getDeliverableButtonText(deliverableLinkToDisplay)}
                      </Button>
                    </div>
                  </div>
                )}
                
                {!deliverableLinkToDisplay && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
                    <p className="text-sm text-yellow-800">
                      O acesso ao produto será enviado por e-mail em breve.
                    </p>
                  </div>
                )}
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                  <h3 className="font-semibold text-green-800 mb-2 text-base sm:text-lg">Importante:</h3>
                  <ul className="text-sm text-green-700 space-y-1 text-left">
                    {sendTransactionalEmail && (
                      <li>• Você também receberá um e-mail com os detalhes</li>
                    )}
                    <li>• Guarde este link para acessar quando quiser</li>
                    <li>• Entre em contato se tiver dúvidas</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  if (paymentStatus === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="border-red-200">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
              </div>
              <CardTitle className="text-xl sm:text-2xl text-red-700">
                Pagamento Não Aprovado
              </CardTitle>
              <p className="text-sm sm:text-base text-muted-foreground">
                Houve um problema com seu pagamento
              </p>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <div className="text-center space-y-3 sm:space-y-4">
                <p className="text-base sm:text-lg">
                  Não se preocupe! Você pode tentar novamente.
                </p>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                  <h3 className="font-semibold text-red-800 mb-2 text-base sm:text-lg">Possíveis causas:</h3>
                  <ul className="text-sm text-red-700 space-y-1">
                    <li>• Saldo insuficiente</li>
                    <li>• Dados incorretos</li>
                    <li>• Problema temporário</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  className="flex-1 text-sm sm:text-base"
                  onClick={() => navigate(-1)}
                >
                  Tentar Novamente
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1 text-sm sm:text-base"
                  onClick={() => navigate('/')}
                >
                  Voltar ao início
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'pending') {
    if (paymentData?.paymentMethod === 'creditCard') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
          <Card className="border-blue-200">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 animate-pulse" />
              </div>
              <CardTitle className="text-xl sm:text-2xl text-blue-700">
                Processando pagamento...
              </CardTitle>
              <p className="text-sm sm:text-base text-muted-foreground">
                Estamos processando seu pagamento aqui no checkout. Aguarde a confirmação, sem redirecionamento externo.
              </p>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm sm:text-base text-muted-foreground mt-2">
                Status atual: {paymentStatus}{lastDetail ? ` (${lastDetail})` : ''}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    const primaryColor = paymentData?.checkoutStyles?.primaryColor || '#ec4899';
    const gradientColor = paymentData?.checkoutStyles?.gradientColor || primaryColor;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="border-green-200">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${primaryColor}20` }}>
                <Clock className="h-6 w-6 sm:h-8 sm:w-8" style={{ color: primaryColor }} />
              </div>
              <CardTitle className="text-xl sm:text-2xl text-gray-700 mb-2">
                Falta pouco! Sua transformação está a um passo de começar.
              </CardTitle>
              <p className="text-sm sm:text-base text-muted-foreground">
                Para concluir, escaneie o QR Code ou use o "Copia e Cola" no seu app do banco.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <div className="text-center space-y-3 sm:space-y-4">
                <div className="bg-white p-4 sm:p-6 rounded-lg border-2" style={{ borderColor: `${primaryColor}40` }}>
                  <h3 className="font-semibold mb-2 text-base sm:text-lg" style={{ color: primaryColor }}>Valor a pagar:</h3>
                  <p className="text-xl sm:text-2xl font-bold" style={{ color: primaryColor }}>
                    R$ {paymentData.total.toFixed(2).replace('.', ',')}
                  </p>
                </div>

                {paymentData.payment?.qr_code_base64 && (
                  <div className="bg-white p-4 sm:p-6 rounded-lg border">
                    <h3 className="font-semibold mb-2 text-base sm:text-lg">QR Code PIX:</h3>
                    <div className="flex justify-center mb-4">
                      <img 
                        src={`data:image/png;base64,${paymentData.payment.qr_code_base64}`}
                        alt="QR Code PIX"
                        className="max-w-[12rem] sm:max-w-48 h-auto"
                      />
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Abra o aplicativo do seu banco e escaneie o QR Code acima
                    </p>
                  </div>
                )}

                {paymentData.payment?.qr_code && (
                  <div className="space-y-4">
                    <Button 
                       onClick={copyQRCode}
                       className="w-full text-white py-3 sm:py-4 text-base sm:text-lg font-semibold hover:opacity-90 transition-all duration-300"
                       style={{ 
                         background: `linear-gradient(135deg, ${primaryColor}, ${gradientColor}dd)`,
                         boxShadow: `0 4px 15px ${primaryColor}33`
                       }}
                       size="lg"
                     >
                     Copiar Código PIX
                    </Button>
                    
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-xs sm:text-sm text-yellow-800">
                        Os bancos reforçaram a segurança do Pix e podem exibir avisos preventivos. Não se preocupe, sua transação está protegida.
                      </AlertDescription>
                    </Alert>
                    
                    <Collapsible open={isProtectionOpen} onOpenChange={setIsProtectionOpen}>
                      <CollapsibleTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-between text-sm sm:text-base border-gray-300 hover:bg-gray-50"
                        >
                          Proteção Bancária: Saiba mais
                          <ChevronDown className={`h-4 w-4 transition-transform ${isProtectionOpen ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="bg-white border rounded-lg p-4 sm:p-6">
                          <Tabs defaultValue="nubank" className="w-full">
                            <TabsList className="grid w-full grid-cols-4 h-auto p-1">
                              <TabsTrigger value="nubank" className="text-xs sm:text-sm py-2">Nubank</TabsTrigger>
                              <TabsTrigger value="itau" className="text-xs sm:text-sm py-2">Itaú</TabsTrigger>
                              <TabsTrigger value="bradesco" className="text-xs sm:text-sm py-2">Bradesco</TabsTrigger>
                              <TabsTrigger value="santander" className="text-xs sm:text-sm py-2">Santander</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="nubank" className="mt-4 space-y-3">
                              <div className="flex justify-center mb-4">
                                <img 
                                  src="/lovable-uploads/ecad8c6d-aea7-4fb7-a728-d52632530987.png" 
                                  alt="Alerta de Golpe Nubank"
                                  className="w-full max-w-xs sm:max-w-sm rounded-lg shadow-sm"
                                />
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="itau" className="mt-4 space-y-3">
                              <div className="flex justify-center mb-4">
                                <img 
                                  src="/lovable-uploads/a76239a2-eeaf-4efa-9312-9084cbcd1865.png" 
                                  alt="Alerta de Golpe Itaú"
                                  className="w-full max-w-xs sm:max-w-sm rounded-lg shadow-sm"
                                />
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="bradesco" className="mt-4 space-y-3">
                              <div className="flex justify-center mb-4">
                                <img 
                                  src="/lovable-uploads/8ae820f6-6087-42c8-b64e-aff574e6fdf7.png" 
                                  alt="Alerta de Golpe Bradesco"
                                  className="w-full max-w-xs sm:max-w-sm rounded-lg shadow-sm"
                                />
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="santander" className="mt-4 space-y-3">
                              <div className="flex justify-center mb-4">
                                <img 
                                  src="/lovable-uploads/0009e46d-54a9-415f-b6e6-b5262f1bc520.png" 
                                  alt="Alerta de Golpe Santander"
                                  className="w-full max-w-xs sm:max-w-sm rounded-lg shadow-sm"
                                />
                              </div>
                            </TabsContent>
                          </Tabs>
                          
                          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-800 text-center">
                              Se exibido no app, clique na opção indicada para finalizar sua compra com segurança.
                            </p>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                 </div>
                )}
              </div>

              <div className="bg-white border rounded-lg p-4 sm:p-6 text-center">
                <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 mb-4">
                  <div className="w-full h-full border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
                <h3 className="font-semibold text-gray-700 mb-2 text-base sm:text-lg">
                  Aguardando confirmação do pagamento...
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Você será redirecionado automaticamente. Após a confirmação, o acesso é liberado e você receberá um e-mail com os detalhes.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Fallback return for unexpected payment statuses or initial states
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card className="border-gray-200">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" />
            </div>
            <CardTitle className="text-xl sm:text-2xl text-gray-700">
              Status do Pagamento Desconhecido
            </CardTitle>
            <p className="text-sm sm:text-base text-muted-foreground">
              Não foi possível determinar o status do seu pagamento. Por favor, verifique seu e-mail ou entre em contato com o suporte.
            </p>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/')} className="text-sm sm:text-base">Voltar ao Início</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentSuccess;