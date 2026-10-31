# Identity (frontend)

Sign-in and registration screens plus `identityApi.js`, which calls the backend
identity domain (`/api/auth/*`) and starts or ends the bearer-token session
through `services/auth.js`.

Unauthenticated entry screens may keep their own identity design; every
authenticated form must use `components/authenticated-ui` primitives.
