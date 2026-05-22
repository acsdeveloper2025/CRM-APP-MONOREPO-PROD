-- 2026-05-22 — Rename document_type_rates → kyc_rates to match user-facing
-- "KYC Rates" label. Prerequisite for the Page 3 filter-standardization sweep.
-- Triple-write: dump + local docker + this migration; prod psql deferred.
--
-- All API consumers of /api/document-type-rates must switch to /api/kyc-rates
-- in the same deploy. Mobile has 0 refs (safe). Reports/MIS verified clean.

ALTER TABLE public.document_type_rates RENAME TO kyc_rates;
ALTER SEQUENCE public."documentTypeRates_id_seq" RENAME TO kyc_rates_id_seq;

ALTER INDEX public."documentTypeRates_pkey" RENAME TO kyc_rates_pkey;
ALTER INDEX public.idx_document_type_rates_active RENAME TO idx_kyc_rates_active;
ALTER INDEX public.idx_document_type_rates_client RENAME TO idx_kyc_rates_client;
ALTER INDEX public.idx_document_type_rates_created_by RENAME TO idx_kyc_rates_created_by;
ALTER INDEX public.idx_document_type_rates_document_type RENAME TO idx_kyc_rates_document_type;
ALTER INDEX public.idx_document_type_rates_effective RENAME TO idx_kyc_rates_effective;
ALTER INDEX public.idx_document_type_rates_lookup RENAME TO idx_kyc_rates_lookup;
ALTER INDEX public.idx_document_type_rates_product RENAME TO idx_kyc_rates_product;
ALTER INDEX public.uq_document_type_rates_active_per_pair RENAME TO uq_kyc_rates_active_per_pair;

ALTER TABLE public.kyc_rates RENAME CONSTRAINT "documentTypeRates_amount_check" TO kyc_rates_amount_check;
ALTER TABLE public.kyc_rates RENAME CONSTRAINT "documentTypeRates_clientId_fkey" TO kyc_rates_client_fkey;
ALTER TABLE public.kyc_rates RENAME CONSTRAINT "documentTypeRates_createdBy_fkey" TO kyc_rates_created_by_fkey;
ALTER TABLE public.kyc_rates RENAME CONSTRAINT "documentTypeRates_productId_fkey" TO kyc_rates_product_fkey;
ALTER TABLE public.kyc_rates RENAME CONSTRAINT document_type_rates_document_type_fkey TO kyc_rates_document_type_fkey;

ALTER TRIGGER trigger_update_document_type_rates_updated_at ON public.kyc_rates RENAME TO trigger_update_kyc_rates_updated_at;
ALTER FUNCTION public.update_document_type_rates_updated_at() RENAME TO update_kyc_rates_updated_at;
ALTER VIEW public.document_type_rates_view RENAME TO kyc_rates_view;
