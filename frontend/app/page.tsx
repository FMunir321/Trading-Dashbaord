import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Trading dashboard</p>
            <h1 className="mt-4 text-4xl font-semibold text-slate-950 sm:text-5xl">
              Monitor accounts, equity performance, and trade history
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600">
              A lightweight dashboard for viewing trading accounts, equity curves, and recent trades. Sign in or register to access your workspace.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
              >
                Create account
              </Link>
            </div>
          </div>
          <div className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-lg sm:p-10">
            <h2 className="text-xl font-semibold">What you can do</h2>
            <ul className="mt-6 space-y-4 text-sm leading-7 text-slate-200">
              <li>• View account balances and status</li>
              <li>• Track daily P&L performance</li>
              <li>• Browse recent trade history</li>
              <li>• Add and monitor trading accounts</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
