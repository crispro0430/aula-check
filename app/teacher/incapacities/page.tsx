'use client';

import IncapacityReviewPanel from '@/components/incapacities/IncapacityReviewPanel';

export default function TeacherIncapacitiesPage() {
  return (
    <IncapacityReviewPanel
      mode="teacher"
      teacherId="t1"
      reviewerName="Prof. Dr. Alejandro Morales"
      roleLabel="Módulo Docente — Gestión de Excusas e Incapacidades"
    />
  );
}
