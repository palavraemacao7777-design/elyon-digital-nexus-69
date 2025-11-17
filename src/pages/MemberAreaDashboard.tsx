 
import React, { useEffect, useState } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tables, Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, BookOpen, User, MessageSquare, ArrowRight, Settings, LogOut, Lock } from 'lucide-react';
import { deepMerge } from '@/lib/utils';
import { useMemberAreaAuth } from '@/hooks/useMemberAreaAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ProfileSettingsDialog from '@/components/member-area/ProfileSettingsDialog';
import { getDefaultSettings, PlatformColors } from '@/hooks/useGlobalPlatformSettings'; // Importar a função centralizada e PlatformColors
import { FormFields, PackageConfig } from '@/integrations/supabase/types';

type PlatformSettings = Tables<'platform_settings'> & {
  colors: PlatformColors | null;
  password_reset_subject: string | null;
  password_reset_body: string | null;
};
type MemberArea = Tables<'member_areas'>;
type Module = Tables<'modules'>;
type ProductAccess = Tables<'product_access'>;
type MemberAccess = Tables<'member_access'>; // NEW: Import MemberAccess type
type Checkout = Tables<'checkouts'>;

const MemberAreaDashboard = () => {
  const { memberAreaId } = useParams<{ memberAreaId: string }>();
  const { user, loading: authLoading, signOut } = useMemberAreaAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [memberArea, setMemberArea] = useState<MemberArea | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [userProductAccessIds, setUserProductAccessIds] = useState<string[]>([]);
  const [userModuleAccessIds, setUserModuleAccessIds] = useState<string[]>([]); // State for direct module access
  const [productCheckoutLinks, setProductCheckoutLinks] = useState<Record<string, string>>({});
  const [userLessonCompletions, setUserLessonCompletions] = useState<Set<string>>(new Set()); // State for lesson completions
  const [moduleLessonsMap, setModuleLessonsMap] = useState<Map<string, Set<string>>>(new Map()); // Map to store lessons per module

  const fetchMemberAreaAndContent = useCallback(async () => {
    console.log('MEMBER_AREA_DASHBOARD_DEBUG: fetchMemberAreaAndContent started. User ID:', user?.id, 'MemberAreaId:', memberAreaId);
    if (!memberAreaId || !user?.id) {
      console.log('MEMBER_AREA_DASHBOARD_DEBUG: Skipping fetch, missing memberAreaId or user ID.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch Member Area details
      const { data: areaData, error: areaError } = await supabase
        .from('member_areas')
        .select('*')
        .eq('id', memberAreaId)
        .maybeSingle();

      if (areaError || !areaData) {
        console.error('MEMBER_AREA_DASHBOARD_DEBUG: Error fetching member area:', areaError);
        toast({ title: "Erro", description: "Área de membros não encontrada.", variant: "destructive" });
        setHasAccess(false);
        setLoading(false);
        return;
      }
      setMemberArea(areaData);
      console.log('MEMBER_AREA_DASHBOARD_DEBUG: Member Area Data:', areaData);

      // 2. Fetch Platform Settings for this member area
      const { data: settingsData, error: settingsError } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('member_area_id', memberAreaId)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('MEMBER_AREA_DASHBOARD_DEBUG: Error fetching platform settings:', settingsError);
      } else if (settingsData) {
        setSettings(deepMerge(getDefaultSettings(memberAreaId), { ...settingsData, colors: settingsData.colors as PlatformColors | null } as Partial<PlatformSettings>));
      } else {
        setSettings(getDefaultSettings(memberAreaId));
      }
      console.log('MEMBER_AREA_DASHBOARD_DEBUG: Platform Settings:', settingsData);

      // 3. Check if user has access to this specific member area (via member_access table)
      const { data: memberAccessData, error: memberAccessError } = await supabase
        .from('member_access')
        .select('id')
        .eq('user_id', user.id)
        .eq('member_area_id', memberAreaId)
        .eq('is_active', true)
        .limit(1);

      if (memberAccessError) {
        console.error('MEMBER_AREA_DASHBOARD_DEBUG: Error checking member_access:', memberAccessError);
        setHasAccess(false);
        toast({ title: "Erro de Acesso", description: "Não foi possível verificar suas permissões.", variant: "destructive" });
        setLoading(false);
        return;
      }
      
      if (!memberAccessData || memberAccessData.length === 0) {
        console.log('MEMBER_AREA_DASHBOARD_DEBUG: No active member_access record found for user', user.id, 'in member area', memberAreaId);
        setHasAccess(false);
        toast({ title: "Acesso Negado", description: "Você não tem permissão para acessar esta área de membros.", variant: "destructive" });
        setLoading(false);
        return;
      }
      setHasAccess(true);
      console.log('MEMBER_AREA_DASHBOARD_DEBUG: User HAS access to member area.');

      // 4. Fetch ALL published modules for this member area
      const { data: allPublishedModulesData, error: allPublishedModulesError } = await supabase
        .from('modules')
        .select('*') // Fetch all columns
        .eq('member_area_id', memberAreaId)
        .eq('status', 'published')
        .order('order_index', { ascending: true });

      if (allPublishedModulesError) {
        console.error('MEMBER_AREA_DASHBOARD_DEBUG: Error fetching all published modules:', allPublishedModulesError);
        toast({ title: "Erro", description: "Falha ao carregar módulos.", variant: "destructive" });
        setModules([]);
      } else {
        setModules(allPublishedModulesData || []);
        console.log('MEMBER_AREA_DASHBOARD_DEBUG: All Published Modules:', allPublishedModulesData);
      }

      // 5. Fetch user's product access (from product_access table)
      const { data: accessData, error: accessError } = await supabase
        .from('product_access')
        .select('product_id') as { data: Pick<Tables<'product_access'>, 'product_id'>[] | null, error: any };
      if (accessError) console.error('MEMBER_AREA_DASHBOARD_DEBUG: Error fetching product access:', accessError);
      const accessedProductIds = accessData?.map(a => a.product_id).filter(Boolean) as string[] || [];
      setUserProductAccessIds(accessedProductIds);
      console.log('MEMBER_AREA_DASHBOARD_DEBUG: User has access to products:', accessedProductIds);

      // NEW 5.1. Fetch user's direct module access (from member_access table)
      const { data: directModuleAccessData, error: directModuleAccessError } = await supabase
        .from('member_access')
        .select('module_id') as { data: Pick<Tables<'member_access'>, 'module_id'>[] | null, error: any };
      if (directModuleAccessError) console.error('MEMBER_AREA_DASHBOARD_DEBUG: Error fetching direct module access:', directModuleAccessError);
      const accessedModuleIds = directModuleAccessData?.map(ma => ma.module_id).filter(Boolean) as string[] || [];
      setUserModuleAccessIds(accessedModuleIds);
      console.log('MEMBER_AREA_DASHBOARD_DEBUG: User has direct access to modules:', accessedModuleIds);

      // NEW: 6. Fetch all lessons for all published modules in this member area
      const allModuleIds = allPublishedModulesData?.map(m => m.id) || [];
      if (allModuleIds.length > 0) {
        const { data: allLessonsData, error: allLessonsError } = await supabase
          .from('lessons')
          .select('id, module_id')
          .in('module_id', allModuleIds)
          .eq('status', 'published');
        
        if (allLessonsError) {
          console.error('MEMBER_AREA_DASHBOARD_DEBUG: Error fetching all lessons for modules:', allLessonsError);
        } else {
          const newModuleLessonsMap = new Map<string, Set<string>>();
          allLessonsData?.forEach(lesson => {
            if (!newModuleLessonsMap.has(lesson.module_id)) {
              newModuleLessonsMap.set(lesson.module_id, new Set());
            }
            newModuleLessonsMap.get(lesson.module_id)?.add(lesson.id);
          });
          setModuleLessonsMap(newModuleLessonsMap);
          console.log('MEMBER_AREA_DASHBOARD_DEBUG: Module Lessons Map:', newModuleLessonsMap);
        }
      }

      // NEW: 7. Fetch all lesson completions for the current user
      const { data: completionsData, error: completionsError } = await supabase
        .from('lesson_completions')
        .select('lesson_id') as { data: Pick<Tables<'lesson_completions'>, 'lesson_id'>[] | null, error: any };
      
      if (completionsError) console.error('MEMBER_AREA_DASHBOARD_DEBUG: Error fetching user lesson completions:', completionsError);
      setUserLessonCompletions(new Set(completionsData?.map(c => c.lesson_id) || []));
      console.log('MEMBER_AREA_DASHBOARD_DEBUG: User Lesson Completions:', completionsData);


      // 8. Fetch checkout links for products associated with modules
      const uniqueModuleProductIds = [...new Set(allPublishedModulesData?.map(m => m.product_id).filter(Boolean))] as string[];
      const checkoutLinksMap: Record<string, string> = {};

      if (uniqueModuleProductIds.length > 0) {
        // Fetch all checkouts belonging to the member area owner
        const { data: allCheckouts, error: allCheckoutsError } = await supabase
          .from('checkouts')
          .select('id, product_id, form_fields') as { data: Pick<Tables<'checkouts'>, 'id' | 'product_id' | 'form_fields'>[] | null, error: any };

        if (allCheckoutsError) {
          console.error('MEMBER_AREA_DASHBOARD_DEBUG: Error fetching all checkouts for member area owner:', allCheckoutsError);
        }

        allCheckouts?.forEach(checkout => {
          // Check if the main product of the checkout is one of the module products
          if (checkout.product_id && uniqueModuleProductIds.includes(checkout.product_id)) {
            if (!checkoutLinksMap[checkout.product_id]) {
              checkoutLinksMap[checkout.product_id] = `/checkout/${checkout.id}`;
            }
          }

          // Check if any product associated with a package in this checkout is one of the module products
          const packages = (checkout.form_fields as FormFields)?.packages;
          if (packages && Array.isArray(packages)) {
            packages.forEach((pkg: PackageConfig) => {
              if (pkg.associatedProductIds && Array.isArray(pkg.associatedProductIds)) {
                pkg.associatedProductIds.forEach(prodId => {
                  if (uniqueModuleProductIds.includes(prodId) && !checkoutLinksMap[prodId]) {
                    checkoutLinksMap[prodId] = `/checkout/${checkout.id}`;
                  }
                });
              }
            });
          }
        });
      }
      setProductCheckoutLinks(checkoutLinksMap);
      console.log('MEMBER_AREA_DASHBOARD_DEBUG: Product Checkout Links:', checkoutLinksMap);

    } catch (error: any) {
      console.error('MEMBER_AREA_DASHBOARD_DEBUG: Error in MemberAreaDashboard:', error);
      toast({ title: "Erro", description: error.message || "Ocorreu um erro ao carregar o painel.", variant: "destructive" });
      setHasAccess(false);
    } finally {
      setLoading(false);
      console.log('MEMBER_AREA_DASHBOARD_DEBUG: fetchMemberAreaAndContent finished. Loading set to false.');
    }
  }, [memberAreaId, user?.id, toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        console.log('MEMBER_AREA_DASHBOARD_DEBUG: User not authenticated, redirecting to login.');
        toast({ title: "Não autenticado", description: "Faça login para acessar a área de membros.", variant: "destructive" });
        return;
      }
      fetchMemberAreaAndContent();

      // Setup real-time listener for member_access changes
      const channel = supabase
        .channel(`member_access_changes:${user.id}:${memberAreaId}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for all changes (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'member_access',
            filter: `user_id=eq.${user.id}&member_area_id=eq.${memberAreaId}`,
          },
          (payload) => {
            console.log('MEMBER_AREA_DASHBOARD_DEBUG: Realtime member_access change received:', payload);
            fetchMemberAreaAndContent(); // Re-fetch all data on change
          }
        )
        .subscribe();

      // Setup real-time listener for modules changes so order updates reflect immediately
      const modulesChannel = supabase
        .channel(`modules_changes:${memberAreaId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'modules',
            filter: `member_area_id=eq.${memberAreaId}`,
          },
          (payload) => {
            console.log('MEMBER_AREA_DASHBOARD_DEBUG: Realtime modules change received:', payload);
            fetchMemberAreaAndContent(); // Re-fetch modules and related data on change
          }
        )
        .subscribe();

      return () => {
        console.log('MEMBER_AREA_DASHBOARD_DEBUG: Unsubscribing from realtime channels.');
        supabase.removeChannel(channel);
        supabase.removeChannel(modulesChannel);
      };
    }
  }, [user, authLoading, fetchMemberAreaAndContent, memberAreaId, toast]);

  if (authLoading || loading) {
    console.log('MEMBER_AREA_DASHBOARD_DEBUG: Rendering loading spinner. AuthLoading:', authLoading, 'Loading:', loading);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    console.log('MEMBER_AREA_DASHBOARD_DEBUG: No user, navigating to login.');
    return <Navigate to={`/membros/${memberAreaId}/login`} replace />;
  }

  if (!hasAccess) {
    console.log('MEMBER_AREA_DASHBOARD_DEBUG: User has no access, displaying access denied message.');
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Você não tem permissão para acessar esta área de membros.</p>
            <Button onClick={() => signOut()}>Sair</Button>
            <Button asChild variant="outline">
              <Link to="/membros">Voltar para Minhas Áreas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentSettings = settings || getDefaultSettings(memberAreaId || null);
  const primaryColor = currentSettings.colors?.button_background || 'hsl(var(--member-area-primary))';
  const textColor = currentSettings.colors?.text_primary || 'hsl(var(--member-area-text-dark))';
  const secondaryTextColor = currentSettings.colors?.text_secondary || 'hsl(var(--member-area-text-muted))';
  const cardBackground = currentSettings.colors?.card_login || 'hsl(var(--member-area-card-background))';
  const fontFamily = currentSettings.global_font_family || 'Nunito';
  const checkmarkBgColor = currentSettings.colors?.checkmark_background || 'hsl(var(--member-area-checkmark-background))'; // Defined here
  const checkmarkIconColor = currentSettings.colors?.checkmark_icon || 'hsl(var(--member-area-checkmark-icon))'; // Defined here

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Membro';
  const userInitial = userName.charAt(0).toUpperCase();
  const memberAreaNameInitials = memberArea?.name ? memberArea.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'MA';

  return (
    <div 
      className="w-full min-h-screen flex flex-col" 
      style={{ 
        backgroundColor: currentSettings.colors?.background_login || 'hsl(var(--member-area-background))',
        fontFamily: fontFamily 
      }}
    >
      {/* HEADER */}
      <header 
        className="flex items-center justify-between h-[72px] px-4 sm:px-8 py-4 border-b" 
        style={{ 
          backgroundColor: currentSettings.colors?.background_login || 'hsl(var(--member-area-background))',
          borderColor: currentSettings.colors?.header_border || 'hsl(var(--member-area-header-border))',
          color: currentSettings.colors?.text_header || 'hsl(var(--member-area-text-dark))'
        }}
      >
        <div className="flex items-center space-x-3">
          {currentSettings.logo_url ? (
            <img 
              src={currentSettings.logo_url} 
              alt={memberArea?.name || "Logo da Plataforma"} 
              className="h-12 w-12 sm:h-16 sm:w-16 object-contain"
            />
          ) : (
            <Avatar className="h-12 w-12 sm:h-16 sm:w-16 border border-gray-200">
              <AvatarFallback className="bg-white text-memberArea-text-dark text-lg sm:text-xl font-semibold">
                {memberAreaNameInitials}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="text-lg sm:text-xl font-semibold" style={{ color: textColor }}>{memberArea?.name || 'Área de Membros'}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto w-auto rounded-full" style={{ color: secondaryTextColor }}>
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border border-gray-200">
                <AvatarImage src={user?.user_metadata?.avatar_url || undefined} alt={userName} />
                <AvatarFallback className="bg-white text-memberArea-text-dark text-sm sm:text-base font-semibold">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 sm:w-48" style={{ backgroundColor: cardBackground, color: textColor }}>
            <ProfileSettingsDialog memberAreaId={memberAreaId || ''}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} style={{ color: textColor }} className="text-sm sm:text-base">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações de Perfil</span>
              </DropdownMenuItem>
            </ProfileSettingsDialog>
            <DropdownMenuSeparator style={{ backgroundColor: secondaryTextColor + '40' }} />
            <DropdownMenuItem onClick={signOut} className="text-destructive text-sm sm:text-base">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Conteúdo Principal */}
      <div className="flex-1 px-4 sm:px-8 py-8 sm:py-16 text-center space-y-4 sm:space-y-6">
        <h1 className="text-3xl sm:text-5xl font-bold" style={{ color: textColor }}>
          Olá, {userName}!
        </h1>
        <p className="text-lg sm:text-xl" style={{ color: secondaryTextColor }}>
          Bem-vindo(a) à sua área de membros. Escolha um módulo para começar.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 mt-8 sm:mt-16 max-w-6xl mx-auto">
          {modules.length === 0 && (
            <p className="text-memberArea-text-muted text-sm sm:text-base">Nenhum módulo disponível para você ainda.</p>
          )}
          {modules.map((module) => {
            // Determine if user has access to this module
            const hasUserAccess = (module.product_id && userProductAccessIds.includes(module.product_id)) || userModuleAccessIds.includes(module.id);
            
            // Determine if module is completed (all its published lessons are completed)
            const moduleLessons = moduleLessonsMap.get(module.id);
            const isModuleCompleted = moduleLessons 
              ? Array.from(moduleLessons).every(lessonId => userLessonCompletions.has(lessonId))
              : false;

            const moduleCheckoutLink = module.checkout_link || (module.product_id ? productCheckoutLinks[module.product_id] : null);

            return (
              <Card 
                key={module.id} 
                className={`overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 rounded-xl`}
                style={{ backgroundColor: cardBackground, color: currentSettings.colors?.text_cards || textColor }}
              >
                <div className="relative aspect-video w-full bg-gray-200">
                  {module.banner_url && (
                    <img 
                      src={module.banner_url} 
                      alt={module.title} 
                      className={`w-full h-full object-cover ${!hasUserAccess ? 'grayscale brightness-50' : ''}`} 
                    />
                  )}
                  {isModuleCompleted && ( // Display checkmark if module is completed
                    <div 
                      className="absolute top-2 right-2 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-full"
                      style={{ backgroundColor: checkmarkBgColor }}
                    >
                      <Check className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: checkmarkIconColor }} />
                    </div>
                  )}
                  {!hasUserAccess && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                      <Lock className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>
                <CardContent className="p-4 sm:p-6 space-y-2 sm:space-y-4 flex flex-col flex-1">
                  <h3 className="text-lg sm:text-xl font-bold" style={{ color: currentSettings.colors?.text_cards || textColor }}>
                    {module.title}
                  </h3>
                  <p className="text-xs sm:text-sm flex-1" style={{ color: secondaryTextColor }}>
                    {module.description}
                  </p>
                  
                  {hasUserAccess ? (
                    <Button 
                      className="w-full h-10 sm:h-12 rounded-lg flex items-center justify-center gap-2 font-semibold hover:bg-memberArea-primary-hover transition-colors duration-300 text-sm sm:text-base"
                      style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
                      asChild
                    >
                      <Link to={`/membros/${memberArea?.id}/modules/${module.id}`}>
                        Acessar Módulo <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    moduleCheckoutLink ? (
                      <Button 
                        className="w-full h-10 sm:h-12 rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors duration-300 text-sm sm:text-base"
                        style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
                        asChild
                      >
                        <Link to={moduleCheckoutLink}>
                          Comprar Acesso <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button 
                        className="w-full h-10 sm:h-12 rounded-lg flex items-center justify-center gap-2 font-semibold text-sm sm:text-base"
                        variant="outline"
                        disabled
                      >
                        Acesso Bloqueado <Lock className="h-4 w-4 ml-2" />
                      </Button>
                    )
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MemberAreaDashboard;