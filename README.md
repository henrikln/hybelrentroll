# Hybelrentroll

Rent roll management SaaS for Norwegian property owners. Parses rent roll Excel files and provides a dashboard for visualizing properties, tenants, contracts, financials, and CPI adjustments.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components)
- **Database**: PostgreSQL + Row-Level Security (Prisma ORM)
- **Auth**: Clerk (Google + Microsoft 365 SSO)
- **UI**: shadcn/ui + Tailwind CSS + Recharts
- **Excel Parsing**: SheetJS (xlsx)
- **Deployment**: Railway (EU)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

- `src/app/(dashboard)/` — Dashboard pages (Oversikt, Rent roll, Import, etc.)
- `src/components/dashboard/` — EstateLab-style UI components
- `src/lib/excel/` — Excel parser (column mapping, validation, import)
- `prisma/schema.prisma` — Database schema
