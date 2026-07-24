import { ArrowLeft, Shield } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { eventYear, formatEventRange } from "@/lib/calendar";
import { attendeeNames, countByStatus, eventDisplayTitle, getEventsWithRsvps } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="app-shell">
        <div className="tool-panel">
          <p className="empty-state">ログイン後に過去ログを確認できます。</p>
          <a className="primary-button" href="/">
            ログインへ
          </a>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const selectedYear = params.year?.match(/^\d{4}$/)?.[0] ?? "";
  const allEvents = await getEventsWithRsvps(user.organization_id, "past");
  const events = selectedYear ? allEvents.filter((event) => eventYear(event.start_at) === selectedYear) : allEvents;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Archive</p>
          <h1>{selectedYear ? `${selectedYear}年度 過去ログ` : "過去ログ"}</h1>
        </div>
        <div className="user-chip">
          <a className="ghost-button" href="/calendar">
            カレンダー
          </a>
          <a className="ghost-button" href="/">
            <ArrowLeft size={16} />
            戻る
          </a>
          <Shield size={16} />
          <span>{user.name}</span>
          <form action={logoutAction}>
            <button className="ghost-button" type="submit">
              退出
            </button>
          </form>
        </div>
      </header>

      <section className="history-panel">
        {events.length === 0 ? (
          <p className="empty-state">{selectedYear ? `${selectedYear}年度の終了済みイベントはありません。` : "終了済みイベントはまだありません。"}</p>
        ) : (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>イベント</th>
                  <th>場所</th>
                  <th>出席者</th>
                  <th>出席</th>
                  <th>欠席</th>
                  <th>未定</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const attendees = attendeeNames(event.rsvps);
                  return (
                    <tr id={`event-${event.id}`} key={event.id}>
                      <td>{formatEventRange(event.start_at, event.end_at)}</td>
                      <td>{eventDisplayTitle(event)}</td>
                      <td>{event.location || "-"}</td>
                      <td>{attendees.length > 0 ? attendees.join("、") : "-"}</td>
                      <td>{countByStatus(event.rsvps, "attending")}</td>
                      <td>{countByStatus(event.rsvps, "declined")}</td>
                      <td>{countByStatus(event.rsvps, "maybe")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
