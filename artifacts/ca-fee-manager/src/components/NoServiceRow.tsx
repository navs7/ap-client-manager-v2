import { useState } from 'react';
import { Client, updateClient } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Undo2 } from 'lucide-react';
import { toast } from 'sonner';

interface NoServiceRowProps {
  client: Client;
  uid: string;
  fyId: string;
}

export function NoServiceRow({ client, uid, fyId }: NoServiceRowProps) {
  const [updating, setUpdating] = useState(false);

  async function handleUndo() {
    setUpdating(true);
    try {
      await updateClient(uid, fyId, client.id, { status: 'pending' });
      toast.success(`${client.name} moved back to pending`);
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 p-4 border border-border rounded-lg bg-muted/30 status-transition row-enter" data-testid={`no-service-row-${client.id}`}>
      <div className="flex items-center">
        <div className="font-medium text-base text-muted-foreground">
          {client.name}
        </div>
      </div>

      <div className="flex items-end">
        <Button
          size="sm"
          variant="outline"
          onClick={handleUndo}
          disabled={updating}
          data-testid={`button-undo-no-service-${client.id}`}
        >
          <Undo2 className="w-4 h-4 mr-1" />
          Undo
        </Button>
      </div>
    </div>
  );
}
