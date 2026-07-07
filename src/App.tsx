import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AppShell } from './components/AppShell';
import { Spinner } from './components/ui';
import { LoginPage } from './pages/auth/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentsPage } from './pages/incidents/IncidentsPage';
import { NewIncidentPage } from './pages/incidents/NewIncidentPage';
import { IncidentWorkspace } from './pages/incidents/workspace/IncidentWorkspace';
import { NotificationsPage } from './pages/NotificationsPage';
import { HvaPage } from './pages/preparedness/HvaPage';
import { PlansPage } from './pages/preparedness/PlansPage';
import { ExercisesPage } from './pages/preparedness/ExercisesPage';
import { AarPage } from './pages/preparedness/AarPage';
import { CapaPage } from './pages/preparedness/CapaPage';
import { CompliancePage } from './pages/preparedness/CompliancePage';
import { ReportsPage } from './pages/ReportsPage';
import { OrgSettingsPage } from './pages/admin/OrgSettingsPage';
import { FacilitiesPage } from './pages/admin/FacilitiesPage';
import { UsersPage } from './pages/admin/UsersPage';
import { CatalogPage } from './pages/admin/CatalogPage';
import { FormTemplatesPage } from './pages/admin/FormTemplatesPage';
import { PermissionsPage } from './pages/admin/PermissionsPage';
import { BillingPage } from './pages/admin/BillingPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';

export default function App() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Spinner label="Loading HICS Command…" />
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Signed in but not yet part of an organization → onboarding wizard.
  if (!profile?.tenant_id) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/incidents/new" element={<NewIncidentPage />} />
        <Route path="/incidents/:incidentId/*" element={<IncidentWorkspace />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/preparedness/hva" element={<HvaPage />} />
        <Route path="/preparedness/plans" element={<PlansPage />} />
        <Route path="/preparedness/exercises" element={<ExercisesPage />} />
        <Route path="/preparedness/aar" element={<AarPage />} />
        <Route path="/preparedness/capa" element={<CapaPage />} />
        <Route path="/preparedness/compliance" element={<CompliancePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/admin/organization" element={<OrgSettingsPage />} />
        <Route path="/admin/facilities" element={<FacilitiesPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/catalog" element={<CatalogPage />} />
        <Route path="/admin/forms" element={<FormTemplatesPage />} />
        <Route path="/admin/permissions" element={<PermissionsPage />} />
        <Route path="/admin/billing" element={<BillingPage />} />
        <Route path="/admin/audit" element={<AuditLogPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
