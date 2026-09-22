-- ============================================================================
--  MYKARAKIDS — DATABASE SCHEMA (consolidated)
--  Run this once in the Supabase SQL Editor (or via the Supabase CLI).
--  Tables: children, stories, scenes  +  RLS  +  storage buckets & policies.
--  Auth model: Supabase Anonymous sign-in. Every row is owned by auth.uid().
--  Idempotent: safe to re-run (create ... if not exists / on conflict do nothing).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type story_status as enum (
    'pending',            -- created, nothing generated yet
    'generating_text',    -- LLM writing the script
    'generating_assets',  -- images + audio per scene
    'ready',              -- fully playable
    'error'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type scene_status as enum (
    'pending',
    'image_ready',
    'audio_ready',
    'ready',
    'error'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- children — the story's main character (name, age, photo, look)
-- ---------------------------------------------------------------------------
create table if not exists public.children (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                  text not null,
  age                   int  check (age between 0 and 17),
  gender                text check (gender in ('male', 'female')),
  -- Path inside the PRIVATE `child-photos` bucket, e.g. "<user_id>/<child_id>.jpg"
  photo_path            text,
  -- AI-extracted look description (skin tone, hair, face) for illustration consistency
  character_description text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists children_user_id_idx on public.children(user_id);
drop trigger if exists children_set_updated_at on public.children;
create trigger children_set_updated_at before update on public.children
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- stories — one storybook: theme, generated script, moral, doa, parent guide
-- ---------------------------------------------------------------------------
create table if not exists public.stories (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id              uuid not null references public.children(id) on delete cascade,

  -- Selection from the theme catalog (config/themes.ts)
  theme_id              text not null,
  theme_label           text,
  subtheme_id           text not null,
  subtheme_label        text,
  situation             text,            -- free-text "situation to improve"
  length_id             text default 'auto',
  language              text not null default 'id',

  status                story_status not null default 'pending',
  error_message         text,

  -- Generated content
  title                 text,
  opener_text           text,
  moral_text            text,
  doa_arabic            text,
  doa_latin             text,
  doa_translation       text,
  parent_activity       text,
  parent_questions      jsonb default '[]'::jsonb,   -- array of strings

  -- Opener narration audio + karaoke word-timings
  opener_audio_path     text,
  opener_word_timings   jsonb default '[]'::jsonb,

  -- Snapshot of the character description used at generation time
  character_snapshot    text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists stories_user_id_idx  on public.stories(user_id);
create index if not exists stories_child_id_idx on public.stories(child_id);
create index if not exists stories_created_idx  on public.stories(created_at desc);
drop trigger if exists stories_set_updated_at on public.stories;
create trigger stories_set_updated_at before update on public.stories
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- scenes — the ordered pages of the flipbook
--   Each page shows 2-3 sequential ("berkesinambungan") illustrations. The
--   image_prompts / image_paths arrays hold the ordered sequence; the singular
--   image_prompt / image_path mirror the FIRST entry for backward compatibility.
-- ---------------------------------------------------------------------------
create table if not exists public.scenes (
  id             uuid primary key default gen_random_uuid(),
  story_id       uuid not null references public.stories(id) on delete cascade,
  index          int  not null,               -- 0-based page order
  narration_text text,
  image_prompt   text,                                    -- mirrors image_prompts[0]
  image_prompts  jsonb not null default '[]'::jsonb,      -- ordered 2-3 English prompts
  -- Paths inside the PUBLIC `story-assets` bucket
  image_path     text,                                    -- mirrors image_paths[0]
  image_paths    jsonb not null default '[]'::jsonb,      -- ordered stored image paths
  audio_path     text,
  -- Karaoke timing: array of { word, startMs, endMs }
  word_timings   jsonb default '[]'::jsonb,
  status         scene_status not null default 'pending',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (story_id, index)
);
create index if not exists scenes_story_idx on public.scenes(story_id, index);
drop trigger if exists scenes_set_updated_at on public.scenes;
create trigger scenes_set_updated_at before update on public.scenes
  for each row execute function set_updated_at();

-- Upgrade path for databases created before these columns existed.
alter table public.stories
  add column if not exists opener_audio_path   text;
alter table public.stories
  add column if not exists opener_word_timings jsonb default '[]'::jsonb;
alter table public.scenes
  add column if not exists image_prompts jsonb not null default '[]'::jsonb;
alter table public.scenes
  add column if not exists image_paths   jsonb not null default '[]'::jsonb;

-- ============================================================================
--  ROW LEVEL SECURITY
-- ============================================================================
alter table public.children enable row level security;
alter table public.stories  enable row level security;
alter table public.scenes   enable row level security;

-- children: owner-only CRUD
drop policy if exists "children_select_own" on public.children;
create policy "children_select_own" on public.children
  for select using (auth.uid() = user_id);
drop policy if exists "children_insert_own" on public.children;
create policy "children_insert_own" on public.children
  for insert with check (auth.uid() = user_id);
drop policy if exists "children_update_own" on public.children;
create policy "children_update_own" on public.children
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "children_delete_own" on public.children;
create policy "children_delete_own" on public.children
  for delete using (auth.uid() = user_id);

-- stories: owner-only CRUD
drop policy if exists "stories_select_own" on public.stories;
create policy "stories_select_own" on public.stories
  for select using (auth.uid() = user_id);
drop policy if exists "stories_insert_own" on public.stories;
create policy "stories_insert_own" on public.stories
  for insert with check (auth.uid() = user_id);
drop policy if exists "stories_update_own" on public.stories;
create policy "stories_update_own" on public.stories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own" on public.stories
  for delete using (auth.uid() = user_id);

-- scenes: access follows the owning story
drop policy if exists "scenes_select_own" on public.scenes;
create policy "scenes_select_own" on public.scenes
  for select using (exists (
    select 1 from public.stories s
    where s.id = scenes.story_id and s.user_id = auth.uid()
  ));
drop policy if exists "scenes_cud_own" on public.scenes;
create policy "scenes_cud_own" on public.scenes
  for all using (exists (
    select 1 from public.stories s
    where s.id = scenes.story_id and s.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.stories s
    where s.id = scenes.story_id and s.user_id = auth.uid()
  ));

-- ============================================================================
--  STORAGE BUCKETS
--    child-photos : PRIVATE (children's faces — signed URLs only)
--    story-assets : PUBLIC read (generated illustrations + audio)
--  Object paths are prefixed with the owner's user id: "<user_id>/..."
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('child-photos', 'child-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('story-assets', 'story-assets', true)
on conflict (id) do nothing;

-- child-photos: owner-only, scoped to their "<user_id>/" folder
drop policy if exists "child_photos_all_own" on storage.objects;
create policy "child_photos_all_own" on storage.objects
  for all
  using (
    bucket_id = 'child-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'child-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- story-assets: public read; writes limited to the owner's folder
-- (asset generation runs server-side with the service role, which bypasses RLS,
--  but these client policies keep the bucket safe for direct client use too.)
drop policy if exists "story_assets_public_read" on storage.objects;
create policy "story_assets_public_read" on storage.objects
  for select using (bucket_id = 'story-assets');

drop policy if exists "story_assets_write_own" on storage.objects;
create policy "story_assets_write_own" on storage.objects
  for insert with check (
    bucket_id = 'story-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "story_assets_update_own" on storage.objects;
create policy "story_assets_update_own" on storage.objects
  for update using (
    bucket_id = 'story-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "story_assets_delete_own" on storage.objects;
create policy "story_assets_delete_own" on storage.objects
  for delete using (
    bucket_id = 'story-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
