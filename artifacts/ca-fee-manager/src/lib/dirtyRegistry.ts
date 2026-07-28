/**
 * Module-level registry of dirty (unsaved) client IDs.
 * ClientRow registers/deregisters here; NavigationGuardContext reads it.
 */
const dirtyClients = new Set<string>();

export const dirtyRegistry = {
  register(id: string, dirty: boolean) {
    if (dirty) dirtyClients.add(id);
    else dirtyClients.delete(id);
  },
  hasAny(): boolean {
    return dirtyClients.size > 0;
  },
  clear() {
    dirtyClients.clear();
  },
};
