import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HomePage } from './pages/public/HomePage';
import { FeaturesPage } from './pages/public/FeaturesPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { SecurityPage } from './pages/public/SecurityPage';
import { ForgotPasswordPage, LoginPage, SignupPage } from './pages/public/AuthPages';
import { OnboardingPage } from './pages/public/OnboardingPage';
import { OverviewPage } from './pages/app/OverviewPage';
import { TargetsPage } from './pages/app/TargetsPage';
import { TargetDetailPage } from './pages/app/TargetDetailPage';
import { AssessmentsPage } from './pages/app/AssessmentsPage';
import { NewAssessmentPage } from './pages/app/NewAssessmentPage';
import { AssessmentDetailPage } from './pages/app/AssessmentDetailPage';
import { VulnerabilitiesPage } from './pages/app/VulnerabilitiesPage';
import { VulnerabilityDetailPage } from './pages/app/VulnerabilityDetailPage';
import { AgentMonitorPage } from './pages/app/AgentMonitorPage';
import { ReportDetailPage, ReportsPage } from './pages/app/ReportsPage';
import { NotificationsPage } from './pages/app/NotificationsPage';
import {
  AiGatewayAdminPage,
  IntegrationsSettingsPage,
  ProfileSettingsPage,
  SecuritySettingsPage,
} from './pages/app/SettingsPages';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowPendingOnboarding?: boolean }> = ({
  children,
  allowPendingOnboarding = false,
}) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1020] flex items-center justify-center text-sm text-[#8796AB]">
        Verifying session...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.onboarding_completed && !allowPendingOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Onboarding */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute allowPendingOnboarding>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />

          {/* Authenticated App Routes */}
          <Route path="/app" element={<Navigate to="/app/overview" replace />} />
          <Route path="/app/overview" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
          <Route path="/app/targets" element={<ProtectedRoute><TargetsPage /></ProtectedRoute>} />
          <Route path="/app/targets/:id" element={<ProtectedRoute><TargetDetailPage /></ProtectedRoute>} />
          <Route path="/app/assessments" element={<ProtectedRoute><AssessmentsPage /></ProtectedRoute>} />
          <Route path="/app/assessments/new" element={<ProtectedRoute><NewAssessmentPage /></ProtectedRoute>} />
          <Route path="/app/assessments/:id" element={<ProtectedRoute><AssessmentDetailPage /></ProtectedRoute>} />
          <Route path="/app/vulnerabilities" element={<ProtectedRoute><VulnerabilitiesPage /></ProtectedRoute>} />
          <Route path="/app/vulnerabilities/:id" element={<ProtectedRoute><VulnerabilityDetailPage /></ProtectedRoute>} />
          <Route path="/app/agent" element={<ProtectedRoute><AgentMonitorPage /></ProtectedRoute>} />
          <Route path="/app/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/app/reports/:id" element={<ProtectedRoute><ReportDetailPage /></ProtectedRoute>} />
          <Route path="/app/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

          {/* Settings */}
          <Route path="/app/settings" element={<Navigate to="/app/settings/profile" replace />} />
          <Route path="/app/settings/profile" element={<ProtectedRoute><ProfileSettingsPage /></ProtectedRoute>} />
          <Route path="/app/settings/security" element={<ProtectedRoute><SecuritySettingsPage /></ProtectedRoute>} />
          <Route path="/app/settings/integrations" element={<ProtectedRoute><IntegrationsSettingsPage /></ProtectedRoute>} />
          <Route path="/app/settings/ai-gateway" element={<ProtectedRoute><AiGatewayAdminPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
