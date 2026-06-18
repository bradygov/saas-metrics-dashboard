'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  TrendingUp, 
  Users, 
  CreditCard, 
  Activity, 
  Search, 
  Bell, 
  Plus, 
  MoreHorizontal,
  X,
  Trash2,
  Edit2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Lock,
  Shield,
  Eye
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';

interface Customer {
  id?: string;
  name: string;
  email: string;
  status: 'Active' | 'Lead' | 'Churned';
  revenue: number;
}

const getPagination = (page: number, size: number) => {
  const limit = size ? +size : 5;
  const from = page ? page * limit : 0;
  const to = page ? from + limit - 1 : limit - 1;
  return { from, to };
};

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [authLoading, setAuthLoading] = useState(true);
  
  // Auth Form State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard Core State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomersForCharts, setAllCustomersForCharts] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | undefined>(undefined);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 5;
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'Active' | 'Lead' | 'Churned'>('Lead');
  const [revenue, setRevenue] = useState('');

  // Extract user session and assign role safely
  const handleUserSession = (sessionUser: any) => {
    setUser(sessionUser);
    if (sessionUser) {
      const userRole = sessionUser.user_metadata?.role === 'admin' ? 'admin' : 'viewer';
      setRole(userRole);
    } else {
      setRole('viewer');
    }
  };

  useEffect(() => {
    setMounted(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserSession(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUserSession(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch all rows strictly for calculations and visualization data
  const fetchGlobalMetrics = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('customers').select('*');
    if (!error && data) {
      setAllCustomersForCharts(data);
      
      const revenueSum = data
        .filter(c => c.status === 'Active')
        .reduce((sum, c) => sum + Number(c.revenue), 0);
        
      const activeRows = data.filter(c => c.status === 'Active').length;
      setTotalRevenue(revenueSum);
      setActiveCount(activeRows);
      setTotalRecords(data.length);
    }
  }, [user]);

  // Fetch paginated/filtered data for the table grid with safe range clamping
  const fetchCustomers = useCallback(async (showLoadingSpinner = false) => {
    if (!user) return;
    if (showLoadingSpinner) {
      setLoading(true);
    }

    const { from, to } = getPagination(currentPage, PAGE_SIZE);
    
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (statusFilter !== 'All') {
      query = query.eq('status', statusFilter);
    }

    if (searchQuery.trim() !== '') {
      const cleanSearch = `%${searchQuery.trim()}%`;
      query = query.or(`name.ilike.${cleanSearch},email.ilike.${cleanSearch}`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching customers:', error.message);
      // Fallback fallback if page range gets broken due to data deletions/filters
      if (error.message.includes('satisfiable') && currentPage > 0) {
        setCurrentPage(0);
      }
    } else if (data) {
      setCustomers(data);
      if (count !== null) {
        setTotalPages(Math.ceil(count / PAGE_SIZE) || 1);
      }
    }
    
    setLoading(false);
  }, [currentPage, statusFilter, searchQuery, user]);

  // Handle Realtime Subscriptions
  useEffect(() => {
    if (!mounted || !user) return;

    fetchCustomers(true);
    fetchGlobalMetrics();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          fetchCustomers(false);
          fetchGlobalMetrics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mounted, fetchCustomers, fetchGlobalMetrics, user]);

  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, statusFilter]);

  // Transform raw data into structured array formats for Recharts
  const chartData = useMemo(() => {
    const statusCounts = { Active: 0, Lead: 0, Churned: 0 };
    const revenueData: { name: string; revenue: number }[] = [];

    allCustomersForCharts.forEach(c => {
      if (statusCounts[c.status] !== undefined) {
        statusCounts[c.status]++;
      }
      revenueData.push({
        name: c.name ? c.name.split(' ')[0] : 'Unknown',
        revenue: Number(c.revenue || 0)
      });
    });

    const pieData = [
      { name: 'Active', value: statusCounts.Active, color: '#10b981' },
      { name: 'Lead', value: statusCounts.Lead, color: '#f59e0b' },
      { name: 'Churned', value: statusCounts.Churned, color: '#f43f5e' }
    ].filter(item => item.value > 0);

    const barData = revenueData.sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return { pieData, barData };
  }, [allCustomersForCharts]);

  // Auth Operations
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCustomers([]);
    setAllCustomersForCharts([]);
  };

  // Customer Table Operations
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'admin' || !name || !email) return;

    const customerPayload: Customer = {
      name,
      email,
      status,
      revenue: revenue ? parseFloat(revenue) : 0
    };

    if (editingCustomer && editingCustomer.id) {
      await supabase.from('customers').update(customerPayload).eq('id', editingCustomer.id);
    } else {
      await supabase.from('customers').insert([customerPayload]);
    }

    setIsModalOpen(false);
    setName(''); setEmail(''); setStatus('Lead'); setRevenue('');
    setEditingCustomer(null);
  };

  const handleDeleteCustomer = async (id: string | undefined) => {
    if (role !== 'admin' || !id) return;
    if (confirm('Are you sure you want to delete this customer record?')) {
      await supabase.from('customers').delete().eq('id', id);
      setActiveMenuId(undefined);
    }
  };

  // Prevent server-side rendering mismatch issues entirely
  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center text-sm font-medium tracking-wide">
        Loading interface layer...
      </div>
    );
  }

  // LOGIN SCREEN DISPLAY
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-xl mx-auto shadow-lg shadow-blue-600/20">
              <Lock className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100">Sign in to MetricsPulse</h2>
            <p className="text-sm text-slate-400">Provide your database security credentials</p>
          </div>

          {authError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg text-xs font-medium">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Email Address</label>
              <input 
                type="email" 
                required 
                value={authEmail} 
                onChange={(e) => setAuthEmail(e.target.value)} 
                placeholder="developer@example.com" 
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Account Password</label>
              <input 
                type="password" 
                required 
                value={authPassword} 
                onChange={(e) => setAuthPassword(e.target.value)} 
                placeholder="••••••••" 
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors" 
              />
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm py-2.5 rounded-lg transition-colors mt-2 shadow-lg shadow-blue-600/15">
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // PROTECTED DASHBOARD SCREEN DISPLAY
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans relative">
      
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white">M</div>
          <span className="text-xl font-bold tracking-tight">MetricsPulse</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search server rows..." 
              className="bg-slate-900 border border-slate-800 rounded-md pl-9 pr-4 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-64 transition-colors"
            />
          </div>
          <button className="p-2 hover:bg-slate-800 rounded-full relative text-slate-400 hover:text-slate-200">
            <Bell className="h-5 w-5" />
          </button>
          
          <div className="h-px w-4 bg-slate-800 self-center" />
          
          {/* USER DISPLAY WITH BADGE ROLE */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col text-right hidden lg:block">
              <span className="text-xs text-slate-200 max-w-[140px] truncate block">{user.email}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 justify-end ${role === 'admin' ? 'text-blue-400' : 'text-slate-400'}`}>
                {role === 'admin' ? <Shield className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                {role}
              </span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition-colors flex items-center gap-2 text-xs"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="p-6 max-w-7xl mx-auto space-y-8">
        
        {/* METRICS CARDS */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-2">
            <div className="flex items-center justify-between text-slate-400"><span className="text-sm font-medium">Active ARR</span><CreditCard className="h-4 w-4" /></div>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div className="text-xs text-emerald-400 font-medium">Excludes leads & churn</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-2">
            <div className="flex items-center justify-between text-slate-400"><span className="text-sm font-medium">Active Customers</span><Users className="h-4 w-4" /></div>
            <div className="text-2xl font-bold">+{activeCount}</div>
            <div className="text-xs text-emerald-400 font-medium">Real-time count</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-2">
            <div className="flex items-center justify-between text-slate-400"><span className="text-sm font-medium">Total Records</span><TrendingUp className="h-4 w-4" /></div>
            <div className="text-2xl font-bold">{totalRecords}</div>
            <div className="text-xs text-emerald-400 font-medium">Database total</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-2">
            <div className="flex items-center justify-between text-slate-400"><span className="text-sm font-medium">Database Status</span><Activity className="h-4 w-4 text-emerald-400" /></div>
            <div className="text-2xl font-bold text-emerald-400">Live Syncing</div>
            <div className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse" />
              Realtime Connected
            </div>
          </div>
        </div>

        {/* VISUALIZATION CHARTS PANEL */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Donut Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[320px]">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Customer Segments</h3>
              <p className="text-xs text-slate-400 mb-4">Proportion of Active accounts, Leads, and Churned targets</p>
            </div>
            <div className="w-full h-48 flex items-center justify-center relative">
              {chartData.pieData.length === 0 ? (
                <p className="text-sm text-slate-500">No segment data available</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={chartData.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {chartData.pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Bar Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[320px]">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Top Revenue Pipelines</h3>
              <p className="text-xs text-slate-400 mb-4">Highest individual revenue contributors inside the workspace ($)</p>
            </div>
            <div className="w-full h-48 relative">
              {chartData.barData.length === 0 ? (
                <p className="text-sm text-slate-500 flex items-center justify-center h-full">No distribution data available</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={chartData.barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(51, 65, 85, 0.2)' }}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                    />
                    <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* CUSTOMERS TABLE WITH CONTROLS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-semibold">Recent Customers</h2>
              <p className="text-sm text-slate-400">Showing server rows {currentPage * PAGE_SIZE + 1} - {Math.min((currentPage + 1) * PAGE_SIZE, totalRecords)}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300">
                <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent focus:outline-none cursor-pointer text-slate-200"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Lead">Lead</option>
                  <option value="Churned">Churned</option>
                </select>
              </div>

              {/* Hide Add Button from Viewers */}
              {role === 'admin' && (
                <button 
                  onClick={() => { setIsModalOpen(true); setEditingCustomer(null); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" /> Add Customer
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Querying Supabase server...</div>
            ) : customers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">No records match your criteria.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-sm font-medium">
                    <th className="p-4 pl-6">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Revenue</th>
                    {role === 'admin' && <th className="p-4 pr-6 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm text-slate-200">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 pl-6 font-medium">{customer.name}</td>
                      <td className="p-4 text-slate-400">{customer.email}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          customer.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          customer.status === 'Lead' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {customer.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono">${Number(customer.revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      
                      {/* Hide Actions Dropdown entirely from Viewers */}
                      {role === 'admin' && (
                        <td className="p-4 pr-6 text-right relative">
                          <button 
                            onClick={() => setActiveMenuId(activeMenuId === customer.id ? undefined : customer.id)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {activeMenuId === customer.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(undefined)} />
                              <div className="absolute right-6 top-12 bg-slate-900 border border-slate-800 rounded-lg shadow-xl py-1 w-36 z-20 text-left text-xs text-slate-300">
                                <button 
                                  onClick={() => {
                                    setEditingCustomer(customer); setName(customer.name); setEmail(customer.email); setStatus(customer.status); setRevenue(customer.revenue.toString()); setIsModalOpen(true); setActiveMenuId(undefined);
                                  }}
                                  className="w-full px-3 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors"
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-blue-400" /> Edit Record
                                </button>
                                <button 
                                  onClick={() => handleDeleteCustomer(customer.id)}
                                  className="w-full px-3 py-2 hover:bg-slate-800 text-rose-400 hover:text-rose-300 flex items-center gap-2 border-t border-slate-800/50 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete Record
                                </button>
                              </div>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* PAGINATION INTERFACE BAR */}
          <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">Page {currentPage + 1} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 0 || loading}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-opacity"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={currentPage + 1 >= totalPages || loading}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-opacity"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* FORM INPUT MODAL */}
      {isModalOpen && role === 'admin' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
            <div className="p-6 flex items-center justify-between border-b border-slate-800">
              <h3 className="text-lg font-semibold">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
              <button onClick={() => { setIsModalOpen(false); setEditingCustomer(null); }} className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Full Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Email Address</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as Customer['status'])} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500">
                    <option value="Lead">Lead</option> <option value="Active">Active</option> <option value="Churned">Churned</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Revenue ($)</label>
                  <input type="number" min="0" step="0.01" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="0.00" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800 mt-6">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingCustomer(null); }} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}