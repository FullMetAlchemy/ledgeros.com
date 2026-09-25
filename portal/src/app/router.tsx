import { createBrowserRouter, Navigate } from 'react-router'
import { Admin } from '../features/admin/Admin'
import { AuditLedger } from '../features/audit/AuditLedger'
import { ControlTower } from '../features/dashboard/ControlTower'
import { DesignSystem } from '../features/design/DesignSystem'
import { FlagPage } from '../features/flags/FlagPage'
import { FlagsCentre } from '../features/flags/FlagsCentre'
import { MdaHome } from '../features/home/MdaHome'
import { MdaDirectory } from '../features/mdas/MdaDirectory'
import { MdaWorkspace } from '../features/mdas/MdaWorkspace'
import { ProfilePage } from '../features/profile/ProfilePage'
import { ReconciliationCentre } from '../features/reconciliation/ReconciliationCentre'
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage'
import { Reports } from '../features/reports/Reports'
import { NewReturn } from '../features/returns/NewReturn'
import { ReturnPage } from '../features/returns/ReturnPage'
import { ReturnsList } from '../features/returns/ReturnsList'
import { AppShell } from './AppShell'
import { Landing, Require } from './Guards'
import { Login } from './Login'
import { RouteError } from './RouteError'

export const router = createBrowserRouter([
  { path: '/login', element: <Login />, errorElement: <RouteError /> },
  { path: '/', element: <Landing />, errorElement: <RouteError /> },
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { path: '/dashboard', element: <Require permission="dashboard.view"><ControlTower /></Require> },
          { path: '/home', element: <Require permission="return.prepare"><MdaHome /></Require> },
          { path: '/mdas', element: <Require permission="mda.view"><MdaDirectory /></Require> },
          { path: '/mdas/:mdaId', element: <Require permission="mda.view"><MdaWorkspace /></Require> },
          { path: '/returns', element: <Require permission="return.view"><ReturnsList /></Require> },
          { path: '/returns/new', element: <Require permission="return.prepare"><NewReturn /></Require> },
          { path: '/returns/:returnId', element: <Require permission="return.view"><ReturnPage /></Require> },
          { path: '/flags', element: <Require permission="flag.view"><FlagsCentre /></Require> },
          { path: '/flags/:flagId', element: <Require permission="flag.view"><FlagPage /></Require> },
          { path: '/reconciliation', element: <Require permission="rec.view"><ReconciliationCentre /></Require> },
          { path: '/reconciliation/:recId', element: <Require permission="rec.view"><ReconciliationPage /></Require> },
          { path: '/audit', element: <Require permission="audit.view"><AuditLedger /></Require> },
          { path: '/reports', element: <Require permission="report.view"><Reports /></Require> },
          { path: '/admin/:tab?', element: <Require permission="admin.users"><Admin /></Require> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/design', element: <DesignSystem /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
