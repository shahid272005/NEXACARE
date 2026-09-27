# Identity OTP: demo versus deployment

The kiosk currently uses a visible **simulated OTP** (`123456`) only with the supplied synthetic identity examples. It does not send SMS, validate a real Aadhaar, ABHA, or BPL number, nor store either number. This is deliberate for the summit demo.

For a real hospital deployment, move the entire verification exchange to a server-side service. Obtain the hospital's approved access to the applicable identity/consent provider, request patient consent, send and verify the OTP through that provider, retain only the provider result and audit reference, rate-limit attempts, and never expose provider credentials or raw identity values to the browser, logs, analytics, or public displays. Payment must likewise be confirmed by a signed gateway webhook before issuing an OPD token.
