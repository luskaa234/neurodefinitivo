"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Brain, CheckCircle, AlertCircle, Eye, EyeOff, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { testDatabaseConnection, testSupabaseConfig } from '@/utils/testConnection';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória')
});

type LoginFormData = z.infer<typeof loginSchema>;

interface SavedCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

export function LoginForm() {
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error'>('testing');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [brandName, setBrandName] = useState('Neuro Integrar');
  const { login, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const emailValue = watch('email') || '';
  const passwordValue = watch('password') || '';

  useEffect(() => {
    // Carregar credenciais salvas
    loadSavedCredentials();

    // Carregar branding (logo/nome)
    try {
      const settingsRaw = localStorage.getItem('app-settings');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        setLogoUrl(settings.logo_site_url || settings.logo_pwa_url || '');
        setBrandName(settings.site_short_name || settings.site_name || settings.company_name || 'Neuro Integrar');
      }
    } catch (err) {
      console.error('Erro ao carregar branding:', err);
    }
    
    // Testar configuração e conexão
    const runTests = async () => {
      console.log('🚀 Iniciando testes...');
      
      const configOk = await testSupabaseConfig();
      if (!configOk) {
        setConnectionStatus('error');
        return;
      }
      
      const connectionOk = await testDatabaseConnection();
      setConnectionStatus(connectionOk ? 'success' : 'error');
    };
    
    runTests();
  }, []);

  const loadSavedCredentials = () => {
    try {
      const savedCredentials = localStorage.getItem('neuro-integrar-credentials');
      if (savedCredentials) {
        const credentials: SavedCredentials = JSON.parse(savedCredentials);
        if (credentials.rememberMe) {
          setValue('email', credentials.email);
          setValue('password', credentials.password);
          setRememberMe(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar credenciais salvas:', error);
    }
  };

  const saveCredentials = (email: string, password: string, remember: boolean) => {
    try {
      if (remember) {
        const credentials: SavedCredentials = {
          email,
          password,
          rememberMe: true
        };
        localStorage.setItem('neuro-integrar-credentials', JSON.stringify(credentials));
      } else {
        localStorage.removeItem('neuro-integrar-credentials');
      }
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    
    try {
      // Salvar credenciais se "Lembrar de mim" estiver marcado
      saveCredentials(data.email, data.password, rememberMe);
      
      const success = await login(data.email, data.password);
      
      if (!success) {
        setError('Email ou senha incorretos');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      setError('Erro interno. Tente novamente.');
    }
  };

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    
    // Se desmarcou, limpar credenciais salvas
    if (!checked) {
      localStorage.removeItem('neuro-integrar-credentials');
    }
  };

  const handleSaveLogin = () => {
    if (!emailValue || !passwordValue) {
      setError('Informe email e senha para salvar o login');
      return;
    }
    setError('');
    setRememberMe(true);
    saveCredentials(emailValue, passwordValue, true);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-gradient-to-br from-slate-50 to-white">
      {/* Lado visual */}
      <div className="relative hidden md:flex items-center justify-center overflow-hidden bg-slate-900">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{ backgroundImage: "url('https://linimarstoque.com.br/wp-content/uploads/2024/07/CLINICA-MEDICA-4.jpg')" }}
        />
        <div className="relative z-10 max-w-md text-white px-10">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-10 w-10 rounded-md bg-white/10 p-1 object-contain" />
            ) : (
              <div className="p-2 bg-white/10 rounded-md">
                <Brain className="h-6 w-6 text-white" />
              </div>
            )}
            <span className="text-lg font-semibold">{brandName}</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold leading-tight">
            Gestão clínica moderna, rápida e segura.
          </h2>
          <p className="mt-3 text-sm text-white/80">
            Acompanhe agendas, pacientes e equipe com uma experiência simples e profissional.
          </p>
        </div>
      </div>

      {/* Lado do formulário */}
      <div className="relative flex items-center justify-center p-6">
        <div
          className="absolute inset-0 bg-cover bg-center md:hidden"
          style={{ backgroundImage: "url('https://linimarstoque.com.br/wp-content/uploads/2024/07/CLINICA-MEDICA-4.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50 md:hidden" />
        <Card className="relative w-full max-w-md border border-white/30 bg-white/85 shadow-xl backdrop-blur-sm md:border-gray-100 md:bg-white">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {logoUrl ? (
                <div className="h-14 w-14 rounded-xl bg-gray-50 p-2 shadow-inner">
                  <img src={logoUrl} alt={brandName} className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="p-3 bg-purple-600 rounded-full">
                  <Brain className="h-8 w-8 text-white" />
                </div>
              )}
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">Acesso ao sistema</CardTitle>
            <CardDescription>
              Faça login para continuar
            </CardDescription>
          </CardHeader>
          <CardContent>
          {/* Status da conexão */}
          <div className="mb-4">
            {connectionStatus === 'testing' && (
              <div className="flex items-center text-sm text-gray-600">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando conexão...
              </div>
            )}
            {connectionStatus === 'success' && (
              <div className="flex items-center text-sm text-green-600">
                <CheckCircle className="mr-2 h-4 w-4" />
                Sistema online
              </div>
            )}
            {connectionStatus === 'error' && (
              <div className="flex items-center text-sm text-red-600">
                <AlertCircle className="mr-2 h-4 w-4" />
                Erro de conexão
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Sua senha"
                  {...register('password')}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Checkbox Lembrar de mim */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={handleRememberMeChange}
                />
                <Label 
                  htmlFor="remember" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Lembrar de mim
                </Label>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveLogin}
              >
                <Save className="mr-2 h-3.5 w-3.5" />
                Salvar login
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full bg-purple-600 hover:bg-purple-700" 
              disabled={isSubmitting || isLoading || connectionStatus !== 'success'}
            >
              {isSubmitting || isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {/* Informação sobre segurança */}
          <div className="mt-6 p-3 bg-gray-50 rounded-lg border">
            <p className="text-xs text-gray-600 text-center">
              Suas credenciais são armazenadas localmente e de forma segura
            </p>
          </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
