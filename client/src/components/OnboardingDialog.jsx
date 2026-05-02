import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

export function OnboardingDialog() {
  const { completeOnboarding, suggestedName } = useAuth();
  const [name, setName] = useState(suggestedName);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await completeOnboarding(name.trim());
  };

  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <Dialog open>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <h2 className="text-lg font-semibold">Welcome to Seraph</h2>
          <p className="text-sm text-muted-foreground">Choose a display name that other players will see.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            <input
              autoFocus
              className="border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Display name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={32}
            />
            <Button type="submit" disabled={!name.trim() || busy}>
              {busy ? 'Saving…' : 'Continue'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
