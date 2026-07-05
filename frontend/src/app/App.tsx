import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { Dashboard } from './pages/Dashboard';
import { IncidentReport } from './pages/IncidentReport';
import { IncidentDetail } from './pages/IncidentDetail';
import { IncidentListPage } from './components/Incidents/IncidentListPage';
import { Patients } from './pages/Patients';
import { PatientDetail } from './pages/PatientDetail';
import { PEPSchedule } from './pages/PEPSchedule';
import { Inventory } from './pages/Inventory';
import { GISMap } from './pages/GISMap';
import { MobileGISMap } from './pages/MobileGISMap';
import { Reports } from './pages/Reports';
import { Users } from './pages/Users';
import { Settings } from './pages/Settings';
import { Notifications } from './pages/Notifications';
import { AuditLog } from './pages/AuditLog';
import { PublicPortal } from './pages/PublicPortal';
import { PublicHeatmap } from './pages/PublicHeatmap';
import { PublicStatistics } from './pages/PublicStatistics';
import { PublicClinics } from './pages/PublicClinics';
import { MainLayout } from './components/Layout/MainLayout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { canAccessPath, getDefaultPathForRole, getStoredUser, hasAuthSession } from '../lib/auth/roleAccess';

function DefaultEntry() {
  const user = getStoredUser();

  if (hasAuthSession() && user) {
    return <Navigate to={getDefaultPathForRole(user.role)} replace />;
  }

  return <Navigate to="/login" replace />;
}

function RequireAuth() {
  const location = useLocation();
  const user = getStoredUser();

  if (!hasAuthSession() || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <MainLayout />;
}

function RoleRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const user = getStoredUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessPath(user.role, location.pathname)) {
    return <Navigate to={getDefaultPathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DefaultEntry />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/public" element={<PublicPortal />} />
          <Route path="/public/heatmap" element={<PublicHeatmap />} />
          <Route path="/public/statistics" element={<PublicStatistics />} />
          <Route path="/public/clinics" element={<PublicClinics />} />

          <Route path="/mobile-map" element={<MobileGISMap />} />

          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<RoleRoute><Dashboard /></RoleRoute>} />
            <Route path="/incidents" element={<RoleRoute><IncidentListPage /></RoleRoute>} />
            <Route path="/incidents/new" element={<RoleRoute><IncidentReport /></RoleRoute>} />
            <Route path="/incidents/:id/edit" element={<RoleRoute><IncidentReport /></RoleRoute>} />
            <Route path="/incidents/:id" element={<RoleRoute><IncidentDetail /></RoleRoute>} />
            <Route path="/patients" element={<RoleRoute><Patients /></RoleRoute>} />
            <Route path="/patients/:id" element={<RoleRoute><PatientDetail /></RoleRoute>} />
            <Route path="/pep-schedule" element={<RoleRoute><PEPSchedule /></RoleRoute>} />
            <Route path="/inventory" element={<RoleRoute><Inventory /></RoleRoute>} />
            <Route path="/gis-map" element={<RoleRoute><GISMap /></RoleRoute>} />
            <Route path="/reports" element={<RoleRoute><Reports /></RoleRoute>} />
            <Route path="/notifications" element={<RoleRoute><Notifications /></RoleRoute>} />
            <Route path="/audit-logs" element={<RoleRoute><AuditLog /></RoleRoute>} />
            <Route path="/users" element={<RoleRoute><Users /></RoleRoute>} />
            <Route path="/settings" element={<RoleRoute><Settings /></RoleRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
