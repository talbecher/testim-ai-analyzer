-- מחיקת הטבלאות הקיימות כדי למנוע התנגשויות
DROP TABLE IF EXISTS public.failure_reports;
DROP TABLE IF EXISTS public.regression_buckets;

-- יצירת טבלת הבאקטים עם ID מסוג Bigint
CREATE TABLE public.regression_buckets (
    id bigint primary key generated always as identity,
    created_at timestamptz default now(),
    name text not null,
    description text,
    is_active boolean default true,
    sort_order int default 0
);

-- יצירת טבלת הדוחות עם bucket_id תואם (Bigint)
CREATE TABLE public.failure_reports (
    id bigint primary key generated always as identity,
    created_at timestamptz default now(),
    bucket_id bigint references public.regression_buckets(id) on delete cascade,
    error_message text,
    test_name text,
    status text,
    ai_classification text,
    ai_reasoning text,
    raw_data jsonb
);

-- הזרקת באקט ראשון שיהיה עם מה לעבוד
INSERT INTO public.regression_buckets (name, description) 
VALUES ('בדיקה לוקאלית', 'באקט שנוצר אוטומטית לניתוח ראשון');