import { useEffect, useState } from 'react';
import {
  Server,
  Cpu,
  Wrench,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { checkHealth, fetchAvailableTools } from '../../lib/api';

type ToolInfo = {
  name: string;
  description: string;
  category: string;
  source: 'tool' | 'channel';
  requires_credentials: boolean;
  credential_keys: string[];
  configured: boolean;
};

function StatusRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
      <Icon size={14} style={{ color: color || 'var(--color-text-tertiary)' }} />
      <span className="hud-label">{label}</span>
      <span className="flex-1" />
      <span className="text-xs font-mono truncate" style={{ color: color || 'var(--color-text)' }}>
        {value}
      </span>
    </div>
  );
}

export function SystemStatus() {
  const serverInfo = useAppStore((s) => s.serverInfo);
  const savings = useAppStore((s) => s.savings);
  const isStreaming = useAppStore((s) => s.streamState.isStreaming);
  const streamPhase = useAppStore((s) => s.streamState.phase);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [tools, setTools] = useState<ToolInfo[] | null>(null);
  const [agentsActive, setAgentsActive] = useState<number | null>(null);

  useEffect(() => {
    const poll = async () => {
      setHealthy(await checkHealth().catch(() => false));
      try {
        const res = await fetch(`${location.origin}/v1/managed-agents`).then((r) => r.ok ? r.json() : null).catch(() => null);
        if (res?.agents) {
          setAgentsActive(res.agents.filter((a: { status: string }) => a.status === 'running').length);
        }
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchAvailableTools()
      .then((t) => setTools(t))
      .catch(() => setTools([]));
  }, []);

  const configuredTools = tools?.filter((t) => t.configured).length ?? null;
  const totalCalls = savings?.total_calls ?? 0;
  const totalTokens = savings?.total_tokens ?? 0;

  const online = healthy === true;
  const offline = healthy === false;
  const checking = healthy === null;

  return (
    <div className="hud-panel p-6">
      <h3 className="hud-label flex items-center gap-2 mb-4">
        <Server size={12} style={{ color: 'var(--color-accent)' }} />
        Status do OpenJarvis
      </h3>

      {/* Connection banner */}
      <div
        className="flex items-center gap-3 p-3 rounded-lg mb-3"
        style={{
          background: online
            ? 'color-mix(in srgb, var(--color-success) 10%, transparent)'
            : offline
            ? 'color-mix(in srgb, var(--color-error) 10%, transparent)'
            : 'var(--color-bg-secondary)',
          border: `1px solid ${
            online
              ? 'color-mix(in srgb, var(--color-success) 25%, transparent)'
              : offline
              ? 'color-mix(in srgb, var(--color-error) 25%, transparent)'
              : 'var(--color-border)'
          }`,
        }}
      >
        {checking ? (
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />
        ) : online ? (
          <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
        ) : (
          <XCircle size={18} style={{ color: 'var(--color-error)' }} />
        )}
        <div className="flex-1">
          <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {checking ? 'Verificando conexão…' : online ? 'Backend online' : 'Backend indisponível'}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {online
              ? 'O motor de inferência local está respondendo.'
              : offline
              ? 'Não foi possível conectar ao servidor.'
              : 'Verificando o estado do servidor…'}
          </div>
        </div>
        {isStreaming && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-accent)' }}>
            <Activity size={12} className="animate-pulse" />
            inferindo…
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <StatusRow
          icon={Cpu}
          label="Modelo"
          value={serverInfo?.model || '—'}
          color="var(--color-accent)"
        />
        <StatusRow
          icon={Cpu}
          label="Engine"
          value={serverInfo?.engine || '—'}
        />
        <StatusRow
          icon={Activity}
          label="Agente ativo"
          value={serverInfo?.agent || 'nenhum'}
          color={serverInfo?.agent ? 'var(--color-accent-purple)' : undefined}
        />
        <StatusRow
          icon={Wrench}
          label="Ferramentas"
          value={configuredTools == null ? '—' : `${configuredTools} configuradas`}
        />
        <StatusRow
          icon={Activity}
          label="Agentes em execução"
          value={agentsActive == null ? '—' : String(agentsActive)}
          color={agentsActive ? 'var(--color-accent-purple)' : undefined}
        />
        <StatusRow
          icon={MessageSquare}
          label="Fase atual"
          value={isStreaming ? streamPhase || 'streaming' : 'ocioso'}
          color={isStreaming ? 'var(--color-accent)' : undefined}
        />
        <StatusRow
          icon={MessageSquare}
          label="Requisições"
          value={totalCalls.toLocaleString()}
        />
        <StatusRow
          icon={Cpu}
          label="Tokens processados"
          value={totalTokens.toLocaleString()}
        />
      </div>
    </div>
  );
}
