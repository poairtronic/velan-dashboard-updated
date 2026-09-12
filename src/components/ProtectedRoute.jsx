import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function ProtectedRoute({ children, adminOnly = false, moduleId = null }) {
  const { user, isAdmin, hasModuleAccess, isLoading } = useAuth();

  // Wait for session verification before making routing decisions
  if (isLoading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (moduleId && !isAdmin && hasModuleAccess && !hasModuleAccess(moduleId)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default React.memo(ProtectedRoute);

