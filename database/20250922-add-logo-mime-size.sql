-- Migration: add logo_mime and logo_size_bytes to company_profile
ALTER TABLE company_profile
  ADD COLUMN logo_mime VARCHAR(50) NULL,
  ADD COLUMN logo_size_bytes INT NULL;

-- Backfill existing rows: assume PNG if logo exists and mime unknown
UPDATE company_profile
SET logo_mime = 'image/png', logo_size_bytes = OCTET_LENGTH(logo)
WHERE logo IS NOT NULL AND (logo_mime IS NULL OR logo_mime = '');
