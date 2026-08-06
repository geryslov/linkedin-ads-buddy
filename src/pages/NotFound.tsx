import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 gradient-mesh" />
      <div className="relative text-center px-6">
        <p className="font-display text-[96px] font-semibold leading-none text-gradient">404</p>
        <h1 className="mt-4 text-xl font-bold">This page doesn't exist</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
          The link may be outdated, or the page moved. Head back to the dashboard.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
