# ADR 0004: Zero server-side telemetry

- **Status:** Accepted
- **Date:** 2026-04
- **Context:** `window.__odd.diagnostics` collects a payload suitable for bug reports (ODD version, registry counts, recent error-log ring buffer, environment). It would be technically easy to POST this somewhere automatically — "anonymous crash reports help us ship better software" is the usual sales pitch.
- **Decision:** ODD does not send telemetry. The diagnostics module assembles a payload locally, offers a "Copy diagnostics" button that puts it on the clipboard, and stops there. The user decides whether and where to share it.
- **Consequences:** We get fewer spontaneous bug reports than a telemetrised plugin would. In exchange, users never have to audit what ODD is phoning home about, site admins can drop ODD into locked-down environments without legal review, and this decision becomes load-bearing for the plugin's trust posture. If we ever want server-side analytics we have to revisit this ADR, not bury a fetch in a minor release.
- **Alternatives considered:**
  - *Opt-in telemetry.* Rejected: opt-in is rarely used, and even "opt-in" telemetry imposes a "is this safe to enable?" review burden on every installer.
  - *Anonymous ping-on-install.* Rejected: an install ping is still a ping. The plugin is self-hosted — hosts already know we exist.
  - *"Diagnostics send to X if user clicks button."* Rejected: we can always add a one-click paste into a GitHub issue later. Keeping the transport under user control preserves the property that ODD is safe to ship without a legal review.
