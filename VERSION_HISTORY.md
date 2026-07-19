# Version History — HiDock Sync Android

## v1.1 (2026-07-19)
**Requirement:** ลดช่วงเช็คสถานะ OneDrive เริ่มต้นจาก 30 วันเป็น 7 วัน และให้เลือกขยายช่วงได้เมื่อต้องการ

**สิ่งที่แก้:**
- ค่าเริ่มต้นของการเช็คสถานะและการแสดงรายการล่าสุดเป็น 7 วัน
- เพิ่มตัวเลือกช่วงเช็ค OneDrive: 7, 15, 30 หรือ 60 วันล่าสุด
- ป้าย filter รายการล่าสุดเปลี่ยนตามช่วงที่เลือก

## v1.0 (2026-07-19)
**Requirement:** POC (v0.3) ผ่านแล้ว — ต่อยอดเป็นแอปเต็ม: login OneDrive + upload อัตโนมัติ ไม่ต้องเปิดคอม

**สิ่งที่ทำ:**
- `worker/worker.js` — Cloudflare Worker (`hidock-auth`) proxy device-code flow ของ Microsoft ให้หน้าเว็บ static เรียกได้ (ติด CORS ตรง ๆ ไม่ได้) จำกัดเฉพาะ client_id ของ Microsoft Graph Command Line Tools (`14d82eec-...`, public client, ใช้ pattern เดียวกับ `outlook_sync.py` ใน PY_PersonalPortal) + จำกัด Access-Control-Allow-Origin เป็น `https://napanuwat.github.io` เท่านั้น
- Deploy แล้วที่ `https://hidock-auth.hidock-napanuwat.workers.dev` (Cloudflare account: na.productive@gmail.com, สร้าง workers.dev subdomain `hidock-napanuwat` ใหม่ครั้งแรก)
- `index.html` v1.0 — เพิ่มจาก POC:
  - Login Microsoft ผ่าน device code flow (แสดงโค้ดให้ copy → เปิด microsoft.com/link → login บัญชี personal ที่เป็นเจ้าของ OneDrive) — token เก็บใน localStorage + auto-refresh
  - เช็คสถานะไฟล์กับ OneDrive จริง (`_me/drive/root:/00 Daily Records/_P1/{date}:/children`) 30 วันล่าสุด — จุดเขียว/แดง + auto-check ไฟล์ใหม่
  - ตารางไฟล์ group ตามวัน + checkbox ทั้งวัน/ทั้งหมด + filter (30 วันล่าสุด/เฉพาะ New/ทั้งหมด)
  - Import ที่เลือก: ดาวน์โหลดจาก HiDock (โค้ดเดิมจาก POC) → strip HDA → อ่าน duration จริงจาก mp3 metadata (`<audio>` loadedmetadata, fallback เป็นสูตร bytes/16000 ถ้า decode ไม่ได้) → ตั้งชื่อ `YYYYMMDD_HHMMSS(XXmins).mp3` → สร้างโฟลเดอร์ date (ถ้ายังไม่มี) → upload แบบ chunked ผ่าน Graph upload session → เว้น 1.5 วิระหว่างไฟล์ + ปุ่มข้ามไฟล์ค้าง (ตาม UX desktop section 7)
  - Conflict behavior = `fail` ทั้งตอนสร้างโฟลเดอร์และไฟล์ (เทียบเท่า mode `skip` ของ desktop — มีอยู่แล้วไม่ทับ)

**ทางเลือกที่ตัดสินใจแล้ว (ตาม handoff §3.3):** มือถือคำนวณ duration + ตั้งชื่อ + จัด date folder เอง ฝั่ง PC (`PY_PersonalPortal` nightly) ไม่ต้องแก้อะไรเพิ่ม

**ยังไม่ทำ (ตัดไว้ตามที่ตกลง):** Inventory sync ขึ้น GitHub Gist (handoff §4) — ข้ามไว้เป็น phase ถัดไป

