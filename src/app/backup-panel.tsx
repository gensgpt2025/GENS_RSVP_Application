"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";

export function BackupPanel() {
  const [message, setMessage] = useState("");

  async function downloadBackup() {
    setMessage("");
    const response = await fetch("/api/organization/backup");
    if (!response.ok) {
      setMessage("バックアップできませんでした。");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `organization-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function restoreBackup(formData: FormData) {
    setMessage("");
    const file = formData.get("backup_file");
    if (!(file instanceof File)) return;

    const backup = JSON.parse(await file.text());
    const response = await fetch("/api/organization/backup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ backup }),
    });

    setMessage(response.ok ? "復旧しました。" : "復旧できませんでした。ファイルを確認してください。");
  }

  return (
    <section className="tool-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Backup</p>
          <h2>バックアップ / 復旧</h2>
        </div>
      </div>
      <form action={downloadBackup} className="stack-form">
        <button className="secondary-button" type="submit">
          <Download size={18} />
          バックアップ
        </button>
      </form>
      <form action={restoreBackup} className="stack-form member-control-form">
        <label>
          <span>バックアップファイル</span>
          <input name="backup_file" type="file" accept="application/json,.json" required />
        </label>
        <button className="secondary-button" type="submit">
          <Upload size={18} />
          復旧
        </button>
      </form>
      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}
