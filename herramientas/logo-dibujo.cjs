/* EL DIBUJO del logo de Los Caseritos: un león. Solo geometría, no escribe nada.

   Vive aparte porque lo usan dos scripts y el dato no puede estar duplicado:
     · logo.cjs        → los íconos y el símbolo del encabezado, y los inyecta
                         en tienda-publicada.html, admin.html y og.html
     · logo-franja.cjs → la franja a color de la portada y la hoja de comparación
   Si los paths estuvieran copiados en los dos, tarde o temprano uno se corrige
   y el otro no. Que es exactamente por lo que el logo se genera y no se edita.

   Antes acá había una casita sobre una canasta. Se cambió el 25/08/2026 por el
   león, que es el logo con el que el negocio ya se conoce en Facebook. La
   canasta sigue en el historial: `git show 6ae5fcd:herramientas/logo.cjs`.

   El dibujo se arma UNA vez y se pinta de dos maneras:
     · silueta blanca calada  → dentro del cuadrito verde (encabezado, favicon, PWA)
     · a todo color, dorado   → franja de la portada e imagen de compartir
   En la silueta, los ojos, el hocico y la boca se RECORTAN con máscara en vez
   de pintarse: así el fondo se ve a través y nunca hay que adivinar de qué
   color van. Es el mismo truco que usaba la canasta. */

const TAU = Math.PI * 2;

/* ── La melena ──────────────────────────────────────────────────────────────
   Estrella de N puntas con curvas cuadráticas. El control de cada curva NO va
   en el radio del valle: una cuadrática pasa a mitad de camino entre sus
   extremos y el control, así que para que el valle caiga en Ri hay que pasarse.
   De ahí sale Rc = 2·Ri − Ro·cos(Δ/2). Sin esa corrección la melena queda como
   una nube redonda, sin puntas.                                               */
const CX = 50, CY = 46;

function estrella(puntas, Ri, giro = 0) {
  const N = puntas.length, paso = TAU / N;
  const en = (r, a) => `${(CX + r * Math.cos(a)).toFixed(1)} ${(CY + r * Math.sin(a)).toFixed(1)}`;
  let d = '';
  for (let i = 0; i < N; i++) {
    const a0 = i * paso - Math.PI / 2 + giro;
    const a1 = (i + 1) * paso - Math.PI / 2 + giro;
    const Ro = (puntas[i] + puntas[(i + 1) % N]) / 2;   /* el valle entre dos puntas
                                                           desiguales usa el promedio */
    if (i === 0) d += 'M' + en(puntas[0], a0);
    d += 'Q' + en(2 * Ri - Ro * Math.cos(paso / 2), (a0 + a1) / 2) + ' ' + en(puntas[(i + 1) % N], a1);
  }
  return d + 'Z';
}

/* ⚠️ Con todas las puntas del mismo largo el dibujo se leía como un SOL, no
   como una melena — que es lo que le pasa a los logos de leones mal hechos. Lo
   que lo salva es que sean DESPAREJAS. El patrón de cuatro largos se repite
   tres veces (12 lóbulos), así cierra justo y no queda un salto entre la última
   punta y la primera. Poco filosas, además: una melena es maciza, no un
   engranaje. */
const MELENA = estrella([47, 40, 44.5, 41.5, 47, 40, 44.5, 41.5, 47, 40, 44.5, 41.5], 37);

/* Segunda vuelta de melena, corrida medio paso y más corta. Solo la usa la
   versión a COLOR, como sombra entre la melena y la cara.
   ⚠️ En la silueta blanca no hace falta —sería blanco sobre blanco— pero a
   color es lo que separa las dos zonas. Sin ella la imagen de compartir se
   leía como un SOL: la cara clara y la melena dorada tenían casi el mismo
   brillo y se fundían en una mancha redonda con ojos. */
const MELENA_INTERNA = estrella([41, 36, 39, 37, 41, 36, 39, 37, 41, 36, 39, 37], 33, Math.PI / 12);

/* ── La cara ────────────────────────────────────────────────────────────────
   ⚠️ El primer intento tenía la cara y la melena del mismo blanco: se fundían
   en una sola mancha y quedaba una bola con puntas y unos ojos flotando. Lo que
   separa las dos cosas es un ARO CALADO entre ellas — 3 unidades por donde se
   ve el fondo. Ese aro es lo único que hace leer "melena alrededor de cara".
   Y la cara va GRANDE (radio 32 contra 47 de melena): los leones de logo que se
   leen chiquitos tienen la cara ocupando dos tercios, no un tercio.            */
