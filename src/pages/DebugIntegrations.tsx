 
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const DebugIntegrations = () => {
  const { user } = useAuth();
  const [integrationData, setIntegrationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!user) {
          setError('Usuário não autenticado');
          setLoading(false);
          return;
        }

        // Buscar dados de integrações
        const { data, error: dbError } = await supabase
          .from('integrations')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (dbError) {
          setError(`Erro ao buscar: ${dbError.message}`);
        } else {
          setIntegrationData(data);
        }
      } catch (err) {
        setError(`Erro: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) return <div className="p-4">Carregando...</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Debug: Integrações</h1>

      {error && (
        <Card className="border-red-200 bg-red-50 mb-4">
          <CardHeader>
            <CardTitle className="text-red-700">Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados do Usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <p><strong>User ID:</strong> {user?.id}</p>
          <p><strong>Email:</strong> {user?.email}</p>
        </CardContent>
      </Card>

      {integrationData && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Dados de Integrações no Banco</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-green-600">
                  ✓ Mercado Pago Access Token: {integrationData.mercado_pago_access_token ? '✅ CONFIGURADO' : '❌ NÃO CONFIGURADO'}
                </p>
                {integrationData.mercado_pago_access_token && (
                  <p className="text-xs text-gray-500">
                    Primeiros 20 chars: {integrationData.mercado_pago_access_token.substring(0, 20)}...
                  </p>
                )}
              </div>

              <div>
                <p className="font-semibold text-green-600">
                  ✓ Mercado Pago Token Public: {integrationData.mercado_pago_token_public ? '✅ CONFIGURADO' : '❌ NÃO CONFIGURADO'}
                </p>
                {integrationData.mercado_pago_token_public && (
                  <p className="text-xs text-gray-500">
                    Primeiros 20 chars: {integrationData.mercado_pago_token_public.substring(0, 20)}...
                  </p>
                )}
              </div>

              <div>
                <p className="font-semibold text-blue-600">
                  Meta Pixel ID: {integrationData.meta_pixel_id ? '✅ ' + integrationData.meta_pixel_id : '❌ NÃO CONFIGURADO'}
                </p>
              </div>

              <div>
                <p className="font-semibold text-purple-600">
                  Email SMTP: {integrationData.smtp_config ? '✅ CONFIGURADO' : '❌ NÃO CONFIGURADO'}
                </p>
                {integrationData.smtp_config && (
                  <pre className="bg-gray-100 p-2 rounded text-xs mt-2 overflow-auto">
                    {JSON.stringify(integrationData.smtp_config, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!integrationData && !error && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-700">Sem Integrações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-600">
              Nenhuma integração foi configurada ainda. Vá para Admin &gt; Integrações para configurar.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        <Button onClick={() => window.location.reload()}>Recarregar</Button>
      </div>
    </div>
  );
};

export default DebugIntegrations;
