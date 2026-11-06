'use client';

import IncapacityReviewPanel from '@/components/incapacities/IncapacityReviewPanel';

export default function AdminIncapacitiesPage() {
  return (
    <IncapacityReviewPanel
      mode="admin-audit"
      reviewerName="Coordinación Académica"
      roleLabel="Coordinación Académica"
    />
  );
}
