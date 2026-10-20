# Aktiviranje kontakt forme preko Google-a

Forma je pripremljena za Google reCAPTCHA, privatnu Google tabelu i mejl obaveštenje na **n0t_l3ss@outlook.com**. Za sada posetioci mogu da koriste mejl link; slanje forme uključujemo tek kada povežemo stvarne Google resurse.

## Šta je potrebno

Jedan Google nalog koji će biti vlasnik tabele, Apps Script aplikacije i Google Cloud projekta. Nisu potrebni Cloudflare nalog, poseban server ili javno deljena tabela.

1. U [Google Cloud konzoli](https://console.cloud.google.com/) napravi projekat, npr. `Nemanja CV Contact`, i uključi **reCAPTCHA Enterprise API**. Naziv servisa u interfejsu može biti **Fraud Defense**.
2. Napravi **Website / Challenge (v2) / checkbox** CAPTCHA ključ u istom projektu koji koristi `RECAPTCHA_PROJECT_ID`. U reCAPTCHA Admin konzoli izaberi **Challenge (v2)** i opciju **I'm not a robot checkbox**. U Cloud konzoli se Checkbox podešavanje nalazi pod **Next Step (optional) → Additional settings → Will you use challenges?**. Dozvoljeni domeni: `n0tl3ss.github.io` i `nmikic.rs`. Ostavi proveru domena uključenu. Sačuvaj javni **Key ID / site key**. [Zvanično uputstvo za kreiranje ključa](https://docs.cloud.google.com/recaptcha/docs/create-key-website).
3. Napravi API ključ i ograniči ga na **reCAPTCHA Enterprise API**. Nemoj postaviti HTTP-referrer ograničenje: ovaj API ključ koristi server, a ne pregledač. Taj ključ ostaje u Apps Script podešavanjima, nikada u javnom sajtu ili poruci u chatu.
4. Napravi praznu privatnu Google tabelu, pa Apps Script projekat sa pripremljenim [Code.gs](../apps-script/Code.gs) i [appsscript.json](../apps-script/appsscript.json). U **Project Settings → Script Properties** unesi vrednosti iz [detaljnog uputstva](../apps-script/README.md). Pokreni `setup()` i odobri pristup svom nalogu.
5. U Apps Script izaberi **Deploy → New deployment → Web app**, izvršavanje **Me**, pristup **Anyone**. Kopiraj objavljeni URL koji se završava na **`/exec`**.

## Šta da mi pošalješ

Samo ove dve javne vrednosti:

- **reCAPTCHA site key / Key ID**;
- **Apps Script `/exec` URL**.

Google lozinka, tajni API ključ i deljenje tabele nisu potrebni. Project ID, Sheet ID i tajni API ključ unosiš direktno u **Script Properties** prema uputstvu.

Kada dobijem javne vrednosti, povezaću sajt i objaviti konfiguraciju. Zatim treba poslati jednu probnu poruku i proveriti da postoji jedan red u tabeli sa statusom `MAIL_SENT`, kao i da je obaveštenje stiglo na Outlook. Automatski lokalni testovi ne mogu da potvrde stvarnu isporuku mejla.

## Ako CAPTCHA prikazuje Invalid key type

Forma koristi Checkbox integraciju. Google poruka **ERROR for site owner: Invalid key type** znači da dostavljeni ključ nije kompatibilan sa tom integracijom. Proveri da je tip ključa **Checkbox / CHECKBOX**, pa isti novi ključ upiši u `RECAPTCHA_SITE_KEY` u Apps Script svojstvima i u javnu konfiguraciju sajta. `setup()` proverava podešavanja i pristup tabeli; njegovo uspešno izvršavanje ne proverava CAPTCHA ključ niti isporuku mejla. Dok kompatibilan ključ nije potvrđen u pregledaču, javna forma ostaje isključena i dostupan je mejl link.

## Ako odgovor glasi Unable to send

Ova stranica znači da je zahtev stigao do Apps Script-a, ali je odbijen ili nije mogao da bude obrađen. Za dijagnostiku kopiraj aktuelni `apps-script/Code.gs` u svoj Apps Script projekat, sačuvaj, pa izaberi **diagnoseSetup → Run**. Funkcija čita šemu tabele i šalje jedan reCAPTCHA API zahtev sa namerno nevažećim test tokenom. Ne upisuje redove i ne šalje mejl.

U **Execution log** pronađi red sa `event` i `code` i pošalji samo taj red. `SHEET_AND_RECAPTCHA_API_REACHABLE` potvrđuje pristup tabeli i prihvaćen API zahtev; prava CAPTCHA provera i isporuka mejla i dalje zahtevaju probnu poruku. Kodovi `RECAPTCHA_HTTP_400` / `403` upućuju na API zahtev ili pristup, `RECAPTCHA_TOKEN_KEY_MISMATCH` na neusaglašen ključ, a `SHEET_MISSING` / `SHEET_HEADERS_INVALID` na tabelu. `SERVICE_ERROR` uz `stage` označava neuspeh servisa bez izlaganja njegovog sirovog odgovora.

`RECAPTCHA_API_KEY` je poseban Google Cloud API ključ, različit od site key-a i legacy reCAPTCHA secret key-a. Mora pripadati odgovarajućem Cloud projektu, imati dozvoljen reCAPTCHA Enterprise API i odgovarajuća ograničenja. `NOTIFY_EMAIL` određuje primaoca obaveštenja i adresu u linku **Email directly** na stranici odgovora.

Ako dobiješ `RECAPTCHA_HTTP_400`, proveri da `RECAPTCHA_API_KEY` dolazi iz **Google Cloud → APIs & Services → Credentials → API key**, u projektu koji poseduje Checkbox ključ. Kopiraj tačnu vrednost bez razmaka. Dopunjena dijagnostika prikazuje poznate Google razloge kao nastavak koda: `API_KEY_INVALID` znači da API ključ nije prihvaćen, `SERVICE_DISABLED` da API nije uključen, a `API_KEY_SERVICE_BLOCKED` da ograničenja ključa ne dozvoljavaju servis. Nepoznati detalji i tekst Google odgovora se ne zapisuju. Ako ostane samo HTTP kod, uzrok još nije utvrđen; proveri i da `RECAPTCHA_PROJECT_ID` odgovara projektu Checkbox ključa.

Za aktiviranje promenjenog koda na postojećem `/exec` URL-u izaberi **Deploy → Manage deployments → Edit → Version: New version → Deploy**. Posle neuspelog web zahteva otvori **Executions** i poslednji `doPost`; privatni log beleži fazu i dijagnostički kod bez ključeva, tokena ili sadržaja poruke. [Google uputstvo za ažuriranje deploymenta](https://developers.google.com/apps-script/concepts/deployments), [Apps Script logovi](https://developers.google.com/apps-script/guides/logging).

## Cena i domen

Google trenutno dozvoljava do 10.000 CAPTCHA procena mesečno po organizaciji bez uključivanja naplate. Prekoračenje bez billing naloga vraća grešku, pa forma odbija slanje; pročitaj [aktuelne kvote](https://docs.cloud.google.com/recaptcha/docs/billing-information). Ne treba uključivati billing samo za početno povezivanje.

Trenutno koristi `SITE_URL=https://n0tl3ss.github.io/` i `ALLOWED_HOSTNAME=n0tl3ss.github.io`. Kada DNS i HTTPS za `nmikic.rs` budu spremni, usklađujemo ove vrednosti sa novim kanonskim domenom i objavljujemo novu Apps Script verziju. [Uputstvo za Loopia domen](DOMAIN.md).
