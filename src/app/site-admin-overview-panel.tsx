"use client";

import { useActionState } from "react";
import { Search } from "lucide-react";
import { getSiteAdminOverviewAction, type SiteAdminOverviewState } from "@/app/actions";

const initialState: SiteAdminOverviewState = {
  message: "",
  organizations: [],
};

function formatRange(start: string, end: string) {
  const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
  const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  });

  return `${dateFormatter.format(new Date(start))}-${timeFormatter.format(new Date(end))}`;
}

type SiteAdminOverviewPanelProps = {
  embedded?: boolean;
};

export function SiteAdminOverviewPanel({ embedded = false }: SiteAdminOverviewPanelProps) {
  const [state, action, pending] = useActionState(getSiteAdminOverviewAction, initialState);

  const content = (
    <>
      <form action={action} className="stack-form">
        <label>
          <span>サイト管理者ID</span>
          <input name="site_admin_username" defaultValue="sugaya" autoComplete="username" required />
        </label>
        <label>
          <span>サイト管理者パスワード</span>
          <input name="site_admin_password" type="password" autoComplete="current-password" required />
        </label>
        <button className="secondary-button" type="submit" disabled={pending}>
          <Search size={18} />
          一覧を確認
        </button>
      </form>

      {state.message ? <p className="form-message">{state.message}</p> : null}

      {state.organizations.length > 0 ? (
        <div className="site-admin-list">
          {state.organizations.map((organization) => (
            <section className="site-admin-organization" key={organization.id}>
              <div className="site-admin-organization-header">
                <div>
                  <strong>{organization.name}</strong>
                  <span>{organization.code}</span>
                </div>
                <em>{organization.active ? "有効" : "無効"}</em>
              </div>

              <div className="site-admin-section">
                <h3>メンバー {organization.members.length}名</h3>
                {organization.members.length > 0 ? (
                  <div className="site-admin-tags">
                    {organization.members.map((member) => (
                      <span className={member.active ? "" : "inactive"} key={member.id}>
                        {member.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">メンバーは登録されていません。</p>
                )}
              </div>

              <div className="site-admin-section">
                <h3>スケジュール {organization.events.length}件</h3>
                {organization.events.length > 0 ? (
                  <div className="site-admin-events">
                    {organization.events.map((event) => (
                      <div className="site-admin-event-row" key={event.id}>
                        <strong>{event.title}</strong>
                        <span>{formatRange(event.start_at, event.end_at)}</span>
                        {event.location ? <span>{event.location}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">スケジュールは登録されていません。</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <section className="site-admin-overview embedded-overview">
        <h3>管理者一覧確認</h3>
        {content}
      </section>
    );
  }

  return (
    <details className="organization-create-panel site-admin-overview">
      <summary>管理者一覧確認</summary>
      {content}
    </details>
  );
}
