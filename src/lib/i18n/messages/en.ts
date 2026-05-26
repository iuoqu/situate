/**
 * English message catalog — the source of truth.
 *
 * Every other locale dictionary is a Partial<typeof messages>; missing keys
 * fall back to the English entry here. To add a new translation, copy this
 * file's shape and translate the strings.
 *
 * Interpolation: `{name}` placeholders are replaced at render time by the
 * second argument to `t()`. e.g. t("submit.pins_count", { current: 2 }).
 */
export const messages = {
  common: {
    back_to_situate: "← Situate Editions",
    back_to_map: "← back to the map",
    submission_id_prefix: "Submission",
    constitution_link: "editorial constitution",
    confidence_label: "confidence {percent}%",
  },

  submit: {
    page_title: "Submit a piece",
    lead:
      "We publish flash fiction (800–2,500 words) anchored to real places. This form runs through an AI editor on submission; you'll see the verdict right after you submit.",

    // Section: Your story
    section_your_story_title: "Your story",
    section_your_story_hint:
      "The basics — title, language, author identity.",
    field_title: "Title",
    field_abstract: "One-line abstract (optional)",
    field_source_language: "Source language",
    field_email: "Email",
    field_pen_name: "Pen name (optional)",
    field_pen_name_hint: "If different from your legal name.",
    email_placeholder: "you@example.com",

    // Section F1: scenes on the map
    section_f1_title: "F1 — Where does your story happen?",
    section_f1_hint:
      "Click on the map to drop a pin for each scene. You can drop up to 6. Drag pins to fine-tune their position. Pin order = narrative order.",
    pins_indicator: "{current}/6 pins",
    pins_empty: "No pins yet. Click on the map to place your first scene.",
    scene_label: "Scene {ordinal} · ({lon}, {lat})",
    scene_remove: "remove",
    scene_content_placeholder:
      "What happens at this place? Write the scene here.",
    scene_event_date: "Event date (optional)",
    scene_word_count: "{count} words",
    total_words_line: "Total: {count} words. Required range 800–2,500.",
    field_relocation_test: "Why these places, in this order? (the relocation test)",
    field_relocation_test_hint:
      "At least 50 words (currently {count}). What would break if the route were moved or reshuffled? Cite specific local features — geography, transit, language, ritual — not the mood of the city.",

    // Section F2: affinity
    section_f2_title: "F2 — Your relationship to these places",
    section_f2_hint:
      "All six are equally valid — this just tells us your distance.",
    rel_born_there: "I was born there",
    rel_lived_there: "I lived there",
    rel_worked_there: "I worked there",
    rel_researched: "I researched this place for this story",
    rel_passing_through: "I was passing through",
    rel_never_been: "I have never been there",
    field_duration: "Duration / dates",
    duration_placeholder: "e.g. 2015–2020, or 3 years",
    confidentiality_hint:
      "If disclosing your relationship to this place could endanger you — exile, dissident writing, ongoing safety concerns — tick the box and we will hold the affinity in confidence and publish a redacted note in its place. (Constitution v0.2 / P4)",
    confidentiality_checkbox: "I request confidentiality for safety reasons.",
    confidentiality_reason_placeholder:
      "Brief reason (kept private to editors)",

    // Section F3: story type
    section_f3_title: "F3 — Fiction or based on reality?",
    story_type_fiction: "Fiction.",
    story_type_fiction_desc:
      "People, events, conflicts are invented or altered enough to be unrecognizable.",
    story_type_reality: "Based on reality.",
    story_type_reality_desc:
      "Real events or real people I witnessed, experienced, or carefully researched.",

    // Section F4: real people (conditional)
    section_f4_title: "F4 — Real people",
    section_f4_hint:
      "You chose 'based on reality.' Tell us about any identifiable real people in the piece.",
    f4_has_real_people: "This story includes real, identifiable people.",
    field_consent_status: "Consent status",
    consent_explicit: "Yes — I have explicit consent",
    consent_deceased: "No consent — the person is deceased",
    consent_public_figure: "No consent — public figure in public conduct",
    consent_transformed: "No consent — sufficiently transformed",
    consent_no_consent: "No consent (none of the above)",
    field_consent_explanation:
      "Explanation (required if no explicit consent)",
    field_consent_explanation_hint:
      "Brief — why is depicting this person without consent OK in this piece?",
    field_real_persons_list: "Who are these people?",
    field_real_persons_list_hint:
      "Brief description; one per line or comma-separated.",

    // Section F5: AI in composition
    section_f5_title: "F5 — AI in writing this piece",
    section_f5_hint:
      "Be honest. AI translation ≠ AI creation. (Translator-side AI is logged separately on every translation row.)",
    ai_human_written: "Human-written.",
    ai_human_written_desc: "No AI used in writing",
    ai_translated: "Human-written, AI-translated.",
    ai_translated_desc:
      "I wrote the original; AI handled translation or copy-edits on the language layer",
    ai_assisted: "AI-assisted.",
    ai_assisted_desc:
      "AI helped me brainstorm or rewrite parts, but the imagining was mine",
    ai_created: "AI-created.",
    ai_created_desc:
      "AI authored or substantially revised the prose — flagged for editorial review (P10)",
    field_ai_notes: "Notes (optional)",
    ai_notes_placeholder:
      "e.g. 'Used Claude to draft the opening, rewrote it myself.'",

    // Section F6: risks
    section_f6_title: "F6 — Known harm risks",
    section_f6_hint:
      "Heads-up to the editorial team. Disclosing risks doesn't auto-reject — hiding them is what creates problems later.",
    risk_recently_deceased: "A real, recently deceased person (≤10 years)",
    risk_recent_disaster: "A real, recent disaster or tragedy",
    risk_ongoing_conflict: "An ongoing conflict or trauma",
    risk_strong_local_reaction:
      "I know a specific person/community will react strongly",
    risk_satire: "This piece is satirical.",
    field_risks_explanation: "Explain (≥ 50 words)",
    field_risks_explanation_hint: "Required if you checked any risk above.",

    // Section F7: attestation
    section_f7_title: "F7 — Attestation",
    section_f7_hint: "Your signature here is a legal statement.",
    attestation_text:
      "I have read and accept the {constitution_link}. The information in this form is true and accurate. I am legally responsible for claims about real people. I understand the piece may be removed if legal issues arise.",
    attestation_constitution_link: "editorial constitution ({signature})",

    // Submit button states
    button_submit: "Submit for editorial review",
    button_submit_loading:
      "AI editor is reading your piece — about 10 seconds…",

    // Client-side validation errors
    err_no_pins: "Please drop at least one pin on the map.",
    err_word_count:
      "Total word count must be between 800 and 2,500 (currently {count}).",
    err_relocation_too_short:
      "'Why these places, in this order?' must be at least 50 words (currently {count}).",
    err_attestation_required:
      "Please confirm the four attestation checkboxes before submitting.",
  },

  thanks: {
    // Outcome headlines
    headline_passed: "Your piece passed the AI pre-screen.",
    headline_flagged:
      "The AI editor flagged your piece for editorial attention.",
    headline_declined: "The AI editor declined your piece.",
    headline_unavailable: "Your piece is in human review.",
    headline_pending: "The AI editor is still reading your piece.",
    headline_published: "Your piece has been published.",

    // Outcome leads
    lead_passed:
      "Every principle the AI editor evaluated came back with a high-confidence PASS. The piece is now in the human review queue — typically 7 days for the fast lane.",
    lead_flagged:
      "At least one principle came back uncertain. A human editor reviews next; you'll hear back within 14 days.",
    lead_declined:
      "The AI editor's pre-screen surfaced a high-confidence concern against the constitution. The piece has been returned to draft — revise the issue cited below and you can resubmit.",
    lead_unavailable:
      "The AI pre-screen is temporarily unavailable, so your piece went straight to the human queue. You'll hear back within 14 days.",
    lead_pending:
      "Hold tight — refresh this page in a moment. If nothing appears, the AI pre-screen failed silently and your piece is already in the human queue.",
    lead_published: "It's live. Thank you for trusting us with it.",

    // Body
    your_piece_label: "Your piece",
    piece_meta: "{words} words · {language} · {story_type}",
    section_per_principle:
      "AI editor's per-principle read",
    empty_unavailable:
      "The AI editor wasn't reached on this submission — there are no per-principle reads to show. A human editor takes it from here.",
    empty_pending:
      "No judgments recorded yet. Refresh in a moment if the AI editor is still running.",
    confidence_label: "confidence {percent}%",
    flagged_for_human: "flagged for human review",
    footer:
      "The AI editor is a pre-screen, not the publication decision. A human editor always makes the final call. Decisions reference the public {constitution_link}.",
  },
};

// Shape of the dictionary, with string values rather than literal types.
// DotKeys (in i18n/index.ts) derives the typed key paths from this shape;
// other-locale dictionaries (zh_CN, ja, ko, …) accept any string at any leaf
// position because they use DeepPartial<MessageDictionary>.
export type MessageDictionary = typeof messages;
