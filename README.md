
# [parempi.hyppykeli.fi](https://parempi.hyppykeli.fi)

Vanha hyppykeli.fi mätäni. Tässä uusi (2024) joka ehkä toimii paremmin.

Säädata haetaan suoraan CORssilla Ilmatieteen laitoksen APIsta ilman varsinaista backendiä. Muutoksia voi tehdä `index.js` fileen, jotka näkyy välittömästi. Vain riippuvuudet on bundlattuja, jotka nekin on commitoituna gittiin, eli kehittäminen ei vaadi kuin tekstieditorin ja staattisia tiedostoja jakavan http-serverin, esim. ajamalla `python -m http.server` tän repon juuressa, mutta muukin vastaavat toimii. 

Deploy tapahtuu kun tämän repon `main` branchiin tehdään push. PR:t tervetulleita

Ainoat kirjastot joita tässä käytetään ovat [Preact](https://preactjs.com/) ja [htm](https://github.com/developit/htm) sekä jossain vaihessa jokin graafien piirtämiseen. Muita vältetään mätänemisen välttämiseksi.
