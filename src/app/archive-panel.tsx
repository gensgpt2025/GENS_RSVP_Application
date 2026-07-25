"use client";

import { useState } from "react";
import { Archive, Download, FileSpreadsheet, Trash2 } from "lucide-react";

type ArchiveFormat = "json" | "csv";

export function ArchivePanel() {
  const [organizationCode, setOrganizationCode] = useState("");
  const [year, setYear] = useState("");
  const [siteAdminUsername, setSiteAdminUsername] = useState("sugaya");
  const [siteAdminPassword, setSiteAdminPassword] = useState("");
  const [downloadedArchive, setDownloadedArchive] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const archiveKey = `${organizationCode.trim().toUpperCase()}:${year.trim()}`;
  const deletionEnabled = downloadedArchive === archiveKey && Boolean(year.trim());

  function requestBody(action: "download" | "delete", format?: ArchiveFormat) {
    return {
      action,
      format,
      organizationCode: organizationCode.trim(),
      year: year.trim(),
      siteAdminUsername: siteAdminUsername.trim(),
      siteAdminPassword,
      confirmation: action === "delete" ? archiveKey : undefined,
    };
  }

  async function downloadArchive(format: ArchiveFormat) {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/organization/archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody("download", format)),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(result?.error || "アーカイブできませんでした。団体コード、年度、サイト管理者情報を確認してください。");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${organizationCode.trim().toUpperCase()}-archive-${year.trim()}.${format}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);

      if (format === "json") {
        setDownloadedArchive(archiveKey);
        setMessage("復旧用JSONを保存しました。この年度の削除が可能になりました。");
      } else {
        setMessage("確認用CSVを保存しました。削除前に復旧用JSONも保存してください。");
      }
    } catch {
      setMessage("アーカイブ処理で通信エラーが発生しました。");
    } finally {
      setBusy(false);
    }
  }

  async function deleteArchive() {
    if (!deletionEnabled) return;

    const confirmed = window.confirm(
      `${organizationCode.trim().toUpperCase()}の${year.trim()}年度にある終了済み予定と出欠回答を削除しますか？\nこの操作は取り消せません。`,
    );
    if (!confirmed) return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/organization/archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody("delete")),
      });
      const result = (await response.json()) as { error?: string; deletedEvents?: number };

      if (!response.ok) {
        setMessage(result.error || "削除できませんでした。サイト管理者情報を確認してください。");
        return;
      }

      setDownloadedArchive("");
      setMessage(`${year.trim()}年度の終了済み予定を${result.deletedEvents ?? 0}件削除しました。メンバーは削除していません。`);
    } catch {
      setMessage("削除処理で通信エラーが発生しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="archive-panel">
      <div className="archive-panel-heading">
        <Archive size={18} />
        <h3>年度別アーカイブ</h3>
      </div>

      <form
        className="stack-form"
        onSubmit={(event) => {
          event.preventDefault();
          void downloadArchive("json");
        }}
      >
        <label>
          <span>団体コード</span>
          <input
            value={organizationCode}
            onChange={(event) => {
              setOrganizationCode(event.target.value.toUpperCase());
              setDownloadedArchive("");
            }}
            required
          />
        </label>
        <label>
          <span>対象年度（予定開始年）</span>
          <input
            type="number"
            min="2000"
            max="2100"
            value={year}
            onChange={(event) => {
              setYear(event.target.value);
              setDownloadedArchive("");
            }}
            required
          />
        </label>
        <label>
          <span>サイト管理者ID</span>
          <input value={siteAdminUsername} onChange={(event) => setSiteAdminUsername(event.target.value)} autoComplete="username" required />
        </label>
        <label>
          <span>サイト管理者パスワード</span>
          <input
            type="password"
            value={siteAdminPassword}
            onChange={(event) => setSiteAdminPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <div className="archive-actions">
          <button className="secondary-button" type="submit" disabled={busy}>
            <Download size={18} />
            復旧用JSON
          </button>
          <button className="secondary-button" type="button" onClick={() => void downloadArchive("csv")} disabled={busy}>
            <FileSpreadsheet size={18} />
            確認用CSV
          </button>
        </div>

        <button className="danger-button" type="button" onClick={() => void deleteArchive()} disabled={busy || !deletionEnabled}>
          <Trash2 size={18} />
          ダウンロード済み年度を削除
        </button>
      </form>

      {message ? <p className="form-message archive-message">{message}</p> : null}
    </section>
  );
}
