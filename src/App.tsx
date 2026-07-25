import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AppShell } from './components/AppShell';
import { Spinner } from './components/ui';
import { LoginPage } from './pages/auth/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const IncidentsPage = lazy(() => import('./pages/incidents/IncidentsPage').then((m) => ({ default: m.IncidentsPage })));
const NewIncidentPage = lazy(() => import('./pages/incidents/NewIncidentPage').then((m) => ({ default: m.NewIncidentPage })));
const IncidentWorkspace = lazy(() => import('./pages/incidents/workspace/IncidentWorkspace').then((m) => ({ default: m.IncidentWorkspace })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const DefaultsPage = lazy(() => import('./pages/DefaultsPage').then((m) => ({ default: m.DefaultsPage })));
const HvaPage = lazy(() => import('./pages/preparedness/HvaPage').then((m) => ({ default: m.HvaPage })));
const PlansPage = lazy(() => import('./pages/preparedness/PlansPage').then((m) => ({ default: m.PlansPage })));
const PlanBuilderPage = lazy(() => import('./pages/preparedness/PlanBuilderPage').then((m) => ({ default: m.PlanBuilderPage })));
const ExercisesPage = lazy(() => import('./pages/preparedness/ExercisesPage').then((m) => ({ default: m.ExercisesPage })));
const AarPage = lazy(() => import('./pages/preparedness/AarPage').then((m) => ({ default: m.AarPage })));
const CapaPage = lazy(() => import('./pages/preparedness/CapaPage').then((m) => ({ default: m.CapaPage })));
const CompliancePage = lazy(() => import('./pages/preparedness/CompliancePage').then((m) => ({ default: m.CompliancePage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const OrgSettingsPage = lazy(() => import('./pages/admin/OrgSettingsPage').then((m) => ({ default: m.OrgSettingsPage })));
const FacilitiesPage = lazy(() => import('./pages/admin/FacilitiesPage').then((m) => ({ default: m.FacilitiesPage })));
const UsersPage = lazy(() => import('./pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })));
const CatalogPage = lazy(() => import('./pages/admin/CatalogPage').then((m) => ({ default: m.CatalogPage })));
const FormTemplatesPage = lazy(() => import('./pages/admin/FormTemplatesPage').then((m) => ({ default: m.FormTemplatesPage })));
const JobActionSheetsPage = lazy(() => import('./pages/admin/JobActionSheetsPage').then((m) => ({ default: m.JobActionSheetsPage })));
const PermissionsPage = lazy(() => import('./pages/admin/PermissionsPage').then((m) => ({ default: m.PermissionsPage })));
const BillingPage = lazy(() => import('./pages/admin/BillingPage').then((m) => ({ default: m.BillingPage })));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label="Loading…" />
    </div>
  );
}

export default function App() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Spinner label="Loading Essential HICS…" />
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
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/incidents/new" element={<NewIncidentPage />} />
          <Route path="/incidents/:incidentId/*" element={<IncidentWorkspace />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/defaults" element={<DefaultsPage />} />
          <Route path="/preparedness/hva" element={<HvaPage />} />
          <Route path="/preparedness/plans" element={<PlansPage />} />
          <Route path="/preparedness/plan-builder" element={<PlanBuilderPage />} />
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
          <Route path="/admin/jas" element={<JobActionSheetsPage />} />
          <Route path="/admin/permissions" element={<PermissionsPage />} />
          <Route path="/admin/billing" element={<BillingPage />} />
          <Route path="/admin/audit" element={<AuditLogPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
