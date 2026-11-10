-- =====================================================================
-- 02_pendaftaran_antrean.sql
-- Nomor pendaftaran, pencegah booking ganda, view sisa kuota, dan fungsi
-- create_appointment (cek kuota -> pasien -> nomor antrean -> appointment,
-- semuanya dalam satu transaksi). Jalankan KEDUA, setelah 01_schema.sql.
-- Aman dijalankan ulang.
-- =====================================================================

-- 1) Urutan nomor pendaftaran -> REG-2026-10001, REG-2026-10002, ...
create sequence if not exists public.registration_number_seq start 10001;

-- 2) Satu pasien tidak boleh punya 2 booking aktif di sesi yang sama
create unique index if not exists appointments_patient_slot_active_uq
  on public.appointments (patient_id, slot_id)
  where status <> 'cancelled';

-- 3) Sisa kuota per sesi (untuk tampilan "Tersedia" / "Penuh")
create or replace view public.slot_availability as
select
  s.id,
  s.service_id,
  s.visit_date,
  s.session_name,
  s.start_time,
  s.end_time,
  s.capacity,
  greatest(s.capacity - count(a.id) filter (where a.status <> 'cancelled'), 0)::int as remaining
from public.appointment_slots s
left join public.appointments a on a.slot_id = s.id
where s.is_active
group by s.id;

revoke all on public.slot_availability from public, anon, authenticated;
grant select on public.slot_availability to service_role;

-- 4) Fungsi atomik: cek kuota -> simpan/ambil pasien -> nomor antrean -> appointment
create or replace function public.create_appointment(
  p_full_name  text,
  p_gender     text,
  p_birth_date date,
  p_whatsapp   text,
  p_service_id uuid,
  p_slot_id    uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_today      date := (now() at time zone 'Asia/Jakarta')::date;
  v_slot       public.appointment_slots;
  v_booked     integer;
  v_patient    public.patients;
  v_queue      integer;
  v_reg        text;
  v_appt       public.appointments;
  v_service    text;
begin
  -- Kunci baris sesi: pendaftar di sesi yang sama diproses satu per satu
  select * into v_slot
    from public.appointment_slots
   where id = p_slot_id and service_id = p_service_id and is_active
   for update;

  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if v_slot.visit_date < v_today then
    raise exception 'SLOT_EXPIRED';
  end if;

  select count(*) into v_booked
    from public.appointments
   where slot_id = p_slot_id and status <> 'cancelled';

  if v_booked >= v_slot.capacity then
    raise exception 'SLOT_FULL';
  end if;

  -- Pasien lama (nomor WhatsApp sama) dipakai ulang, data lamanya tidak ditimpa
  select * into v_patient from public.patients where whatsapp = p_whatsapp;

  if not found then
    insert into public.patients (full_name, gender, birth_date, whatsapp)
    values (p_full_name, p_gender, p_birth_date, p_whatsapp)
    returning * into v_patient;
  end if;

  -- Nomor antrean urut per layanan per tanggal kunjungan (lintas sesi)
  perform pg_advisory_xact_lock(hashtext(p_service_id::text || v_slot.visit_date::text));

  select coalesce(max(queue_number), 0) + 1 into v_queue
    from public.appointments
   where service_id = p_service_id and visit_date = v_slot.visit_date;

  v_reg := 'REG-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYY')
           || '-' || nextval('public.registration_number_seq');

  insert into public.appointments
    (registration_number, patient_id, service_id, slot_id, visit_date, queue_number)
  values
    (v_reg, v_patient.id, p_service_id, p_slot_id, v_slot.visit_date, v_queue)
  returning * into v_appt;

  select name into v_service from public.services where id = p_service_id;

  return jsonb_build_object(
    'appointment_id',      v_appt.id,
    'registration_number', v_appt.registration_number,
    'queue_number',        v_appt.queue_number,
    'status',              v_appt.status,
    'patient_name',        v_patient.full_name,
    'service_name',        v_service,
    'visit_date',          v_appt.visit_date,
    'session_name',        v_slot.session_name,
    'start_time',          v_slot.start_time,
    'end_time',            v_slot.end_time
  );
end;
$$;

revoke execute on function public.create_appointment(text, text, date, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_appointment(text, text, date, text, uuid, uuid)
  to service_role;
