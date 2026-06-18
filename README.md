# MetricsPulse - SaaS Metrics Dashboard

MetricsPulse is a full-stack SaaS metrics dashboard featuring secure user authentication, role-based access control (RBAC), and dynamic analytics visualization. It connects natively to a Supabase backend database layer to process data metrics in real-time.

## 🚀 Tech Stack

- **Frontend Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **Database & Authentication:** Supabase
- **Icons:** Lucide React
- **Data Visualization:** Recharts

---

## 🛠️ Local Setup & Installation Guide

*(Note for external users: To run this project locally on your machine, follow these steps)*

### 1. Clone the Repository
```bash
git clone [https://github.com/YOUR_USERNAME/saas-metrics-dashboard.git](https://github.com/YOUR_USERNAME/saas-metrics-dashboard.git)
cd saas-metrics-dashboard

```

### 2. Install Project Dependencies

```bash
npm install

```

### 3. Configure Your Environment Variables

Create a file named `.env.local` in the root of your project directory and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_supabase_anon_public_key

```

### 4. Database Schema Setup (Supabase)

In your Supabase dashboard, create a table named `customers` with the following columns:

* `id` (uuid, Primary Key)
* `created_at` (timestamp, default: now())
* `name` (text)
* `email` (text)
* `status` (text: 'Active', 'Lead', or 'Churned')
* `revenue` (numeric)

### 5. Boot Up the Local Server

```bash
npm run dev

```