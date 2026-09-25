import { Link, isRouteErrorResponse, useRouteError } from 'react-router'

/** UI-008: an unexpected error shows a recovery path instead of a blank page. */
export function RouteError() {
  const err = useRouteError()
  const message = isRouteErrorResponse(err) ? `${err.status} ${err.statusText}` : err instanceof Error ? err.message : 'Unknown error'
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-start justify-center gap-3 px-4">
      <div className="eyebrow">Something went wrong</div>
      <h1 className="text-xl font-semibold">This page couldn’t be displayed</h1>
      <p className="text-[13px] text-ink-2">Your data is safe: saved work stays saved. Go back to your home page and try again. If it keeps happening, report the details below to your administrator.</p>
      <pre className="w-full overflow-x-auto rounded-md border border-line bg-sunk px-3 py-2 font-mono text-xs text-muted">{message}</pre>
      <Link to="/" className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-4 text-[13px] font-semibold text-on-primary">
        Back to home
      </Link>
    </main>
  )
}
