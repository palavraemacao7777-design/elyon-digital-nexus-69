import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, MonitorDot, Trash2, Edit, Link as LinkIcon, Image, Palette, BookOpen, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { generateSlug } from '@/utils/textFormatting';

type MemberArea = Tables<'member_areas'>;

const AdminMemberAreas = () => {
  const { user, loading: authLoading } = useAuth(); // Removido isAdmin
  const [memberAreas, setMemberAreas] = useState<MemberArea[]>([]);
  const [loadingMemberAreas, setLoadingMemberAreas] = useState(true); // Renamed from loadingPage for clarity
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSavingDialog, setIsSavingDialog] = useState(false); // Renamed from isSaving for clarity
  const [showPassword, setShowPassword] = useState(false); // Novo estado para visibilidade de senha
  const [editingArea, setEditingArea] = useState<MemberArea | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    logo_url: '',
    primary_color: '#3b82f6',
    logoFile: null as File | null,
    passwordMode: 'fixed' as 'random' | 'fixed' | 'force_change',
    fixedPassword: '',
  });
  const [lastSavedAreaId, setLastSavedAreaId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    console.log('ADMIN_MEMBER_AREAS_DEBUG: useEffect triggered. user:', user?.id, 'authLoading:', authLoading); // Removido isAdmin do log
    // Não esperar por authLoading aqui, o redirecionamento será tratado abaixo
    if (user) { // Qualquer usuário logado pode acessar
      fetchMemberAreas();
    } else if (!user) {
      console.log('ADMIN_MEMBER_AREAS_DEBUG: Not authenticated, redirecting.');
    }
  }, [user]); // Removido isAdmin das dependências

  const fetchMemberAreas = async () => {
    console.log('ADMIN_MEMBER_AREAS_DEBUG: fetchMemberAreas started.');
    try {
      setLoadingMemberAreas(true); // Use loadingMemberAreas
      const { data, error } = await supabase
        .from('member_areas')
        .select('*')
        .eq('user_id', user?.id || '');
    
      if (error) throw error;
      setMemberAreas(data as MemberArea[] || []);
      console.log('ADMIN_MEMBER_AREAS_DEBUG: fetchMemberAreas completed successfully.');
    } catch (error: any) {
      console.error('ADMIN_MEMBER_AREAS_DEBUG: Falha ao carregar áreas de membros:', error);
      toast({ title: "Erro", description: error.message || "Falha ao carregar áreas de membros.", variant: "destructive" });
    } finally {
      setLoadingMemberAreas(false); // Use loadingMemberAreas
      console.log('ADMIN_MEMBER_AREAS_DEBUG: setLoadingMemberAreas(false) called.');
    }
  };

  const fetchMemberSettingsForId = async (areaIdToFetch?: string | null) => {
    const idToUse = areaIdToFetch || editingArea?.id || lastSavedAreaId;
    if (!idToUse) {
      toast({ title: 'Aviso', description: 'Nenhuma área selecionada para verificar.', variant: 'warning' });
      return;
    }

    if (!user) {
      toast({ title: 'Erro', description: 'Usuário não autenticado. Refaça login e tente novamente.', variant: 'destructive' });
      console.error('ADMIN_MEMBER_AREAS_DEBUG: fetchMemberSettingsForId called without authenticated user.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('member_settings')
        .select('*')
        .eq('member_area_id', idToUse)
        .maybeSingle();

      console.log('ADMIN_MEMBER_AREAS_DEBUG: Manual fetch member_settings:', { idToUse, data, error });

      if (error) {
        // Exibir mensagens mais detalhadas para facilitar depuração
        const msg = error?.message || JSON.stringify(error);
        console.error('ADMIN_MEMBER_AREAS_DEBUG: Error fetching member_settings:', error);
        toast({ title: 'Erro', description: `Falha ao buscar member_settings: ${msg}. Veja console.`, variant: 'destructive' });
        return;
      }

      if (!data) {
        toast({ title: 'Info', description: 'Nenhuma configuração encontrada para esta área.' });
        return;
      }

      // Carregar a senha fixa no formulário para que apareça ao retornar à edição
      setFormData(prev => ({ ...prev, fixedPassword: data.default_fixed_password || '' }));
      setShowPassword(false);

      toast({ title: 'Configuração encontrada', description: `Senha fixa ${data.default_fixed_password ? 'carregada no formulário' : 'não definida'}` });
      console.log('ADMIN_MEMBER_AREAS_DEBUG: member_settings full object:', data);
    } catch (err: any) {
      console.error('ADMIN_MEMBER_AREAS_DEBUG: Exception fetching member_settings manually:', err);
      toast({ title: 'Erro', description: `Exceção ao buscar member_settings: ${err?.message || err}. Veja console.`, variant: 'destructive' });
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'name' && !editingArea) {
      setFormData(prev => ({ ...prev, slug: generateSlug(value) }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, logoFile: e.target.files![0] }));
    }
  };

  const uploadFile = async (file: File, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('member-area-content')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('member-area-content')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name || !formData.slug) {
      toast({ title: "Erro", description: "Nome e Slug são obrigatórios.", variant: "destructive" });
      setIsSavingDialog(false);
      return;
    }

    // Validar senha fixa se modo for fixed
    if (formData.passwordMode === 'fixed' && !formData.fixedPassword.trim()) {
      toast({ title: "Erro", description: "Insira uma senha fixa quando o modo for 'Senha Fixa'.", variant: "destructive" });
      setIsSavingDialog(false);
      return;
    }

    setIsSavingDialog(true); // Use isSavingDialog
    try {
      let logoUrl = formData.logo_url;
      if (formData.logoFile) {
        logoUrl = await uploadFile(formData.logoFile, 'member-area-logos');
      }

      const payload: TablesInsert<'member_areas'> = {
        user_id: user.id,
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        logo_url: logoUrl,
        primary_color: formData.primary_color,
      };

      let areaId: string;
      
      if (editingArea) {
        const { error } = await supabase
          .from('member_areas')
          .update(payload as TablesUpdate<'member_areas'>)
          .eq('id', editingArea.id);
        if (error) throw error;
        areaId = editingArea.id;
        toast({ title: "Sucesso", description: "Área de membros atualizada!" });
      } else {
        const { data, error } = await supabase
          .from('member_areas')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        areaId = data.id;
        toast({ title: "Sucesso", description: "Área de membros criada!" });
      }
      
      // Salvar ou atualizar configurações de senha
      if (formData.passwordMode) {
        const settingsPayload = {
          member_area_id: areaId,
          default_password_mode: formData.passwordMode,
          default_fixed_password: formData.passwordMode === 'fixed' ? formData.fixedPassword : null,
        };
        
        console.log('ADMIN_MEMBER_AREAS_DEBUG: Saving password settings:', settingsPayload);
        
        const { data: settingsData, error: settingsError } = await supabase
          .from('member_settings')
          .upsert(settingsPayload, { onConflict: 'member_area_id' })
          .select();
        
        console.log('ADMIN_MEMBER_AREAS_DEBUG: Settings save result:', { data: settingsData, error: settingsError });

        if (settingsError) {
          console.error('ADMIN_MEMBER_AREAS_DEBUG: Error saving password settings:', settingsError);
          toast({ title: "Aviso", description: "Área salva, mas houve erro ao salvar configurações de senha." });
        } else {
          console.log('ADMIN_MEMBER_AREAS_DEBUG: Password settings saved successfully');
          // Verificação adicional: buscar registro salvo para confirmar persistência
          try {
            const { data: verifyData, error: verifyError } = await supabase
              .from('member_settings')
              .select('*')
              .eq('member_area_id', areaId)
              .maybeSingle();
            console.log('ADMIN_MEMBER_AREAS_DEBUG: Verify saved member_settings:', { verifyData, verifyError });
            if (verifyError) {
              console.error('ADMIN_MEMBER_AREAS_DEBUG: Error verifying saved settings:', verifyError);
            }
            // armazenar id do último salvo para facilitar verificação via UI
            setLastSavedAreaId(areaId);
          } catch (err) {
            console.error('ADMIN_MEMBER_AREAS_DEBUG: Exception verifying saved settings:', err);
          }

          toast({ title: "Sucesso", description: "Configurações de senha salvas!" });
        }
      }

      setIsDialogOpen(false);
      setShowPassword(false);
      setEditingArea(null);
      setFormData({
        name: '', slug: '', description: '', logo_url: '', primary_color: '#3b82f6', logoFile: null, passwordMode: 'fixed', fixedPassword: ''
      });
      fetchMemberAreas();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Falha ao salvar área de membros.", variant: "destructive" });
      console.error(error);
    } finally {
      setIsSavingDialog(false); // Use isSavingDialog
    }
  };

  const handleDelete = async (areaId: string, areaName: string) => {
    setIsSavingDialog(true); // Use isSavingDialog
    try {
      const { error } = await supabase
        .from('member_areas')
        .delete()
        .eq('id', areaId);
      if (error) throw error;
      toast({ title: "Sucesso", description: `Área de membros "${areaName}" excluída.` });
      fetchMemberAreas();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Falha ao excluir área de membros.", variant: "destructive" });
      console.error(error);
    } finally {
      setIsSavingDialog(false); // Use isSavingDialog
    }
  };

  const handleEdit = async (area: MemberArea) => {
    console.log('ADMIN_MEMBER_AREAS_DEBUG: handleEdit started for area:', area.id);
    setEditingArea(area);
    
    // Primeiro, setar formData com dados da area
    const baseFormData = {
      name: area.name,
      slug: area.slug,
      description: area.description || '',
      logo_url: area.logo_url || '',
      primary_color: area.primary_color || '#3b82f6',
      logoFile: null,
      passwordMode: 'fixed' as 'random' | 'fixed' | 'force_change',
      fixedPassword: '',
    };
    
    // Carregar configurações de senha
    try {
      console.log('ADMIN_MEMBER_AREAS_DEBUG: Fetching member_settings for area:', area.id);
      const { data, error } = await supabase
        .from('member_settings')
        .select('*')
        .eq('member_area_id', area.id)
        .maybeSingle();
      
      console.log('ADMIN_MEMBER_AREAS_DEBUG: member_settings query result:', { data, error });
      
      if (error) {
        console.error('ADMIN_MEMBER_AREAS_DEBUG: Error fetching member_settings:', error);
        // Continue mesmo com erro
      }
      
      if (data) {
        console.log('ADMIN_MEMBER_AREAS_DEBUG: Found member_settings:', data);
        baseFormData.passwordMode = (data.default_password_mode as 'random' | 'fixed' | 'force_change') || 'random';
        baseFormData.fixedPassword = data.default_fixed_password || '';
        console.log('ADMIN_MEMBER_AREAS_DEBUG: Updated passwordMode to:', baseFormData.passwordMode);
      } else {
        console.log('ADMIN_MEMBER_AREAS_DEBUG: No member_settings found, using defaults');
      }
    } catch (error) {
      console.error('ADMIN_MEMBER_AREAS_DEBUG: Exception in handleEdit password loading:', error);
    }
    
    console.log('ADMIN_MEMBER_AREAS_DEBUG: Setting formData with:', baseFormData);
    setFormData(baseFormData);
    setShowPassword(false); // Reset visibilidade de senha ao abrir
    setIsDialogOpen(true);
  };

  // Removido: if (authLoading) { ... }

  if (!user) {
    console.log('ADMIN_MEMBER_AREAS_DEBUG: Redirecting to login because no user.');
    return <Navigate to="/auth/login" replace />;
  }

  // REMOVIDO: if (!isAdmin) { ... }

  if (loadingMemberAreas) { // Show loading for member areas only after auth is done
    return <div className="flex items-center justify-center min-h-screen">Carregando áreas de membros...</div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Minhas Áreas de Membros</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Crie e gerencie suas áreas de membros personalizadas
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingArea(null);
            setFormData({ name: '', slug: '', description: '', logo_url: '', primary_color: '#3b82f6', logoFile: null, passwordMode: 'fixed', fixedPassword: '' });
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingArea(null);
              setFormData({ name: '', slug: '', description: '', logo_url: '', primary_color: '#3b82f6', logoFile: null, passwordMode: 'fixed', fixedPassword: '' });
            }} className="w-full sm:w-auto text-sm sm:text-base">
              <Plus className="mr-2 h-4 w-4" /> Nova Área de Membros
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">{editingArea ? 'Editar Área de Membros' : 'Criar Nova Área de Membros'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Área *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ex: Meu Curso de Fotografia"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL) *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleInputChange('slug', e.target.value)}
                  placeholder="ex-meu-curso-de-fotografia"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Será usado na URL de acesso (ex: `seusite.com/membros/`**`seu-slug`**)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Uma breve descrição da sua área de membros."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo">Logo da Área de Membros</Label>
                <Input id="logo" type="file" accept="image/*" onChange={handleFileChange} />
                {formData.logoFile && <p className="text-sm text-muted-foreground">Arquivo selecionado: {formData.logoFile.name}</p>}
                {formData.logo_url && !formData.logoFile && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={formData.logo_url} alt="Logo atual" className="h-10 w-10 object-contain" />
                    <Button variant="ghost" size="sm" onClick={() => handleInputChange('logo_url', null)} className="text-destructive">Remover Logo</Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Cor Principal</Label>
                <div className="flex gap-2">
                  <Input type="color" value={formData.primary_color} onChange={(e) => handleInputChange('primary_color', e.target.value)} className="w-16 h-10 p-1 border rounded cursor-pointer" />
                  <Input type="text" value={formData.primary_color} onChange={(e) => handleInputChange('primary_color', e.target.value)} placeholder="#3b82f6" className="flex-1" />
                </div>
              </div>
              <div className="space-y-2 border-t pt-4">
                <Label>Configurações de Membros</Label>
                <div className="space-y-2">
                  <Label htmlFor="fixedPassword" className="text-sm">Senha Padrão</Label>
                  <p className="text-xs text-muted-foreground mb-2">🔐 Todos os membros usarão a mesma senha</p>
                  <div className="relative">
                    <Input
                      id="fixedPassword"
                      type={showPassword ? "text" : "password"}
                      value={formData.fixedPassword}
                      onChange={(e) => handleInputChange('fixedPassword', e.target.value)}
                      placeholder="Digite a senha que todos os membros usarão"
                      required={true}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    </div>
                    <p className="text-xs text-yellow-600 dark:text-yellow-500">⚠️ Esta senha será usada por todos os membros. Use uma senha forte.</p>
                  </div>
                </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                <Button type="button" variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  setShowPassword(false);
                }} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="button" variant="secondary" onClick={() => fetchMemberSettingsForId()} className="w-full sm:w-auto">
                  Verificar Configuração
                </Button>
                <Button type="submit" disabled={isSavingDialog} className="w-full sm:w-auto">
                  {isSavingDialog ? 'Salvando...' : 'Salvar Área'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Suas Áreas de Membros ({memberAreas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {memberAreas.length === 0 ? (
            <div className="text-center py-8">
              <MonitorDot className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">Nenhuma área de membros criada</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Comece criando sua primeira área de membros personalizada.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {memberAreas.map(area => (
                <div key={area.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors gap-3 sm:gap-0">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    {area.logo_url ? (
                      <img src={area.logo_url} alt={area.name} className="h-8 w-8 sm:h-10 sm:w-10 object-contain rounded-md" />
                    ) : (
                      <div className="h-8 w-8 sm:h-10 sm:w-10 bg-muted rounded-md flex items-center justify-center">
                        <MonitorDot className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm sm:text-base">{area.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Slug: {area.slug}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Palette className="h-3 w-3" style={{ color: area.primary_color || '#3b82f6' }} />
                        Cor Principal: {area.primary_color}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(area)} className="text-xs sm:text-sm">
                      <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                    <Button variant="outline" size="sm" asChild className="text-xs sm:text-sm">
                      <Link to={`/admin/member-areas/${area.id}/content`}>
                        <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="text-xs sm:text-sm">
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-xs sm:max-w-md mx-2 sm:mx-4">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-sm sm:text-base">Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs sm:text-sm">
                            Tem certeza que deseja excluir a área de membros <strong>"{area.name}"</strong>?
                            Esta ação é irreversível e todos os conteúdos e membros associados serão afetados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                          <AlertDialogCancel className="text-xs sm:text-sm">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(area.id, area.name)} className="text-xs sm:text-sm">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMemberAreas;