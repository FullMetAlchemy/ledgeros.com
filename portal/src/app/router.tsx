import { createBrowserRouter, Navigate } from 'react-router'
import { DesignSystem } from '../features/design/DesignSystem'
import { FlagCase } from '../features/flags/FlagCase'
import { FlagsList } from '../features/flags/FlagsList'
import { ComplianceHome } from '../features/home/ComplianceHome'
import { OversightSubmissions } from '../features/oversight/OversightSubmissions'
import { ReleaseQueue } from '../features/oversight/ReleaseQueue'
import { ReviewQueue } from '../features/oversight/ReviewQueue'
import { SubmissionPage } from '../features/submissions/SubmissionPage'
import { SubmissionsHub } from '../features/submissions/SubmissionsHub'
import { ProfilePage } from '../features/profile/ProfilePage'
import { MyTasks } from '../features/tasks/MyTasks'
import { AppShell } from './AppShell'
import { Landing, Only } from './Guards'

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  {
    element: <AppShell />,
    children: [
      { path: '/home', element: <Only side="mda"><ComplianceHome /></Only> },
      { path: '/tasks', element: <Only side="mda"><MyTasks /></Only> },
      { path: '/flags', element: <Only side="mda"><FlagsList /></Only> },
      { path: '/flags/:flagId', element: <Only side="mda"><FlagCase basePath="/flags" /></Only> },
      { path: '/submissions', element: <Only side="mda"><SubmissionsHub /></Only> },
      { path: '/submissions/:submissionId', element: <Only side="mda"><SubmissionPage basePath="/submissions" /></Only> },
      { path: '/oversight/queue', element: <Only side="oversight"><ReviewQueue /></Only> },
      { path: '/oversight/flags', element: <Only side="oversight"><FlagsList oversight /></Only> },
      { path: '/oversight/flags/:flagId', element: <Only side="oversight"><FlagCase basePath="/oversight/flags" /></Only> },
      { path: '/oversight/submissions', element: <Only side="oversight"><OversightSubmissions /></Only> },
      { path: '/oversight/submissions/:submissionId', element: <Only side="oversight"><SubmissionPage basePath="/oversight/submissions" /></Only> },
      { path: '/oversight/releases', element: <Only side="oversight"><ReleaseQueue /></Only> },
      { path: '/oversight/releases/:submissionId', element: <Only side="oversight"><SubmissionPage basePath="/oversight/releases" /></Only> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/design', element: <DesignSystem /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
