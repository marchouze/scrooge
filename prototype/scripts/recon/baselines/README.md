# Decision recon baselines

D-DECISIONS-FRAMEWORK-REDESIGN Slice B grandfathered the historical
violation set so the recon gates can be promoted from WARN to ERROR
without blocking CI before Slice C's backfill cleans them up.

One file per recon pipeline, one violation subject per line.
Empty lines and `#`-prefixed comments are ignored.

Slice C empties these as it backfills the missing `requested` events,
maps legacy slugs (S3..S8) onto semantic ids, and rebrands the
prefix-shadowed `D-PARTY-REGISTER` root. Files retained after Slice C
will keep the gates wired but assert ZERO grandfathered drift.
