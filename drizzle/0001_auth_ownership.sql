DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meetings'
      AND column_name = 'user_id'
      AND data_type <> 'uuid'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.meetings
      WHERE user_id IS NOT NULL
        AND user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) THEN
      RAISE EXCEPTION 'Cannot convert meetings.user_id to uuid because incompatible non-null values exist.';
    END IF;

    ALTER TABLE public.meetings
      ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meetings'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.meetings ADD COLUMN user_id uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS meetings_user_idx ON public.meetings(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meetings_user_id_auth_users_id_fk'
  ) THEN
    ALTER TABLE public.meetings
      ADD CONSTRAINT meetings_user_id_auth_users_id_fk
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;