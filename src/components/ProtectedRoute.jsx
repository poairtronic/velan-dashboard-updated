import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function ProtectedRoute({ children, adminOnly = false, moduleId = null }) {
  const { user, isAdmin, hasModuleAccess, allowedModules, isLoading } = useAuth();

  // Wait for session verification before making routing decisions
  if (isLoading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    const firstAllowed = Array.isArray(allowedModules) && allowedModules.length > 0 
      ? (allowedModules[0] === 'overview' ? '/' : `/${allowedModules[0]}`) 
      : '/';
    return <Navigate to={firstAllowed} replace />;
  }

  if (moduleId && !isAdmin && hasModuleAccess && !hasModuleAccess(moduleId)) {
    const firstAllowed = Array.isArray(allowedModules) && allowedModules.length > 0 
      ? (allowedModules[0] === 'overview' ? '/' : `/${allowedModules[0]}`) 
      : '/login';
    return <Navigate to={firstAllowed} replace />;
  }

  return children;
}

export default React.memo(ProtectedRoute);

