-- GPS provider config on settings
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS gps_provider       text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS gps_api_key        text,
  ADD COLUMN IF NOT EXISTS gps_api_secret     text,
  ADD COLUMN IF NOT EXISTS gps_account_id     text,
  ADD COLUMN IF NOT EXISTS gps_poll_interval  integer DEFAULT 60;

-- Vehicles / assets tracked
CREATE TABLE IF NOT EXISTS public.vehicles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz DEFAULT now(),
  provider      text NOT NULL,
  provider_id   text NOT NULL UNIQUE,
  name          text,
  label         text,
  vin           text,
  license_plate text,
  active        boolean DEFAULT true
);

-- Raw GPS pings
CREATE TABLE IF NOT EXISTS public.gps_pings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz DEFAULT now(),
  vehicle_id  uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  speed_mph   double precision,
  heading     integer,
  odometer    double precision,
  ignition    boolean,
  raw         jsonb
);

-- Trips derived from pings
CREATE TABLE IF NOT EXISTS public.gps_trips (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  started_at  timestamptz,
  ended_at    timestamptz,
  distance_mi double precision,
  start_lat   double precision,
  start_lng   double precision,
  end_lat     double precision,
  end_lng     double precision
);

ALTER TABLE public.vehicles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_pings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_trips  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access vehicles"  ON public.vehicles  USING (true);
CREATE POLICY "Service role full access gps_pings" ON public.gps_pings USING (true);
CREATE POLICY "Service role full access gps_trips" ON public.gps_trips USING (true);

-- Index for fast latest-ping-per-vehicle queries
CREATE INDEX IF NOT EXISTS gps_pings_vehicle_time ON public.gps_pings (vehicle_id, received_at DESC);
