import Link from "next/link";

export function SetupBlocked({
  reason,
}: {
  reason: "missing-database-url" | "database-error";
}) {
  const isMissingUrl = reason === "missing-database-url";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12">
      <div className="max-w-lg rounded-xl border border-slate-700 bg-slate-900/90 p-8 text-slate-100 shadow-xl">
        <h1 className="text-xl font-semibold text-white">
          {isMissingUrl
            ? "Database is not configured"
            : "Cannot reach the database"}
        </h1>
        <p className="mt-3 text-sm text-slate-300 leading-relaxed">
          {isMissingUrl
            ? "This app needs a MySQL connection string in the server environment. In Hostinger: open your Node.js app → Environment variables and add DATABASE_URL."
            : "Check DATABASE_URL (host, user, password, database name) and that MySQL is running. After fixing, redeploy and run prisma migrate deploy if tables are missing."}
        </p>

        <div className="mt-6 space-y-3 text-sm text-slate-300">
          <p className="font-medium text-slate-200">Also set (same place):</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>
              <code className="text-slate-200">AUTH_SECRET</code> — random string,
              32+ characters
            </li>
            <li>
              <code className="text-slate-200">AUTH_TRUST_HOST</code> —{" "}
              <code>true</code>
            </li>
            <li>
              <code className="text-slate-200">AUTH_URL</code> — your public site
              URL, e.g. <code>https://yoursite.hostingersite.com</code> (no
              trailing slash)
            </li>
            <li>
              <code className="text-slate-200">NEXT_PUBLIC_APP_URL</code> — same
              as AUTH_URL
            </li>
          </ul>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Your server logs showed:{" "}
          <span className="text-slate-400">
            MissingSecret (no AUTH_SECRET) and/or DATABASE_URL not found
          </span>
          . Save variables, then restart or redeploy the Node app.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/api/health"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Check /api/health
          </Link>
        </div>
      </div>
    </div>
  );
}
