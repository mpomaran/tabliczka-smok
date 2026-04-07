# Smocza Tabliczka

Prosta aplikacja webowa mobile-first do nauki tabliczki mnożenia i dzielenia w zakresie do 100. Działa w całości po stronie przeglądarki, bez backendu i bez dodatkowych zależności.

## Funkcje

- mnożenie i dzielenie w zakresie do 100
- tylko 2 odpowiedzi na pytanie
- 5 sekund na mnożenie
- 8 sekund na dzielenie
- adaptacyjne powtarzanie trudniejszych działań
- odsłanianie smoka w siatce 10x10
- licznik poprawnych, błędnych i odkrytych pól
- pełny restart gry

## Uruchomienie lokalne

1. Uruchom prosty serwer HTTP w katalogu projektu:

```bash
python -m http.server 4173 --bind 0.0.0.0
```

2. Otwórz w przeglądarce:

```text
http://localhost:4173
```

3. Aby wejść z telefonu, użyj adresu komputera w tej samej sieci Wi-Fi, na przykład:

```text
http://192.168.0.25:4173
```

## Publikacja na GitHub Pages

Projekt jest już przygotowany pod GitHub Pages przez workflow w `.github/workflows/deploy-pages.yml`.

1. Utwórz nowe repozytorium na GitHub, na przykład `tabliczka-smok`.
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
6. Publiczny adres będzie miał postać:

```text
https://TWOJ_LOGIN.github.io/tabliczka-smok/
```

## Ważne

W tym środowisku nie mam dostępu do Twojego konta GitHub ani gotowego repozytorium, więc nie mogę wykonać finalnego pushu za Ciebie bez danych dostępowych lub adresu URL repo. Sama aplikacja i konfiguracja Pages są już gotowe.
