'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { showSuccess } from '@/components/ui/toast';
import { useConfigStore } from '@/store/configStore';
import type { AIProviderConfig } from '@/types/ai';

import { AddProviderModal } from './AddProviderModal';
import { AIProviderCard } from './AIProviderCard';
import { EditProviderModal } from './EditProviderModal';

export function AIProvidersManager(): React.ReactElement {
  const aiProviders = useConfigStore((s) => s.aiProviders);
  const activeProviderId = useConfigStore((s) => s.activeProviderId);
  const addProvider = useConfigStore((s) => s.addProvider);
  const updateProvider = useConfigStore((s) => s.updateProvider);
  const removeProvider = useConfigStore((s) => s.removeProvider);
  const setActiveProvider = useConfigStore((s) => s.setActiveProvider);

  const [addOpen, setAddOpen] = React.useState(false);
  const [editingProvider, setEditingProvider] = React.useState<AIProviderConfig | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            AI Provider Configurations ({aiProviders.length})
          </h2>
          <p className="text-xs text-slate-400">
            All API keys are encrypted client-side with AES-256-GCM before storage.
          </p>
        </div>

        <Button size="sm" variant="default" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add AI Provider
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {aiProviders.map((prov) => (
          <AIProviderCard
            key={prov.id}
            provider={prov}
            isActive={activeProviderId === prov.id}
            onSetActive={(id) => {
              setActiveProvider(id);
              showSuccess(`Active AI provider switched to ${prov.displayName}`);
            }}
            onEdit={(p) => setEditingProvider(p)}
            onDelete={(id) => {
              removeProvider(id);
              showSuccess(`Removed provider ${prov.displayName}`);
            }}
          />
        ))}
      </div>

      <AddProviderModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={(input) => {
          const created = addProvider(input);
          showSuccess(`Added provider ${created.displayName}`);
        }}
      />

      <EditProviderModal
        provider={editingProvider}
        open={editingProvider !== null}
        onOpenChange={(open) => {
          if (!open) setEditingProvider(null);
        }}
        onSave={(id, update) => {
          updateProvider(id, update);
          showSuccess('Updated provider settings');
        }}
      />
    </div>
  );
}

