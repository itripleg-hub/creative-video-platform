import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { ProtectedRoute } from '@/shared/components/layout/ProtectedRoute';
import { RouteErrorPage } from '@/shared/components/RouteErrorPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { AccountPage } from '@/features/auth/AccountPage';
import { TemplateListPage } from '@/features/templates/TemplateListPage';
import { TemplateFormPage } from '@/features/templates/TemplateFormPage';
import { EditorPage } from '@/features/editor/EditorPage';
import { JobListPage } from '@/features/jobs/JobListPage';
import { JobWizardPage } from '@/features/jobs/JobWizardPage';
import { JobDetailPage } from '@/features/jobs/JobDetailPage';
import { ResultsPage } from '@/features/results/ResultsPage';
import { AdminUsersPage } from '@/features/admin/AdminUsersPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <Navigate to="/templates" replace />,
      },
      {
        path: 'templates',
        element: <TemplateListPage />,
      },
      {
        path: 'templates/new',
        element: <TemplateFormPage />,
      },
      {
        path: 'templates/:id',
        element: <TemplateFormPage mode="edit" />,
      },
      {
        path: 'templates/:id/edit',
        element: <TemplateFormPage mode="edit" />,
      },
      {
        path: 'jobs',
        element: <JobListPage />,
      },
      {
        path: 'jobs/new',
        element: <JobWizardPage />,
      },
      {
        path: 'jobs/:id',
        element: <JobDetailPage />,
      },
      {
        path: 'jobs/:jobId/results',
        element: <ResultsPage />,
      },
      {
        path: 'account',
        element: <AccountPage />,
      },
      {
        path: 'admin/users',
        element: (
          <ProtectedRoute requiredRole="ADMIN">
            <AdminUsersPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  // Editor is fullscreen — outside AppLayout
  {
    path: '/editor/:templateId',
    element: (
      <ProtectedRoute>
        <EditorPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
  },
  {
    path: '*',
    element: <Navigate to="/templates" replace />,
  },
]);
