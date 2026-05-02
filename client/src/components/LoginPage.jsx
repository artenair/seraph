import { useAuth } from '@/context/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { FcGoogle } from 'react-icons/fc';

export function LoginPage() {
  const { loginWithGoogle } = useAuth();

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground gap-6">
      <h1 className="text-3xl font-bold tracking-tight">SERAPH</h1>
      <p className="text-muted-foreground text-sm">Sign in to continue</p>
      <Button variant="outline" className="gap-2" onClick={loginWithGoogle}>
        <FcGoogle className="size-5" />
        Continue with Google
      </Button>
    </div>
  );
}
