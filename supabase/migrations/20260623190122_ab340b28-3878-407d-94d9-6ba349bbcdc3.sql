
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

ALTER TABLE public.cv_logs
  ADD COLUMN IF NOT EXISTS analysis jsonb;

ALTER TABLE public.job_listings
  ADD COLUMN IF NOT EXISTS company_logo text,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'EG';

CREATE UNIQUE INDEX IF NOT EXISTS job_listings_external_url_unique
  ON public.job_listings (external_url);

CREATE INDEX IF NOT EXISTS job_listings_country_idx ON public.job_listings (country);

CREATE OR REPLACE FUNCTION public.admin_update_user(
  _target_user uuid,
  _credits integer DEFAULT NULL,
  _is_blocked boolean DEFAULT NULL,
  _grant_admin boolean DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_target_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE id = _target_user;
  IF v_tenant IS NULL OR v_tenant <> v_target_tenant THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _credits IS NOT NULL THEN
    UPDATE public.profiles SET credits = GREATEST(0, _credits) WHERE id = _target_user;
  END IF;
  IF _is_blocked IS NOT NULL THEN
    UPDATE public.profiles SET is_blocked = _is_blocked WHERE id = _target_user;
  END IF;
  IF _grant_admin IS TRUE THEN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (_target_user, v_tenant, 'company_admin')
    ON CONFLICT (user_id, tenant_id, role) DO NOTHING;
  ELSIF _grant_admin IS FALSE THEN
    DELETE FROM public.user_roles
    WHERE user_id = _target_user AND tenant_id = v_tenant AND role = 'company_admin';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user(uuid, integer, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, integer, boolean, boolean) TO authenticated;

INSERT INTO public.job_listings (title, company, industry, skills, seniority, location, description, external_url, source, company_logo, employment_type, country, posted_at) VALUES
('Senior Frontend Engineer','Instabug','Software',ARRAY['React','TypeScript','Next.js','Testing'],'senior','Cairo, Egypt','Build SDK dashboards used by thousands of mobile teams.','https://www.linkedin.com/jobs/search/?keywords=instabug%20frontend&location=Egypt','linkedin','https://logo.clearbit.com/instabug.com','Full-time','EG', now() - interval '2 days'),
('Backend Engineer (Node.js)','Swvl','Transportation',ARRAY['Node.js','PostgreSQL','AWS','Microservices'],'mid','Cairo, Egypt','Scale ride-pooling platform across MENA.','https://wuzzuf.net/search/jobs/?q=backend&a=hpb&filters%5Bcountry%5D%5B0%5D=Egypt','wuzzuf','https://logo.clearbit.com/swvl.com','Full-time','EG', now() - interval '1 day'),
('Data Analyst','Vodafone Egypt','Telecom',ARRAY['SQL','Power BI','Python','Excel'],'mid','Cairo, Egypt','Customer analytics for retail and B2B segments.','https://www.linkedin.com/jobs/search/?keywords=vodafone%20egypt%20data%20analyst','linkedin','https://logo.clearbit.com/vodafone.com.eg','Full-time','EG', now() - interval '3 days'),
('Product Designer','MaxAB','E-commerce',ARRAY['Figma','UX Research','Design Systems'],'senior','Cairo, Egypt','Design B2B grocery app used by thousands of merchants.','https://wuzzuf.net/jobs/p/maxab-product-designer','wuzzuf','https://logo.clearbit.com/maxab.io','Full-time','EG', now() - interval '4 days'),
('Mobile Engineer (Flutter)','Halan','Fintech',ARRAY['Flutter','Dart','REST','Firebase'],'mid','Cairo, Egypt','Build Halan super-app features in Flutter.','https://www.linkedin.com/jobs/search/?keywords=halan%20flutter%20egypt','linkedin','https://logo.clearbit.com/halan.com','Full-time','EG', now() - interval '1 day'),
('DevOps Engineer','Fawry','Fintech',ARRAY['Kubernetes','Terraform','AWS','Linux'],'senior','Giza, Egypt','Run payment infrastructure serving millions of transactions daily.','https://www.linkedin.com/jobs/search/?keywords=fawry%20devops','linkedin','https://logo.clearbit.com/fawry.com','Full-time','EG', now() - interval '5 days'),
('Sales Account Manager','Talabat Egypt','Food Tech',ARRAY['B2B Sales','Negotiation','CRM','Arabic'],'mid','Cairo, Egypt','Manage restaurant partners across Cairo and Giza.','https://www.linkedin.com/jobs/search/?keywords=talabat%20egypt%20account%20manager','linkedin','https://logo.clearbit.com/talabat.com','Full-time','EG', now() - interval '2 days'),
('Marketing Specialist','Jumia Egypt','E-commerce',ARRAY['Performance Marketing','Google Ads','Meta Ads','SEO'],'mid','Cairo, Egypt','Drive growth across mass-market verticals.','https://www.linkedin.com/jobs/search/?keywords=jumia%20egypt%20marketing','linkedin','https://logo.clearbit.com/jumia.com.eg','Full-time','EG', now() - interval '6 days'),
('Customer Support Lead','Paymob','Fintech',ARRAY['Support','Zendesk','Team Lead','Arabic'],'mid','Cairo, Egypt','Lead merchant support team for Paymob payments.','https://wuzzuf.net/search/jobs/?q=paymob','wuzzuf','https://logo.clearbit.com/paymob.com','Full-time','EG', now() - interval '3 days'),
('Full-Stack Engineer','Trella','Logistics',ARRAY['React','Node.js','TypeScript','GraphQL'],'mid','Cairo, Egypt','Build trucking marketplace platform.','https://www.linkedin.com/jobs/search/?keywords=trella%20egypt','linkedin','https://logo.clearbit.com/trella.app','Full-time','EG', now() - interval '7 days'),
('Accountant','Breadfast','Grocery',ARRAY['Accounting','Excel','SAP','IFRS'],'junior','Cairo, Egypt','Handle daily ledger and reconciliation.','https://wuzzuf.net/search/jobs/?q=breadfast','wuzzuf','https://logo.clearbit.com/breadfast.com','Full-time','EG', now() - interval '1 day'),
('Content Writer (Arabic)','Mawdoo3','Media',ARRAY['Arabic Writing','SEO','Research'],'junior','Remote, Egypt','Produce Arabic-language SEO content.','https://www.bayt.com/en/egypt/jobs/?text=mawdoo3','bayt','https://logo.clearbit.com/mawdoo3.com','Remote','EG', now() - interval '4 days'),
('HR Business Partner','Valeo Egypt','Automotive',ARRAY['HR','Recruiting','Talent Management'],'senior','Smart Village, Egypt','Partner with engineering managers on talent strategy.','https://www.linkedin.com/jobs/search/?keywords=valeo%20egypt','linkedin','https://logo.clearbit.com/valeo.com','Full-time','EG', now() - interval '8 days'),
('iOS Engineer','Khazna','Fintech',ARRAY['Swift','iOS','UIKit','SwiftUI'],'mid','Cairo, Egypt','Build Khazna salary advance app.','https://www.linkedin.com/jobs/search/?keywords=khazna%20ios','linkedin','https://logo.clearbit.com/khazna.app','Full-time','EG', now() - interval '2 days'),
('Data Engineer','Rabbit','Grocery',ARRAY['Python','Airflow','BigQuery','SQL'],'mid','Cairo, Egypt','Build data pipelines for 20-min grocery delivery.','https://www.linkedin.com/jobs/search/?keywords=rabbit%20egypt%20data','linkedin','https://logo.clearbit.com/rabbitmart.com','Full-time','EG', now() - interval '5 days'),
('Project Manager','Orange Egypt','Telecom',ARRAY['PMP','Agile','Stakeholder Management'],'senior','Cairo, Egypt','Lead network rollout projects.','https://www.linkedin.com/jobs/search/?keywords=orange%20egypt%20project%20manager','linkedin','https://logo.clearbit.com/orange.eg','Full-time','EG', now() - interval '6 days'),
('QA Automation Engineer','Robusta Studio','Software',ARRAY['Cypress','Selenium','TypeScript','API Testing'],'mid','Cairo, Egypt','Automate web/mobile test suites.','https://wuzzuf.net/search/jobs/?q=robusta','wuzzuf','https://logo.clearbit.com/robustastudio.com','Full-time','EG', now() - interval '3 days'),
('Graphic Designer','Vezeeta','Health Tech',ARRAY['Adobe Suite','Figma','Branding'],'junior','Cairo, Egypt','Produce assets across product and marketing.','https://www.linkedin.com/jobs/search/?keywords=vezeeta%20designer','linkedin','https://logo.clearbit.com/vezeeta.com','Full-time','EG', now() - interval '1 day'),
('Machine Learning Engineer','Sympl','Fintech',ARRAY['Python','PyTorch','MLOps','Credit Scoring'],'senior','Cairo, Egypt','Build risk and underwriting models for BNPL.','https://www.linkedin.com/jobs/search/?keywords=sympl%20egypt%20machine%20learning','linkedin','https://logo.clearbit.com/sympl.io','Full-time','EG', now() - interval '4 days'),
('Operations Manager','Capiter','B2B',ARRAY['Operations','Supply Chain','Excel','Arabic'],'senior','Cairo, Egypt','Run last-mile and warehouse operations.','https://wuzzuf.net/search/jobs/?q=capiter','wuzzuf','https://logo.clearbit.com/capiter.com','Full-time','EG', now() - interval '7 days'),
('Junior Software Developer','IBM Egypt','Software',ARRAY['Java','SQL','Linux','Git'],'junior','Cairo, Egypt','Join IBM Egypt engineering team on enterprise projects.','https://www.linkedin.com/jobs/search/?keywords=ibm%20egypt%20junior%20developer','linkedin','https://logo.clearbit.com/ibm.com','Full-time','EG', now() - interval '2 days'),
('Cybersecurity Analyst','Etisalat Misr','Telecom',ARRAY['SOC','SIEM','Incident Response','Networking'],'mid','Cairo, Egypt','Monitor and respond to security incidents.','https://www.linkedin.com/jobs/search/?keywords=etisalat%20misr%20security','linkedin','https://logo.clearbit.com/etisalat.eg','Full-time','EG', now() - interval '5 days'),
('Business Analyst','CIB Egypt','Banking',ARRAY['SQL','Power BI','Requirements','Banking'],'mid','Cairo, Egypt','Translate business needs into product requirements.','https://www.linkedin.com/jobs/search/?keywords=cib%20egypt%20business%20analyst','linkedin','https://logo.clearbit.com/cibeg.com','Full-time','EG', now() - interval '3 days'),
('Civil Engineer','Orascom Construction','Construction',ARRAY['AutoCAD','Project Planning','Site Supervision'],'mid','New Cairo, Egypt','Lead site execution on major infrastructure projects.','https://www.linkedin.com/jobs/search/?keywords=orascom%20construction%20civil','linkedin','https://logo.clearbit.com/orascom.com','Full-time','EG', now() - interval '6 days'),
('Pharmacist','Eva Pharma','Pharma',ARRAY['QA','GMP','Production'],'junior','6th of October, Egypt','Production line QA pharmacist.','https://www.linkedin.com/jobs/search/?keywords=eva%20pharma%20pharmacist','linkedin','https://logo.clearbit.com/evapharma.com','Full-time','EG', now() - interval '1 day')
ON CONFLICT (external_url) DO UPDATE SET
  title = EXCLUDED.title, company = EXCLUDED.company, skills = EXCLUDED.skills,
  company_logo = EXCLUDED.company_logo, posted_at = EXCLUDED.posted_at, country = EXCLUDED.country;
