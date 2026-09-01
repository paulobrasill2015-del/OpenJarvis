import { useEffect, useState, useCallback } from 'react';
import { PlayCircle, PauseCircle, AlertTriangle, Loader2, Bot } from 'lucide-react';
import { fetchManagedAgents, fetchAgentTasks, type ManagedAgent, type AgentTask } from '../../lib/api';

const STATUS_META: Record<string, { color: string; icon: typeof PlayCircle; label: string }> = {
  running: { color: 'var(--color-accent-purple)', icon: PlayCircle, label: 'Em execução' },
  idle: { color: 'var(--color-text-tertiary)', icon: PauseCircle, label: 'Ocioso' },
  paused: { color: 'var(--color-warning)', icon: PauseCircle, label: 'Pausado' },
  error: { color: 'var(--color-error)', icon: AlertTriangle, label: 'Erro' },
  needs_attention: { color: 'var(--color-warning)', icon: AlertTriangle, label: 'Atenção' },
  budget_exceeded: { color: 'var(--color-error)', icon: AlertTriangle, label: 'Orçamento excedido' },
  stalled: { color: 'var(--color-error)', icon: AlertTriangle, label: 'Parado' },
  archived: { color: 'var(--color-text-tertiary)', icon: PauseCircle, label: 'Arquivado' },
};

function formatRelative(ts: number | null | undefined): string {
  if (!ts) return '—';
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return `há ${Math.floor(diff)}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

export function RunningActivities() {
  const [agents, setAgents] = useState<ManagedAgent[]>([]);
  const [tasksByAgent, setTasksByAgent] = useState<Record<string, AgentTask[]>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchManagedAgents();
      const active = list.filter((a) => a.status !== 'archived');
      setAgents(active);
      const taskEntries = await Promise.all(
        active
          .filter((a) => a.status === 'running')
          .map(async (a) => {
            try {
              const tasks = await fetchAgentTasks(a.id);
              return [a.id, tasks.filter((t) => t.status === 'active' || t.status === 'pending')] as const;
            } catch {
              return [a.id, []] as const;
            }
          }),
      );
      setTasksByAgent(Object.fromEntries(taskEntries));
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const runningCount = agents.filter((a) => a.status === 'running').length;

  return (
    <div className="hud-panel p-6">
      <h3 className="hud-label flex items-center gap-2 mb-4">
        <Bot size={12} style={{ color: 'var(--color-accent-purple)' }} />
        Atividades em Execução
        {runningCount > 0 && (
          <span
            className="ml-auto px-2 py-0.5 rounded-full text-[11px] font-mono"
            style={{ background: 'color-mix(in srgb, var(--color-accent-purple) 15%, transparent)', color: 'var(--color-accent-purple)' }}
          >
            {runningCount} ativas
          </span>
        )}
      </h3>

      {loading ? (
        <div className="h-32 flex items-center justify-center" style={{ color: 'var(--color-text-tertiary)' }}>
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : agents.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          <span className="hud-mono">nenhum agente configurado…</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {agents.map((agent) => {
            const meta = STATUS_META[agent.status] ?? STATUS_META.idle;
            const Icon = meta.icon;
            const tasks = tasksByAgent[agent.id] ?? [];
            return (
              <div
                key={agent.id}
                className="rounded-lg p-3"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon
                    size={14}
                    style={{ color: meta.color }}
                    className={agent.status === 'running' ? 'animate-pulse' : ''}
                  />
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                    {agent.name}
                  </span>
                  <span className="flex-1" />
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{ background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>

                {agent.current_activity && (
                  <div className="text-xs mb-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                    <span className="hud-mono" style={{ color: 'var(--color-text-tertiary)' }}>atividade: </span>
                    {agent.current_activity}
                  </div>
                )}

                <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  <span>{agent.total_runs ?? 0} execuções</span>
                  <span>&middot;</span>
                  <span>última {formatRelative(agent.last_run_at)}</span>
                  {agent.total_tokens != null && (
                    <>
                      <span>&middot;</span>
                      <span>{agent.total_tokens.toLocaleString()} tokens</span>
                    </>
                  )}
                </div>

                {tasks.length > 0 && (
                  <div className="mt-2 pt-2 flex flex-col gap-1" style={{ borderTop: '1px solid var(--color-border)' }}>
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-xs">
                        {task.status === 'active' ? (
                          <Loader2 size={11} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                        ) : (
                          <span className="w-[11px] h-[11px] rounded-full shrink-0" style={{ background: 'var(--color-text-tertiary)' }} />
                        )}
                        <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>
                          {task.description}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
