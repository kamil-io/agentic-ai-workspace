# 📱 KebunData Meta Threads Automation: Setup & Operations Guide

Panduan lengkap untuk memasang dan menjalankan sistem **Auto-Post & Two-Tier Auto-Reply** untuk akaun **KebunData Threads** menggunakan **Meta Threads API**, **Google Gemini**, dan **n8n / Python**.

---

## 🏛️ 1. Seni Bina Sistem (Three-Tier Organic Growth Engine)

1. **Auto-Post (The Hook Specialist):**
   - Beroperasi pada waktu puncak trafik Threads (8:00 AM, 12:30 PM, 8:30 PM MYT).
   - Menghasilkan post berimpak tinggi dalam gaya *Santai BM / Manglish* dengan struktur Hook, Isi Ringkas, dan Engagement Loop.
2. **Auto-Reply Inbound (The Conversation Multiplier):**
   - Mendengar komen baharu di bawah post anda setiap 10 minit.
   - Menggabungkan kepakaran **Farmer Agent** (fakta agronomi tepat) dan **Hafeez_bot** (gaya mesra member kebun).
   - **WAJIB menyoal semula pengguna** bagi membina *multi-turn discussion* yang menaikkan ranking algoritma Threads.
3. **Outbound Niche Hunter (The Community Growth Scout):**
   - Beroperasi setiap 2 jam (atau melalui Python CLI / cron).
   - Mencari perbualan & soalan awam berkait kata kunci (*pokok cili*, *daun kuning*, *fertigasi*, *baja AB*, dll.).
   - AI menapis relevansi, memberikan 1 tip berguna secara bersahaja (tanpa iklan keras / link spam), dan bertanyakan soalan ramah untuk menarik mereka melawat & follow profil KebunData.

---

## 🔑 2. Cara Dapatkan Kredensial Meta Threads API

Meta telah melancarkan **Official Threads API (Graph API v1.0)**. Ikuti langkah ini:

