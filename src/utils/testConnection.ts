import { supabase } from '@/lib/supabase';

export async function testDatabaseConnection() {
  try {
    console.log('🔍 Testando conexão com banco...');
    
    // Teste mais simples - apenas listar usuários
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email')
      .limit(1);

    if (error) {
      console.error('❌ Erro na conexão:', error);
      return false;
    }

    console.log('✅ Conexão com banco funcionando!');
    console.log('📊 Dados encontrados:', data?.length || 0, 'usuários');
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão:', error);
    return false;
  }
}

export async function testSupabaseConfig() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('🔧 Verificando configuração...');
    console.log('URL:', url ? 'Configurada' : 'Não configurada');
    console.log('Key:', key ? 'Configurada' : 'Não configurada');
    
    if (!url || !key) {
      console.error('❌ Variáveis de ambiente não configuradas');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro na verificação:', error);
    return false;
  }
}