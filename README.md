# Stock Diario – Dulce Jazmín

Web app (PWA) para el control de stock diario de **DULCE JAZMÍN**. Replica la planilla en papel, funciona **sin conexión** en el iPhone y guarda los datos **solo en el dispositivo** (IndexedDB).

## Qué hace

- Una planilla por fecha, con autoguardado al escribir.
- Cada celda se carga con el teclado numérico o con los botones **+** y **−** (suman o restan 1; nunca baja de 0).
- Totales automáticos: **TOTAL Cookies + Flat** y **TOTAL Cuchareables**.
- Al crear un día nuevo, opción de precargar el *Stock inicial turno mañana* con el *Stock al finalizar turno tarde* del último día cargado.
- Vista **Completa** (7 columnas, productos fijos a la izquierda) y vistas **Mañana** / **Tarde**.
- **Historial**: abrir, editar o borrar días.
- **Productos**: agregar, renombrar, reordenar, ocultar o eliminar (las planillas viejas no se rompen).
- **Descargar PDF** idéntico a la planilla en papel (A4, una hoja) y **PDF en blanco** para imprimir.
- **Backup**: exportar / importar todo en un archivo JSON.

## Archivos

```
index.html      estructura de la app
styles.css      estilos (rosa, modo oscuro, mobile-first)
app.js          lógica: datos, planilla, PDF, backup
sw.js           service worker (cache offline)
manifest.json   datos de la PWA
icons/          íconos 180, 192 y 512
libs/           jsPDF 2.5.1 + jspdf-autotable 3.8.2 (locales, para PDF offline)
```

## Publicar gratis en GitHub Pages

1. Creá una cuenta en <https://github.com> (si no tenés).
2. Arriba a la derecha: **+ → New repository**. Nombre, por ejemplo, `stock-cookies`. Dejalo **Public** y tocá **Create repository**.
3. En la página del repositorio vacío tocá **uploading an existing file**.
4. Arrastrá **todo el contenido** de esta carpeta (los archivos `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.json`, `README.md` y las carpetas `icons` y `libs`). Ojo: tienen que quedar en la raíz del repositorio, no dentro de otra carpeta.
5. Tocá **Commit changes**.
6. Andá a **Settings → Pages**. En *Build and deployment*, *Source*: **Deploy from a branch**; *Branch*: **main** y carpeta **/ (root)**. Tocá **Save**.
7. Esperá 1–2 minutos y recargá esa página: aparece la dirección, del tipo
   `https://TU-USUARIO.github.io/stock-cookies/`

## Instalar en el iPhone ("Agregar a pantalla de inicio")

1. Abrí la dirección de GitHub Pages en **Safari** (tiene que ser Safari).
2. Esperá a que cargue del todo (con esa primera carga ya queda guardada para usar sin internet).
3. Tocá el botón **Compartir** (el cuadrado con la flecha hacia arriba).
4. Bajá y tocá **Agregar a pantalla de inicio** → **Agregar**.
5. Abrí la app siempre desde el ícono de la cookie. Funciona sin conexión.

> Importante: los datos quedan guardados en ese iPhone, dentro de la app instalada. Si borrás la app del inicio o los datos de Safari, se pierden. **Hacé un backup de vez en cuando** (Ajustes → Exportar datos) y guardalo en Archivos / iCloud / WhatsApp.

## Descargar el PDF en el iPhone

En la planilla del día tocá **Descargar PDF**. Se abre la hoja de compartir: elegí **Guardar en Archivos**, **WhatsApp**, **Imprimir**, etc. En navegadores que no tienen hoja de compartir, el archivo se descarga directo como `Stock_Dulce_Jazmin_dd-mm-aaaa.pdf`.

## Actualizar la app más adelante

1. Cambiá los archivos y, en `sw.js`, subí la versión: `dulce-jazmin-v2` → `dulce-jazmin-v3`.
2. Subilos de nuevo al repositorio (**Add file → Upload files**, reemplazando).
3. En el iPhone, abrí la app con internet, cerrala y volvé a abrirla: toma la versión nueva. Los datos no se pierden.

## Probar en la computadora

Con Python instalado, desde esta carpeta:

```bash
python -m http.server 8000
```

y abrí <http://localhost:8000>. (Abriendo `index.html` con doble clic no funciona el modo offline.)
