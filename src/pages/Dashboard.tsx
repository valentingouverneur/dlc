import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6 w-full max-w-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500">
            Here’s your analytic for: <span className="text-[#6F73F3] font-medium">This Month</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-full border border-slate-200 text-slate-500">🔔</button>
          <button className="w-9 h-9 rounded-full border border-slate-200 text-slate-500">⚙️</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-[#6F73F3] text-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-white/70">Total Revenue</div>
          <div className="mt-2 text-2xl font-semibold">$112,789.90</div>
          <div className="mt-1 text-xs text-white/80">+10% From Last Month</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total Profit</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">$253,894.88</div>
          <div className="mt-1 text-xs text-emerald-600">+15% From Last Month</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total Cost</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">$89,992.12</div>
          <div className="mt-1 text-xs text-rose-500">-12% From Last Month</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total Leads</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">$102,442.89</div>
          <div className="mt-1 text-xs text-emerald-600">+5% From Last Month</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Total Sales</div>
            <div className="text-xs text-slate-400">Current vs Last Month</div>
          </div>
          <div className="mt-3 h-40 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 text-sm">
            Line chart
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Total Visitors</div>
            <div className="text-xs text-slate-400">By device</div>
          </div>
          <div className="mt-3 h-40 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 text-sm">
            Bar chart
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Earning Growth</div>
            <div className="text-xs text-slate-400">Last week</div>
          </div>
          <div className="mt-3 h-40 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 text-sm">
            Line chart
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Recent Transactions</div>
            <div className="text-xs text-[#6F73F3]">See all transactions</div>
          </div>
          <div className="mt-4 space-y-3">
            {['Andrea Davoline', 'Stevany Chamberlain', 'Luminoe Grant'].map((name) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <div className="text-slate-600">{name}</div>
                <div className="text-emerald-600">+ $89,987.09</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Top Selling Product</div>
            <div className="text-xs text-[#6F73F3]">See all</div>
          </div>
          <div className="mt-4 space-y-3">
            {['705 Black Limited Edition Shirt', 'Apple Watch Series 5 GPS', 'PUMA Shuffle Trainers'].map((item) => (
              <div key={item} className="text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
