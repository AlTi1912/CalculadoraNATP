# Llave Champions 2026

Calculadora de probabilidades para los playoffs de VALORANT Champions Shanghai 2026 (pick'em incluido).

Abrir `index.html` en el navegador. Para una versión de un solo archivo: `node build-artifact.js salida.html`.
Comprobación rápida del modelo en consola: `node test-model.js`.

## Qué hace

- **Llave interactiva**: doble eliminación de 8 equipos (Bo3, final inferior y gran final Bo5). Se marca el
  ganador real de cada partido tocando al equipo; opcionalmente se cargan los mapas jugados, que entran al
  ajuste como evidencia nueva.
- **Probabilidades exactas**: se recorren los 2^14 = 16.384 desenlaces de la llave (sin Monte Carlo).
- **Análisis por cruce**: cadena previo → fase de grupos → cara a cara → incertidumbre, mapas con su
  probabilidad de jugarse y de ganarse, combinaciones de mapas más probables e historial H2H ponderado.
- **Pick'em óptimo**: la llave coherente que maximiza los aciertos esperados.

## Modelo

1. Previo de temporada (Elo calibrado con Santiago, London, EWC y Stage 2) en logit de ronda.
2. Ajuste bayesiano conjunto de los 16 equipos con cada ronda de la fase de grupos (rival ajustado).
3. Desviación por equipo y mapa, contraída hacia 0; usa grupos y mapas con marcador de la temporada.
4. Cara a cara 2026: mapas ganados vs esperados, con vida media, peso 0,8 a la fase regular, 0,5 a los
   cruces interregionales y un pseudo-conteo que ancla a la predicción.
5. Veto de Champions simulado (softmax) con orden A/B al 50%.
6. Serie = mayoría de mapas, promediada sobre muestras de la posterior.

## Datos

`data.js`. Las entradas con `aprox: true` tienen fecha o marcador estimado. Fuentes: vlr.gg, Liquipedia,
esports.gg, sheepesports, dotesports, thespike, hotspawn, inven global, gosugamers.
