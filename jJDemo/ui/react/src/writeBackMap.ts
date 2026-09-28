/*
 * GENERATED — do not edit by hand. Regenerate with scripts/gen-writeback-map.mjs.
 *
 * Action task -> [system of record, the write executed there]. Used as a
 * fallback when the backend predates the targetSystem/writeBack fields, so the
 * write-back story still renders against an older C3 environment.
 */
export const WRITE_BACK: Record<string, [string, string]> = {
  "seed_task_417_a_1": ["SAP Ariba", "Convert requisition to purchase order (capacity PO)"],
  "seed_task_417_a_2": ["Veeva Vault QMS", "Create validation protocol record from precedent"],
  "seed_task_417_a_3": ["Veeva Vault RIM", "Log health-authority interaction and hold the review slot"],
  "seed_task_417_a_4": ["Planisware", "Re-baseline G3 and cascade the dependent milestones"],
  "seed_task_417_a_5": ["SAP SRM", "Raise contract amendment — take-or-pay clause"],
  "seed_task_417_a_6": ["Veeva Vault QMS", "Approve protocol and release the validation lots"],
  "seed_task_417_a_7": ["SAP ECC", "Release budget against the NPI contingency line (FM)"],
  "seed_task_417_b_1": ["Supplier portal", "Reserve the aseptic fill slot"],
  "seed_task_417_b_2": ["LabWare LIMS", "Create the extractables and leachables study"],
  "seed_task_417_b_3": ["Veeva Vault QMS", "Approve the bridging protocol"],
  "seed_task_417_b_4": ["Veeva Vault RIM", "Revise CTD Module 3 section 4.3"],
  "seed_task_417_b_5": ["Veeva Vault RIM", "File pre-notification and request a review slot"],
  "seed_task_417_b_6": ["LabWare LIMS", "Raise container-closure integrity requalification order"],
  "seed_task_417_b_7": ["SAP ECC", "Release budget against the NPI contingency line (FM)"],
  "seed_task_417_c_1": ["Planisware", "Reverse the G1 gate decision and re-open the sequence"],
  "seed_task_417_c_2": ["SAP ECC", "Confirm in-house fill capacity (PP capacity check)"],
  "seed_task_417_c_3": ["Veeva Vault RIM", "Split the dossier — separate US and EU submissions"],
  "seed_task_417_c_4": ["Veeva Vault RIM", "Release the review slot and request the next window"],
  "seed_task_417_c_5": ["SAP ECC", "Re-phase the launch plan (CO-PA)"],
  "seed_task_417_c_6": ["Pfizer Connect", "Re-sequence market activation and notify affiliates"],
  "seed_task_417_c_7": ["Planisware", "Re-time the DE and FR tender milestones"],
  "seed_task_412_a_1": ["SAP ECC", "Place stock in quarantine — QM inspection block"],
  "seed_task_412_a_2": ["MES", "Update the inspection plan to 100% dimensional check"],
  "seed_task_412_a_3": ["SAP IBP", "Re-weight the market allocation"],
  "seed_task_412_a_4": ["Planisware", "Re-baseline the P3 activities and cascade the shortfall"],
  "seed_task_412_a_5": ["SAP IBP", "Approve and publish the revised allocation"],
};
