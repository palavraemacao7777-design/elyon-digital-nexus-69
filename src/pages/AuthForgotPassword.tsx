 
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { memberAreaSupabase } from '@/integrations/supabase/memberAreaClient'; // Keep for potential future direct auth calls
import { supabase } from '@/integrations/supabase/client'; // Use main supabase client for Edge Function invocation
import { useGlobalPlatformSettings } from '@/hooks/useGlobalPlatformSettings'; // Importar o hook centralizado

const AuthForgotPassword = () => {
  const { memberAreaId } = useParams<{ memberAreaId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
  // Usar o hook centralizado para configurações da plataforma
  const { settings, loadingSettings } = useGlobalPlatformSettings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const trimmedEmail = email.trim(); // Trim the email input

    if (!trimmedEmail) {
      toast({
        title: "Erro",
        description: "Por favor, insira seu endereço de e-mail.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!memberAreaId) {
      toast({
        title: "Erro",
        description: "ID da área de membros não encontrado. Não é possível redefinir a senha.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      // Chamar a nova Edge Function para enviar o e-mail de redefinição personalizado
      const { data, error } = await supabase.functions.invoke(
        'send-password-reset', // Nome da Edge Function corrigido
        {
          body: { email: trimmedEmail },
          method: 'POST',
        }
      );

      if (error) {
        console.error('Error invoking send-password-reset Edge Function:', error);
        throw new Error(error.message || 'Erro ao invocar função de envio de e-mail de redefinição.');
      }

      // A Edge Function agora retorna uma string de texto em caso de sucesso/erro
      // Precisamos verificar o status da resposta para determinar o sucesso
      if (data === "Link de redefinição enviado com sucesso!") {
        setEmailSent(true);
        toast({
          title: "E-mail enviado!",
          description: "Verifique sua caixa de entrada para o link de redefinição de senha.",
        });
      } else {
        // Se a resposta não for a mensagem de sucesso esperada, trate como erro
        throw new Error(data || 'Erro desconhecido ao enviar e-mail de redefinição.');
      }
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao enviar e-mail de redefinição de senha.",
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
              {emailSent ? 'E-mail Enviado!' : 'Recuperar Senha'}
            </CardTitle>
            <CardDescription style={{ color: currentSettings.colors?.text_secondary || 'hsl(var(--member-area-text-muted))' }}>
              {emailSent 
                ? 'Verifique sua caixa de entrada para o link de redefinição de senha.'
                : 'Insira seu e-mail para receber um link de redefinição de senha.'
              }
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="text-center space-y-4">
              <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
              <p className="text-lg" style={{ color: currentSettings.colors?.text_primary || 'hsl(var(--member-area-text-dark))' }}>
                Um e-mail foi enviado para <strong>{email}</strong>.
              </p>
              <Button 
                onClick={() => navigate(`/membros/${memberAreaId}/login`)} 
                className="w-full"
                style={{ backgroundColor: currentSettings.colors?.button_background || 'hsl(var(--member-area-primary))', color: '#FFFFFF' }}
              >
                Voltar para o Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" style={{ color: currentSettings.colors?.text_primary || 'hsl(var(--member-area-text-dark))' }}>Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ backgroundColor: currentSettings.colors?.card_login || 'hsl(var(--member-area-card-background))', color: currentSettings.colors?.text_primary || 'hsl(var(--member-area-text-dark))' }}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
                style={{ backgroundColor: currentSettings.colors?.button_background || 'hsl(var(--member-area-primary))', color: '#FFFFFF' }}
              >
                {loading ? 'Enviando...' : 'Enviar Link de Redefinição'}
              </Button>
            </form>
          )}

          {!emailSent && (
            <div className="mt-6 text-center">
              <Link to={`/membros/${memberAreaId}/login`} className="hover:underline font-medium" style={{ color: currentSettings.colors?.button_background || 'hsl(var(--member-area-primary))' }}>
                Voltar para o Login
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthForgotPassword;