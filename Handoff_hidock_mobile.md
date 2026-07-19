# HANDOFF — Port HiDock Import ไปมือถือ (Android)

> v1.0 — Extract จาก PY_PersonalPortal (2026-07-19)
> เป้าหมาย: เสียบ HiDock เข้ามือถือ (S23 Ultra) → ดึงไฟล์เสียง → ขึ้น OneDrive เลย โดยไม่ต้องเปิดคอม
> เอกสารนี้ตั้งใจให้ standalone — โปรเจคใหม่ไม่ต้องเปิด repo นี้ก็เริ่มงานได้

---

## 1. ภาพรวม flow ปัจจุบัน (desktop)

```
HiDock (USB) ──WebUSB──► หน้า /hidock ใน browser (Chrome/Edge)
                              │  strip HDA header → .mp3
                              ▼
              เลือกโฟลเดอร์ผ่าน File System Access API
              (ชี้ไปที่ OneDrive _P1 folder)
                              │
                              ▼
        ปุ่ม "Reformat P1" (manual) → rename + จัด date folder
                              │
                              ▼
        Nightly pipeline (Letterly → AI summaries → ...) สแกนจาก folder นี้
```

**จุดสำคัญ:** logic คุยกับเครื่อง HiDock อยู่ **ฝั่ง browser JS ทั้งหมด** (WebUSB) — Flask backend ทำแค่ 2 อย่างคือ (a) เช็คว่าไฟล์เคย import แล้วหรือยัง (b) push รายชื่อไฟล์บนเครื่องขึ้น GitHub Gist (inventory)

### ไฟล์ต้นทางในโปรเจคเดิม (อ้างอิง)

| ไฟล์ | มีอะไร |
|---|---|
| `PY_PersonalPortal/templates/hidock.html` (v1.9) | **USB protocol ทั้งหมด** (JS) — ส่วนที่ต้อง port |
| `PY_PersonalPortal/modules/hidock_routes.py` (v2.0) | parse ชื่อไฟล์, เช็ค downloaded, Gist inventory sync |
| `PY_RecordSummary/1.1_reformat_file_folder_p1.py` (v2.3) | กติกาตั้งชื่อไฟล์/โฟลเดอร์ปลายทาง |

---

## 2. USB Protocol ของ HiDock (ความรู้ที่ reverse มาแล้ว — ห้ามหาย)

### 2.1 อุปกรณ์ที่รองรับ

| Device | Vendor ID |
|---|---|
| HiDock Original | `0x10D6` |
| **P1 Mini** (ตัวที่ user ใช้) | `0x3887` |

### 2.2 การเชื่อมต่อ

1. `requestDevice({filters: [{vendorId: 0x10D6}, {vendorId: 0x3887}]})`
2. `open()` → ถ้า `configuration === null` ให้ `selectConfiguration(1)`
3. Claim **ทุก interface** ที่ claim ได้ (บาง interface จะ fail — ข้ามไป)
4. รวบรวม endpoints: `epOut` = **OUT ตัวแรก**, `epIn` = **IN ตัวสุดท้าย** (สำคัญ — ลำดับนี้ผ่านการลองมาแล้ว)

### 2.3 List files (สแกน directory)

ส่ง command (hex) ผ่าน `transferOut(epOut, ...)`:

| Device | List command (hex) |
|---|---|
| P1 Mini | `123400040000000900000000` |
| HiDock Original | `123400040000000e00000000` |

แล้ว `transferIn(epIn, 65536)` หนึ่งครั้ง → ได้ directory blob

**Parse directory blob** (จาก `parseDirectory()`):
- สแกน byte ต่อ byte หา signature `0x04` หรือ `0x05` ตามด้วย `0x00 0x00`
- byte ถัดไป = `nameLen` (ใช้ได้เมื่อ 10 < nameLen < 50)
- filename = ASCII จาก `offset+4` ยาว `nameLen - 1` — ต้องมี `.hd`/`.hda` ถึงนับ
- ต่อจาก filename ทันที: **4 bytes big-endian = ขนาดไฟล์ที่แท้จริง (expectedBytes)**
- เจอแล้วข้าม `nameLen + 10` bytes ต่อ