const ARO = 'M50 13a35 35 0 1 0 .01 0Z';        /* el hueco: círculo r35 */
const ARO_ANCHO = 'M50 11a37 37 0 1 0 .01 0Z';  /* el mismo, para 16 px */
const CARA = 'M50 16a32 32 0 1 1-.01 0Z';       /* la cara: círculo r32 */

/* Orejas: rompen el aro arriba, si no el conjunto se lee como una moneda. */
const OREJAS = 'M22 32a9 9 0 0 1 13-9l3 12Z M78 32a9 9 0 0 0-13-9l-3 12Z';

/* ── Lo que se recorta de la cara ───────────────────────────────────────────
   Cejas caídas hacia adentro = gesto fiero. Con los ojos horizontales el león
   sale simpático, que no es lo que dice el logo de Facebook.
   Los colmillos se fueron: a 36 px eran barro y el hocico se leía como barba. */
const OJOS = 'M29 38L45 45L41 52C33 52 29 46 29 38Z'
  + 'M71 38L55 45L59 52C67 52 71 46 71 38Z';
const HOCICO = 'M41 57H59Q59 68 50 71Q41 68 41 57Z';
/* La boca se queda corta a propósito: estirada hasta el borde de la cara
   parecía que el círculo estaba partido en dos. */
const BOCA = 'M50 70q-5 6-11 3M50 70q5 6 11 3';

/* ── Silueta calada ─────────────────────────────────────────────────────────
   `color` pinta el cuerpo; los huecos dejan pasar lo que haya detrás.

   `chico` es la versión para 16 px (favicon y pestaña del navegador).
   ⚠️ El aro de 3 unidades mide 0,48 px a ese tamaño: desaparece, y la cara
   vuelve a fundirse con la melena. Ahí el aro se ensancha a 5 y la boca se va
   — a 16 px es una mancha que ensucia el hocico. El dibujo es el mismo.       */
const LEON = (color, id = 'mLeon', chico = false) => `
  <mask id="${id}">
    <rect width="100" height="100" fill="black"/>
    <path d="${MELENA}" fill="white"/>
    <path d="${chico ? ARO_ANCHO : ARO}" fill="black"/>
    <path d="${CARA}" fill="white"/>
    <path d="${OREJAS}" fill="white"/>
    <path d="${OJOS}" fill="black"/>
    <path d="${HOCICO}" fill="black"/>` + (chico ? '' : `
    <path d="${BOCA}" fill="none" stroke="black" stroke-width="4" stroke-linecap="round"/>`) + `
  </mask>
  <rect width="100" height="100" fill="${color}" mask="url(#${id})"/>`;

/* ── A todo color ───────────────────────────────────────────────────────────
   Acá no hay fondo que mostrar por los huecos, así que el aro se convierte en
   un contorno oscuro y los rasgos se pintan. Mismo dibujo. */
const LEON_COLOR = (suf = '') => `
  <defs>
    <linearGradient id="mel${suf}" x1="0" y1="0" x2=".3" y2="1">
      <stop offset="0" stop-color="#ffd24a"/><stop offset=".55" stop-color="#ff9a3d"/><stop offset="1" stop-color="#f2622a"/>
    </linearGradient>
    <linearGradient id="car${suf}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f2a950"/><stop offset="1" stop-color="#c9741a"/>
    </linearGradient>
  </defs>
  <path d="${MELENA}" fill="url(#mel${suf})"/>
  <path d="${MELENA_INTERNA}" fill="#c9531a"/>
  <path d="${OREJAS}" fill="#e8761f"/>
  <path d="${CARA}" fill="url(#car${suf})" stroke="#8f3a08" stroke-width="3"/>
  <path d="${OJOS}" fill="#5c2408"/>
  <path d="${HOCICO}" fill="#5c2408"/>
  <path d="${BOCA}" fill="none" stroke="#5c2408" stroke-width="4" stroke-linecap="round"/>`;

/* La melena se dibuja alrededor de (50,46), no de (50,50): hay que recentrarla
   dentro del cuadrito o el león queda pegado al borde de arriba. */
const CENTRAR = (escala) => `translate(50,50) scale(${escala}) translate(-50,-${CY})`;

/* ═══════════════════════════════════════════════════════════════════════════
   LEÓN ILUSTRADO — la versión con detalle, para donde hay lugar

   El de arriba es un SÍMBOLO: sirve a 16 px porque no tiene nada que perder.
   Este es otra cosa. Va en la imagen de compartir, donde la cabeza mide 300 px
   y un ícono plano se ve pobre.

   Lo que hace que un león dibujado parezca de verdad y no un emoji:
     · la melena NO es una estrella regular — son tufos sueltos, de largo y
       ancho distintos, en tres capas de tono. Una estrella pareja se lee
       siempre como un sol, por más puntas que le pongas.
     · la cara tiene planos: frente clara, mejillas en sombra, no un color liso.
     · el hocico tiene estructura de verdad: nariz con ventanas, dos almohadillas
       de bigotes, línea de boca y mentón. El "hocico" del símbolo era una gota.
     · los ojos llevan iris, pupila y un brillo. Sin el brillo quedan muertos.

   ⚠️ La variación de los tufos es PSEUDOALEATORIA CON SEMILLA FIJA, no
   Math.random(): si cambiara en cada corrida, el logo saldría distinto cada vez
   que se regenera y el git se llenaría de ruido. Con semilla fija el archivo es
   siempre byte por byte el mismo.                                             */

