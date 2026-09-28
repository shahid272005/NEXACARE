# NexaCare

NexaCare is an accessible hospital kiosk and live queue-management summit MVP. It connects a multilingual patient kiosk, private doctor workspace, public ward display, and operations dashboard using synthetic demonstration data.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set the Supabase URL and publishable key in `.env.local`. Run the SQL files in `supabase/` in numerical order in the Supabase SQL editor before using the complete queue workflow.

## Safety

This project is a summit demonstration. It uses synthetic patient data; it does not diagnose, accept real identity numbers, send real OTPs, or process payment. See `docs/identity-otp-integration.md` before adapting it for a real hospital.
