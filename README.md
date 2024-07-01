
# [parempi.hyppykeli.fi](https://parempi.hyppykeli.fi)

Vanha hyppykeli.fi mätäni. Tässä uusi (2024) joka ehkä toimii paremmin.

Ei buildeja eikä varsinaista backendiä tässä. Säädata haetaan suoraan CORssilla Ilmatieteen laitoksen APIsta. Muutoksia voi tehdä suoraan `index.js` fileen. Tää on täysin static site eli lokaalisti voi devata vaikka ajamalla `python -m http.server` tän repon juuressa.

Deploy tapahtuu kun tämän repon `main` branchiin tehdään push. PR:t tervetulleita

Ainoat kirjastot joita tässä käytetään ovat [Preact](https://preactjs.com/) ja [htm](https://github.com/developit/htm) ja jossain vaihessa jokin graafien piirtämiseen. Muita vältetään mätänemisen välttämiseksi.
