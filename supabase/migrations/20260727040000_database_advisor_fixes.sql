alter extension citext set schema extensions;

create index deliveries_contact_idx
  on public.deliveries (contact_id);

create index delivery_events_contact_idx
  on public.delivery_events (contact_id);

create index delivery_events_delivery_idx
  on public.delivery_events (delivery_id);
