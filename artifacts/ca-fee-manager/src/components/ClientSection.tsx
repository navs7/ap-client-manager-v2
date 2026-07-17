import { Client } from '@/hooks/useFirestore';
import { ClientRow } from './ClientRow';
import { PaidClientRow } from './PaidClientRow';
import { NoServiceRow } from './NoServiceRow';

interface ClientSectionProps {
  title: string;
  clients: Client[];
  uid: string;
  fyId: string;
  type: 'pending' | 'paid' | 'no_service';
}

export function ClientSection({
  title,
  clients,
  uid,
  fyId,
  type,
}: ClientSectionProps) {
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
        {clients.map((client) => {
          if (type === 'pending') {
            return (
              <ClientRow key={client.id} client={client} uid={uid} fyId={fyId} />
            );
          } else if (type === 'paid') {
            return (
              <PaidClientRow
                key={client.id}
                client={client}
                uid={uid}
                fyId={fyId}
              />
            );
          } else {
            return (
              <NoServiceRow
                key={client.id}
                client={client}
                uid={uid}
                fyId={fyId}
              />
            );
          }
        })}
      </div>
    </div>
  );
}
