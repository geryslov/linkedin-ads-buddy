import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLinkedInAuth } from "@/hooks/useLinkedInAuth";
import { Loader2, Linkedin } from "lucide-react";

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { exchangeToken } = useLinkedInAuth();

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const storedState = localStorage.getItem("linkedin_oauth_state");

    console.log('[OAuth Callback] Page loaded');
    console.log('[OAuth Callback] Current URL:', window.location.href);
    console.log('[OAuth Callback] Code received:', !!code);
    console.log('[OAuth Callback] State from URL:', state);
    console.log('[OAuth Callback] Stored state:', storedState);
    console.log('[OAuth Callback] States match:', state === storedState);
    
    if (error) {
      console.error('[OAuth Callback] Error from LinkedIn:', error, errorDescription);
    }

    if (code && state === storedState) {
      console.log('[OAuth Callback] Proceeding with token exchange...');
      exchangeToken(code).then((token) => {
        console.log('[OAuth Callback] Token exchange complete, token:', !!token);
        if (token) {
          navigate("/dashboard");
        } else {
          navigate("/");
        }
      });
    } else {
      console.log('[OAuth Callback] State mismatch or no code, redirecting to home');
      if (!code) console.log('[OAuth Callback] No code in URL params');
      if (state !== storedState) console.log('[OAuth Callback] State mismatch - possible CSRF or stale state');
      navigate("/");
    }
  }, [searchParams, exchangeToken, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="relative inline-flex">
          <div className="p-4 rounded-2xl gradient-primary glow-primary">
            <Linkedin className="h-12 w-12 text-primary-foreground" />
          </div>
          <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-background">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Connecting to LinkedIn</h2>
          <p className="text-muted-foreground">Please wait while we complete the authentication...</p>
        </div>
      </div>
    </div>
  );
}
