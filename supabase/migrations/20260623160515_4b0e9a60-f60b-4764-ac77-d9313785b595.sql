
-- ====== ENUMS ======
CREATE TYPE public.app_role AS ENUM ('superadmin','company_admin','user');
CREATE TYPE public.plan_tier AS ENUM ('free','pro','business');
CREATE TYPE public.sub_status AS ENUM ('active','trialing','past_due','canceled','incomplete');

-- ====== TENANTS ======
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  industry text,
  logo_url text,
  primary_color text DEFAULT '#4f46e5',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- ====== PROFILES ======
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text,
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ====== USER ROLES ======
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ====== SECURITY DEFINER HELPERS ======
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'superadmin')
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = 'company_admin'
  )
$$;

-- ====== TENANT POLICIES ======
CREATE POLICY "tenants_select_member" ON public.tenants FOR SELECT TO authenticated
  USING (id = public.get_user_tenant(auth.uid()) OR public.is_superadmin(auth.uid()));
CREATE POLICY "tenants_update_admin" ON public.tenants FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), id) OR public.is_superadmin(auth.uid()));
CREATE POLICY "tenants_insert_any_auth" ON public.tenants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tenants_delete_super" ON public.tenants FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- ====== PROFILE POLICIES ======
CREATE POLICY "profiles_select_self_or_tenant_or_super" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR tenant_id = public.get_user_tenant(auth.uid())
    OR public.is_superadmin(auth.uid())
  );
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ====== USER ROLE POLICIES ======
CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.is_superadmin(auth.uid())
  );

-- ====== SUBSCRIPTIONS ======
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan public.plan_tier NOT NULL DEFAULT 'free',
  status public.sub_status NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_select_tenant" ON public.subscriptions FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_superadmin(auth.uid()));

-- ====== USAGE QUOTAS ======
CREATE TABLE public.usage_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_month text NOT NULL, -- YYYY-MM
  cv_generations_used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_month)
);
GRANT SELECT ON public.usage_quotas TO authenticated;
GRANT ALL ON public.usage_quotas TO service_role;
ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quota_select_self_or_admin" ON public.usage_quotas FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.is_superadmin(auth.uid())
  );

-- ====== CV LOGS ======
CREATE TABLE public.cv_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  template text NOT NULL DEFAULT 'modern_executive',
  input jsonb NOT NULL,
  output jsonb NOT NULL,
  pdf_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cv_logs TO authenticated;
GRANT ALL ON public.cv_logs TO service_role;
ALTER TABLE public.cv_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cv_select_owner_or_admin" ON public.cv_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.is_superadmin(auth.uid())
  );
CREATE POLICY "cv_insert_self" ON public.cv_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "cv_update_owner" ON public.cv_logs FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "cv_delete_owner" ON public.cv_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ====== JOB LISTINGS ======
CREATE TABLE public.job_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  company text NOT NULL,
  industry text,
  skills text[] DEFAULT '{}',
  seniority text,
  location text,
  description text,
  external_url text,
  source text DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.job_listings TO authenticated;
GRANT ALL ON public.job_listings TO service_role;
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_select_all_auth" ON public.job_listings FOR SELECT TO authenticated USING (true);

-- ====== JOB MATCHES ======
CREATE TABLE public.job_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, job_id)
);
GRANT SELECT, INSERT, DELETE ON public.job_matches TO authenticated;
GRANT ALL ON public.job_matches TO service_role;
ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_select_self" ON public.job_matches FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "matches_insert_self" ON public.job_matches FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "matches_delete_self" ON public.job_matches FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ====== USAGE EVENTS ======
CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select_tenant_admin" ON public.usage_events FOR SELECT TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.is_superadmin(auth.uid())
    OR user_id = auth.uid()
  );

-- ====== AUDIT LOGS ======
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  action text NOT NULL,
  target text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_admin" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.is_superadmin(auth.uid()));

-- ====== SIGNUP TRIGGER: profile + tenant + role ======
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id uuid;
  v_company text;
  v_slug text;
  v_full_name text;
BEGIN
  v_company := COALESCE(NEW.raw_user_meta_data->>'company_name', split_part(NEW.email,'@',2));
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  v_slug := lower(regexp_replace(v_company || '-' || substr(NEW.id::text,1,8), '[^a-z0-9]+', '-', 'g'));

  INSERT INTO public.tenants (name, slug)
  VALUES (v_company, v_slug)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, email, full_name)
  VALUES (NEW.id, v_tenant_id, NEW.email, v_full_name);

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, v_tenant_id, 'company_admin');

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, v_tenant_id, 'user');

  INSERT INTO public.subscriptions (tenant_id, plan, status)
  VALUES (v_tenant_id, 'free', 'active');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====== SEED JOB LISTINGS ======
INSERT INTO public.job_listings (title, company, industry, skills, seniority, location, description) VALUES
('Senior Full-Stack Engineer','Acme Corp','Technology','{"React","Node.js","PostgreSQL","TypeScript"}','senior','Remote','Build core product surfaces in a fast-paced SaaS environment.'),
('Product Manager','Nimbus','SaaS','{"Roadmapping","User Research","Analytics","Agile"}','mid','London, UK','Own product discovery and delivery for the platform team.'),
('Data Scientist','InsightAI','AI','{"Python","ML","Pandas","SQL"}','mid','Berlin, DE','Build ML models to drive in-app personalization.'),
('HR Business Partner','GlobalCo','Enterprise','{"Talent","Coaching","Comp & Ben","HRIS"}','senior','Dubai, UAE','Strategic HR partner to engineering leadership.'),
('Frontend Engineer','Pixel Labs','Design Tools','{"React","Tailwind","Animation","TypeScript"}','mid','Remote','Craft world-class UI for creative professionals.'),
('DevOps Engineer','Cloudify','Cloud','{"AWS","Terraform","Kubernetes","CI/CD"}','senior','Riyadh, KSA','Own platform reliability and developer experience.'),
('Junior Recruiter','TalentBridge','HR Services','{"Sourcing","Screening","LinkedIn","ATS"}','junior','Cairo, EG','Help us hire the next generation of regional tech talent.'),
('Marketing Manager','GrowthLoop','MarTech','{"Content","SEO","Lifecycle","Analytics"}','mid','Remote','Lead full-funnel marketing for an enterprise SaaS product.');
