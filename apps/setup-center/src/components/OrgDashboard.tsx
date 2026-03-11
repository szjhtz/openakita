/**
 * Organization Operations Dashboard — data-driven big-screen style overview.
 * Pure CSS, no chart library. Reads from GET /api/orgs/{orgId}/stats.
 */
import { useEffect, useState, useCallback } from "react";
import { safeFetch } from "../providers";
import { OrgAvatar } from "./OrgAvatars";

interface OrgDashboardProps {
  orgId: string;
  apiBaseUrl: string;
  orgName?: string;
  onNodeClick?: (nodeId: string) => void;
}

const STATUS_DOT: Record<string, string> = {
  idle: "#22c55e",
  busy: "#3b82f6",
  error: "#ef4444",
  frozen: "#94a3b8",
  waiting: "#f59e0b",
};

const HEALTH_LABEL: Record<string, [string, string]> = {
  healthy: ["运行良好", "#22c55e"],
  attention: ["需关注", "#3b82f6"],
  warning: ["有隐患", "#f59e0b"],
  critical: ["异常", "#ef4444"],
};

function fmtDuration(s: number | null | undefined): string {
  if (!s || s <= 0) return "--";
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}m`;
}

function fmtTime(v: string | number | undefined | null): string {
  if (!v) return "";
  const d = new Date(typeof v === "number" ? v : v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function fmtIdle(s: number | null | undefined): string {
  if (s == null) return "--";
  if (s < 60) return "刚刚";
  if (s < 3600) return `${Math.floor(s / 60)}分钟前`;
  return `${Math.floor(s / 3600)}小时前`;
}

export function OrgDashboard({ orgId, apiBaseUrl, orgName, onNodeClick }: OrgDashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await safeFetch(`${apiBaseUrl}/api/orgs/${orgId}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [orgId, apiBaseUrl]);

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, 8000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)" }}>
        加载中...
      </div>
    );
  }
  if (!stats) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)" }}>
        无法加载组织数据
      </div>
    );
  }

  const hl = HEALTH_LABEL[stats.health] || HEALTH_LABEL.healthy;
  const nodeStats = stats.node_stats || {};
  const busyCount = nodeStats.busy || 0;
  const perNode: any[] = stats.per_node || [];
  const anomalies: any[] = stats.anomalies || [];
  const recentBB: any[] = stats.recent_blackboard || [];
  const recentTasks: any[] = stats.recent_tasks || [];
  const deptWorkload: Record<string, { total: number; busy: number }> = stats.department_workload || {};

  const healthPct = stats.node_count > 0
    ? Math.round(((stats.node_count - (nodeStats.error || 0)) / stats.node_count) * 100)
    : 100;

  return (
    <div style={{
      height: "100%", overflow: "auto", background: "#0b1120",
      color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif",
      padding: 20,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>
            {orgName || stats.name || "组织"} 运营看板
          </h2>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, padding: "3px 10px", borderRadius: 12,
            background: `${hl[1]}18`, color: hl[1], fontWeight: 600,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: hl[1],
              animation: stats.health !== "healthy" ? "pulse 1.5s infinite" : undefined }} />
            {stats.status === "active" || stats.status === "running" ? "运行中" : stats.status}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "#94a3b8" }}>
          <span>健康度 <b style={{ color: hl[1], fontSize: 16 }}>{healthPct}%</b></span>
          <span>运行 {fmtDuration(stats.uptime_s)}</span>
          <span style={{ opacity: 0.5 }}>自动刷新 8s</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12, marginBottom: 20,
      }}>
        {[
          { label: "节点总数", value: stats.node_count, color: "#3b82f6" },
          { label: "活跃节点", value: `${busyCount} / ${stats.node_count}`, color: "#22c55e" },
          { label: "已完成任务", value: stats.total_tasks_completed ?? 0, color: "#8b5cf6" },
          { label: "消息总量", value: stats.total_messages_exchanged ?? 0, color: "#f59e0b" },
          { label: "待处理消息", value: stats.pending_messages ?? 0, color: stats.pending_messages > 0 ? "#ef4444" : "#64748b" },
          { label: "待审批", value: stats.pending_approvals ?? 0, color: stats.pending_approvals > 0 ? "#f97316" : "#64748b" },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: "#1e293b", borderRadius: 10, padding: "16px 18px",
            border: "1px solid #334155",
          }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Middle Row: Status Distribution + Department Workload */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20,
      }}>
        {/* Node Status Distribution */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>节点状态分布</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {(["idle", "busy", "error", "frozen", "waiting"] as const).map(st => {
              const count = nodeStats[st] || 0;
              const pct = stats.node_count > 0 ? (count / stats.node_count) * 100 : 0;
              return (
                <div key={st} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", background: STATUS_DOT[st] || "#64748b",
                    flexShrink: 0,
                  }} />
                  <span style={{ width: 40, fontSize: 12, color: "#cbd5e1" }}>
                    {st === "idle" ? "空闲" : st === "busy" ? "忙碌" : st === "error" ? "错误" : st === "frozen" ? "冻结" : "等待"}
                  </span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#334155", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      background: STATUS_DOT[st] || "#64748b",
                      width: `${pct}%`,
                      transition: "width 0.5s",
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: "#94a3b8", width: 24, textAlign: "right" }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Workload */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>部门工作量</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {Object.entries(deptWorkload).length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 12 }}>暂无部门数据</div>
            ) : (
              Object.entries(deptWorkload)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([dept, wl]) => {
                  const totalNodes = stats.node_count || 1;
                  const pct = Math.round((wl.total / totalNodes) * 100);
                  return (
                    <div key={dept} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 60, fontSize: 12, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {dept}
                      </span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#334155", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 3, background: "#6366f1",
                          width: `${pct}%`, transition: "width 0.5s",
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#94a3b8", width: 36, textAlign: "right" }}>{pct}%</span>
                      {wl.busy > 0 && (
                        <span style={{ fontSize: 10, color: "#3b82f6", background: "#3b82f620", padding: "1px 5px", borderRadius: 4 }}>
                          {wl.busy}忙
                        </span>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Task Flow + Alerts + Blackboard */}
      <div style={{
        display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 20,
      }}>
        {/* Recent Task Flow */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>实时任务流</div>
          <div style={{ marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
            {recentTasks.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 12 }}>暂无任务记录</div>
            ) : (
              recentTasks.map((t, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
                  borderBottom: "1px solid #1e293b", fontSize: 12,
                }}>
                  <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 10, flexShrink: 0, width: 36 }}>
                    {fmtTime(t.t)}
                  </span>
                  <span style={{ color: "#cbd5e1", flexShrink: 0 }}>{(t.from || "").slice(0, 10)}</span>
                  <span style={{ color: "#64748b" }}>→</span>
                  <span style={{ color: "#cbd5e1", flexShrink: 0 }}>{(t.to || "").slice(0, 10)}</span>
                  <span style={{ color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.task}
                  </span>
                  <span style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: 4, flexShrink: 0,
                    background: t.status === "accepted" ? "#22c55e20" : t.status === "delivered" ? "#3b82f620" : t.status === "rejected" ? "#ef444420" : t.status === "timeout" ? "#f59e0b20" : "#6366f120",
                    color: t.status === "accepted" ? "#22c55e" : t.status === "delivered" ? "#3b82f6" : t.status === "rejected" ? "#ef4444" : t.status === "timeout" ? "#f59e0b" : "#6366f1",
                  }}>
                    {t.status === "accepted" ? "已验收" : t.status === "delivered" ? "已交付" : t.status === "rejected" ? "已打回" : t.status === "timeout" ? "超时" : "进行中"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Anomaly Alerts */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>
            异常告警
            {anomalies.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, color: "#ef4444", fontWeight: 700 }}>
                {anomalies.length}
              </span>
            )}
          </div>
          <div style={{ marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
            {anomalies.length === 0 ? (
              <div style={{ color: "#22c55e", fontSize: 12 }}>一切正常</div>
            ) : (
              anomalies.map((a, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 6, padding: "5px 0",
                  borderBottom: "1px solid #1e293b", fontSize: 12,
                }}>
                  <span style={{
                    color: a.type === "error" ? "#ef4444" : a.type === "stuck" ? "#f59e0b" : "#3b82f6",
                    flexShrink: 0,
                  }}>
                    {a.type === "error" ? "●" : "▲"}
                  </span>
                  <span style={{ color: "#cbd5e1" }}>
                    <b>{a.role_title || a.node_id}</b> {a.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Blackboard */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>最新黑板记录</div>
          <div style={{ marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
            {recentBB.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 12 }}>暂无记录</div>
            ) : (
              recentBB.map((b, i) => (
                <div key={i} style={{
                  padding: "5px 0", borderBottom: "1px solid #1e293b", fontSize: 12,
                }}>
                  <span style={{
                    fontSize: 10, padding: "1px 5px", borderRadius: 3, marginRight: 6,
                    background: b.memory_type === "decision" ? "#8b5cf620" : b.memory_type === "progress" ? "#3b82f620" : "#f59e0b20",
                    color: b.memory_type === "decision" ? "#8b5cf6" : b.memory_type === "progress" ? "#3b82f6" : "#f59e0b",
                  }}>
                    {b.memory_type === "decision" ? "决策" : b.memory_type === "progress" ? "进度" : b.memory_type === "fact" ? "事实" : b.memory_type}
                  </span>
                  <span style={{ color: "#94a3b8" }}>{b.source_node}: </span>
                  <span style={{ color: "#cbd5e1" }}>{b.content}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Node Status Grid */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>各节点实时状态</div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 8, marginTop: 10,
        }}>
          {perNode.filter((n: any) => !n.is_clone).map((n: any) => {
            const color = STATUS_DOT[n.status] || "#64748b";
            return (
              <div
                key={n.id}
                onClick={() => onNodeClick?.(n.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 8,
                  background: "#1e293b", border: "1px solid #334155",
                  cursor: onNodeClick ? "pointer" : undefined,
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#334155")}
              >
                <OrgAvatar avatarId={null} size={32} statusColor={color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: "#f1f5f9",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {n.role_title || n.id}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {n.department || ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%", background: color,
                      animation: n.status === "busy" ? "pulse 1.5s infinite" : undefined,
                    }} />
                    <span style={{ fontSize: 11, color }}>
                      {n.status === "idle" ? "空闲" : n.status === "busy" ? "忙碌" : n.status === "error" ? "错误" : n.status === "frozen" ? "冻结" : n.status}
                    </span>
                  </div>
                  {n.pending_messages > 0 && (
                    <span style={{ fontSize: 10, color: "#f59e0b" }}>待处理: {n.pending_messages}</span>
                  )}
                  {n.current_task ? (
                    <span style={{
                      fontSize: 10, color: "#94a3b8", maxWidth: 120,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {n.current_task}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: "#475569" }}>
                      {fmtIdle(n.idle_seconds)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#1e293b",
  borderRadius: 10,
  padding: 16,
  border: "1px solid #334155",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#94a3b8",
  display: "flex",
  alignItems: "center",
};
