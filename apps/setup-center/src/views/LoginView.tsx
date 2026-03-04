// ─── LoginView: Web access password login page ───

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { login } from "../platform/auth";
import logoUrl from "../assets/logo.png";

export function LoginView({
  apiBaseUrl,
  onLoginSuccess,
}: {
  apiBaseUrl: string;
  onLoginSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);

    const result = await login(password, apiBaseUrl);
    setLoading(false);

    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.error || t("login.failed"));
    }
  }, [password, apiBaseUrl, onLoginSuccess, t]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      width: "100vw",
      background: "linear-gradient(135deg, var(--bg, #f8fafc) 0%, var(--panel, #e2e8f0) 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "var(--text, #334155)",
      padding: 32,
      boxSizing: "border-box",
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: "var(--panel2, #fff)",
          borderRadius: 16,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          padding: "40px 48px",
          maxWidth: 400,
          width: "100%",
          textAlign: "center",
        }}
      >
        <img
          src={logoUrl}
          alt="OpenAkita"
          style={{ width: 56, height: 56, marginBottom: 12, borderRadius: 12 }}
        />
        <h2 style={{
          margin: "0 0 8px",
          fontSize: 20,
          fontWeight: 600,
          color: "var(--text, #1e293b)",
        }}>
          OpenAkita Web
        </h2>
        <p style={{
          margin: "0 0 24px",
          fontSize: 14,
          color: "var(--text3, #64748b)",
          lineHeight: 1.6,
        }}>
          {t("login.prompt")}
        </p>

        {error && (
          <div style={{
            background: "var(--error-bg, #fef2f2)",
            color: "var(--error, #dc2626)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
            marginBottom: 16,
            textAlign: "left",
          }}>
            {error}
          </div>
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("login.passwordPlaceholder")}
          autoFocus
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 15,
            borderRadius: 10,
            border: "1px solid var(--line, #e2e8f0)",
            background: "var(--bg, #f8fafc)",
            color: "var(--text, #1e293b)",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 16,
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--primary, #0ea5e9)"; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--line, #e2e8f0)"; }}
        />

        <button
          type="submit"
          disabled={loading || !password.trim()}
          style={{
            width: "100%",
            background: loading
              ? "var(--text3, #94a3b8)"
              : "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 0",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            boxShadow: "0 2px 8px rgba(14,165,233,0.3)",
            transition: "transform 0.1s, opacity 0.15s",
            opacity: loading || !password.trim() ? 0.7 : 1,
          }}
          onMouseDown={(e) => { if (!loading) (e.target as HTMLButtonElement).style.transform = "scale(0.97)"; }}
          onMouseUp={(e) => { (e.target as HTMLButtonElement).style.transform = ""; }}
        >
          {loading ? t("login.loggingIn") : t("login.submit")}
        </button>
      </form>

      <p style={{
        marginTop: 16,
        fontSize: 12,
        color: "var(--text3, #94a3b8)",
      }}>
        {t("login.hint")}
      </p>
    </div>
  );
}
