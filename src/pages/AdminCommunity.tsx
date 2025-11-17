 
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MessageCircle, Trash2, Eye, User, Calendar, BookOpen, MessageSquarePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tables } from '@/integrations/supabase/types'; // Import Tables

interface Comment extends Tables<'lesson_comments'> {
  profiles?: Pick<Tables<'profiles'>, 'name' | 'avatar_url'> | null;
  lessons?: Pick<Tables<'lessons'>, 'title'> & {
    modules?: Pick<Tables<'modules'>, 'title'> | null;
  } | null;
}

const CommentDetailsDialog = ({ comment, onClose, memberAreaId }: { comment: Comment, onClose: () => void, memberAreaId: string }) => {
  const { toast } = useToast();
  const { user: adminUser } = useAuth();

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('lesson_comments')
        .delete()
        .eq('id', commentId);
      
      if (error) throw error;
      toast({ title: "Sucesso", description: "Comentário excluído." });
      onClose();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Falha ao excluir comentário.", variant: "destructive" });
      console.error(error);
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <MessageCircle className="h-5 w-5" /> Detalhes do Comentário
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={comment.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${comment.profiles?.name}`} />
                <AvatarFallback>{comment.profiles?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-base">{comment.profiles?.name || 'Membro'}</p>
                <p className="text-sm text-muted-foreground">
                  Em {new Date(comment.created_at).toLocaleDateString()}
                  {comment.lessons?.title && ` na aula "${comment.lessons.title}"`}
                  {comment.lessons?.modules?.title && ` do módulo "${comment.lessons.modules.title}"`}
                </p>
              </div>
            </div>
            <p className="text-base">{comment.content}</p>
          </CardContent>
        </Card>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full text-sm sm:text-base">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir Comentário
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-xs sm:max-w-md mx-2 sm:mx-4">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-sm sm:text-base">Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription className="text-xs sm:text-sm">
                Tem certeza que deseja excluir este comentário? Esta ação é irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="text-xs sm:text-sm">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDeleteComment(comment.id)} className="text-xs sm:text-sm">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <Button onClick={onClose} className="w-full mt-4 text-sm sm:text-base">Fechar</Button>
    </DialogContent>
  );
};

const AdminCommunity = ({ memberAreaId: propMemberAreaId }: { memberAreaId?: string }) => {
  const { user, loading: authLoading } = useAuth();
  const { memberAreaId: urlMemberAreaId } = useParams<{ memberAreaId: string }>();
  const currentMemberAreaId = propMemberAreaId || urlMemberAreaId;

  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(true); // Renamed from loadingPage for clarity
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [isCommentDetailsDialogOpen, setIsCommentDetailsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('ADMIN_COMMUNITY_DEBUG: useEffect triggered. user:', user?.id, 'authLoading:', authLoading, 'currentMemberAreaId:', currentMemberAreaId);
    // Não esperar por authLoading aqui, o redirecionamento será tratado abaixo
    if (user && currentMemberAreaId) { 
      fetchComments();
    } else if (!user) {
      console.log('ADMIN_COMMUNITY_DEBUG: Not authenticated, redirecting.');
    } else if (!currentMemberAreaId) {
      setLoadingCommunity(false); // If no memberAreaId, stop loading and show message
    }
  }, [user, currentMemberAreaId]); 

  const fetchComments = async () => {
    console.log('ADMIN_COMMUNITY_DEBUG: fetchComments started for ID:', currentMemberAreaId);
    try {
      setLoadingCommunity(true); 
      
      // Fetch modules to get module_ids for filtering lessons and comments
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('id')
        .eq('member_area_id', currentMemberAreaId);

      if (modulesError) throw modulesError;
      const moduleIds = modulesData.map(m => m.id);
      console.log('ADMIN_COMMUNITY_DEBUG: Derived moduleIds:', moduleIds);

      let lessonIds: string[] = [];
      if (moduleIds.length > 0) { // Only fetch lessons if there are modules
        const { data: lessonIdsData, error: lessonIdsError } = await supabase
          .from('lessons')
          .select('id')
          .in('module_id', moduleIds);

        if (lessonIdsError) throw lessonIdsError;
        lessonIds = lessonIdsData.map(l => l.id);
      }
      console.log('ADMIN_COMMUNITY_DEBUG: Derived lessonIds:', lessonIds);

      if (lessonIds.length === 0) {
        setComments([]);
        setLoadingCommunity(false); // No lessons, so no comments to load
        console.log('ADMIN_COMMUNITY_DEBUG: No lessons found, setting comments to empty and setLoadingCommunity(false).');
        return;
      }

      const { data, error } = await supabase
        .from('lesson_comments')
        .select(`
          *,
          profiles(name, avatar_url),
          lessons(title, modules(title, member_area_id))
        `)
        .in('lesson_id', lessonIds)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setComments(data as Comment[] || []);
      console.log('ADMIN_COMMUNITY_DEBUG: fetchComments completed successfully.');
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Falha ao carregar comentários da comunidade.", variant: "destructive" });
      console.error('ADMIN_COMMUNITY_DEBUG: Erro ao carregar comentários:', error);
    } finally {
      setLoadingCommunity(false); 
      console.log('ADMIN_COMMUNITY_DEBUG: setLoadingCommunity(false) called.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('lesson_comments')
        .delete()
        .eq('id', commentId);
      
      if (error) throw error;
      toast({ title: "Sucesso", description: `Comentário excluído.` });
      fetchComments();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Falha ao excluir comentário.", variant: "destructive" });
      console.error(error);
    }
  };

  const handleViewComment = (comment: Comment) => {
    setSelectedComment(comment);
    setIsCommentDetailsDialogOpen(true);
  };

  const handleCommentDetailsDialogClose = () => {
    setIsCommentDetailsDialogOpen(false);
    setSelectedComment(null);
    fetchComments();
  };

  if (!user) {
    console.log('ADMIN_COMMUNITY_DEBUG: Redirecting to login because no user.');
    return <Navigate to="/auth/login" replace />;
  }

  if (loadingCommunity) { 
    return <div className="flex items-center justify-center min-h-screen">Carregando comunidade...</div>;
  }

  if (!currentMemberAreaId) {
    console.log('ADMIN_COMMUNITY_DEBUG: No memberAreaId, showing message.');
    return <p>Nenhuma área de membros selecionada.</p>;
  }

  return (
    <div className="p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Comentários da Comunidade ({comments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">Nenhum comentário na comunidade</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Comentários feitos nas aulas aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map(comment => (
                <div key={comment.id} className="p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                        <AvatarImage src={comment.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${comment.profiles?.name}`} />
                        <AvatarFallback>{comment.profiles?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <h3 className="font-semibold text-sm sm:text-base">{comment.profiles?.name || 'Membro'}</h3>
                    </div>
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                      <Button variant="outline" size="sm" onClick={() => handleViewComment(comment)} className="text-xs sm:text-sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="text-xs sm:text-sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-xs sm:max-w-md mx-2 sm:mx-4">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-sm sm:text-base">Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs sm:text-sm">
                              Tem certeza que deseja excluir este comentário? Esta ação é irreversível.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel className="text-xs sm:text-sm">Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteComment(comment.id)} className="text-xs sm:text-sm">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{comment.content}</p>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground mt-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}</span>
                    </div>
                    {comment.lessons?.title && (
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        <span>Aula: {comment.lessons.title}</span>
                      </div>
                    )}
                    {comment.lessons?.modules?.title && (
                      <div className="flex items-center gap-1">
                        <MessageSquarePlus className="h-3 w-3" />
                        <span>Módulo: {comment.lessons.modules.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedComment && (
        <Dialog open={isCommentDetailsDialogOpen} onOpenChange={setIsCommentDetailsDialogOpen}>
          <CommentDetailsDialog comment={selectedComment} onClose={handleCommentDetailsDialogClose} memberAreaId={currentMemberAreaId} />
        </Dialog>
      )}
    </div>
  );
};

export default AdminCommunity;