type AuthStatusPillProps = {
  username: string;
  role: string;
};

export function AuthStatusPill({ username, role }: AuthStatusPillProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[#E8E1D2] bg-white/90 px-3 py-2 shadow-sm">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2C2C2C] text-xs font-semibold text-white">
        {username.slice(0, 1).toUpperCase()}
      </div>
      <div className="leading-tight">
        <div className="text-sm font-medium text-[#2C2C2C]">{username}</div>
        <div className="text-xs uppercase tracking-[0.2em] text-[#A07C1A]">{role}</div>
      </div>
    </div>
  );
}