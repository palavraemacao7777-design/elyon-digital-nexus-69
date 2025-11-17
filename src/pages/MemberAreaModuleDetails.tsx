 
import React, { useEffect, useState } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tables, Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Video, Clock, Check, Settings, LogOut } from 'lucide-react';
import { deepMerge } from '@/lib/utils';
import { useMemberAreaAuth } from '@/hooks/useMemberAreaAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ProfileSettingsDialog from '@/components/member-area/ProfileSettingsDialog';
import { getDefaultSettings, PlatformColors } from '@/hooks/useGlobalPlatformSettings'; // Import PlatformColors

type PlatformSettings = Tables<'platform_settings'> & {
  colors: PlatformColors | null;
  password_reset_subject: string | null;
  password_reset_body: string | null;
};
type MemberArea = Tables<'member_areas'>;
type Module = Tables<'modules'>;
type Lesson = Tables<'lessons'>;

const MemberAreaModuleDetails = () => {
  const { memberAreaId, moduleId } = useParams<{ memberAreaId: string; moduleId: string }>();
  const { user, loading: authLoading, signOut } = useMemberAreaAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [memberArea, setMemberArea] = useState<MemberArea | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [userLessonCompletions, setUserLessonCompletions] = useState<Set<string>>(new Set()); // NEW: State for lesson completions

  const fetchModuleAndLessons = useCallback(async () => {
    if (!memberAreaId || !moduleId || !user?.id) {
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
        console.error('Error fetching member area:', areaError);
        toast({ title: "Erro", description: "Área de membros não encontrada.", variant: "destructive" });
        setHasAccess(false);
        setLoading(false);
        return;
      }
      setMemberArea(areaData);

      // 2. Fetch Platform Settings for this member area
      const { data: settingsData, error: settingsError } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('member_area_id', memberAreaId)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error fetching platform settings:', settingsError);
      } else if (settingsData) {
        setSettings(deepMerge(getDefaultSettings(memberAreaId), { ...settingsData, colors: settingsData.colors as PlatformColors | null } as Partial<PlatformSettings>));
      } else {
        setSettings(getDefaultSettings(memberAreaId));
      }

      // 3. Check if user has access to this specific member area
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('member_area_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || profileData?.member_area_id !== memberAreaId) {
        setHasAccess(false);
        toast({ title: "Acesso Negado", description: "Você não tem permissão para acessar esta área de membros.", variant: "destructive" });
        setLoading(false);
        return;
      }
      setHasAccess(true);

      // 4. Fetch Module details
      const { data: moduleData, error: moduleError } = await supabase
        .from('modules')
        .select('*') // Fetch all columns
        .eq('id', moduleId)
        .eq('member_area_id', memberAreaId)
        .eq('status', 'published')
        .maybeSingle();

      if (moduleError || !moduleData) {
        console.error('Error fetching module:', moduleError);
        toast({ title: "Erro", description: "Módulo não encontrado ou não publicado.", variant: "destructive" });
        setLoading(false);
        return;
      }
      setModule(moduleData);

      // 5. Fetch Lessons for this module
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('*') // Fetch all columns
        .eq('module_id', moduleId)
        .eq('status', 'published')
        .order('order_index', { ascending: true });

      if (lessonsError) {
        console.error('Error fetching lessons:', lessonsError);
        toast({ title: "Erro", description: "Falha ao carregar aulas do módulo.", variant: "destructive" });
      } else {
        setLessons(lessonsData || []);
      }

      // NEW: 6. Fetch all lesson completions for the current user in this member area
      const { data: completionsData, error: completionsError } = await supabase
        .from('lesson_completions')
        .select('lesson_id') as { data: Pick<Tables<'lesson_completions'>, 'lesson_id'>[] | null, error: any };
      
      if (completionsError) console.error('Error fetching user lesson completions:', completionsError);
      setUserLessonCompletions(new Set(completionsData?.map(c => c.lesson_id) || []));

    } catch (error: any) {
      console.error('Error in MemberAreaModuleDetails:', error);
      toast({ title: "Erro", description: error.message || "Ocorreu um erro ao carregar o módulo.", variant: "destructive" });
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  }, [memberAreaId, moduleId, user?.id, toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        toast({ title: "Não autenticado", description: "Faça login para acessar a área de membros.", variant: "destructive" });
        return;
      }
      fetchModuleAndLessons();
    }
  }, [user, user?.updated_at, authLoading, fetchModuleAndLessons, toast]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/membros/${memberAreaId}/login`} replace />;
  }

  if (!hasAccess) {
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
              <Link to="/">Voltar para o Início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Módulo não encontrado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>O módulo que você tentou acessar não existe ou não está publicado.</p>
            <Button asChild>
              <Link to={`/membros/${memberAreaId}`}>Voltar para o Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentSettings = settings || getDefaultSettings(memberAreaId || null);
  const primaryColor = (currentSettings.colors as PlatformColors)?.button_background || 'hsl(var(--member-area-primary))';
  const textColor = (currentSettings.colors as PlatformColors)?.text_primary || 'hsl(var(--member-area-text-dark))';
  const secondaryTextColor = (currentSettings.colors as PlatformColors)?.text_secondary || 'hsl(var(--member-area-text-muted))';
  const cardBackground = (currentSettings.colors as PlatformColors)?.card_login || 'hsl(var(--member-area-card-background))';
  const fontFamily = currentSettings.global_font_family || 'Nunito';
  const checkmarkBgColor = (currentSettings.colors as PlatformColors)?.checkmark_background || 'hsl(var(--member-area-checkmark-background))';
  const checkmarkIconColor = (currentSettings.colors as PlatformColors)?.checkmark_icon || 'hsl(var(--member-area-checkmark-icon))';

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Membro';
  const userInitial = userName.charAt(0).toUpperCase();
  const memberAreaNameInitials = memberArea?.name ? memberArea.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'MA';

  return (
    <div 
      className="w-full min-h-screen flex flex-col" 
      style={{ 
        backgroundColor: (currentSettings.colors as PlatformColors)?.background_login || 'hsl(var(--member-area-background))',
        fontFamily: fontFamily 
      }}
    >
      {/* HEADER */}
      <header 
        className="flex items-center justify-between h-[72px] px-4 sm:px-8 py-4 border-b" 
        style={{ 
          backgroundColor: (currentSettings.colors as PlatformColors)?.background_login || 'hsl(var(--member-area-background))',
          borderColor: (currentSettings.colors as PlatformColors)?.header_border || 'hsl(var(--member-area-header-border))',
          color: (currentSettings.colors as PlatformColors)?.text_header || 'hsl(var(--member-area-text-dark))'
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
      <div className="flex-1 px-4 sm:px-8 py-8 sm:py-16 max-w-6xl mx-auto w-full">
        <Button variant="ghost" asChild className="mb-4 sm:mb-8 -ml-2 sm:-ml-4 text-sm sm:text-base">
          <Link to={`/membros/${memberAreaId}`}> {/* Corrected link path */}
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o painel
          </Link>
        </Button>

        <Card className="shadow-lg rounded-xl p-4 sm:p-8" style={{ backgroundColor: cardBackground }}>
          <CardHeader className="px-0 pt-0 mb-4 sm:mb-6">
            <CardTitle className="text-2xl sm:text-4xl font-bold leading-tight" style={{ color: textColor }}>
              {module.title}
            </CardTitle>
            {module.description && (
              <p className="text-base sm:text-xl mt-2" style={{ color: secondaryTextColor }}>
                {module.description.trim()}
              </p>
            )}
          </CardHeader>
          <CardContent className="px-0 space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-semibold" style={{ color: textColor }}>Aulas do Módulo</h2>
            {lessons.length === 0 ? (
              <p className="text-muted-foreground text-sm sm:text-base">Nenhuma aula disponível neste módulo ainda.</p>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {lessons.map((lesson) => {
                  const isLessonCompleted = userLessonCompletions.has(lesson.id); // NEW: Check completion status
                  return (
                    <Card key={lesson.id} className="border-l-4" style={{ borderColor: primaryColor }}>
                      <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-3 sm:space-x-4">
                          <Video className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: primaryColor }} />
                          <div className="flex-1 flex flex-col min-w-0">
                            <h4 className="font-semibold text-base sm:text-lg truncate" style={{ color: textColor }}>
                              {lesson.title}
                              {isLessonCompleted && ( // NEW: Display checkmark if completed
                                <Check className="ml-2 h-4 w-4 inline-block" style={{ color: checkmarkIconColor }} />
                              )}
                            </h4>
                            {lesson.description?.trim() && (
                              <p className="text-xs sm:text-sm truncate" style={{ color: secondaryTextColor}}>
                                {lesson.description.trim()}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button asChild style={{ backgroundColor: primaryColor, color: '#FFFFFF' }} className="w-full sm:w-auto text-sm sm:text-base">
                          <Link to={`/membros/${memberAreaId}/modules/${moduleId}/lessons/${lesson.id}`}>
                            Acessar Aula
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MemberAreaModuleDetails;