import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLinkedInAuth } from '@/hooks/useLinkedInAuth';
import { Loader2, Linkedin } from 'lucide-react';

export default function Auth() {
  const [session, setSession] = useState<any>(null);
  const navigate = useNavigate();
  const { initiateAuth, isLoading } = useLinkedInAuth();

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Welcome to LinkedIn Ads Buddy
          </CardTitle>
          <CardDescription className="text-center">
            Connect your LinkedIn account to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