### 2.4 Download 1 ไฟล์

สร้าง command 12 bytes + filename:
```
bytes[0..3] = 0x12 0x34 0x00 0x05
bytes[4..10] = 0x00 (padding)
bytes[11]   = filename length
bytes[12..] = filename (ASCII)
```
ส่งผ่าน `transferOut` แล้ววนอ่าน `transferIn(epIn, 65536)` สะสม chunk จนกว่า `totalReceived >= expectedBytes` (หรือ read error/empty → หยุด)

### 2.5 แปลง HDA → MP3

ไฟล์ที่ได้ถ้าขึ้นต้น `0x12 0x34` = มี HDA frame headers ครอบอยู่ ต้อง strip:
```
loop ตั้งแต่ offset 0:
  ถ้า bytes[offset] != 0x12 หรือ bytes[offset+1] != 0x34 → จบ
  dataLen = (bytes[offset+10] << 8) | bytes[offset+11]   # big-endian 2 bytes
  ข้าม header 12 bytes → เก็บ data ยาว dataLen → offset ขยับต่อ
```
ผลลัพธ์ = MP3 ตรง ๆ (CBR ~128kbps) → rename `.hda` → `.mp3`

- **สูตรประเมิน duration:** `seconds ≈ bytes / 16000` (จาก 128kbps CBR)
- Desktop เว้น **1.5 วินาที** ระหว่างไฟล์ + มีปุ่ม "ข้ามไฟล์นี้" กรณีไฟล์ค้าง (read loop ไม่จบ)

### 2.6 รูปแบบชื่อไฟล์บนเครื่อง HiDock

```
2026May13-145019.hda        (บางรุ่นมี suffix -RecNN เช่น 2025Oct02-140319-Rec41)
```
regex: `^(\d{4})([A-Za-z]{3})(\d{2})-(\d{2})(\d{2})(\d{2})` → ปี/เดือน(อักษรย่อ)/วัน-ชชนนวว

---

## 3. ปลายทาง OneDrive + naming convention (pipeline ฝั่ง PC ต้องเจอไฟล์แบบนี้)

### 3.1 โฟลเดอร์ปลายทาง (`P1_BASE_DIRS` ใน `_cfg_main_config.json`)

- minipc: `O:\_P1`
- laptop: `C:\Users\Na\OneDrive\00 Daily Records\_P1`
- (iCloud dir แยกต่างหากสำหรับ Just Press Record — ไม่เกี่ยวกับ HiDock)

มือถือต้อง upload ไปที่ **OneDrive path: `/00 Daily Records/_P1/...`** ของบัญชี OneDrive ที่ sync กับเครื่อง minipc (**ต้องยืนยันว่าเป็นบัญชี Microsoft ตัวไหน** — minipc ใช้ personal OneDrive; Outlook sync ของ portal ใช้ na.panuwat@hotmail.com)

### 3.2 โครงสร้างสุดท้ายที่ pipeline คาดหวัง

```
_P1/2026-05-13/20260513_145019(45mins).mp3
```
- โฟลเดอร์: `YYYY-MM-DD`
- ไฟล์: `YYYYMMDD_HHMMSS(XXmins).mp3` — XX = นาที ปัดเศษ (round) จากความยาวจริงของ mp3
- กันชนชื่อ: ปกติใช้ mode `skip` (มีอยู่แล้ว → ไม่ทับ)

### 3.3 ⚠️ Reformat เป็นขั้น manual — ตัดสินใจ design ฝั่งมือถือ

Script reformat (`1.1_reformat_file_folder_p1.py`) รับชื่อไฟล์ 2 แบบ:
- `2026May13-145019.mp3` (ชื่อดิบจาก HiDock — PATTERN_LONG)
- `20260513_145019.mp3` (PATTERN_SHORT)

