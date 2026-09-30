# Copias de seguridad

Todos los datos de los talleres (clientes, órdenes, presupuestos, caja, stock,
usuarios) viven en la base de datos de **Supabase**. Las fotos, las firmas y
los logos están en el **Storage** de Supabase. Nada queda guardado solo en el
celular.

Hay tres capas de protección:

| Capa | Qué cubre | Quién la maneja |
|---|---|---|
| 1. Copia diaria cifrada en GitHub | Toda la base (todos los talleres, usuarios incluidos) | Automática, todas las noches |
| 2. Backups de Supabase | Toda la base, restaurable desde el panel | Supabase (plan Pro o superior) |
| 3. "Descargar mis datos" en la app | Los datos de un taller | Cada dueño, cuando quiera |

> Importante: las capas 1 y 2 copian la **base de datos**, pero **no los
> archivos del Storage** (fotos, firmas y logos). Esos archivos se respaldan
> aparte (pendiente).

---

## 1. Copia diaria cifrada (GitHub Actions)

El archivo `.github/workflows/backup.yml` corre todas las noches (03:00 hora
argentina). Copia la base con `pg_dump`, controla que la copia se pueda leer,
la cifra con AES-256 y la guarda 90 días como *artifact* del workflow.

### Configuración (una sola vez)

1. **Cadena de conexión.** En Supabase → tu proyecto → botón **Connect** (arriba)
   → pestaña de conexión → **Session pooler**. Copiá la URI, que se ve así:
   `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-xx.pooler.supabase.com:5432/postgres`.
   Reemplazá `[YOUR-PASSWORD]` por la contraseña de la base. Si no la
   recordás: Project Settings → Database → **Reset database password**.
   Tiene que ser la de **Session pooler**: los servidores de GitHub no pueden
   usar la conexión directa.
2. **Contraseña de cifrado.** Inventá una contraseña larga (por ejemplo, 5
   palabras al azar) y **guardala en un lugar seguro fuera de GitHub**. Sin
   ella no se pueden abrir las copias.
3. En GitHub → el repositorio → **Settings → Secrets and variables → Actions →
   New repository secret**, creá dos secrets:
   - `SUPABASE_DB_URL` con la URI del paso 1.
   - `BACKUP_PASSPHRASE` con la contraseña del paso 2.
4. Probalo: **Actions → Backup diario → Run workflow**. Tiene que terminar en
   verde y aparecer un archivo `backup-AAAA-MM-DD` abajo de todo, en *Artifacts*.

Si una noche falla, GitHub te manda un correo.

### Cómo restaurar

Hace falta una computadora con PostgreSQL 17 (`pg_restore`) y `gpg`.

```bash
# 1. Descargar el artifact desde GitHub (Actions → la corrida → Artifacts) y descomprimir el .zip
# 2. Descifrar (pide la BACKUP_PASSPHRASE)
gpg -o torque-orden.dump -d torque-orden-AAAA-MM-DD.dump.gpg

# 3a. Ver qué contiene
pg_restore --list torque-orden.dump | less

# 3b. Restaurar en un proyecto de Supabase NUEVO o vacío (no en el que está en uso)
pg_restore --no-owner --no-privileges -d "URI_DEL_PROYECTO_NUEVO" torque-orden.dump
```

Para recuperar solo una tabla o unos registros borrados por error, conviene
restaurar primero en un proyecto aparte y después copiar lo que falta.

---

## 2. Backups de Supabase

- En el **plan Pro** (pago), Supabase guarda **copias diarias** que se restauran
  desde el panel (Database → Backups). Existe además la opción *Point in Time
  Recovery*, que es un agregado pago.
- En el **plan Free** no conviene contar con backups de Supabase. Además, los
  proyectos gratis **se pausan** después de un tiempo sin uso. Revisá qué
  incluye tu plan en Supabase → Database → **Backups**.
- **Recomendación:** pasar a Pro cuando haya talleres usando la app de verdad.

---

## 3. "Descargar mis datos" (dentro de la app)

En **Configuración → 💾 Copia de mis datos**, el dueño de cada taller puede
descargar en cualquier momento:

- **Copia completa (.json):** todos los datos del taller (clientes, vehículos,
  motores, órdenes, presupuestos, stock, caja y la lista de fotos).
- **Órdenes para Excel (.csv):** una fila por orden, con cliente, teléfono,
  vehículo, patente, estado, fecha y trabajos.
