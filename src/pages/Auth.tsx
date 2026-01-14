import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLinkedInAuth } from '@/hooks/useLinkedInAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Linkedin } from 'lucide-react';

export default function Auth() {
  const [session, setSession] = useState<any>(null);
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const navigate = useNavigate();
  const { initiateAuth, isLoading } = useLinkedInAuth();
  const { toast } = useToast();

  const isEmailMode = searchParams.get('mode') === 'email';

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        navigate('/dashboard');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        navigate('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEmailLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: 'Login Failed',
          description: error.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Welcome to LinkedIn Ads Buddy
          </CardTitle>
          <CardDescription className="text-center">
            {isEmailMode 
              ? 'Sign in with your email and password'
              : 'Connect your LinkedIn account to get started'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEmailMode ? (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="test@pipelight.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isEmailLoading}>
                {isEmailLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Sign In
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              className="w-full"
              onClick={initiateAuth}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Linkedin className="mr-2 h-4 w-4" />
              )}
              Continue with LinkedIn
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
