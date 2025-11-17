 
import React, { useEffect, useState } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tables, Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Video, Clock, FileText, ImageIcon, Settings, LogOut, Check, CheckCircle2 } from 'lucide-react'; // Adicionado CheckCircle2
import { deepMerge } from '@/lib/utils';
import { useMemberAreaAuth } from '@/hooks/useMemberAreaAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ProfileSettingsDialog from '@/components/member-area/ProfileSettingsDialog';
import { getDefaultSettings, PlatformColors } from '@/hooks/useGlobalPlatformSettings'; // Importar a função centralizada e PlatformColors
import LessonComments from '@/components/member-area/LessonComments'; // Import LessonComments

type PlatformSettings = Tables<'platform_settings'> & {
  colors: PlatformColors | null;
  password_reset_subject: string | null;
  password_reset_body: string | null;
};
type MemberArea = Tables<'member_areas'>;
type Module = Tables<'modules'>;
type Lesson = Tables<'lessons'>;

const MemberAreaLesson = () => {
  const { memberAreaId, moduleId, lessonId } = useParams<{ memberAreaId: string; moduleId: string; lessonId: string }>();
  const { user, loading: authLoading, signOut } = useMemberAreaAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [memberArea, setMemberArea] = useState<MemberArea | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null); // State for the current lesson
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isLessonCompleted, setIsLessonCompleted] = useState(false); // NEW: State for lesson completion

  const fetchLessonContent = useCallback(async () => {
    if (!memberAreaId || !moduleId || !lessonId || !user?.id) {
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

      // 5. Fetch Lesson details
      const { data: lessonData, error: lessonError } = await supabase
        .from('lessons')
        .select('*') // Fetch all columns
        .eq('id', lessonId)
        .eq('module_id', moduleId)
        .eq('status', 'published')
        .maybeSingle();

      if (lessonError || !lessonData) {
        console.error('Error fetching lesson:', lessonError);
        toast({ title: "Erro", description: "Aula não encontrada ou não publicada.", variant: "destructive" });
        setLoading(false);
        return;
      }
      setLesson(lessonData);

      // NEW: 6. Check if lesson is completed by the user
      const { data: completionData, error: completionError } = await supabase
        .from('lesson_completions')
        .select('id')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (completionError) console.error('Error fetching lesson completion status:', completionError);
      setIsLessonCompleted(!!completionData);

    } catch (error: any) {
      console.error('Error in MemberAreaLesson:', error);
      toast({ title: "Erro", description: error.message || "Ocorreu um erro ao carregar a aula.", variant: "destructive" });
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  }, [memberAreaId, moduleId, lessonId, user?.id, toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        toast({ title: "Não autenticado", description: "Faça login para acessar a área de membros.", variant: "destructive" });
        return;
      }
      fetchLessonContent();
    }
  }, [user, authLoading, fetchLessonContent, toast]);

  const handleToggleLessonCompletion = async () => {
    if (!user || !lessonId) return;

    setLoading(true);
    try {
      if (isLessonCompleted) {
        // Mark as incomplete
        const { error } = await supabase
          .from('lesson_completions')
          .delete()
          .eq('user_id', user.id)
          .eq('lesson_id', lessonId);

        if (error) throw error;
        setIsLessonCompleted(false);
        toast({ title: "Aula Desmarcada", description: "A aula foi desmarcada como concluída.", variant: "default" });
      } else {
        // Mark as complete
        const { error } = await supabase
          .from('lesson_completions')
          .insert({
            user_id: user.id,
            lesson_id: lessonId,
            completed_at: new Date().toISOString(),
          });

        if (error) throw error;
        setIsLessonCompleted(true);
        toast({ title: "Aula Concluída! 🎉", description: "Parabéns! Você concluiu esta aula.", variant: "default" });
      }
    } catch (error: any) {
      console.error('Error toggling lesson completion:', error);
      toast({ title: "Erro", description: error.message || "Não foi possível atualizar o status da aula.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderLessonContent = (currentLesson: Lesson) => {
    if (!currentLesson.content_url && !currentLesson.text_content) {
      return <p className="text-muted-foreground text-sm">Nenhum conteúdo para esta aula.</p>;
    }

    switch (currentLesson.content_type) {
      case 'video_link': {
        const youtubeMatch = currentLesson.content_url?.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})/);
        const vimeoMatch = currentLesson.content_url?.match(/(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com)\/(?:video\/|)(\d+)/);

        if (youtubeMatch && youtubeMatch[1]) {
          return (
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={currentLesson.title}
              ></iframe>
            </div>
          );
        } else if (vimeoMatch && vimeoMatch[1]) {
          return (
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title={currentLesson.title}
              ></iframe>
            </div>
          );
        }
        return <p className="text-red-500 text-sm">Link de vídeo inválido ou não suportado.</p>;
      }
        return (
          <video controls className="w-full h-auto rounded-lg">
            <source src={currentLesson.content_url || ''} type="video/mp4" />
            Seu navegador não suporta a tag de vídeo.
          </video>
        );

      case 'pdf_upload':
        return (
          <div className="relative w-full" style={{ paddingTop: '100%' }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              src={currentLesson.content_url || ''}
              frameBorder="0"
              title={currentLesson.title}
            ></iframe>
          </div>
        );

      case 'image_upload':
        return (
          <img src={currentLesson.content_url || ''} alt={currentLesson.title} className="w-full h-auto object-contain rounded-lg" />
        );

      case 'text_content':
        return <div dangerouslySetInnerHTML={{ __html: currentLesson.text_content || '' }} className="prose prose-lg max-w-none" style={{ color: (currentSettings.colors as PlatformColors)?.text_cards || 'hsl(var(--member-area-text-dark))' }} />;

      default:
        return <p className="text-muted-foreground text-sm">Tipo de conteúdo desconhecido.</p>;
    }
  };

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

  if (!lesson || !module) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Aula não encontrada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>A aula que você tentou acessar não existe ou não está publicada.</p>
            <Button asChild>
              <Link to={`/membros/${memberAreaId}/modules/${moduleId}`}>Voltar para o Módulo</Link>
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
          <Link to={`/membros/${memberAreaId}/modules/${moduleId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o módulo
          </Link>
        </Button>

        <Card className="shadow-lg rounded-xl p-4 sm:p-8" style={{ backgroundColor: cardBackground }}>
          <CardHeader className="px-0 pt-0 mb-4 sm:mb-6">
            <CardTitle className="text-2xl sm:text-4xl font-bold leading-tight" style={{ color: textColor }}>
              {lesson.title}
            </CardTitle>
            {lesson.description && (
              <p className="text-base sm:text-xl mt-2" style={{ color: secondaryTextColor }}>
                {lesson.description.trim()}
              </p>
            )}
          </CardHeader>
          <CardContent className="px-0">
            {renderLessonContent(lesson)}
            
            {/* NEW: Mark as Complete Button */}
            <div className="mt-8 text-center">
              <Button
                onClick={handleToggleLessonCompletion}
                disabled={loading}
                className="w-full sm:w-auto text-sm sm:text-base"
                style={{ 
                  backgroundColor: isLessonCompleted ? checkmarkBgColor : primaryColor,
                  color: isLessonCompleted ? checkmarkIconColor : '#FFFFFF',
                  borderColor: isLessonCompleted ? checkmarkIconColor : 'transparent',
                  borderWidth: isLessonCompleted ? '1px' : '0px',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {isLessonCompleted ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Aula Concluída!
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Marcar como Concluída
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lesson Comments Section */}
        <div className="mt-8">
          <LessonComments lessonId={lessonId || ''} memberAreaId={memberAreaId || ''} />
        </div>
      </div>
    </div>
  );
};

export default MemberAreaLesson;