 
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useParams, Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, BookOpen, Video, MonitorDot, Edit, Trash2, FileText, Image as ImageIcon, ChevronDown, ChevronUp, Package, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ModulesList } from '@/components/member-area/ModulesList'; // Import ModulesList
import { LessonFormDialog } from '@/components/member-area/LessonFormDialog'; // Import LessonFormDialog
import { LessonsList } from '@/components/member-area/LessonsList'; // Import LessonsList


type MemberArea = Tables<'member_areas'>;
type Module = Tables<'modules'> & { products?: Pick<Tables<'products'>, 'name'> | null };
type Lesson = Tables<'lessons'>;
type Product = Tables<'products'>;

const uploadFile = async (file: File, subfolder: string) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `lesson-content/${subfolder}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('member-area-content')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('member-area-content')
    .getPublicUrl(filePath);

  return data.publicUrl;
};

const ModuleFormDialog = ({ 
  module: editingModule, 
  onSave, 
  memberAreas, 
  selectedMemberAreaId,
  onClose,
  products
}: { 
  module?: Module, 
  onSave: () => void, 
  memberAreas: MemberArea[], 
  selectedMemberAreaId: string | null,
  onClose: () => void,
  products: Product[]
}) => {
  const [title, setTitle] = useState(editingModule?.title || '');
  const [description, setDescription] = useState(editingModule?.description || '');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerUrl, setBannerUrl] = useState(editingModule?.banner_url || '');
  const [status, setStatus] = useState(editingModule?.status === 'published');
  const [currentMemberAreaId, setCurrentMemberAreaId] = useState(editingModule?.member_area_id || selectedMemberAreaId || '');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(editingModule?.product_id || null);
  const [checkoutLink, setCheckoutLink] = useState<string>(editingModule?.checkout_link || '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (editingModule) {
      setTitle(editingModule.title);
      setDescription(editingModule.description || '');
      setBannerUrl(editingModule.banner_url || '');
      setStatus(editingModule.status === 'published');
      setCurrentMemberAreaId(editingModule.member_area_id || '');
      setSelectedProductId(editingModule.product_id || null);
      setCheckoutLink(editingModule.checkout_link || '');
    } else {
      setTitle('');
      setDescription('');
      setBannerFile(null);
      setBannerUrl('');
      setStatus(false);
      setCurrentMemberAreaId(selectedMemberAreaId || '');
      setSelectedProductId(null);
      setCheckoutLink('');
    }
  }, [editingModule, selectedMemberAreaId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBannerFile(e.target.files[0]);
    }
  };

  const handleSave = async () => {
    if (!user?.id || !currentMemberAreaId) {
      toast({ title: "Erro", description: "Selecione uma área de membros e faça login.", variant: "destructive" });
      return;
    }
    if (!title) {
      toast({ title: "Erro", description: "O título do módulo é obrigatório.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let finalBannerUrl = bannerUrl;
      if (bannerFile) {
        finalBannerUrl = await uploadFile(bannerFile, 'module-banners');
      }

      const payload: TablesInsert<'modules'> = {
        user_id: user.id,
        member_area_id: currentMemberAreaId,
        title,
        description,
        banner_url: finalBannerUrl,
        status: status ? 'published' : 'draft',
        order_index: editingModule?.order_index || 0,
        product_id: selectedProductId,
        checkout_link: checkoutLink.trim() || null,
      };

      if (editingModule) {
        const { error } = await supabase
          .from('modules')
          .update(payload as TablesUpdate<'modules'>)
          .eq('id', editingModule.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Módulo atualizado!" });
      } else {
        const { error } = await supabase
          .from('modules')
          .insert(payload);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Módulo criado!" });
      }
      onSave();
      onClose();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Falha ao salvar módulo.", variant: "destructive" });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle className="text-lg sm:text-xl">{editingModule ? 'Editar Módulo' : 'Criar Novo Módulo'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="moduleMemberArea">Área de Membros</Label>
          <Select 
            value={currentMemberAreaId} 
            onValueChange={setCurrentMemberAreaId}
            disabled={!!editingModule}
          >
            <SelectTrigger id="moduleMemberArea">
              <SelectValue placeholder="Selecione uma área de membros" />
            </SelectTrigger>
            <SelectContent>
              {memberAreas.map(area => (
                <SelectItem key={area.id} value={area.id}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="moduleTitle">Título *</Label>
          <Input id="moduleTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do Módulo" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="moduleDescription">Descrição</Label>
          <Textarea id="moduleDescription" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do Módulo" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="moduleBanner">Banner</Label>
          <Input id="moduleBanner" type="file" accept="image/*" onChange={handleFileChange} />
          {bannerFile && <p className="text-sm text-muted-foreground">Arquivo selecionado: {bannerFile.name}</p>}
          {bannerUrl && !bannerFile && (
            <div className="mt-2">
              <img src={bannerUrl} alt="Banner atual" className="h-16 w-auto object-contain" />
              <Button variant="ghost" size="sm" onClick={() => setBannerUrl('')} className="text-destructive">Remover Banner</Button>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="associatedProduct">Produto Associado (Opcional)</Label>
          <Select 
            value={selectedProductId || "none"} 
            onValueChange={value => setSelectedProductId(value === "none" ? null : value)}
          >
            <SelectTrigger id="associatedProduct">
              <SelectValue placeholder="Associar a um produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {products.map(product => (
                <SelectItem key={product.id} value={product.id}>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {product.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkoutLink">Link de Checkout Direto (Opcional)</Label>
          <Input 
            id="checkoutLink" 
            type="url" 
            value={checkoutLink} 
            onChange={(e) => setCheckoutLink(e.target.value)} 
            placeholder="https://seucheckout.com/link-direto" 
          />
          <p className="text-xs text-muted-foreground">
            Se preenchido, este link será usado para o botão "Comprar Acesso" em vez do produto associado.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="moduleStatus">Publicado</Label>
          <Switch id="moduleStatus" checked={status} onCheckedChange={setStatus} />
        </div>
        <Button className="w-full" onClick={handleSave} disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar Módulo'}
        </Button>
      </div>
    </DialogContent>
  );
};

const AdminContent = ({ memberAreaId: propMemberAreaId }: { memberAreaId?: string }) => {
  const { user, loading: authLoading } = useAuth();
  const { memberAreaId: urlMemberAreaId } = useParams<{ memberAreaId: string }>();
  const currentMemberAreaId = propMemberAreaId || urlMemberAreaId;

  const [memberAreas, setMemberAreas] = useState<MemberArea[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(true); // New state for page-level loading
  
  const [isModuleFormOpen, setIsModuleFormOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | undefined>(undefined);

  const [isLessonFormOpen, setIsLessonFormOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | undefined>(undefined);
  const { toast } = useToast(); // Call useToast hook here

  useEffect(() => {
    console.log('ADMIN_CONTENT_DEBUG: Parent useEffect triggered. user:', user?.id, 'authLoading:', authLoading, 'currentMemberAreaId:', currentMemberAreaId);
    if (!authLoading) { // Wait for auth to settle
      if (user && currentMemberAreaId) { 
        const loadAllData = async () => {
          setLoadingContent(true);
          await Promise.all([
            fetchMemberAreas(),
            fetchProducts(),
            fetchModulesForSelector()
          ]);
          setLoadingContent(false);
          console.log('ADMIN_CONTENT_DEBUG: All initial data loaded, setLoadingContent(false).');
        };
        loadAllData();
      } else if (!user) {
        console.log('ADMIN_CONTENT_DEBUG: Not authenticated, redirecting.');
      } else if (!currentMemberAreaId) {
        setLoadingContent(false); // If no memberAreaId, stop loading and show message
      }
    }
  }, [user, authLoading, currentMemberAreaId, toast]); // Add toast to dependencies

  const fetchMemberAreas = async () => {
    console.log('ADMIN_CONTENT_DEBUG: fetchMemberAreas started.');
    if (!user?.id) {
      console.log('ADMIN_CONTENT_DEBUG: fetchMemberAreas skipped, no user ID.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('member_areas')
        .select('id, name, slug')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
    
      if (error) throw error;
      setMemberAreas(data as MemberArea[] || []);
      console.log('ADMIN_CONTENT_DEBUG: fetchMemberAreas completed successfully.');
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Falha ao carregar áreas de membros.", variant: "destructive" });
      console.error('ADMIN_CONTENT_DEBUG: Erro ao carregar áreas de membros:', error);
    }
  };

  const fetchProducts = async () => {
    console.log('ADMIN_CONTENT_DEBUG: fetchProducts started.');
    if (!user?.id) {
      console.log('ADMIN_CONTENT_DEBUG: fetchProducts skipped, no user ID.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
    
      if (error) throw error;
      setProducts(data as Product[] || []);
      console.log('ADMIN_CONTENT_DEBUG: fetchProducts completed successfully.');
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Falha ao carregar produtos.", variant: "destructive" });
      console.error('ADMIN_CONTENT_DEBUG: Erro ao carregar produtos:', error);
    }
  };

  const fetchModulesForSelector = useCallback(async () => {
    console.log('ADMIN_CONTENT_DEBUG: fetchModulesForSelector started for memberAreaId:', currentMemberAreaId);
    if (!user?.id || !currentMemberAreaId) {
      setModules([]);
      setCurrentModuleId(null);
      console.log('ADMIN_CONTENT_DEBUG: fetchModulesForSelector skipped, missing user ID or memberAreaId.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('id, title')
        .eq('user_id', user.id)
        .eq('member_area_id', currentMemberAreaId)
        .order('title', { ascending: true });
    
      if (error) throw error;
      setModules(data as Module[] || []);
      if (data && data.length > 0 && !currentModuleId) {
        setCurrentModuleId(data[0].id);
      } else if (data && data.length > 0 && currentModuleId && !data.some(m => m.id === currentModuleId)) {
        setCurrentModuleId(data[0].id);
      } else if (data && data.length === 0) {
        setCurrentModuleId(null);
      }
      console.log('ADMIN_CONTENT_DEBUG: fetchModulesForSelector completed successfully.');
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Falha ao carregar módulos para seleção.", variant: "destructive" });
      console.error('ADMIN_CONTENT_DEBUG: Erro ao carregar módulos para seleção:', error);
    }
  }, [user?.id, currentMemberAreaId, currentModuleId, toast]);

  useEffect(() => {
    if (user && currentMemberAreaId) { 
      fetchModulesForSelector();
    }
  }, [user, currentMemberAreaId, fetchModulesForSelector]); 

  const handleModuleSaved = () => {
    fetchModulesForSelector();
    fetchProducts();
  };

  const handleLessonSaved = () => {
    if (currentModuleId) {
      // LessonsList component's useEffect will re-fetch
    }
  };

  const handleEditModule = (module: Module) => {
    setEditingModule(module);
    setIsModuleFormOpen(true);
  };

  const handleEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setIsLessonFormOpen(true);
  };

  if (authLoading) { 
    return <div className="flex items-center justify-center min-h-screen">Carregando autenticação...</div>;
  }

  if (!user) {
    console.log('ADMIN_CONTENT_DEBUG: Redirecting to login because no user.');
    return <Navigate to="/auth/login" replace />;
  }

  if (loadingContent) { 
    return <div className="flex items-center justify-center min-h-screen">Carregando conteúdo...</div>;
  }

  if (!currentMemberAreaId) {
    console.log('ADMIN_CONTENT_DEBUG: No memberAreaId, showing message.');
    return <p>Nenhuma área de membros selecionada.</p>;
  }

  return (
    <div className="p-4 sm:p-6">
      <Tabs defaultValue="modules">
        <TabsList className="grid w-full grid-cols-2 h-auto p-1">
          <TabsTrigger value="modules" className="text-xs sm:text-sm py-2">
            <BookOpen className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Módulos
          </TabsTrigger>
          <TabsTrigger value="lessons" className="text-xs sm:text-sm py-2">
            <Video className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Aulas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="mt-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <CardTitle className="text-lg sm:text-xl">Módulos</CardTitle>
              <Dialog open={isModuleFormOpen} onOpenChange={setIsModuleFormOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => setEditingModule(undefined)} className="w-full sm:w-auto text-sm">
                    <Plus className="mr-2 h-4 w-4" /> Novo Módulo
                  </Button>
                </DialogTrigger>
                <ModuleFormDialog 
                  module={editingModule} 
                  onSave={handleModuleSaved} 
                  memberAreas={memberAreas} 
                  selectedMemberAreaId={currentMemberAreaId}
                  onClose={() => setIsModuleFormOpen(false)}
                  products={products}
                />
              </Dialog>
            </CardHeader>
            <CardContent>
              <ModulesList 
                memberAreaId={currentMemberAreaId} 
                onEditModule={handleEditModule} 
                onModuleDeleted={handleModuleSaved} 
                products={products}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lessons" className="mt-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <CardTitle className="text-lg sm:text-xl">Aulas</CardTitle>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                <Select value={currentModuleId || "none"} onValueChange={value => setCurrentModuleId(value === "none" ? null : value)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Selecionar Módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.length === 0 ? (
                      <SelectItem value="none" disabled>Nenhum módulo disponível</SelectItem>
                    ) : (
                      modules.map(module => (
                        <SelectItem key={module.id} value={module.id}>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            {module.title}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Dialog open={isLessonFormOpen} onOpenChange={setIsLessonFormOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={!currentModuleId} onClick={() => setEditingLesson(undefined)} className="w-full sm:w-auto text-sm">
                      <Plus className="mr-2 h-4 w-4" /> Nova Aula
                    </Button>
                  </DialogTrigger>
                  <LessonFormDialog 
                    lesson={editingLesson}
                    onSave={handleLessonSaved} 
                    modules={modules} 
                    selectedModuleId={currentModuleId}
                    onClose={() => setIsLessonFormOpen(false)}
                  />
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {currentModuleId ? (
                <LessonsList 
                  moduleId={currentModuleId} 
                  onEditLesson={handleEditLesson} 
                  onLessonDeleted={handleLessonSaved} 
                />
              ) : (
                <p className="text-muted-foreground text-sm">Selecione um módulo para ver as aulas.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminContent;