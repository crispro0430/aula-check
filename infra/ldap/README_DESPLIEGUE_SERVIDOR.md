# Despliegue de OpenLDAP y phpLDAPadmin para Aula Check en `Lubuntuserver`

Esta guía describe el despliegue seguro del directorio institucional **OpenLDAP** en el servidor doméstico Linux (`Lubuntuserver`, Ubuntu/Lubuntu 64-bit, IP LAN `192.168.0.15`, IP Tailscale `100.76.207.99`) sin interferir con los servicios ya activos en la máquina.

---

## 1. Matriz de Puertos y Restricciones

| Servicio existente / nuevo | Puerto(s) | Estado | Notas |
| :--- | :--- | :--- | :--- |
| **AdGuard Home (DNS & UI)** | `53`, `8080` | **OCUPADO (NO TOCAR)** | Se mantiene intacto. |
| **Samba Standalone** | `139`, `445` | **OCUPADO (NO TOCAR)** | No se usa Samba AD DC. |
| **OpenLDAP (`aulacheck-openldap`)** | `389` (LDAP), `636` (LDAPS) | **LIBRE / NUEVO** | Directorio institucional `dc=aulacheck,dc=edu,dc=co`. |
| **phpLDAPadmin (`aulacheck-phpldapadmin`)** | `8081` (mapeado `8081:80`) | **LIBRE / NUEVO** | Evita colisión con el `8080` de AdGuard Home. |

---

## 2. Verificar Puertos Libres en `Lubuntuserver`

Antes de iniciar los contenedores, conéctate por SSH al servidor y confirma que `389`, `636` y `8081` estén libres:

```bash
ssh usuario@192.168.0.15
sudo ss -tulpn | grep -E ':(389|636|8081)\b'
```

Si el comando no devuelve salida, los puertos están disponibles.

---

## 3. Copiar Archivos a `/mnt/almacenamiento/ldap`

Desde tu estación de trabajo (en la raíz del proyecto `aula-check`), copia la carpeta `infra/ldap/` hacia el almacenamiento persistente del servidor:

```bash
# Crear carpeta destino en el servidor
ssh usuario@192.168.0.15 "sudo mkdir -p /mnt/almacenamiento/ldap/data/slapd/database /mnt/almacenamiento/ldap/data/slapd/config && sudo chown -R \$USER:\$USER /mnt/almacenamiento/ldap"

# Copiar docker-compose.yml, bootstrap.ldif y este README
scp -r infra/ldap/* usuario@192.168.0.15:/mnt/almacenamiento/ldap/
```

*(Opcional pero recomendado)* Define contraseñas administrativas propias creando `/mnt/almacenamiento/ldap/.env`:

```bash
cd /mnt/almacenamiento/ldap
cat << 'EOF' > .env
LDAP_ADMIN_PASSWORD=CambiaEstaClaveSegura2026*
LDAP_CONFIG_PASSWORD=CambiaEstaClaveConfig2026*
EOF
chmod 600 .env
```

---

## 4. Levantar los Contenedores Docker

En `Lubuntuserver`, dentro de `/mnt/almacenamiento/ldap`:

```bash
cd /mnt/almacenamiento/ldap
docker compose up -d
docker compose ps
docker compose logs -f openldap
```

Espera unos segundos hasta ver que `slapd` está escuchando en `389` y `636` (presiona `Ctrl+C` para salir de los logs).

---

## 5. Importar Estructura Inicial (`bootstrap.ldif`)

Ejecuta `ldapadd` dentro del contenedor para crear las Unidades Organizativas (`ou=coordinacion`, `ou=docentes`, `ou=estudiantes`) y las cuentas iniciales:

```bash
docker exec -it aulacheck-openldap ldapadd \
  -x \
  -H ldap://localhost:389 \
  -D "cn=admin,dc=aulacheck,dc=edu,dc=co" \
  -w "AulaCheckAdmin2026*" \
  -f /bootstrap/bootstrap.ldif
```

> **Nota:** Si definiste una contraseña distinta en `.env` (`LDAP_ADMIN_PASSWORD`), reemplaza `AulaCheckAdmin2026*` por tu contraseña.

### Verificar que los usuarios existen en LDAP

```bash
docker exec -it aulacheck-openldap ldapsearch \
  -x \
  -H ldap://localhost:389 \
  -D "cn=admin,dc=aulacheck,dc=edu,dc=co" \
  -w "AulaCheckAdmin2026*" \
  -b "dc=aulacheck,dc=edu,dc=co" \
  "(objectClass=inetOrgPerson)" dn mail cn
```

### Probar autenticación directa (bind) de un usuario

```bash
docker exec -it aulacheck-openldap ldapwhoami \
  -x \
  -H ldap://localhost:389 \
  -D "uid=alejandro.morales,ou=docentes,dc=aulacheck,dc=edu,dc=co" \
  -w "123456"
```

---

## 6. Acceso a phpLDAPadmin (Interfaz Web de Administración)

- Desde la red LAN: `http://192.168.0.15:8081`
- Desde Tailscale: `http://100.76.207.99:8081`
- **Login DN:** `cn=admin,dc=aulacheck,dc=edu,dc=co`
- **Password:** El valor configurado en `LDAP_ADMIN_PASSWORD` (por defecto `AulaCheckAdmin2026*`).

---

## 7. Exposición Segura hacia Vercel / Internet (CG-NAT)

Debido a que el servidor doméstico está detrás de **CG-NAT**, el puerto `389` no se debe abrir directamente mediante port-forwarding tradicional en el router ISP. Tienes dos opciones recomendadas:

### Opción A: Desarrollo Local o VPS Puente con Tailscale (`100.76.207.99`)
Si Next.js corre en una máquina dentro de la misma red LAN o conectada a tu red **Tailscale**:
- Configura en `.env.local`:
  ```env
  LDAP_ENABLED="true"
  LDAP_URL="ldap://100.76.207.99:389"
  LDAP_BASE_DN="dc=aulacheck,dc=edu,dc=co"
  LDAP_BIND_DN="cn=admin,dc=aulacheck,dc=edu,dc=co"
  LDAP_BIND_PASSWORD="AulaCheckAdmin2026*"
  ```

### Opción B: Túnel Cifrado para Vercel Serverless (Cloudflare Tunnel / Tailscale Funnel / VPS Proxy TLS)
Las funciones Serverless de Vercel corren fuera de tu red Tailscale privada. Para conectarlas de forma segura sin exponer LDAP en texto plano:

1. **Publicar túnel TCP/TLS en `Lubuntuserver` con `cloudflared` (o proxy `stunnel`/HAProxy sobre un VPS con IP pública y Tailscale):**
   - Si usas un VPS pequeño con IP pública conectado a tu Tailnet, reenvía `ldaps://tudominio.com:636` hacia `100.76.207.99:636` restringiendo la IP o validando certificado TLS.
   - Si usas **Cloudflare Tunnel + Cloudflare Access** para TCP o un túnel WireGuard/TLS dedicado, apunta `LDAP_URL` en **Vercel Environment Variables** a la URL cifrada (`ldaps://ldap.tudominio.edu.co:636`) y restringe las reglas de firewall (`ufw`) para permitir tráfico únicamente por la interfaz `tailscale0` y la red Docker:

```bash
# Ejemplo en Lubuntuserver: permitir puerto 389/636 solo en LAN y Tailscale
sudo ufw allow in on tailscale0 to any port 389 proto tcp
sudo ufw allow in on tailscale0 to any port 636 proto tcp
sudo ufw allow from 192.168.0.0/24 to any port 389 proto tcp
sudo ufw allow from 192.168.0.0/24 to any port 8081 proto tcp
```

### Comportamiento Híbrido (Resiliencia ante Caídas)
Si `Lubuntuserver` se apaga, reinicia o pierde internet mientras `LDAP_ENABLED="true"` en Vercel:
- El cliente `ldapts` abortará automáticamente a los **3000 ms** (`connectTimeout` / `timeout`).
- Aula Check registrará el fallback en logs y validará las credenciales contra **Supabase PostgreSQL**, garantizando **0% de tiempo fuera de servicio** en el portal universitario.
