"use client";

import { useActionState, useEffect, useState } from "react";
import { LogIn, Search } from "lucide-react";
import { loginAction } from "@/app/actions";
import type { Member } from "@/lib/types";

type LeagueCountdown = {
  daysLabel: string;
  isSoon: boolean;
  dateLabel: string;
  location: string;
  opponent: string;
} | null;

type LoginMember = Pick<Member, "id" | "name" | "role">;

export function LoginForm({ leagueCountdown }: { leagueCountdown: LeagueCountdown }) {
  const [state, action, pending] = useActionState(loginAction, { ok: false, message: "" });
  const [organizationCode, setOrganizationCode] = useState("");
  const [members, setMembers] = useState<LoginMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    const code = organizationCode.trim();
    if (code.length < 3) {
      setMembers([]);
      return;
    }

    const controller = new AbortController();
    setLoadingMembers(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/organizations/members?code=${encodeURIComponent(code)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { members?: LoginMember[] };
        setMembers(data.members ?? []);
      } catch {
        if (!controller.signal.aborted) setMembers([]);
      } finally {
        if (!controller.signal.aborted) setLoadingMembers(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [organizationCode]);

  return (
    <form action={action} className="login-panel">
      <div className="login-countdown-mobile">
        <CountdownBlock leagueCountdown={leagueCountdown} />
      </div>

      <div>
        <p className="eyebrow">Schedule / RSVP</p>
        <h1>GENS Schedule Board</h1>
        <p className="muted">団体コードを入力して、メンバー名を選択してください。</p>
      </div>

      <label>
        <span>団体コード</span>
        <div className="input-with-icon">
          <Search size={16} />
          <input name="organization_code" value={organizationCode} onChange={(event) => setOrganizationCode(event.target.value.toUpperCase())} required />
        </div>
      </label>

      <label>
        <span>メンバー</span>
        <select name="member_id" required defaultValue="" disabled={members.length === 0}>
          <option value="" disabled>
            {loadingMembers ? "読み込み中" : "名前を選択"}
          </option>
          {members.map((member) => (
            <option value={member.id} key={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>

      {state?.message ? <p className="form-message">{state.message}</p> : null}

      <button className="primary-button" type="submit" disabled={pending || members.length === 0}>
        <LogIn size={18} />
        {pending ? "確認中" : "入室"}
      </button>
    </form>
  );
}

export function CountdownBlock({ leagueCountdown }: { leagueCountdown: LeagueCountdown }) {
  return (
    <div className="countdown-card">
      <p className="eyebrow">Next League Match</p>
      <span className="countdown-kicker">公式戦まで</span>
      <strong>{leagueCountdown?.isSoon ? `あと ${leagueCountdown.daysLabel}` : "積み上げよう"}</strong>
      {leagueCountdown?.isSoon ? (
        <div className="countdown-details">
          <span>{leagueCountdown.dateLabel}</span>
          {leagueCountdown.opponent ? <span>vs {leagueCountdown.opponent}</span> : null}
          {leagueCountdown.location ? <span>{leagueCountdown.location}</span> : null}
        </div>
      ) : null}
      <p className="countdown-message">
        Switch Zero, Fight Hard.
        <br />
        - 0秒切替・最強理解 -
      </p>
    </div>
  );
}
