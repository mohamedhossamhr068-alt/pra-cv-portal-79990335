ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 0;
UPDATE public.profiles SET credits = 0 WHERE email = 'mohamedhossamhr068@gmail.com' AND credits = 50;