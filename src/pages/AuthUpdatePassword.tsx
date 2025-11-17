 
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { memberAreaSupabase } from '@/integrations/supabase/memberAreaClient';
import { supabase } from '@/integrations/supabase/client';
import { useGlobalPlatformSettings } from '@/hooks/useGlobalPlatformSettings'; // Importar o hook centralizado

const AuthUpdatePassword = () => {
  // Removido: const [searchParams] = useSearchParams();
  // Removido: const memberAreaId = searchParams.get('memberAreaId');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  
  // Usar o hook centralizado para configurações da plataforma
  const { settings, loadingSettings } = useGlobalPlatformSettings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const { error } = await memberAreaSupabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setPasswordUpdated(true);
      toast({
        title: "Sucesso!",
        description: "Sua senha foi atualizada com sucesso.",
      });
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao atualizar a senha.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentSettings = settings; // Usar as configurações do hook
  const resolvedMemberAreaId = currentSettings?.member_area_id;

  // Determinar o link de redirecionamento de forma mais robusta
  const redirectToLogin = () => {
    if (resolvedMemberAreaId && resolvedMemberAreaId !== 'default_member_area_id') {
      navigate(`/membros/${resolvedMemberAreaId}/login`);
    } else {
      // Se não houver um memberAreaId específico, redireciona para o login principal da administração
      navigate('/auth/login');
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ 
        backgroundColor: currentSettings.colors?.background_login || 'hsl(var(--member-area-background))',
        fontFamily: currentSettings.global_font_family || 'Nunito'
      }}
    >
      <Card className="w-full max-w-sm sm:max-w-md" style={{ backgroundColor: currentSettings.colors?.card_login || 'hsl(var(--member-area-card-background))' }}>
        <CardHeader className="text-center space-y-4">
          {currentSettings.logo_url && (
            <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center">
              <img 
                src={currentSettings.logo_url} 
                alt="Logo da Área de Membros" 
                className="w-20 h-20 object-contain animate-fade-in hover-scale"
              />
            </div>
          )}
          <div>
            <CardTitle className="text-2xl font-bold" style={{ color: currentSettings.colors?.text_primary || 'hsl(var(--member-area-text-dark))' }}>
              {passwordUpdated ? 'Senha Atualizada!' : 'Definir Nova Senha'}
            </CardTitle>
            <CardDescription style={{ color: currentSettings.colors?.text_secondary || 'hsl(var(--member-area-text-muted))' }}>
              {passwordUpdated 
                ? 'Sua senha foi atualizada com sucesso. Você já pode fazer login.'
                : 'Insira e confirme sua nova senha.'
              }
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {passwordUpdated ? (
            <div className="text-center space-y-4">
              <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
              <Button 
                onClick={redirectToLogin} 
                className="w-full"
                style={{ backgroundColor: currentSettings.colors?.button_background || 'hsl(var(--member-area-primary))', color: '#FFFFFF' }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" style={{ color: currentSettings.colors?.text_primary || 'hsl(var(--member-area-text-dark))' }}>Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ backgroundColor: currentSettings.colors?.card_login || 'hsl(var(--member-area-card-background))', color: currentSettings.colors?.text_primary || 'hsl(var(--member-area-text-dark))' }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" style={{ color: currentSettings.colors?.text_secondary || 'hsl(var(--member-area-text-muted))' }} />
                    ) : (
                      <Eye className="h-4 w-4" style={{ color: currentSettings.colors?.text_secondary || 'hsl(var(--member-area-text-muted))' }} />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" style={{ color: currentSettings.colors?.text_primary || 'hsl(var(--member-area-text-dark))' }}>Confirmar Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirme sua nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{ backgroundColor: currentSettings.colors?.card_login || 'hsl(var(--member-area-card-background))', color: currentSettings.colors?.text_primary || 'hsl(var(--member-area-text-dark))' }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" style={{ color: currentSettings.colors?.text_secondary || 'hsl(var(--member-area-text-muted))' }} />
                    ) : (
                      <Eye className="h-4 w-4" style={{ color: currentSettings.colors?.text_secondary || 'hsl(var(--member-area-text-muted))' }} />
                    )}
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
                style={{ backgroundColor: currentSettings.colors?.button_background || 'hsl(var(--member-area-primary))', color: '#FFFFFF' }}
              >
                {loading ? 'Atualizando...' : 'Atualizar Senha'}
              </Button>
            </form>
          )}

          {!passwordUpdated && (
            <div className="mt-6 text-center">
              <Button 
                onClick={redirectToLogin} 
                variant="link" 
                className="hover:underline font-medium p-0 h-auto" 
                style={{ color: currentSettings.colors?.button_background || 'hsl(var(--member-area-primary))' }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthUpdatePassword;