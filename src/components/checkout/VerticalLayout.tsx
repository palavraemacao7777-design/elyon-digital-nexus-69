import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Shield, CheckCircle, CreditCard, Star, Heart, ArrowRight, Clock, QrCode } from 'lucide-react';
import { CheckoutLayoutProps } from './CheckoutLayoutProps';
import { getOrderBumpPrefix } from '@/utils/orderBumpUtils';
import { processHeadlineText, formatCurrency } from '@/utils/textFormatting';
import PackageSelector from './PackageSelector';
import SecuritySection from './SecuritySection';
import { CreditCardForm } from './CreditCardForm';
 
import React, { useState } from 'react';


const VerticalLayout = ({
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
  handleSubmit
}: CheckoutLayoutProps) => {
  const handlePackageSelect = (packageId: number) => {
    setSelectedPackage?.(packageId);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
        {/* Seção 1: Cabeçalho e Introdução */}
        <div className="text-center mb-12">
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

          {/* Logotipo/Título */}
          {/* NEW: Display checkout logo if available, otherwise fallback to product logo */}
          {(checkout.styles?.logo_url || checkout.products.logo_url) && (
            <div className="mb-6">
              <img 
                src={checkout.styles?.logo_url || checkout.products.logo_url} 
                alt={checkout.products.name}
                className="h-40 mx-auto"
              />
            </div>
          )}
          
          {/* Título Principal */}
          {headlineText && (
            <h1 className="text-4xl md:text-5xl font-sans font-bold mb-4" style={{ color: headlineColor }}>
              {processHeadlineText(headlineText, checkout.styles?.highlightColor || primaryColor)}
            </h1>
          )}
          
          {/* Subtítulo */}
          {description && (
            <p className="text-lg text-muted-foreground font-sans max-w-2xl mx-auto">
              {description}
            </p>
          )}
        </div>

        {/* Seção 2: Campos de Dados */}
        <div className="bg-card rounded-lg border p-6 mb-8">
          <h2 className="text-xl font-bold font-sans text-foreground mb-6">Dados para Entrega</h2>
          
          <div className="space-y-4">
            {(checkout.form_fields as any)?.requireName !== false && (
              <div>
                <Label className="text-foreground font-sans">Nome Completo</Label>
                <Input
                  type="text"
                  placeholder="Digite seu nome completo"
                  value={customerData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="mt-1 bg-muted/30 border-border rounded-lg h-9"
                  required={(checkout.form_fields as any)?.requireName}
                />
              </div>
            )}
            
            {(checkout.form_fields as any)?.requireEmail !== false && (
              <div>
                <Label className="text-foreground font-sans">E-mail</Label>
                <Input
                  type="email"
                  placeholder="Digite seu melhor e-mail"
                  value={customerData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="mt-1 bg-muted/30 border-border rounded-lg h-9"
                  required={(checkout.form_fields as any)?.requireEmail}
                />
              </div>
            )}

            {(checkout.form_fields as any)?.requireEmailConfirm !== false && (
              <div>
                <Label className="text-foreground font-sans">Confirmar E-mail</Label>
                <Input
                  type="email"
                  placeholder="Confirme seu e-mail"
                  value={customerData.emailConfirm}
                  onChange={(e) => handleInputChange('emailConfirm', e.target.value)}
                  className="mt-1 bg-muted/30 border-border rounded-lg h-9"
                  required={(checkout.form_fields as any)?.requireEmailConfirm}
                />
              </div>
            )}
            
            {(checkout.form_fields as any)?.requirePhone !== false && (
              <div>
                <Label className="text-foreground font-sans">WhatsApp</Label>
                <Input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={customerData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="mt-1 bg-muted/30 border-border rounded-lg h-9"
                  required={(checkout.form_fields as any)?.requirePhone}
                />
              </div>
            )}

            {(checkout.form_fields as any)?.requireCpf !== false && (
              <div>
                <Label className="text-foreground font-sans">CPF</Label>
                <Input
                  type="text"
                  placeholder="000.000.000-00"
                  value={customerData.cpf}
                  onChange={(e) => handleInputChange('cpf', e.target.value)}
                  className="mt-1 bg-muted/30 border-border rounded-lg h-9"
                  required={(checkout.form_fields as any)?.requireCpf}
                />
              </div>
            )}
          </div>
        </div>

        {/* Seção 3: Opções de Seleção */}
        {(checkout.form_fields as any)?.packages && (checkout.form_fields as any).packages.length > 0 && (
          (() => {
            const offerMode = checkout.offerMode || (checkout as any).offer_mode || (checkout as any).offerMode || 'multiple';
            console.log('[VerticalLayout] offerMode:', offerMode, 'checkout.offerMode:', checkout.offerMode, 'offer_mode:', (checkout as any).offer_mode);
            return (
              <div className={`bg-card rounded-lg border p-6 mb-8 ${offerMode === 'single' ? 'p-0 border-0 bg-transparent' : ''}`}>
                {offerMode === 'single' && (
                  <h2 className="text-xl font-bold font-sans text-foreground mb-6">O que você vai receber</h2>
                )}
                {offerMode !== 'single' && (
                  <h2 className="text-xl font-bold font-sans text-foreground mb-6">Escolha seu Pacote</h2>
                )}
                <PackageSelector
                  packages={(checkout.form_fields as any).packages}
                  selectedPackage={selectedPackage}
                  onSelectPackage={handlePackageSelect}
                  primaryColor={primaryColor}
                  textColor={textColor}
                  offerMode={offerMode as 'single' | 'multiple'}
                />
              </div>
            );
          })()
        )}

        {/* Seção 4: Complementos Opcionais */}
        {checkout.order_bumps?.filter(bump => bump.enabled).length > 0 && (
          <div className="bg-card rounded-lg border p-6 mb-8">
            <h2 className="text-xl font-bold font-sans text-foreground mb-2">
              Complementos Especiais
            </h2>
            <p className="text-muted-foreground font-sans mb-6">
              Aproveite os descontos exclusivos e adicione estes complementos ao seu pedido.
            </p>
            
            <div className="space-y-4">
              {checkout.order_bumps?.filter(bump => bump.enabled).map(bump => {
                const product = bump.product;
                const productName = product?.name || 'Produto adicional';
                const productDescription = product?.description || 'Descrição do produto';
                const isSelected = selectedOrderBumps.includes(bump.id);
                
                return (
                  <div key={bump.id} className="border border-border rounded-lg p-4 bg-muted/20">
                    <h3 className="font-bold font-sans text-foreground mb-2">{productName}</h3>
                    <p className="text-muted-foreground font-sans text-sm mb-4">{productDescription}</p>
                    
                    <button 
                      onClick={() => handleOrderBumpToggle(bump.id)}
                      className={`w-full py-3 px-4 rounded-lg border font-sans text-left transition-colors flex items-center space-x-3 ${
                        isSelected 
                          ? 'bg-background text-foreground' 
                          : 'border-border bg-background text-foreground hover:border-pink-300 hover:bg-pink-50/50'
                      }`}
                      style={{
                        borderColor: isSelected ? primaryColor : undefined
                      }}
                    >
                       <div className="relative">
                         <div 
                           className="w-5 h-5 border-2 rounded-full flex items-center justify-center transition-all duration-200"
                           style={{ 
                             borderColor: isSelected ? primaryColor : '#d1d5db',
                             backgroundColor: isSelected ? primaryColor : 'transparent'
                           }}
                         >
                           {isSelected && (
                             <svg 
                               width="12" 
                               height="9" 
                               viewBox="0 0 12 9" 
                               fill="none" 
                               xmlns="http://www.w3.org/2000/svg"
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
                      <span>
                        Sim, adicionar por apenas{' '}
                        <span className="font-bold text-lg" style={{ color: primaryColor }}>
                          {formatCurrency(bump.price)}
                        </span>
                        {bump.originalPrice > 0 && (
                          <span className="text-muted-foreground line-through ml-2">
                            {formatCurrency(bump.originalPrice)}
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Seção 4: Escolha sua forma de pagamento */}
        <div className="bg-card rounded-lg border p-6 mb-8">
          <h2 className="text-xl font-bold font-sans text-foreground mb-6">Escolha sua forma de pagamento</h2>
          
          {(() => {
            const hasOnlyPix = checkout.payment_methods?.pix && !checkout.payment_methods?.creditCard;
            const hasOnlyCreditCard = !checkout.payment_methods?.pix && checkout.payment_methods?.creditCard;
            const hasBoth = checkout.payment_methods?.pix && checkout.payment_methods?.creditCard;
            
            return (
              <>
                
                <div className="space-y-4">
                  {checkout.payment_methods?.pix && (
                    <div
                      onClick={() => setSelectedPaymentMethod('pix')}
                      className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                        selectedPaymentMethod === 'pix'
                          ? 'border-pink-500 bg-pink-50'
                          : 'border-border hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {hasBoth && (
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedPaymentMethod === 'pix' ? 'border-pink-500' : 'border-border'
                          }`}>
                            {selectedPaymentMethod === 'pix' && (
                              <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                            )}
                          </div>
                        )}
                        <QrCode className="w-5 h-5" style={{ color: selectedPaymentMethod === 'pix' ? primaryColor : '#999' }} />
                        <h3 className="font-bold text-foreground">PIX</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
                    </div>
                  )}

                  {checkout.payment_methods?.creditCard && (
                    <div
                      onClick={() => setSelectedPaymentMethod('creditCard')}
                      className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                        selectedPaymentMethod === 'creditCard'
                          ? 'border-pink-500 bg-pink-50'
                          : 'border-border hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {hasBoth && (
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedPaymentMethod === 'creditCard' ? 'border-pink-500' : 'border-border'
                          }`}>
                            {selectedPaymentMethod === 'creditCard' && (
                              <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                            )}
                          </div>
                        )}
                        <CreditCard className="w-5 h-5" style={{ color: selectedPaymentMethod === 'creditCard' ? primaryColor : '#999' }} />
                        <h3 className="font-bold text-foreground">Cartão de Crédito</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">Parcelado</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Seção 5: Dados do Cartão (se selecionado) */}
        {selectedPaymentMethod === 'creditCard' && (
          <div className="bg-card rounded-lg border p-6 mb-8">
            <h2 className="text-xl font-bold font-sans text-foreground mb-6">Dados do cartão</h2>
            
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
                  {checkout.form_fields?.packages && checkout.form_fields.packages.length > 0 && selectedPackage
                    ? checkout.form_fields.packages.find(p => p.id === selectedPackage)?.name || checkout.products?.name || 'Produto'
                    : checkout.products?.name || 'Produto'
                  }
                </span>
              </div>
              <div className="flex flex-col items-end">
                {checkout.promotional_price && checkout.promotional_price < checkout.price ? (
                  <>
                    <span className="text-sm line-through text-gray-400">
                      {formatCurrency(checkout.price)}
                    </span>
                    <span className="font-semibold text-gray-800">
                      {formatCurrency(checkout.promotional_price)}
                    </span>
                  </>
                ) : (
                  <span className="font-semibold text-gray-800">
                    {formatCurrency(checkout.price)}
                  </span>
                )}
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
      </div>
    </div>
  );
};

export default VerticalLayout;