แล้ว rename + ใส่ `(XXmins)` + ย้ายเข้า date folder — แต่**รันจากปุ่ม manual เท่านั้น** (หน้า HiDock / RecMgr Tools) — **nightly pipeline ไม่ได้รันให้** (ตรวจแล้ว 2026-07-19)

ตัวเลือกฝั่งมือถือ:
1. **(ง่ายสุด)** มือถือ upload ไฟล์ชื่อดิบ (`2026May13-145019.mp3`) ลง root ของ `_P1` → ต้อง**เพิ่มขั้น reformat เข้า nightly** หรือกดปุ่มเอง — ถ้าเลือกทางนี้ อย่าลืมกลับมาแก้ nightly ใน PY_PersonalPortal
2. **(จบในตัว)** มือถือคำนวณ duration เอง (จากขนาดไฟล์: `นาที ≈ round(bytes/16000/60)` หรือ decode mp3 จริง) แล้ว upload เป็น `/_P1/YYYY-MM-DD/YYYYMMDD_HHMMSS(XXmins).mp3` เลย → ฝั่ง PC ไม่ต้องทำอะไรเพิ่ม ✅ แนะนำทางนี้

---

## 4. Inventory sync ขึ้น GitHub Gist (optional แต่ควร port ด้วย)

ทุกครั้งที่สแกนเห็นรายชื่อไฟล์บนเครื่อง portal จะ push "inventory" ขึ้น Gist เพื่อให้ RecMgr แสดง record ที่ "อัดไว้บนเครื่องแต่ยังไม่ได้โหลด" (online-only row) — ถ้ามือถือทำด้วย ฟีเจอร์นี้จะยังทำงานต่อโดยไม่ต้องเปิดคอม

- Gist: private, 1 gist มี 1 ไฟล์ `hidock_inventory.json`
- Config: `GITHUB_TOKEN` (token เดียวกับ portal sync) + `HIDOCK_GIST_ID` (มีค่าแล้วใน `_cfg_main_config.json` — **เอา id นี้ไปใส่โปรเจคใหม่ด้วย จะได้เขียน gist เดิม**)
- วิธี update: `GET /gists/{id}` อ่าน JSON เดิม → merge → `PATCH /gists/{id}` (upsert รายวัน — key ระดับบนสุดคือ date)

รูปแบบ JSON:
```json
{
  "2026-05-13": {
    "scanned_at": "2026-07-19T01:00:00+00:00",
    "files": [
      {
        "device_file": "2026May13-145019.hda",
        "record_id": "20260513_145019_HiDock Recording",
        "record_key": "20260513_145019",
        "match_key": "20260513_145019",
        "raw_date": "20260513",
        "time_dur_raw": "145019",
        "date": "2026-05-13",
        "time": "14:50:19",
        "expected_bytes": 12345678
      }
    ]
  }
}
```

## 5. เช็ค "ไฟล์นี้ import แล้วหรือยัง" (Library status)

Desktop ใช้ endpoint `POST /hidock/api/hidock/check_downloaded` — logic:
1. แปลงชื่อไฟล์ device → date folder + prefix (`2026May13-145019` → `2026-05-13`, `20260513_145019`)
2. glob หา `{prefix}*.mp3|.m4a` ใน base dirs ทุกตัว → เจอ = **Local**
3. ไม่เจอ local แต่มี mem_export rows (จาก Mem.ai registry) = **Mem** / ไม่มีเลย = **New**

ฝั่งมือถือ 2 ทางเลือก:
- เรียก portal ที่ `https://weloveplan.com/hidock/api/hidock/check_downloaded` — แต่ติด **Cloudflare Access** (email OTP; ถ้าจะให้ app เรียกต้องทำ Access service token) และ minipc ต้องเปิดอยู่
- หรือเช็คจาก OneDrive โดยตรงผ่าน Graph API (list ไฟล์ใน `/_P1/{date}/` แล้ว match prefix) — ไม่พึ่ง portal เลย ✅ แนะนำ

---

## 6. ข้อจำกัด/ทางเลือกทางเทคนิคบนมือถือ

