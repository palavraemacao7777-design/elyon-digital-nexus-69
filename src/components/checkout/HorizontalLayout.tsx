import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Shield, CheckCircle, CreditCard, Star, ChevronDown, ChevronUp, Heart, ArrowRight, Clock, ShoppingBag, QrCode } from 'lucide-react';
import { CheckoutLayoutProps } from './CheckoutLayoutProps';
import { getOrderBumpPrefix } from '@/utils/orderBumpUtils';
import { processHeadlineText, formatCurrency } from '@/utils/textFormatting';
import PackageSelector from './PackageSelector';
import SecuritySection from './SecuritySection';
import CountdownTimer from './CountdownTimer';
import { CreditCardForm } from './CreditCardForm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

 
import React, { useState } from 'react';

const HorizontalLayout = ({
  checkout,
  customerData,
  selectedOrderBumps,
  selectedPaymentMethod,
  selectedPackage = 1,
  setSelectedPackage,
  processing,
  textColor,
  primaryColor,
  headlineText,
  headlineColor,
  highlightColor,
  description,
  gradientColor,
  calculateTotal,
  calculateSavings,
  handleInputChange,
  handleOrderBumpToggle,
  setSelectedPaymentMethod,
  handleSubmit,
  cardData,
  setCardData,
  mpPublicKey,
  selectedInstallments,
  setSelectedInstallments
}: CheckoutLayoutProps) => {
  const [openPackages, setOpenPackages] = useState<Record<number, boolean>>({1: true});

  const handlePackageSelect = (packageId: number) => {
    setSelectedPackage?.(packageId);
    // Recolher todos e expandir apenas o selecionado
    setOpenPackages({ [packageId]: true });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Countdown Timer */}
      {(() => {
        console.log('Verificando timer:', checkout.timer);
        console.log('Timer enabled?', checkout.timer?.enabled);
        return checkout.timer?.enabled && (
          <div className="mb-4 sm:mb-8">
            <CountdownTimer
              duration={checkout.timer.duration || 15}
              color={checkout.timer.color || primaryColor}
              text={checkout.timer.text || "Oferta por tempo limitado"}
            />
          </div>
        );
      })()}

      {/* Product Header */}
      <div className="text-center space-y-4 sm:space-y-6 py-8 sm:py-12 mb-8 sm:mb-12">
        {/* NEW: Display checkout banner if available */}
        {checkout.styles?.banner_url && (
          <div className="flex justify-center mb-6 sm:mb-8">
            <img 
              src={checkout.styles.banner_url} 
              alt={checkout.products.name}
              className="w-full max-h-96 object-cover rounded-lg animate-fade-in"
            />
          </div>
        )}

        {/* NEW: Display checkout logo if available */}
        {checkout.styles?.logo_url && (
          <div className="flex justify-center mb-6 sm:mb-8">
            <img 
              src={checkout.styles.logo_url} 
              alt={checkout.products.name}
              className="h-32 sm:h-48 lg:h-64 w-auto object-contain animate-fade-in hover-scale"
            />
          </div>
        )}
        
        <div className="space-y-4 sm:space-y-6">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold animate-fade-in leading-tight" style={{ color: headlineColor }}>
            {processHeadlineText(headlineText, checkout.styles?.highlightColor || primaryColor)}
          </h1>
          
          <p className="text-base sm:text-lg lg:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed animate-fade-in">
            {description}
          </p>
        </div>
      </div>

      {/* Container Principal com todas as seções */}
      <Card className="shadow-2xl border-2 max-w-5xl mx-auto mb-8 sm:mb-12">
        <CardContent className="p-4 sm:p-8 lg:p-10">
          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-10">
            {/* Section 1: Seus dados */}
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 border-b-2 pb-3 sm:pb-4 text-center">Seus dados</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-8">
                {(checkout.form_fields?.requireName !== false) && (
                  <div>
                    <Label htmlFor="name" className="text-sm">Nome completo</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Seu nome completo"
                      value={customerData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      required={checkout.form_fields?.requireName}
                      className="text-sm h-9"
                    />
                  </div>
                )}

                {(checkout.form_fields?.requireEmail !== false) && (
                  <div>
                    <Label htmlFor="email" className="text-sm">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu.melhor@email.com"
                      value={customerData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required={checkout.form_fields?.requireEmail}
                      className="text-sm h-9"
                    />
                  </div>
                )}

                {(checkout.form_fields?.requireEmailConfirm !== false) && (
                  <div>
                    <Label htmlFor="emailConfirm" className="text-sm">Confirmar E-mail</Label>
                    <Input
                      id="emailConfirm"
                      type="email"
                      placeholder="Confirme seu e-mail"
                      value={customerData.emailConfirm}
                      onChange={(e) => handleInputChange('emailConfirm', e.target.value)}
                      required={checkout.form_fields?.requireEmailConfirm}
                      className="text-sm h-9"
                    />
                  </div>
                )}

                {(checkout.form_fields?.requirePhone !== false) && (
                  <div>
                    <Label htmlFor="phone" className="text-sm">Telefone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={customerData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      required={checkout.form_fields?.requirePhone}
                      className="text-sm h-9"
                    />
                  </div>
                )}

                {(checkout.form_fields?.requireCpf !== false) && (
                  <div>
                    <Label htmlFor="cpf" className="text-sm">CPF</Label>
                    <Input
                      id="cpf"
                      type="text"
                      placeholder="000.000.000-00"
                      value={customerData.cpf}
                      onChange={(e) => handleInputChange('cpf', e.target.value)}
                      required={checkout.form_fields?.requireCpf}
                      className="text-sm h-9"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Escolha seu pacote */}
      {(checkout.form_fields as any)?.packages && (checkout.form_fields as any).packages.length > 0 && (
              (() => {
                const offerMode = checkout.offerMode || (checkout as any).offer_mode || (checkout as any).offerMode || 'multiple';
                console.log('[HorizontalLayout] offerMode:', offerMode, 'checkout.offerMode:', checkout.offerMode, 'offer_mode:', (checkout as any).offer_mode);
                return (
                  <div className={`space-y-4 sm:space-y-8 ${offerMode === 'single' ? '-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8' : ''}`}>
                    {offerMode === 'single' && (
                      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 border-b-2 pb-3 sm:pb-4 text-center">O que você vai receber</h2>
                    )}
                    {offerMode !== 'single' && (
                      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 border-b-2 pb-3 sm:pb-4 text-center">Escolha seu pacote</h2>
                    )}
                    
                    <PackageSelector
                      packages={(checkout.form_fields as any).packages}
                      selectedPackage={selectedPackage}
                      onSelectPackage={handlePackageSelect}
                      primaryColor={primaryColor}
                      textColor="#1f2937"
                      offerMode={offerMode as 'single' | 'multiple'}
                    />
                  </div>
                );
              })()
            )}

            {/* Section 3: Turbine sua jornada */}
            {checkout.order_bumps && checkout.order_bumps.length > 0 && checkout.order_bumps.some(bump => bump.enabled) && (
              <div className="space-y-4 sm:space-y-8">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 border-b-2 pb-3 sm:pb-4 text-center">Turbine sua jornada</h2>
                <p className="text-sm sm:text-lg lg:text-xl text-gray-600 text-center max-w-3xl mx-auto">Aproveite o desconto exclusivo e adicione estes guias complementares.</p>
                
                <div className="space-y-3 sm:space-y-4 mt-4 sm:mt-8">
                  {checkout.order_bumps
                    .filter(bump => bump.enabled)
                    .map((bump) => {
                      const product = bump.product;
                      const productName = product?.name || 'Produto adicional';
                      const productDescription = product?.description || 'Produto adicional para complementar sua compra';
                      const productImage = product?.banner_url || product?.logo_url;
                      const prefix = getOrderBumpPrefix(productName);
                      
                       return (
                         <div 
                           key={bump.id} 
                           className={`order-bump-container cursor-pointer ${selectedOrderBumps.includes(bump.id) ? 'selected' : ''}`}
                           style={{
                             borderColor: selectedOrderBumps.includes(bump.id) ? primaryColor : undefined,
                             boxShadow: selectedOrderBumps.includes(bump.id) ? `0 4px 16px ${primaryColor}40, 0 2px 8px rgba(0, 0, 0, 0.1), 0 0 0 3px ${primaryColor}20` : undefined
                           }}
                           onClick={() => handleOrderBumpToggle(bump.id)}
                         >
                           <div className="flex items-start space-x-2 sm:space-x-4">
                             {productImage ? (
                               <img 
                                 src={productImage} 
                                 alt={productName}
                                 className="flex-shrink-0 w-10 h-12 sm:w-16 sm:h-20 object-cover rounded border"
                               />
                             ) : (
                               <div className="flex-shrink-0 w-10 h-12 sm:w-16 sm:h-20 bg-gray-100 rounded border flex items-center justify-center">
                                 <span className="text-xs text-gray-500">IMG</span>
                               </div>
                             )}
                             <div className="flex-1 min-w-0">
                               <h4 className="font-semibold text-sm sm:text-base text-gray-800 mb-1 sm:mb-2 line-clamp-2">{productName}</h4>
                               <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-4 line-clamp-2">{productDescription}</p>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                   <div className="relative flex-shrink-0">
                                      <div 
                                        className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200"
                                        style={{ 
                                          borderColor: selectedOrderBumps.includes(bump.id) ? primaryColor : '#d1d5db',
                                          backgroundColor: selectedOrderBumps.includes(bump.id) ? primaryColor : 'transparent'
                                        }}
                                      >
                                       {selectedOrderBumps.includes(bump.id) && (
                                         <svg 
                                           width="8" 
                                           height="6" 
                                           viewBox="0 0 12 9" 
                                           fill="none" 
                                           xmlns="http://www.w3.org/2000/svg"
                                           className="sm:w-3 sm:h-2.5"
                                         >
                                           <path 
                                             d="M1 4.5L4.5 8L11 1.5" 
                                             stroke="white" 
                                             strokeWidth="2" 
                                             strokeLinecap="round" 
                                             strokeLinejoin="round"
                                           />
                                         </svg>
                                       )}
                                     </div>
                                   </div>
                                 <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                   <span className="text-xs sm:text-sm" style={{ color: primaryColor }}>
                                     Sim, adicionar por apenas
                                   </span>
                                   <div className="flex items-center gap-2">
                                     <span className="font-bold text-sm sm:text-base" style={{ color: primaryColor }}>
                                       R${(bump.price).toFixed(2).replace('.', ',')}
                                     </span>
                                     {bump.originalPrice && bump.originalPrice > bump.price && (
                                       <span className="text-xs sm:text-sm text-gray-500 line-through">
                                         R${(bump.originalPrice).toFixed(2).replace('.', ',')}
                                       </span>
                                     )}
                                   </div>
                                 </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Seção 4: Método de Pagamento */}
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 border-b-2 pb-3 sm:pb-4 text-center">Forma de Pagamento</h2>
              
              {(() => {
                const hasOnlyPix = checkout.payment_methods?.pix && !checkout.payment_methods?.creditCard;
                const hasOnlyCreditCard = !checkout.payment_methods?.pix && checkout.payment_methods?.creditCard;
                const hasBoth = checkout.payment_methods?.pix && checkout.payment_methods?.creditCard;
                
                return (
                  <>
                    
                    <div className="space-y-3 sm:space-y-4 mt-4 sm:mt-8">
                      {checkout.payment_methods?.pix && (
                        <div
                          onClick={() => setSelectedPaymentMethod('pix')}
                          className={`p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            selectedPaymentMethod === 'pix' ? 'border-current shadow-lg' : 'border-gray-200'
                          }`}
                          style={{ borderColor: selectedPaymentMethod === 'pix' ? primaryColor : undefined }}
                        >
                          <div className="flex items-center gap-3">
                            {hasBoth && (
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                selectedPaymentMethod === 'pix' ? 'border-current' : 'border-gray-300'
                              }`} style={{ borderColor: selectedPaymentMethod === 'pix' ? primaryColor : undefined }}>
                                {selectedPaymentMethod === 'pix' && (
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }}></div>
                                )}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <QrCode className="h-5 w-5" />
                                <span className="font-semibold text-sm sm:text-base">PIX</span>
                              </div>
                              <p className="text-xs sm:text-sm text-gray-600">Aprovação instantânea</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {checkout.payment_methods?.creditCard && (
                        <div
                          onClick={() => setSelectedPaymentMethod('creditCard')}
                          className={`p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            selectedPaymentMethod === 'creditCard' ? 'border-current shadow-lg' : 'border-gray-200'
                          }`}
                          style={{ borderColor: selectedPaymentMethod === 'creditCard' ? primaryColor : undefined }}
                        >
                          <div className="flex items-center gap-3">
                            {hasBoth && (
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                selectedPaymentMethod === 'creditCard' ? 'border-current' : 'border-gray-300'
                              }`} style={{ borderColor: selectedPaymentMethod === 'creditCard' ? primaryColor : undefined }}>
                                {selectedPaymentMethod === 'creditCard' && (
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }}></div>
                                )}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                <span className="font-semibold text-sm sm:text-base">Cartão de Crédito</span>
                              </div>
                              <p className="text-xs sm:text-sm text-gray-600">Parcelamento em até 12x sem juros</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Seção 5: Dados do Cartão (se selecionado) */}
            {selectedPaymentMethod === 'creditCard' && (
              <div className="space-y-4 sm:space-y-8">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 border-b-2 pb-3 sm:pb-4 text-center">Dados do cartão</h2>
                
                <CreditCardForm
                  onCardDataChange={setCardData}
                  primaryColor={primaryColor}
                  textColor={textColor}
                  maxInstallments={checkout.payment_methods?.maxInstallments || 12}
                  installmentsWithInterest={checkout.payment_methods?.installmentsWithInterest || false}
                  totalAmount={calculateTotal()}
                  useMPFields={!!mpPublicKey}
                  mpPublicKey={mpPublicKey}
                />
              </div>
            )}

            {/* Seção 6: Resumo e Finalização */}
            <div className="bg-white rounded-lg border p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Resumo do Pedido</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div className="flex flex-col">
                    <span className="text-gray-700 font-medium">
                      {(() => {
                        const pkg = checkout.form_fields?.packages && checkout.form_fields.packages.length > 0
                          ? checkout.form_fields.packages.find(p => p.id === selectedPackage)
                          : null;
                        return pkg?.name || checkout.products?.name || 'Produto';
                      })()}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    {(() => {
                      const pkg = checkout.form_fields?.packages && checkout.form_fields.packages.length > 0
                        ? checkout.form_fields.packages.find(p => p.id === selectedPackage)
                        : null;

                      if (pkg) {
                        return (
                          <>
                            {pkg.originalPrice && pkg.originalPrice > pkg.price && (
                              <span className="text-sm line-through text-gray-400">
                                {formatCurrency(pkg.originalPrice)}
                              </span>
                            )}
                            <span className="font-semibold text-gray-800">
                              {formatCurrency(pkg.price)}
                            </span>
                          </>
                        );
                      }

                      // Fallback to checkout-level price
                      if (checkout.promotional_price && checkout.promotional_price < checkout.price) {
                        return (
                          <>
                            <span className="text-sm line-through text-gray-400">
                              {formatCurrency(checkout.price)}
                            </span>
                            <span className="font-semibold text-gray-800">
                              {formatCurrency(checkout.promotional_price)}
                            </span>
                          </>
                        );
                      }

                      return (
                        <span className="font-semibold text-gray-800">
                          {formatCurrency(checkout.price)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                
                {selectedOrderBumps.map(bumpId => {
                  const bump = checkout.order_bumps.find(b => b.id === bumpId);
                  if (!bump) return null;
                  return (
                    <div key={bumpId} className="flex justify-between">
                      <span className="text-gray-600">{bump.product?.name || 'Complemento'}</span>
                      <span className="text-gray-600">+ {formatCurrency(bump.price)}</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="border-t pt-4 mt-6">
                <div className="flex justify-between text-2xl font-bold mb-6">
                  <span className="text-gray-800">Total a pagar</span>
                  <span className="text-gray-800">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full py-4 text-white font-bold text-lg rounded-lg transition-all duration-300 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 group"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${gradientColor}dd)`,
                    boxShadow: `0 4px 15px ${primaryColor}33`
                  }}
                >
                  <span>{processing ? 'Processando...' : 'Finalizar Compra Agora'}</span>
                  {!processing && (
                    <svg 
                      className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  )}
                </button>
                
                <div className="text-center text-sm text-gray-600 mt-3 flex items-center justify-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  Pagamento via PIX processado pelo Mercado Pago. Aprovação imediata e ambiente 100% seguro.
                </div>
              </div>
            </div>

            {/* Seção de Segurança */}
            <SecuritySection 
              supportEmail={checkout.support_contact?.email} 
              primaryColor={checkout.styles?.primaryColor || '#3b82f6'}
            />
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default HorizontalLayout;