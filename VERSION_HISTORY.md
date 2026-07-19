# Version History — HiDock Sync Android

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
