# Publicar 404heaven en Neocities

## La regla de oro

**Todo lo que está dentro de `public/` se publica. Todo lo que está fuera, no.**

No hay lista de exclusiones que mantener ni archivo de ignore que se pueda olvidar:
el CLI recibe `--src public` y físicamente no puede ver `supabase/`, `.git/`,
`.vscode/`, `.claude/` ni `.gitignore`, porque están un nivel más arriba.

```
404heaven/
├── public/          ← EL SITIO. esto y solo esto sube a neocities
│   ├── index.html
│   ├── art.html  bug.html  collections.html  guestbook.html
│   ├── journal.html  lab.html  memories.html
│   ├── css/style.css
│   └── js/main.js
│
├── supabase/        ← desarrollo, nunca sube
├── .claude/         ← desarrollo, nunca sube
├── .vscode/         ← desarrollo, nunca sube
├── .gitignore       ← desarrollo, nunca sube
└── DEPLOY.md        ← este archivo, nunca sube
```

Si mañana agregás imágenes, un `feed.xml` o una carpeta `collections/`,
va **dentro de `public/`**. Si es una herramienta o un script, va fuera.

## La herramienta

`async-neocities` (npm, de bcomnes). Ya está instalado global:

```powershell
npm install -g async-neocities
```

Es el mismo motor que usa la GitHub Action oficial `deploy-to-neocities`,
se mantiene al día (última publicación 2025-06) y hace diff por contenido:
solo sube lo que realmente cambió.

> No usamos `neocities-deploy` (npm): última publicación en 2023 y depende de
> `neocities@0.0.3` y `glob@7`, ambos viejos.
> El CLI oficial de Neocities es una gema de Ruby — instalar Ruby en Windows
> solo para esto no vale la pena teniendo Node.

## La API key

**No va en ningún archivo del repo.** El CLI la guarda en:

```
C:\Users\Usuario\AppData\Local\async-neocities\config.json
```

Eso está fuera de `404heaven/`, así que git no la ve ni puede versionarla.

El único archivo que el CLI escribe acá adentro es `deploy-to-neocities.json`,
que contiene **solo** `{"siteName":"tu-sitio"}` — sin credenciales. Se puede
commitear tranquilo.

Comandos útiles:

```powershell
async-neocities --status       # ¿a qué sitio apunta y hay key?
async-neocities --print-key    # ¿hay key guardada?
async-neocities --clear-key    # borrar la key de este equipo
async-neocities --force-auth   # volver a autenticar
```

### Alternativa: variable de entorno

Si preferís no dejarla guardada en disco, pasala por entorno en cada sesión
de PowerShell (no queda en ningún archivo):

```powershell
$env:NEOCITIES_API_TOKEN = "tu-api-key"
```

## Publicar

Siempre desde la raíz del repo (`c:\Users\Usuario\Desktop\404heaven`),
**no** desde dentro de `public/`.

### 1. Dry run — SIEMPRE primero

```powershell
async-neocities --preview
```

No sube nada. La primera vez te va a pedir el nombre del sitio y tu contraseña
de Neocities (para canjearla por la API key), y después imprime el diff:
qué se agrega, qué se actualiza y qué quedaría huérfano.

### 2. Subida real (segura)

```powershell
async-neocities
```

Sube y actualiza. **No borra nada.** Es el comando de todos los días.

### 3. Borrar lo viejo — con cuidado

```powershell
async-neocities --cleanup
```

`--cleanup` borra de Neocities **todo lo que no esté en `public/`**.

⚠️ Antes de correrlo, mirá qué archivos hay hoy en tu sitio de Neocities.
Si subiste imágenes u otros archivos por la web de Neocities y no están en
`public/`, `--cleanup` los borra. Para protegerlos:

```powershell
async-neocities --cleanup --protect "img/**"
```

Regla práctica: corré `--preview` y leé la lista de huérfanos antes de
cualquier `--cleanup`.

## Nota sobre tipos de archivo

Las cuentas gratuitas de Neocities tienen una lista blanca de extensiones.
`.html`, `.css` y `.js` pasan sin problema. Si algún día agregás algo que
Neocities rechaza, el CLI lo reporta como *skipped*; con cuenta de supporter
se salta con `--supporter`.
