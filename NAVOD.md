# Obsazení organigramu ÚRÚ ČR – nasazení (GitHub Pages + Supabase)

Postup je stejný jako u onboardingové aplikace. Odhad: 30–45 minut klikání.

## Soubory
| Soubor | Co je to |
|---|---|
| `index.html` | stránka aplikace (vzhled) |
| `app.js` | logika aplikace |
| `structure.js` | organizační struktura ÚRÚ s vygenerovanými místy (návrh 10. 9. 2026) |
| `config.js` | **jediný soubor, který upravujete** – adresa a klíč Supabase |
| `vendor/xlsx.full.min.js`, `vendor/supabase.js` | knihovny (načítají se lokálně, žádné CDN) |
| `supabase.sql` | skript pro založení tabulek |

## 1. Supabase (nový projekt, ~10 min)
1. supabase.com → **New project** (např. `uru-organigram`, region Frankfurt). Heslo k DB si jen uložte.
2. **SQL Editor → New query** → vložte obsah `supabase.sql` → **Run**.
   (Vkládejte jen samotný SQL, bez ``` značek.)
3. **Authentication → Providers** → Email zapnuté.
   **Authentication → Sign In / Providers** → vypněte *Allow new users to sign up*.
4. **Authentication → Users → Add user** → e-mail p. Kozáka a váš (Auto Confirm User zaškrtnout).
5. **Project Settings → API** → zkopírujte *Project URL* a *anon public* klíč do `config.js`.

Pokud raději použijete stejný projekt jako onboarding: krok 1 přeskočte, ostatní platí. Tabulky
mají jiná jména, s onboardingem se nepletou – ale organigram pak uvidí všichni, kdo se mohou
přihlásit do onboardingu.

## 2. GitHub Pages (~10 min)
1. github.com → **New repository** → `uru-organigram`, **Private**.
2. **Add file → Upload files** → nahrajte všechny soubory včetně složky `vendor` (přetáhněte celou složku).
3. **Settings → Pages** → Source *Deploy from a branch*, branch `main`, folder `/ (root)` → Save.
4. Za minutu se objeví adresa `https://<vas-ucet>.github.io/uru-organigram/`.
5. Supabase → **Authentication → URL Configuration** → *Site URL* i *Redirect URLs*: tato adresa.

## 3. První spuštění
1. Otevřete adresu → zadejte e-mail → klikněte na odkaz v e-mailu.
2. Aplikace si sama založí prázdný stav v databázi.
3. **Nahrát Excel s lidmi** – tabulky DESÚ, ÚÚR, MMR (upravená verze s názvy útvarů) atd.
4. Máte-li rozpracovaný stav z lokální verze: **Uložit stav (json)** v lokálním souboru → **Načíst stav (json)** zde.

## Provoz
- Každá změna se do 1 s automaticky uloží (zelená tečka u e-mailu = uloženo, oranžová = ukládám, červená = chyba).
- Otevře-li aplikaci ve stejnou chvíli druhý člověk, změny se mu promítnou živě; při souběhu vyhraje první zápis a druhé okno se obnoví.
- **Historie** – kdo, kdy, koho a kam přesunul. **Přehled** – tabulka obsazení po útvarech a zdrojových úřadech (jde stáhnout jako xlsx).
- **Prezentace** – skryje ovládání a zobrazí čistý diagram (Esc ukončí). Tisk (Ctrl+P) vytiskne aktuální pohled.
- **Zpět / Znovu** (Ctrl+Z / Ctrl+Y) vrací poslední změny v aktuálním sezení – včetně importu nebo vymazání.
- **Volná místa (xlsx)** – seznam neobsazených míst po útvarech a lokalitách jako podklad pro nábor.
- **Uložit stav (json)** je záloha mimo databázi – doporučuji občas stáhnout.

## Aktualizace organizační struktury
Změní-li se organigram, upravte `structure.js` (nebo mi pošlete nový dokument a soubor vygeneruji).
Nová struktura se použije jen po **Vymazat vše**; do té doby běží uložený stav. Drobné změny
(přidat/odebrat místo, přejmenovat) jdou dělat přímo v aplikaci.
