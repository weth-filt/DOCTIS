const idOf = value => value?._id || value || null;
const sameId = (first, second) => Boolean(first && second) && String(idOf(first)) === String(idOf(second));

// Admin views also expose old User.doctorId references for reconciliation.
// Displaying that reference does not create an assignment or grant access.
function coordinationAssignmentState(patient, intake, assignment) {
  const active = assignment?.status === "active" && assignment.doctorId?.role === "doctor" ? assignment : null;
  const referencedDoctor = patient?.doctorId?.role === "doctor" ? patient.doctorId : null;
  const doctor = active?.doctorId || referencedDoctor;
  const legacyReference = Boolean(!active && referencedDoctor);
  const legacyAssignment = Boolean(doctor && (legacyReference || !active?.supportRequestId || !active?.hospitalId));
  const hospital = active?.hospitalId?.name ? active.hospitalId : intake?.hospitalId?.name ? intake.hospitalId : null;
  const coordinated = Boolean(active && intake?.status === "assigned" && intake.acceptedAt
    && sameId(active.supportRequestId, intake._id)
    && sameId(active.doctorId, intake.assignedDoctorId)
    && sameId(active.hospitalId, intake.hospitalId)
    && sameId(active.doctorId.hospitalId, active.hospitalId)
    && hospital?.active && hospital?.verified);
  const stalePointer = Boolean(active && !sameId(patient?.doctorId, active.doctorId));
  return {
    doctor, activeAssignment: active, hospital, legacyAssignment,
    legacyReference,
    needsReconciliation: Boolean(legacyAssignment || stalePointer || (active && !coordinated) || (assignment?.status === "active" && !active) || (!active && (intake?.status === "assigned" || intake?.assignedDoctorId))),
  };
}

module.exports = { coordinationAssignmentState, idOf, sameId };
