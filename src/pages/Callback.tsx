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
    const storedState = localStorage.getItem("linkedin_oauth_state");

    if (code && state === storedState) {
      exchangeToken(code).then((token) => {
        if (token) {
          navigate("/dashboard");
        } else {
          navigate("/");
        }
      });
    } else {
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
