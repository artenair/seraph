import { useState } from 'react';
import { useRoom } from '@/context/RoomContext.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet.jsx';
import { Check, Copy, UserMinus } from 'lucide-react';

const ROLES = ['Admin', 'Exorcist', 'DJ'];

const ROLE_COLORS = {
  Admin:    'bg-amber-500/20 text-amber-400 border-amber-500/40',
  Exorcist: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  DJ:       'bg-purple-500/20 text-purple-400 border-purple-500/40',
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button onClick={handleCopy} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  );
}

function RoleBadge({ role, active, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-0.5 text-xs border transition-colors ${
        active
          ? ROLE_COLORS[role]
          : 'bg-transparent text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/60'
      } disabled:opacity-40 disabled:cursor-not-allowed`}>
      {role}
    </button>
  );
}

export function RoomSettings({ open, onClose }) {
  const { user } = useAuth();
  const { currentRoom, members, presenceList, isAdmin, isOwner, assignRole, removeRole, kickMember, leaveRoom, deleteRoom } = useRoom();

  if (!currentRoom) return null;

  const inviteLink = `${window.location.origin}?join=${currentRoom.inviteCode}`;

  function canModifyRole(member, role) {
    if (member.userId === user?.uid) return false;
    if (role === 'Admin' && member.roles?.includes('Admin') && !isOwner) return false;
    return isAdmin;
  }

  async function toggleRole(member, role) {
    if (member.roles?.includes(role)) {
      await removeRole(member.userId, role);
    } else {
      await assignRole(member.userId, role);
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Room Settings</SheetTitle>
        </SheetHeader>

        <div className="px-4 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Room</p>
            <p className="font-semibold">{currentRoom.name}</p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Invite code</p>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold tracking-widest text-lg">{currentRoom.inviteCode}</span>
              <CopyButton text={currentRoom.inviteCode} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Shareable link</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground truncate flex-1">{inviteLink}</span>
              <CopyButton text={inviteLink} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Members ({members.length})</p>
            {members.map(member => (
              <div key={member.userId} className="flex flex-col gap-2 p-3 border border-border">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${presenceList.some(p => p.uid === member.userId) ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                  <span className="text-sm font-medium">
                    {member.displayName || 'Unknown'}
                    {member.userId === currentRoom.ownerId && (
                      <span className="ml-2 text-xs text-muted-foreground">(owner)</span>
                    )}
                    {member.userId === user?.uid && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </span>
                  {isAdmin && member.userId !== user?.uid && member.userId !== currentRoom.ownerId && (
                    <button
                      onClick={() => { if (confirm(`Kick ${member.displayName || 'this user'}?`)) kickMember(member.userId); }}
                      title="Kick"
                      className="ml-auto text-muted-foreground/40 hover:text-destructive transition-colors">
                      <UserMinus size={14} />
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {ROLES.map(role => (
                    <RoleBadge
                      key={role}
                      role={role}
                      active={member.roles?.includes(role)}
                      disabled={!canModifyRole(member, role)}
                      onClick={() => toggleRole(member, role)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 pt-2 border-t border-border">
            {!isOwner && (
              <button
                onClick={() => { if (confirm('Leave this room?')) leaveRoom(); }}
                className="text-xs text-destructive hover:opacity-70 transition-opacity text-left">
                Leave room
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => { if (confirm(`Delete "${currentRoom.name}"? This cannot be undone.`)) deleteRoom(); }}
                className="text-xs text-destructive hover:opacity-70 transition-opacity text-left">
                Delete room
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