| ประเด็น | สถานะ |
|---|---|
| WebUSB บน Android Chrome | ✅ รองรับ (S23 Ultra + USB-C OTG ใช้ได้) |
| WebUSB บน iOS/Safari | ❌ ไม่รองรับเลย — iPhone ตัดทิ้งได้ |
| File System Access API (`showDirectoryPicker`) บน Android | ❌ ไม่รองรับ — เซฟลง local folder แบบ desktop ไม่ได้ |
| ทางออก | upload ตรงขึ้น **OneDrive ผ่าน Microsoft Graph API** แทนการเซฟ local |

**สถาปัตยกรรมแนะนำ:** เว็บหน้าเดียว (PWA) เปิดใน Chrome Android
- WebUSB: ใช้โค้ด protocol จาก `hidock.html` ได้แทบตรง ๆ (section 2)
- Upload: Graph API `PUT /me/drive/root:/00 Daily Records/_P1/{date}/{name}:/content` (ไฟล์ >4MB ใช้ upload session แบบ chunk)
- Auth: MSAL.js public client + scope `Files.ReadWrite` — โปรเจคเดิมมี precedent ใช้ public client id ของ "Microsoft Graph Command Line Tools" = `14d82eec-204b-4c2f-b7e8-296a70dab67e` ด้วย device-code flow (เพราะบัญชีส่วนตัวสร้าง Azure app registration ไม่ได้แล้ว) — บนมือถือแนะนำลอง MSAL.js redirect flow กับ client id เดียวกันก่อน
- Hosting: หน้าเว็บ static ล้วน (ไม่มี backend ก็ยังทำงานได้ ถ้าเลือก option 2 ข้อ 3.3 + เช็คสถานะผ่าน Graph) — จะ host บน weloveplan.com subpath หรือ GitHub Pages ก็ได้ แต่ WebUSB ต้องเสิร์ฟผ่าน **HTTPS**

ทางเลือกสำรอง: native Android app (USB Host API + MSAL) — ทำได้แน่นอนกว่าแต่งานเยอะกว่ามาก; เริ่มจาก PWA ก่อน

---

## 7. UX ที่มีอยู่แล้วบน desktop (ไว้เทียบตอนออกแบบมือถือ)

- ตารางไฟล์ group ตามวัน + checkbox เลือกทั้งวัน/ทั้งหมด, ค้นหา, filter (Local/Mem/New/เลือกแล้ว)
- คอลัมน์ Library: จุดเขียวทึบ=Local, วงเขียว=Mem only, แดง=New (ยังไม่เคย import)
- Default: **เลือกทุกไฟล์ไว้ก่อน** (checked ตั้งแต่สแกน)
- Progress: ต่อไฟล์ (% + MB) + รวม (X/Y ไฟล์) + คิว 4 ไฟล์ถัดไป + ปุ่มข้ามไฟล์ค้าง
- Advanced log (debug) พับเก็บได้

## 8. Checklist ตอนตั้งโปรเจคใหม่

- [ ] Copy โค้ด JS protocol จาก `templates/hidock.html` (บรรทัด ~538-1140) เป็นจุดตั้งต้น
- [ ] เอาค่า `HIDOCK_GIST_ID` + `GITHUB_TOKEN` จาก `_cfg_main_config.json` (gitignored — copy มือ) ถ้าจะทำ inventory sync
- [ ] ยืนยันบัญชี Microsoft ที่เป็นเจ้าของ OneDrive `00 Daily Records` (hotmail หรือบัญชีอื่น)
- [ ] ตัดสินใจข้อ 3.3: มือถือตั้งชื่อ+จัด folder เอง (แนะนำ) หรือโยนดิบแล้วเพิ่ม reformat เข้า nightly ฝั่ง PC
- [ ] ทดสอบ WebUSB กับ P1 Mini บน S23 Ultra ผ่าน OTG ก่อนลงแรงเขียน UI (proof-of-concept: connect + list files)
- [ ] ถ้าจะให้ RecMgr เห็นสถานะจากมือถือ → ทำ inventory Gist push (ข้อ 4)
