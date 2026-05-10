import { useState } from 'react';
import { Users, Flame, Target, ScrollText, AlertTriangle, StickyNote } from 'lucide-react';
import { AgendasSection } from './AgendasSection.jsx';
import { BlasphemiesSection } from './BlasphemiesSection.jsx';

const SECTIONS = [
  { id: 'characters',  label: 'Characters',  Icon: Users        },
  { id: 'blasphemies', label: 'Blasphemies', Icon: Flame        },
  { id: 'agendas',     label: 'Agendas',     Icon: Target       },
  { id: 'missions',    label: 'Missions',    Icon: ScrollText   },
  { id: 'sins',        label: 'Sins',        Icon: AlertTriangle },
  { id: 'notes',       label: 'Notes',       Icon: StickyNote   },
];

export function WikiTab() {
  const [section, setSection] = useState(SECTIONS[0].id);

  return (
    <div className="flex h-full min-h-0 gap-0">

      {/* Sidebar */}
      <nav className="w-48 shrink-0 border-r border-border flex flex-col py-2">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left relative ${
              section === id
                ? 'text-foreground before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 p-6 overflow-auto">
        {section === 'agendas'      && <AgendasSection />}
        {section === 'blasphemies'  && <BlasphemiesSection />}
      </div>

    </div>
  );
}
