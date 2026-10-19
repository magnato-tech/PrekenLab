# TaleLab – Norsk AI-stemmelab for prekener og opplesning

TaleLab er en spesialisert norsk AI-applikasjon utviklet for predikanter og talere som ønsker å klone sin egen stemme fra eksisterende MP3-opptak av prekener, og bruke den digitale stemmen til å lese opp nye tekster på naturlig norsk bokmål.

---

## 1. Teknologivalg og modellvurdering

Etter grundig gjennomgang av ledende AI-stemmeteknologier er **ElevenLabs Instant Voice Cloning (IVC)** med modellen **`eleven_multilingual_v2`** valgt som den fungerende motoren:

| Leverandør & Modell | Støtte for norsk | Stemmekloning fra MP3 | Status |
| :--- | :--- | :--- | :--- |
| **ElevenLabs (`eleven_multilingual_v2`)** | **Beste i klassen (norske vokaler æ, ø, å og naturlig setningsmelodi)** | **Ja, øyeblikkelig kloning fra 1–25 MP3/WAV-filer** | **Anbefalt og integrert** |
| **OpenAI (`tts-1` / `tts-1-hd`)** | God | Nei, ingen støtte for egne stemmeopptak via API | Ikke egnet for egne stemmer |
| **Microsoft Azure Speech (CNV)** | Meget god | Krever forhåndsgodkjenning, skriftlig samtykke og 300+ studio-setninger | For omstendelig |
| **Coqui / XTTS-v2** | Middels | Ja (zero-shot) | Ujevn prosodi og robotaktig klang på norsk |

ElevenLabs `eleven_multilingual_v2` bevarer predikantens personlige klangfarge, varme og taletempo uten at det høres ut som en generisk robot.

---

## 2. Nødvendige API-nøkler og oppsett

1. **ElevenLabs-konto**: Gå til [elevenlabs.io](https://elevenlabs.io) og logg inn / opprett konto.
2. **Abonnement**: Instant Voice Cloning (kloning av egne opptak) krever **Starter-abonnement** (ca. $5 per måned) eller høyere. Gratisplanen tillater kun forhåndsdefinerte stemmer.
3. **API-nøkkel**:
   - Klikk på profilen din nederst til venstre på elevenlabs.io -> **Profile + API key**.
   - Generer eller kopier API-nøkkelen din (`sk_...`).
4. **Legg inn nøkkelen**:
   - **Metode A**: Trykk på knappen **«API & Nøkkel»** øverst i TaleLab og lim inn nøkkelen. Nøkkelen sendes til det sikre serverlaget og verifiseres umiddelbart mot ElevenLabs.
   - **Metode B**: Legg inn nøkkelen i `.env` som `ELEVENLABS_API_KEY="sk_din_nøkkel"`.

---

## 3. Slik gjennomfører du testen (Fase 1 bevis-arbeidsflyt)

Gå til **Teststudio** i TaleLab og følg de 6 stegene:

1. **Steg 1: Last opp opptak**
   - Last opp én eller flere MP3-filer (f.eks. 1–3 minutter ren preketale).
   - Lytt til opptaket i spilleren for å bekrefte at lyden er ren uten skurring eller bakgrunnsstøy.
2. **Steg 2: Opprett stemmekopien**
   - Gi stemmen et navn (f.eks. «Magnar – prekenstemme»).
   - Skriv eventuelt dialekt (f.eks. «Norsk bokmål, rolig taletempo»).
   - Huk av for samtykke og trykk **«Opprett stemmekopi hos ElevenLabs»**.
   - Appen sender opptakene til `/api/clone-voice`, som kaller ElevenLabs `/v1/voices/add`.
3. **Steg 3: Skriv testtekst**
   - Skriv eller lim inn et avsnitt på norsk bokmål, eller bruk ett av de ferdige prekeneksemplene.
4. **Steg 4: Generer tale**
   - Velg talestil (f.eks. «Rolig preken») og trykk **«Generer tale med min klonede stemme»**.
5. **Steg 5: Lytt og vurder**
   - Spill av det genererte resultatet side om side med originalopptaket for å vurdere stemmelikhet og uttale.
6. **Steg 6: Last ned**
   - Last ned den ferdige MP3-lydfilen til datamaskinen din.

---

## 4. Prekenstudio (Fase 2)

Når stemmen er opprettet, kan du åpne **Prekenstudio**:
- Lim inn lengre prekentekster.
- Teksten deles automatisk inn i avsnitts-segmenter.
- Generer segmenter enkeltvis eller hele prekenen i én operasjon.
- Lytt til og rediger enkeltavsnitt ved behov.
- Slå sammen segmentene til én sammenhengende lydfil og last ned.
