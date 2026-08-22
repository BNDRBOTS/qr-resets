# BNDR Admin Setup — Railway

The admin console is server-gated. Railway environment credentials are used only to bootstrap the persistent single-admin credential record when none exists; there are no default or hard-coded admin credentials.

## 1. Persistent storage

Attach one Railway Volume to the `qr-resets` service and mount it at `/data`.

Do **not** manually create `RAILWAY_VOLUME_MOUNT_PATH`. Railway supplies that variable when the Volume is attached.

## 2. Admin credentials

In the service **Variables** tab, set:

```text
ADMIN_EMAIL=your-admin-email@example.com
```

Then choose exactly one password method.

### Simple Railway-secret method

```text
ADMIN_PASSWORD=use-a-long-unique-password-here
```

Seal the variable in Railway.

### Preferred bcrypt-hash method

Generate a bcrypt hash locally from this project's installed `bcryptjs` dependency:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'YOUR-LONG-UNIQUE-PASSWORD'
```

Then set only:

```text
ADMIN_PASSWORD_HASH=$2b$12$...
```

Do not commit either password value to GitHub or source files.

## 3. Runtime variables handled automatically

For the default Railway + SQLite configuration, leave these unset unless intentionally overriding them:

```text
RAILWAY_VOLUME_MOUNT_PATH
NEXTAUTH_SECRET
RATE_LIMIT_PEPPER
NEXTAUTH_URL
DATABASE_URL
```

Railway supplies the Volume mount path. The production startup script persists generated `NEXTAUTH_SECRET` and `RATE_LIMIT_PEPPER` values on the Volume when omitted, derives `NEXTAUTH_URL` from `RAILWAY_PUBLIC_DOMAIN`, and resolves SQLite to the persistent Volume.

## 4. Use the admin console

After Railway redeploys with the credential variables:

1. Open `/admin/login`.
2. On the first bootstrap, sign in with `ADMIN_EMAIL` and the password corresponding to `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`. After an in-app password reset, use the new persistent password instead.
3. `/admin` opens the authenticated admin console.
4. Create, edit, publish, import, clean, and verify resources there. Bulk/source imports continue through the existing normalization path.

## 5. Persistent credential state

The first admin authentication or recovery request bootstraps one persistent admin credential row from `ADMIN_EMAIL` plus `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`. After that row exists, it is the authentication source of truth; normal restarts and stale Railway password variables do not overwrite it.

To enable account recovery, configure a long unique Railway secret before or after bootstrap:

```text
ADMIN_RECOVERY_KEY=use-a-separate-random-secret-at-least-24-characters
```

Only a one-way digest of this recovery key is stored in the application database. If a persistent admin row already exists without a recovery digest, the configured key is adopted once; later Railway edits do not silently rotate it. Password resets increment the persistent credential version, which invalidates older admin sessions at the server authorization layer.
