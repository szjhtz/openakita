import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { safeFetch } from "../providers";

export function WebPasswordManager({
  apiBase,
  busy,
  setBusy,
  setNotice,
  setError,
}: {
  apiBase: string;
  busy: string | null;
  setBusy: (v: string | null) => void;
  setNotice: (v: string | null) => void;
  setError: (v: string | null) => void;
}) {
  const { t } = useTranslation();
  const [hint, setHint] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [showNew, setShowNew] = useState(false);

  const loadHint = useCallback(async () => {
    try {
      const res = await safeFetch(`${apiBase}/api/auth/password-hint`);
      const data = await res.json();
      setHint(data.hint || "—");
    } catch {
      setHint(null);
    }
  }, [apiBase]);

  useEffect(() => { loadHint(); }, [loadHint]);

  const doChangePassword = async (password: string) => {
    setBusy(t("common.loading"));
    try {
      await safeFetch(`${apiBase}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: password }),
      });
      setNotice(t("adv.webPasswordChanged"));
      setNewPw("");
      await loadHint();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const doRandomize = async () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let pw = "";
    for (let i = 0; i < 16; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    await doChangePassword(pw);
    setNotice(t("adv.webPasswordReset", { password: pw }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {hint !== null && (
        <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--muted)", minWidth: 80 }}>{t("adv.webPasswordCurrent")}:</span>
          <code style={{ padding: "2px 8px", background: "var(--bg)", borderRadius: 4, fontSize: 13, letterSpacing: 1 }}>{hint}</code>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type={showNew ? "text" : "password"}
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          placeholder={t("adv.webPasswordNewPlaceholder")}
          style={{ flex: 1, minWidth: 160, fontSize: 13, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--fg)" }}
        />
        <button className="btnSmall" onClick={() => setShowNew((v) => !v)} style={{ fontSize: 12 }}>
          {showNew ? "🙈" : "👁"}
        </button>
        <button
          className="btnSmall btnSmallPrimary"
          onClick={() => { if (newPw.trim()) doChangePassword(newPw.trim()); }}
          disabled={!newPw.trim() || !!busy}
        >
          {t("adv.webPasswordSet")}
        </button>
        <button className="btnSmall" onClick={doRandomize} disabled={!!busy}>
          {t("adv.webPasswordRandomize")}
        </button>
      </div>
    </div>
  );
}
