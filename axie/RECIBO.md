# Recibo del envío — Ronda 1

```
Receipt ID              AV-AXIEVIBEAT-0EC76EA31FA0
Submitted version       Version 1
Enviado                 8 de septiembre de 2026, 3:32 PM UTC
Checks at submission    Accepted
Estado                  Current official entry
```

## Qué se declaró

| | |
|---|---|
| Enlace jugable | `https://loscaseritos.com/axie/` |
| Repositorio | `https://github.com/terceroswil/axie-survivors` (público) |
| Review commit SHA | `05ae50494adfdb21561d671ad0f8537423cd9db6` |
| Discord | `wingsunity`, conectado el 8/09 a las 3:03 PM UTC |
| Video de demo | ninguno (es opcional en las reglas v1.0.2) |

Verificado en el momento del envío: el juego contestaba 200 en 0,6 s y lo que
servía `loscaseritos.com/axie/` era **idéntico** al árbol de ese commit
(comparados `index.html`, `thumbnail.jpg`, `arte/LICENSE.md` y
`vfx/shield/atlas.png`, los cuatro iguales).

## ⚠️ Si se toca el juego antes del 21

La casilla *"This exact commit produced every build linked in this submission"*
deja de ser cierta apenas cambie lo que sirve la PC. El camino es:

1. Sincronizar el espejo: `git subtree split --prefix=axie`, **filtrando
   `ENTREGA.md` y `MEJORAS.md`** (ver `CLAUDE.md`; un split a secas los
   republica).
2. Sacar el SHA nuevo del espejo.
3. Reconectar Discord si se desconectó — hace falta en **cada** finalización.
4. Reenviar. Crea una versión nueva y este recibo se conserva.

Cierre de envíos: **21 de septiembre, 13:00 UTC**.
Revisión de Ronda 1: **22 al 28 de septiembre** — el enlace tiene que seguir
vivo todos esos días.

## Ojo

*"Official entry is not the same as publication"*: finalizar la entrada no
publica ni aprueba el juego en la galería pública. El juego sigue viviendo en
el hosting elegido, que acá es esta PC por el túnel de Cloudflare.
