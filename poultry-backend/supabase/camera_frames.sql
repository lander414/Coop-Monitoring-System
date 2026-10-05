create table if not exists public.camera_frames (
  frame_id uuid primary key,
  device_id text not null,
  captured_at timestamptz,
  uploaded_at timestamptz not null default now(),
  sequence_id text,
  firmware_version text,
  storage_name text not null,
  mime_type text not null check (mime_type = 'image/jpeg'),
  size_in_bytes integer not null check (size_in_bytes > 0),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  processing_started_at timestamptz,
  processed_at timestamptz,
  ai_stress_risk text check (ai_stress_risk in ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN')),
  ai_confidence numeric,
  ai_indicators jsonb not null default '[]'::jsonb,
  ai_description text,
  processing_error text
);

create index if not exists camera_frames_device_uploaded_idx
  on public.camera_frames (device_id, uploaded_at desc);

create index if not exists camera_frames_status_idx
  on public.camera_frames (status, uploaded_at);
