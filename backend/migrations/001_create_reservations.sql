CREATE TABLE reservations (
  id            integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_name text        NOT NULL,
  email         text        NOT NULL,
  room          text        NOT NULL,
  date          date        NOT NULL,
  start_time    time        NOT NULL,
  end_time      time        NOT NULL,
  participants  integer     NOT NULL CHECK (participants > 0),
  status        text        NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX reservations_room_date_idx ON reservations (room, date);
