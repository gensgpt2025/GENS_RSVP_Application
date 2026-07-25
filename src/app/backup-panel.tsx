"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { ArchivePanel } from "@/app/archive-panel";
import { SiteAdminOverviewPanel } from "@/app/site-admin-overview-panel";

export function BackupPanel() {
  const [message, setMessage] = useState("");

  async function downloadBackup(formData: FormData) {
    setMessage("");
    const organizationCode = String(formData.get("organization_code") ?? "").trim();
    const siteAdminUsername = String(formData.get("site_admin_username") ?? "").trim();
    const siteAdminPassword = String(formData.get("site_admin_password") ?? "");
    const response = await fetch("/api/organization/backup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "download", organizationCode, siteAdminUsername, siteAdminPassword }),
    });
    if (!response.ok) {
      setMessage("バックアップできませんでした。団体コードとサイト管理者情報を確認してください。");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${organizationCode.toUpperCase()}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("バックアップファイルを保存しました。");
  }

  async function restoreBackup(formData: FormData) {
    setMessage("");
    const organizationCode = String(formData.get("organization_code") ?? "").trim();
    const siteAdminUsername = String(formData.get("site_admin_username") ?? "").trim();
    const siteAdminPassword = String(formData.get("site_admin_password") ?? "");
    const file = formData.get("backup_file");
    if (!(file instanceof File)) return;

    try {
      const backup = JSON.parse(await file.text());
      const response = await fetch("/api/organization/backup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationCode, siteAdminUsername, siteAdminPassword, backup }),
      });

      setMessage(
        response.ok
          ? "復旧しました。団体コードで入室して内容を確認してください。"
          : "復旧できませんでした。団体コード、サイト管理者情報、ファイルを確認してください。",
      );
    } catch {
      setMessage("復旧できませんでした。JSON形式のバックアップファイルを選んでください。");
    }
  }

  return (
    <details className="organization-create-panel">
      <summary>バックアップ / 復旧</summary>

      <SiteAdminOverviewPanel embedded />

      <ArchivePanel />

      <form action={downloadBackup} className="stack-form">
        <label>
          <span>団体コード</span>
          <input name="organization_code" required />
        </label>
        <label>
          <span>サイト管理者ID</span>
          <input name="site_admin_username" defaultValue="sugaya" autoComplete="username" required />
        </label>
        <label>
          <span>サイト管理者パスワード</span>
          <input name="site_admin_password" type="password" autoComplete="current-password" required />
        </label>
        <button className="secondary-button" type="submit">
          <Download size={18} />
          バックアップ
        </button>
      </form>

      <form action={restoreBackup} className="stack-form member-control-form">
        <label>
          <span>団体コード</span>
          <input name="organization_code" required />
        </label>
        <label>
          <span>サイト管理者ID</span>
          <input name="site_admin_username" defaultValue="sugaya" autoComplete="username" required />
        </label>
        <label>
          <span>サイト管理者パスワード</span>
          <input name="site_admin_password" type="password" autoComplete="current-password" required />
        </label>
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
    </details>
  );
}
