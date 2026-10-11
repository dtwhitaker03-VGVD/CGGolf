import { HashRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./store/AuthContext";
import { AppDataProvider, useAppData } from "./store/AppDataContext";
import { NavBar } from "./components/NavBar";
import { AuthPage } from "./pages/AuthPage";
import { HomePage } from "./pages/HomePage";
import { CoursesPage } from "./pages/CoursesPage";
import { CourseFormPage } from "./pages/CourseFormPage";
import { PlayersPage } from "./pages/PlayersPage";
import { NewRoundPage } from "./pages/NewRoundPage";
import { RoundsPage } from "./pages/RoundsPage";
import { RoundDetailPage } from "./pages/RoundDetailPage";
import { StatsPage } from "./pages/StatsPage";
import { PlayerStatsPage } from "./pages/PlayerStatsPage";
import { AboutHandicapsPage } from "./pages/AboutHandicapsPage";
import { MoneyPage } from "./pages/MoneyPage";
import { CourseDetailPage } from "./pages/CourseDetailPage";

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-500">{children}</p>
    </div>
  );
}

/** Course stats now live on the course page; keep old links working. */
function CourseStatsRedirect() {
  const { id } = useParams();
  return <Navigate to={`/courses/${id}`} replace />;
}

function AppRoutes() {
  const { loading } = useAppData();
  if (loading) return <FullScreenMessage>Loading your rounds…</FullScreenMessage>;

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 pb-20">
        <div className="mx-auto max-w-md px-4 pt-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/new" element={<CourseFormPage />} />
            <Route path="/courses/:id" element={<CourseDetailPage />} />
            <Route path="/courses/:id/edit" element={<CourseFormPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/round/new" element={<NewRoundPage />} />
            <Route path="/rounds" element={<RoundsPage />} />
            <Route path="/round/:id" element={<RoundDetailPage />} />
            <Route path="/money" element={<MoneyPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/stats/:id" element={<PlayerStatsPage />} />
            <Route path="/stats/course/:id" element={<CourseStatsRedirect />} />
            <Route path="/about-handicaps" element={<AboutHandicapsPage />} />
          </Routes>
        </div>
      </div>
      <NavBar />
    </HashRouter>
  );
}

function Gate() {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenMessage>Loading…</FullScreenMessage>;
  if (!session) return <AuthPage />;

  return (
    <AppDataProvider>
      <AppRoutes />
    </AppDataProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
