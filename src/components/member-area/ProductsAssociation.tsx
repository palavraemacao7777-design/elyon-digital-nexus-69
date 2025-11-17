import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Package, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Product = Tables<'products'>;
type MemberArea = Tables<'member_areas'>;

interface ProductsAssociationProps {
  memberAreaId: string;
}

const ProductsAssociation: React.FC<ProductsAssociationProps> = ({ memberAreaId }) => {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [memberArea, setMemberArea] = useState<MemberArea | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAssociate, setShowAssociate] = useState(false);
  const [productToAssociate, setProductToAssociate] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) { // Ensure user is loaded and authenticated
      fetchData();
    } else if (!authLoading && !user) {
      setLoading(false); // Stop loading if no user
    }
  }, [memberAreaId, user, authLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar área de membros
      const { data: areaData, error: areaError } = await supabase
        .from('member_areas')
        .select('*')
        .eq('id', memberAreaId)
        .single();

      if (areaError) throw areaError;
      setMemberArea(areaData);
      setSelectedProducts(areaData.associated_products || []);

      // Buscar todos os produtos do usuário logado
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id) // Filter by current user's ID
        .order('name');

      if (productsError) throw productsError;
      setProducts(productsData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('member_areas')
        .update({ associated_products: selectedProducts })
        .eq('id', memberAreaId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Produtos associados atualizados com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao salvar produtos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as alterações",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Produtos não associados
  const unassociatedProducts = products.filter(p => !selectedProducts.includes(p.id));

  const handleAssociateProduct = () => {
    if (productToAssociate) {
      setSelectedProducts(prev => [...prev, productToAssociate]);
      setProductToAssociate(null);
      setShowAssociate(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <p className="text-muted-foreground text-sm sm:text-base">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return <p className="text-muted-foreground text-sm">Você precisa estar logado para gerenciar produtos associados.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Package className="h-5 w-5" />
          Produtos Associados
        </CardTitle>
        <CardDescription className="text-sm sm:text-base mt-2">
          Selecione quais produtos darão acesso a esta área de membros quando forem comprados
        </CardDescription>
        <div className="mt-4 mb-2">
          {!showAssociate && unassociatedProducts.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setShowAssociate(true)}>
              Associar Produto Existente
            </Button>
          )}
          {showAssociate && (
            <div className="flex gap-2 items-center mt-2">
              <Select value={productToAssociate || ''} onValueChange={setProductToAssociate}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {unassociatedProducts.map(prod => (
                    <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleAssociateProduct} disabled={!productToAssociate}>
                Associar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAssociate(false); setProductToAssociate(null); }}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.length === 0 ? (
          <p className="text-muted-foreground text-sm sm:text-base">
            Você ainda não criou nenhum produto. Crie produtos primeiro para associá-los a esta área.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {products.map(product => (
                <div
                  key={product.id}
                  className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    id={product.id}
                    checked={selectedProducts.includes(product.id)}
                    onCheckedChange={() => toggleProduct(product.id)}
                  />
                  <label
                    htmlFor={product.id}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-medium text-sm sm:text-base">{product.name}</div>
                  </label>
                </div>
              ))}
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full text-sm sm:text-base"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar Associações'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductsAssociation;