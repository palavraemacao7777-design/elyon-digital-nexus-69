 
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

import { useAutoSave } from '@/hooks/useAutoSave';
import { useIntegrations } from '@/hooks/useIntegrations';

import { Navigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, CreditCard, Package, Shield, FileText, DollarSign, Trash2, Edit, Smartphone, MoreVertical, Save, Link, ShoppingBag, Upload, XCircle, Mail, AlertTriangle, MonitorDot, Check as CheckIcon, ChevronsUpDown, Eye, Image as ImageIcon, Facebook, BarChart3, Copy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { DeliverableConfig, FormFields, PackageConfig, GuaranteeConfig, ReservedRightsConfig, Tables, CheckoutIntegrationsConfig, Json, TablesInsert, TablesUpdate, CheckoutStyles } from '@/integrations/supabase/types'; // Import CheckoutStyles
import { Alert, AlertDescription } from '@/components/ui/alert';
import { setNestedValue, deepMerge, safeJsonCast } from '@/lib/utils'; // Import safeJsonCast
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { OrderBump } from '@/components/checkout/CheckoutLayoutProps'; // Import OrderBump

type MemberArea = Tables<'member_areas'>;
type Product = Tables<'products'>;
type Checkout = Tables<'checkouts'> & {
  products?: Pick<Tables<'products'>, 'id' | 'name' | 'description' | 'banner_url' | 'logo_url' | 'member_area_link' | 'file_url'> | null;
  member_areas?: Pick<Tables<'member_areas'>, 'name' | 'slug'> | null;
  activeIntegrations?: string[];
};

const AdminCheckouts = () => {
  const {
    user,
    loading: authLoading // Removido isAdmin
  } = useAuth();
  const {
    mercadoPagoAccounts,
    metaPixels,
    emailConfig,
    utmifyConfig,
    isConfigured: { email: isEmailIntegrationConfigured }
  } = useIntegrations();
  const {
    toast
  } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSavingDialog, setIsSavingDialog] = useState(false); // Renamed from isLoading for clarity
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [memberAreas, setMemberAreas] = useState<MemberArea[]>([]);
  const [currentTab, setCurrentTab] = useState('basic');
  const [loadingCheckouts, setLoadingCheckouts] = useState(true); // New state for page-level loading
  const [editingCheckout, setEditingCheckout] = useState<Checkout | null>(null); // State for the checkout being edited
  
  const [checkoutDeliverableFile, setCheckoutDeliverableFile] = useState<File | null>(null);
  const [checkoutLogoFile, setCheckoutLogoFile] = useState<File | null>(null);
  const [checkoutBannerFile, setCheckoutBannerFile] = useState<File | null>(null);

  const getInitialFormData = useCallback(() => {
      const initial: any = {
      name: '',
      layout: 'horizontal' as string,
      offerMode: 'single' as 'single' | 'multiple',
      form_fields: {
        requireName: true,
        requireCpf: true,
        requirePhone: true,
        requireEmail: true,
        requireEmailConfirm: true,
        packages: [{
          id: 1,
          name: 'Pacote Básico',
          description: 'Acesso essencial ao produto.',
          topics: ['Acesso vitalício: ao conteúdo principal'],
          price: 97.00,
          originalPrice: 0,
          mostSold: false,
          associatedProductIds: [],
        }] as PackageConfig[],
        guarantee: {
          enabled: true,
          days: 7,
          description: 'Garantia de 7 Dias. Se não gostar, devolvemos seu dinheiro sem burocracia.'
        } as GuaranteeConfig,
        reservedRights: {
          enabled: true,
          text: 'Todos os direitos reservados. Este produto é protegido por direitos autorais.'
        } as ReservedRightsConfig,
        deliverable: {
          type: 'none' as 'none' | 'link' | 'upload',
          link: null,
          fileUrl: null,
          name: null,
          description: null,
        } as DeliverableConfig,
        sendTransactionalEmail: true,
        transactionalEmailSubject: 'Seu acesso ao produto Elyon Digital!',
        transactionalEmailBody: 'Olá {customer_name},\n\nObrigado por sua compra! Seu acesso ao produto "{product_name}" está liberado.\n\nAcesse aqui: {access_link}\n\nQualquer dúvida, entre em contato com nosso suporte.\n\nAtenciosamente,\nEquipe Elyon Digital'
      } as FormFields,
      payment_methods: {
        pix: true,
        creditCard: true,
        maxInstallments: 12,
        installmentsWithInterest: false
      },
      order_bumps: [{
        id: 1,
        selectedProduct: '',
        price: 0,
        originalPrice: 0,
        enabled: false
      }],
      styles: {
        backgroundColor: '#ffffff',
        primaryColor: '#3b82f6',
        textColor: '#000000',
        headlineText: 'Sua transformação começa agora!',
        headlineColor: '#000000',
        description: 'Desbloqueie seu potencial com nosso produto exclusivo.',
        gradientColor: '#60a5fa',
        highlightColor: '#3b82f6',
        logo_url: null,
        banner_url: null,
      },
      integrations: {
        selectedMercadoPagoAccount: '',
        selectedMetaPixel: '',
        selectedEmailAccount: '',
      },
      support_contact: {
        email: ''
      },
      timer: {
        enabled: false,
        duration: 15,
        color: '#dc2626',
        text: 'Oferta por tempo limitado'
      },
      // member_area_id foi removido: associação agora é feita nas configurações da Área de Membros
      products: {
        id: '',
        name: '',
        description: '',
        banner_url: null,
        logo_url: null,
        member_area_link: null,
        file_url: null,
      },
    };
    return JSON.parse(JSON.stringify(initial));
  }, []);
  
  const [autoSaveKey, setAutoSaveKey] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    return editId ? `checkout-edit-${editId}` : 'checkout-new';
  });
  
  const {
    data: checkoutData,
    setData: setCheckoutData,
    clearSavedData,
    loadData,
    hasSavedData,
    forceLoad
  } = useAutoSave(getInitialFormData, {
    key: autoSaveKey,
    debounceMs: 800,
    showToast: false
  });
  
  const loadOriginalCheckoutData = useCallback((checkout: Checkout) => {
    const initial = getInitialFormData();
    
    console.log('ADMIN_CHECKOUTS_DEBUG: loadOriginalCheckoutData called');
    console.log('ADMIN_CHECKOUTS_DEBUG: checkout.payment_methods from DB:', JSON.stringify(checkout.payment_methods, null, 2));

    const priceInReais = checkout.price ? checkout.price / 100 : 0;
    const promotionalPriceInReais = checkout.promotional_price ? checkout.promotional_price / 100 : 0;
    
    const orderBumpsInReais = Array.isArray(checkout.order_bumps) ? (checkout.order_bumps as unknown as OrderBump[]).map((bump: any) => ({
      ...bump,
      price: bump.price !== undefined && bump.price !== null ? bump.price / 100 : 0,
      originalPrice: bump.originalPrice !== undefined && bump.originalPrice !== null ? bump.originalPrice / 100 : 0,
      selectedProduct: bump.selectedProduct || ''
    })) : initial.order_bumps;
    
    const offerMode = (checkout as any).offer_mode || 'single';
    
    const packagesFromDb = (checkout.form_fields as FormFields)?.packages;
    const packagesConfig: PackageConfig[] = Array.isArray(packagesFromDb) ? packagesFromDb.map((pkg: any) => ({
      id: pkg.id || Date.now(),
      name: pkg.name || '',
      description: pkg.description || '',
      topics: Array.isArray(pkg.topics) ? pkg.topics.filter((t: any) => typeof t === 'string') : [''],
      price: pkg.price !== undefined && pkg.price !== null ? pkg.price / 100 : 0,
      originalPrice: pkg.originalPrice !== undefined && pkg.originalPrice !== null ? pkg.originalPrice / 100 : 0,
      mostSold: pkg.mostSold ?? false,
      associatedProductIds: Array.isArray(pkg.associatedProductIds) ? pkg.associatedProductIds : (pkg.associatedProductId ? [pkg.associatedProductId] : []),
    })) : initial.form_fields.packages;

    if (((checkout.form_fields as FormFields)?.deliverable as DeliverableConfig)?.fileUrl && ((checkout.form_fields as FormFields)?.deliverable as DeliverableConfig)?.type === 'upload') {
      setCheckoutDeliverableFile(null);
    }
    setCheckoutLogoFile(null);
    setCheckoutBannerFile(null);

    const mainProductId = packagesConfig[0]?.associatedProductIds?.[0] || checkout.product_id;
    const mainProductDetails = products.find(p => p.id === mainProductId) || null;

    const stylesFromCheckout = safeJsonCast<CheckoutStyles>(checkout.styles);

    const mergedData = deepMerge(initial, {
      id: checkout.id, // Ensure ID is passed for editing
      name: checkout.name || checkout.products?.name || '',
      layout: checkout.layout || 'horizontal',
      offerMode: offerMode,
      form_fields: {
        requireName: (checkout.form_fields as FormFields)?.requireName ?? true,
        requireCpf: (checkout.form_fields as FormFields)?.requireCpf ?? true,
        requirePhone: (checkout.form_fields as FormFields)?.requirePhone ?? true,
        requireEmail: (checkout.form_fields as FormFields)?.requireEmail ?? true,
        requireEmailConfirm: (checkout.form_fields as FormFields)?.requireEmailConfirm ?? true,
        packages: packagesConfig,
        guarantee: ((checkout.form_fields as FormFields)?.guarantee as GuaranteeConfig) || initial.form_fields.guarantee,
        reservedRights: ((checkout.form_fields as FormFields)?.reservedRights as ReservedRightsConfig) || initial.form_fields.reservedRights,
        deliverable: {
          type: ((checkout.form_fields as FormFields)?.deliverable as DeliverableConfig)?.type || 'none',
          link: ((checkout.form_fields as FormFields)?.deliverable as DeliverableConfig)?.link || null,
          fileUrl: ((checkout.form_fields as FormFields)?.deliverable as DeliverableConfig)?.fileUrl || null,
          name: ((checkout.form_fields as FormFields)?.deliverable as DeliverableConfig)?.name || null,
          description: ((checkout.form_fields as FormFields)?.deliverable as DeliverableConfig)?.description || null
        },
        sendTransactionalEmail: (checkout.form_fields as FormFields)?.sendTransactionalEmail ?? true,
        transactionalEmailSubject: (checkout.form_fields as FormFields)?.transactionalEmailSubject || initial.form_fields.transactionalEmailSubject,
        transactionalEmailBody: (checkout.form_fields as FormFields)?.transactionalEmailBody || initial.form_fields.transactionalEmailBody,
      },
      payment_methods: checkout.payment_methods as Tables<'checkouts'>['payment_methods'] || initial.payment_methods,
      order_bumps: orderBumpsInReais,
      integrations: {
        ...initial.integrations,
        ...(checkout.integrations as CheckoutIntegrationsConfig || {}),
        selectedEmailAccount: (checkout.integrations as CheckoutIntegrationsConfig)?.selectedEmailAccount || '',
      },
      support_contact: checkout.support_contact as Tables<'checkouts'>['support_contact'] || initial.support_contact,
      styles: {
        ...(stylesFromCheckout || {}), // Ensure it's an object
        description: stylesFromCheckout?.description || checkout.products?.description || initial.styles.description,
        headlineText: stylesFromCheckout?.headlineText || checkout.products?.name || initial.styles.headlineText,
        logo_url: stylesFromCheckout?.logo_url || null,
        banner_url: stylesFromCheckout?.banner_url || null,
      },
      timer: checkout.timer as Tables<'checkouts'>['timer'] || initial.timer,
      // member_area_id removido: associações de produto → área de membros são gerenciadas em Member Areas
      products: mainProductDetails ? {
        id: mainProductDetails.id,
        name: mainProductDetails.name,
        description: mainProductDetails.description,
        banner_url: mainProductDetails.banner_url,
        logo_url: mainProductDetails.logo_url,
        member_area_link: mainProductDetails.member_area_link,
        file_url: mainProductDetails.file_url,
      } : { // Default product object with all required fields
        id: 'default-product', // A dummy ID
        name: 'Produto Principal', // Default name
        description: 'Este é o produto principal do seu checkout.', // Default description
        banner_url: null,
        logo_url: null,
        member_area_link: null,
        file_url: null,
        access_url: null, // Required by Tables<'products'>
        created_at: new Date().toISOString(), // Required
        updated_at: new Date().toISOString(), // Required
        email_template: null, // Required
        is_active: true, // Required
        price: 0, // Required
        price_original: null, // Required
        project_id: null, // Required
        user_id: null, // Required
        // member_area_id: null, // removed: product -> member area association is handled in member areas
      },
    });

    console.log('ADMIN_CHECKOUTS_DEBUG: After deepMerge, payment_methods:', JSON.stringify(mergedData.payment_methods, null, 2));
    return mergedData;
  }, [getInitialFormData, products]);


  // Removed the redundant beforeunload useEffect as useAutoSave already handles it.

  useEffect(() => {
    console.log(`[AdminCheckouts] useEffect for autoSaveKey. editingCheckout:`, editingCheckout);
    const newKey = editingCheckout ? `checkout-edit-${editingCheckout.id}` : 'checkout-new';
    
    if (autoSaveKey !== newKey) {
      console.log(`[AdminCheckouts] Changing autoSaveKey from ${autoSaveKey} to ${newKey}`);
      setAutoSaveKey(newKey);
      // Force reload data when changing checkout
      if (editingCheckout) {
        const originalData = loadOriginalCheckoutData(editingCheckout);
        loadData(originalData);
      } else {
        loadData(getInitialFormData());
      }
    } else {
      // Only load data if the key is stable and we haven't loaded yet for this key
      if (!hasSavedData || (editingCheckout && !checkoutData.id)) { // Check if checkoutData.id is set for editing mode
        console.log(`[AdminCheckouts] Loading data for key: ${newKey}. Has saved data: ${hasSavedData}`);
        if (editingCheckout) {
          const originalData = loadOriginalCheckoutData(editingCheckout);
          loadData(originalData);
        } else {
          loadData(getInitialFormData());
        }
      } else {
        console.log(`[AdminCheckouts] Data already loaded or draft exists for key: ${newKey}.`);
      }
    }
  }, [editingCheckout, autoSaveKey, loadData, forceLoad, getInitialFormData, loadOriginalCheckoutData, hasSavedData, checkoutData.id]);


  // Removed the redundant beforeunload useEffect as useAutoSave already handles it.

  useEffect(() => {
    console.log('ADMIN_CHECKOUTS_DEBUG: useEffect triggered. user:', user?.id, 'authLoading:', authLoading); // Removido isAdmin do log
    if (!authLoading) { // Wait for auth to settle
      if (user) { // Qualquer usuário logado pode acessar
        const loadAllData = async () => {
          setLoadingCheckouts(true);
          await Promise.all([
            fetchCheckouts(),
            fetchProducts(),
            fetchMemberAreas()
          ]);
          setLoadingCheckouts(false);
          console.log('ADMIN_CHECKOUTS_DEBUG: All initial data loaded, setLoadingCheckouts(false).');
        };
        loadAllData();
      } else if (!user) {
        console.log('ADMIN_CHECKOUTS_DEBUG: Not authenticated, redirecting.');
      }
    }
  }, [user, authLoading]); // Removido isAdmin das dependências

  const fetchCheckouts = async () => {
    console.log('ADMIN_CHECKOUTS_DEBUG: fetchCheckouts started.');
    try {
      const {
        data,
        error
      } = await supabase.from('checkouts').select(`
          *,
          products (id, name),
          member_areas (name, slug)
        `).order('created_at', {
        ascending: false
      });
      if (error) throw error;

      const processedCheckouts = data?.map(chk => {
        const activeIntegrations: string[] = [];
        const integrationsConfig = chk.integrations as CheckoutIntegrationsConfig | null;

        if (integrationsConfig?.selectedMercadoPagoAccount) activeIntegrations.push('Mercado Pago');
        if (integrationsConfig?.selectedMetaPixel) activeIntegrations.push('Meta Pixel');
        if (integrationsConfig?.selectedEmailAccount) activeIntegrations.push('Email SMTP');
        if (utmifyConfig?.apiKey) activeIntegrations.push('UTMify');
        // Associação de member area foi removida do checkout; a presença de Área de Membros
        // será detectada a partir das configurações do produto/member_areas quando necessário.

        return {
          ...chk,
          activeIntegrations: activeIntegrations,
        };
      }) || [];

      setCheckouts(processedCheckouts as Checkout[]);
      console.log('ADMIN_CHECKOUTS_DEBUG: fetchCheckouts completed successfully.');
    } catch (error: any) {
      console.error('ADMIN_CHECKOUTS_DEBUG: Erro ao carregar checkouts:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível carregar os checkouts",
        variant: "destructive"
      });
    }
  };
  const fetchProducts = async () => {
    console.log('ADMIN_CHECKOUTS_DEBUG: fetchProducts started.');
    try {
      const {
        data,
        error
      } = await supabase.from('products').select('id, name, price, description, banner_url, logo_url, access_url, file_url, member_area_link').order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setProducts(data as Product[] || []);
      console.log('ADMIN_CHECKOUTS_DEBUG: fetchProducts completed successfully.');
    } catch (error: any) {
      console.error('ADMIN_CHECKOUTS_DEBUG: Erro ao carregar produtos:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível carregar os produtos",
        variant: "destructive"
      });
    }
  };

  const fetchMemberAreas = async () => {
    console.log('ADMIN_CHECKOUTS_DEBUG: fetchMemberAreas started.');
    if (!user?.id) {
      console.log('ADMIN_CHECKOUTS_DEBUG: fetchMemberAreas skipped, no user ID.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('member_areas')
        .select('id, name, slug')
        .eq('user_id', user.id);
      if (error) throw error;
      setMemberAreas(data as MemberArea[] || []);
      console.log('ADMIN_CHECKOUTS_DEBUG: fetchMemberAreas completed successfully.');
    } catch (error: any) {
      console.error('ADMIN_CHECKOUTS_DEBUG: Erro ao carregar áreas de membros:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível carregar as áreas de membros",
        variant: "destructive"
      });
    }
  };

  const uploadFile = async (file: File, folder: string) => {
    console.log(`[AdminCheckouts] Attempting to upload file: ${file.name} para a pasta: ${folder}`);
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(filePath, file);

    if (uploadError) {
      console.error(`[AdminCheckouts] Erro ao fazer upload do arquivo ${file.name}:`, uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('products')
      .getPublicUrl(filePath);

    console.log(`[AdminCheckouts] Arquivo enviado com sucesso: ${data.publicUrl}`);
    return data.publicUrl;
  };

  const resetToOriginal = () => {
    if (editingCheckout) {
      const originalData = loadOriginalCheckoutData(editingCheckout);
      loadData(originalData);
      clearSavedData();
      setCheckoutDeliverableFile(null);
      setCheckoutLogoFile(null);
      setCheckoutBannerFile(null);
      
      toast({
        title: "Dados recarregados",
        description: "Dados originais do checkout foram recarregados"
      });
    } else {
      loadData(getInitialFormData());
      clearSavedData();
      setCheckoutDeliverableFile(null);
      setCheckoutLogoFile(null);
      setCheckoutBannerFile(null);
      toast({
        title: "Formulário limpo",
        description: "Formulário resetado para valores padrão"
      });
    }
  };
  const handleEdit = (checkout: Checkout) => {
    setEditingCheckout(checkout);
    
    setCheckoutDeliverableFile(null);
    setCheckoutLogoFile(null);
    setCheckoutBannerFile(null);

    setIsDialogOpen(true);
  };
  const handleDelete = async (checkoutId: string) => {
    try {
      setIsSavingDialog(true); // Use isSavingDialog
      const {
        error
      } = await supabase.from('checkouts').delete().eq('id', checkoutId);
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Checkout excluído com sucesso!"
      });
      fetchCheckouts();
    } catch (error: any) {
      console.error('Erro ao excluir checkout:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir o checkout",
        variant: "destructive"
      });
    } finally {
      setIsSavingDialog(false); // Use isSavingDialog
    }
  };

  const handleDuplicate = async (checkoutId: string) => {
    try {
      setIsSavingDialog(true);
      
      // Fetch the checkout to duplicate
      const { data, error: fetchError } = await supabase
        .from('checkouts')
        .select('*')
        .eq('id', checkoutId)
        .single();

      if (fetchError) throw fetchError;

      // Get all checkouts to find the highest number for this checkout
      const { data: allCheckouts, error: listError } = await supabase
        .from('checkouts')
        .select('name')
        .ilike('name', `${data.name}%`);

      if (listError) throw listError;

      // Find the highest number in existing copies
      let maxNumber = 0;
      const baseNamePattern = new RegExp(`^${data.name}\\s*\\((\\d+)\\)$`);
      
      allCheckouts?.forEach(checkout => {
        const match = checkout.name.match(baseNamePattern);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) maxNumber = num;
        }
      });

      // Create new name with incremented number
      const newNumber = maxNumber + 1;
      const newName = `${data.name} (${newNumber})`;

      // Create a new checkout with duplicated data
      const newCheckout = {
        ...data,
        id: uuidv4(), // Generate new UUID
        name: newName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('checkouts')
        .insert([newCheckout])
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: "Sucesso",
        description: "Checkout duplicado com sucesso!"
      });

      fetchCheckouts();
    } catch (error: any) {
      console.error('Erro ao duplicar checkout:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível duplicar o checkout",
        variant: "destructive"
      });
    } finally {
      setIsSavingDialog(false);
    }
  };

  if (authLoading) { // Only show loading if auth is still in progress
    return <div className="flex items-center justify-center min-h-screen">Carregando autenticação...</div>;
  }
  if (!user) {
    console.log('ADMIN_CHECKOUTS_DEBUG: Redirecting to login because no user.');
    return <Navigate to="/auth/login" replace />;
  }
  // REMOVIDO: if (!isAdmin) { ... }
  if (loadingCheckouts) { // Show loading for checkouts only after auth is done
    return <div className="flex items-center justify-center min-h-screen">Carregando checkouts...</div>;
  }
  const handleInputChange = (path: string, value: any) => {
    console.log(`[AdminCheckouts] handleInputChange: path=${path}, value=`, value);
    if (path.startsWith('payment_methods')) {
      console.log(`[AdminCheckouts] PAYMENT_METHODS_CHANGE: path=${path}, value=`, value);
      console.log(`[AdminCheckouts] PAYMENT_METHODS_CHANGE: Current checkoutData.payment_methods BEFORE change:`, JSON.stringify(checkoutData.payment_methods, null, 2));
    }
    setCheckoutData(prev => {
      const newState = setNestedValue(prev, path, value);
      console.log(`[AdminCheckouts] handleInputChange: Previous state reference:`, prev);
      console.log(`[AdminCheckouts] handleInputChange: New state reference:`, newState);
      if (path.startsWith('payment_methods')) {
        console.log(`[AdminCheckouts] PAYMENT_METHODS_CHANGE: New checkoutData.payment_methods AFTER change:`, JSON.stringify(newState.payment_methods, null, 2));
      }
      return newState;
    });
  };

  const handleCheckoutDeliverableFileChange = (file: File | null) => {
    setCheckoutDeliverableFile(file);
    if (file) {
      handleInputChange('form_fields.deliverable.link', null);
      handleInputChange('form_fields.deliverable.fileUrl', null);
    }
  };

  const handleCheckoutLogoFileChange = (file: File | null) => {
    setCheckoutLogoFile(file);
    if (file) {
      handleInputChange('styles.logo_url', null);
    }
  };

  const handleCheckoutBannerFileChange = (file: File | null) => {
    setCheckoutBannerFile(file);
    if (file) {
      handleInputChange('styles.banner_url', null);
    }
  };

  const addPackage = () => {
    const newPackages = [...checkoutData.form_fields.packages, {
      id: Date.now(),
      name: 'Novo Pacote',
      description: 'Acesso essencial ao produto.',
      topics: [''],
      price: 0,
      originalPrice: 0,
      mostSold: false,
      associatedProductIds: [],
    }] as PackageConfig[];
    handleInputChange('form_fields.packages', newPackages);
  };
  const removePackage = (id: number) => {
    const newPackages = checkoutData.form_fields.packages.filter(pkg => pkg.id !== id);
    if (newPackages.length === 0) {
      toast({ title: "Erro", description: "Deve haver pelo menos um pacote.", variant: "destructive" });
      return;
    }
    handleInputChange('form_fields.packages', newPackages);
  };
  const updatePackage = (id: number, field: string, value: any) => {
    const packages = checkoutData.form_fields.packages.map((pkg: PackageConfig) => pkg.id === id ? {
      ...pkg,
      [field]: value
    } : pkg);
    handleInputChange('form_fields.packages', packages);
  };

  const toggleProductAssociation = (packageId: number, productId: string, isChecked: boolean) => {
    const packageIndex = checkoutData.form_fields.packages.findIndex((p: PackageConfig) => p.id === packageId);
    if (packageIndex === -1) return;

    const currentAssociatedIds = checkoutData.form_fields.packages[packageIndex].associatedProductIds || [];
    let updatedIds: string[];

    if (isChecked) {
      updatedIds = [...currentAssociatedIds, productId];
    } else {
      updatedIds = currentAssociatedIds.filter((id: string) => id !== productId);
    }
    handleInputChange(`form_fields.packages[${packageIndex}].associatedProductIds`, updatedIds);
  };

  const addTopicToPackage = (packageId: number) => { // Adicionado packageId como parâmetro
    const packages = checkoutData.form_fields.packages.map((pkg: PackageConfig) => pkg.id === packageId ? { // Usar packageId
      ...pkg,
      topics: [...pkg.topics, '']
    } : pkg);
    handleInputChange('form_fields.packages', packages);
  };
  const removeTopicFromPackage = (packageId: number, topicIndex: number) => {
    const packages = checkoutData.form_fields.packages.map((pkg: PackageConfig) => pkg.id === packageId ? {
      ...pkg,
      topics: pkg.topics.filter((_, index) => index !== topicIndex)
    } : pkg);
    handleInputChange('form_fields.packages', packages);
  };
  const updatePackageTopic = (packageId: number, topicIndex: number, value: string) => {
    const packages = checkoutData.form_fields.packages.map((pkg: PackageConfig) => pkg.id === packageId ? {
      ...pkg,
      topics: pkg.topics.map((topic, index) => index === topicIndex ? value : topic)
    } : pkg);
    handleInputChange('form_fields.packages', packages);
  };
  const addOrderBump = () => {
    const newOrderBumps = [...checkoutData.order_bumps, {
      id: Date.now(),
      selectedProduct: '',
      price: 0,
      originalPrice: 0,
      enabled: false
    }];
    handleInputChange('order_bumps', newOrderBumps);
  };
  const removeOrderBump = (id: number) => {
    const newOrderBumps = checkoutData.order_bumps.filter(bump => bump.id !== id);
    handleInputChange('order_bumps', newOrderBumps);
  };
  const updateOrderBump = (id: number, field: string, value: any) => {
    const orderBumps = checkoutData.order_bumps.map(bump => bump.id === id ? {
      ...bump,
      [field]: value
    } : bump);
    handleInputChange('order_bumps', orderBumps);
  };
  const loadProductAsOrderBump = (bumpId: number, productData: string) => {
    if (productData === 'manual') {
      const orderBumps = checkoutData.order_bumps.map(bump => bump.id === bumpId ? {
        ...bump,
        price: 0,
        originalPrice: 0,
        selectedProduct: ''
      } : bump);
      handleInputChange('order_bumps', orderBumps);
      return;
    }

    const product = products.find(p => p.id === productData);
    if (product) {
      const priceInReais = product.price / 100;
      const discountedPriceInReais = priceInReais * 0.5;
      
      console.log('Order Bump Product Loading:', {
        productName: product.name,
        priceInCents: product.price,
        priceInReais: priceInReais,
        discountedPrice: discountedPriceInReais
      });
      
      const orderBumps = checkoutData.order_bumps.map(bump => bump.id === bumpId ? {
        ...bump,
        price: discountedPriceInReais,
        originalPrice: priceInReais,
        selectedProduct: product.id
      } : bump);
      handleInputChange('order_bumps', orderBumps);
    }
  };

  const handlePreview = () => {
    const previewData = JSON.parse(JSON.stringify(checkoutData));
    
    // Ensure offerMode is preserved for preview
    previewData.offerMode = checkoutData.offerMode;

    // Ensure packages array exists and has at least one package for logic below
    if (!previewData.form_fields.packages || previewData.form_fields.packages.length === 0) {
      previewData.form_fields.packages = [{
        id: 1,
        name: 'Pacote Padrão',
        description: 'Acesso essencial ao produto.',
        topics: [],
        price: 0,
        originalPrice: 0,
        mostSold: false,
        associatedProductIds: [],
      }];
    }

    // Process order bumps to include product details for preview
    previewData.order_bumps = previewData.order_bumps.map((bump: any) => {
      if (bump.selectedProduct) {
        const productDetails = products.find(p => p.id === bump.selectedProduct);
        return { ...bump, product: productDetails || null };
      }
      return { ...bump, product: null };
    });

    // Determine the main product for the checkout preview
    const firstPackage = previewData.form_fields.packages[0];
    const mainProductIdForPreview = firstPackage?.associatedProductIds?.[0] || null;
    let mainProductDetailsForPreview: Product | null = products.find(p => p.id === mainProductIdForPreview) || null;

    // Fallback for main product details if none is explicitly associated
    if (!mainProductDetailsForPreview) {
      mainProductDetailsForPreview = {
        id: 'default-product', // A dummy ID
        name: 'Produto Principal', // Default name
        description: 'Este é o produto principal do seu checkout.', // Default description
        banner_url: null,
        logo_url: null,
        member_area_link: null,
        file_url: null,
        access_url: null, // Required by Tables<'products'>
        created_at: new Date().toISOString(), // Required
        updated_at: new Date().toISOString(), // Required
        email_template: null, // Required
        is_active: true, // Required
        price: 0, // Required
        price_original: null, // Required
        project_id: null, // Required
        user_id: null, // Required
        member_area_id: null, // Required by Tables<'products'>
      };
    }

    previewData.products = {
      id: mainProductDetailsForPreview.id,
      name: mainProductDetailsForPreview.name,
      description: mainProductDetailsForPreview.description,
      banner_url: mainProductDetailsForPreview.banner_url,
      logo_url: mainProductDetailsForPreview.logo_url,
      member_area_link: mainProductDetailsForPreview.member_area_link,
      file_url: mainProductDetailsForPreview.file_url,
    };

    // Handle file uploads for preview (using Blob URLs for new files, existing URLs for saved)
    const editingCheckoutFormFields = safeJsonCast<FormFields>(editingCheckout?.form_fields);
    const editingCheckoutStyles = safeJsonCast<CheckoutStyles>(editingCheckout?.styles);

    if (previewData.form_fields.deliverable?.type === 'upload' && checkoutDeliverableFile) {
      previewData.form_fields.deliverable = {
        ...previewData.form_fields.deliverable,
        name: checkoutDeliverableFile.name,
        description: `Arquivo: ${checkoutDeliverableFile.name} (apenas nome para preview)`,
        fileUrl: URL.createObjectURL(checkoutDeliverableFile) // Use Blob URL for preview
      };
    } else if (previewData.form_fields.deliverable?.type === 'upload' && (editingCheckoutFormFields?.deliverable as DeliverableConfig | null)?.fileUrl) {
      // If it's an existing upload and no new file, use the existing public URL
      previewData.form_fields.deliverable.fileUrl = (editingCheckoutFormFields.deliverable as DeliverableConfig).fileUrl;
    }

    if (checkoutLogoFile) {
      previewData.styles = {
        ...previewData.styles,
        logo_url: URL.createObjectURL(checkoutLogoFile)
      };
    } else if (editingCheckoutStyles?.logo_url) {
      previewData.styles.logo_url = editingCheckoutStyles.logo_url;
    }

    if (checkoutBannerFile) {
      previewData.styles = {
        ...previewData.styles,
        banner_url: URL.createObjectURL(checkoutBannerFile)
      };
    } else if (editingCheckoutStyles?.banner_url) {
      previewData.styles.banner_url = editingCheckoutStyles.banner_url;
    }

    console.log('ADMIN_CHECKOUTS_DEBUG: Preview data before saving to localStorage:', JSON.stringify(previewData, null, 2));
    localStorage.setItem('checkout-preview-draft', JSON.stringify(previewData));
    console.log('ADMIN_CHECKOUTS_DEBUG: Data saved to localStorage. Checking immediately:', localStorage.getItem('checkout-preview-draft') ? 'SUCCESS' : 'FAILED');
    window.open('/checkout/preview', '_blank');
  };

  const handleIndividualPreview = async (checkoutId: string) => {
    try {
      const { data, error } = await supabase
        .from('checkouts')
        .select(`
          *,
          products (id, name, description, banner_url, logo_url, member_area_link, file_url)
        `)
        .eq('id', checkoutId)
        .single();

      if (error) throw error;

      let orderBumpsWithProducts = [];
      if (data.order_bumps && Array.isArray(data.order_bumps)) {
        const orderBumps = data.order_bumps as unknown as OrderBump[];
        const productIds = orderBumps
          .filter(bump => bump.enabled && bump.selectedProduct)
          .map(bump => bump.selectedProduct);
        
        if (productIds.length > 0) {
          const { data: productsData } = await supabase
            .from('products')
            .select('id, name, description, banner_url, logo_url');
          
          orderBumpsWithProducts = orderBumps.map(bump => ({
            ...bump,
            price: bump.price !== undefined && bump.price !== null ? bump.price / 100 : 0,
            originalPrice: bump.originalPrice !== undefined && bump.originalPrice !== null ? bump.originalPrice / 100 : 0,
            product: productsData?.find(p => p.id === bump.selectedProduct) || null
          }));
        } else {
          orderBumpsWithProducts = orderBumps.map(bump => ({
            ...bump,
            price: bump.price !== undefined && bump.price !== null ? bump.price / 100 : 0,
            originalPrice: bump.originalPrice !== undefined && bump.originalPrice !== null ? bump.originalPrice / 100 : 0,
          }));
        }
      }

      const formFieldsData = (data.form_fields || {}) as FormFields;
      const packagesConfig: PackageConfig[] = Array.isArray(formFieldsData.packages) 
        ? await Promise.all(formFieldsData.packages.map(async pkg => {
            return {
              ...pkg,
              price: pkg.price !== undefined && pkg.price !== null ? pkg.price / 100 : 0,
              originalPrice: pkg.originalPrice !== undefined && pkg.originalPrice !== null ? pkg.originalPrice / 100 : 0,
            };
          }))
        : [];

      const mainProductId = packagesConfig[0]?.associatedProductIds?.[0] || data.product_id;
      const mainProductDetails = products.find(p => p.id === mainProductId) || null;

      const stylesFromCheckout = safeJsonCast<CheckoutStyles>(data.styles);

      const previewData = {
        id: data.id,
        product_id: data.product_id,
        price: data.price / 100,
        promotional_price: data.promotional_price ? data.promotional_price / 100 : null,
        layout: data.layout || 'horizontal',
        offerMode: data.offer_mode || 'single',
        form_fields: {
          ...formFieldsData,
          packages: packagesConfig,
        },
        payment_methods: data.payment_methods as Tables<'checkouts'>['payment_methods'] || {},
        order_bumps: orderBumpsWithProducts,
        styles: {
          ...(stylesFromCheckout || {}),
          description: stylesFromCheckout?.description || data.products?.description || '',
          headlineText: stylesFromCheckout?.headlineText || data.products?.name || '',
          logo_url: stylesFromCheckout?.logo_url || null,
          banner_url: stylesFromCheckout?.banner_url || null,
        },
        extra_content: data.extra_content || {},
        support_contact: data.support_contact || {},
        integrations: data.integrations || {},
        timer: data.timer as Tables<'checkouts'>['timer'] || undefined,
        products: mainProductDetails ? {
          id: mainProductDetails.id,
          name: mainProductDetails.name,
          description: mainProductDetails.description,
          banner_url: mainProductDetails.banner_url,
          logo_url: mainProductDetails.logo_url,
          member_area_link: mainProductDetails.member_area_link,
          file_url: mainProductDetails.file_url,
        } : {
          id: 'default-product',
          name: 'Produto Principal',
          description: 'Este é o produto principal do seu checkout.',
          banner_url: null,
          logo_url: null,
          member_area_link: null,
          file_url: null,
          access_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email_template: null,
          is_active: true,
          price: 0,
          price_original: null,
          project_id: null,
          user_id: null,
          member_area_id: null,
        },
        user_id: data.user_id
      };

      localStorage.setItem('checkout-preview-draft', JSON.stringify(previewData));
      window.open('/checkout/preview', '_blank');
    } catch (error: any) {
      console.error('Erro ao carregar dados do checkout para preview:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível carregar o preview do checkout.",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutData.form_fields.packages || checkoutData.form_fields.packages.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um pacote ao checkout.",
        variant: "destructive"
      });
      return;
    }

    const mainPackagePrice = checkoutData.form_fields.packages[0]?.price;
    if (mainPackagePrice === undefined || mainPackagePrice <= 0) {
      toast({
        title: "Erro",
        description: "O preço do pacote principal deve ser maior que zero.",
        variant: "destructive"
      });
      return;
    }

    setIsSavingDialog(true); // Use isSavingDialog
    try {
      console.log('ADMIN_CHECKOUTS_DEBUG: Submitting form. Timer:', checkoutData.timer);

      const finalCheckoutDeliverable: DeliverableConfig = { ...checkoutData.form_fields.deliverable };
      if (finalCheckoutDeliverable.type === 'upload' && checkoutDeliverableFile) {
        console.log('ADMIN_CHECKOUTS_DEBUG: Uploading checkout-level deliverable file:', checkoutDeliverableFile.name);
        finalCheckoutDeliverable.fileUrl = await uploadFile(checkoutDeliverableFile, 'checkout-deliverables');
      } else if (finalCheckoutDeliverable.type === 'link') {
        finalCheckoutDeliverable.fileUrl = finalCheckoutDeliverable.link;
      } else {
        finalCheckoutDeliverable.fileUrl = null;
        finalCheckoutDeliverable.link = null;
      }

      const stylesFromCheckoutData = safeJsonCast<CheckoutStyles>(checkoutData.styles);

      let finalLogoUrl = stylesFromCheckoutData?.logo_url || null;
      if (checkoutLogoFile) {
        console.log('ADMIN_CHECKOUTS_DEBUG: Uploading checkout logo file:', checkoutLogoFile.name);
        finalLogoUrl = await uploadFile(checkoutLogoFile, 'checkout-logos');
      }
      let finalBannerUrl = stylesFromCheckoutData?.banner_url || null;
      if (checkoutBannerFile) {
        console.log('ADMIN_CHECKOUTS_DEBUG: Uploading checkout banner file:', checkoutBannerFile.name);
        finalBannerUrl = await uploadFile(checkoutBannerFile, 'checkout-banners');
      }


      const checkoutPayload: TablesInsert<'checkouts'> = {
        user_id: user?.id || null,
        name: checkoutData.name,
        product_id: checkoutData.form_fields.packages[0]?.associatedProductIds?.[0] || null,
        price: Math.round(checkoutData.form_fields.packages[0]?.price * 100) || 0,
        promotional_price: checkoutData.form_fields.packages[0]?.originalPrice ? Math.round(checkoutData.form_fields.packages[0].originalPrice * 100) : null,
        offer_mode: checkoutData.offerMode || 'single',
        form_fields: {
          ...checkoutData.form_fields,
          packages: checkoutData.form_fields.packages.map((pkg: PackageConfig) => ({
            ...pkg,
            price: Math.round(pkg.price * 100),
            originalPrice: Math.round((pkg.originalPrice || 0) * 100)
          })),
          deliverable: finalCheckoutDeliverable
        } as Json,
        payment_methods: checkoutData.payment_methods as Json,
        order_bumps: checkoutData.order_bumps.map((bump: any) => ({
          ...bump,
          price: Math.round(bump.price * 100),
          originalPrice: Math.round((bump.originalPrice || 0) * 100)
        })) as Json,
        styles: {
          ...(stylesFromCheckoutData || {}), // Ensure it's an object
          logo_url: finalLogoUrl,
          banner_url: finalBannerUrl,
        }, // Removed 'as Json' cast
        layout: 'horizontal',
        support_contact: checkoutData.support_contact as Json,
        integrations: checkoutData.integrations as Json,
        timer: checkoutData.timer as Json || null
      };

      console.log('ADMIN_CHECKOUTS_DEBUG: Final checkoutPayload before DB operation:', JSON.stringify(checkoutPayload, null, 2));
      console.log('ADMIN_CHECKOUTS_DEBUG: checkoutData.payment_methods BEFORE save:', JSON.stringify(checkoutData.payment_methods, null, 2));
      console.log('ADMIN_CHECKOUTS_DEBUG: payload.payment_methods BEFORE save:', JSON.stringify(checkoutPayload.payment_methods, null, 2));

      if (editingCheckout) {
        const {
          error
        } = await supabase.from('checkouts').update(checkoutPayload as TablesUpdate<'checkouts'>).eq('id', editingCheckout.id);
        if (error) throw error;
        console.log('ADMIN_CHECKOUTS_DEBUG: Checkout updated successfully! payment_methods saved:', JSON.stringify(checkoutPayload.payment_methods, null, 2));
        toast({
          title: "Sucesso",
          description: "Checkout atualizado!"
        });
      } else {
        const {
          error
        } = await supabase.from('checkouts').insert(checkoutPayload);
        if (error) throw error;
        console.log('ADMIN_CHECKOUTS_DEBUG: Checkout inserted successfully! payment_methods saved:', JSON.stringify(checkoutPayload.payment_methods, null, 2));
        toast({
          title: "Sucesso",
          description: "Checkout criado!"
        });
      }
      setIsDialogOpen(false);
      setEditingCheckout(null);
      clearSavedData();
      setCheckoutDeliverableFile(null);
      setCheckoutLogoFile(null);
      setCheckoutBannerFile(null);
      fetchCheckouts();
    } catch (error: any) {
      console.error('ADMIN_CHECKOUTS_DEBUG: Detailed error saving checkout:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar checkout. Verifique o console para mais detalhes.",
        variant: "destructive"
      });
    } finally {
      setIsSavingDialog(false); // Use isSavingDialog
    }
  };

  const renderIntegrationIcon = (integrationName: string, key: string) => {
    const iconProps = { className: "h-4 w-4 text-muted-foreground", key };
    switch (integrationName) {
      case 'Mercado Pago': return <CreditCard {...iconProps} />;
      case 'Meta Pixel': return <Facebook {...iconProps} />;
      case 'Email SMTP': return <Mail {...iconProps} />;
      case 'UTMify': return <BarChart3 {...iconProps} />;
      case 'Área de Membros': return <MonitorDot {...iconProps} />;
      default: return null;
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-4 lg:p-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 sm:mb-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground truncate">
            Checkouts
          </h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Gerencie as páginas de vendas dos seus produtos
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2"> {/* Container para os botões */}
          {/* O botão global de pré-visualização foi removido daqui */}
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingCheckout(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2 text-sm sm:text-base" size="sm" onClick={() => {
                 setEditingCheckout(null);
                 clearSavedData();
              }}>
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Novo Checkout</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto mx-auto">
              <DialogHeader>
                <DialogTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pr-2 sm:pr-8">
                  <span className="flex items-center gap-2 text-sm sm:text-base">
                    {editingCheckout ? 'Editar Checkout' : 'Criar Nova Página de Checkout'}
                    <Save className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                  </span>
                  {editingCheckout && (editingCheckout.name || checkoutData.name) && (
                    <>
                      {console.log('DEBUG: editingCheckout.name:', editingCheckout.name, 'checkoutData.name:', checkoutData.name)}
                      <span className="text-xs sm:text-sm text-blue-600 font-semibold truncate max-w-xs sm:max-w-md bg-blue-50 px-2 py-1 rounded">
                        {editingCheckout.name || checkoutData.name}
                      </span>
                    </>
                  )}
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    {hasSavedData && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                        Rascunho Carregado
                      </Badge>
                    )}
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={resetToOriginal}
                      className="text-xs sm:text-sm"
                    >
                      {editingCheckout ? 'Resetar' : 'Limpar Tudo'}
                    </Button>
                    {editingCheckout && hasSavedData && (
                      <Button 
                        type="button"
                        variant="destructive" 
                        size="sm" 
                        onClick={() => {
                          clearSavedData();
                          if (editingCheckout) {
                            const originalData = loadOriginalCheckoutData(editingCheckout);
                            loadData(originalData);
                          } else {
                            loadData(getInitialFormData());
                          }
                        }}
                        className="text-xs sm:text-sm"
                      >
                        Limpar Rascunho
                      </Button>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1 h-auto p-1">
                    <TabsTrigger value="basic" onClick={() => setCurrentTab('basic')} className="text-xs sm:text-sm py-2">
                      Básico
                    </TabsTrigger>
                    <TabsTrigger value="customer" onClick={() => setCurrentTab('customer')} className="text-xs sm:text-sm py-2">
                      Cliente
                    </TabsTrigger>
                    <TabsTrigger value="packages" onClick={() => setCurrentTab('packages')} className="text-xs sm:text-sm py-2">
                      Oferta
                    </TabsTrigger>
                    <TabsTrigger value="bumps" onClick={() => setCurrentTab('bumps')} className="text-xs sm:text-sm py-2">
                      <span className="hidden sm:inline">Order Bumps</span>
                      <span className="sm:hidden">Bumps</span>
                    </TabsTrigger>
                    <TabsTrigger value="guarantee" onClick={() => setCurrentTab('guarantee')} className="text-xs sm:text-sm py-2">
                      Garantia
                    </TabsTrigger>
                    <TabsTrigger value="payment" onClick={() => setCurrentTab('payment')} className="text-xs sm:text-sm py-2">
                      <span className="hidden sm:inline">Pagamento</span>
                      <span className="sm:hidden">Pgto</span>
                    </TabsTrigger>
                    <TabsTrigger value="integrations" onClick={() => setCurrentTab('integrations')} className="text-xs sm:text-sm py-2">
                      <span className="hidden sm:inline">Integrações</span>
                      <span className="sm:hidden">APIs</span>
                    </TabsTrigger>
                    <TabsTrigger value="styles" onClick={() => setCurrentTab('styles')} className="text-xs sm:text-sm py-2">
                      Visual
                    </TabsTrigger>
                    <TabsTrigger value="deliverable" onClick={() => setCurrentTab('deliverable')} className="text-xs sm:text-sm py-2">
                      <span className="hidden sm:inline">Entregável</span>
                      <span className="sm:hidden">Entreg.</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label>Área de Membros</Label>
                        <p className="text-sm text-muted-foreground">A associação de produto → Área de Membros agora é gerenciada em <strong>Configurações da Área de Membros</strong>. Removido do checkout.</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome do Checkout *</Label>
                        <Input id="name" value={checkoutData.name} onChange={e => handleInputChange('name', e.target.value)} placeholder="Ex: Checkout Curso de Marketing" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Descrição *</Label>
                        <Textarea id="description" value={(safeJsonCast<CheckoutStyles>(checkoutData.styles) || {})?.description || ''} onChange={e => handleInputChange('styles.description', e.target.value)} placeholder="Descrição do checkout..." rows={4} required />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="customer" className="space-y-4">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Campos do Cliente</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Nome Completo</Label>
                            <p className="text-sm text-muted-foreground">Obrigatório no checkout</p>
                          </div>
                          <Switch checked={checkoutData.form_fields?.requireName ?? true} onCheckedChange={checked => handleInputChange('form_fields.requireName', checked)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>CPF</Label>
                            <p className="text-sm text-muted-foreground">Documento obrigatório</p>
                          </div>
                          <Switch checked={checkoutData.form_fields?.requireCpf ?? true} onCheckedChange={checked => handleInputChange('form_fields.requireCpf', checked)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Telefone</Label>
                            <p className="text-sm text-muted-foreground">Número de contato</p>
                          </div>
                          <Switch checked={checkoutData.form_fields?.requirePhone ?? true} onCheckedChange={checked => handleInputChange('form_fields.requirePhone', checked)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Email</Label>
                            <p className="text-sm text-muted-foreground">Email principal</p>
                          </div>
                          <Switch checked={checkoutData.form_fields?.requireEmail ?? true} onCheckedChange={checked => handleInputChange('form_fields.requireEmail', checked)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Confirmar Email</Label>
                            <p className="text-sm text-muted-foreground">Campo de confirmação</p>
                          </div>
                          <Switch checked={checkoutData.form_fields?.requireEmailConfirm ?? true} onCheckedChange={checked => handleInputChange('form_fields.requireEmailConfirm', checked)} />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="packages" className="space-y-4">
                    <div className="space-y-4 mb-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold">Modo de Oferta</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Escolha como você quer apresentar sua oferta
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card 
                          className={cn(
                            "p-4 cursor-pointer transition-all border-2",
                            checkoutData.offerMode === 'single' 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-primary/50"
                          )}
                          onClick={() => handleInputChange('offerMode', 'single')}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5",
                              checkoutData.offerMode === 'single' 
                                ? "border-primary" 
                                : "border-muted-foreground"
                            )}>
                              {checkoutData.offerMode === 'single' && (
                                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold mb-1">Oferta Única</h4>
                              <p className="text-sm text-muted-foreground">
                                Um único pacote com um preço fixo. Ideal para ofertas simples e diretas.
                              </p>
                            </div>
                          </div>
                        </Card>

                        <Card 
                          className={cn(
                            "p-4 cursor-pointer transition-all border-2",
                            checkoutData.offerMode === 'multiple' 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-primary/50"
                          )}
                          onClick={() => handleInputChange('offerMode', 'multiple')}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5",
                              checkoutData.offerMode === 'multiple' 
                                ? "border-primary" 
                                : "border-muted-foreground"
                            )}>
                              {checkoutData.offerMode === 'multiple' && (
                                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold mb-1">Múltiplos Pacotes</h4>
                              <p className="text-sm text-muted-foreground">
                                Ofereça diferentes pacotes com preços variados. O cliente escolhe qual prefere.
                              </p>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-6">
                      <h3 className="text-lg font-semibold">
                        {checkoutData.offerMode === 'single' ? 'Sua Oferta' : 'Pacotes'}
                      </h3>
                      {checkoutData.offerMode === 'multiple' && (
                        <Button type="button" onClick={addPackage} size="sm" className="w-full sm:w-auto">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Pacote
                        </Button>
                      )}
                    </div>
                    
                    {checkoutData.form_fields.packages.map((pkg: PackageConfig, index: number) => (
                      <Card key={pkg.id} className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            {checkoutData.offerMode === 'single' ? 'Detalhes da Oferta' : `Pacote ${index + 1}`}
                          </h4>
                          {checkoutData.offerMode === 'multiple' && checkoutData.form_fields.packages.length > 1 && (
                            <Button type="button" variant="destructive" size="sm" onClick={() => removePackage(pkg.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
              
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <Label>{checkoutData.offerMode === 'single' ? 'Nome da Oferta' : 'Nome do Pacote'}</Label>
                             <Input value={pkg.name} onChange={e => updatePackage(pkg.id, 'name', e.target.value)} placeholder={checkoutData.offerMode === 'single' ? 'Ex: Acesso Completo' : 'Ex: Pacote Básico'} />
                          </div>
                          <div className="space-y-2">
                            <Label>Preço (R$)</Label>
                             <Input 
                               type="number" 
                               value={pkg.price} 
                               onChange={e => updatePackage(pkg.id, 'price', Math.max(0, Number(e.target.value)))} 
                               placeholder="0,00" 
                               step="0.01" 
                             />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <Label>Preço Original (R$)</Label>
                             <Input 
                               type="number" 
                               value={pkg.originalPrice} 
                               onChange={e => updatePackage(pkg.id, 'originalPrice', Math.max(0, Number(e.target.value)))} 
                               placeholder="0,00" 
                               step="0.01" 
                             />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch 
                              checked={pkg.mostSold || false} 
                              onCheckedChange={checked => updatePackage(pkg.id, 'mostSold', checked)} 
                            />
                            <Label className="text-sm">Marcar como "Mais Vendido"</Label>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <Label>Descrição</Label>
                           <Textarea value={pkg.description} onChange={e => updatePackage(pkg.id, 'description', e.target.value)} placeholder="Descrição do pacote..." rows={3} />
                        </div>
                        
                        {checkoutData.offerMode !== 'single' && (
                          <div className="space-y-2">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                              <Label>Tópicos do que será entregue</Label>
                              <Button type="button" size="sm" variant="outline" onClick={() => addTopicToPackage(pkg.id)} className="w-full sm:w-auto">
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar Tópico
                              </Button>
                            </div>
                            
                             {pkg.topics.map((topic, topicIndex) => (
                               <div key={topicIndex} className="flex items-center gap-2">
                                  <Input value={topic} onChange={e => updatePackageTopic(pkg.id, topicIndex, e.target.value)} placeholder="Ex: Acesso vitalício: ao conteúdo" />
                                 {pkg.topics.length > 1 && (
                                   <Button type="button" variant="destructive" size="sm" onClick={() => removeTopicFromPackage(pkg.id, topicIndex)}>
                                     <Trash2 className="h-4 w-4" />
                                   </Button>
                                 )}
                               </div>
                             ))}
                             <div className="text-xs text-muted-foreground mt-2">
                               💡 O texto antes dos dois pontos (:) será destacado em negrito automaticamente
                             </div>
                          </div>
                        )}

                        <Separator className="my-4" />

                        <div className="space-y-4">
                          <h4 className="font-semibold flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5" />
                            Produtos Associados (Opcional)
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Selecione os produtos que serão liberados ao comprar este pacote.
                          </p>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                              >
                                {pkg.associatedProductIds && pkg.associatedProductIds.length > 0
                                  ? `${pkg.associatedProductIds.length} produto(s) selecionado(s)`
                                  : "Selecionar produtos..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                              <Command>
                                <CommandInput placeholder="Buscar produto..." />
                                <CommandList>
                                  <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                  <CommandGroup>
                                    {products.map((product) => (
                                      <CommandItem
                                        key={product.id}
                                        value={product.id}
                                        onSelect={() => {
                                          toggleProductAssociation(pkg.id, product.id, !pkg.associatedProductIds?.includes(product.id));
                                        }}
                                      >
                                        <Checkbox
                                          checked={pkg.associatedProductIds?.includes(product.id)}
                                          onCheckedChange={(checked) => {
                                            toggleProductAssociation(pkg.id, product.id, checked as boolean);
                                          }}
                                          className="mr-2"
                                        />
                                        {product.name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="bumps" className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold">Order Bumps</h3>
                      <Button type="button" onClick={addOrderBump} size="sm" className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Order Bump
                      </Button>
                    </div>
                    
                    {checkoutData.order_bumps.map((bump: any, index: number) => (
                      <Card key={bump.id} className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Order Bump {index + 1}
                          </h4>
                          <div className="flex items-center gap-2">
                             <Switch checked={bump.enabled} onCheckedChange={checked => updateOrderBump(bump.id, 'enabled', checked)} />
                            <Button type="button" variant="destructive" size="sm" onClick={() => removeOrderBump(bump.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Carregar Produto Salvo</Label>
                            <Select 
                              value={bump.selectedProduct || 'manual'} 
                              onValueChange={value => loadProductAsOrderBump(bump.id, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um produto ou configure manualmente" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.filter(product => product.id && product.id.trim() !== '').map(product => (
                                  <SelectItem key={product.id} value={product.id}>
                                    <div className="flex items-center gap-2">
                                      <Package className="h-4 w-4" />
                                      {product.name}
                                    </div>
                                  </SelectItem>
                                ))}
                                <SelectItem value="manual">
                                  <div className="flex items-center gap-2">
                                    <Edit className="h-4 w-4" />
                                    Configuração Manual
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Ao selecionar um produto, os dados serão carregados automaticamente
                            </p>
                          </div>
                          
                          <Separator />
                          
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Preço (R$)</Label>
                                 <Input 
                                   type="number" 
                                   value={bump.price} 
                                   onChange={e => updateOrderBump(bump.id, 'price', Math.max(0, Number(e.target.value)))} 
                                   placeholder="0,00" 
                                   step="0.01" 
                                 />
                              </div>
                              <div className="space-y-2">
                                <Label>Preço Original (R$)</Label>
                                 <Input 
                                   type="number" 
                                   value={bump.originalPrice || 0} 
                                   onChange={e => updateOrderBump(bump.id, 'originalPrice', Math.max(0, Number(e.target.value)))} 
                                   placeholder="0,00" 
                                   step="0.01" 
                                 />
                               <p className="text-xs text-muted-foreground">
                                 Deixe 0 para não mostrar desconto
                               </p>
                             </div>
                           </div>
                           
                           {bump.selectedProduct && <div className="p-3 bg-muted rounded-lg">
                               <p className="text-sm text-muted-foreground mb-1">Descrição do produto selecionado:</p>
                               <p className="text-sm">{products.find(p => p.id === bump.selectedProduct)?.description || 'Nenhuma descrição disponível'}</p>
                             </div>}
                        </div>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="guarantee" className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Shield className="h-5 w-5" />
                          Garantia
                        </h3>
                        <Switch checked={checkoutData.form_fields.guarantee.enabled} onCheckedChange={checked => handleInputChange('form_fields.guarantee.enabled', checked)} />
                      </div>
                      
                      {checkoutData.form_fields.guarantee.enabled && <>
                          <div className="space-y-2">
                            <Label>Dias de Garantia</Label>
                            <Input type="number" value={checkoutData.form_fields.guarantee.days} onChange={e => handleInputChange('form_fields.guarantee.days', Number(e.target.value))} placeholder="7" />
                          </div>
                          <div className="space-y-2">
                            <Label>Descrição da Garantia</Label>
                            <Textarea value={checkoutData.form_fields.guarantee.description} onChange={e => handleInputChange('form_fields.guarantee.description', e.target.value)} placeholder="Descreva a garantia..." rows={3} />
                          </div>
                        </>}
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Direitos Reservados
                        </h3>
                        <Switch checked={checkoutData.form_fields.reservedRights.enabled} onCheckedChange={checked => handleInputChange('form_fields.reservedRights.enabled', checked)} />
                      </div>
                      
                      {checkoutData.form_fields.reservedRights.enabled && <div className="space-y-2">
                          <Label>Texto dos Direitos Reservados</Label>
                          <Textarea value={checkoutData.form_fields.reservedRights.text} onChange={e => handleInputChange('form_fields.reservedRights.text', e.target.value)} placeholder="Texto dos direitos reservados..." rows={3} />
                        </div>}
                    </div>
                  </TabsContent>

                  <TabsContent value="payment" className="space-y-4">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Formas de Pagamento</h3>
                        <p className="text-sm text-muted-foreground">
                          Selecione quais formas de pagamento estarão disponíveis no checkout
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center space-x-3 p-4 border rounded-lg">
                            <Checkbox id="pix" checked={checkoutData.payment_methods.pix} onCheckedChange={checked => handleInputChange('payment_methods.pix', checked)} />
                            <div className="flex items-center gap-2">
                              <Smartphone className="h-5 w-5 text-green-600" />
                              <div>
                                <Label htmlFor="pix" className="text-sm font-medium">PIX</Label>
                                <p className="text-xs text-muted-foreground">Pagamento instantâneo</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-3 p-4 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Checkbox id="creditCard" checked={checkoutData.payment_methods.creditCard} onCheckedChange={checked => handleInputChange('payment_methods.creditCard', checked)} />
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-blue-600" />
                                <div>
                                  <Label htmlFor="creditCard" className="text-sm font-medium">Cartão de Crédito</Label>
                                  <p className="text-xs text-muted-foreground">Parcelamento disponível</p>
                                </div>
                              </div>
                            </div>
                            
                            {checkoutData.payment_methods.creditCard && (
                              <div className="ml-8 space-y-3 pt-3 border-t">
                                <div className="space-y-2">
                                  <Label htmlFor="maxInstallments" className="text-sm">Máximo de Parcelas</Label>
                                  <Select 
                                    value={String(checkoutData.payment_methods.maxInstallments || 12)} 
                                    onValueChange={value => handleInputChange('payment_methods.maxInstallments', parseInt(value))}
                                  >
                                    <SelectTrigger id="maxInstallments">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-gray-800 z-50">
                                      {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                                        <SelectItem key={num} value={String(num)}>
                                          {num}x
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div className="flex items-center space-x-3">
                                  <Checkbox 
                                    id="installmentsWithInterest" 
                                    checked={checkoutData.payment_methods.installmentsWithInterest || false} 
                                    onCheckedChange={checked => handleInputChange('payment_methods.installmentsWithInterest', checked)} 
                                  />
                                  <Label htmlFor="installmentsWithInterest" className="text-sm">
                                    Cobrar juros nas parcelas
                                  </Label>
                                </div>
                                <p className="text-xs text-muted-foreground ml-7">
                                  {checkoutData.payment_methods.installmentsWithInterest 
                                    ? "As taxas de juros serão aplicadas conforme a configuração do Mercado Pago"
                                    : "Todas as parcelas serão sem juros"}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {!checkoutData.payment_methods.pix && !checkoutData.payment_methods.creditCard && <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800">
                              ⚠️ Selecione pelo menos uma forma de pagamento
                            </p>
                          </div>}
                      </div>
                      
                       
                       <div className="space-y-4">
                         <h3 className="text-lg font-semibold">Contato de Suporte</h3>
                         <p className="text-sm text-muted-foreground">
                           Adicione informações de contato para suporte
                         </p>
                         
                         <div className="space-y-2">
                           <Label>Email para Suporte</Label>
                           <Input value={checkoutData.support_contact?.email || ''} onChange={e => handleInputChange('support_contact.email', e.target.value)} placeholder="Ex: suporte@seudominio.com.br" />
                           <p className="text-xs text-muted-foreground">
                             Este email será mostrado no checkout para clientes que precisarem de ajuda
                           </p>
                         </div>
                       </div>
                     </div>
                    </TabsContent>

                  <TabsContent value="integrations" className="space-y-4">
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold">Configurações de Integração</h3>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Conta do Mercado Pago para Processamento</Label>
                          <Select 
                            value={checkoutData.integrations?.selectedMercadoPagoAccount || ''} 
                            onValueChange={value => {
                              if (value !== 'no-account') {
                                handleInputChange('integrations.selectedMercadoPagoAccount', value);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma conta configurada" />
                            </SelectTrigger>
                            <SelectContent>
                              {mercadoPagoAccounts.length === 0 ? (
                                <SelectItem value="no-account" disabled>
                                  Nenhuma conta configurada
                                </SelectItem>
                              ) : (
                                mercadoPagoAccounts.map((account) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    {account.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {mercadoPagoAccounts.length === 0 
                              ? "Configure uma conta do Mercado Pago na página de Integrações" 
                              : "Conta que será usada para processar os pagamentos deste checkout"
                            }
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Meta Pixel para Rastreamento</Label>
                          <Select 
                            value={checkoutData.integrations?.selectedMetaPixel || ''} 
                            onValueChange={value => {
                              if (value !== 'no-pixel') {
                                handleInputChange('integrations.selectedMetaPixel', value);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um pixel configurado" />
                            </SelectTrigger>
                            <SelectContent>
                              {metaPixels.length === 0 ? (
                                <SelectItem value="no-pixel" disabled>
                                  Nenhum pixel configurado
                                </SelectItem>
                              ) : (
                                metaPixels.map((pixel) => (
                                  <SelectItem key={pixel.id} value={pixel.id}>
                                    {pixel.name} (ID: {pixel.pixelId})
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {metaPixels.length === 0 
                              ? "Configure um Meta Pixel na página de Integrações" 
                              : "Pixel que será usado para rastrear conversões deste checkout"
                            }
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Conta de Email Transacional</Label>
                          <Select 
                            value={checkoutData.integrations?.selectedEmailAccount || "none"} 
                            onValueChange={value => {
                              if (value !== 'no-email-config' && value !== "none") {
                                handleInputChange('integrations.selectedEmailAccount', value);
                              } else {
                                handleInputChange('integrations.selectedEmailAccount', '');
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma conta de email configurada" />
                            </SelectTrigger>
                            <SelectContent>
                              {emailConfig ? (
                                <SelectItem key="default-email-config" value="default-email-config">
                                  {emailConfig.displayName || emailConfig.email}
                                </SelectItem>
                              ) : (
                                <SelectItem value="no-email-config" disabled>
                                  Nenhuma conta de email configurada
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {emailConfig
                              ? "Conta que será usada para enviar e-mails transacionais deste checkout"
                              : "Configure uma conta de e-mail na página de Integrações para habilitar esta opção"
                            }
                          </p>
                        </div>

                        {(mercadoPagoAccounts.length === 0 || metaPixels.length === 0 || !isEmailIntegrationConfigured) && (
                          <Card className="p-4 bg-blue-50 border-blue-200">
                            <div className="flex items-center gap-2 text-blue-800">
                              <CreditCard className="h-4 w-4" />
                              <span className="font-medium">Configure suas integrações</span>
                            </div>
                            <p className="text-sm text-blue-700 mt-1">
                              Para usar todas as funcionalidades, configure suas integrações na página de Administração.
                            </p>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              onClick={() => toast({ title: "Redirecionar", description: "Funcionalidade não implementada." })}
                              className="mt-3"
                            >
                              Ir para Integrações
                            </Button>
                          </Card>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="styles" className="space-y-4">
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold">Cores e Textos</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Cor Primária</Label>
                          <div className="flex gap-2">
                            <Input type="color" value={checkoutData.styles.primaryColor || '#3b82f6'} onChange={e => handleInputChange('styles.primaryColor', e.target.value)} className="w-16 h-10 p-1" />
                            <Input type="text" value={checkoutData.styles.primaryColor || '#3b82f6'} onChange={e => handleInputChange('styles.primaryColor', e.target.value)} placeholder="#3b82f6" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Cor do Gradiente</Label>
                          <div className="flex gap-2">
                            <Input type="color" value={checkoutData.styles.gradientColor || '#60a5fa'} onChange={e => handleInputChange('styles.gradientColor', e.target.value)} className="w-16 h-10 p-1" />
                            <Input type="text" value={checkoutData.styles.gradientColor || '#60a5fa'} onChange={e => handleInputChange('styles.gradientColor', e.target.value)} placeholder="#60a5fa" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Cor de Destaque</Label>
                          <div className="flex gap-2">
                            <Input type="color" value={checkoutData.styles.highlightColor || '#3b82f6'} onChange={e => handleInputChange('styles.highlightColor', e.target.value)} className="w-16 h-10 p-1" />
                            <Input type="text" value={checkoutData.styles.highlightColor || '#3b82f6'} onChange={e => handleInputChange('styles.highlightColor', e.target.value)} placeholder="#3b82f6" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Cor do Fundo</Label>
                          <div className="flex gap-2">
                            <Input type="color" value={checkoutData.styles.backgroundColor || '#ffffff'} onChange={e => handleInputChange('styles.backgroundColor', e.target.value)} className="w-16 h-10 p-1" />
                            <Input type="text" value={checkoutData.styles.backgroundColor || '#ffffff'} onChange={e => handleInputChange('styles.backgroundColor', e.target.value)} placeholder="#ffffff" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Cor do Texto</Label>
                          <div className="flex gap-2">
                            <Input type="color" value={checkoutData.styles.textColor || '#000000'} onChange={e => handleInputChange('styles.textColor', e.target.value)} className="w-16 h-10 p-1" />
                            <Input type="text" value={checkoutData.styles.textColor || '#000000'} onChange={e => handleInputChange('styles.textColor', e.target.value)} placeholder="#000000" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Cor do Título</Label>
                          <div className="flex gap-2">
                            <Input type="color" value={checkoutData.styles.headlineColor || '#000000'} onChange={e => handleInputChange('styles.headlineColor', e.target.value)} className="w-16 h-10 p-1" />
                            <Input type="text" value={checkoutData.styles.headlineColor || '#000000'} onChange={e => handleInputChange('styles.headlineColor', e.target.value)} placeholder="#000000" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Texto do Título</Label>
                        <Textarea value={(safeJsonCast<CheckoutStyles>(checkoutData.styles) || {})?.headlineText || ''} onChange={e => handleInputChange('styles.headlineText', e.target.value)} placeholder="Sua transformação começa agora!" rows={2} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="checkoutLogo">Logo do Checkout (Opcional)</Label>
                        <Input 
                          id="checkoutLogo" 
                          type="file" 
                          accept="image/*" 
                          onChange={e => handleCheckoutLogoFileChange(e.target.files?.[0] || null)} 
                        />
                        {checkoutLogoFile && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <ImageIcon className="h-4 w-4" />
                            <span>Novo logo selecionado: {checkoutLogoFile.name}</span>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleCheckoutLogoFileChange(null)}
                              className="h-6 px-2 text-destructive hover:text-destructive"
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Remover
                            </Button>
                          </div>
                        )}
                        {(safeJsonCast<CheckoutStyles>(checkoutData.styles) || {})?.logo_url && !checkoutLogoFile && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <ImageIcon className="h-4 w-4" />
                            <span>Logo atual: <a href={(safeJsonCast<CheckoutStyles>(checkoutData.styles) || {})?.logo_url || ''} target="_blank" rel="noopener noreferrer" className="underline">Ver</a></span>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleInputChange('styles.logo_url', null)}
                              className="h-6 px-2 text-destructive hover:text-destructive"
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Remover
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Este logo será exibido no cabeçalho do seu checkout.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="checkoutBanner">Banner do Checkout (Opcional)</Label>
                        <Input 
                          id="checkoutBanner" 
                          type="file" 
                          accept="image/*" 
                          onChange={e => handleCheckoutBannerFileChange(e.target.files?.[0] || null)} 
                        />
                        {checkoutBannerFile && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <ImageIcon className="h-4 w-4" />
                            <span>Novo banner selecionado: {checkoutBannerFile.name}</span>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleCheckoutBannerFileChange(null)}
                              className="h-6 px-2 text-destructive hover:text-destructive"
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Remover
                            </Button>
                          </div>
                        )}
                        {(safeJsonCast<CheckoutStyles>(checkoutData.styles) || {})?.banner_url && !checkoutBannerFile && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <ImageIcon className="h-4 w-4" />
                            <span>Banner atual: <a href={(safeJsonCast<CheckoutStyles>(checkoutData.styles) || {})?.banner_url || ''} target="_blank" rel="noopener noreferrer" className="underline">Ver</a></span>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleInputChange('styles.banner_url', null)}
                              className="h-6 px-2 text-destructive hover:text-destructive"
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Remover
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Este banner será exibido no topo do seu checkout.
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold">Timer de Escassez</h3>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Habilitar Timer</Label>
                          <p className="text-sm text-muted-foreground">Mostrar um contador de tempo no checkout</p>
                        </div>
                        <Switch checked={checkoutData.timer?.enabled || false} onCheckedChange={checked => handleInputChange('timer.enabled', checked)} />
                      </div>
                      {checkoutData.timer?.enabled && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Duração (minutos)</Label>
                              <Input type="number" value={checkoutData.timer.duration || 15} onChange={e => handleInputChange('timer.duration', Number(e.target.value))} placeholder="15" />
                            </div>
                            <div className="space-y-2">
                              <Label>Cor do Timer</Label>
                              <div className="flex gap-2">
                                <Input type="color" value={checkoutData.timer.color || '#dc2626'} onChange={e => handleInputChange('timer.color', e.target.value)} className="w-16 h-10 p-1" />
                                <Input type="text" value={checkoutData.timer.color || '#dc2626'} onChange={e => handleInputChange('timer.color', e.target.value)} placeholder="#dc2626" />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Texto do Timer</Label>
                            <Input value={checkoutData.timer.text || 'Oferta por tempo limitado'} onChange={e => handleInputChange('timer.text', e.target.value)} placeholder="Oferta por tempo limitado" />
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="deliverable" className="space-y-4">
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold">Configuração de Entregável</h3>
                      <p className="text-sm text-muted-foreground">
                        Defina como o produto principal (ou o pacote selecionado) será entregue após a compra.
                      </p>

                      <div className="space-y-4">
                        <Label>Tipo de Entregável</Label>
                        <Select 
                          value={checkoutData.form_fields.deliverable?.type || 'none'} 
                          onValueChange={value => handleInputChange('form_fields.deliverable.type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo de entregável" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum (usar link do produto)</SelectItem>
                            <SelectItem value="link">Link Direto</SelectItem>
                            <SelectItem value="upload">Upload de Arquivo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {checkoutData.form_fields.deliverable?.type === 'link' && (
                        <div className="space-y-2">
                          <Label htmlFor="deliverableLink">Link Direto do Entregável *</Label>
                          <Input 
                            id="deliverableLink" 
                            type="url" 
                            value={checkoutData.form_fields.deliverable.link || ''} 
                            onChange={e => handleInputChange('form_fields.deliverable.link', e.target.value)} 
                            placeholder="https://exemplo.com/meu-ebook.pdf" 
                            required 
                          />
                        </div>
                      )}

                      {checkoutData.form_fields.deliverable?.type === 'upload' && (
                        <div className="space-y-2">
                          <Label htmlFor="checkoutDeliverableFile">Upload de Arquivo Entregável *</Label>
                          <Input 
                            id="checkoutDeliverableFile" 
                            type="file" 
                            accept="image/*" 
                            onChange={e => handleCheckoutDeliverableFileChange(e.target.files?.[0] || null)} 
                            required={!((checkoutData.form_fields.deliverable as DeliverableConfig | null)?.fileUrl) && !checkoutDeliverableFile}
                          />
                          {((checkoutData.form_fields.deliverable as DeliverableConfig | null)?.fileUrl) && !checkoutDeliverableFile && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Link className="h-4 w-4" />
                              <span>Arquivo atual: <a href={((checkoutData.form_fields.deliverable as DeliverableConfig | null)?.fileUrl) || ''} target="_blank" rel="noopener noreferrer" className="underline">Ver</a></span>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  handleInputChange('form_fields.deliverable.fileUrl', null);
                                  handleInputChange('form_fields.deliverable.link', null);
                                }}
                                className="h-6 px-2 text-destructive hover:text-destructive"
                              >
                                <XCircle className="h-3 w-3 mr-1" /> Remover
                              </Button>
                            </div>
                          )}
                          {checkoutDeliverableFile && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Upload className="h-4 w-4" />
                              <span>Novo arquivo selecionado: {checkoutDeliverableFile.name}</span>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleCheckoutDeliverableFileChange(null)}
                                className="h-6 px-2 text-destructive hover:text-destructive"
                              >
                                <XCircle className="h-3 w-3 mr-1" /> Remover
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label htmlFor="deliverableName">Nome do Entregável (Opcional)</Label>
                        <Input 
                          id="deliverableName" 
                          value={checkoutData.form_fields.deliverable?.name || ''} 
                          onChange={e => handleInputChange('form_fields.deliverable.name', e.target.value)} 
                          placeholder="Ex: E-book Completo" 
                        />
                        <p className="text-xs text-muted-foreground">
                          Este nome será exibido na página de sucesso do pagamento.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deliverableDescription">Descrição do Entregável (Opcional)</Label>
                        <Textarea 
                          id="deliverableDescription" 
                          value={checkoutData.form_fields.deliverable?.description || ''} 
                          onChange={e => handleInputChange('form_fields.deliverable.description', e.target.value)} 
                          placeholder="Uma breve descrição do que será entregue." 
                          rows={3}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold">Email Transacional</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure o e-mail que será enviado automaticamente após a compra.
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Enviar Email Transacional</Label>
                          <p className="text-sm text-muted-foreground">
                            Um e-mail com o link de acesso será enviado ao cliente.
                          </p>
                        </div>
                        <Switch 
                          checked={checkoutData.form_fields.sendTransactionalEmail ?? true} 
                          onCheckedChange={checked => handleInputChange('form_fields.sendTransactionalEmail', checked)} 
                          disabled={!isEmailIntegrationConfigured}
                        />
                      </div>

                      {!isEmailIntegrationConfigured && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            Para enviar e-mails transacionais, configure uma conta de e-mail SMTP na página de Integrações.
                          </AlertDescription>
                        </Alert>
                      )}

                      {checkoutData.form_fields.sendTransactionalEmail && isEmailIntegrationConfigured && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="emailSubject">Assunto do Email</Label>
                            <Input 
                              id="emailSubject" 
                              value={checkoutData.form_fields.transactionalEmailSubject || ''} 
                              onChange={e => handleInputChange('form_fields.transactionalEmailSubject', e.target.value)} 
                              placeholder="Seu acesso ao produto Elyon Digital!" 
                            />
                            <p className="text-xs text-muted-foreground">
                              Use `{`{customer_name}`}` e `{`{product_name}`}` para personalizar.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="emailBody">Corpo do Email (HTML ou Texto)</Label>
                            <Textarea 
                              id="emailBody" 
                              value={checkoutData.form_fields.transactionalEmailBody || ''} 
                              onChange={e => handleInputChange('form_fields.transactionalEmailBody', e.target.value)} 
                              placeholder="Olá {customer_name},\n\nSeu acesso está liberado: {access_link}" 
                              rows={8}
                            />
                            <p className="text-xs text-muted-foreground">
                              Use `{`{customer_name}`}`, `{`{product_name}`}`, `{`{access_link}`}` e `{`{support_email}`}` para personalizar.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreview}
                    className="text-sm"
                  >
                    <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Pré-visualizar
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    className="text-sm"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSavingDialog} className="text-sm">
                    {editingCheckout 
                      ? (isSavingDialog ? 'Atualizando...' : 'Atualizar Checkout')
                      : (isSavingDialog ? 'Criando...' : 'Criar Checkout')
                    }
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Seus Checkouts ({checkouts.length})</span>
            <span className="sm:hidden">Checkouts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {checkouts.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">Nenhum checkout criado</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Comece criando sua primeira página de vendas
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {checkouts.map((checkout) => (
                <Card key={checkout.id} className="overflow-hidden hover-scale">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-semibold text-base sm:text-lg truncate pr-2">
                            {checkout.name || checkout.products?.name || 'Checkout sem nome'}
                          </h3>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0">
                                <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => handleEdit(checkout)} className="text-xs sm:text-sm">
                                <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleIndividualPreview(checkout.id)} className="text-xs sm:text-sm">
                                <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                Pré-visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${window.location.origin}/checkout/${checkout.id}`)} className="text-xs sm:text-sm">
                                <Link className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                Copiar Link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(checkout.id)} className="text-xs sm:text-sm">
                                <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-xs sm:text-sm text-destructive">
                                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="max-w-xs sm:max-w-md mx-2 sm:mx-4">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-sm sm:text-base">
                                      Confirmar exclusão
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-sm">
                                      Tem certeza de que deseja excluir o checkout "{checkout.name || checkout.products?.name}"?
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                    <AlertDialogCancel className="text-sm">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(checkout.id)}
                                      className="text-sm"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="text-muted-foreground text-xs sm:text-sm mb-2 line-clamp-2">
                          {(safeJsonCast<CheckoutStyles>(checkout.styles) || {})?.description || checkout.products?.description || 'Nenhuma descrição'}
                        </p>
                        {/* Associação a Área de Membros agora gerenciada nas configurações da Área de Membros */}
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-primary text-sm sm:text-base">
                            R$ {(checkout.price / 100).toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(checkout.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: window.innerWidth < 640 ? '2-digit' : 'numeric'
                            })}
                          </span>
                        </div>
                        {checkout.activeIntegrations && checkout.activeIntegrations.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {checkout.activeIntegrations.map((integrationName: string, index: number) => (
                              renderIntegrationIcon(integrationName, `integration-${checkout.id}-${index}`)
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCheckouts;