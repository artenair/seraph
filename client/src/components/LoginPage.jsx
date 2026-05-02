import { useAuth } from '@/context/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { FcGoogle } from 'react-icons/fc';
import { FaDiscord } from 'react-icons/fa';

export function LoginPage() {
  const { loginWithGoogle } = useAuth();

  function loginWithDiscord() {
    window.location.href = '/auth/discord';
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground gap-6">
      <h1 className="text-3xl font-bold tracking-tight">SERAPH</h1>
      <p className="text-muted-foreground text-sm">Sign in to continue</p>
      <div className="flex flex-col gap-3 w-56">
        <Button variant="outline" className="gap-2" onClick={loginWithGoogle}>
          <FcGoogle className="size-5" />
          Continue with Google
        </Button>
        <Button variant="outline" className="gap-2" onClick={loginWithDiscord}>
          <FaDiscord className="size-5 text-[#5865F2]" />
          Continue with Discord
        </Button>
      </div>
    </div>
  );
}
