"use client";

import {
  changeOrganizationPasscodeFromTopAction,
  deleteOrganizationFromTopAction,
  suspendOrganizationFromTopAction,
} from "@/app/actions";

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

      <form action={changeOrganizationPasscodeFromTopAction} className="stack-form">
        <label>
          <span>団体コード</span>
          <input name="organization_code" required />
        </label>
        <label>
          <span>新しい団体パスコード</span>
          <input name="new_admin_passcode" type="password" autoComplete="new-password" required minLength={4} />
        </label>
        <SiteAdminFields />
        <button className="secondary-button" type="submit">
          団体パスコードを変更
        </button>
      </form>

      <form
        action={suspendOrganizationFromTopAction}
        className="stack-form member-control-form"
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
        <SiteAdminFields />
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
        <SiteAdminFields />
        <button className="danger-button" type="submit">
          団体を削除
        </button>
      </form>
    </details>
  );
}