const LCX = 50, LCY = 48;
const lpt = (r, a) => `${(LCX + r * Math.cos(a)).toFixed(1)} ${(LCY + r * Math.sin(a)).toFixed(1)}`;

/* generador con semilla: mismo número de entrada, misma secuencia siempre */
function azarConSemilla(semilla){
  let s = semilla;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

/* Una capa de melena: `n` tufos alrededor, cada uno con su largo y su ancho.
   `giro` corre la capa para que no se apilen los tufos de una sobre otra. */
function capaDeMelena(n, ri, roMin, roMax, giro, semilla){
  const az = azarConSemilla(semilla);
  const paso = TAU / n;
  let d = '';
  for (let i = 0; i < n; i++){
    const a = i * paso + giro;
    const ro = roMin + az() * (roMax - roMin);
    const w = paso * (0.56 + az() * 0.30);          // medio ancho angular del tufo
    const torcido = (az() - 0.5) * paso * 0.55;     // la punta no cae en el eje: da vida
    const b1 = lpt(ri, a - w), b2 = lpt(ri, a + w);
    const punta = lpt(ro, a + torcido);
    /* los controles se corren hacia afuera para que el tufo salga curvo,
       como un mechón, y no como un triángulo */
    const c1 = lpt(ri + (ro - ri) * 0.55, a - w * 0.75);
    const c2 = lpt(ri + (ro - ri) * 0.55, a + w * 0.75);
    d += `M${b1}Q${c1} ${punta}Q${c2} ${b2}Z`;
  }
  return d;
}

const MELENA_ATRAS  = capaDeMelena(24, 29, 43, 51, 0.00, 20260826);
const MELENA_MEDIO  = capaDeMelena(21, 27, 38, 45, 0.13, 77712345);
const MELENA_FRENTE = capaDeMelena(18, 22, 33, 39, 0.27, 31415926);

/* La cabeza. ⚠️ Tiene que ser ANCHA — más de lo que uno cree.
   El primer intento la dejó en radio 24 contra 25 del arranque de la melena, y
   entre las dos quedaba un filo del fondo asomando: se veía un contorno verde
   alrededor de la cara, como si estuviera recortada y pegada. La cabeza pisa la
   melena, nunca al revés. Acá llega a radio 28 y la capa de adelante arranca
   en 22, así que se superponen 6 unidades. */
const CABEZA = 'M50 16C65 16 76 25 77 39C78 48 74 54 70 59C66 64 62 68 58 71'
  + 'C56 75 53 78 50 78C47 78 44 75 42 71C38 68 34 64 30 59C26 54 22 48 23 39'
  + 'C24 25 35 16 50 16Z';

/* ⚠️ Las orejas hay que sacarlas AFUERA de la silueta de la cabeza.
   Puestas sobre las sienes quedaban tapadas por la propia cabeza y no se veía
   ninguna. Y son importantes: dos orejas asomando dicen "animal" al instante;
   sin ellas la melena vuelve a leerse como un sol. */
const OREJA_IZQ = 'M35 27C27 25 20 19 23 13C26 8.5 34 13 39 21Z';
const OREJA_DER = 'M65 27C73 25 80 19 77 13C74 8.5 66 13 61 21Z';
const OREJA_IZQ_DENTRO = 'M34 24C29 22 25 18.5 26.5 15.5C28.5 13 33 16 36 21Z';
const OREJA_DER_DENTRO = 'M66 24C71 22 75 18.5 73.5 15.5C71.5 13 67 16 64 21Z';

/* Ojos: almendra + iris + pupila + brillo. El párpado de arriba va más recto
   que el de abajo y cae hacia adentro: eso da la mirada seria.
   Sin el punto de brillo los ojos quedan muertos, es el detalle más barato
   y el que más rinde. */
const OJO = (cx, esp) => `
    <path d="M${cx - 7.5} ${45 + esp * 1.5}Q${cx} ${39.5} ${cx + 7.5} ${45 - esp * 0.5}Q${cx} ${50.5} ${cx - 7.5} ${45 + esp * 1.5}Z" fill="#fff3dc"/>
    <circle cx="${cx}" cy="45" r="3.6" fill="#a8620d"/>
    <circle cx="${cx}" cy="45" r="1.8" fill="#2a1204"/>
    <circle cx="${cx - 1.3}" cy="43.7" r="0.95" fill="#ffffff" opacity=".9"/>`;

/* Cejas: dos cuñas finas que bajan hacia el centro. ⚠️ Gruesas quedaban como
   cejas humanas y la cara se volvía un señor enojado. */
const CEJAS = 'M29 40Q37 35.5 44.5 39.5L44 41Q37 38 30 41.5Z'
  + 'M71 40Q63 35.5 55.5 39.5L56 41Q63 38 70 41.5Z';

/* El hocico completo: puente, nariz con ventanas, las dos almohadillas de los
   bigotes, la línea de la boca y los bigotes.
   ⚠️ Las almohadillas van en un tono cercano al de la cara, NO en crema: con el
   crema se leían como un bigote blanco pegado. */
const PUENTE = 'M47 49Q50 47 53 49L52 58H48Z';
const NARIZ = 'M43 56H57Q57.5 61.5 50 65Q42.5 61.5 43 56Z';
const VENTANAS = 'M45.8 58.6Q47.4 57.6 48.4 59.1Q47.3 60.1 45.8 58.6Z'
  + 'M54.2 58.6Q52.6 57.6 51.6 59.1Q52.7 60.1 54.2 58.6Z';
const CACHETES = 'M50 66Q41.5 66 38 71.5Q40.5 76 45.5 74.5Q49 73.2 50 69.5Z'
  + 'M50 66Q58.5 66 62 71.5Q59.5 76 54.5 74.5Q51 73.2 50 69.5Z';
const BOCA_DET = 'M50 65V69M50 69Q45 73.5 40.5 71M50 69Q55 73.5 59.5 71';
const BIGOTES = 'M41.5 69.5h-2M42 71.8h-2.2M43 73.8h-2'
  + 'M58.5 69.5h2M58 71.8h2.2M57 73.8h2';

const LEON_DETALLE = (suf = '') => `
  <defs>
    <linearGradient id="mA${suf}" x1=".2" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="#c2500f"/><stop offset="1" stop-color="#8f3406"/>
    </linearGradient>
    <linearGradient id="mB${suf}" x1=".2" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="#f08a1e"/><stop offset="1" stop-color="#c2500f"/>
    </linearGradient>
    <linearGradient id="mC${suf}" x1=".3" y1="0" x2=".7" y2="1">
      <stop offset="0" stop-color="#ffcb4d"/><stop offset="1" stop-color="#f08a1e"/>
    </linearGradient>
    <radialGradient id="cara${suf}" cx=".5" cy=".33" r=".72">
      <stop offset="0" stop-color="#ffdba6"/><stop offset=".62" stop-color="#f0ad5c"/>
      <stop offset="1" stop-color="#c9761f"/>
    </radialGradient>
  </defs>

  <path d="${MELENA_ATRAS}"  fill="url(#mA${suf})"/>
  <path d="${MELENA_MEDIO}"  fill="url(#mB${suf})"/>
  <path d="${MELENA_FRENTE}" fill="url(#mC${suf})"/>

  <path d="${CABEZA}" fill="url(#cara${suf})"/>
  <path d="${OREJA_IZQ}" fill="#d98a2c"/><path d="${OREJA_DER}" fill="#d98a2c"/>
  <path d="${OREJA_IZQ_DENTRO}" fill="#8f3a08"/><path d="${OREJA_DER_DENTRO}" fill="#8f3a08"/>
  <!-- ⚠️ Acá había una sombra de melena sobre la frente. Se veía como una
       VINCHA: una banda horizontal cruzando la cabeza. El volumen ya lo da el
       degradado radial de la cara, que aclara la frente y oscurece los bordes.
       Una sombra dibujada encima sobra y encima estorba. -->

  <path d="${CEJAS}" fill="#7a2f06" opacity=".85"/>
  ${OJO(37.5, 1)}
  ${OJO(62.5, -1)}

  <path d="${PUENTE}" fill="#e5a352" opacity=".5"/>
  <path d="${CACHETES}" fill="#f7c98a"/>
  <path d="${NARIZ}" fill="#5c2408"/>
  <path d="${VENTANAS}" fill="#2a1204"/>
  <path d="${BOCA_DET}" fill="none" stroke="#5c2408" stroke-width="2.4" stroke-linecap="round"/>
  <path d="${BIGOTES}" fill="none" stroke="#8f5a2a" stroke-width="1" stroke-linecap="round" opacity=".8"/>`;

module.exports = { LEON, LEON_COLOR, LEON_DETALLE, CENTRAR };
