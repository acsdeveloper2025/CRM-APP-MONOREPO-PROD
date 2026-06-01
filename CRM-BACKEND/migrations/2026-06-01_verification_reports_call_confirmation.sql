-- Call Confirmation: dependent field shown on mobile when Call Remark =
-- "Pickup call & confirm" (the agent reached the applicant on the call and
-- confirmed a status). Persisted alongside call_remark on verification_reports;
-- rendered into the {Call_Remark} report clause by TemplateReportService.
ALTER TABLE public.verification_reports
  ADD COLUMN IF NOT EXISTS call_confirmation text;
