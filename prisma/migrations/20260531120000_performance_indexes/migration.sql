CREATE INDEX "Encounter_patientId_occurredAt_idx" ON "Encounter"("patientId", "occurredAt");
CREATE INDEX "Encounter_authorId_occurredAt_idx" ON "Encounter"("authorId", "occurredAt");
CREATE INDEX "Appointment_clinicianId_scheduledAt_idx" ON "Appointment"("clinicianId", "scheduledAt");
CREATE INDEX "Problem_category_idx" ON "Problem"("category");
CREATE INDEX "Problem_isActive_startedAt_idx" ON "Problem"("isActive", "startedAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