**ยังไม่ทดสอบ:** login flow เต็ม + upload จริงบนมือถือ (ทดสอบ Worker เองผ่าน curl แล้วว่า devicecode/CORS ทำงานถูกต้อง แต่ยังไม่ได้ลอง end-to-end จากเว็บจริงบน S23 Ultra)

## v0.3 (2026-07-19)
**Requirement:** ผู้ใช้ทดสอบแล้วยังเห็นขนาดไฟล์ผิด — ตรวจสอบพบว่า size ที่แสดง ×256 = ขนาด mp3 จริงใน `_P1` เป๊ะทุกไฟล์ ซึ่งเป็นอาการของ bug v0.1 (อ่าน size เลื่อน 1 byte) → หน้าที่เปิดอยู่เป็น cache เก่า ไม่ใช่ v0.2

**สิ่งที่แก้:**
- เพิ่ม log บรรทัดแรก "POC vX.X loaded" ให้เช็ค version ที่รันอยู่จริงได้จาก log panel เลย

## v0.2 (2026-07-19)
**Requirement:** ทดสอบบน S23 Ultra แล้ว connect + scan เจอไฟล์ + download ได้ แต่ไฟล์มาไม่เต็ม (ไฟล์ระดับชั่วโมงได้มาไม่ถึงนาที ทั้งขนาดที่แสดงและที่โหลดได้)

**สาเหตุ:** handoff §2.3 สรุปตำแหน่ง expectedBytes คลาด 1 byte — โค้ดต้นฉบับ (`PY_PersonalPortal/templates/hidock.html`) อ่าน size ที่ `offset+4+nameLen` (มี byte คั่นหลังชื่อไฟล์) ไม่ใช่ `offset+4+nameLen-1` ทำให้ size เพี้ยนและ download loop หยุดก่อนได้ข้อมูลครบ

**สิ่งที่แก้ (v0.2):**
- `parseDirectory()`: อ่าน size ที่ `i+4+nameLen` ตามต้นฉบับ
- Download command: สร้างจาก bytes ดิบของชื่อไฟล์ (`nameBytes`) แทน string ที่ trim แล้ว — เหมือนต้นฉบับ
- แก้ `Handoff_hidock_mobile.md` §2.3 ให้ถูกต้อง กันสรุปผิดซ้ำ

## v0.1 (2026-07-19)
**Requirement:** เริ่มโปรเจคจาก Handoff_hidock_mobile.md — ทำ POC ก่อน (ตาม checklist ข้อ 8) เพื่อพิสูจน์ว่า WebUSB + P1 Mini ใช้ได้จริงบน S23 Ultra ผ่าน OTG ก่อนลงแรงเขียน UI เต็ม

**สิ่งที่ทำ:**
- สร้าง `index.html` (v0.1) — หน้า POC หน้าเดียว static ล้วน:
  - Connect ผ่าน WebUSB (vendor `0x10D6` HiDock Original / `0x3887` P1 Mini)
  - claim ทุก interface, epOut = OUT ตัวแรก, epIn = IN ตัวสุดท้าย (ตาม handoff §2.2)
  - Scan files: ส่ง list command ตามรุ่น + parse directory blob (§2.3)
  - Download ต่อไฟล์ + strip HDA frame headers → เซฟ .mp3 ลง Downloads ผ่าน blob link (§2.4–2.5)
  - ปุ่ม "ข้ามไฟล์ที่ค้าง" + log panel สำหรับ debug บนมือถือ

**การตัดสินใจ (ยืนยันกับผู้ใช้แล้ว):**
- POC ก่อน → ค่อยทำ UI เต็ม + Graph API upload
- Hosting: GitHub Pages
- ข้อ 3.3: มือถือคำนวณ duration + ตั้งชื่อ + จัด date folder เอง (ฝั่ง PC ไม่ต้องแก้)
- Inventory Gist sync: ข้ามไว้เป็น phase 2