### Langkah 2.1: Cipta App di Meta for Developers
1. Pergi ke portal [Meta for Developers](https://developers.facebook.com/) dan log masuk dengan akaun Facebook/Instagram anda.
2. Klik **My Apps** > **Create App**.
4. Nama App: `Ak.Kamil Automation` (`App ID: 2229806474461275`, Business: `Robot People Industries` - `107558840944600`).

### Langkah 2.2: Tambah Produk Threads API
1. Dalam Dashboard App anda (`Ak.Kamil Automation`), cari produk **Threads** dan klik **Set Up**.
2. Di bawah menu **Roles** > **Roles**, tambah akaun Instagram/Threads KebunData anda sebagai **Tester** atau **Developer**.
3. Log masuk ke akaun Threads KebunData anda dan terima jemputan Tester di bahagian *Settings > Security / Developer permissions*.

### Langkah 2.3: Jana User Access Token & Dapatkan User ID
1. Pergi ke **Threads API > Tools** (atau Graph API Explorer).
2. Pilih App anda (`Ak.Kamil Automation` | `App ID: 2229806474461275`, Business: `Robot People Industries` | `Business ID: 107558840944600`) dan tandakan kebenaran (*Permissions*) yang diperlukan (Semua 11 Permissions):
   - `threads_basic` — Membaca profil dan post pengguna sendiri
   - `threads_content_publish` — Mencipta dan menerbitkan post/media
   - `threads_delete` — Memadamkan post
   - `threads_keyword_search` — Carian topik/kata kunci
   - `threads_location_tagging` — Carian dan tagging lokasi
   - `threads_manage_insights` — Analitik akaun dan post
   - `threads_manage_mentions` — Memantau sebutan akaun (*mentions*)
   - `threads_manage_replies` — Moderasi balasan (sembunyi/buka & had balas)
   - `threads_profile_discovery` — Terokai profil awam & post awam
   - `threads_read_replies` — Membaca balasan dan rantaian perbualan
   - `threads_share_to_instagram` — Perkongsian silang ke Instagram
3. Klik **Generate Token** dan luluskan akses ke akaun KebunData Threads anda.
4. Tukarkan token pendek tersebut kepada **Long-Lived Access Token** (sah selama 60 hari) melalui endpoint Token Exchange Meta.
5. Buat panggilan pengesahan untuk dapatkan User ID:
   ```bash
   GET https://graph.threads.net/v1.0/me?access_token=YOUR_ACCESS_TOKEN
   ```

---

## ⚙️ 3. Konfigurasi Fail `.env`

Tambahkan pembolehubah berikut ke dalam fail `.env` anda:

```ini
# Meta Threads API Configuration
THREADS_APP_ID=2229806474461275
THREADS_APP_SECRET=your_threads_app_secret_here
THREADS_BUSINESS_ID=107558840944600
THREADS_USE_CASE=THREADS_API

# Threads Account Credentials
THREADS_USER_ID=your_threads_user_id_here
THREADS_ACCESS_TOKEN=your_threads_long_lived_access_token_here

# All Enabled Threads API Scopes (11 Total)
THREADS_SCOPES=threads_basic,threads_content_publish,threads_delete,threads_keyword_search,threads_location_tagging,threads_manage_insights,threads_manage_mentions,threads_manage_replies,threads_profile_discovery,threads_read_replies,threads_share_to_instagram

# Threads Graph API Endpoints
THREADS_API_BASE_URL=https://graph.threads.net/v1.0
THREADS_GRAPH_BASE_URL=https://graph.facebook.com/v21.0

# Google Gemini API (Untuk Marketer & Farmer Agent)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Telegram Credentials
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
```

---

## 🧪 4. Menguji Skrip Menggunakan Python CLI

Anda boleh menguji penjanaan teks dan sambungan API terus melalui terminal:

### Uji Penjanaan Teks & Simulasi Komen:
```bash
python skills/generate_threads_content.py
```
*Skrip ini akan menguji prompt Marketer SOUL dan menghasilkan contoh post viral serta contoh balasan komen bercabang.*

### Uji Outbound Niche Hunter (Carian & Komen Komuniti):
```bash
# Ujian Simulasi / Dry-run (Selamat, tiada komen dipost)
python skills/outbound_threads_engager.py

# Mod Siaran Langsung (Live Outbound Comment)
python skills/outbound_threads_engager.py --publish
```

---

## 🚀 5. Import Blueprint ke n8n (OCI Ubuntu Server)

1. Buka antaramuka **n8n Web Interface** anda di OCI server.
2. Pergi ke **Workflows** > klik **Add Workflow** > menu tiga titik (top right) > **Import from File**.
3. Terdapat 4 blueprint yang telah disediakan dalam folder `workflows/`:
   - `workflows/hafeez_bot/threads/kebundata-threads-autopost.json` (Penjadualan kandungan).
   - `workflows/hafeez_bot/threads/kebundata-threads-autoreply.json` (Balasan komen inbound).
   - `workflows/hafeez_bot/threads/kebundata-threads-outbound-engager.json` (Draf balasan komuniti outbound).
   - `workflows/hafeez_bot/threads/kebundata-threads-content-factory.json` (Kandungan menerusi Webhook/API).
4. Gunakan n8n Credentials untuk token dan API keys; jangan masukkan rahsia dalam data workflow.
5. Kekalkan workflow tidak aktif sehingga semua syarat dalam [workflow operations](workflow-operations.md) dan [workflow portfolios](../workflows/README.md) disahkan. Autopost, Autoreply dan Content Factory masih memerlukan pembaikan approval sebelum activation.

---

## 📈 6. Tips Pertumbuhan Algoritma Threads (Best Practices)

- **Kepantasan Balas (Response Speed):** Balasan yang diberikan dalam masa 15-30 minit pertama selepas komen ditulis mendapat lonjakan keutamaan algoritma Meta.
- **Kedalaman Perbualan (Depth over Volume):** 1 post dengan 10 komen bersarang (*nested conversation*) adalah 5x lebih bernilai daripada 10 post tanpa sebarang komen.
- **Kualiti Nada:** Kekal santai ("Tuan", "Geng kebun", "Korang"), jangan nampak seperti bot automatik generik.

---

## 🛡️ 7. Perisai Polisi Meta & Audit Anti-Ban (AI Policy Guard)

Semua blueprint workflow kini dilengkapi dengan **Audit Keselamatan Polisi Meta automatik (Gemini Safety Check)** sebelum sebarang post atau komen diterbitkan:

1. **Audit Polisi Meta (Gemini Safety Check Node)**:
   - Setiap teks yang dijana akan melalui audit khusus bagi memastikan tiada unsur **Spam, Hard Sell, Hate Speech, Pautan Jualan Berulang, atau Cadangan Racun Kimia Berbahaya**.
   - Jika melepasi 100% kriteria keselamatan Meta, node audit mengembalikan status `PASS` dan diterbitkan.
   - Jika terdapat sebarang risiko atau pelanggaran, status `FAIL` dihasilkan dan siaran akan **dibatalkan secara automatik (ABORT)** untuk melindungi akaun daripada *shadowban* atau penggantungan (*ban*).
2. **Anti-Spam Human Jitter**:
   - Menikmati kelewatan masa rawak (15 hingga 120 saat) bagi meniru tabiat manusia sebenar.

