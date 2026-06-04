export type Role = "admin" | "member";
export type RsvpStatus = "attending" | "declined" | "maybe";

export type Organization = {
  id: string;
  name: string;
  code: string;
  admin_passcode_hash: string;
  active: boolean;
  created_at: string;
};

export type Member = {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  created_at: string;
};

export type EventItem = {
  id: string;
  organization_id: string;
  sheet_id: string | null;
  title: string;
  event_type?: string;
  opponent?: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  created_by: string | null;
  created_at: string;
};

export type Rsvp = {
  event_id: string;
  user_id: string;
  member_name?: string;
  status: RsvpStatus;
  note: string | null;
  updated_at: string;
};

export type SessionUser = Member & {
  organization_name: string;
  organization_code: string;
};
