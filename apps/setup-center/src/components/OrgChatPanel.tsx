/**
 * Reusable chat panel for organization-level or node-level conversations.
 * Renders a scrollable message list, input box, and real-time WS progress.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { safeFetch } from "../providers";
import { onWsEvent } from "../platform";

interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  streaming?: boolean;
}

interface OrgChatPanelProps {
  orgId: string;
  nodeId?: string | null;
  apiBaseUrl: string;
  /** Compact mode for side panels (smaller font, less padding) */
  compact?: boolean;
}

let _seq = 0;
function genId() {
  return `orgchat-${Date.now()}-${++_seq}`;
}

export function OrgChatPanel({ orgId, nodeId, apiBaseUrl, compact }: OrgChatPanelProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMsg = { id: genId(), role: "user", content: text, timestamp: Date.now() };
    const placeholderId = genId();
    const placeholder: ChatMsg = {
      id: placeholderId, role: "assistant", content: "⏳ 执行中...", timestamp: Date.now(), streaming: true,
    };
    setMessages(prev => [...prev, userMsg, placeholder]);
    setInput("");
    setSending(true);

    const progressLines: string[] = [];
    const pushProgress = (line: string) => {
      progressLines.push(line);
      const preview = progressLines.slice(-8).map(l => `> ${l}`).join("\n");
      setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, content: preview } : m));
    };

    const unsubProgress = onWsEvent((event, raw) => {
      const d = raw as Record<string, unknown> | null;
      if (!d || d.org_id !== orgId) return;
      const nid = (d.node_id || d.from_node || "") as string;
      const toN = (d.to_node || "") as string;
      if (event === "org:node_status") {
        const st = d.status as string;
        if (st === "busy") {
          const task = (d.current_task || "") as string;
          pushProgress(`🟢 **${nid}** 开始处理${task ? `：${task.slice(0, 60)}` : ""}`);
        } else if (st === "idle") pushProgress(`✅ **${nid}** 完成`);
        else if (st === "error") pushProgress(`❌ **${nid}** 出错`);
      } else if (event === "org:task_delegated") {
        pushProgress(`📋 **${nid}** → **${toN}** 分配任务：${((d.task || "") as string).slice(0, 50)}`);
      } else if (event === "org:task_complete") {
        pushProgress(`🎯 **${nid}** 任务完成`);
      } else if (event === "org:blackboard_update") {
        pushProgress(`📝 **${nid}** 更新黑板`);
      }
    });

    try {
      const res = await safeFetch(`${apiBaseUrl}/api/orgs/${orgId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, target_node_id: nodeId || undefined }),
      });
      const data = await res.json();
      const commandId = data.command_id as string | undefined;

      if (!commandId) {
        const resultText = data.result || data.error || JSON.stringify(data);
        setMessages(prev => prev.map(m =>
          m.id === placeholderId ? { ...m, content: resultText, streaming: false } : m
        ));
      } else {
        let resolved = false;
        const unsubDone = onWsEvent((evt, raw) => {
          const d = raw as Record<string, unknown> | null;
          if (evt !== "org:command_done" || !d || d.command_id !== commandId) return;
          resolved = true;
          const result = d.result as Record<string, unknown> | null;
          const error = d.error as string | undefined;
          const resultText = String((result && (result.result || result.error)) || error || JSON.stringify(d));
          const progressSummary = progressLines.length > 0
            ? progressLines.map(l => `> ${l}`).join("\n") + "\n\n---\n\n"
            : "";
          setMessages(prev => prev.map(m =>
            m.id === placeholderId ? { ...m, content: progressSummary + resultText, streaming: false } : m
          ));
        });

        let lastActivity = Date.now();
        while (!resolved) {
          await new Promise(r => setTimeout(r, 5000));
          if (resolved) break;
          try {
            const poll = await safeFetch(`${apiBaseUrl}/api/orgs/${orgId}/commands/${commandId}`);
            const pd = await poll.json();
            if (pd.status === "done" || pd.status === "error") {
              if (!resolved) {
                resolved = true;
                const resultText = pd.result?.result || pd.result?.error || pd.error || JSON.stringify(pd);
                const progressSummary = progressLines.length > 0
                  ? progressLines.map(l => `> ${l}`).join("\n") + "\n\n---\n\n"
                  : "";
                setMessages(prev => prev.map(m =>
                  m.id === placeholderId ? { ...m, content: progressSummary + resultText, streaming: false } : m
                ));
              }
            }
          } catch { /* retry */ }
          if (!resolved && Date.now() - lastActivity > 60000) {
            pushProgress("⏳ 执行时间较长，组织仍在处理中...");
            lastActivity = Date.now();
          }
        }
        unsubDone();
      }
    } catch (e: any) {
      setMessages(prev => prev.map(m =>
        m.id === placeholderId ? { ...m, content: `发送失败: ${e.message || e}`, streaming: false, role: "system" } : m
      ));
    } finally {
      unsubProgress();
      setSending(false);
    }
  }, [input, sending, orgId, nodeId, apiBaseUrl]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const pad = compact ? 6 : 10;
  const fontSize = compact ? 12 : 13;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Messages */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: pad, display: "flex", flexDirection: "column", gap: 6 }}>
        {messages.length === 0 && (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: 20, fontSize }}>
            {nodeId ? "与该节点开始对话..." : "向组织发送指令..."}
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%",
            padding: `${pad}px ${pad + 4}px`,
            borderRadius: 8,
            fontSize,
            lineHeight: 1.5,
            background: m.role === "user" ? "var(--accent)" : m.role === "system" ? "var(--danger-bg, #fee)" : "var(--bg-subtle, var(--bg-card))",
            color: m.role === "user" ? "#fff" : "var(--text)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            opacity: m.streaming ? 0.85 : 1,
          }}>
            {m.content}
            {m.streaming && <span style={{ animation: "pulse 1.5s infinite", marginLeft: 4 }}>●</span>}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        borderTop: "1px solid var(--line)",
        padding: pad,
        display: "flex",
        gap: 6,
        alignItems: "flex-end",
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={nodeId ? "输入消息..." : "输入组织指令..."}
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: `${pad - 2}px ${pad}px`,
            fontSize,
            fontFamily: "inherit",
            background: "var(--bg-input, var(--bg-app))",
            color: "var(--text)",
            outline: "none",
            maxHeight: 80,
            overflowY: "auto",
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{
            padding: `${pad - 2}px ${pad + 4}px`,
            borderRadius: 6,
            border: "none",
            background: sending || !input.trim() ? "var(--muted)" : "var(--accent)",
            color: "#fff",
            cursor: sending || !input.trim() ? "not-allowed" : "pointer",
            fontSize,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {sending ? "执行中" : "发送"}
        </button>
      </div>
    </div>
  );
}
