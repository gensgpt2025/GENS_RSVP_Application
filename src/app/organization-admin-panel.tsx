"use client";

import { deleteOrganizationFromTopAction } from "@/app/actions";
import { OrganizationCodeForm } from "@/app/organization-code-form";
import { OrganizationForm } from "@/app/organization-form";

function SiteAdminFields() {
  return (
    <>
      <label>
        <span>サイト管理者ID</span>
        <input name="site_admin_username" defaultValue="sugaya" autoComplete="username" required />
      </label>
      <label>
        <span>サイト管理者パスワード</span>
        <input name="site_admin_password" type="password" autoComplete="current-password" required />
      </label>
    </>
  );
}

export function OrganizationAdminPanel() {
  return (
    <details className="organization-create-panel">
      <summary>団体管理</summary>

      <OrganizationForm embedded />

      <OrganizationCodeForm />

      <form
        action={deleteOrganizationFromTopAction}
        className="stack-form member-control-form"
        onSubmit={(event) => {
          if (!window.confirm("団体と関連データをすべて削除します。取り消せません。")) {
            event.preventDefault();
          }
        }}
      >
        <label>
          <span>団体コード</span>
          <input name="organization_code" required />
        </label>
        <label>
          <span>団体コード確認</span>
          <input name="confirmation_code" required />
        </label>
        <SiteAdminFields />
        <button className="danger-button" type="submit">
          団体を削除
        </button>
      </form>
    </details>
  );
}
