import { useEffect, useState } from "react";
import { api } from "./api";
import type { UserProfile } from "./types";
type Member = { id: string; name: string; role: string; profile: UserProfile };
export function ProfileAdmin({ onSaved }: { onSaved: () => void }) {
  const [members, setMembers] = useState<Member[]>([]),
    [selected, setSelected] = useState(""),
    [draft, setDraft] = useState<UserProfile | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ users: Member[] }>("/api/admin/profiles")
      .then(({ users }) => {
        setMembers(users);
        setSelected(users[0]?.id || "");
        setDraft(users[0]?.profile || null);
      })
      .catch((err) => setError(err.message));
  }, []);
  return (
    <section className="people-page">
      <div className="view-top">
        <div className="breadcrumb">Your space / User profiles</div>
        <span className="page-tag">ADMINISTRATOR</span>
      </div>
      <h1>Every curious mind.</h1>
      <p>
        Set personal context and audience guidance for each family member. Only
        administrators can change these settings.
      </p>
      <div className="people-layout">
        <nav className="people-users panel-scroll" aria-label="Family members">
          {members.map((member) => (
            <button
              key={member.id}
              aria-pressed={selected === member.id}
              onClick={() => {
                setSelected(member.id);
                setDraft(member.profile);
                setError("");
                setNotice("");
              }}
            >
              {member.name}
              <small>{member.role}</small>
            </button>
          ))}
        </nav>
        <div className="people-editor panel-scroll">
          {draft && (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const profile = await api<UserProfile>(
                    `/api/admin/profiles/${encodeURIComponent(selected)}`,
                    draft,
                  );
                  setMembers((current) =>
                    current.map((member) =>
                      member.id === selected ? { ...member, profile } : member,
                    ),
                  );
                  setNotice("Profile saved.");
                  onSaved();
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Preferred name
                <input
                  maxLength={100}
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </label>
              <div className="profile-facts">
                <label>
                  Sex / gender (optional)
                  <input
                    maxLength={80}
                    value={draft.sex}
                    onChange={(event) =>
                      setDraft({ ...draft, sex: event.target.value })
                    }
                  />
                </label>
                <label>
                  Age (optional)
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={draft.age ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        age:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Content level
                <select
                  value={draft.content_level}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      content_level: event.target
                        .value as UserProfile["content_level"],
                    })
                  }
                >
                  <option value="general">General · all ages</option>
                  <option value="teen">Teen · ages 13–17+</option>
                  <option value="adult">Adult · ages 18+</option>
                </select>
              </label>
              <p className="control-hint">
                Unknown age and under 13 use General guidance. Ages 13–17 are
                capped at Teen. Content levels guide prompts and restrict hole
                access; they do not classify generated images.
              </p>
              <label>
                Instructions for this user
                <textarea
                  rows={5}
                  maxLength={6000}
                  value={draft.instructions}
                  onChange={(event) =>
                    setDraft({ ...draft, instructions: event.target.value })
                  }
                  placeholder="Learning preferences, how to address them, tone, boundaries…"
                />
              </label>
              <p className="control-hint">
                Provided name, age, sex/gender and instructions are sent to the
                selected chat/enhancer model. Missing details stay missing. They
                are not automatically added to image files.
              </p>
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save profile"}
              </button>
            </form>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
        </div>
      </div>
    </section>
  );
}
