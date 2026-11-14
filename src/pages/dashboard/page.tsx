import { useAuth } from '@/hooks/useAuth';
import AdminDashboard from './components/AdminDashboard';
import AgentDashboard from './components/AgentDashboard';
import LeaderDashboard from './components/LeaderDashboard';

/**
 * Aiguilleur de tableau de bord : chaque rôle dispose de sa propre interface.
 * - Agent de présence : pointage minimal.
 * - Responsable de communauté : statistiques limitées à sa communauté.
 * - Autres rôles : tableau de bord complet.
 */
export default function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === 'attendance_agent') {
    return <AgentDashboard />;
  }

  if (user?.role === 'community_leader') {
    return <LeaderDashboard />;
  }

  return <AdminDashboard />;
}