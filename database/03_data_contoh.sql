-- =====================================================================
-- 03_data_contoh.sql
-- DATA CONTOH untuk pengembangan dan pengujian. Jalankan KETIGA.
-- Sesuaikan hari, sesi, dan kapasitas dengan jadwal klinik yang sebenarnya.
-- Aman dijalankan ulang (sesi yang sudah ada dilewati) dan bisa dijalankan
-- lagi kapan saja untuk memperpanjang jadwal ke depan.
-- =====================================================================

-- Poli Umum: setiap hari, 7 hari ke depan, dua sesi per hari.
insert into public.appointment_slots
  (service_id, visit_date, session_name, start_time, end_time, capacity, is_active)
select
  s.id,
  d.visit_date::date,
  slot.session_name,
  slot.start_time,
  slot.end_time,
  slot.capacity,
  true
from public.services as s
cross join generate_series(
  (now() at time zone 'Asia/Jakarta')::date,
  (now() at time zone 'Asia/Jakarta')::date + 6,
  interval '1 day'
) as d(visit_date)
cross join (
  values
    ('Pagi'::text,  time '08:00', time '12:00', 10),
    ('Siang'::text, time '13:00', time '16:00', 10)
) as slot(session_name, start_time, end_time, capacity)
where s.name = 'Poli Umum'
  and s.is_active = true
on conflict (service_id, visit_date, session_name) do nothing;

-- Sunat: hanya Selasa dan Kamis (isodow 1=Senin ... 7=Minggu), sesi Pagi,
-- 28 hari ke depan.
insert into public.appointment_slots
  (service_id, visit_date, session_name, start_time, end_time, capacity, is_active)
select s.id, d.visit_date::date, 'Pagi', time '08:00', time '12:00', 5, true
from public.services as s
cross join generate_series(
  (now() at time zone 'Asia/Jakarta')::date,
  (now() at time zone 'Asia/Jakarta')::date + 27,
  interval '1 day'
) as d(visit_date)
where s.name = 'Sunat'
  and s.is_active = true
  and extract(isodow from d.visit_date::date) in (2, 4)
on conflict (service_id, visit_date, session_name) do nothing;
