# Archivist website

The landing page for [Archivist](https://github.com/overyonder/archivist), a
high-performance game preservation pipeline, visual history browser, and
launcher.

The site is deliberately dependency-free. Serve the repository root with any
static file server:

```sh
python3 -m http.server 4173
```

The early-access database, Edge Functions and infrastructure are maintained as
code in [`supabase/`](supabase/) and [`infrastructure/`](infrastructure/). The
infrastructure directory contains the OpenTofu ownership and import workflow
for Cloudflare, AWS and Supabase resources.
