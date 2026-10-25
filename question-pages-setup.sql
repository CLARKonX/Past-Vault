-- Run this once in Supabase SQL Editor to store multiple image pages per question.
alter table public.resources
  add column if not exists page_files jsonb not null default '[]'::jsonb;
