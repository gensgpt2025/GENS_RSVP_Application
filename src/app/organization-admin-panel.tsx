"use client";

import { deleteOrganizationFromTopAction, suspendOrganizationFromTopAction } from "@/app/actions";

export function OrganizationAdminPanel() {
  return (
    <details className="organization-create-panel">
      <summary>団体管理</summary>

      <form
        action={suspendOrganizationFromTopAction}
        className="stack-form"
        onSubmit={(event) => {
          if (!window.confirm("この団体を休止しますか？休止後はログインできなくなります。")) {
            event.preventDefault();
          }
        }}
      >
        <label>
          <span>団体コード</span>
          <input name="organization_code" required />
        </label>
        <label>
          <span>管理者パスコード</span>
          <input name="admin_passcode" type="password" autoComplete="current-password" required />
        </label>
        <button className="danger-button" type="submit">
          団体を休止
        </button>
      </form>

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
        <label>
          <span>管理者パスコード</span>
          <input name="admin_passcode" type="password" autoComplete="current-password" required />
        </label>
        <button className="danger-button" type="submit">
          団体を削除
        </button>
      </form>
    </details>
  );
}
