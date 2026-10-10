import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", label: "Home", icon: "🏠", end: true },
  { to: "/courses", label: "Courses", icon: "🗺️" },
  { to: "/round/new", label: "Play", icon: "⛳" },
  { to: "/players", label: "Friends", icon: "👥" },
  { to: "/stats", label: "Stats", icon: "📈" },
];

export function NavBar() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md grid grid-cols-5">
        {tabs.map((tab) => {
          const isPlay = tab.to === "/round/new";
          if (isPlay) {
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className="flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold text-slate-500"
              >
                <span className="w-14 h-14 -mt-6 rounded-full bg-green-700 text-white flex items-center justify-center text-3xl leading-none shadow-lg border-4 border-white">
                  {tab.icon}
                </span>
                {tab.label}
              </NavLink>
            );
          }
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium ${
                  isActive ? "text-green-700" : "text-slate-500"
                }`
              }
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              {tab.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
