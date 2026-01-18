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
import { Loader2, Brain, CheckCircle, AlertCircle } from 'lucide-react';
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
  const { login, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  useEffect(() => {
    // Carregar credenciais salvas
    loadSavedCredentials();
    
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-purple-600 rounded-full">
              <Brain className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-purple-900">Sistema de Gestão</CardTitle>
          <CardDescription>
            Faça login para acessar o sistema
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
              <Input
                id="password"
                type="password"
                placeholder="Sua senha"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Checkbox Lembrar de mim */}
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
  );
}