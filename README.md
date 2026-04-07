# Smocza Tabliczka

Prosta aplikacja webowa mobile-first do nauki tabliczki mnozenia i dzielenia w zakresie do 100. Dziala w calosci po stronie przegladarki, bez backendu i bez dodatkowych zaleznosci.

## Funkcje

- mnozenie i dzielenie w zakresie do 100
- tylko 2 odpowiedzi na pytanie
- 5 sekund na mnozenie
- 8 sekund na dzielenie
- adaptacyjne powtarzanie trudniejszych dzialan
- odslanianie smoka w siatce 10x10
- licznik poprawnych, blednych i odkrytych pol
- pelny restart gry

## Uruchomienie lokalne

1. Uruchom prosty serwer HTTP w katalogu projektu:

```bash
python -m http.server 4173 --bind 0.0.0.0
```

2. Otworz w przegladarce:

```text
http://localhost:4173
```

3. Aby wejsc z telefonu, uzyj adresu komputera w tej samej sieci Wi-Fi, na przyklad:

```text
http://192.168.0.25:4173
```

## Publikacja na GitHub Pages

Projekt jest juz przygotowany pod GitHub Pages przez workflow w `.github/workflows/deploy-pages.yml`.

1. Utworz nowe repozytorium na GitHub, na przyklad `tabliczka-smok`.
2. W katalogu projektu wykonaj:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TWOJ_LOGIN/tabliczka-smok.git
git push -u origin main
```

3. Na GitHub wejdź w `Settings -> Pages`.
4. W sekcji `Build and deployment` ustaw `Source: GitHub Actions`.
5. Po pushu workflow sam opublikuje stronę.
6. Publiczny adres bedzie mial postac:

```text
https://TWOJ_LOGIN.github.io/tabliczka-smok/
```

## Ważne

W tym środowisku nie mam dostepu do Twojego konta GitHub ani gotowego repozytorium, wiec nie moge wykonac finalnego pushu za Ciebie bez danych dostepowych lub URL repo. Sama aplikacja i konfiguracja Pages sa juz gotowe.
