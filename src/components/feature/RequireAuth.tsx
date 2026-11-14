import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from './AppLayout';

export default function RequireAuth() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-50">
        <div className="flex items-center gap-2 text-foreground-500">
          <i className="ri-loader-4-line animate-spin text-xl"></i>
          <span className="text-sm">Chargement...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout />;
}