import { Client } from '@/hooks/useFirestore';
import { ClientRow } from './ClientRow';
import { PaidClientRow } from './PaidClientRow';
import { NoServiceRow } from './NoServiceRow';
import { PartialClientRow } from './PartialClientRow';

interface ClientSectionProps {
  title: string;
  clients: Client[];
  uid: string;
  fyId: string;
  type: 'pending' | 'partial' | 'paid' | 'no_service' | 'mixed';
  allTags: string[];
}

function renderRow(client: Client, uid: string, fyId: string, type: ClientSectionProps['type'], allTags: string[]) {
  const t = type === 'mixed' ? client.status : type;
  if (t === 'pending')    return <ClientRow key={client.id} client={client} uid={uid} fyId={fyId} allTags={allTags} />;
  if (t === 'partial')    return <PartialClientRow key={client.id} client={client} uid={uid} fyId={fyId} allTags={allTags} />;
  if (t === 'paid')       return <PaidClientRow key={client.id} client={client} uid={uid} fyId={fyId} allTags={allTags} />;
  return <NoServiceRow key={client.id} client={client} uid={uid} fyId={fyId} allTags={allTags} />;
}

export function ClientSection({ title, clients, uid, fyId, type, allTags }: ClientSectionProps) {
  if (clients.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <span className="text-sm text-muted-foreground font-medium">
          {clients.length} {clients.length === 1 ? 'client' : 'clients'}
        </span>
      </div>
      <div className="space-y-2">
        {clients.map((client) => renderRow(client, uid, fyId, type, allTags))}
      </div>
    </div>
  );
}
